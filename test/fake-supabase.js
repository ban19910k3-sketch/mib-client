// Atrapa Supabase (Auth + PostgREST) w pamięci — do testów interfejsu bez prawdziwej bazy.
// Uruchomienie: node test/fake-supabase.js 54321
const http = require('http');
const crypto = require('crypto');

function createFake() {
  const st = { votes: [], blocks: [], reports: [], reportId: 0, warnings: [], warnId: 0, activity: {}, friends: [], presence: {}, invites: [], messages: [], msgId: 0, gifts: [], giftId: 0, ann: [], annId: 0, ideas: [], ideaId: 0, users: [], sessions: {}, refresh: {}, owned: [], backups: [], codes: { START: { cosmetic: 'cape_start', max: 100, used: 0 } }, redemptions: [], recovery: {}, num: 0, calls: [] };
  const cosmetics = { cape_start: { id: 'cape_start', name: 'Peleryna Start', type: 'cape', image_url: null } };
  const json = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(body === undefined ? '' : JSON.stringify(body)); };
  const newSession = u => {
    const at = crypto.randomUUID(), rt = crypto.randomUUID();
    st.sessions[at] = u.id; st.refresh[rt] = u.id;
    return { access_token: at, refresh_token: rt, expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: u.id, email: u.email } };
  };
  const norm = c => String(c || '').toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  const profileRow = u => ({ id: u.id, nick: u.nick, num: u.num, founder: u.num <= 1000, created_at: u.created, settings: u.settings || null, settings_updated_at: u.settingsAt || null, playtime_min: u.playtime || 0, launches: u.launches || 0, version_stats: u.vs || {}, equipped: u.equipped || {}, bugs_found: u.bugs || 0, warnings: u.warnings || 0, banned_at: u.banned || null, ban_reason: u.banReason || null });
  const banned = u => !!(u && u.banned);

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
        // Raport awarii: tak jak submit_crash w schema.sql
        if (fn === 'submit_crash') {
          if (banned(user)) return json(res, 400, { code: 'P0001', message: 'banned' });
          const b = String(body.p_body || '').trim();
          if (b.length < 10) return json(res, 400, { code: 'P0001', message: 'idea_short' });
          st.ideas.push({ id: ++st.ideaId, user: user.id, category: 'bug', body: b, details: body.p_details || null, status: 'new', created_at: new Date().toISOString() });
          return json(res, 200, st.ideaId);
        }
        if (fn === 'submit_idea') {
          const b = String(body.p_body || '').trim(), err = m => json(res, 400, { code: 'P0001', message: m });
          if (banned(user)) return err('banned');
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
              const a = { id: body.p_id || ++st.annId, title: body.p_title.trim(), body: body.p_body || '', pinned: !!body.p_pinned, visible_until: body.p_until, popup: !!body.p_popup, created_at: new Date().toISOString() };
              st.ann = [...st.ann.filter(x => x.id !== a.id), a]; return a.id;
            },
            admin_delete_announcement: () => { st.ann = st.ann.filter(x => x.id !== body.p_id); return null; },
            admin_stats: () => ({ profiles: st.users.length, new7: st.users.length, active7: 0, foundersLeft: 1000 - st.num, cosmetics: Object.keys(cosmetics).length, owned: st.owned.length, versions: [], nowGame: 2, nowLauncher: 1, nowMod: 3, nowServers: [{ server: 'play.mib.pl', players: 2 }], nowVersions: [{ version: '1.21.11', players: 2 }] }),
            admin_create_codes: () => {
              if (body.p_code) {
                const c = String(body.p_code).trim().toUpperCase();
                if (!/^[A-Z0-9-]{4,24}$/.test(c)) throw Object.assign(new Error('code_name_invalid'), { pg: true });
                if (st.codes[c]) throw Object.assign(new Error('code_exists'), { pg: true });
                st.codes[c] = { cosmetic: body.p_cosmetic, max: body.p_max_uses, used: 0, until: body.p_until || null };
                return [c];
              }
              return Array.from({ length: body.p_count }, (_, i) => { const c = 'MIB-TEST-' + String(Object.keys(st.codes).length + 1).padStart(4, '0'); st.codes[c] = { cosmetic: body.p_cosmetic, max: body.p_max_uses, used: 0, until: body.p_until || null }; return c; });
            },
            admin_list_codes: () => Object.entries(st.codes).map(([code, c]) => ({ code, cosmetic_id: c.cosmetic, cosmetic_name: cosmetics[c.cosmetic].name, used_count: c.used, max_uses: c.max, expires_at: c.until || null, created_at: new Date().toISOString() })),
            admin_delete_code: () => { delete st.codes[body.p_code]; return null; },
            admin_find_players: () => st.users.filter(u => !u.noProfile && (!body.p_q || !/^MIB-\d+$/i.test(body.p_q) || u.num === +body.p_q.replace(/\D/g, '')))
              .map(u => ({ id: u.id, num: u.num, nick: u.nick, email: u.email, created_at: u.created, founder: u.num <= 1000, playtime_min: u.playtime || 0, launches: u.launches || 0,
                warnings: u.warnings || 0, banned: banned(u), ban_reason: u.banReason || null })),
            // Zgłoszenia, ostrzeżenia i ban: tak jak admin_* w schema.sql
            admin_list_reports: () => st.reports.map(r => { const u = st.users.find(x => x.id === r.user), rp = st.users.find(x => x.id === r.reporter);
              return { id: r.id, reporter: rp ? rp.nick : null, user_id: r.user, nick: u.nick, num: u.num, warnings: u.warnings || 0, banned: banned(u), reason: r.reason, note: r.note, messages: r.messages, status: r.status, created_at: r.at }; })
              .sort((a, b) => (b.status === 'new') - (a.status === 'new') || b.id - a.id),
            admin_count_new_reports: () => st.reports.filter(r => r.status === 'new').length,
            admin_warn: () => {
              const u = st.users.find(x => x.id === body.p_user), why = String(body.p_reason || '').trim();
              if (!why) throw Object.assign(new Error('warn_reason'), { pg: true });
              if (u.num === 2) throw Object.assign(new Error('cannot_ban_admin'), { pg: true });
              if (banned(u)) throw Object.assign(new Error('already_banned'), { pg: true });
              u.warnings = (u.warnings || 0) + 1;
              st.warnings.push({ id: ++st.warnId, user: u.id, num: u.warnings, reason: why, at: new Date().toISOString(), seen: false });
              if (u.warnings >= 4) { u.banned = new Date().toISOString(); u.banReason = why; }
              const r = st.reports.find(x => x.id === body.p_report); if (r) r.status = u.warnings >= 4 ? 'banned' : 'warned';
              return { warnings: u.warnings, banned: u.warnings >= 4 };
            },
            admin_ban: () => { const u = st.users.find(x => x.id === body.p_user); u.banned = new Date().toISOString(); u.banReason = body.p_reason; const r = st.reports.find(x => x.id === body.p_report); if (r) r.status = 'banned'; return null; },
            admin_unban: () => { const u = st.users.find(x => x.id === body.p_user); u.banned = null; u.banReason = null; u.warnings = 0; st.warnings.forEach(w => { if (w.user === u.id) w.seen = true; }); return null; },
            admin_dismiss_report: () => { const r = st.reports.find(x => x.id === body.p_id); if (!r) throw new Error('report_missing'); r.status = 'dismissed'; return null; },
            admin_gift_all: () => {
              let n = 0;
              for (const u of st.users) if (!u.noProfile && !banned(u) && !st.owned.some(o => o.user === u.id && o.cosmetic === body.p_cosmetic) && !st.gifts.some(g => g.user === u.id && g.cosmetic === body.p_cosmetic && !g.claimed)) {
                st.gifts.push({ id: ++st.giftId, user: u.id, cosmetic: body.p_cosmetic, message: String(body.p_message || '').trim() || null, bug: false, claimed: false }); n++;
              }
              return n;
            },
            admin_activity: () => Array.from({ length: body.p_days || 30 }, (_, i) => {
              const d = new Date(Date.now() - (body.p_days - 1 - i) * 86400000).toISOString().slice(0, 10), a = st.activity[d] || {};
              return { day: d, players: Object.keys(a).length || (i % 5) + 2, played: Object.values(a).filter(Boolean).length || (i % 3) + 1, new_profiles: i % 4 === 0 ? 1 : 0 };
            }),
            admin_idea_details: () => (st.ideas.find(i => i.id === body.p_id) || {}).details || null,
            admin_player_cosmetics: () => st.owned.filter(o => o.user === body.p_user).map(o => ({ id: o.cosmetic, name: cosmetics[o.cosmetic].name, source: 'code', acquired_at: o.at })),
            admin_grant: () => { st.owned.push({ user: body.p_user, cosmetic: body.p_cosmetic, at: new Date().toISOString() }); return null; },
            admin_revoke: () => { st.owned = st.owned.filter(o => !(o.user === body.p_user && o.cosmetic === body.p_cosmetic)); return null; },
            admin_delete_player: () => { if (st.users.find(u => u.id === body.p_user)?.num === 2) throw Object.assign(new Error('cannot_delete_admin'), { pg: true }); st.users = st.users.filter(u => u.id !== body.p_user); return null; },
            admin_save_cosmetic: () => { cosmetics[body.p_id] = { id: body.p_id, name: body.p_name, type: body.p_type, image_url: null, texture: body.p_texture || (cosmetics[body.p_id] || {}).texture || null }; return null; },
            admin_delete_cosmetic: () => { delete cosmetics[body.p_id]; return null; },
            admin_list_ideas: () => st.ideas.map(i => { const u = st.users.find(x => x.id === i.user); return { id: i.id, user_id: u ? u.id : null, nick: u ? u.nick : null, num: u ? u.num : null, category: i.category, body: i.body, status: i.status, reply: i.reply || null, rewarded: !!i.rewarded, has_details: !!i.details, votes: st.votes.filter(v => v.idea === i.id).length, created_at: i.created_at }; })
              .sort((a, b) => (b.status === 'new') - (a.status === 'new') || b.id - a.id),
            admin_count_new_ideas: () => st.ideas.filter(i => i.status === 'new').length,
            admin_set_idea_status: () => { const i = st.ideas.find(x => x.id === body.p_id); if (!i) throw new Error('idea_missing'); if (i.status !== body.p_status && body.p_status !== 'new') i.updated = Date.now(); i.status = body.p_status; return null; },
            admin_answer_idea: () => { const i = st.ideas.find(x => x.id === body.p_id); if (!i) throw new Error('idea_missing'); i.status = body.p_status; i.reply = String(body.p_reply || '').trim() || null; i.updated = Date.now(); return null; },
            admin_gift: () => {
              const i = body.p_idea ? st.ideas.find(x => x.id === body.p_idea && x.user === body.p_user && !x.rewarded) : null;
              if (body.p_idea && !i) throw Object.assign(new Error('idea_rewarded'), { pg: true });
              if (i) { i.rewarded = true; i.status = 'done'; i.updated = Date.now(); if (i.category === 'bug') { const u = st.users.find(x => x.id === body.p_user); u.bugs = (u.bugs || 0) + 1; } }
              st.gifts.push({ id: ++st.giftId, user: body.p_user, cosmetic: body.p_cosmetic, message: String(body.p_message || '').trim() || null, bug: !!(i && i.category === 'bug'), claimed: false });
              return st.giftId;
            },
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
        if (fn.startsWith('friend') || fn.startsWith('presence') || fn.startsWith('game_invite') || fn.startsWith('message')) {
          const err = m => json(res, 400, { code: 'P0001', message: m });
          const pair = (a, b) => st.friends.find(f => (f.from === a && f.to === b) || (f.from === b && f.to === a));
          if (fn === 'friend_request') {
            if (banned(user)) return err('banned');
            const w = String(body.p_who || '').trim(), n = /^(mib-?)?\d{1,12}$/i.test(w) ? +w.replace(/\D/g, '') : null;
            const t = st.users.find(u => !u.noProfile && u.nick.toLowerCase() === w.toLowerCase()) || st.users.find(u => !u.noProfile && u.num === n);
            if (!t) return err('friend_not_found');
            if (t.id === user.id) return err('friend_self');
            if (st.blocks.some(b => (b.user === user.id && b.blocked === t.id) || (b.user === t.id && b.blocked === user.id))) return err('friend_blocked');
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
          if (fn === 'friend_remove') {
            st.friends = st.friends.filter(f => !((f.from === user.id && f.to === body.p_user) || (f.from === body.p_user && f.to === user.id && f.accepted)));
            st.messages = st.messages.filter(m => !((m.from === user.id && m.to === body.p_user) || (m.from === body.p_user && m.to === user.id)));
            return json(res, 204);
          }
          // Wiadomości: tak jak message_send, messages_with, messages_read, messages_unread w schema.sql (bez limitów)
          const friends = (a, b) => !!(pair(a, b) || {}).accepted;
          if (fn === 'message_send') {
            if (banned(user)) return err('banned');
            if (!friends(user.id, body.p_to)) return err('message_not_friend');
            const b = String(body.p_body || '').replace(/§./g, '').replace(/[\u0000-\u001f]+/g, ' ').trim();
            if (!b) return err('message_empty');
            if (b.length > 500) return err('message_long');
            const m = { id: ++st.msgId, from: user.id, to: body.p_to, body: b, at: new Date().toISOString(), read: false };
            st.messages.push(m);
            return json(res, 200, { id: m.id, created_at: m.at });
          }
          if (fn === 'messages_with') {
            if (!friends(user.id, body.p_user)) return json(res, 200, []);
            return json(res, 200, st.messages.filter(m => (m.from === user.id && m.to === body.p_user) || (m.from === body.p_user && m.to === user.id))
              .filter(m => !body.p_before || m.id < body.p_before).slice(-50)
              .map(m => ({ id: m.id, mine: m.from === user.id, body: m.body, created_at: m.at, read: m.read })));
          }
          if (fn === 'messages_read') { for (const m of st.messages) if (m.to === user.id && m.from === body.p_user) m.read = true; return json(res, 204); }
          if (fn === 'messages_unread') {
            const by = {};
            for (const m of st.messages) if (m.to === user.id && !m.read && friends(m.from, m.to)) (by[m.from] = by[m.from] || []).push(m);
            return json(res, 200, Object.entries(by).map(([from, l]) => ({ from_id: from, nick: st.users.find(u => u.id === from).nick, unread: l.length,
              last_id: l[l.length - 1].id, last_body: l[l.length - 1].body, last_at: l[l.length - 1].at })));
          }
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
          if (fn === 'presence_ping') {
            const d = new Date().toISOString().slice(0, 10); st.activity[d] = { ...(st.activity[d] || {}), [user.id]: !!(st.activity[d] || {})[user.id] || !!body.p_playing };
            if (body.p_hidden || banned(user)) { delete st.presence[user.id]; return json(res, 204); }
            st.presence[user.id] = { at: Date.now(), playing: !!body.p_playing, version: body.p_version, server: body.p_playing ? body.p_server : null }; return json(res, 204);
          }
          if (fn === 'presence_leave') { delete st.presence[user.id]; return json(res, 204); }
          // Zaproszenia do gry: tak jak game_invite* w schema.sql (bez limitu)
          if (fn === 'game_invite') {
            const f = pair(user.id, body.p_user);
            if (!f || !f.accepted) return err('invite_not_friend');
            const pr = st.presence[user.id];
            if (!pr || !pr.playing || !pr.server || Date.now() - pr.at > 5 * 60000) return err('invite_no_server');
            st.invites = st.invites.filter(i => !(i.from === user.id && i.to === body.p_user));
            st.invites.push({ from: user.id, to: body.p_user, server: pr.server, version: pr.version, at: Date.now() });
            return json(res, 200, { server: pr.server, version: pr.version });
          }
          if (fn === 'game_invites_list') {
            return json(res, 200, st.invites.filter(i => i.to === user.id && Date.now() - i.at < 10 * 60000 && pair(i.from, i.to)?.accepted).map(i => ({
              from_id: i.from, nick: st.users.find(u => u.id === i.from).nick, server: i.server, version: i.version, created_at: new Date(i.at).toISOString() })));
          }
          if (fn === 'game_invite_dismiss') { st.invites = st.invites.filter(i => !(i.to === user.id && i.from === body.p_from)); return json(res, 204); }
        }
        // Prezenty i zmiany w pomysłach: tak jak my_gifts, claim_gift, ideas_updates, ideas_seen w schema.sql
        if (fn === 'my_gifts') return json(res, 200, st.gifts.filter(g => g.user === user.id && !g.claimed).map(g => ({ id: g.id, cosmetic_id: g.cosmetic,
          name: cosmetics[g.cosmetic].name, type: cosmetics[g.cosmetic].type, texture: cosmetics[g.cosmetic].texture || null, message: g.message, bug: g.bug, created_at: new Date().toISOString() })));
        if (fn === 'claim_gift') {
          const g = st.gifts.find(x => x.id === body.p_id && x.user === user.id && !x.claimed);
          if (!g) return json(res, 400, { code: 'P0001', message: 'gift_missing' });
          g.claimed = true;
          if (!st.owned.some(o => o.user === user.id && o.cosmetic === g.cosmetic)) st.owned.push({ user: user.id, cosmetic: g.cosmetic, at: new Date().toISOString() });
          return json(res, 200, g.cosmetic);
        }
        if (fn === 'ideas_updates') return json(res, 200, st.ideas.filter(i => i.user === user.id && i.updated && !(i.seen >= i.updated))
          .map(i => ({ id: i.id, body: i.body, status: i.status, reply: i.reply || null, updated_at: new Date(i.updated).toISOString() })));
        if (fn === 'ideas_seen') { for (const i of st.ideas) if (i.user === user.id && i.updated) i.seen = Date.now(); return json(res, 204); }
        // Bezpieczeństwo i karta profilu: tak jak w schema.sql
        if (fn === 'block_user') {
          if (!st.blocks.some(b => b.user === user.id && b.blocked === body.p_user)) st.blocks.push({ user: user.id, blocked: body.p_user, at: new Date().toISOString() });
          const pairOf = x => (x.from === user.id && x.to === body.p_user) || (x.from === body.p_user && x.to === user.id);
          st.friends = st.friends.filter(f => !pairOf(f)); st.invites = st.invites.filter(i => !pairOf(i)); st.messages = st.messages.filter(m => !pairOf(m));
          return json(res, 204);
        }
        if (fn === 'unblock_user') { st.blocks = st.blocks.filter(b => !(b.user === user.id && b.blocked === body.p_user)); return json(res, 204); }
        if (fn === 'blocked_list') return json(res, 200, st.blocks.filter(b => b.user === user.id).map(b => { const u = st.users.find(x => x.id === b.blocked); return { id: u.id, nick: u.nick, num: u.num, created_at: b.at }; }));
        if (fn === 'report_user') {
          const m = body.p_message ? st.messages.find(x => x.id === body.p_message && x.from === body.p_user && x.to === user.id) : null;
          if (body.p_message && !m) return json(res, 400, { code: 'P0001', message: 'report_message_missing' });
          if (m && st.reports.some(r => r.reporter === user.id && r.message === m.id)) return json(res, 400, { code: 'P0001', message: 'report_exists' });
          const log = m ? st.messages.filter(x => ((x.from === user.id && x.to === body.p_user) || (x.from === body.p_user && x.to === user.id)) && x.id <= m.id).slice(-10)
            .map(x => ({ from: st.users.find(u => u.id === x.from).nick, body: x.body, at: x.at, reported: x.id === m.id })) : [];
          st.reports.push({ id: ++st.reportId, reporter: user.id, user: body.p_user, message: m ? m.id : null, reason: body.p_reason, note: body.p_note || null, messages: log, status: 'new', at: new Date().toISOString() });
          return json(res, 200, st.reportId);
        }
        // Głosowanie na pomysły: tak jak ideas_public i idea_vote w schema.sql
        const isPublic = i => i && i.category !== 'bug' && i.status !== 'rejected' && !banned(st.users.find(u => u.id === i.user));
        if (fn === 'ideas_public') {
          const n = i => st.votes.filter(v => v.idea === i.id).length;
          return json(res, 200, st.ideas.filter(i => isPublic(i) && st.users.some(u => u.id === i.user))
            .sort((a, b) => (body.p_sort === 'new' ? 0 : n(b) - n(a)) || b.id - a.id)
            .map(i => ({ id: i.id, nick: st.users.find(u => u.id === i.user).nick, category: i.category, body: i.body, status: i.status, reply: i.reply || null,
              votes: n(i), voted: st.votes.some(v => v.idea === i.id && v.user === user.id), mine: i.user === user.id, created_at: i.created_at })));
        }
        if (fn === 'idea_vote') {
          const i = st.ideas.find(x => x.id === body.p_id);
          if (!isPublic(i)) return json(res, 400, { code: 'P0001', message: 'idea_missing' });
          if (i.user === user.id) return json(res, 400, { code: 'P0001', message: 'idea_own' });
          st.votes = st.votes.filter(v => !(v.idea === i.id && v.user === user.id));
          if (body.p_on !== false) st.votes.push({ idea: i.id, user: user.id });
          return json(res, 200, st.votes.filter(v => v.idea === i.id).length);
        }
        if (fn === 'my_warnings') return json(res, 200, st.warnings.filter(w => w.user === user.id && !w.seen).map(w => ({ id: w.id, num: w.num, reason: w.reason, created_at: w.at })));
        if (fn === 'warnings_seen') { st.warnings.forEach(w => { if (w.user === user.id) w.seen = true; }); return json(res, 204); }
        if (fn === 'profile_card') {
          const id = body.p_user || user.id, u = st.users.find(x => x.id === id);
          const fr = (a, b) => st.friends.some(f => f.accepted && ((f.from === a && f.to === b) || (f.from === b && f.to === a)));
          if (id !== user.id && !fr(user.id, id)) return json(res, 400, { code: 'P0001', message: 'not_friend' });
          return json(res, 200, { id: u.id, nick: u.nick, num: u.num, founder: u.num <= 1000, created_at: u.created, bugs_found: u.bugs || 0, playtime_min: u.playtime || 0, launches: u.launches || 0,
            versions: Object.keys(u.vs || {}).length, friends: st.friends.filter(f => f.accepted && (f.from === id || f.to === id)).length, ideas: st.ideas.filter(i => i.user === id).length,
            ideas_done: st.ideas.filter(i => i.user === id && i.status === 'done').length, owned: st.owned.filter(o => o.user === id).length, mc_name: id === user.id ? null : u.mc || null,
            equipped: id === user.id ? [] : Object.entries(u.equipped || {}).map(([t, c]) => ({ type: t, id: c, name: cosmetics[c].name, texture: cosmetics[c].texture || null })) });
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
