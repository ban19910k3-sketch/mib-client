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
  // 2. popularne mody z MiB Hub (z wymaganymi bibliotekami, bez duplikatów)
  const installed = [], none = [];
  for (const slug of MODS) {
    try {
      const r = await m.installFromModrinth({ slug, gv: GV, cur: 'fabric', instDir: INST, mr, fetch, log: t => console.log(t) });
      if (r.error) none.push(slug); else installed.push(slug + ' (' + r.files.join(', ') + ')');
    } catch (e) { none.push(slug + ': ' + e.message); }
  }
  const dup = m.dedupeMods(MODS_DIR);
  const files = fs.readdirSync(MODS_DIR).filter(f => f.endsWith('.jar'));
  note('mod MiB: ' + (mib ? 'tak' : 'nie') + ' · mody (' + files.length + '): ' + files.join(', ') + (none.length ? ' · bez wersji: ' + none.join(', ') : '') + (dup.length ? ' · duplikaty wyłączone: ' + dup.map(d => d.off).join(', ') : ''));
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
  // 4. gra
  const { Client, Authenticator } = require('minecraft-launcher-core');
  const c = new Client(), log = [];
  const done = new Promise(resolve => {
    const t = setTimeout(() => resolve({ ok: false, why: 'brak startu w 15 min' }), 15 * 60000);
    c.on('data', d => {
      const s = String(d); log.push(...s.split('\n').map(x => x.trimEnd()).filter(Boolean));
      if (mib ? /\[MIB-SMOKE\] ok/.test(s) : /Sound engine started|Created: \d+x\d+x\d+ minecraft:textures\/atlas\/blocks/.test(s)) { clearTimeout(t); resolve({ ok: true }); }
    });
    c.on('close', code => { clearTimeout(t); resolve({ ok: mib && log.some(l => /\[MIB-SMOKE\] ok/.test(l)), why: 'gra zamknięta, kod ' + code }); });
  });
  const proc = await c.launch({ authorization: await Authenticator.getAuth('MiBTest'), root: INST, version: { number: GV, type: 'release', custom: prof.id }, javaPath,
    memory: { max: '3G', min: '1G' }, window: { width: 854, height: 480 }, customArgs: [...jvm, ...(mib ? ['-Dmib.smoketest=true'] : [])] });
  const r = await done;
  try { proc.kill('SIGKILL'); } catch {}
  if (r.ok) { note('PASS gra z ' + files.length + ' modami' + (mib ? ' (menu i edytor HUD moda MiB działają)' : '')); return; }
  // przyczyna: błąd Fabric (niezgodne mody, mixiny) albo raport awarii Minecrafta
  const crash = (() => { try { const d = path.join(INST, 'crash-reports'), f = fs.readdirSync(d).sort().pop(); return f ? fs.readFileSync(path.join(d, f), 'utf8') : ''; } catch { return ''; } })();
  const fabricErr = log.filter(l => /Incompatible mods|requires|Mixin apply.*failed|MixinApplyError|InvalidMixinException|Caused by|duplicate|crash|Exception/i.test(l)).slice(0, 25);
  fail('NIE DZIAŁA (' + r.why + ')\n' + fabricErr.join('\n') + (crash ? '\n--- raport awarii ---\n' + crash.split('\n').slice(0, 40).join('\n') : '') + '\n--- ostatnie linie ---\n' + log.slice(-25).join('\n'));
})().catch(e => fail(e.stack || e));
