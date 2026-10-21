// Profil MiB w procesie głównym: sesja, konto, kosmetyki, ustawienia, statystyki, kopia modów.
// Wszystko, co dostaje interfejs, to zwykłe obiekty; błąd to {error: kod}, nigdy wyjątek.
const P = require('./lib/profile');

const SESSION = 'mib-session.json', QUEUE = 'mib-stats-queue.json', REVIEW = 'mib-mod-review.json';
const QUEUE_MAX = 200;
// Funkcje panelu admina; baza i tak sprawdza, czy wywołuje je admin
const ADMIN_FNS = new Set(['admin_stats', 'admin_find_players', 'admin_player_cosmetics', 'admin_grant', 'admin_revoke', 'admin_delete_player',
  'admin_save_cosmetic', 'admin_delete_cosmetic', 'admin_create_codes', 'admin_list_codes', 'admin_delete_code',
  'admin_list_announcements', 'admin_save_announcement', 'admin_delete_announcement',
  'admin_list_ideas', 'admin_count_new_ideas', 'admin_set_idea_status', 'admin_delete_idea', 'admin_answer_idea', 'admin_gift', 'admin_gift_all',
  'admin_idea_details', 'admin_list_reports', 'admin_count_new_reports', 'admin_warn', 'admin_ban', 'admin_unban', 'admin_dismiss_report', 'admin_activity']);
const CRASH_MAX = 20000;

