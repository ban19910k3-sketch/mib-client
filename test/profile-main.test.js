const test = require('node:test');
const assert = require('node:assert/strict');
const { createProfile } = require('../profile-main');
const { SupaError } = require('../lib/supa');

function memStore() {
  const files = {}, writes = [];
  return {
    files, writes,
    read: (f, d) => (f in files ? JSON.parse(JSON.stringify(files[f])) : d),
    write: (f, v) => { files[f] = JSON.parse(JSON.stringify(v)); writes.push(JSON.stringify(v)); },
    remove: f => { delete files[f]; },
  };
}
const safe = (available = true) => ({
  isEncryptionAvailable: () => available,
  encryptString: s => Buffer.from('x' + s),
  decryptString: b => b.toString().slice(1),
});
const sess = (n = 1) => ({ accessToken: 'AT' + n, refreshToken: 'RT' + n, expiresAt: 10_000_000, userId: 'U1' });
const profileRow = { nick: 'Gracz_1', num: 7, founder: true, created_at: '2026-10-15', playtime_min: 0, launches: 0, version_stats: {} };

// Atrapa klienta Supabase: każdą metodę można podmienić w teście
function fakeSupa(over = {}) {
  const calls = [];
  const base = {
    signUp: async () => sess(),
    signIn: async () => sess(),
    refresh: async () => sess(2),
    signOut: async () => null,
    rpc: async () => null,
    select: async t => (t === 'profiles' ? [profileRow] : []),
    update: async () => null,
    upsert: async () => null,
  };
  const s = {};
  for (const k of Object.keys(base)) s[k] = async (...a) => { calls.push([k, ...a]); return (over[k] || base[k])(...a); };
  s.calls = calls;
  return s;
}
const mk = (o = {}) => {
  const store = o.store || memStore(), supa = o.supa || fakeSupa();
  let t = 1_000_000;
  const p = createProfile({ supa, store, safeStorage: o.safe || safe(), randomBytes: n => Buffer.alloc(n, 7), now: () => t });
  return { p, store, supa, tick: ms => { t += ms; } };
};

test('signup stores only the encrypted refresh token and sets a recovery code', async () => {
  const { p, store, supa } = mk();
  const r = await p.signup({ email: 'a@b.pl', password: 'tajnehaslo1', nick: 'Gracz_1' });
  assert.equal(r.loggedIn, true);
  assert.equal(r.mibId, 'MIB-000007');
  assert.match(r.recoveryCode, /^[0-9A-Z]{4}-/);
  const rpc = supa.calls.find(c => c[0] === 'rpc' && c[1] === 'set_recovery_code');
  assert.equal(rpc[2].p_code, r.recoveryCode);
  assert.equal(Buffer.from(store.files['mib-session.json'].t, 'base64').toString(), 'xRT1');
  assert.ok(!store.writes.some(w => w.includes('tajnehaslo1')), 'hasło nie trafia na dysk');
});

test('signup rejects a bad nick before any request', async () => {
  const { p, supa } = mk();
  assert.deepEqual(await p.signup({ email: 'a@b.pl', password: 'tajnehaslo1', nick: 'Łukasz' }), { error: 'nick_chars' });
  assert.deepEqual(await p.signup({ email: 'a@b.pl', password: 'krotkie', nick: 'Gracz' }), { error: 'weak_password' });
  assert.equal(supa.calls.length, 0);
});

test('prof:state offline keeps the session', async () => {
  const store = memStore();
  store.files['mib-session.json'] = { t: Buffer.from('xRT9').toString('base64') };
  const { p } = mk({ store, supa: fakeSupa({ refresh: async () => { throw new SupaError(0, 'offline'); } }) });
  assert.deepEqual(await p.state(), { offline: true });
  assert.ok(store.files['mib-session.json'], 'sesja zostaje');
});

test('refresh 400 clears session', async () => {
  const store = memStore();
  store.files['mib-session.json'] = { t: Buffer.from('xRT9').toString('base64') };
  const { p } = mk({ store, supa: fakeSupa({ refresh: async () => { throw new SupaError(400, 'bad_login'); } }) });
  assert.deepEqual(await p.state(), { loggedIn: false });
  assert.equal(store.files['mib-session.json'], undefined);
});

