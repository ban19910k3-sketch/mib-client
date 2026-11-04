// Test launchera na Macu (od 0.42.0, GitHub Actions macos-14 — Mac z procesorem Apple). Po zbudowaniu:
//   npx electron-builder --mac --universal --publish never && node test/e2e/mac.e2e.js
// Sprawdza: dmg i zip, aplikacja dla Intela i Apple z podpisem ad-hoc, zbudowany launcher się uruchamia, aktualizacja
// z zipa podmienia aplikację w „Aplikacjach”, Java pobiera się na Maca (też 8 — wersja na Intela przez Rosettę),
// a najnowszy Minecraft z listy MiB startuje z tą Javą (do załadowania LWJGL, bez karty graficznej dalej nie trzeba).
const path = require('path'), fs = require('fs'), os = require('os'), { execFileSync, execSync, spawn } = require('child_process');
const assert = require('node:assert/strict');
const macUp = require('../../lib/macupdate'), { ensureJava } = require('../../lib/java');

const ROOT = path.join(__dirname, '..', '..'), DIST = path.join(ROOT, 'dist');
const VERSION = require('../../package.json').version, NAME = 'MiB Client.app';
const APP = path.join(DIST, 'mac-universal', NAME), ZIP = path.join(DIST, 'MiB-Client-' + VERSION + '-mac.zip');
const TMP = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mib-mac-')));
const ok = m => console.log('::notice::PASS ' + m);
const sh = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const shAll = (cmd, args) => { const r = require('child_process').spawnSync(cmd, args, { encoding: 'utf8' }); return (r.stdout || '') + (r.stderr || ''); };
const plist = (app, key) => sh('/usr/libexec/PlistBuddy', ['-c', 'Print :' + key, path.join(app, 'Contents', 'Info.plist')]).trim();

async function step(name, f) {
  try { await f(); ok(name); } catch (e) { console.log('::error::' + name + ': ' + String((e && e.stack) || e).replace(/\n/g, '%0A')); process.exitCode = 1; }
}