// hidden(): tryb niewidoczny (znajomi widzą offline)
function createProfile({ supa, store, safeStorage, randomBytes, now = Date.now, mods, hidden = () => false }) {
  let sess = null, restored = false, game = null, flushing = null, seq = 0, server = null, shareServer = true, lastPing = 0;
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
      const sel = cols => authed(t2 => supa.select('profiles', 'select=' + cols + '&id=eq.' + sess.userId, t2)), base = 'nick,num,founder,created_at,playtime_min,launches,version_stats,bugs_found';
      // ostrzeżenia i ban od 0.20.0; baza bez nowego schema.sql: profil działa bez nich
      const [p] = await sel(base + ',warnings,banned_at,ban_reason').catch(e => (e.code === 'schema_outdated' ? sel(base) : Promise.reject(e)));
      if (!p) return { needsProfile: true }; // konto bez profilu: gracz wybiera nick i dokańcza profil
      const admin = await authed(t2 => supa.rpc('is_admin', {}, t2)).then(Boolean, () => false);
      safe.presence({ soft: true }); // znajomi od razu widzą, że launcher działa (nie częściej niż co minutę)
      return {
        admin,
        loggedIn: true, nick: p.nick, mibId: P.formatMibId(p.num), founder: p.founder, createdAt: p.created_at, bugsFound: p.bugs_found || 0,
        warnings: p.warnings || 0, banned: !!p.banned_at, banReason: p.ban_reason || null,
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
    // Ogłoszenia widzą wszyscy, także bez profilu (baza pokazuje tylko aktualne)
    announcements: () => supa.select('announcements', 'select=id,title,body,pinned,popup,created_at&order=pinned.desc,created_at.desc&limit=10')
      .catch(e => (e.code === 'schema_outdated' ? supa.select('announcements', 'select=id,title,body,pinned,created_at&order=pinned.desc,created_at.desc&limit=10') : Promise.reject(e))),
    // lite: bez tekstur (do list wyboru), żeby nie pobierać ich niepotrzebnie
    allCosmetics: ({ lite } = {}) => supa.select('cosmetics', 'select=id,name,type' + (lite ? '' : ',texture') + '&order=created_at.desc'),
    async admin({ fn, args }) {
      if (!ADMIN_FNS.has(fn)) return { error: 'not_admin_fn' };
      return authed(t => supa.rpc(fn, args || {}, t));
    },
    async nickFree({ nick }) {
      const bad = P.validateNick(nick);
      if (bad) return { error: bad };
      return { free: !!(await supa.rpc('nick_available', { p_nick: nick })) };
    },
    async cosmetics() {
      const [rows, [p]] = await Promise.all([
        authed(t => supa.select('owned_cosmetics', 'select=source,acquired_at,cosmetics(id,name,type,image_url,texture)&order=acquired_at.desc', t)),
        authed(t => supa.select('profiles', 'select=equipped&id=eq.' + sess.userId, t)).catch(() => [])]);
      const eq = (p && p.equipped) || {};
      // tekstura z panelu admina ma pierwszeństwo przed zewnętrznym obrazkiem
      return rows.filter(r => r.cosmetics).map(r => ({ id: r.cosmetics.id, name: r.cosmetics.name, type: r.cosmetics.type, imageUrl: r.cosmetics.texture || r.cosmetics.image_url,
        texture: r.cosmetics.texture || null, acquiredAt: r.acquired_at, source: r.source, equipped: eq[r.cosmetics.type] === r.cosmetics.id }));
    },
    // Założenie (id) albo zdjęcie (id = null) kosmetyku danego typu; baza sprawdza, czy gracz go ma
    async equip({ type, id }) {
      const equipped = await authed(t => supa.rpc('equip_cosmetic', { p_type: type, p_id: id || null }, t));
      return { ok: true, equipped: equipped || {} };
    },
    async redeem({ code }) {
      const r = await authed(t => supa.rpc('redeem_code', { p_code: String(code || '').trim().toUpperCase() }, t));
      return { id: r.cosmetic_id, name: r.name, type: r.type, imageUrl: r.image_url };
    },
    // ===== Gracze MiB w grze (logo przed nickiem, peleryny innych) =====
    // Zgłoszenie konta Minecrafta (potwierdza je Mojang); z profilem MiB baza łączy konto z profilem (peleryna)
    async mibHello({ name, serverId }) {
      let t = null;
      try { t = await token(); } catch {}
      return supa.rpc('mib_hello', { p_name: name, p_server_id: serverId }, t || undefined);
    },
    mibPing: ({ uuid, token: tok, online }) => supa.rpc('mib_ping', { p_uuid: uuid, p_token: tok, p_online: online !== false }),
    mibWho: ({ ids, names }) => supa.rpc('mib_who', { p_ids: ids || [], p_names: names || [] }),
    // Tekstury kosmetyków innych graczy (tabela cosmetics jest publiczna); id tylko z bezpiecznych znaków
    async capeTextures({ ids }) {
      const ok = (ids || []).filter(id => /^[a-z0-9_]{2,32}$/.test(id));
      if (!ok.length) return [];
      return supa.select('cosmetics', 'select=id,texture&id=in.(' + ok.join(',') + ')');
    },
    async submitIdea({ category, body }) {
      const bad = P.validateIdea({ category, body });
      if (bad) return { error: bad };
      const id = await authed(t => supa.rpc('submit_idea', { p_category: category, p_body: String(body).trim() }, t));
      return { ok: true, id };
    },
    myIdeas: () => authed(t => supa.select('ideas', 'select=id,category,body,status,reply,rewarded,created_at&order=created_at.desc&limit=20', t)),
    // Zmiany w moich pomysłach (status, odpowiedź twórcy) i ich obejrzenie
    ideaUpdates: () => authed(t => supa.rpc('ideas_updates', {}, t)),
    async ideasSeen() { await authed(t => supa.rpc('ideas_seen', {}, t)); return { ok: true }; },
    // Raport awarii jako zgłoszenie błędu (raport składa main.js bez tokenów); za długi: początek i koniec
    async submitCrash({ body, details }) {
      const b = String(body || '').trim();
      if (b.length < 10) return { error: 'idea_short' };
      let d = String(details || '');
      if (d.length > CRASH_MAX) d = d.slice(0, 4000) + '\n[…]\n' + d.slice(-(CRASH_MAX - 4010));
      return { ok: true, id: await authed(t => supa.rpc('submit_crash', { p_body: b.slice(0, 1000), p_details: d }, t)) };
    },
    // Prezenty od MiB: do odebrania (kosmetyk trafia na profil dopiero po „Odbierz”)
    gifts: () => authed(t => supa.rpc('my_gifts', {}, t)),
    async claimGift({ id }) { return { cosmetic: await authed(t => supa.rpc('claim_gift', { p_id: id }, t)) }; },
    async pullSettings() {
      const [p] = await authed(t => supa.select('profiles', 'select=settings,settings_updated_at&id=eq.' + sess.userId, t));
      return p && p.settings ? { settings: p.settings, updatedAt: Number(p.settings_updated_at) || 0 } : null;
    },
    async pushSettings({ settings, updatedAt }) {
      await authed(t => supa.update('profiles', 'id=eq.' + sess.userId, { settings: P.pickSynced(settings), settings_updated_at: updatedAt }, t));
      return { ok: true };
    },
    // ===== Znajomi =====
    friends: () => authed(t => supa.rpc('friends_list', {}, t)),
    async friendRequest({ who }) {
      const w = String(who || '').trim();
      if (!w || w.length > 20) return { error: 'friend_not_found' };
      return { result: await authed(t => supa.rpc('friend_request', { p_who: w }, t)) };
    },
    async friendAnswer({ id, accept }) {
      await authed(t => supa.rpc('friend_answer', { p_from: id, p_accept: !!accept }, t));
      return { ok: true };
    },
    async friendRemove({ id }) {
      await authed(t => supa.rpc('friend_remove', { p_user: id }, t));
      return { ok: true };
    },
    // Zaproszenia do gry: na serwer, na którym gracz gra teraz (baza bierze go z obecności)
    async inviteFriend({ id }) {
      return { result: await authed(t => supa.rpc('game_invite', { p_user: id }, t)) };
    },
    invites: () => authed(t => supa.rpc('game_invites_list', {}, t)),
    // Serwer, na który można teraz zaprosić znajomych (gra działa, mod zgłosił serwer, gracz go pokazuje)
    nowPlaying: () => ({ playing: !!game, server: game && shareServer && !hidden() ? server : null }),
    async inviteDismiss({ id }) {
      await authed(t => supa.rpc('game_invite_dismiss', { p_from: id }, t));
      return { ok: true };
    },
    // ===== Bezpieczeństwo: blokowanie, zgłoszenia, ostrzeżenia =====
    async block({ id }) { await authed(t => supa.rpc('block_user', { p_user: id }, t)); return { ok: true }; },
    async unblock({ id }) { await authed(t => supa.rpc('unblock_user', { p_user: id }, t)); return { ok: true }; },
    blocked: () => authed(t => supa.rpc('blocked_list', {}, t)),
    // message: zgłaszana wiadomość od tej osoby (albo null: zgłoszenie samego gracza)
    async report({ id, message, reason, note }) {
      return { id: await authed(t => supa.rpc('report_user', { p_user: id, p_message: message || null, p_reason: reason, p_note: String(note || '').trim() || null }, t)) };
    },
    warnings: () => authed(t => supa.rpc('my_warnings', {}, t)),
    async warningsSeen() { await authed(t => supa.rpc('warnings_seen', {}, t)); return { ok: true }; },
    // Liczby do osiągnięć: moje (id puste) albo znajomego (z nazwą konta Minecraft i założonymi kosmetykami)
    card: ({ id } = {}) => authed(t => supa.rpc('profile_card', { p_user: id || null }, t)),
    // ===== Wiadomości do znajomych =====
    chat: ({ id, before }) => authed(t => supa.rpc('messages_with', { p_user: id, p_before: before || null }, t)),
    async chatSend({ id, body }) {
      const b = String(body == null ? '' : body).trim();
      if (!b) return { error: 'message_empty' };
      if (b.length > 500) return { error: 'message_long' };
      return { result: await authed(t => supa.rpc('message_send', { p_to: id, p_body: b }, t)) };
    },
    async chatRead({ id }) {
      await authed(t => supa.rpc('messages_read', { p_user: id }, t));
      return { ok: true };
    },
    chatUnread: () => authed(t => supa.rpc('messages_unread', {}, t)),
    // Obecność dla znajomych (co 2 minuty, przy starcie i końcu gry, przy zmianie serwera): launcher albo gra z wersją i serwerem
    async presence({ soft } = {}) {
      restore();
      if (soft && now() - lastPing < 60000) return { ok: true };
      if (!sess || !(await token())) return { ok: false };
      lastPing = now();
      const args = { p_playing: !!game, p_version: game ? game.version : null, p_server: game && shareServer ? server : null };
      // tryb niewidoczny od 0.20.0; stara baza zna tylko trzy argumenty
      await authed(t => supa.rpc('presence_ping', { ...args, p_hidden: !!hidden() }, t))
        .catch(e => (e.code === 'schema_outdated' ? authed(t => supa.rpc('presence_ping', args, t)) : Promise.reject(e)));
      return { ok: true };
    },
    async presenceLeave() {
      restore();
      if (!sess || !(await token())) return { ok: false };
      await authed(t => supa.rpc('presence_leave', {}, t));
      return { ok: true };
    },
    // Serwer z moda MiB (null = menu, świat jednoosobowy); share: ustawienie „pokazuj znajomym serwer”
    gameServer(s, share = true) {
      const next = typeof s === 'string' ? s : null;
      shareServer = share !== false;
      if (next === server) return;
      server = next;
      if (game) safe.presence();
    },
    gameStarted(version) { game = { version, start: now() }; server = null; safe.presence(); },
    async gameClosed() {
      if (!game) return;
      const g = game;
      game = null;
      server = null;
      safe.presence();
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
  remove: 'prof:delete', createProfile: 'prof:createProfile', nickFree: 'prof:nickFree', announcements: 'prof:announcements', allCosmetics: 'prof:allCosmetics', admin: 'prof:admin', cosmetics: 'prof:cosmetics', redeem: 'prof:redeem', pullSettings: 'prof:pullSettings', pushSettings: 'prof:pushSettings',
  equip: 'prof:equip', modInfo: 'prof:modInfo', modRestore: 'prof:modRestore', modReplace: 'prof:modReplace', submitIdea: 'prof:submitIdea', myIdeas: 'prof:myIdeas',
  friends: 'prof:friends', friendRequest: 'prof:friendRequest', friendAnswer: 'prof:friendAnswer', friendRemove: 'prof:friendRemove',
  inviteFriend: 'prof:inviteFriend', invites: 'prof:invites', inviteDismiss: 'prof:inviteDismiss', nowPlaying: 'prof:nowPlaying',
  chat: 'prof:chat', chatSend: 'prof:chatSend', chatRead: 'prof:chatRead', chatUnread: 'prof:chatUnread',
  ideaUpdates: 'prof:ideaUpdates', ideasSeen: 'prof:ideasSeen', gifts: 'prof:gifts', claimGift: 'prof:claimGift',
  block: 'prof:block', unblock: 'prof:unblock', blocked: 'prof:blocked', report: 'prof:report', warnings: 'prof:warnings', warningsSeen: 'prof:warningsSeen',
  card: 'prof:card' };

function register(ipcMain, api) {
  for (const [k, ch] of Object.entries(CHANNELS)) ipcMain.handle(ch, (_, arg) => api[k](arg || {}));
}

module.exports = { createProfile, register };
