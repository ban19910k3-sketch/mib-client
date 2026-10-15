// Cienki klient REST do Supabase (Auth + PostgREST) na samym fetch.
// Oficjalna biblioteka wymaga Node 22, a Electron 31 ma Node 20.

class SupaError extends Error {
  constructor(status, code, message) { super(message || code); this.status = status; this.code = code; }
}

const AUTH_CODES = {
  user_already_exists: 'email_taken', email_exists: 'email_taken',
  weak_password: 'weak_password',
  invalid_credentials: 'bad_login', invalid_grant: 'bad_login',
  refresh_token_not_found: 'bad_login', refresh_token_already_used: 'bad_login', session_not_found: 'bad_login',
  email_address_invalid: 'bad_email', validation_failed: 'bad_email',
  over_request_rate_limit: 'rate_limited', over_email_send_rate_limit: 'rate_limited',
};

function toError(status, body, kind) {
  const b = body || {};
  if (status === 429) return new SupaError(status, 'rate_limited');
  if (kind === 'auth') {
    const raw = b.error_code || b.error;
    if (AUTH_CODES[raw]) return new SupaError(status, AUTH_CODES[raw], b.msg || b.error_description);
    // Wyjątek z triggera bazy (zły lub zajęty nick) GoTrue zgłasza jako ogólny błąd zapisu użytkownika
    if (/Database error saving new user/i.test(b.msg || b.message || '')) return new SupaError(status, 'nick_rejected');
  } else {
    if (b.code === 'PGRST301' || /JWT expired/i.test(b.message || '')) return new SupaError(status, 'auth_expired');
    if (b.code === 'P0001' && b.message) return new SupaError(status, b.message);
  }
  if (status >= 500) return new SupaError(status, 'server_error', b.msg || b.message);
  return new SupaError(status, 'request_failed', b.msg || b.message || b.error_description);
}

function createSupa({ url, key, fetch }) {
  async function call(path, { method = 'GET', body, token, prefer, kind = 'rest' } = {}) {
    const headers = { apikey: key, 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    if (prefer) headers.Prefer = prefer;
    let res;
    try {
      res = await fetch(url + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch (e) {
      throw new SupaError(0, 'offline', e.message);
    }
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    if (!res.ok) throw toError(res.status, data, kind);
    return data;
  }
  const session = d => ({
    accessToken: d.access_token,
    refreshToken: d.refresh_token,
    expiresAt: d.expires_at ? d.expires_at * 1000 : Date.now() + (d.expires_in || 3600) * 1000,
    userId: d.user && d.user.id,
  });
  return {
    signUp: async (email, password, nick) => session(await call('/auth/v1/signup', { method: 'POST', kind: 'auth', body: { email, password, data: { nick } } })),
    signIn: async (email, password) => session(await call('/auth/v1/token?grant_type=password', { method: 'POST', kind: 'auth', body: { email, password } })),
    async refresh(refreshToken) {
      try {
        return session(await call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', kind: 'auth', body: { refresh_token: refreshToken } }));
      } catch (e) {
        // Każde 4xx przy odświeżaniu znaczy, że sesja jest nieważna (wylogowana, hasło zmienione)
        if (e.status >= 400 && e.status < 500 && e.code !== 'rate_limited') throw new SupaError(e.status, 'bad_login', e.message);
        throw e;
      }
    },
    signOut: token => call('/auth/v1/logout', { method: 'POST', kind: 'auth', token }),
    rpc: (name, args, token) => call('/rest/v1/rpc/' + name, { method: 'POST', body: args || {}, token }),
    select: (table, query, token) => call('/rest/v1/' + table + '?' + query, { token }),
    update: (table, filter, patch, token) => call('/rest/v1/' + table + '?' + filter, { method: 'PATCH', body: patch, token, prefer: 'return=minimal' }),
    upsert: (table, row, token) => call('/rest/v1/' + table, { method: 'POST', body: row, token, prefer: 'resolution=merge-duplicates,return=minimal' }),
  };
}

module.exports = { createSupa, SupaError };