test('restored session refreshes once and reuses the access token', async () => {
  const store = memStore();
  store.files['mib-session.json'] = { t: Buffer.from('xRT9').toString('base64') };
  const { p, supa } = mk({ store });
  await p.state();
  await p.state();
  assert.equal(supa.calls.filter(c => c[0] === 'refresh').length, 1);
  assert.equal(supa.calls.find(c => c[0] === 'refresh')[1], 'RT9');
});

test('stats queue flush once', async () => {
  let online = false;
  const supa = fakeSupa({ rpc: async n => { if (n === 'add_play_session' && !online) throw new SupaError(0, 'offline'); return null; } });
  const { p, store, tick } = mk({ supa });
  await p.login({ email: 'a@b.pl', password: 'tajnehaslo1' });
  p.gameStarted('1.8.9');
  tick(30 * 60000);
  await p.gameClosed();
  assert.equal(store.read('mib-stats-queue.json', []).length, 1);
  online = true;
  await Promise.all([p.state(), p.state()]);
  await p.state();
  const sent = supa.calls.filter(c => c[0] === 'rpc' && c[1] === 'add_play_session');
  assert.equal(sent.length, 2, 'jedna nieudana próba offline + dokładnie jedno wysłanie');
  assert.deepEqual(sent[1][2], { p_version: '1.8.9', p_minutes: 30 });
  assert.deepEqual(store.read('mib-stats-queue.json', []), []);
});

test('game sessions are not recorded without a profile', async () => {
  const { p, store, tick } = mk();
  p.gameStarted('1.20.1');
  tick(5 * 60000);
  await p.gameClosed();
  assert.deepEqual(store.read('mib-stats-queue.json', []), []);
});

test('without OS encryption nothing is written to disk', async () => {
  const { p, store } = mk({ safe: safe(false) });
  await p.login({ email: 'a@b.pl', password: 'tajnehaslo1' });
  assert.equal(store.files['mib-session.json'], undefined);
  assert.equal((await p.state()).loggedIn, true, 'zalogowany do końca działania launchera');
});

test('redeem normalizes the code and maps the result', async () => {
  const supa = fakeSupa({ rpc: async n => (n === 'redeem_code' ? { cosmetic_id: 'cape', name: 'Peleryna', type: 'cape', image_url: null } : null) });
  const { p } = mk({ supa });
  await p.login({ email: 'a@b.pl', password: 'tajnehaslo1' });
  assert.deepEqual(await p.redeem({ code: ' start ' }), { id: 'cape', name: 'Peleryna', type: 'cape', imageUrl: null });
  assert.deepEqual(supa.calls.find(c => c[1] === 'redeem_code')[2], { p_code: 'START' });
});

test('errors become {error} and never throw', async () => {
  const supa = fakeSupa({ rpc: async () => { throw new SupaError(400, 'code_used_up'); } });
  const { p } = mk({ supa });
  assert.equal((await p.redeem({ code: 'X' })).error, 'not_logged_in');
  await p.login({ email: 'a@b.pl', password: 'tajnehaslo1' });
  assert.equal((await p.redeem({ code: 'X' })).error, 'code_used_up');
});

test('reset with a wrong code reports reset_failed, a good one logs in with a new code', async () => {
  let ok = false;
  const supa = fakeSupa({ rpc: async n => (n === 'reset_password_with_code' ? ok : null) });
  const { p } = mk({ supa });
  assert.deepEqual(await p.reset({ email: 'a@b.pl', code: 'X', password: 'nowehaslo1' }), { error: 'reset_failed' });
  ok = true;
  const r = await p.reset({ email: 'a@b.pl', code: 'X', password: 'nowehaslo1' });
  assert.equal(r.loggedIn, true);
  assert.ok(r.recoveryCode);
});

test('settings sync sends only synced keys', async () => {
  const { p, supa } = mk();
  await p.login({ email: 'a@b.pl', password: 'tajnehaslo1' });
  await p.pushSettings({ settings: { ram: 4096, root: 'C:/gry', bg: 'custom' }, updatedAt: 42 });
  const u = supa.calls.find(c => c[0] === 'update');
  assert.equal(u[1], 'profiles');
  assert.equal(u[2], 'id=eq.U1');
  assert.deepEqual(u[3], { settings: { ram: 4096 }, settings_updated_at: 42 });
});

