// Atrapa Supabase (Auth + PostgREST) w pamięci — do testów interfejsu bez prawdziwej bazy.
// Uruchomienie: node test/fake-supabase.js 54321
const http = require('http');
const crypto = require('crypto');

function createFake() {
  const st = { users: [], sessions: {}, refresh: {}, owned: [], backups: [], codes: { START: { cosmetic: 'cape_start', max: 100, used: 0 } }, redemptions: [], recovery: {}, num: 0, calls: [] };
  const cosmetics = { cape_start: { id: 'cape_start', name: 'Peleryna Start', type: 'cape', image_url: null } };
  const json = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(body === undefined ? '' : JSON.stringify(body)); };
  const newSession = u => {
    const at = crypto.randomUUID(), rt = crypto.randomUUID();
    st.sessions[at] = u.id; st.refresh[rt] = u.id;
    return { access_token: at, refresh_token: rt, expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: u.id, email: u.email } };
  };
  const norm = c => String(c || '').toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  const profileRow = u => ({ id: u.id, nick: u.nick, num: u.num, founder: u.num <= 1000, created_at: u.created, settings: u.settings || null, settings_updated_at: u.settingsAt || null, playtime_min: u.playtime || 0, launches: u.launches || 0, version_stats: u.vs || {} });

  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', c => { raw += c; });
    req.on('end', () => {
      const url = new URL(req.url, 'http://x'), body = raw ? JSON.parse(raw) : {};
      const tok = (req.headers.authorization || '').replace('Bearer ', ''), uid = st.sessions[tok], user = st.users.find(u => u.id === uid);
      st.calls.push({ method: req.method, path: url.pathname, body });
      const p = url.pathname;
      if (p === '/auth/v1/signup' && st.confirm) return json(res, 200, { id: crypto.randomUUID(), email: body.email, confirmation_sent_at: new Date().toISOString() });
      if (p === '/auth/v1/token' && st.confirm && url.searchParams.get('grant_type') === 'password') return json(res, 400, { error_code: 'email_not_confirmed', msg: 'Email not confirmed' });
      if (p === '/auth/v1/signup') {
        const nick = body.data && body.data.nick;
        if (!/^[A-Za-z0-9_]{3,16}$/.test(nick || '') || st.users.some(u => u.nick.toLowerCase() === nick.toLowerCase())) return json(res, 500, { msg: 'Database error saving new user' });
        if (st.users.some(u => u.email === body.email.toLowerCase())) return json(res, 422, { error_code: 'user_already_exists' });
        const u = { id: crypto.randomUUID(), email: body.email.toLowerCase(), password: body.password, nick, num: ++st.num, created: new Date().toISOString() };
        st.users.push(u);
        return json(res, 200, newSession(u));
      }
      if (p === '/auth/v1/token') {
        if (url.searchParams.get('grant_type') === 'password') {
          const u = st.users.find(x => x.email === String(body.email).toLowerCase() && x.password === body.password);
          return u ? json(res, 200, newSession(u)) : json(res, 400, { error_code: 'invalid_credentials' });
        }
        const id = st.refresh[body.refresh_token], u = st.users.find(x => x.id === id);
        delete st.refresh[body.refresh_token];
        return u ? json(res, 200, newSession(u)) : json(res, 400, { error_code: 'refresh_token_not_found' });
      }
      if (p === '/auth/v1/logout') { delete st.sessions[tok]; return json(res, 204); }
      if (p.startsWith('/rest/v1/rpc/')) {
        const fn = p.slice(13);
        if (fn === 'nick_available') return json(res, 200, !st.users.some(u => u.nick.toLowerCase() === String(body.p_nick).toLowerCase()));
        if (fn === 'reset_password_with_code') {
          const u = st.users.find(x => x.email === String(body.p_email).trim().toLowerCase());
          if (!u || st.recovery[u.id] !== norm(body.p_code)) return json(res, 200, false);
          u.password = body.p_new_password; delete st.recovery[u.id];
          return json(res, 200, true);
        }
        if (!user) return json(res, 401, { code: '42501', message: 'permission denied' });
        if (fn === 'set_recovery_code') { st.recovery[user.id] = norm(body.p_code); return json(res, 204); }
        if (fn === 'add_play_session') {
          const m = Math.min(1440, Math.max(0, body.p_minutes)); user.playtime = (user.playtime || 0) + m; user.launches = (user.launches || 0) + 1;
          user.vs = user.vs || {}; const v = user.vs[body.p_version] || { min: 0, runs: 0 }; user.vs[body.p_version] = { min: v.min + m, runs: v.runs + 1 };
          return json(res, 204);
        }
        if (fn === 'redeem_code') {
          const code = st.codes[String(body.p_code).trim().toUpperCase()];
          const err = m => json(res, 400, { code: 'P0001', message: m });
          if (!code) return err('code_invalid');
          if (st.redemptions.some(r => r.code === body.p_code && r.user === user.id)) return err('code_already_used');
          if (st.owned.some(o => o.user === user.id && o.cosmetic === code.cosmetic)) return err('already_owned');
          st.redemptions.push({ code: body.p_code, user: user.id });
          st.owned.push({ user: user.id, cosmetic: code.cosmetic, at: new Date().toISOString() });
          const c = cosmetics[code.cosmetic];
          return json(res, 200, { cosmetic_id: c.id, name: c.name, type: c.type, image_url: c.image_url });
        }
        if (fn === 'delete_my_profile') { st.users = st.users.filter(u => u.id !== user.id); return json(res, 204); }
        return json(res, 404, { message: 'no function ' + fn });
      }
      if (!user) return json(res, 401, { code: '42501', message: 'permission denied' });
      if (p === '/rest/v1/profiles') {
        if (req.method === 'PATCH') { user.settings = body.settings; user.settingsAt = body.settings_updated_at; return json(res, 204); }
        return json(res, 200, [profileRow(user)]);
      }
      if (p === '/rest/v1/owned_cosmetics') return json(res, 200, st.owned.filter(o => o.user === user.id).map(o => ({ source: 'code', acquired_at: o.at, cosmetics: cosmetics[o.cosmetic] })));
      if (p === '/rest/v1/mod_backups') {
        if (req.method === 'POST') { st.backups = st.backups.filter(b => !(b.user === user.id && b.game_version === body.game_version)); st.backups.push({ ...body, user: user.id }); return json(res, 201); }
        const gv = decodeURIComponent((url.searchParams.get('game_version') || '').replace(/^eq\./, ''));
        return json(res, 200, st.backups.filter(b => b.user === user.id && b.game_version === gv));
      }
      return json(res, 404, { message: 'not found ' + p });
    });
  });
  return { server, st };
}

if (require.main === module) {
  const port = +process.argv[2] || 54321;
  createFake().server.listen(port, () => console.log('fake supabase on http://127.0.0.1:' + port));
}
module.exports = { createFake };
