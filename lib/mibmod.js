// Mod MiB w grze (menu pod prawym Shiftem): instalacja do folderu mods, zależności z Modrinth i most kont z modem.
// Bez Electrona i sieci — pobieranie zależności wstrzykuje main.js (ensureDep), więc całość da się testować.
const path = require('path');

const MOD_FILE = 'mib-client-mod.jar';
// Najstarszy Fabric Loader, z którym działa mod (tak jak w fabric.mod.json moda)
const MIN_LOADER = '0.19.5';
// Porównanie wersji liczbowo po kropkach: 0.19.10 > 0.19.5
function cmpVersion(a, b) {
  const x = String(a).split('.').map(n => parseInt(n, 10) || 0), y = String(b).split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d < 0 ? -1 : 1; }
  return 0;
}
// Wersje gry z modem MiB (Fabric) — te same co katalogi mod/versions/<wersja>; plik moda dla każdej osobno
const VERSIONS = ['1.21', '1.21.1', '1.21.2', '1.21.3', '1.21.4', '1.21.5', '1.21.6', '1.21.7', '1.21.8', '1.21.9', '1.21.10', '1.21.11',
  '26.1', '26.1.1', '26.1.2', '26.2', '26.3'];
// perf: mody na więcej FPS (ustawienie perfMods); każdy jest pobierany tylko wtedy, gdy ma wersję dla tej wersji gry
const DEPS = [
  { slug: 'fabric-api', name: 'Fabric API', match: /^fabric-api-.*\.jar(\.disabled)?$/i, required: true },
  { slug: 'sodium', name: 'Sodium', match: /^sodium-.*\.jar(\.disabled)?$/i, required: false },
  { slug: 'lithium', name: 'Lithium', match: /^lithium-.*\.jar(\.disabled)?$/i, required: false, perf: true },
  { slug: 'ferrite-core', name: 'FerriteCore', match: /^ferritecore-.*\.jar(\.disabled)?$/i, required: false, perf: true },
  { slug: 'entityculling', name: 'Entity Culling', match: /^entityculling-.*\.jar(\.disabled)?$/i, required: false, perf: true },
  { slug: 'immediatelyfast', name: 'ImmediatelyFast', match: /^immediatelyfast-.*\.jar(\.disabled)?$/i, required: false, perf: true },
];
// Brak wersji moda dla tej wersji gry: kolejna próba najwcześniej po dobie (bez pytania Modrinth przy każdym starcie)
const RETRY_MS = 24 * 60 * 60 * 1000;
// Plik dodany przez MiB, który nie jest żadną z DEPS: biblioteka pobrana razem z modem na wydajność (np. Transition
// dla Entity Culling) — wyłączana i włączana razem z nimi
const HELPER = { name: 'biblioteka moda na wydajność', required: false, perf: true };
const TARGETS = Object.fromEntries(VERSIONS.map(v => [v, { loader: 'fabric', jar: 'mib-mod-fabric-' + v + '.jar', deps: DEPS }]));
const LOADER_NAMES = { fabric: 'Fabric', forge: 'Forge' };

// Czy przy tym uruchomieniu wgrać mod: { use: true, target } albo { use: false, reason }
function planMod({ gv, loader, enabled, jarExists }) {
  if (!enabled) return { use: false, reason: 'off' };
  const target = TARGETS[gv];
  if (!target) return { use: false, reason: 'unsupported' };
  if (loader && loader !== target.loader) return { use: false, reason: 'loader_conflict' };
  if (!jarExists) return { use: false, reason: 'missing_jar' };
  return { use: true, target };
}

// Brakujące zależności; wyłączony plik (.disabled) liczy się jako obecny — gracz sam go wyłączył
function missingDeps(target, files) {
  return target.deps.filter(d => !files.some(f => d.match.test(f)));
}

const isMibFile = name => name === MOD_FILE || name === MOD_FILE + '.disabled';