(async () => {
  await step('dmg i zip, aplikacja na Intela i Apple, podpis ad-hoc', () => {
    assert.ok(fs.existsSync(path.join(DIST, 'MiB-Client-mac.dmg')), 'brak dmg');
    assert.ok(fs.existsSync(ZIP), 'brak zipa');
    const archs = sh('lipo', ['-archs', path.join(APP, 'Contents', 'MacOS', 'MiB Client')]);
    assert.match(archs, /x86_64/); assert.match(archs, /arm64/);
    sh('codesign', ['--verify', '--deep', '--strict', APP]);
    assert.match(shAll('codesign', ['-dv', APP]), /Signature=adhoc/);
    assert.equal(plist(APP, 'CFBundleShortVersionString'), VERSION);
    assert.ok(!fs.existsSync(path.join(APP, 'Contents', 'Resources', 'app.asar.unpacked', 'node_modules', 'uiohook-napi')), 'uiohook (tylko Windows) nie trafia na Maca');
  });

  await step('zbudowany launcher startuje (okno, logowanie, wersja)', async () => {
    const { _electron } = require(execSync('npm root -g').toString().trim() + '/playwright');
    const app = await _electron.launch({ executablePath: path.join(APP, 'Contents', 'MacOS', 'MiB Client'), env: { ...process.env, MIB_SUPA_URL: 'http://127.0.0.1:9' } });
    try {
      const info = await app.evaluate(({ app: a }) => ({ packaged: a.isPackaged, platform: process.platform, arch: process.arch, user: a.getPath('userData') }));
      assert.equal(info.packaged, true); assert.equal(info.platform, 'darwin');
      console.log('launcher:', JSON.stringify(info));
      const w = await app.firstWindow(), errors = [];
      w.on('pageerror', e => errors.push(e.message));
      await w.waitForSelector('#app.on', { timeout: 30000 });
      await w.click('#w-go', { timeout: 5000 }).catch(() => {});
      await w.waitForSelector('#gate.on #g-go', { timeout: 20000 });
      assert.equal(await w.evaluate(() => window.mib.call('ver')), VERSION);
      await w.click('#g-later');
      await w.waitForFunction(() => document.getElementById('gate').hidden);
      await w.screenshot({ path: path.join(TMP, 'launcher.png') });
      assert.deepEqual(errors, []);
    } finally { await app.close().catch(() => {}); }
  });

  await step('aktualizacja: zip → podmiana aplikacji w Aplikacjach po zamknięciu launchera', () => {
    const apps = path.join(TMP, 'Applications'), cur = path.join(apps, NAME), out = path.join(TMP, 'upd');
    fs.mkdirSync(apps); fs.mkdirSync(out);
    sh('ditto', [APP, cur]);
    fs.writeFileSync(path.join(cur, 'Contents', 'stara-wersja'), '1');
    assert.equal(macUp.canSelfUpdate(cur), true);
    assert.equal(macUp.appBundle(path.join(cur, 'Contents', 'MacOS', 'MiB Client')), cur);
    sh('ditto', ['-x', '-k', ZIP, out]);
    const fresh = path.join(out, NAME);
    sh('codesign', ['--verify', '--deep', '--strict', fresh]);
    const old = spawn('sleep', ['2']), script = path.join(TMP, 'swap.sh');
    fs.writeFileSync(script, macUp.swapScript({ pid: old.pid, app: cur, fresh }), { mode: 0o755 });
    const t = Date.now();
    sh('/bin/sh', [script]);
    assert.ok(Date.now() - t >= 1500, 'skrypt czeka na zamknięcie launchera');
    assert.ok(!fs.existsSync(path.join(cur, 'Contents', 'stara-wersja')), 'nowa aplikacja na miejscu starej');
    assert.ok(!fs.existsSync(fresh) && !fs.existsSync(cur + '.old'));
    sh('codesign', ['--verify', '--deep', '--strict', cur]);
    assert.equal(plist(cur, 'CFBundleShortVersionString'), VERSION);
    try { execSync('sleep 3; pkill -f "' + apps + '"'); } catch {}
  });

  await step('aktualizacja: najnowsze wydanie z GitHuba (bez zipa na Maca — brak aktualizacji)', async () => {
    const r = await macUp.latest(fetch);
    console.log('najnowsze wydanie:', JSON.stringify(r && { version: r.version, zip: r.zip }));
    if (r) { assert.match(r.zip, /\/releases\/download\/v[\d.]+\/MiB-Client-[\d.]+-mac\.zip$/); assert.equal((await fetch(r.zip, { method: 'HEAD' })).ok, true); }
  });

  let java21 = null;
  for (const major of [21, 25, 8]) {
    await step('Java ' + major + ' na Maca', async () => {
      const p = await ensureJava({ base: path.join(TMP, 'java', String(major)), major, fetch, log: m => console.log(m) });
      const v = shAll(p, ['-version']), file = sh('file', [fs.realpathSync(p)]);
      console.log(major + ':', p, '|', v.split('\n')[0], '|', file.trim());
      assert.match(v, major === 8 ? /version "1\.8/ : new RegExp('version "' + major));
      assert.match(file, major === 8 ? /x86_64/ : /arm64/, 'Java 8 na Intela (Rosetta), nowsze na Apple');
      if (major === 21) java21 = p;
      // drugi raz bez pobierania
      assert.equal(await ensureJava({ base: path.join(TMP, 'java', String(major)), major, fetch: () => { throw new Error('pobiera drugi raz'); } }), p);
    });
  }

  await step('Minecraft startuje na Macu (LWJGL)', async () => {
    const { Client, Authenticator } = require('minecraft-launcher-core');
    const VERSIONS = require('../../lib/mibmod').VERSIONS || [];
    const manifest = await (await fetch('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json')).json();
    const ver = [...VERSIONS].reverse().find(v => manifest.versions.some(x => x.id === v)) || '1.21.11';
    const meta = await (await fetch(manifest.versions.find(x => x.id === ver).url)).json();
    const major = (meta.javaVersion && meta.javaVersion.majorVersion) || 21;
    const javaPath = major === 21 && java21 ? java21 : await ensureJava({ base: path.join(TMP, 'java', String(major)), major, fetch });
    const c = new Client(), log = [];
    const ready = new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('brak startu w 20 min; ostatnie linie:\n' + log.slice(-30).join('\n'))), 20 * 60000);
      c.on('data', d => { log.push(String(d).trim()); if (/Backend library: LWJGL/.test(d)) { clearTimeout(t); res(String(d).trim()); } });
      c.on('close', code => { clearTimeout(t); rej(new Error('gra zamknięta (kod ' + code + '):\n' + log.slice(-40).join('\n'))); });
    });
    const proc = await c.launch({ authorization: await Authenticator.getAuth('MiBMacTest'), root: path.join(TMP, 'mc'), version: { number: ver, type: 'release' },
      javaPath, memory: { max: '2G', min: '512M' } });
    assert.ok(proc, 'MCLC nie uruchomił gry');
    try { console.log('Minecraft ' + ver + ' (Java ' + major + '):', await ready); }
    finally { try { proc.kill('SIGKILL'); } catch {} }
  });

  console.log('zrzut i pliki testu:', TMP);
})();
