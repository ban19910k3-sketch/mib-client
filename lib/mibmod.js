// Mod MiB w grze (menu pod prawym Shiftem): instalacja do folderu mods, zależności z Modrinth i most kont z modem.
// Bez Electrona i sieci — pobieranie zależności wstrzykuje main.js (ensureDep), więc całość da się testować.
const path = require('path');
const P = require('./profile');

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
// Id i wersja moda z .jar (od 0.47.0, do szukania duplikatów): {loader, id, version} albo null, gdy to nie mod
function modMeta(buf, AdmZip = require('adm-zip')) {
  let zip;
  try { zip = new AdmZip(buf); } catch { return null; }
  const text = n => { try { const e = zip.getEntry(n); return e ? zip.readAsText(e) : null; } catch { return null; } };
  const json = n => { try { const t = text(n); return t ? JSON.parse(t) : null; } catch { return null; } };
  const f = json('fabric.mod.json');
  if (f && f.id) return { loader: 'fabric', id: String(f.id), version: String(f.version || '') };
  const q = json('quilt.mod.json'), ql = q && q.quilt_loader;
  if (ql && ql.id) return { loader: 'quilt', id: String(ql.id), version: String(ql.version || '') };
  for (const [n, loader] of [['META-INF/neoforge.mods.toml', 'neoforge'], ['META-INF/mods.toml', 'forge']]) {
    const t = text(n), id = t && /^\s*modId\s*=\s*"([^"]+)"/m.exec(t);
    if (id) { const v = /^\s*version\s*=\s*"([^"]+)"/m.exec(t); return { loader, id: id[1], version: v ? v[1] : '' }; }
  }
  return null;
}
// Porównanie wersji modów zapisanych różnie (0.133.4+1.21.11, mc1.21.11-0.7.3-fabric): po kolejnych liczbach,
// bez części z wersją gry (ta sama u obu)
function cmpModVersion(a, b) {
  const nums = v => String(v).replace(/(\+|-|^)(mc)?\d+\.\d+(\.\d+)?(?=$|-|\+)/gi, (m, p) => (/^mc/i.test(m.replace(/^[+-]/, '')) || p === '+' ? '' : m))
    .match(/\d+/g) || [];
  const x = nums(a).map(Number), y = nums(b).map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d < 0 ? -1 : 1; }
  return 0;
}
// Mody w folderze z id i wersją (bez moda MiB — ma swój plik)
function modFiles(dir, fs = require('fs')) {
  let names = [];
  try { names = fs.readdirSync(dir); } catch { return []; }
  const out = [];
  for (const file of names) {
    if (!/\.jar(\.disabled)?$/.test(file) || isMibFile(file)) continue;
    let meta = null;
    try { meta = modMeta(fs.readFileSync(path.join(dir, file))); } catch {}
    if (meta) out.push({ file, on: !file.endsWith('.disabled'), ...meta, mtime: (() => { try { return fs.statSync(path.join(dir, file)).mtimeMs; } catch { return 0; } })() });
  }
  return out;
}
// Duplikaty (od 0.47.0): ta sama biblioteka w dwóch wersjach (np. Fabric API od MiB i nowsza z moda z Modrinth) — Fabric
// i Forge wtedy nie uruchamiają gry. Zostaje najnowsza włączona, starsze są wyłączane (.disabled). Zwraca [{id, off, kept}].
function dedupeMods(dir, fs = require('fs')) {
  const on = modFiles(dir, fs).filter(m => m.on), byId = {}, out = [];
  for (const m of on) (byId[m.id] = byId[m.id] || []).push(m);
  for (const id in byId) {
    const l = byId[id];
    if (l.length < 2) continue;
    l.sort((a, b) => cmpModVersion(b.version, a.version) || b.mtime - a.mtime);
    for (const old of l.slice(1)) {
      try { fs.renameSync(path.join(dir, old.file), path.join(dir, old.file + '.disabled')); out.push({ id, off: old.file, kept: l[0].file }); } catch {}
    }
  }
  return out;
}
// Zapis pobranego moda bez duplikatu: starszy plik tego samego moda jest zastępowany, a nowszy już obecny zostaje
// (wtedy nowego pliku nie ma). Plik wyłączony przez gracza zostaje wyłączony. Zwraca {file, replaced?, kept?}.
// exact: wersja przypięta przez mod, który jej wymaga (zastępuje także nowszą)
function placeMod(dir, name, buf, fs = require('fs'), { exact = false } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const meta = /\.jar$/i.test(name) ? modMeta(buf) : null;
  if (!meta) { fs.writeFileSync(path.join(dir, name), buf); return { file: name }; }
  const same = modFiles(dir, fs).filter(m => m.id === meta.id && m.file.replace(/\.disabled$/, '') !== name);
  const newer = !exact && same.find(m => cmpModVersion(m.version, meta.version) >= 0 && m.on);
  if (newer) return { file: newer.file, kept: true };
  const disabled = same.length > 0 && same.every(m => !m.on);
  const file = name + (disabled ? '.disabled' : '');
  fs.writeFileSync(path.join(dir, file), buf);
  for (const f of [name, name + '.disabled']) if (f !== file) { try { fs.unlinkSync(path.join(dir, f)); } catch {} }
  const replaced = [];
  for (const m of same) { try { fs.unlinkSync(path.join(dir, m.file)); replaced.push(m.file); } catch {} }
  return replaced.length ? { file, replaced } : { file };
}
// ===== Zgodność modów (od 0.47.0): warunki wersji z fabric.mod.json („depends”) =====
// Wersja jak w Fabric: liczby (brak = 0), część „-alpha…” wcześniej niż wydanie, „+…” pomijane
function parseVer(v) {
  const s = String(v).trim().replace(/\+.*$/, ''), i = s.indexOf('-');
  return { n: (i < 0 ? s : s.slice(0, i)).split('.').map(x => (/^\d+$/.test(x) ? +x : x === 'x' || x === 'X' || x === '*' ? null : NaN)), pre: i >= 0 };
}
function cmpVer(a, b) {
  const x = parseVer(a), y = parseVer(b);
  for (let i = 0; i < Math.max(x.n.length, y.n.length); i++) {
    const p = x.n[i] || 0, q = y.n[i] || 0;
    if (p !== q) return p < q ? -1 : 1;
  }
  return x.pre === y.pre ? 0 : x.pre ? -1 : 1;
}
const cmpCore = (a, b) => cmpVer(String(a).replace(/-.*$/, ''), String(b).replace(/-.*$/, ''));
// Czy wersja spełnia warunek Fabric: „*”, „1.21.x”, „~1.21.4”, „^1.2”, „>=a <b” (wszystkie naraz), lista = którykolwiek
function versionOk(version, pred) {
  if (Array.isArray(pred)) return !pred.length || pred.some(p => versionOk(version, p));
  const terms = String(pred == null ? '*' : pred).trim().split(/\s+/).filter(Boolean);
  return terms.every(t => {
    if (t === '*') return true;
    const m = /^(>=|<=|>|<|=|~|\^)?(.+)$/.exec(t), op = m[1] || '', v = m[2], c = cmpVer(version, v);
    const parts = v.replace(/\+.*$/, '').replace(/-.*$/, '').split('.');
    if (op === '>=') return c >= 0;
    if (op === '<=') return c <= 0;
    if (op === '>') return c > 0;
    if (op === '<') return c < 0;
    if (op === '~' || op === '^') {
      const n = parts.map(Number), up = op === '^' ? [(n[0] || 0) + 1] : [n[0] || 0, (n[1] || 0) + 1];
      return c >= 0 && cmpCore(version, up.join('.')) < 0;
    }
    const wild = parts.findIndex(x => /^[xX*]$/.test(x));
    if (wild >= 0) {
      // jak w Fabric: „0.6.x” = od 0.6.0 z wersjami beta włącznie, do 0.7.0 bez jego wersji beta
      const base = parts.slice(0, wild).map(Number), up = base.slice(); up[up.length - 1] = (up[up.length - 1] || 0) + 1;
      return cmpCore(version, base.join('.') || '0') >= 0 && (!base.length || cmpCore(version, up.join('.')) < 0);
    }
    return c === 0;
  });
}
// fabric.mod.json z .jar (albo null)
function fabricJson(buf, AdmZip = require('adm-zip')) {
  try { const e = new AdmZip(buf).getEntry('fabric.mod.json'); return e ? JSON.parse(e.getData().toString('utf8')) : null; } catch { return null; }
}
// Wymagania moda Fabric: {minecraft?, <id moda>: warunek}; Quilt, Forge i nie-mody — puste
function modRequires(buf) { const j = fabricJson(buf); return (j && j.depends && typeof j.depends === 'object') ? j.depends : {}; }
// Mody w pliku: on sam, jego „provides” i mody w środku (META-INF/jars — np. moduły Fabric API): {id: wersja}
function modProvides(buf, AdmZip = require('adm-zip'), depth = 0) {
  const out = {};
  let zip; try { zip = new AdmZip(buf); } catch { return out; }
  let j = null; try { const e = zip.getEntry('fabric.mod.json'); j = e ? JSON.parse(e.getData().toString('utf8')) : null; } catch {}
  if (!j || !j.id) return out;
  out[j.id] = String(j.version || '');
  for (const p of Array.isArray(j.provides) ? j.provides : []) if (typeof p === 'string') out[p] = out[j.id];
  if (depth < 2) for (const n of Array.isArray(j.jars) ? j.jars : []) {
    try { const e = zip.getEntry(n.file); if (e) Object.assign(out, modProvides(e.getData(), AdmZip, depth + 1)); } catch {}
  }
  return out;
}
// tego nie dają mody z folderu (gra, loader, Java, MixinExtras w loaderze)
const BUILTIN = new Set(['minecraft', 'java', 'fabricloader', 'fabric-loader', 'fabric', 'mixinextras']);
// Czy mod (plik) da się uruchomić z tą wersją gry i z modami już w folderze: wersja gry, wymagane biblioteki (z ich
// wersjami, także w środku innych plików) i mody, z którymi się gryzie („breaks”)
function fitsInstance(buf, gv, dir, fs = require('fs')) {
  const j = fabricJson(buf);
  if (!j) return { ok: true };
  const self = modProvides(buf), have = {}, others = [];
  let names = []; try { names = fs.readdirSync(dir); } catch {}
  for (const f of names) {
    if (!f.endsWith('.jar')) continue;
    try { const b = fs.readFileSync(path.join(dir, f)), o = fabricJson(b); if (o && o.id === j.id) continue; Object.assign(have, modProvides(b)); if (o) others.push(o); } catch {}
  }
  for (const id of Object.keys(self)) delete have[id]; // ten sam mod w innej wersji zostanie zastąpiony
  const got = id => (id in self ? self[id] : have[id]);
  for (const [id, pred] of Object.entries(j.depends || {})) {
    if (id === 'minecraft') { if (!versionOk(gv, pred)) return { ok: false, kind: 'game', id, pred, why: 'minecraft ' + JSON.stringify(pred) }; continue; }
    if (BUILTIN.has(id)) continue;
    const v = got(id);
    if (v === undefined) return { ok: false, kind: 'missing', id, pred, why: id + ' — brak' };
    if (!versionOk(v, pred)) return { ok: false, kind: 'version', id, pred, why: id + ' ' + JSON.stringify(pred) + ' (jest ' + v + ')' };
  }
  for (const [id, pred] of Object.entries(j.breaks || {})) {
    if (id in have && versionOk(have[id], pred)) return { ok: false, kind: 'breaks', id, why: 'gryzie się z ' + id + ' ' + have[id] };
  }
  // w drugą stronę: mody już w folderze — czy nowy plik nie łamie ich wymagań ani nie jest na ich liście „breaks”
  for (const o of others) {
    for (const [id, v] of Object.entries(self)) {
      if (o.depends && id in o.depends && !versionOk(v, o.depends[id])) return { ok: false, kind: 'reverse', id: o.id, why: o.id + ' wymaga ' + id + ' ' + JSON.stringify(o.depends[id]) + ' (ten plik: ' + v + ')' };
      if (o.breaks && id in o.breaks && versionOk(v, o.breaks[id])) return { ok: false, kind: 'reverse', id: o.id, why: o.id + ' gryzie się z ' + id + ' ' + v };
    }
  }
  return { ok: true };
}