// Loader moda z pliku .jar (np. przeciągniętego do „Moje mody”): fabric, quilt, neoforge, forge albo null, gdy to nie mod
function jarLoader(buf, AdmZip = require('adm-zip')) {
  let zip;
  try { zip = new AdmZip(buf); } catch { return null; }
  const has = n => { try { return !!zip.getEntry(n); } catch { return false; } };
  if (has('fabric.mod.json')) return 'fabric';
  if (has('quilt.mod.json')) return 'quilt';
  if (has('META-INF/neoforge.mods.toml')) return 'neoforge';
  if (has('META-INF/mods.toml') || has('mcmod.info')) return 'forge';
  return null;
}
// Czy mod z loaderem `loader` zadziała w instancji z loaderem `cur` (null = jeszcze bez loadera: launcher obsługuje Fabric i Forge)
function dropError(loader, cur) {
  if (!loader) return 'not_mod';
  if (cur ? loader !== cur : loader !== 'fabric' && loader !== 'forge') return 'wrong_loader';
  return null;
}

// Konta dla menu w grze: bez tokenów, tylko to, co potrzebne do listy
function accountsPayload(acc) {
  const a = acc || {};
  return JSON.stringify((a.list || []).map(x => ({ id: String(x.id), name: String(x.name), active: x.id === a.active })));
}

// Id konta z żądania moda albo null (zły plik, nieznane konto, konto już aktywne)
function readSwitch(text, acc) {
  let j; try { j = JSON.parse(text); } catch { return null; }
  const id = j && j.id;
  if (typeof id !== 'string' || !id || id.length > 64) return null;
  const a = acc || {};
  if (!(a.list || []).some(x => x.id === id) || id === a.active) return null;
  return id;
}

// Kosmetyki dla menu w grze: tylko to, co potrzebne (tekstury przedmiotów jako base64 PNG — założonych i do przymiarki
// w menu — bez adresów zewnętrznych)
function cosmeticsPayload(c) {
  if (!c || !c.loggedIn) return JSON.stringify({ loggedIn: false, items: [] });
  return JSON.stringify({ loggedIn: true, items: (c.items || []).map(x => ({
    id: String(x.id), name: String(x.name), type: String(x.type), equipped: !!x.equipped,
    png: typeof x.texture === 'string' && x.texture.startsWith('data:image/png;base64,') ? x.texture.slice(22) : null })) });
}

