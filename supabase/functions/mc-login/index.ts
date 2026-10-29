// Logowanie do MiB kontem Minecraft (od 0.26.0) — funkcja Supabase „mc-login” (Edge Functions; instrukcja w supabase/README.md).
// Launcher zgłasza się w sesji Mojanga z losowym serverId (token Minecrafta idzie tylko do Mojanga), a funkcja pyta Mojanga
// (hasJoined), czy to konto naprawdę to zrobiło. Potem loguje do profilu MiB połączonego z tym kontem Minecraft albo zakłada
// nowe konto (profil tworzy baza: handle_new_user z app_metadata, której gracz sam nie ustawi) i zwraca sesję.
// Klucz serwisowy jest tylko tutaj, w Supabase — nigdy w launcherze. Kod bez typów: działa też w testach launchera (Node).
const NAME = /^[A-Za-z0-9_]{1,16}$/, SERVER_ID = /^[0-9a-f]{32}$/;
const HAS_JOINED = 'https://sessionserver.mojang.com/session/minecraft/hasJoined';

export async function handle(req, env, f = fetch) {
  const out = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  if (req.method !== 'POST') return out(405, { error: 'method_not_allowed' });
  if (!env.url || !env.key) return out(500, { error: 'mc_login_setup' });
  let body = null;
  try { body = await req.json(); } catch {}
  const name = String((body && body.name) || ''), serverId = String((body && body.serverId) || '');
  if (!NAME.test(name) || !SERVER_ID.test(serverId)) return out(400, { error: 'bad_request' });
  // 1. Mojang: czy to konto zgłosiło się z tym serverId
  let mc = null;
  try {
    const r = await f(HAS_JOINED + '?username=' + encodeURIComponent(name) + '&serverId=' + serverId, { signal: AbortSignal.timeout(5000) });
    if (r.status === 200) mc = await r.json();
  } catch {
    return out(503, { error: 'mojang_unavailable' });
  }
  if (!mc || typeof mc.id !== 'string' || !/^[0-9a-f]{32}$/i.test(mc.id) || !NAME.test(String(mc.name))) return out(401, { error: 'not_verified' });
  const uuid = mc.id.toLowerCase().replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
  // nowe klucze (sb_secret_…) idą tylko w nagłówku apikey, stary klucz service_role także jako Bearer
  const headers = { apikey: env.key, 'Content-Type': 'application/json' };
  if (!env.key.startsWith('sb_')) headers.Authorization = 'Bearer ' + env.key;
  const call = async (path, payload) => {
    const r = await f(env.url + path, { method: 'POST', headers, body: JSON.stringify(payload) });
    const text = await r.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch {}
    return { ok: r.ok, status: r.status, data };
  };
  try {
    const account = async () => {
      const r = await call('/rest/v1/rpc/mc_account', { p_uuid: uuid, p_name: mc.name });
      if (!r.ok) throw new Error('mc_account ' + r.status + ' ' + JSON.stringify(r.data));
      return r.data;
    };
    // 2. konto MiB połączone z tym kontem Minecraft albo nowe (adres e-mail tylko techniczny: nic na niego nie wysyłamy)
    let acc = await account(), created = false;
    if (!acc) {
      const r = await call('/auth/v1/admin/users', { email: 'mc-' + uuid.replace(/-/g, '') + '@' + env.domain, email_confirm: true,
        app_metadata: { mc_uuid: uuid, mc_name: mc.name } });
      created = r.ok;
      // także gdy w tej samej chwili to samo konto założyło drugie zgłoszenie
      acc = await account();
      if (!acc) return out(500, { error: 'mc_create_failed', detail: JSON.stringify(r.data).slice(0, 300) });
    }
    // 3. sesja: jednorazowy link logowania od razu wymieniony na tokeny (bez wysyłania e-maila)
    const link = await call('/auth/v1/admin/generate_link', { type: 'magiclink', email: acc.email });
    const hash = link.data && (link.data.hashed_token || (link.data.properties && link.data.properties.hashed_token));
    if (!link.ok || !hash) return out(500, { error: 'mc_session_failed', detail: JSON.stringify(link.data).slice(0, 300) });
    const s = await call('/auth/v1/verify', { type: 'magiclink', token_hash: hash });
    if (!s.ok || !s.data || !s.data.access_token) return out(500, { error: 'mc_session_failed', detail: JSON.stringify(s.data).slice(0, 300) });
    return out(200, { access_token: s.data.access_token, refresh_token: s.data.refresh_token, expires_in: s.data.expires_in,
      user: { id: s.data.user && s.data.user.id }, created });
  } catch (e) {
    return out(500, { error: 'server_error', detail: String((e && e.message) || e).slice(0, 300) });
  }
}

if (typeof Deno !== 'undefined') {
  Deno.serve(req => handle(req, { url: Deno.env.get('SUPABASE_URL'), key: Deno.env.get('MIB_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    domain: Deno.env.get('MIB_MC_EMAIL_DOMAIN') || 'mc.mibclient.invalid' }));
}
