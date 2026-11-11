// Gra z popularnymi modami z Modrinth (od 0.47.0) — tak jak u gracza: instalacja kodem launchera (lib/mibmod.js:
// mod MiB z bibliotekami i modami na FPS, potem mody z MiB Hub z wymaganymi bibliotekami, bez duplikatów), Fabric z meta
// Fabric i start przez MCLC jak w launcherze. Z modem MiB gra sama otwiera menu i edytor HUD (-Dmib.smoketest) i się
// zamyka; bez moda MiB (starsze wersje) wystarczy wczytanie gry. Awaria = błąd z przyczyną (Fabric, raport awarii).
// Uruchom: xvfb-run -a node test/e2e/mods.e2e.js <wersja gry> [plik moda MiB]   (MIB_MODS=slug,slug — inna lista modów)
const path = require('path'), fs = require('fs'), os = require('os');
const m = require('../../lib/mibmod'), { ensureJava } = require('../../lib/java');

const [GV, JAR] = process.argv.slice(2);
const POPULAR = ['iris', 'modmenu', 'sodium-extra', 'reeses-sodium-options', 'continuity', 'entitytexturefeatures', 'entity-model-features',
  'xaeros-minimap', 'xaeros-world-map', 'appleskin', 'not-enough-animations', '3dskinlayers', 'modernfix', 'moreculling', 'zoomify',
  'dynamic-fps', 'mouse-tweaks', 'jade', 'lambdynamiclights', 'betterf3', 'simple-voice-chat', 'fancymenu'];
const MODS = (process.env.MIB_MODS || POPULAR.join(',')).split(',').map(s => s.trim()).filter(Boolean);
const TMP = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mib-mods-')));
const INST = path.join(TMP, 'instances', GV), MODS_DIR = path.join(INST, 'mods');
const note = t => console.log('::notice::' + GV + ': ' + t), fail = t => { console.log('::error::' + GV + ': ' + String(t).replace(/\n/g, '%0A')); process.exitCode = 1; };
const mr = m.modrinthApi(fetch, 'MiB-Client-CI (github.com/ban19910k3-sketch/mib-client)');