test('logout and delete clear the session file', async () => {
  const { p, store } = mk();
  await p.login({ email: 'a@b.pl', password: 'tajnehaslo1' });
  assert.ok(store.files['mib-session.json']);
  assert.deepEqual(await p.logout(), { loggedIn: false });
  assert.equal(store.files['mib-session.json'], undefined);
  await p.login({ email: 'a@b.pl', password: 'tajnehaslo1' });
  assert.deepEqual(await p.remove(), { loggedIn: false });
  assert.equal(store.files['mib-session.json'], undefined);
});

// ===== Kopia modów =====
function fakeMods(o = {}) {
  const dl = [];
  return {
    dl,
    root: () => o.root || '/gry',
    scan: () => o.files || [{ file: 'sodium.jar', on: true, sha1: 'h1' }, { file: 'own.jar', on: true, sha1: 'h2' }],
    identify: async () => ({ h1: { project_id: 'P1', id: 'V1' } }),
    loader: () => (o.loader === undefined ? 'fabric' : o.loader),
    setLoader: (gv, l) => { o.setTo = l; },
    exists: (gv, f) => (o.present || []).includes(f),
    download: async (gv, id, on) => { if ((o.fail || []).includes(id)) throw new Error('net'); dl.push([id, on]); return id + '.jar'; },
  };
}
const withBackup = (row, extra = {}) => fakeSupa({ select: async t => (t === 'profiles' ? [profileRow] : t === 'mod_backups' ? (row ? [row] : []) : []), ...extra });
const mkMods = (o = {}) => {
  const store = o.store || memStore(), supa = o.supa || withBackup(o.row), mods = o.mods || fakeMods();
  let t = 1_000_000;
  const p = createProfile({ supa, store, safeStorage: safe(), randomBytes: n => Buffer.alloc(n, 7), now: () => t, mods });
  return { p, store, supa, mods };
};
const remote = { game_version: '1.20.1', loader: 'fabric', skipped: 0, mods: [
  { project: 'P1', version: 'V1', file: 'sodium.jar', on: true },
  { project: 'P2', version: 'V2', file: 'lithium.jar', on: false },
  { project: 'P3', version: 'V3', file: 'iris.jar', on: true }] };

test('modsChanged holds an unreviewed remote backup, pushes after replace', async () => {
  const { p, supa } = mkMods({ row: remote });
  await p.login({ email: 'a@b.pl', password: 'tajnehaslo1' });
  await p.modsChanged('1.20.1');
  assert.equal(supa.calls.filter(c => c[0] === 'upsert').length, 0);
  assert.deepEqual(await p.modInfo({ gv: '1.20.1' }), { count: 3, skipped: 0, reviewed: false });
  assert.deepEqual(await p.modReplace({ gv: '1.20.1' }), { ok: true });
  const up = supa.calls.find(c => c[0] === 'upsert');
  assert.equal(up[1], 'mod_backups');
  assert.deepEqual(up[2].mods, [{ project: 'P1', version: 'V1', file: 'sodium.jar', on: true }]);
  assert.equal(up[2].skipped, 1, 'plik spoza Modrinth pominięty');
  assert.equal(up[2].loader, 'fabric');
  assert.equal(up[2].user_id, 'U1');
  await p.modsChanged('1.20.1');
  assert.equal(supa.calls.filter(c => c[0] === 'upsert').length, 2, 'po przejrzeniu zapisuje automatycznie');
});

test('modsChanged pushes when there is no remote backup', async () => {
  const { p, supa } = mkMods({ row: null });
  await p.login({ email: 'a@b.pl', password: 'tajnehaslo1' });
  await p.modsChanged('1.8.9');
  assert.equal(supa.calls.filter(c => c[0] === 'upsert').length, 1);
});

test('modsChanged does nothing without a profile', async () => {
  const { p, supa } = mkMods({ row: null });
  await p.modsChanged('1.8.9');
  assert.equal(supa.calls.length, 0);
});

