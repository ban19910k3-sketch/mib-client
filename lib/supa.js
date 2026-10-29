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
  // Supabase z włączonym „Confirm email” — launcher tego nie obsługuje (patrz supabase/README.md)
  email_not_confirmed: 'email_confirm_required', signup_disabled: 'signup_disabled',
};

function toError(status, body, kind) {
  const b = body || {};
  if (status === 429) return new SupaError(status, 'rate_limited');
  // funkcja Supabase (mc-login): własny kod błędu; 404 = funkcji nie wgrano, 401 = włączone sprawdzanie JWT
  if (kind === 'fn') {
    if (typeof b.error === 'string') return new SupaError(status, b.error, b.detail);
    if (status === 404) return new SupaError(status, 'mc_login_missing');
    if (status === 401) return new SupaError(status, 'mc_login_jwt', b.msg || b.message);
  }
  if (kind === 'auth') {
    const raw = b.error_code || b.error;
    if (AUTH_CODES[raw]) return new SupaError(status, AUTH_CODES[raw], b.msg || b.error_description);
    // Wyjątek z triggera bazy (zły lub zajęty nick) GoTrue zgłasza jako ogólny błąd zapisu użytkownika
    if (/Database error saving new user/i.test(b.msg || b.message || '')) return new SupaError(status, 'nick_rejected');
  } else {
    if (b.code === 'PGRST301' || /JWT expired/i.test(b.message || '')) return new SupaError(status, 'auth_expired');
    if (b.code === 'P0001' && b.message) return new SupaError(status, b.message);
    // Brak tabeli, kolumny lub funkcji: w Supabase nie uruchomiono najnowszego schema.sql
    if (['PGRST202', 'PGRST205', '42P01', '42883', '42703'].includes(b.code)) return new SupaError(status, 'schema_outdated', b.message);
  }
  if (status >= 500) return new SupaError(status, 'server_error', b.msg || b.message);
  return new SupaError(status, 'request_failed', b.msg || b.message || b.error_description);
}

function createSupa({ url, key, fetch, timeoutMs = 10000 }) {
  async function call(path, { method = 'GET', body, token, prefer, kind = 'rest' } = {}) {
    const headers = { apikey: key, 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    if (prefer) headers.Prefer = prefer;
    let res;
    try {
      // Serwer, który nie odpowiada, traktujemy jak brak sieci — launcher nie może czekać minutami
      res = await fetch(url + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
    } catch (e) {
      throw new SupaError(0, 'offline', e.message);
    }
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    if (!res.ok) throw toError(res.status, data, kind);
    return data;
  }
  const session = d => {
    // Bez tokenów konto czeka na potwierdzenie e-maila: nie udajemy, że gracz jest zalogowany
    if (!d || !d.access_token || !d.refresh_token) throw new SupaError(200, 'email_confirm_required');
    return {
    accessToken: d.access_token,
    refreshToken: d.refresh_token,
    // Liczone od lokalnego zegara: zegar komputera gracza może się różnić od serwera
    expiresAt: Date.now() + (d.expires_in || 3600) * 1000,
    userId: d.user && d.user.id,
    };
  };
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
    // scope=local: wyloguj tylko ten komputer, nie wszystkie
    signOut: token => call('/auth/v1/logout?scope=local', { method: 'POST', kind: 'auth', token }),
    // Logowanie kontem Minecraft (od 0.26.0): funkcja mc-login sprawdza konto u Mojanga i zwraca sesję (created: nowy profil)
    async mcLogin(name, serverId) {
      const d = await call('/functions/v1/mc-login', { method: 'POST', kind: 'fn', body: { name, serverId } });
      return { ...session(d), created: !!(d && d.created) };
    },
    rpc: (name, args, token) => call('/rest/v1/rpc/' + name, { method: 'POST', body: args || {}, token }),
    select: (table, query, token) => call('/rest/v1/' + table + '?' + query, { token }),
    update: (table, filter, patch, token) => call('/rest/v1/' + table + '?' + filter, { method: 'PATCH', body: patch, token, prefer: 'return=minimal' }),
    upsert: (table, row, token) => call('/rest/v1/' + table, { method: 'POST', body: row, token, prefer: 'resolution=merge-duplicates,return=minimal' }),
  };
}

module.exports = { createSupa, SupaError };
