// Mod MiB w grze (menu pod prawym Shiftem): instalacja do folderu mods, zależności z Modrinth i most kont z modem.
// Bez Electrona i sieci — pobieranie zależności wstrzykuje main.js (ensureDep), więc całość da się testować.
const path = require('path');

const MOD_FILE = 'mib-client-mod.jar';
const TARGETS = {
  '1.21.11': { loader: 'fabric', jar: 'mib-mod-fabric-1.21.11.jar', deps: [
    { slug: 'fabric-api', name: 'Fabric API', match: /^fabric-api-.*\.jar(\.disabled)?$/i, required: true },
    { slug: 'sodium', name: 'Sodium', match: /^sodium-.*\.jar(\.disabled)?$/i, required: false },
  ] },
};
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

// Most w katalogu mib: accounts.json dla moda (odświeżany, gdy zmienią się konta), żądanie zmiany konta od moda, wynik tylko przy błędzie.
// accounts() zwraca { active, list }, gdzie active to konto, na którym działa uruchomiona gra.
function createBridge({ dir, fs = require('fs'), accounts, onSwitch, intervalMs = 1000, now = Date.now }) {
  let timer = null, busy = false, written = null;
  const p = n => path.join(dir, n);
  const rm = n => { try { fs.unlinkSync(p(n)); } catch {} };
  const put = (n, text) => { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(p(n) + '.tmp', text); fs.renameSync(p(n) + '.tmp', p(n)); };
  const fail = message => put('switch-result.json', JSON.stringify({ ok: false, message, at: now() }));
  const syncAccounts = () => { const a = accountsPayload(accounts()); if (a !== written) { put('accounts.json', a); written = a; } };
  async function pollOnce() {
    if (busy) return;
    try { syncAccounts(); } catch {}
    let text; try { text = fs.readFileSync(p('switch-request.json'), 'utf8'); } catch { return; }
    rm('switch-request.json');
    const id = readSwitch(text, accounts());
    if (!id) return fail('Nie można przełączyć na to konto.');
    busy = true;
    try { await onSwitch(id); } catch (e) { fail(String((e && e.message) || e)); } finally { busy = false; }
  }
  const stop = () => { if (timer) clearInterval(timer); timer = null; };
  return {
    start() {
      stop();
      written = null;
      try { syncAccounts(); rm('switch-request.json'); rm('switch-result.json'); } catch {}
      timer = setInterval(() => { pollOnce().catch(() => {}); }, intervalMs);
    },
    stop,
    pollOnce,
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

module.exports = { MOD_FILE, TARGETS, planMod, missingDeps, isMibFile, accountsPayload, readSwitch, createBridge, prepareMibMod };