// ===== Mody z Modrinth (od 0.47.0 we wspólnym module: launcher i test gry z popularnymi modami) =====
// mr: zapytanie do API Modrinth (ścieżka po /v2) zwracające JSON; fetch: pobranie pliku
const encJ = o => encodeURIComponent(JSON.stringify(o));
const modrinthApi = (fetch, ua = 'MiB-Client') => async u => (await fetch('https://api.modrinth.com/v2' + u, { headers: { 'User-Agent': ua } })).json();
const MAX_TRIES = 8;
// Wersje projektu dla tej wersji gry i loadera (najnowsze pierwsze)
const projectVersions = (mr, project, gv, loader) => mr('/project/' + encodeURIComponent(project) + '/version?game_versions=' + encJ([gv]) + (loader ? '&loaders=' + encJ([loader]) : ''));
// Pierwsza zgodna wersja z listy (od 0.47.0): plik pobrany i sprawdzony (suma, wersja gry, biblioteki po ich instalacji),
// zapisany bez duplikatów (placeMod) razem z wymaganymi bibliotekami. done: lista zapisanych plików z polami gv i loader.
// Zwraca nazwę zapisanego pliku albo null, gdy żadna wersja nie pasuje.
async function installFirstFit({ candidates, dest, done, mr, fetch, log = () => {}, fs = require('fs'), exact = false }) {
  const crypto = require('crypto');
  let last = '';
  for (const v of candidates.slice(0, MAX_TRIES)) {
    const f = v.files.find(x => x.primary) || v.files[0], name = path.basename(f.filename);
    if (done.includes(name)) return name;
    const buf = Buffer.from(await (await fetch(f.url)).arrayBuffer());
    if (f.hashes && f.hashes.sha512 && crypto.createHash('sha512').update(buf).digest('hex') !== f.hashes.sha512) throw new Error('niezgodna suma kontrolna pliku');
    const isMod = /\.jar$/i.test(name);
    // wersja gry z pliku moda (Modrinth bywa za szeroki: np. Sodium „dla 26.1”, która wymaga 26.1.2)
    if (isMod && done.gv) { const req = modRequires(buf); if ('minecraft' in req && !versionOk(done.gv, req.minecraft)) { last = name + ': minecraft ' + JSON.stringify(req.minecraft); continue; } }
    // najpierw wymagane biblioteki (każda też pierwsza zgodna), potem czy ich wersje pasują temu modowi
    for (const d of v.dependencies || []) {
      if (d.dependency_type !== 'required') continue;
      try {
        let list = []; try { list = await projectVersions(mr, d.project_id, done.gv, done.loader); } catch {}
        if (!Array.isArray(list)) list = [];
        if (d.version_id) { const pin = await mr('/version/' + d.version_id).catch(() => null); if (pin && pin.files) list = [pin, ...list.filter(x => x.id !== pin.id)]; }
        if (list.length) await installFirstFit({ candidates: list, dest, done, mr, fetch, log, fs, exact: !!d.version_id });
      } catch {}
    }
    // (brakująca biblioteka wychodzi niżej w fitsInstance: wymagana, a nie ma jej w folderze)
    if (isMod && done.gv) { const fit = fitsInstance(buf, done.gv, dest, fs); if (!fit.ok) { last = name + ': ' + fit.why; continue; } }
    const put = placeMod(dest, name, buf, fs, { exact });
    done.push(put.file.replace(/\.disabled$/, ''));
    if (put.replaced) log('Zastąpiono starszą wersję: ' + put.replaced.join(', ') + ' → ' + put.file);
    if (v !== candidates[0]) log('Wybrano ' + name + ' — nowsza wersja nie pasuje do tej gry (' + last + ').');
    return put.file;
  }
  if (last) log('Brak zgodnej wersji (' + last + ').');
  return null;
}
// Jedna wersja moda (np. aktualizacja z listy zainstalowanych) — jak installFirstFit z jedną kandydatką
async function getModFile({ v, dest, done, mr, fetch, log = () => {}, fs = require('fs') }) {
  const r = await installFirstFit({ candidates: [v], dest, done, mr, fetch, log, fs });
  if (!r) throw new Error('ta wersja nie pasuje do tej gry');
  return r;
}
// Biblioteka moda MiB (np. Fabric API): najnowsza zgodna wersja dla tej wersji gry i loadera
async function ensureModDep({ slug, gv, loader, dest, mr, fetch, log, fs = require('fs') }) {
  const vs = await projectVersions(mr, slug, gv, loader);
  if (!Array.isArray(vs) || !vs.length) throw Object.assign(new Error('brak wersji ' + slug + ' dla ' + gv), { code: 'no_version' });
  const done = []; done.gv = gv; done.loader = loader;
  if (!(await installFirstFit({ candidates: vs, dest, done, mr, fetch, log, fs }))) throw Object.assign(new Error('brak zgodnej wersji ' + slug + ' dla ' + gv), { code: 'no_version' });
  return done;
}
// Projekt Modrinth z biblioteką o danym id moda Fabric (id i adres na Modrinth często się różnią)
const DEP_SLUG = { yet_another_config_lib_v3: 'yacl', 'yet-another-config-lib': 'yacl', yacl: 'yacl', 'cloth-config2': 'cloth-config', architectury: 'architectury-api',
  owo: 'owo-lib', puzzleslib: 'puzzles-lib', forgeconfigapiport: 'forge-config-api-port', resourcefullib: 'resourceful-lib', balm: 'balm', 'balm-fabric': 'balm',
  playeranimator: 'playeranimator', 'player-animator': 'playeranimator', cardinal_components: 'cardinal-components-api', 'reeses-sodium-options': 'reeses-sodium-options' };