// Żądanie założenia/zdjęcia kosmetyku z gry albo null: { type, id } — id musi być na liście gracza (null = zdejmij)
function readEquip(text, c) {
  let j; try { j = JSON.parse(text); } catch { return null; }
  if (!j || typeof j.type !== 'string' || !['cape', 'hat', 'wings'].includes(j.type)) return null;
  if (j.id === null || j.id === undefined) return { type: j.type, id: null };
  if (typeof j.id !== 'string' || j.id.length > 64) return null;
  return ((c && c.items) || []).some(x => x.id === j.id && x.type === j.type) ? { type: j.type, id: j.id } : null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, NAME_RE = /^[A-Za-z0-9_]{1,16}$/, CAPE_RE = /^[a-z0-9_]{2,32}$/;

// Żądanie moda (players-request.json) albo null: gracze z listy Tab do sprawdzenia — { ids: [uuid], names: [nick] }, najwyżej po 200
function readPlayersRequest(text) {
  let j; try { j = JSON.parse(text); } catch { return null; }
  if (!j || typeof j !== 'object' || Array.isArray(j)) return null;
  const pick = (a, re) => (Array.isArray(a) ? a : []).filter(x => typeof x === 'string' && re.test(x)).slice(0, 200);
  return { ids: pick(j.ids, UUID_RE).map(x => x.toLowerCase()), names: pick(j.names, NAME_RE) };
}

// players.json dla moda: gracze MiB z serwera MiB (uuid, nick, założona peleryna, czapka i skrzydła)
function playersPayload(rows) {
  return JSON.stringify({ players: (rows || []).filter(r => r && typeof r.uuid === 'string' && UUID_RE.test(r.uuid) && typeof r.name === 'string' && NAME_RE.test(r.name))
    .map(r => ({ uuid: r.uuid.toLowerCase(), name: r.name, ...Object.fromEntries(['cape', 'hat', 'wings'].map(k => [k, typeof r[k] === 'string' && CAPE_RE.test(r[k]) ? r[k] : null])) })) });
}

// Most w katalogu mib: accounts.json i cosmetics.json dla moda (odświeżane), żądania zmiany konta i kosmetyku od moda,
// wynik tylko przy błędzie. accounts() zwraca { active, list }, gdzie active to konto, na którym działa uruchomiona gra;
// cosmetics() (async) zwraca { loggedIn, items } albo null, gdy nie da się ich teraz pobrać.
// Żądanie moda (screenshot-request.json): { path } — zrzut ekranu do skopiowania. Tylko plik .png w folderze screenshots
// wewnątrz folderu gry (root); inaczej null.
function readScreenshot(text, root) {
  let j; try { j = JSON.parse(text); } catch { return null; }
  if (!j || typeof j.path !== 'string' || !/\.png$/i.test(j.path)) return null;
  const f = path.resolve(j.path), r = path.resolve(root) + path.sep;
  if (!f.startsWith(r) || !f.split(path.sep).includes('screenshots')) return null;
  return f;
}

// Stan gry od moda (status.json, co 5 s w świecie): adres serwera albo null (świat jednoosobowy, menu gry, stary plik)
const HOST_RE = /^[A-Za-z0-9._:-]{1,100}$/;
const validServer = s => typeof s === 'string' && HOST_RE.test(s);
function readStatus(text, now = Date.now()) {
  let j; try { j = JSON.parse(text); } catch { return null; }
  if (!j || typeof j.at !== 'number' || Math.abs(now - j.at) > 20000) return null;
  return validServer(j.server) ? j.server.toLowerCase() : null;
}

// players(req) (async): gracze MiB spośród graczy z Tab (players-request.json od moda) -> players.json; null = bez zmian.
// onStatus(server): serwer, na którym gracz właśnie gra (null = brak), wołane przy każdej zmianie — dla znajomych.
// Rozmowy ze znajomymi w menu gry: friends.json (lista z licznikami nowych wiadomości) co friendsEvery odpytań; chat.json
// z otwartą rozmową co 3 odpytania, póki mod odświeża chat-request.json (najwyżej 10 s temu); chat-send.json to wiadomość
// do wysłania (błąd: chat-result.json z kodem, np. message_limit).
function createBridge({ dir, fs = require('fs'), accounts, onSwitch, cosmetics = async () => null, onEquip = async () => {}, players = async () => null, onScreenshot = () => {}, onStatus = () => {},
  friends = async () => null, chat = async () => null, onSend = async () => {}, intervalMs = 1000, refreshEvery = 30, friendsEvery = 10, now = Date.now }) {
  let timer = null, notices = 0, busy = false, written = null, cosWritten = null, cos = null, polls = 0, askedText = null, playersWritten = null, server;
  let friendsWritten = null, chatWritten = null, chatWith = null;
  const p = n => path.join(dir, n);
  const rm = n => { try { fs.unlinkSync(p(n)); } catch {} };
  const put = (n, text) => { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(p(n) + '.tmp', text); fs.renameSync(p(n) + '.tmp', p(n)); };
  const fail = message => put('switch-result.json', JSON.stringify({ ok: false, message, at: now() }));
  const failCos = message => put('cosmetic-result.json', JSON.stringify({ ok: false, message, at: now() }));
  const syncAccounts = () => { const a = accountsPayload(accounts()); if (a !== written) { put('accounts.json', a); written = a; } };
  async function refreshCosmetics() {
    let c; try { c = await cosmetics(); } catch { return; }
    if (!c) return;
    cos = c;
    const t = cosmeticsPayload(c);
    if (t !== cosWritten) { put('cosmetics.json', t); cosWritten = t; }
  }
  async function refreshFriends() {
    let f; try { f = await friends(); } catch { return; }
    if (!f) return;
    const t = JSON.stringify({ loggedIn: !!f.loggedIn, list: (f.list || []).map(x => ({ id: String(x.id), nick: String(x.nick), status: x.status || 'offline', server: x.server || null, unread: Number(x.unread) || 0 })) });
    if (t !== friendsWritten) { put('friends.json', t); friendsWritten = t; }
  }
  async function refreshChat(id) {
    let rows; try { rows = await chat(id); } catch { return; }
    if (!Array.isArray(rows)) return;
    const msgs = JSON.stringify(rows.map(m => ({ id: Number(m.id), mine: !!m.mine, body: String(m.body), read: !!m.read })));
    if (id === chatWith && msgs === chatWritten) return;
    chatWith = id; chatWritten = msgs;
    put('chat.json', '{"with":' + JSON.stringify(id) + ',"at":' + now() + ',"messages":' + msgs + '}');
  }
  async function pollOnce() {
    if (busy) return;
    try { syncAccounts(); } catch {}
    let stt = null; try { stt = fs.readFileSync(p('status.json'), 'utf8'); } catch {}
    const srv = stt === null ? null : readStatus(stt, now());
    if (srv !== server) { server = srv; try { onStatus(srv); } catch {} }
    busy = true;
    try {
      const refresh = polls++ % refreshEvery === 0;
      if (refresh) await refreshCosmetics();
      // gracze MiB: od razu po zmianie listy Tab i co refreshEvery odpytań (ktoś mógł wejść do gry albo zmienić pelerynę)
      let pt = null; try { pt = fs.readFileSync(p('players-request.json'), 'utf8'); } catch {}
      if (pt !== null && (pt !== askedText || refresh)) {
        askedText = pt;
        const req = readPlayersRequest(pt);
        let rows = null; if (req) { try { rows = await players(req); } catch { rows = null; } }
        if (rows) { const t = playersPayload(rows); if (t !== playersWritten) { put('players.json', t); playersWritten = t; } }
      }
      // Znajomi i otwarta rozmowa w menu gry
      if (polls % friendsEvery === 1) await refreshFriends();
      let send = null; try { send = JSON.parse(fs.readFileSync(p('chat-send.json'), 'utf8')); } catch {}
      if (send !== null || fs.existsSync(p('chat-send.json'))) {
        rm('chat-send.json');
        const to = send && typeof send.to === 'string' ? send.to : null, body = send && typeof send.body === 'string' ? send.body.slice(0, 500) : '';
        try {
          if (!to || !body.trim()) throw new Error('message_empty');
          await onSend(to, body);
          await refreshChat(to);
          await refreshFriends();
        } catch (e) { put('chat-result.json', JSON.stringify({ ok: false, message: String((e && e.message) || e), at: now() })); }
      }
      let req = null; try { req = JSON.parse(fs.readFileSync(p('chat-request.json'), 'utf8')); } catch {}
      if (req && typeof req.with === 'string' && now() - Number(req.at) < 10000 && (req.with !== chatWith || polls % 3 === 0)) await refreshChat(req.with);
      // Screenshot: zrzut ekranu z gry do schowka
      let st = null; try { st = fs.readFileSync(p('screenshot-request.json'), 'utf8'); } catch {}
      if (st !== null) {
        rm('screenshot-request.json');
        const f = readScreenshot(st, path.dirname(dir));
        if (f) { try { onScreenshot(f); } catch {} }
      }
      let ct = null; try { ct = fs.readFileSync(p('cosmetic-request.json'), 'utf8'); } catch {}
      if (ct !== null) {
        rm('cosmetic-request.json');
        const r = readEquip(ct, cos);
        if (!r) failCos('Nie można założyć tego przedmiotu.');
        else { try { await onEquip(r.type, r.id); await refreshCosmetics(); } catch (e) { failCos(String((e && e.message) || e)); } }
      }
      let text; try { text = fs.readFileSync(p('switch-request.json'), 'utf8'); } catch { return; }
      rm('switch-request.json');
      const id = readSwitch(text, accounts());
      if (!id) return fail('Nie można przełączyć na to konto.');
      try { await onSwitch(id); } catch (e) { fail(String((e && e.message) || e)); }
    } finally { busy = false; }
  }
  const stop = () => { if (timer) clearInterval(timer); timer = null; };
  return {
    start() {
      stop();
      written = null; cosWritten = null; polls = 0; askedText = null; playersWritten = null; server = undefined; friendsWritten = null; chatWritten = null; chatWith = null;
      // kosmetyki i gracze MiB z poprzedniej sesji mogą być nieaktualne (np. peleryna zdjęta na innym komputerze): przychodzą od nowa
      try { syncAccounts(); for (const f of ['switch-request.json', 'switch-result.json', 'cosmetic-request.json', 'cosmetic-result.json', 'cosmetics.json', 'players-request.json', 'players.json', 'screenshot-request.json', 'status.json', 'notice.json', 'friends.json', 'chat.json', 'chat-request.json', 'chat-send.json', 'chat-result.json']) rm(f); } catch {}
      timer = setInterval(() => { pollOnce().catch(() => {}); }, intervalMs);
    },
    stop,
    pollOnce,
    refreshCosmetics,
    // Powiadomienie w grze (znajomy zaczął grać, zaprasza albo napisał): mod pokazuje je w rogu ekranu
    notice({ type, nick, version, server, text }) {
      const at = now(), t = type === 'invite' || type === 'message' ? type : 'started';
      put('notice.json', JSON.stringify({ id: at + '-' + ++notices, type: t, nick: String(nick || ''), version: version || null, server: server || null,
        ...(t === 'message' ? { text: String(text || '').slice(0, 300) } : {}), at }));
    },
    // Nowe wiadomości albo zmiana znajomych: friends.json od razu, nie przy najbliższym odświeżeniu
    friendsChanged: () => refreshFriends().catch(() => {}),
  };
}

// Przed uruchomieniem gry: wgrywa albo usuwa mod MiB i dociąga zależności. Zwraca { active, jvmArgs }.
// W mib-instance.json (setInst) zapamiętuje, co dodał sam: pobrane zależności (mibDeps) i loader (loaderByMib),
// żeby wyłączenie moda w ustawieniach to cofnęło.
async function prepareMibMod({ gv, inst = {}, settings, modsDir, resDir, mibDir, fs = require('fs'), ensureDep, setInst = () => {}, log = () => {}, now = Date.now }) {
  const own = path.join(modsDir, MOD_FILE);
  const remove = () => { for (const f of [own, own + '.disabled']) { try { fs.unlinkSync(f); } catch {} } };
  const list = () => { try { return fs.readdirSync(modsDir); } catch { return []; } };
  const ren = (a, b) => { try { fs.renameSync(path.join(modsDir, a), path.join(modsDir, b)); return true; } catch { return false; } };
  const off = { active: false, jvmArgs: [] };
  const t = TARGETS[gv], src = t && path.join(resDir, t.jar);
  const plan = planMod({ gv, loader: inst.loader, enabled: !settings || settings.mibMod !== false, jarExists: !!src && fs.existsSync(src) });
  const ours = inst.mibDeps || [];
  const ourFile = f => ours.includes(f.replace(/\.disabled$/, ''));
  if (!plan.use) {
    remove();
    if (plan.reason === 'off' && t) undo(t);
    if (plan.reason === 'loader_conflict') log('Ta instalacja ' + gv + ' używa ' + (LOADER_NAMES[inst.loader] || inst.loader) + ' — mod MiB działa tylko z ' + LOADER_NAMES[t.loader] + '. Gra uruchomi się bez niego.');
    if (plan.reason === 'missing_jar') log('Brak pliku moda MiB w launcherze — gra uruchomi się bez niego.');
    return off;
  }
  // Mod wyłączony w ustawieniach: Sodium od MiB zawsze wyłączony; gdy w folderze nie ma innych modów, także Fabric API i loader
  function undo(target) {
    const files = list();
    const alone = !files.some(f => f.endsWith('.jar') && !ourFile(f));
    const offNow = [];
    for (const f of files.filter(x => x.endsWith('.jar') && ourFile(x))) {
      const dep = target.deps.find(d => d.match.test(f)) || HELPER;
      if ((!dep.required || alone) && ren(f, f + '.disabled')) offNow.push(f);
    }
    const upd = {};
    if (offNow.length) upd.mibOff = [...(inst.mibOff || []), ...offNow];
    if (alone && inst.loaderByMib) Object.assign(upd, { loader: null, loaderByMib: false });
    if (Object.keys(upd).length) setInst(upd);
  }
  fs.mkdirSync(modsDir, { recursive: true });
  // Mody na wydajność wyłączone w ustawieniach: te dodane przez MiB są wyłączane (wrócą po ponownym włączeniu)
  const perfOn = !settings || settings.perfMods !== false;
  const deps = plan.target.deps.filter(d => perfOn || !d.perf);
  const keepOff = [];
  if (!perfOn) {
    for (const f of list().filter(x => x.endsWith('.jar') && ours.includes(x))) {
      const dep = plan.target.deps.find(d => d.match.test(f)) || HELPER;
      if (dep.perf && ren(f, f + '.disabled')) keepOff.push(f);
    }
  }
  // zależności wyłączone razem z modem wracają; wymagane wyłączone przez gracza też (bez nich mod nie wystartuje)
  const back = inst.mibOff || [];
  for (const f of list().filter(x => x.endsWith('.jar.disabled'))) {
    const base = f.slice(0, -9);
    const dep = deps.find(d => d.match.test(f)) || (perfOn && ourFile(f) && !plan.target.deps.some(d => d.match.test(f)) ? HELPER : null);
    if (!dep) { if (back.includes(base)) keepOff.push(base); continue; }
    if (back.includes(base) || (dep.required && !list().some(x => dep.match.test(x) && !x.endsWith('.disabled')))) {
      if (ren(f, base) && !back.includes(base)) log('Włączono ' + dep.name + ' (potrzebne do moda MiB).');
    }
  }
  const added = [], missing = { ...(inst.mibMissing || {}) };
  for (const d of missingDeps({ deps }, list())) {
    if (!d.required && missing[d.slug] && now() - missing[d.slug] < RETRY_MS) continue;
    log('Pobieranie ' + d.name + ' (' + (d.perf ? 'więcej FPS z modem MiB' : 'potrzebne do moda MiB') + ')…');
    const before = list();
    try { await ensureDep(d.slug, gv, plan.target.loader); added.push(...list().filter(f => !before.includes(f))); delete missing[d.slug]; }
    catch (e) {
      if (d.required) { remove(); log('Nie udało się pobrać ' + d.name + ' — gra uruchomi się bez moda MiB.'); return off; }
      if (e && e.code === 'no_version') { missing[d.slug] = now(); log(d.name + ' nie ma jeszcze wersji dla ' + gv + ' — gra uruchomi się bez niego.'); }
      else log('Nie udało się pobrać ' + d.name + ' — gra uruchomi się bez niego.');
    }
  }
  const upd = {};
  if (back.length || keepOff.length) upd.mibOff = [...new Set(keepOff)];
  if (JSON.stringify(missing) !== JSON.stringify(inst.mibMissing || {})) upd.mibMissing = missing;
  if (added.length) upd.mibDeps = [...ours, ...added];
  if (!inst.loader) Object.assign(upd, { loader: plan.target.loader, loaderByMib: true });
  if (Object.keys(upd).length) setInst(upd);
  const buf = fs.readFileSync(src);
  let same = false; try { same = fs.readFileSync(own).equals(buf); } catch {}
  if (!same) fs.writeFileSync(own, buf);
  try { fs.unlinkSync(own + '.disabled'); } catch {}
  return { active: true, jvmArgs: ['-Dmib.dir=' + mibDir] };
}

module.exports = { MOD_FILE, MIN_LOADER, cmpVersion, VERSIONS, TARGETS, planMod, missingDeps, isMibFile, jarLoader, dropError, accountsPayload, readSwitch, cosmeticsPayload, readEquip,
  readPlayersRequest, readScreenshot, readStatus, validServer, playersPayload, createBridge, prepareMibMod };
