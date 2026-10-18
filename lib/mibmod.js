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
const DEPS = [
  { slug: 'fabric-api', name: 'Fabric API', match: /^fabric-api-.*\.jar(\.disabled)?$/i, required: true },
  { slug: 'sodium', name: 'Sodium', match: /^sodium-.*\.jar(\.disabled)?$/i, required: false },
];
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

// Kosmetyki dla menu w grze: tylko to, co potrzebne (tekstura założonej peleryny jako base64 PNG, bez adresów zewnętrznych)
function cosmeticsPayload(c) {
  if (!c || !c.loggedIn) return JSON.stringify({ loggedIn: false, items: [] });
  return JSON.stringify({ loggedIn: true, items: (c.items || []).map(x => ({
    id: String(x.id), name: String(x.name), type: String(x.type), equipped: !!x.equipped,
    png: x.type === 'cape' && x.equipped && typeof x.texture === 'string' && x.texture.startsWith('data:image/png;base64,') ? x.texture.slice(22) : null })) });
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

// players.json dla moda: gracze MiB z serwera MiB (uuid, nick, założona peleryna)
function playersPayload(rows) {
  return JSON.stringify({ players: (rows || []).filter(r => r && typeof r.uuid === 'string' && UUID_RE.test(r.uuid) && typeof r.name === 'string' && NAME_RE.test(r.name))
    .map(r => ({ uuid: r.uuid.toLowerCase(), name: r.name, cape: typeof r.cape === 'string' && CAPE_RE.test(r.cape) ? r.cape : null })) });
}

// Most w katalogu mib: accounts.json i cosmetics.json dla moda (odświeżane), żądania zmiany konta i kosmetyku od moda,
// wynik tylko przy błędzie. accounts() zwraca { active, list }, gdzie active to konto, na którym działa uruchomiona gra;
// cosmetics() (async) zwraca { loggedIn, items } albo null, gdy nie da się ich teraz pobrać.
// players(req) (async): gracze MiB spośród graczy z Tab (players-request.json od moda) -> players.json; null = bez zmian.
function createBridge({ dir, fs = require('fs'), accounts, onSwitch, cosmetics = async () => null, onEquip = async () => {}, players = async () => null, intervalMs = 1000, refreshEvery = 30, now = Date.now }) {
  let timer = null, busy = false, written = null, cosWritten = null, cos = null, polls = 0, askedText = null, playersWritten = null;
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
  async function pollOnce() {
    if (busy) return;
    try { syncAccounts(); } catch {}
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
      written = null; cosWritten = null; polls = 0; askedText = null; playersWritten = null;
      // kosmetyki i gracze MiB z poprzedniej sesji mogą być nieaktualne (np. peleryna zdjęta na innym komputerze): przychodzą od nowa
      try { syncAccounts(); for (const f of ['switch-request.json', 'switch-result.json', 'cosmetic-request.json', 'cosmetic-result.json', 'cosmetics.json', 'players-request.json', 'players.json']) rm(f); } catch {}
      timer = setInterval(() => { pollOnce().catch(() => {}); }, intervalMs);
    },
    stop,
    pollOnce,
    refreshCosmetics,
  };
}

