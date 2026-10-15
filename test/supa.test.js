const test = require('node:test');
const assert = require('node:assert/strict');
const { createSupa } = require('../lib/supa');

// Atrapa fetch: zapisuje żądania, odpowiada kolejno zaprogramowanymi odpowiedziami
function fakeFetch(...responses) {
  const calls = [];
  const f = async (url, opts = {}) => {
    calls.push({ url, method: opts.method || 'GET', headers: opts.headers || {}, body: opts.body ? JSON.parse(opts.body) : undefined });
    const r = responses.shift();
    if (r instanceof Error) throw r;
    return { ok: r.status < 300, status: r.status, text: async () => (r.body === undefined ? '' : JSON.stringify(r.body)) };
  };
  f.calls = calls;
  return f;
}
const session = { access_token: 'AT', refresh_token: 'RT', expires_in: 3600, expires_at: 2000000000, user: { id: 'U1' } };
const mk = (...r) => { const fetch = fakeFetch(...r); return { s: createSupa({ url: 'https://x.supabase.co', key: 'PK', fetch }), fetch }; };

test('signUp sends nick as user data and maps the session', async () => {
  const { s, fetch } = mk({ status: 200, body: session });
  const r = await s.signUp('a@b.pl', 'haslo123', 'Gracz_1');
  assert.equal(r.accessToken, 'AT'); assert.equal(r.refreshToken, 'RT'); assert.equal(r.userId, 'U1');
  assert.ok(Math.abs(r.expiresAt - (Date.now() + 3600_000)) < 5000, 'ważność liczona od lokalnego zegara');
  const c = fetch.calls[0];
  assert.equal(c.url, 'https://x.supabase.co/auth/v1/signup');
  assert.equal(c.method, 'POST');
  assert.equal(c.headers.apikey, 'PK');
  assert.deepEqual(c.body, { email: 'a@b.pl', password: 'haslo123', data: { nick: 'Gracz_1' } });
});

test('signIn, refresh and signOut use the right endpoints', async () => {
  const { s, fetch } = mk({ status: 200, body: session }, { status: 200, body: session }, { status: 204 });
  await s.signIn('a@b.pl', 'haslo123');
  await s.refresh('RT');
  await s.signOut('AT');
  assert.equal(fetch.calls[0].url, 'https://x.supabase.co/auth/v1/token?grant_type=password');
  assert.deepEqual(fetch.calls[0].body, { email: 'a@b.pl', password: 'haslo123' });
  assert.equal(fetch.calls[1].url, 'https://x.supabase.co/auth/v1/token?grant_type=refresh_token');
  assert.deepEqual(fetch.calls[1].body, { refresh_token: 'RT' });
  assert.equal(fetch.calls[2].url, 'https://x.supabase.co/auth/v1/logout?scope=local');
  assert.equal(fetch.calls[2].headers.Authorization, 'Bearer AT');
});

test('rpc, select, update and upsert', async () => {
  const { s, fetch } = mk({ status: 200, body: { name: 'X' } }, { status: 200, body: [{ id: 1 }] }, { status: 204 }, { status: 201 });
  assert.deepEqual(await s.rpc('redeem_code', { p_code: 'A' }, 'AT'), { name: 'X' });
  assert.deepEqual(await s.select('profiles', 'select=*&id=eq.U1', 'AT'), [{ id: 1 }]);
  await s.update('profiles', 'id=eq.U1', { settings: {} }, 'AT');
  await s.upsert('mod_backups', { game_version: '1.8.9' }, 'AT');
  assert.equal(fetch.calls[0].url, 'https://x.supabase.co/rest/v1/rpc/redeem_code');
  assert.equal(fetch.calls[0].headers.Authorization, 'Bearer AT');
  assert.equal(fetch.calls[1].url, 'https://x.supabase.co/rest/v1/profiles?select=*&id=eq.U1');
  assert.equal(fetch.calls[2].method, 'PATCH');
  assert.equal(fetch.calls[2].url, 'https://x.supabase.co/rest/v1/profiles?id=eq.U1');
  assert.equal(fetch.calls[3].method, 'POST');
  assert.match(fetch.calls[3].headers.Prefer, /resolution=merge-duplicates/);
});

test('rpc without token sends only the publishable key', async () => {
  const { s, fetch } = mk({ status: 200, body: true });
  assert.equal(await s.rpc('nick_available', { p_nick: 'a' }), true);
  assert.equal(fetch.calls[0].headers.Authorization, undefined);
});

const code = async (p) => { try { await p; } catch (e) { return e.code; } return 'no error'; };

test('error codes are normalized', async () => {
  assert.equal(await code(mk({ status: 422, body: { error_code: 'user_already_exists' } }).s.signUp('a', 'b', 'c')), 'email_taken');
  assert.equal(await code(mk({ status: 422, body: { error_code: 'email_exists' } }).s.signUp('a', 'b', 'c')), 'email_taken');
  assert.equal(await code(mk({ status: 422, body: { error_code: 'weak_password' } }).s.signUp('a', 'b', 'c')), 'weak_password');
  assert.equal(await code(mk({ status: 500, body: { msg: 'Database error saving new user' } }).s.signUp('a', 'b', 'c')), 'nick_rejected');
  assert.equal(await code(mk({ status: 400, body: { error_code: 'invalid_credentials' } }).s.signIn('a', 'b')), 'bad_login');
  assert.equal(await code(mk({ status: 400, body: { error: 'invalid_grant' } }).s.signIn('a', 'b')), 'bad_login');
  assert.equal(await code(mk({ status: 400, body: { error_code: 'refresh_token_not_found' } }).s.refresh('RT')), 'bad_login');
  assert.equal(await code(mk({ status: 400, body: { error_code: 'email_address_invalid' } }).s.signUp('a', 'b', 'c')), 'bad_email');
  assert.equal(await code(mk({ status: 429, body: { error_code: 'over_request_rate_limit' } }).s.signIn('a', 'b')), 'rate_limited');
  assert.equal(await code(mk({ status: 400, body: { code: 'P0001', message: 'code_used_up' } }).s.rpc('redeem_code', {}, 'AT')), 'code_used_up');
  assert.equal(await code(mk({ status: 401, body: { code: 'PGRST301', message: 'JWT expired' } }).s.rpc('x', {}, 'AT')), 'auth_expired');
  assert.equal(await code(mk(new TypeError('fetch failed')).s.signIn('a', 'b')), 'offline');
  assert.equal(await code(mk({ status: 503, body: {} }).s.signIn('a', 'b')), 'server_error');
});

test('a server that does not answer counts as offline', async () => {
  const hang = (url, opts) => new Promise((_, rej) => opts.signal.addEventListener('abort', () => rej(opts.signal.reason)));
  const s = createSupa({ url: 'https://x.supabase.co', key: 'PK', fetch: hang, timeoutMs: 50 });
  const t0 = Date.now(), keepAlive = setTimeout(() => {}, 5000); // timer AbortSignal.timeout nie trzyma pętli zdarzeń
  assert.equal(await code(s.signIn('a', 'b')), 'offline');
  clearTimeout(keepAlive);
  assert.ok(Date.now() - t0 < 2000);
});