test('restore keeps existing and reports failures', async () => {
  const mods = fakeMods({ present: ['sodium.jar'], fail: ['V3'], loader: null });
  const { p } = mkMods({ row: remote, mods });
  await p.login({ email: 'a@b.pl', password: 'tajnehaslo1' });
  assert.deepEqual(await p.modRestore({ gv: '1.20.1' }), { added: 1, skipped: 1, failed: 1 });
  assert.deepEqual(mods.dl, [['V2', false]], 'wyłączony mod pobrany jako wyłączony; istniejący nie ruszany');
  assert.deepEqual(await p.modInfo({ gv: '1.20.1' }), { count: 3, skipped: 0, reviewed: true });
});

test('restore refuses a different loader', async () => {
  const mods = fakeMods({ loader: 'forge' });
  const { p } = mkMods({ row: remote, mods });
  await p.login({ email: 'a@b.pl', password: 'tajnehaslo1' });
  assert.deepEqual(await p.modRestore({ gv: '1.20.1' }), { error: 'loader_mismatch' });
  assert.equal(mods.dl.length, 0);
});

test('restore sets the loader when the instance has none', async () => {
  const o = { loader: null };
  const mods = fakeMods(o);
  const { p } = mkMods({ row: remote, mods });
  await p.login({ email: 'a@b.pl', password: 'tajnehaslo1' });
  await p.modRestore({ gv: '1.20.1' });
  assert.equal(o.setTo, 'fabric');
});

// ===== Poprawki po recenzji =====
test('expired access token is refreshed and the call retried', async () => {
  let first = true;
  const supa = fakeSupa({ select: async t => { if (first) { first = false; throw new SupaError(401, 'auth_expired'); } return t === 'profiles' ? [profileRow] : []; } });
  const { p } = mk({ supa });
  await p.login({ email: 'a@b.pl', password: 'tajnehaslo1' }).catch(() => {});
  const st = await p.state();
  assert.equal(st.loggedIn, true);
  assert.ok(supa.calls.some(c => c[0] === 'refresh'), 'odświeżono token');
});

test('server errors in state are temporary, not a logout', async () => {
  const supa = fakeSupa({ select: async () => { throw new SupaError(503, 'server_error'); } });
  const { p, store } = mk({ supa });
  await p.login({ email: 'a@b.pl', password: 'tajnehaslo1' });
  assert.deepEqual(await p.state(), { offline: true, error: 'server_error' });
  assert.ok(store.files['mib-session.json'], 'sesja zostaje');
});

test('a session closing during a flush is not lost', async () => {
  let release;
  const gate = new Promise(r => { release = r; });
  const supa = fakeSupa({ rpc: async n => { if (n === 'add_play_session') await gate; return null; } });
  const { p, store, tick } = mk({ supa });
  await p.login({ email: 'a@b.pl', password: 'tajnehaslo1' });
  p.gameStarted('1.8.9'); tick(10 * 60000);
  const first = p.gameClosed();          // zaczyna wysyłać i czeka na serwer
  await new Promise(r => setImmediate(r));
  p.gameStarted('1.21.1'); tick(30 * 60000);
  const second = p.gameClosed();         // zamknięcie w trakcie wysyłania
  release();
  await Promise.all([first, second]);
  const sent = supa.calls.filter(c => c[0] === 'rpc' && c[1] === 'add_play_session').map(c => c[2].p_version);
  assert.deepEqual(sent.sort(), ['1.21.1', '1.8.9']);
  assert.deepEqual(store.read('mib-stats-queue.json', []), []);
});

test('queued sessions go only to the profile that played them', async () => {
  const store = memStore();
  store.files['mib-stats-queue.json'] = [{ id: 'x', u: 'OTHER', v: '1.8.9', min: 50 }];
  const { p, supa } = mk({ store });
  await p.login({ email: 'a@b.pl', password: 'tajnehaslo1' });
  assert.equal(supa.calls.filter(c => c[1] === 'add_play_session').length, 0);
  assert.equal(store.read('mib-stats-queue.json', []).length, 1, 'wpis innego profilu czeka na swój profil');
});