// Przed uruchomieniem gry: wgrywa albo usuwa mod MiB i dociąga zależności. Zwraca { active, jvmArgs }.
// W mib-instance.json (setInst) zapamiętuje, co dodał sam: pobrane zależności (mibDeps) i loader (loaderByMib),
// żeby wyłączenie moda w ustawieniach to cofnęło.
async function prepareMibMod({ gv, inst = {}, settings, modsDir, resDir, mibDir, fs = require('fs'), ensureDep, setInst = () => {}, log = () => {} }) {
  const own = path.join(modsDir, MOD_FILE);
  const remove = () => { for (const f of [own, own + '.disabled']) { try { fs.unlinkSync(f); } catch {} } };
  const list = () => { try { return fs.readdirSync(modsDir); } catch { return []; } };
  const ren = (a, b) => { try { fs.renameSync(path.join(modsDir, a), path.join(modsDir, b)); return true; } catch { return false; } };
  const off = { active: false, jvmArgs: [] };
  const t = TARGETS[gv], src = t && path.join(resDir, t.jar);
  const plan = planMod({ gv, loader: inst.loader, enabled: !settings || settings.mibMod !== false, jarExists: !!src && fs.existsSync(src) });
  const ours = inst.mibDeps || [];
  if (!plan.use) {
    remove();
    if (plan.reason === 'off' && t) undo(t);
    if (plan.reason === 'loader_conflict') log('Ta instalacja ' + gv + ' używa ' + (LOADER_NAMES[inst.loader] || inst.loader) + ' — mod MiB działa tylko z ' + LOADER_NAMES[t.loader] + '. Gra uruchomi się bez niego.');
    if (plan.reason === 'missing_jar') log('Brak pliku moda MiB w launcherze — gra uruchomi się bez niego.');
    return off;
  }
  // Mod wyłączony w ustawieniach: Sodium od MiB zawsze wyłączony; gdy w folderze nie ma innych modów, także Fabric API i loader
  function undo(target) {
    const files = list(), mine = f => ours.includes(f.replace(/\.disabled$/, ''));
    const alone = !files.some(f => f.endsWith('.jar') && !mine(f));
    const offNow = [];
    for (const f of files.filter(x => x.endsWith('.jar') && mine(x))) {
      const dep = target.deps.find(d => d.match.test(f));
      if (dep && (!dep.required || alone) && ren(f, f + '.disabled')) offNow.push(f);
    }
    const upd = {};
    if (offNow.length) upd.mibOff = [...(inst.mibOff || []), ...offNow];
    if (alone && inst.loaderByMib) Object.assign(upd, { loader: null, loaderByMib: false });
    if (Object.keys(upd).length) setInst(upd);
  }
  fs.mkdirSync(modsDir, { recursive: true });
  // zależności wyłączone razem z modem wracają; wymagane wyłączone przez gracza też (bez nich mod nie wystartuje)
  const back = inst.mibOff || [];
  for (const f of list().filter(x => x.endsWith('.jar.disabled'))) {
    const dep = plan.target.deps.find(d => d.match.test(f)), base = f.slice(0, -9);
    if (dep && (back.includes(base) || (dep.required && !list().some(x => dep.match.test(x) && !x.endsWith('.disabled'))))) {
      if (ren(f, base) && !back.includes(base)) log('Włączono ' + dep.name + ' (potrzebne do moda MiB).');
    }
  }
  const added = [];
  for (const d of missingDeps(plan.target, list())) {
    log('Pobieranie ' + d.name + ' (potrzebne do moda MiB)…');
    const before = list();
    try { await ensureDep(d.slug, gv, plan.target.loader); added.push(...list().filter(f => !before.includes(f))); }
    catch {
      if (d.required) { remove(); log('Nie udało się pobrać ' + d.name + ' — gra uruchomi się bez moda MiB.'); return off; }
      log('Nie udało się pobrać ' + d.name + ' — gra uruchomi się bez niego.');
    }
  }
  const upd = {};
  if (back.length) upd.mibOff = [];
  if (added.length) upd.mibDeps = [...ours, ...added];
  if (!inst.loader) Object.assign(upd, { loader: plan.target.loader, loaderByMib: true });
  if (Object.keys(upd).length) setInst(upd);
  const buf = fs.readFileSync(src);
  let same = false; try { same = fs.readFileSync(own).equals(buf); } catch {}
  if (!same) fs.writeFileSync(own, buf);
  try { fs.unlinkSync(own + '.disabled'); } catch {}
  return { active: true, jvmArgs: ['-Dmib.dir=' + mibDir] };
}

module.exports = { MOD_FILE, MIN_LOADER, cmpVersion, VERSIONS, TARGETS, planMod, missingDeps, isMibFile, accountsPayload, readSwitch, cosmeticsPayload, readEquip,
  readPlayersRequest, playersPayload, createBridge, prepareMibMod };
