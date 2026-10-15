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
  assert.deepEqual(await p.redeem({ code: 'X' }), { error: 'not_logged_in' });
  await p.login({ email: 'a@b.pl', password: 'tajnehaslo1' });
  assert.deepEqual(await p.redeem({ code: 'X' }), { error: 'code_used_up' });
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