function depSlug(id) {
  if (DEP_SLUG[id]) return DEP_SLUG[id];
  if (/^fabric-(?!language-)/.test(id) || id === 'fabric') return 'fabric-api'; // moduły Fabric API
  return id.replace(/_/g, '-');
}
// Sprawdzenie modów gracza przed GRAJ (od 0.47.0, Fabric): brakującą albo za starą bibliotekę launcher dociąga z Modrinth,
// a mod, który i tak nie pozwoliłby uruchomić gry (inna wersja gry, biblioteki brak w Modrinth, „breaks”), wyłącza (.disabled).
// Zwraca {installed: [pliki], disabled: [{file, id, why, kind, need}]}.
async function fixMods({ dir, gv, mr, fetch, log = () => {}, fs = require('fs') }) {
  const out = { installed: [], disabled: [] }, tried = new Set();
  for (let pass = 0; pass < 8; pass++) {
    let changed = false;
    for (const m of modFiles(dir, fs).filter(x => x.on && x.loader === 'fabric')) {
      let buf; try { buf = fs.readFileSync(path.join(dir, m.file)); } catch { continue; }
      const r = fitsInstance(buf, gv, dir, fs);
      if (r.ok || r.kind === 'reverse') continue; // „reverse” zgłosi sam mod, któremu ten plik przeszkadza
      if ((r.kind === 'missing' || r.kind === 'version') && mr && !tried.has(r.id)) {
        tried.add(r.id);
        try { const done = await ensureModDep({ slug: depSlug(r.id), gv, loader: 'fabric', dest: dir, mr, fetch, log, fs }); out.installed.push(...done); changed = true; break; }
        catch (e) { log('Biblioteka ' + r.id + ' dla ' + m.id + ': ' + e.message); }
      }
      try { fs.renameSync(path.join(dir, m.file), path.join(dir, m.file + '.disabled')); } catch { continue; }
      out.disabled.push({ file: m.file, id: m.id, kind: r.kind, need: r.kind === 'game' ? r.pred : r.id, why: r.why });
      changed = true; break;
    }
    if (!changed) break;
  }
  return out;
}
// Mod albo paczka zasobów z MiB Hub do instancji (instDir): loader Fabric/Forge wybierany przy pierwszym modzie (cur — już
// wybrany). Zwraca {loader, pack, files} albo {error: 'no_version'}.
async function installFromModrinth({ slug, gv, cur, instDir, mr, fetch, log, fs = require('fs') }) {
  const p = await mr('/project/' + encodeURIComponent(slug)), pack = p.project_type === 'resourcepack';
  const vs = await mr('/project/' + encodeURIComponent(slug) + '/version?game_versions=' + encJ([gv]) + (pack ? '' : '&loaders=' + encJ(cur ? [cur] : ['fabric', 'forge'])));
  if (!Array.isArray(vs) || !vs.length) return { error: 'no_version', pack };
  const loader = pack ? null : (cur || (vs.some(x => x.loaders.includes('fabric')) ? 'fabric' : 'forge'));
  const cands = pack ? vs : vs.filter(x => x.loaders.includes(loader));
  const done = []; done.gv = gv; done.loader = loader;
  const file = await installFirstFit({ candidates: cands, dest: path.join(instDir, pack ? 'resourcepacks' : 'mods'), done, mr, fetch, log, fs });
  if (!file) return { error: 'no_version', pack };
  return { loader, pack, files: [...done] };
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
const COS_TYPES = ['cape', 'hat', 'mask', 'wings', 'aura', 'pet', 'tail', 'back'];
// Miniatury kosmetyków dla menu gry (0.40.0): <id>-<8 znaków skrótu tekstury>.png — nowa tekstura, nowy plik
const THUMB_RE = /^[a-z0-9_]{1,64}-[0-9a-f]{8}\.png$/;
const thumbName = c => (/^[a-z0-9_]{1,64}$/.test(String(c && c.id)) && typeof c.texture === 'string' && c.texture.startsWith('data:image/png')
  ? c.id + '-' + require('crypto').createHash('sha1').update(c.texture).digest('hex').slice(0, 8) + '.png' : null);

function cosmeticsPayload(c) {
  if (!c || !c.loggedIn) return JSON.stringify({ loggedIn: false, items: [] });
  // ustawienia peta (od 0.34.0) — tryb, strona i imię, jak widzą go inni
  return JSON.stringify({ loggedIn: true, items: (c.items || []).map(x => ({
    id: String(x.id), name: String(x.name), type: String(x.type), equipped: !!x.equipped,
    png: typeof x.texture === 'string' && x.texture.startsWith('data:image/png;base64,') ? x.texture.slice(22) : null,
    // miniatura z launchera (0.40.0), plik w mib/thumbs
    ...(typeof x.thumb === 'string' && THUMB_RE.test(x.thumb) ? { thumb: x.thumb } : {}) })),
    // prezenty od MiB do odebrania w menu gry (bez tekstur)
    gifts: (c.gifts || []).filter(g => Number.isInteger(Number(g.id))).map(g => ({ id: Number(g.id), name: String(g.name), type: String(g.type), message: g.message ? String(g.message) : null })),
    pet: P.petSettings(c.pet) });
}

// Żądanie odebrania prezentu z gry (cosmetic-request.json z polem gift) albo null: id musi być na liście prezentów
function readClaim(text, c) {
  let j; try { j = JSON.parse(text); } catch { return null; }
  if (!j || !Number.isInteger(j.gift)) return null;
  return ((c && c.gifts) || []).some(g => Number(g.id) === j.gift) ? j.gift : null;
}

// Żądanie założenia/zdjęcia kosmetyku z gry albo null: { type, id } — id musi być na liście gracza (null = zdejmij)
function readEquip(text, c) {
  let j; try { j = JSON.parse(text); } catch { return null; }
  if (!j || typeof j.type !== 'string' || !COS_TYPES.includes(j.type)) return null;
  if (j.id === null || j.id === undefined) return { type: j.type, id: null };
  if (typeof j.id !== 'string' || j.id.length > 64) return null;
  return ((c && c.items) || []).some(x => x.id === j.id && x.type === j.type) ? { type: j.type, id: j.id } : null;
}

// Zmiana trybu albo strony peta z menu w grze (cosmetic-request.json z polem pet) albo null; imię zmienia się w launcherze
function readPet(text) {
  let j; try { j = JSON.parse(text); } catch { return null; }
  const x = j && j.pet;
  if (!x || typeof x !== 'object' || !P.PET_MODES.includes(x.mode) || (x.side !== 'left' && x.side !== 'right')) return null;
  return { mode: x.mode, side: x.side };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, NAME_RE = /^[A-Za-z0-9_]{1,16}$/, CAPE_RE = /^[a-z0-9_]{2,32}$/;

// Żądanie moda (players-request.json) albo null: gracze z listy Tab do sprawdzenia — { ids: [uuid], names: [nick] }, najwyżej po 200
function readPlayersRequest(text) {
  let j; try { j = JSON.parse(text); } catch { return null; }
  if (!j || typeof j !== 'object' || Array.isArray(j)) return null;
  const pick = (a, re) => (Array.isArray(a) ? a : []).filter(x => typeof x === 'string' && re.test(x)).slice(0, 200);
  return { ids: pick(j.ids, UUID_RE).map(x => x.toLowerCase()), names: pick(j.names, NAME_RE) };
}

// Główki skinów znajomych dla menu gry (0.40.0): mib/heads/<nazwa małymi literami>.png z mc-heads.net (16×16 z nakładką),
// pobierane, gdy ich nie ma albo są starsze niż doba; zwraca, ile pobrano. Złe nazwy i odpowiedzi bez PNG pomija.
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
async function ensureHeads({ dir, names, fetch, fs = require('fs'), now = Date.now(), maxAge = 864e5 }) {
  const d = path.join(dir, 'heads');
  let n = 0;
  for (const name of [...new Set((names || []).filter(x => typeof x === 'string' && NAME_RE.test(x)))].slice(0, 100)) {
    const f = path.join(d, name.toLowerCase() + '.png');
    try { if (now - fs.statSync(f).mtimeMs < maxAge) continue; } catch {}
    try {
      const r = await fetch('https://mc-heads.net/avatar/' + encodeURIComponent(name) + '/16');
      if (!r.ok) continue;
      const b = Buffer.from(await r.arrayBuffer());
      if (b.length > 64 * 1024 || !b.subarray(0, 8).equals(PNG_SIG)) continue;
      fs.mkdirSync(d, { recursive: true });
      fs.writeFileSync(f + '.tmp', b); fs.renameSync(f + '.tmp', f);
      n++;
    } catch {}
  }
  return n;
}

// players.json dla moda: gracze MiB z serwera MiB (uuid, nick, założone kosmetyki; od 0.34.0 pet, ogon, plecak i ustawienia
// peta — imię po clean, np. filtrze wulgaryzmów)
function playersPayload(rows, clean = s => s) {
  return JSON.stringify({ players: (rows || []).filter(r => r && typeof r.uuid === 'string' && UUID_RE.test(r.uuid) && typeof r.name === 'string' && NAME_RE.test(r.name))
    .map(r => {
      const pet = P.petSettings({ mode: r.pet_mode, side: r.pet_side, name: r.pet_name });
      return { uuid: r.uuid.toLowerCase(), name: r.name, ...Object.fromEntries(COS_TYPES.map(k => [k, typeof r[k] === 'string' && CAPE_RE.test(r[k]) ? r[k] : null])),
        petMode: pet.mode, petSide: pet.side, petName: pet.name ? clean(pet.name) : null, ...(r.party === true ? { party: true } : {}) };
    }) });
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
function createBridge({ dir, fs = require('fs'), accounts, onSwitch, cosmetics = async () => null, onEquip = async () => {}, onClaim = async () => {}, onPet = async () => {}, players = async () => null, petName = s => s, onScreenshot = () => {}, onStatus = () => {},
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
    // party (0.38.0): wpis z id „party”, flagą party i członkami w jednej linii
    const t = JSON.stringify({ loggedIn: !!f.loggedIn, list: (f.list || []).map(x => ({ id: String(x.id), nick: String(x.nick), status: x.status || 'offline', server: x.server || null, unread: Number(x.unread) || 0,
      ...(x.party ? { party: true, members: String(x.members || '').slice(0, 300) } : {}),
      // główka skina w menu gry (0.40.0): nazwa konta Minecraft, plik pobiera ensureHeads do mib/heads
      ...(typeof x.mc === 'string' && NAME_RE.test(x.mc) ? { mc: x.mc } : {}) })) });
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
        if (rows) { const t = playersPayload(rows, petName); if (t !== playersWritten) { put('players.json', t); playersWritten = t; } }
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
        const g = readClaim(ct, cos), r = g === null ? readEquip(ct, cos) : null, pt2 = g === null && !r ? readPet(ct) : null;
        if (g !== null) { try { await onClaim(g); await refreshCosmetics(); } catch (e) { failCos(String((e && e.message) || e)); } }
        else if (pt2) { try { await onPet(pt2); await refreshCosmetics(); } catch (e) { failCos(String((e && e.message) || e)); } }
        else if (!r) failCos('Nie można założyć tego przedmiotu.');
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
      try { syncAccounts(); for (const f of ['switch-request.json', 'switch-result.json', 'cosmetic-request.json', 'cosmetic-result.json', 'cosmetics.json', 'players-request.json', 'players.json', 'screenshot-request.json', 'status.json', 'notice.json', 'friends.json', 'chat.json', 'chat-request.json', 'chat-send.json', 'chat-result.json', 'spotify.json', 'spotify-request.json']) rm(f); } catch {} // dwa ostatnie: pozostałość po Spotify z 0.40.0
      timer = setInterval(() => { pollOnce().catch(() => {}); }, intervalMs);
    },
    stop,
    pollOnce,
    refreshCosmetics,
    // Powiadomienie w grze (znajomy zaczął grać, zaprasza albo napisał, prezent, ważna aktualność, party): mod pokazuje je w rogu ekranu
    notice({ type, nick, version, server, text }) {
      const at = now(), t = ['invite', 'message', 'gift', 'news', 'party'].includes(type) ? type : 'started';
      put('notice.json', JSON.stringify({ id: at + '-' + ++notices, type: t, nick: String(nick || ''), version: version || null, server: server || null,
        ...(['message', 'gift', 'news', 'party'].includes(t) ? { text: String(text || '').slice(0, 300) } : {}), at }));
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

module.exports = { MOD_FILE, MIN_LOADER, cmpVersion, VERSIONS, TARGETS, planMod, missingDeps, isMibFile, jarLoader, modMeta, cmpModVersion, modFiles, dedupeMods, placeMod, versionOk, modRequires, modProvides, fitsInstance, depSlug, fixMods, modrinthApi, installFirstFit, getModFile, ensureModDep, installFromModrinth, dropError, accountsPayload, readSwitch, cosmeticsPayload, readEquip, readClaim, readPet, COS_TYPES,
  readPlayersRequest, readScreenshot, readStatus, validServer, playersPayload, createBridge, prepareMibMod, ensureHeads, thumbName, THUMB_RE };