test('a restored session records stats offline under the stored profile id', async () => {
  const store = memStore();
  store.files['mib-session.json'] = { t: Buffer.from('xRT9').toString('base64'), u: 'U7' };
  const { p, tick } = mk({ store, supa: fakeSupa({ refresh: async () => { throw new SupaError(0, 'offline'); } }) });
  p.gameStarted('1.8.9'); tick(15 * 60000);
  await p.gameClosed();
  const q = store.read('mib-stats-queue.json', []);
  assert.equal(q.length, 1);
  assert.equal(q[0].u, 'U7');
  assert.equal(q[0].min, 15);
});

test('reviewed flag is per profile and game folder', async () => {
  const store = memStore();
  const a = mkMods({ row: remote, store });
  await a.p.login({ email: 'a@b.pl', password: 'tajnehaslo1' });
  await a.p.modReplace({ gv: '1.20.1' });
  assert.equal((await a.p.modInfo({ gv: '1.20.1' })).reviewed, true);
  // inny profil na tym samym komputerze
  const b = mkMods({ row: remote, store, supa: withBackup(remote, { signIn: async () => ({ ...sess(), userId: 'U2' }) }) });
  await b.p.login({ email: 'b@b.pl', password: 'tajnehaslo1' });
  assert.equal((await b.p.modInfo({ gv: '1.20.1' })).reviewed, false);
  await b.p.modsChanged('1.20.1');
  assert.equal(b.supa.calls.filter(c => c[0] === 'upsert').length, 0, 'cudza kopia nie nadpisana');
  // ten sam profil, inny katalog gry
  const c = mkMods({ row: remote, store, mods: fakeMods({ root: '/inny' }) });
  await c.p.login({ email: 'a@b.pl', password: 'tajnehaslo1' });
  assert.equal((await c.p.modInfo({ gv: '1.20.1' })).reviewed, false);
});

test('signup that needs e-mail confirmation is an error, not a silent logout', async () => {
  const supa = fakeSupa({ signUp: async () => { throw new SupaError(200, 'email_confirm_required'); } });
  const { p, store } = mk({ supa });
  assert.deepEqual(await p.signup({ email: 'a@b.pl', password: 'tajnehaslo1', nick: 'Gracz_1' }), { error: 'email_confirm_required', detail: 'email_confirm_required' });
  assert.equal(store.files['mib-session.json'], undefined);
});

test('an account without a profile asks for a nick and can finish the profile', async () => {
  let row = null;
  const supa = fakeSupa({ select: async t => (t === 'profiles' ? (row ? [row] : []) : []),
    rpc: async (n, a) => { if (n === 'create_my_profile') row = { ...profileRow, nick: a.p_nick }; return null; } });
  const { p } = mk({ supa });
  assert.deepEqual(await p.login({ email: 'a@b.pl', password: 'tajnehaslo1' }), { needsProfile: true });
  assert.equal((await p.createProfile({ nick: 'zły nick' })).error, 'nick_chars');
  const r = await p.createProfile({ nick: 'Nowy_1' });
  assert.equal(r.loggedIn, true);
  assert.equal(r.nick, 'Nowy_1');
  assert.ok(r.recoveryCode, 'nowy profil dostaje kod odzyskiwania');
});

test('signup finishes the profile itself when the database trigger did not', async () => {
  let row = null;
  const supa = fakeSupa({ select: async t => (t === 'profiles' ? (row ? [row] : []) : []),
    rpc: async (n, a) => { if (n === 'create_my_profile') row = { ...profileRow, nick: a.p_nick }; return null; } });
  const { p } = mk({ supa });
  const r = await p.signup({ email: 'a@b.pl', password: 'tajnehaslo1', nick: 'Gracz_9' });
  assert.equal(r.loggedIn, true);
  assert.equal(r.nick, 'Gracz_9');
});

// ===== Panel admina i ogłoszenia =====
test('state tells the UI whether the player is the admin', async () => {
  const supa = fakeSupa({ rpc: async n => (n === 'is_admin' ? true : null) });
  const { p } = mk({ supa });
  assert.equal((await p.login({ email: 'a@b.pl', password: 'tajnehaslo1' })).admin, true);
  const { p: p2 } = mk();
  assert.equal((await p2.login({ email: 'a@b.pl', password: 'tajnehaslo1' })).admin, false);
});

