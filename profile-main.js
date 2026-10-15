// Profil MiB w procesie głównym: sesja, konto, kosmetyki, ustawienia, statystyki.
// Wszystko, co dostaje interfejs, to zwykłe obiekty; błąd to {error: kod}, nigdy wyjątek.
const P = require('./lib/profile');

const SESSION = 'mib-session.json', QUEUE = 'mib-stats-queue.json';

function createProfile({ supa, store, safeStorage, randomBytes, now = Date.now }) {
  let sess = null, restored = false, game = null, flushing = null;

  function saveSession(s) {
    sess = s;
    restored = true; // sesja w pamięci jest ważniejsza niż plik z dysku
    if (!s) return store.remove(SESSION);
    // Hasła nie zapisujemy nigdy; refresh token tylko zaszyfrowany przez system
    if (safeStorage.isEncryptionAvailable()) store.write(SESSION, { t: safeStorage.encryptString(s.refreshToken).toString('base64') });
  }
  function restore() {
    if (restored) return;
    restored = true;
    const f = store.read(SESSION, null);
    if (f && f.t && safeStorage.isEncryptionAvailable()) {
      try { sess = { refreshToken: safeStorage.decryptString(Buffer.from(f.t, 'base64')), expiresAt: 0 }; } catch { store.remove(SESSION); }
    }
  }
  // Ważny access token albo null (brak profilu). Brak sieci rzuca dalej ('offline').
  async function token() {
    restore();
    if (!sess) return null;
    if (sess.accessToken && sess.expiresAt - now() > 60000) return sess.accessToken;
    try {
      saveSession(await supa.refresh(sess.refreshToken));
      return sess.accessToken;
    } catch (e) {
      if (e.code === 'bad_login') { saveSession(null); return null; }
      throw e;
    }
  }
  async function need() {
    const t = await token();
    if (!t) throw Object.assign(new Error('not_logged_in'), { code: 'not_logged_in' });
    return t;
  }

  // Kolejka sesji gry: wysyłana po jednej, usuwana po każdej udanej, żeby nic nie policzyć dwa razy
  function flushStats(t) {
    if (flushing) return flushing;
    flushing = (async () => {
      let q = store.read(QUEUE, []);
      while (q.length) {
        await supa.rpc('add_play_session', { p_version: q[0].v, p_minutes: q[0].min }, t);
        q = q.slice(1);
        store.write(QUEUE, q);
      }
    })().finally(() => { flushing = null; });
    return flushing;
  }

  async function state() {
    let t;
    try { t = await token(); } catch { return { offline: true }; }
    if (!t) return { loggedIn: false };
    await flushStats(t).catch(() => {});
    try {
      const [p] = await supa.select('profiles', 'select=nick,num,founder,created_at,playtime_min,launches,version_stats&id=eq.' + sess.userId, t);
      if (!p) return { error: 'no_profile' };
      return {
        loggedIn: true, nick: p.nick, mibId: P.formatMibId(p.num), founder: p.founder, createdAt: p.created_at,
        playtimeMin: p.playtime_min, launches: p.launches, versionStats: p.version_stats || {},
      };
    } catch (e) {
      return e.code === 'offline' ? { offline: true } : { error: e.code || 'unknown' };
    }
  }

  async function newCode() {
    const t = await need(), code = P.newRecoveryCode(randomBytes);
    await supa.rpc('set_recovery_code', { p_code: code }, t);
    return { recoveryCode: code };
  }
  async function withCode(st) {
    if (!st.loggedIn) return st;
    try { return { ...st, ...(await newCode()) }; } catch (e) { return { ...st, recoveryError: e.code || 'unknown' }; }
  }

  const api = {
    state,
    async signup({ email, password, nick }) {
      const bad = P.validateNick(nick);
      if (bad) return { error: bad };
      if (String(password || '').length < 8) return { error: 'weak_password' };
      saveSession(await supa.signUp(String(email).trim(), password, nick));
      return withCode(await state());
    },
    async login({ email, password }) {
      saveSession(await supa.signIn(String(email).trim(), password));
      return state();
    },
    async logout() {
      try { const t = await token(); if (t) await supa.signOut(t); } catch {}
      saveSession(null);
      return { loggedIn: false };
    },
    newCode,
    async reset({ email, code, password }) {
      if (String(password || '').length < 8) return { error: 'weak_password' };
      const ok = await supa.rpc('reset_password_with_code', { p_email: String(email).trim(), p_code: code, p_new_password: password });
      if (!ok) return { error: 'reset_failed' };
      return withCode(await api.login({ email, password }));
    },
    async remove() {
      await supa.rpc('delete_my_profile', {}, await need());
      saveSession(null);
      store.write(QUEUE, []);
      return { loggedIn: false };
    },
    async nickFree({ nick }) {
      const bad = P.validateNick(nick);
      if (bad) return { error: bad };
      return { free: !!(await supa.rpc('nick_available', { p_nick: nick })) };
    },
    async cosmetics() {
      const rows = await supa.select('owned_cosmetics', 'select=source,acquired_at,cosmetics(id,name,type,image_url)&order=acquired_at.desc', await need());
      return rows.filter(r => r.cosmetics).map(r => ({ id: r.cosmetics.id, name: r.cosmetics.name, type: r.cosmetics.type, imageUrl: r.cosmetics.image_url, acquiredAt: r.acquired_at, source: r.source }));
    },
    async redeem({ code }) {
      const t = await need();
      const r = await supa.rpc('redeem_code', { p_code: String(code || '').trim().toUpperCase() }, t);
      return { id: r.cosmetic_id, name: r.name, type: r.type, imageUrl: r.image_url };
    },
    async pullSettings() {
      const t = await need();
      const [p] = await supa.select('profiles', 'select=settings,settings_updated_at&id=eq.' + sess.userId, t);
      return p && p.settings ? { settings: p.settings, updatedAt: Number(p.settings_updated_at) || 0 } : null;
    },
    async pushSettings({ settings, updatedAt }) {
      const t = await need();
      await supa.update('profiles', 'id=eq.' + sess.userId, { settings: P.pickSynced(settings), settings_updated_at: updatedAt }, t);
      return { ok: true };
    },
    gameStarted(version) { game = { version, start: now() }; },
    async gameClosed() {
      if (!game) return;
      const g = game;
      game = null;
      restore();
      if (!sess) return; // statystyki tylko z profilem
      store.write(QUEUE, [...store.read(QUEUE, []), { v: g.version, min: P.clampSessionMinutes(now() - g.start) }]);
      try { const t = await token(); if (t) await flushStats(t); } catch {}
    },
    // dla Task 5 (kopia modów)
    _token: token, _userId: () => sess && sess.userId,
  };

  // Każda metoda dla interfejsu: wynik albo {error}
  const safe = {};
  for (const [k, fn] of Object.entries(api)) {
    safe[k] = k.startsWith('_') || k.startsWith('game') ? fn : async (...a) => { try { return await fn(...a); } catch (e) { return { error: e.code || 'unknown' }; } };
  }
  return safe;
}

const CHANNELS = { state: 'prof:state', signup: 'prof:signup', login: 'prof:login', logout: 'prof:logout', newCode: 'prof:newCode', reset: 'prof:reset',
  remove: 'prof:delete', nickFree: 'prof:nickFree', cosmetics: 'prof:cosmetics', redeem: 'prof:redeem', pullSettings: 'prof:pullSettings', pushSettings: 'prof:pushSettings' };

function register(ipcMain, api) {
  for (const [k, ch] of Object.entries(CHANNELS)) ipcMain.handle(ch, (_, arg) => api[k](arg || {}));
}

module.exports = { createProfile, register };