(async () => {
  if (!GV) throw new Error('podaj wersję gry');
  fs.mkdirSync(MODS_DIR, { recursive: true });
  // 1. mod MiB z bibliotekami i modami na FPS (prepareMibMod jak przy GRAJ)
  let jvm = [], mib = false;
  if (JAR && fs.existsSync(JAR) && m.TARGETS[GV]) {
    const res = path.join(TMP, 'res'); fs.mkdirSync(res); fs.copyFileSync(JAR, path.join(res, m.TARGETS[GV].jar));
    const inst = {};
    const r = await m.prepareMibMod({ gv: GV, inst, settings: { mibMod: true, perfMods: true }, modsDir: MODS_DIR, resDir: res, mibDir: path.join(TMP, 'mib'),
      ensureDep: (slug, gv, loader) => m.ensureModDep({ slug, gv, loader, dest: MODS_DIR, mr, fetch }), setInst: o => Object.assign(inst, o), log: t => console.log('MiB: ' + t) });
    mib = r.active; jvm = r.jvmArgs;
  }
  // 2. popularne mody z MiB Hub (z wymaganymi bibliotekami, bez duplikatów); który plik należy do którego moda
  const base = new Set(fs.readdirSync(MODS_DIR).filter(f => f.endsWith('.jar'))), owners = {}, none = [];
  const CACHE_SRC = path.join(TMP, 'base'); fs.mkdirSync(CACHE_SRC);
  for (const f of base) fs.copyFileSync(path.join(MODS_DIR, f), path.join(CACHE_SRC, f));
  for (const slug of MODS) {
    try {
      const r = await m.installFromModrinth({ slug, gv: GV, cur: 'fabric', instDir: INST, mr, fetch, log: t => console.log(t) });
      if (r.error) none.push(slug); else for (const f of r.files) (owners[f] = owners[f] || new Set()).add(slug);
    } catch (e) { none.push(slug + ': ' + e.message); }
  }
  const dup = m.dedupeMods(MODS_DIR);
  const all = fs.readdirSync(MODS_DIR).filter(f => f.endsWith('.jar')), slugs = MODS.filter(x => !none.some(n => n.split(':')[0] === x));
  const CACHE = path.join(TMP, 'cache'); fs.mkdirSync(CACHE);
  // mod MiB, jego biblioteki i mody na FPS (po id moda — popularny mód mógł podmienić plik na inną wersję) są zawsze
  const idOf = {}; for (const f of all) { const mm = m.modMeta(fs.readFileSync(path.join(MODS_DIR, f))); idOf[f] = mm && mm.id; }
  const baseIds = new Set([...base].map(f => { try { const mm = m.modMeta(fs.readFileSync(path.join(CACHE_SRC, f))); return mm && mm.id; } catch { return null; } }).filter(Boolean));
  for (const f of all) fs.copyFileSync(path.join(MODS_DIR, f), path.join(CACHE, f));
  note('mod MiB: ' + (mib ? 'tak' : 'nie') + ' · mody (' + all.length + '): ' + all.join(', ') + (none.length ? ' · bez wersji: ' + none.join(', ') : '') + (dup.length ? ' · duplikaty wyłączone: ' + dup.map(d => d.off).join(', ') : ''));
  // 3. Fabric (jak ensureFabric w main.js) i Java dla tej wersji gry
  const list = await (await fetch('https://meta.fabricmc.net/v2/versions/loader/' + GV)).json();
  const lv = (list.find(x => x.loader.stable) || list[0]).loader.version;
  const prof = await (await fetch('https://meta.fabricmc.net/v2/versions/loader/' + GV + '/' + lv + '/profile/json')).json();
  fs.mkdirSync(path.join(INST, 'versions', prof.id), { recursive: true });
  fs.writeFileSync(path.join(INST, 'versions', prof.id, prof.id + '.json'), JSON.stringify(prof));
  const manifest = await (await fetch('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json')).json();
  const meta = await (await fetch(manifest.versions.find(x => x.id === GV).url)).json();
  let major = (meta.javaVersion && meta.javaVersion.majorVersion) || 8; if (major === 16) major = 17;
  const javaPath = await ensureJava({ base: path.join(TMP, 'java'), major, fetch, log: () => {} });
  const { Client, Authenticator } = require('minecraft-launcher-core');
  const auth = await Authenticator.getAuth('MiBTest');
  // 4. gra z wybranymi modami (pliki bez właściciela = mod MiB, jego biblioteki i mody na FPS — zawsze)
  async function play(chosen) {
    for (const f of fs.readdirSync(MODS_DIR)) if (f.endsWith('.jar')) fs.unlinkSync(path.join(MODS_DIR, f));
    for (const f of all) if (baseIds.has(idOf[f]) || !owners[f] || [...owners[f]].some(x => chosen.includes(x))) fs.copyFileSync(path.join(CACHE, f), path.join(MODS_DIR, f));
    fs.rmSync(path.join(INST, 'crash-reports'), { recursive: true, force: true });
    const c = new Client(), log = [];
    const done = new Promise(resolve => {
      const t = setTimeout(() => resolve({ ok: false, why: 'brak startu w 10 min' }), 10 * 60000);
      c.on('data', d => {
        const s = String(d); log.push(...s.split('\n').map(x => x.trimEnd()).filter(Boolean));
        if (mib ? /\[MIB-SMOKE\] ok/.test(s) : /Sound engine started|Created: \d+x\d+x\d+ minecraft:textures\/atlas\/blocks/.test(s)) { clearTimeout(t); resolve({ ok: true }); }
      });
      c.on('close', code => { clearTimeout(t); resolve({ ok: mib && log.some(l => /\[MIB-SMOKE\] ok/.test(l)), why: 'gra zamknięta, kod ' + code }); });
    });
    const proc = await c.launch({ authorization: auth, root: INST, version: { number: GV, type: 'release', custom: prof.id }, javaPath,
      memory: { max: '3G', min: '1G' }, window: { width: 854, height: 480 }, customArgs: [...jvm, ...(mib ? ['-Dmib.smoketest=true'] : [])] });
    const r = await done;
    try { proc.kill('SIGKILL'); } catch {}
    await new Promise(x => setTimeout(x, 1500));
    if (r.ok) return r;
    // przyczyna w skrócie: raport awarii (opis, wyjątek, Caused by, mixiny) i błędy Fabric
    const cut = l => (l.length > 220 ? l.slice(0, 220) + '…' : l);
    const crash = (() => { try { const d = path.join(INST, 'crash-reports'), f = fs.readdirSync(d).sort().pop(); return f ? fs.readFileSync(path.join(d, f), 'utf8').split('\n') : []; } catch { return []; } })();
    const ci = crash.findIndex(l => /^Description:/.test(l));
    const why = [...(ci >= 0 ? crash.slice(ci, ci + 4) : []), ...crash.filter(l => /^Caused by|Mixin|mixin/.test(l)).slice(0, 8),
      ...log.filter(l => /\[MIB-SMOKE\]|Incompatible mod|requires|ERROR\]|FATAL|Exception in|Crash report saved/i.test(l) && !/401|Realms|flite|narrator|Patreon|patreon/i.test(l)).slice(0, 12)].map(cut);
    return { ...r, detail: why.join('\n') || log.slice(-10).map(cut).join('\n') };
  }
  const first = await play(slugs);
  if (first.ok) { note('PASS gra z ' + all.length + ' plikami modów' + (mib ? ' (menu i edytor HUD moda MiB działają)' : '')); return; }
  console.log('::warning::' + GV + ': ze wszystkimi modami gra nie działa (' + first.why + '):%0A' + first.detail.replace(/\n/g, '%0A'));
  // 5. który mod: dzielenie listy na pół (bez winnych w obu połówkach = wina tylko razem)
  const bad = [];
  async function search(set) {
    if (!set.length) return;
    const r = await play(set);
    if (r.ok) return;
    if (set.length === 1) { bad.push({ slug: set[0], why: r.why, detail: r.detail }); return; }
    const before = bad.length, h = Math.ceil(set.length / 2);
    await search(set.slice(0, h)); await search(set.slice(h));
    if (bad.length === before) bad.push({ slug: set.join('+') + ' (tylko razem)', why: r.why, detail: r.detail });
  }
  const alone = await play([]);
  if (!alone.ok) { fail('NIE DZIAŁA nawet bez popularnych modów (sam mod MiB z bibliotekami i modami na FPS): ' + alone.why + '\n' + alone.detail); return; }
  await search(slugs);
  for (const b of bad) fail('NIE DZIAŁA z ' + b.slug + ' (' + b.why + ')\n' + b.detail);
  if (!bad.length) note('ze wszystkimi naraz nie działało, ale każda połowa osobno tak — prawdopodobnie brak pamięci albo czasu');
})().catch(e => fail(e.stack || e));