test('announcements are public and do not need a profile', async () => {
  const rows = [{ id: 1, title: 'Turniej', body: 'Sobota', pinned: true, created_at: '2026-10-15' }];
  const supa = fakeSupa({ select: async t => (t === 'announcements' ? rows : []) });
  const { p } = mk({ supa });
  assert.deepEqual(await p.announcements(), rows);
  const call = supa.calls.find(c => c[1] === 'announcements');
  assert.equal(call[3], undefined, 'bez tokenu gracza');
  assert.match(call[2], /order=pinned\.desc,created_at\.desc/);
});

test('admin calls are limited to admin functions', async () => {
  const supa = fakeSupa({ rpc: async (n, a) => ({ called: n, a }) });
  const { p } = mk({ supa });
  await p.login({ email: 'a@b.pl', password: 'tajnehaslo1' });
  assert.deepEqual(await p.admin({ fn: 'admin_stats', args: {} }), { called: 'admin_stats', a: {} });
  assert.equal((await p.admin({ fn: 'delete_my_profile', args: {} })).error, 'not_admin_fn');
  assert.ok(!supa.calls.some(c => c[1] === 'delete_my_profile'));
});

test('owned cosmetics use the admin texture as the image', async () => {
  const supa = fakeSupa({ select: async t => (t === 'profiles' ? [profileRow] : t === 'owned_cosmetics'
    ? [{ source: 'code', acquired_at: 'x', cosmetics: { id: 'c', name: 'C', type: 'cape', image_url: null, texture: 'data:image/png;base64,AA' } }] : []) });
  const { p } = mk({ supa });
  await p.login({ email: 'a@b.pl', password: 'tajnehaslo1' });
  assert.equal((await p.cosmetics())[0].imageUrl, 'data:image/png;base64,AA');
});

test('cosmetics marks the equipped item and keeps its texture', async () => {
  const supa = fakeSupa({ select: async t => (t === 'profiles' ? [{ ...profileRow, equipped: { cape: 'c2' } }] : t === 'owned_cosmetics'
    ? [{ cosmetics: { id: 'c1', name: 'A', type: 'cape', texture: 'data:image/png;base64,AA' } }, { cosmetics: { id: 'c2', name: 'B', type: 'cape', image_url: 'https://x/b.png' } }] : []) });
  const { p } = mk({ supa });
  await p.login({ email: 'a@b.pl', password: 'tajnehaslo1' });
  const c = await p.cosmetics();
  assert.deepEqual(c.map(x => [x.id, x.equipped, x.texture]), [['c1', false, 'data:image/png;base64,AA'], ['c2', true, null]]);
});

test('equip sends the type and id (null takes it off)', async () => {
  const supa = fakeSupa({ rpc: async (n, a) => (n === 'equip_cosmetic' ? (a.p_id ? { [a.p_type]: a.p_id } : {}) : null) });
  const { p } = mk({ supa });
  await p.login({ email: 'a@b.pl', password: 'tajnehaslo1' });
  assert.deepEqual(await p.equip({ type: 'cape', id: 'c1' }), { ok: true, equipped: { cape: 'c1' } });
  assert.deepEqual(await p.equip({ type: 'cape', id: null }), { ok: true, equipped: {} });
  assert.deepEqual(supa.calls.filter(c => c[1] === 'equip_cosmetic').map(c => c[2]), [{ p_type: 'cape', p_id: 'c1' }, { p_type: 'cape', p_id: null }]);
});

// ===== Pomysły graczy =====
test('submitIdea checks the idea before sending and trims it', async () => {
  const supa = fakeSupa({ rpc: async n => (n === 'submit_idea' ? 5 : null) });
  const { p } = mk({ supa });
  await p.login({ email: 'a@b.pl', password: 'tajnehaslo1' });
  assert.equal((await p.submitIdea({ category: 'feature', body: 'za mało' })).error, 'idea_short');
  assert.ok(!supa.calls.some(c => c[1] === 'submit_idea'), 'zły pomysł nie trafia na serwer');
  assert.deepEqual(await p.submitIdea({ category: 'cosmetic', body: '  Peleryna z ogniem dla zwycięzców  ' }), { ok: true, id: 5 });
  const call = supa.calls.find(c => c[1] === 'submit_idea');
  assert.deepEqual(call[2], { p_category: 'cosmetic', p_body: 'Peleryna z ogniem dla zwycięzców' });
  assert.equal(call[3], 'AT1', 'z tokenem gracza');
});

