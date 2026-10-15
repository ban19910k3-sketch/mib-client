// Profil MiB w procesie głównym: sesja, konto, kosmetyki, ustawienia, statystyki, kopia modów.
// Wszystko, co dostaje interfejs, to zwykłe obiekty; błąd to {error: kod}, nigdy wyjątek.
const P = require('./lib/profile');

const SESSION = 'mib-session.json', QUEUE = 'mib-stats-queue.json', REVIEW = 'mib-mod-review.json';
const QUEUE_MAX = 200;

function createProfile({ supa, store, safeStorage, randomBytes, now = Date.now, mods }) {
  let sess = null, restored = false, game = null, flushing = null, seq = 0;
  const modLocks = {};

  function saveSession(s) {
    sess = s;
    restored = true; // sesja w pamięci jest ważniejsza niż plik z dysku
    if (!s) return store.remove(SESSION);
    // Hasła nie zapisujemy nigdy; refresh token tylko zaszyfrowany przez system. ID profilu nie jest tajne.
    if (safeStorage.isEncryptionAvailable()) store.write(SESSION, { t: safeStorage.encryptString(s.refreshToken).toString('base64'), u: s.userId });
  }
  function restore() {
    if (restored) return;
    restored = true;
    const f = store.read(SESSION, null);
    if (f && f.t && safeStorage.isEncryptionAvailable()) {
      try { sess = { refreshToken: safeStorage.decryptString(Buffer.from(f.t, 'base64')), expiresAt: 0, userId: f.u }; } catch { store.remove(SESSION); }
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
  // Wywołanie z tokenem; gdy serwer uzna token za wygasły, odświeżamy raz i ponawiamy
  async function authed(fn) {
    try {
      return await fn(await need());
    } catch (e) {
      if (e.code !== 'auth_expired' || !sess) throw e;
      sess.accessToken = null;
      return fn(await need());
    }
  }

  // ===== Statystyki =====
  // Kolejka sesji gry: każda ma id i profil; plik czytamy na nowo przed każdym zapisem, żeby nic nie zgubić ani nie policzyć dwa razy
  function flushStats() {
    if (flushing) return flushing;
    flushing = (async () => {
      for (;;) {
        const uid = sess && sess.userId;
        const next = uid && store.read(QUEUE, []).find(e => e.u === uid);
        if (!next) return;
        await authed(t => supa.rpc('add_play_session', { p_version: next.v, p_minutes: next.min }, t));
        store.write(QUEUE, store.read(QUEUE, []).filter(e => e.id !== next.id));
      }
    })().finally(() => { flushing = null; });
    return flushing;
  }

  async function state() {
    let t;
    try { t = await token(); } catch { return { offline: true }; }
    if (!t) return { loggedIn: false };
    await flushStats().catch(() => {});
    try {
      const [p] = await authed(t2 => supa.select('profiles', 'select=nick,num,founder,created_at,playtime_min,launches,version_stats&id=eq.' + sess.userId, t2));
      if (!p) return { needsProfile: true }; // konto bez profilu: gracz wybiera nick i dokańcza profil
      return {
        loggedIn: true, nick: p.nick, mibId: P.formatMibId(p.num), founder: p.founder, createdAt: p.created_at,
        playtimeMin: p.playtime_min, launches: p.launches, versionStats: p.version_stats || {},
      };
    } catch (e) {
      if (e.code === 'not_logged_in') return { loggedIn: false };
      // Inne błędy są chwilowe: nie wylogowujemy gracza
      return { offline: true, error: e.code || 'unknown' };
    }
  }

  async function newCode() {
    const code = P.newRecoveryCode(randomBytes);
    await authed(t => supa.rpc('set_recovery_code', { p_code: code }, t));
    return { recoveryCode: code };
  }
  async function withCode(st) {
    if (!st.loggedIn) return st;
    try { return { ...st, ...(await newCode()) }; } catch (e) { return { ...st, recoveryError: e.code || 'unknown' }; }
  }

  // ===== Kopia modów =====
  // „Przejrzana” kopia: ten profil na tym komputerze i w tym katalogu gry ją przywrócił, zastąpił albo sam utworzył
  const reviewKey = gv => [sess && sess.userId, mods.root(), gv].join('|');
  const reviewed = gv => !!store.read(REVIEW, {})[reviewKey(gv)];
  const markReviewed = gv => store.write(REVIEW, { ...store.read(REVIEW, {}), [reviewKey(gv)]: true });
  const remoteBackup = async gv => (await authed(t => supa.select('mod_backups', 'select=game_version,loader,mods,skipped&game_version=eq.' + encodeURIComponent(gv), t)))[0] || null;
  async function pushMods(gv) {
    const files = mods.scan(gv), ids = files.length ? await mods.identify(files.map(f => f.sha1)) : {};
    const list = files.filter(f => ids[f.sha1]).map(f => ({ project: ids[f.sha1].project_id, version: ids[f.sha1].id, file: f.file.replace(/\.disabled$/, ''), on: f.on }));
    await authed(t => supa.upsert('mod_backups', { user_id: sess.userId, game_version: gv, loader: mods.loader(gv), mods: list, skipped: files.length - list.length, updated_at: new Date(now()).toISOString() }, t));
    markReviewed(gv);
  }
  // Zmiany modów jednej wersji obsługujemy po kolei, żeby starsza kopia nie nadpisała nowszej
  const serial = (gv, fn) => (modLocks[gv] = (modLocks[gv] || Promise.resolve()).catch(() => {}).then(fn));

  const api = {
    state,
    modsChanged: gv => serial(gv, async () => {
      restore();
      if (!sess || !(await token())) return;
      const r = await remoteBackup(gv);
      if (P.backupDecision({ hasRemote: !!(r && r.mods && r.mods.length), reviewed: reviewed(gv) }) === 'push') await pushMods(gv);
    }),
    async modInfo({ gv }) {
      const r = await remoteBackup(gv);
      return r ? { count: (r.mods || []).length, skipped: r.skipped || 0, reviewed: reviewed(gv) } : null;
    },
    modReplace: ({ gv }) => serial(gv, async () => { await pushMods(gv); return { ok: true }; }),
    async modRestore({ gv }) {
      const r = await remoteBackup(gv);
      if (!r) return { added: 0, skipped: 0, failed: 0 };
      const local = mods.loader(gv);
      if (local && r.loader && local !== r.loader) return { error: 'loader_mismatch' };
      if (!local && r.loader) mods.setLoader(gv, r.loader);
      const out = { added: 0, skipped: 0, failed: 0 };
      for (const m of r.mods || []) {
        if (mods.exists(gv, m.file)) { out.skipped++; continue; }
        try { await mods.download(gv, m.version, m.on); out.added++; } catch { out.failed++; }
      }
      markReviewed(gv);
      return out;
    },
    async signup({ email, password, nick }) {
      const bad = P.validateNick(nick);
      if (bad) return { error: bad };
      if (String(password || '').length < 8) return { error: 'weak_password' };
      saveSession(await supa.signUp(String(email).trim(), password, nick));
      const st = await state();
      // Gdy baza nie utworzyła profilu sama (np. brak triggera), dokańczamy go tym samym nickiem
      return st.needsProfile ? api.createProfile({ nick }) : withCode(st);
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
      const uid = sess && sess.userId;
      await authed(t => supa.rpc('delete_my_profile', {}, t));
      saveSession(null);
      store.write(QUEUE, store.read(QUEUE, []).filter(e => e.u !== uid));
      return { loggedIn: false };
    },
    async createProfile({ nick }) {
      const bad = P.validateNick(nick);
      if (bad) return { error: bad };
      await authed(t => supa.rpc('create_my_profile', { p_nick: nick }, t));
      return withCode(await state());
    },
    async nickFree({ nick }) {
      const bad = P.validateNick(nick);
      if (bad) return { error: bad };
      return { free: !!(await supa.rpc('nick_available', { p_nick: nick })) };
    },
    async cosmetics() {
      const rows = await authed(t => supa.select('owned_cosmetics', 'select=source,acquired_at,cosmetics(id,name,type,image_url)&order=acquired_at.desc', t));
      return rows.filter(r => r.cosmetics).map(r => ({ id: r.cosmetics.id, name: r.cosmetics.name, type: r.cosmetics.type, imageUrl: r.cosmetics.image_url, acquiredAt: r.acquired_at, source: r.source }));
    },
    async redeem({ code }) {
      const r = await authed(t => supa.rpc('redeem_code', { p_code: String(code || '').trim().toUpperCase() }, t));
      return { id: r.cosmetic_id, name: r.name, type: r.type, imageUrl: r.image_url };
    },
    async pullSettings() {
      const [p] = await authed(t => supa.select('profiles', 'select=settings,settings_updated_at&id=eq.' + sess.userId, t));
      return p && p.settings ? { settings: p.settings, updatedAt: Number(p.settings_updated_at) || 0 } : null;
    },
    async pushSettings({ settings, updatedAt }) {
      await authed(t => supa.update('profiles', 'id=eq.' + sess.userId, { settings: P.pickSynced(settings), settings_updated_at: updatedAt }, t));
      return { ok: true };
    },
    gameStarted(version) { game = { version, start: now() }; },
    async gameClosed() {
      if (!game) return;
      const g = game;
      game = null;
      restore();
      if (!sess || !sess.userId) return; // statystyki tylko z profilem
      const entry = { id: now() + '-' + ++seq, u: sess.userId, v: g.version, min: P.clampSessionMinutes(now() - g.start) };
      store.write(QUEUE, [...store.read(QUEUE, []), entry].slice(-QUEUE_MAX));
      try {
        if (!(await token())) return;
        await flushStats();
        if (store.read(QUEUE, []).some(e => e.id === entry.id)) await flushStats(); // trafiliśmy na kończące się wysyłanie
      } catch {}
    },
  };

  // Każda metoda dla interfejsu: wynik albo {error}
  const safe = {};
  for (const [k, fn] of Object.entries(api)) {
    // detail: komunikat serwera, żeby gracz mógł go przekazać przy nieznanym błędzie
    safe[k] = k.startsWith('game') ? fn : async (...a) => { try { return await fn(...a); } catch (e) { return { error: e.code || 'unknown', detail: String(e.message || '').slice(0, 200) }; } };
  }
  return safe;
}

const CHANNELS = { state: 'prof:state', signup: 'prof:signup', login: 'prof:login', logout: 'prof:logout', newCode: 'prof:newCode', reset: 'prof:reset',
  remove: 'prof:delete', createProfile: 'prof:createProfile', nickFree: 'prof:nickFree', cosmetics: 'prof:cosmetics', redeem: 'prof:redeem', pullSettings: 'prof:pullSettings', pushSettings: 'prof:pushSettings',
  modInfo: 'prof:modInfo', modRestore: 'prof:modRestore', modReplace: 'prof:modReplace' };

function register(ipcMain, api) {
  for (const [k, ch] of Object.entries(CHANNELS)) ipcMain.handle(ch, (_, arg) => api[k](arg || {}));
}

module.exports = { createProfile, register };
