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

// Most w katalogu <gra>/mib: accounts.json dla moda, żądanie zmiany konta od moda, wynik tylko przy błędzie
function createBridge({ dir, fs = require('fs'), accounts, onSwitch, intervalMs = 1000, now = Date.now }) {
  let timer = null, busy = false;
  const p = n => path.join(dir, n);
  const rm = n => { try { fs.unlinkSync(p(n)); } catch {} };
  const put = (n, text) => { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(p(n) + '.tmp', text); fs.renameSync(p(n) + '.tmp', p(n)); };
  const fail = message => put('switch-result.json', JSON.stringify({ ok: false, message, at: now() }));
  async function pollOnce() {
    if (busy) return;
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
      try { put('accounts.json', accountsPayload(accounts())); rm('switch-request.json'); rm('switch-result.json'); } catch {}
      timer = setInterval(() => { pollOnce().catch(() => {}); }, intervalMs);
    },
    stop,
    pollOnce,
  };
}

// Przed uruchomieniem gry: wgrywa albo usuwa mod MiB i dociąga zależności. Zwraca { active, jvmArgs, loader }.
async function prepareMibMod({ gv, inst, settings, modsDir, resDir, fs = require('fs'), ensureDep, log = () => {} }) {
  const own = path.join(modsDir, MOD_FILE);
  const remove = () => { for (const f of [own, own + '.disabled']) { try { fs.unlinkSync(f); } catch {} } };
  const off = { active: false, jvmArgs: [] };
  const t = TARGETS[gv], src = t && path.join(resDir, t.jar);
  const plan = planMod({ gv, loader: inst && inst.loader, enabled: !settings || settings.mibMod !== false, jarExists: !!src && fs.existsSync(src) });
  if (!plan.use) {
    remove();
    if (plan.reason === 'loader_conflict') log('Ta instalacja ' + gv + ' używa ' + (LOADER_NAMES[inst.loader] || inst.loader) + ' — mod MiB działa tylko z ' + LOADER_NAMES[t.loader] + '. Gra uruchomi się bez niego.');
    if (plan.reason === 'missing_jar') log('Brak pliku moda MiB w launcherze — gra uruchomi się bez niego.');
    return off;
  }
  fs.mkdirSync(modsDir, { recursive: true });
  const list = () => { try { return fs.readdirSync(modsDir); } catch { return []; } };
  // wymagana zależność wyłączona przez gracza: bez niej mod MiB nie wystartuje, więc włączamy ją z powrotem
  for (const d of plan.target.deps.filter(x => x.required)) {
    const files = list().filter(f => d.match.test(f));
    if (files.length && files.every(f => f.endsWith('.disabled'))) {
      fs.renameSync(path.join(modsDir, files[0]), path.join(modsDir, files[0].slice(0, -9)));
      log('Włączono ' + d.name + ' (potrzebne do moda MiB).');
    }
  }
  for (const d of missingDeps(plan.target, list())) {
    log('Pobieranie ' + d.name + ' (potrzebne do moda MiB)…');
    try { await ensureDep(d.slug, gv, plan.target.loader); }
    catch {
      if (d.required) { remove(); log('Nie udało się pobrać ' + d.name + ' — gra uruchomi się bez moda MiB.'); return off; }
      log('Nie udało się pobrać ' + d.name + ' — gra uruchomi się bez niego.');
    }
  }
  const buf = fs.readFileSync(src);
  let same = false; try { same = fs.readFileSync(own).equals(buf); } catch {}
  if (!same) fs.writeFileSync(own, buf);
  try { fs.unlinkSync(own + '.disabled'); } catch {}
  return { active: true, jvmArgs: ['-Dmib.dir=' + path.join(path.dirname(modsDir), 'mib')], loader: plan.target.loader };
}

module.exports = { MOD_FILE, TARGETS, planMod, missingDeps, isMibFile, accountsPayload, readSwitch, createBridge, prepareMibMod };