test('ideas need a profile', async () => {
  const { p, supa } = mk();
  assert.equal((await p.submitIdea({ category: 'other', body: 'Jakiś dłuższy pomysł' })).error, 'not_logged_in');
  assert.equal((await p.myIdeas()).error, 'not_logged_in');
  assert.ok(!supa.calls.some(c => c[1] === 'submit_idea' || c[1] === 'ideas'));
});

test('myIdeas lists the player own ideas, newest first', async () => {
  const rows = [{ id: 2, category: 'bug', body: 'Błąd przy starcie gry', status: 'new', created_at: '2026-10-16' }];
  const supa = fakeSupa({ select: async t => (t === 'profiles' ? [profileRow] : t === 'ideas' ? rows : []) });
  const { p } = mk({ supa });
  await p.login({ email: 'a@b.pl', password: 'tajnehaslo1' });
  assert.deepEqual(await p.myIdeas(), rows);
  assert.match(supa.calls.find(c => c[1] === 'ideas')[2], /order=created_at\.desc/);
});

test('allCosmetics lite skips textures', async () => {
  const { p, supa } = mk();
  await p.allCosmetics({ lite: true });
  await p.allCosmetics({});
  const q = supa.calls.filter(c => c[1] === 'cosmetics').map(c => c[2]);
  assert.ok(!q[0].includes('texture') && q[1].includes('texture'));
});

test('gracze MiB: zgłoszenie z profilem łączy konto, bez profilu anonimowo; tekstury peleryn tylko o bezpiecznych id', async () => {
  const { p, supa } = mk();
  await p.mibHello({ name: 'Gracz', serverId: 'ab' });
  assert.deepEqual(supa.calls.at(-1), ['rpc', 'mib_hello', { p_name: 'Gracz', p_server_id: 'ab' }, undefined]);
  await p.login({ email: 'a@b.pl', password: 'tajnehaslo1' });
  await p.mibHello({ name: 'Gracz', serverId: 'cd' });
  assert.equal(supa.calls.at(-1)[3], 'AT1');
  await p.capeTextures({ ids: ['cape_a', '../x', 'cape_b'] });
  assert.deepEqual(supa.calls.at(-1), ['select', 'cosmetics', 'select=id,texture&id=in.(cape_a,cape_b)']);
  assert.deepEqual(await p.capeTextures({ ids: ['ZŁE'] }), []);
  await p.mibWho({ ids: ['u'], names: null });
  assert.deepEqual(supa.calls.at(-1), ['rpc', 'mib_who', { p_ids: ['u'], p_names: [] }]);
});

test('stara baza (bez schema.sql z 0.20.0): profil, aktualności i obecność działają bez nowych kolumn', async () => {
  const supa = fakeSupa({
    select: async (t, q) => {
      if (/warnings|popup/.test(q)) throw new SupaError(400, 'schema_outdated', 'column does not exist');
      return t === 'profiles' ? [profileRow] : t === 'announcements' ? [{ id: 1, title: 'Hej' }] : [];
    },
    rpc: async (n, a) => { if (n === 'presence_ping' && 'p_hidden' in a) throw new SupaError(404, 'schema_outdated'); return null; },
  });
  const { p } = mk({ supa });
  await p.login({ email: 'a@b.pl', password: 'tajnehaslo1' });
  const st = await p.state();
  assert.equal(st.loggedIn, true);
  assert.deepEqual([st.warnings, st.banned], [0, false]);
  assert.deepEqual(await p.announcements(), [{ id: 1, title: 'Hej' }]);
  assert.deepEqual(await p.presence(), { ok: true });
  assert.ok(supa.calls.some(c => c[0] === 'rpc' && c[1] === 'presence_ping' && !('p_hidden' in c[2])), 'obecność bez trybu niewidocznego');
});

