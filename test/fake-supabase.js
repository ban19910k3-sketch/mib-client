// Atrapa Supabase (Auth + PostgREST) w pamięci — do testów interfejsu bez prawdziwej bazy.
// Uruchomienie: node test/fake-supabase.js 54321
const http = require('http');
const crypto = require('crypto');

function createFake() {
  const st = { friends: [], presence: {}, ann: [], annId: 0, ideas: [], ideaId: 0, users: [], sessions: {}, refresh: {}, owned: [], backups: [], codes: { START: { cosmetic: 'cape_start', max: 100, used: 0 } }, redemptions: [], recovery: {}, num: 0, calls: [] };
  const cosmetics = { cape_start: { id: 'cape_start', name: 'Peleryna Start', type: 'cape', image_url: null } };
  const json = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(body === undefined ? '' : JSON.stringify(body)); };
  const newSession = u => {
    const at = crypto.randomUUID(), rt = crypto.randomUUID();
    st.sessions[at] = u.id; st.refresh[rt] = u.id;
    return { access_token: at, refresh_token: rt, expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: u.id, email: u.email } };
  };
  const norm = c => String(c || '').toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  const profileRow = u => ({ id: u.id, nick: u.nick, num: u.num, founder: u.num <= 1000, created_at: u.created, settings: u.settings || null, settings_updated_at: u.settingsAt || null, playtime_min: u.playtime || 0, launches: u.launches || 0, version_stats: u.vs || {}, equipped: u.equipped || {} });

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
        if (fn === 'is_admin') return json(res, 200, user.num === 2);
        if (fn === 'submit_idea') {
          const b = String(body.p_body || '').trim(), err = m => json(res, 400, { code: 'P0001', message: m });
          if (!['feature', 'cosmetic', 'bug', 'other'].includes(body.p_category)) return err('idea_category');
          if (b.length < 10) return err('idea_short');
          if (b.length > 1000) return err('idea_long');
          if (st.ideas.filter(i => i.user === user.id).length >= 5) return err('idea_limit');
          st.ideas.push({ id: ++st.ideaId, user: user.id, category: body.p_category, body: b, status: 'new', created_at: new Date().toISOString() });
          return json(res, 200, st.ideaId);
        }
        if (fn.startsWith('admin_')) {
          if (user.num !== 2) return json(res, 400, { code: 'P0001', message: 'not_admin' });
          const A = {
            admin_list_announcements: () => st.ann,
            admin_save_announcement: () => {
              const a = { id: body.p_id || ++st.annId, title: body.p_title.trim(), body: body.p_body || '', pinned: !!body.p_pinned, visible_until: body.p_until, created_at: new Date().toISOString() };
              st.ann = [...st.ann.filter(x => x.id !== a.id), a]; return a.id;
            },
            admin_delete_announcement: () => { st.ann = st.ann.filter(x => x.id !== body.p_id); return null; },
            admin_stats: () => ({ profiles: st.users.length, new7: st.users.length, active7: 0, foundersLeft: 1000 - st.num, cosmetics: Object.keys(cosmetics).length, owned: st.owned.length, versions: [] }),
            admin_create_codes: () => Array.from({ length: body.p_count }, (_, i) => { const c = 'MIB-TEST-' + String(Object.keys(st.codes).length + 1).padStart(4, '0'); st.codes[c] = { cosmetic: body.p_cosmetic, max: body.p_max_uses, used: 0 }; return c; }),
            admin_list_codes: () => Object.entries(st.codes).map(([code, c]) => ({ code, cosmetic_id: c.cosmetic, cosmetic_name: cosmetics[c.cosmetic].name, used_count: c.used, max_uses: c.max, expires_at: null, created_at: new Date().toISOString() })),
            admin_delete_code: () => { delete st.codes[body.p_code]; return null; },
            admin_find_players: () => st.users.filter(u => !u.noProfile).map(u => ({ id: u.id, num: u.num, nick: u.nick, email: u.email, created_at: u.created, founder: u.num <= 1000, playtime_min: u.playtime || 0, launches: u.launches || 0 })),
            admin_player_cosmetics: () => st.owned.filter(o => o.user === body.p_user).map(o => ({ id: o.cosmetic, name: cosmetics[o.cosmetic].name, source: 'code', acquired_at: o.at })),
            admin_grant: () => { st.owned.push({ user: body.p_user, cosmetic: body.p_cosmetic, at: new Date().toISOString() }); return null; },
            admin_revoke: () => { st.owned = st.owned.filter(o => !(o.user === body.p_user && o.cosmetic === body.p_cosmetic)); return null; },
            admin_delete_player: () => { if (st.users.find(u => u.id === body.p_user)?.num === 2) throw Object.assign(new Error('cannot_delete_admin'), { pg: true }); st.users = st.users.filter(u => u.id !== body.p_user); return null; },
            admin_save_cosmetic: () => { cosmetics[body.p_id] = { id: body.p_id, name: body.p_name, type: body.p_type, image_url: null, texture: body.p_texture || (cosmetics[body.p_id] || {}).texture || null }; return null; },
            admin_delete_cosmetic: () => { delete cosmetics[body.p_id]; return null; },
            admin_list_ideas: () => st.ideas.map(i => { const u = st.users.find(x => x.id === i.user); return { id: i.id, nick: u ? u.nick : null, num: u ? u.num : null, category: i.category, body: i.body, status: i.status, created_at: i.created_at }; })
              .sort((a, b) => (b.status === 'new') - (a.status === 'new') || b.id - a.id),
            admin_count_new_ideas: () => st.ideas.filter(i => i.status === 'new').length,
            admin_set_idea_status: () => { const i = st.ideas.find(x => x.id === body.p_id); if (!i) throw new Error('idea_missing'); i.status = body.p_status; return null; },
            admin_delete_idea: () => { st.ideas = st.ideas.filter(x => x.id !== body.p_id); return null; },
          };
          if (!A[fn]) return json(res, 404, { code: 'PGRST202', message: 'no function ' + fn });
          try { return json(res, 200, A[fn]()); } catch (e) { return json(res, 400, { code: 'P0001', message: e.message }); }
        }
        if (fn === 'create_my_profile') {
          if (!user.noProfile) return json(res, 400, { code: 'P0001', message: 'profile_exists' });
          if (st.users.some(u => !u.noProfile && u.nick.toLowerCase() === String(body.p_nick).toLowerCase())) return json(res, 400, { code: 'P0001', message: 'nick_taken' });
          user.nick = body.p_nick; user.noProfile = false; user.num = ++st.num;
          return json(res, 204);
        }
        if (fn === 'equip_cosmetic') {
          const c = cosmetics[body.p_id];
          if (body.p_id && (!c || c.type !== body.p_type || !st.owned.some(o => o.user === user.id && o.cosmetic === body.p_id))) return json(res, 400, { code: 'P0001', message: 'not_owned' });
          user.equipped = { ...(user.equipped || {}) };
          if (body.p_id) user.equipped[body.p_type] = body.p_id; else delete user.equipped[body.p_type];
          return json(res, 200, user.equipped);
        }
        // Znajomi: tak jak friend_* i friends_list w schema.sql (bez limitów)
        if (fn.startsWith('friend') || fn.startsWith('presence')) {
          const err = m => json(res, 400, { code: 'P0001', message: m });
          const pair = (a, b) => st.friends.find(f => (f.from === a && f.to === b) || (f.from === b && f.to === a));
          if (fn === 'friend_request') {
            const w = String(body.p_who || '').trim(), n = /^(mib-?)?\d{1,12}$/i.test(w) ? +w.replace(/\D/g, '') : null;
            const t = st.users.find(u => !u.noProfile && u.nick.toLowerCase() === w.toLowerCase()) || st.users.find(u => !u.noProfile && u.num === n);
            if (!t) return err('friend_not_found');
            if (t.id === user.id) return err('friend_self');
            const f = pair(user.id, t.id);
            if (f && !f.accepted && f.from === t.id) { f.accepted = true; return json(res, 200, 'accepted'); }
            if (f) return err('friend_exists');
            st.friends.push({ from: user.id, to: t.id, accepted: false });
            return json(res, 200, 'sent');
          }
          if (fn === 'friend_answer') {
            const f = st.friends.find(x => x.from === body.p_from && x.to === user.id && !x.accepted);
            if (!f) return err('friend_missing');
            if (body.p_accept) f.accepted = true; else st.friends = st.friends.filter(x => x !== f);
            return json(res, 204);
          }
          if (fn === 'friend_remove') { st.friends = st.friends.filter(f => !((f.from === user.id && f.to === body.p_user) || (f.from === body.p_user && f.to === user.id && f.accepted))); return json(res, 204); }
          if (fn === 'friends_list') {
            const fresh = pr => pr && Date.now() - pr.at < 5 * 60000;
            return json(res, 200, st.friends.filter(f => f.from === user.id || f.to === user.id).map(f => {
              const o = st.users.find(u => u.id === (f.from === user.id ? f.to : f.from)), pr = st.presence[o.id];
              const live = f.accepted && fresh(pr);
              return { id: o.id, nick: o.nick, num: o.num, state: f.accepted ? 'friend' : f.from === user.id ? 'outgoing' : 'incoming',
                status: !f.accepted ? null : live ? (pr.playing ? 'game' : 'launcher') : 'offline',
                version: live && pr.playing ? pr.version : null, server: live && pr.playing ? pr.server : null, seen_at: f.accepted && pr ? new Date(pr.at).toISOString() : null };
            }));
          }
          if (fn === 'presence_ping') { st.presence[user.id] = { at: Date.now(), playing: !!body.p_playing, version: body.p_version, server: body.p_playing ? body.p_server : null }; return json(res, 204); }
          if (fn === 'presence_leave') { delete st.presence[user.id]; return json(res, 204); }
        }
        if (fn === 'delete_my_profile') { st.users = st.users.filter(u => u.id !== user.id); return json(res, 204); }
        return json(res, 404, { message: 'no function ' + fn });
      }
      if (p === '/rest/v1/announcements') return json(res, 200, st.ann.filter(a => !a.visible_until || new Date(a.visible_until) > new Date()).sort((a, b) => b.pinned - a.pinned || b.id - a.id));
      if (p === '/rest/v1/cosmetics') return json(res, 200, Object.values(cosmetics));
      if (!user) return json(res, 401, { code: '42501', message: 'permission denied' });
      if (p === '/rest/v1/profiles') {
        if (req.method === 'PATCH') { user.settings = body.settings; user.settingsAt = body.settings_updated_at; return json(res, 204); }
        return json(res, 200, user.noProfile ? [] : [profileRow(user)]);
      }
      if (p === '/rest/v1/ideas') return json(res, 200, st.ideas.filter(i => i.user === user.id).sort((a, b) => b.id - a.id).map(({ user: _, ...i }) => i));
      if (p === '/rest/v1/owned_cosmetics') return json(res, 200, st.owned.filter(o => o.user === user.id).map(o => ({ source: 'code', acquired_at: o.at, cosmetics: cosmetics[o.cosmetic] })));
      if (p === '/rest/v1/mod_backups') {
        if (req.method === 'POST') { st.backups = st.backups.filter(b => !(b.user === user.id && b.game_version === body.game_version)); st.backups.push({ ...body, user: user.id }); return json(res, 201); }
        const gv = decodeURIComponent((url.searchParams.get('game_version') || '').replace(/^eq\./, ''));
        return json(res, 200, st.backups.filter(b => b.user === user.id && b.game_version === gv));
      }
      return json(res, 404, { message: 'not found ' + p });
    });
  });
  return { server, st, cosmetics };
}

if (require.main === module) {
  const port = +process.argv[2] || 54321;
  createFake().server.listen(port, () => console.log('fake supabase on http://127.0.0.1:' + port));
}
module.exports = { createFake };