test('wallet: MiB Coins gracza i link do sklepu; sklep otwiera się z numerem MiB, tylko link https z bazy', async () => {
  const opened = [];
  let cfg = [{ value: 'https://sklep.mib.pl/coins?x=1' }];
  const supa = fakeSupa({ select: async (t, q) => (t === 'app_config' ? cfg : t === 'profiles' ? [q.includes('coins') ? { coins: 1250 } : profileRow] : []) });
  const store = memStore();
  const p = createProfile({ supa, store, safeStorage: safe(), randomBytes: n => Buffer.alloc(n, 7), now: () => 1_000_000, openExternal: async u => { opened.push(u); } });
  assert.deepEqual(await p.wallet(), { loggedIn: false, coins: null, shopUrl: 'https://sklep.mib.pl/coins?x=1' });
  await p.login({ email: 'a@b.pl', password: 'tajnehaslo1' });
  assert.deepEqual(await p.wallet(), { loggedIn: true, coins: 1250, shopUrl: 'https://sklep.mib.pl/coins?x=1' });
  assert.deepEqual(await p.shopOpen(), { ok: true });
  assert.deepEqual(opened, ['https://sklep.mib.pl/coins?x=1&mib=MIB-000007']);
  // link spoza https (np. zmieniony ręcznie w bazie) nie otwiera się
  cfg = [{ value: 'file:///C:/Windows/system32/calc.exe' }];
  assert.deepEqual(await p.shopOpen(), { error: 'shop_missing' });
  assert.equal((await p.wallet()).shopUrl, null);
  assert.equal(opened.length, 1);
});

test('wallet: stara baza bez coinsów i sklepu nie psuje Kosmetyk', async () => {
  const old = new SupaError(404, 'schema_outdated', 'x');
  const supa = fakeSupa({ select: async (t, q) => { if (t === 'app_config' || q.includes('coins')) throw old; return t === 'profiles' ? [profileRow] : []; } });
  const p = createProfile({ supa, store: memStore(), safeStorage: safe(), randomBytes: n => Buffer.alloc(n, 7), now: () => 1_000_000 });
  await p.login({ email: 'a@b.pl', password: 'tajnehaslo1' });
  assert.deepEqual(await p.wallet(), { loggedIn: true, coins: null, shopUrl: null });
  assert.deepEqual(await p.shopOpen(), { error: 'shop_missing' });
});

test('sklep: zakup dla siebie i dla znajomego (wiadomość tylko przy prezencie), oferta, historia, nagroda dzienna', async () => {
  const { p, supa } = mk();
  await p.login({ email: 'a@b.pl', password: 'tajnehaslo1' });
  await p.buy({ id: 'halloween_hat_pumpkin', message: 'nie trafi do bazy' });
  await p.buy({ id: 'halloween_aura_souls', to: 'U2', message: '  Dla Ciebie!  ' });
  await p.buyOffer({ id: 3 });
  await p.coinLog({ before: 40 });
  await p.daily();
  const rpc = supa.calls.filter(c => c[0] === 'rpc').map(c => [c[1], c[2]]);
  assert.deepEqual(rpc.slice(-5), [
    ['buy_cosmetic', { p_cosmetic: 'halloween_hat_pumpkin', p_for: null, p_message: null }],
    ['buy_cosmetic', { p_cosmetic: 'halloween_aura_souls', p_for: 'U2', p_message: 'Dla Ciebie!' }],
    ['buy_offer', { p_offer: 3 }], ['my_coin_log', { p_before: 40 }], ['claim_daily', {}]]);
  const n = supa.calls.length;
  assert.deepEqual(await p.buy({ id: 'x', to: 'U2', message: 'a'.repeat(201) }), { error: 'gift_message_long' });
  assert.equal(supa.calls.length, n, 'za długa wiadomość nie idzie do bazy');
});

test('sklep: błąd bazy wraca jako kod, a nagroda dzienna na starej bazie to nic', async () => {
  const supa = fakeSupa({ rpc: async fn => { if (fn === 'claim_daily') throw new SupaError(404, 'schema_outdated', 'x'); throw new SupaError(400, 'coins_not_enough', 'coins_not_enough'); } });
  const { p } = mk({ supa });
  await p.login({ email: 'a@b.pl', password: 'tajnehaslo1' });
  assert.equal((await p.buy({ id: 'halloween_hat_pumpkin' })).error, 'coins_not_enough');
  assert.deepEqual(await p.daily(), { claimed: false });
});
