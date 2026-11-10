// Test zbudowanego launchera na Macu (od 0.42.0, GitHub Actions macos-15 — Mac z procesorem Apple) i na Linuksie (od 0.43.0).
// Po zbudowaniu:
//   Mac:   npx electron-builder --mac --universal --publish never && node test/e2e/dist.e2e.js
//   Linux: npx electron-builder --linux AppImage --x64 --publish never && xvfb-run -a node test/e2e/dist.e2e.js
// Mac: dmg i zip, aplikacja dla Intela i Apple z podpisem ad-hoc, aktualizacja z zipa podmienia aplikację w „Aplikacjach”.
// Linux: AppImage z latest-linux.yml (aktualizacje jak na Windows), skrypt startowy z --no-sandbox tam, gdzie system
// blokuje sandbox. Wszędzie: zbudowany launcher się uruchamia, Java pobiera się na ten system (na Macu z procesorem Apple
// Java 8 w wersji na Intela przez Rosettę), a najnowszy Minecraft z listy MiB startuje z tą Javą (do załadowania LWJGL).
const path = require('path'), fs = require('fs'), os = require('os'), crypto = require('crypto'), { execFileSync, execSync, spawn } = require('child_process');
const assert = require('node:assert/strict');
const macUp = require('../../lib/macupdate'), { ensureJava } = require('../../lib/java');

const ROOT = path.join(__dirname, '..', '..'), DIST = path.join(ROOT, 'dist');
const MAC = process.platform === 'darwin', SYS = MAC ? 'Maca' : 'Linuksa';
const VERSION = require('../../package.json').version, NAME = 'MiB Client.app', NAME_APP = NAME;
const APP = path.join(DIST, 'mac-universal', NAME), ZIP = path.join(DIST, 'MiB-Client-' + VERSION + '-mac.zip');
const IMAGE = path.join(DIST, 'MiB-Client-linux.AppImage');
const TMP = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mib-dist-')));
const ok = m => console.log('::notice::PASS ' + m);
const sh = (cmd, args, o = {}) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...o });
const shAll = (cmd, args) => { const r = require('child_process').spawnSync(cmd, args, { encoding: 'utf8' }); return (r.stdout || '') + (r.stderr || ''); };
const plist = (app, key) => sh('/usr/libexec/PlistBuddy', ['-c', 'Print :' + key, path.join(app, 'Contents', 'Info.plist')]).trim();

let userDir = null; // folder danych launchera (z pierwszego uruchomienia)
async function step(name, f) {
  try { await f(); ok(name); } catch (e) { console.log('::error::' + name + ': ' + String((e && e.stack) || e).replace(/\n/g, '%0A')); process.exitCode = 1; }
}

(async () => {
  if (MAC) await step('dmg i zip, aplikacja na Intela i Apple, podpis ad-hoc', () => {
    assert.ok(fs.existsSync(path.join(DIST, 'MiB-Client-mac.dmg')), 'brak dmg');
    assert.ok(fs.existsSync(ZIP), 'brak zipa');
    const archs = sh('lipo', ['-archs', path.join(APP, 'Contents', 'MacOS', 'MiB Client')]);
    assert.match(archs, /x86_64/); assert.match(archs, /arm64/);
    sh('codesign', ['--verify', '--deep', '--strict', APP]);
    assert.match(shAll('codesign', ['-dv', APP]), /Signature=adhoc/);
    assert.equal(plist(APP, 'CFBundleShortVersionString'), VERSION);
    assert.ok(!fs.existsSync(path.join(APP, 'Contents', 'Resources', 'app.asar.unpacked', 'node_modules', 'uiohook-napi')), 'uiohook (tylko Windows) nie trafia na Maca');
  });

  // AppImage rozpakowany (bez FUSE): w środku skrypt startowy i właściwy program
  const SQ = path.join(TMP, 'squashfs-root');
  if (!MAC) await step('AppImage z latest-linux.yml, skrypt startowy z --no-sandbox przy blokadzie sandboxa', () => {
    assert.ok(fs.statSync(IMAGE).mode & 0o111, 'AppImage wykonywalny');
    const yml = fs.readFileSync(path.join(DIST, 'latest-linux.yml'), 'utf8');
    assert.match(yml, new RegExp('^version: ' + VERSION.replace(/\./g, '\\.') + '$', 'm'));
    assert.match(yml, /^path: MiB-Client-linux\.AppImage$/m);
    const sha = crypto.createHash('sha512').update(fs.readFileSync(IMAGE)).digest('base64');
    assert.ok(yml.includes('sha512: ' + sha), 'skrót AppImage w latest-linux.yml');
    sh(IMAGE, ['--appimage-extract'], { cwd: TMP });
    const run = fs.readFileSync(path.join(SQ, 'mib-client'), 'utf8');
    assert.equal(run, require('../../build/afterpack').LINUX_RUN);
    assert.match(sh('file', [path.join(SQ, 'mib-client.bin')]), /ELF 64-bit/);
    // skrypt: --no-sandbox tylko przy blokadzie (albo dla roota)
    const fake = path.join(TMP, 'fake'); fs.mkdirSync(fake);
    fs.writeFileSync(path.join(fake, 'mib-client'), run, { mode: 0o755 });
    fs.writeFileSync(path.join(fake, 'mib-client.bin'), '#!/bin/sh\necho "$@"\n', { mode: 0o755 });
    const rd = f => { try { return fs.readFileSync(f, 'utf8').trim(); } catch { return ''; } };
    const blocked = rd('/proc/sys/kernel/apparmor_restrict_unprivileged_userns') === '1' || rd('/proc/sys/kernel/unprivileged_userns_clone') === '0';
    const args = sh(path.join(fake, 'mib-client'), ['--x', 'a b']).trim();
    console.log('blokada sandboxa:', blocked, '| root:', process.getuid() === 0, '| argumenty:', args);
    assert.equal(args, (blocked || process.getuid() === 0 ? '--no-sandbox ' : '') + '--x a b');
  });

  await step('zbudowany launcher startuje na ' + SYS + ' (okno, logowanie, wersja)', async () => {
    const { _electron } = require(execSync('npm root -g').toString().trim() + '/playwright');
    // Linux: przez AppRun z AppImage, jak po dwukliku (APPDIR ustawia normalnie AppImage)
    const app = await _electron.launch({ executablePath: MAC ? path.join(APP, 'Contents', 'MacOS', 'MiB Client') : path.join(SQ, 'AppRun'),
      env: { ...process.env, MIB_SUPA_URL: 'http://127.0.0.1:9', XDG_CONFIG_HOME: path.join(TMP, 'config'), ...(MAC ? {} : { APPDIR: SQ }) } });
    try {
      const info = await app.evaluate(({ app: a }) => ({ packaged: a.isPackaged, platform: process.platform, arch: process.arch, user: a.getPath('userData') }));
      assert.equal(info.packaged, true); assert.equal(info.platform, process.platform);
      console.log('launcher:', JSON.stringify(info));
      userDir = info.user;
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

  // Nowy gracz (od 0.47.0): logowanie kontem Microsoft (atrapa msmc przez MIB_TEST_HOOKS), Mojang (atrapa fetch) i mc-login
  // (atrapa Supabase) — profil MiB ma powstać od razu, a po ponownym uruchomieniu konto i profil mają być zapamiętane
  await step('nowy gracz na ' + SYS + ': profil MiB od razu po zalogowaniu kontem Microsoft, zapamiętany po ponownym uruchomieniu', async () => {
    const { _electron } = require(execSync('npm root -g').toString().trim() + '/playwright');
    const { createFake } = require('../fake-supabase');
    const fake = createFake();
    await new Promise(r => fake.server.listen(0, '127.0.0.1', r));
    const NAME = 'MacGracz', UUID = '5e1f2c3d4b5a69788796a5b4c3d2e1f0';
    fake.st.mojang = { [NAME]: UUID };
    const ud = MAC ? userDir : path.join(TMP, 'config-new', path.basename(userDir));
    for (const f of ['accounts.json', 'mib-session.json']) fs.rmSync(path.join(ud, f), { force: true });
    const stub = (_, { name, uuid }) => {
      const msmc = globalThis.__mibRequire('msmc');
      const mc = { profile: { id: uuid, name }, mclc: () => ({ access_token: 'mc-token', client_token: 'c', uuid, name, meta: { type: 'msa', demo: false } }) };
      const xbox = { getMinecraft: async () => mc, save: () => 'msmc-refresh-' + name };
      msmc.Auth.prototype.launch = async function () { return xbox; };
      msmc.Auth.prototype.refresh = async function () { return xbox; };
      const f = globalThis.fetch;
      globalThis.fetch = (u, o) => (String(u).startsWith('https://sessionserver.mojang.com/') ? Promise.resolve(new Response(null, { status: 204 })) : f(u, o));
    };
    const run = async (first, exe = MAC ? path.join(APP, 'Contents', 'MacOS', 'MiB Client') : path.join(SQ, 'AppRun'), label = first ? 'nowy-gracz' : 'nowy-gracz-ponownie') => {
      const app = await _electron.launch({ executablePath: exe,
        env: { ...process.env, MIB_TEST_HOOKS: '1', MIB_SUPA_URL: 'http://127.0.0.1:' + fake.server.address().port, XDG_CONFIG_HOME: path.join(TMP, 'config-new'), ...(MAC ? {} : { APPDIR: SQ }) } });
      try {
        await app.evaluate(stub, { name: NAME, uuid: UUID });
        const w = await app.firstWindow(), t0 = Date.now();
        await w.waitForSelector('#app.on', { timeout: 30000 });
        await w.click('#w-go', { timeout: 5000 }).catch(() => {});
        if (first) { await w.waitForSelector('#gate.on #g-go', { timeout: 20000 }); await w.click('#g-go'); }
        let st = null;
        for (const end = Date.now() + 25000; Date.now() < end; await new Promise(r => setTimeout(r, 250))) {
          st = await w.evaluate(() => window.mib.call('profile:status'));
          if (st.state === 'ok' || st.state === 'needsProfile' || (st.state === 'error' && !st.retryIn)) break;
          if (!first && st.state === 'idle' && await w.evaluate(() => !document.getElementById('gate').hidden)) break;
        }
        const enc = await app.evaluate(({ safeStorage }) => ({ available: safeStorage.isEncryptionAvailable(), backend: safeStorage.getSelectedStorageBackend ? safeStorage.getSelectedStorageBackend() : '-' }));
        // pliki z zaszyfrowanymi tokenami tylko dla użytkownika (0600)
        assert.equal(await app.evaluate(({ app: a }) => a.getPath('userData')), ud);
        const files = ['accounts.json', 'mib-session.json'].filter(f => fs.existsSync(path.join(ud, f))).map(f => f + ':' + (fs.statSync(path.join(ud, f)).mode & 0o777).toString(8));
        const con = await w.evaluate(() => (document.getElementById('con') || {}).textContent || '');
        const info = { label, ms: Date.now() - t0, status: st, encryption: enc, files, profiles: fake.st.users.map(u => u.nick), log: con.split('\n').filter(l => /profil|Profil|konto|Konto/.test(l)).slice(-6) };
        console.log('::notice::' + SYS + ' ' + JSON.stringify(info));
        await w.screenshot({ path: path.join(TMP, label + '.png') });
        return info;
      } finally { await app.close().catch(() => {}); }
    };
    // z limitem czasu: launcher zablokowany (np. okno pęku kluczy macOS) nie wstrzymuje reszty testu
    const timed = (p, ms, what) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(what + ': brak odpowiedzi w ' + ms / 1000 + ' s')), ms))]);
    try {
      const a = await run(true);
      assert.equal(a.status.state, 'ok', 'profil MiB po zalogowaniu: ' + JSON.stringify(a.status));
      assert.deepEqual(a.profiles, [NAME], 'mc-login założył profil');
      const b = await run(false);
      assert.equal(b.status.state, 'ok', 'po ponownym uruchomieniu konto i profil zapamiętane: ' + JSON.stringify(b));
      assert.deepEqual(b.files, ['accounts.json:600', 'mib-session.json:600'], 'tokeny tylko dla użytkownika');
      // Mac: po aktualizacji aplikacja ma nowy podpis ad-hoc (inny skrót kodu) — czy pęk kluczy dalej oddaje zapisane konto
      // bez pytania o hasło (bez tego gracz po każdej aktualizacji byłby wylogowany albo launcher czekałby na okno macOS)
      if (MAC) {
        const copy = path.join(TMP, 'po-aktualizacji', NAME_APP);
        fs.mkdirSync(path.dirname(copy), { recursive: true });
        sh('ditto', [APP, copy]);
        fs.writeFileSync(path.join(copy, 'Contents', 'Resources', 'nowa-wersja.txt'), 'x');
        sh('codesign', ['--force', '--deep', '--sign', '-', copy]);
        console.log('::notice::pęk kluczy przed: ' + shAll('security', ['find-generic-password', '-s', 'MiB Client Safe Storage']).split('\n').filter(l => /svce|acct|keychain/.test(l)).join(' | '));
        let c;
        try { c = await timed(run(false, path.join(copy, 'Contents', 'MacOS', 'MiB Client'), 'po-aktualizacji'), 90000, 'launcher po aktualizacji'); }
        catch (e) { c = { error: e.message }; try { execSync('pkill -f "' + copy + '"'); } catch {} }
        console.log('::notice::Maca po aktualizacji (nowy podpis): ' + JSON.stringify(c));
      }
    } finally { fake.server.close(); }
  });

  if (MAC) await step('aktualizacja: zip → podmiana aplikacji w Aplikacjach po zamknięciu launchera', () => {
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

  if (MAC) await step('aktualizacja: najnowsze wydanie z GitHuba (bez zipa na Maca — brak aktualizacji)', async () => {
    // na maszynach GitHuba wspólny limit zapytań bez logowania — z tokenem przebiegu
    const gh = (u, o = {}) => fetch(u, process.env.GH_TOKEN ? { ...o, headers: { ...o.headers, Authorization: 'Bearer ' + process.env.GH_TOKEN } } : o);
    const r = await macUp.latest(gh);
    console.log('najnowsze wydanie:', JSON.stringify(r && { version: r.version, zip: r.zip }));
    if (r) { assert.match(r.zip, /\/releases\/download\/v[\d.]+\/MiB-Client-[\d.]+-mac\.zip$/); assert.equal((await fetch(r.zip, { method: 'HEAD' })).ok, true); }
  });

  let java21 = null;
  for (const major of [21, 25, 8]) {
    await step('Java ' + major + ' na ' + SYS, async () => {
      const p = await ensureJava({ base: path.join(TMP, 'java', String(major)), major, fetch, log: m => console.log(m) });
      const v = shAll(p, ['-version']), file = sh('file', [fs.realpathSync(p)]);
      console.log(major + ':', p, '|', v.split('\n')[0], '|', file.trim());
      assert.match(v, major === 8 ? /version "1\.8/ : new RegExp('version "' + major));
      if (MAC) assert.match(file, major === 8 ? /x86_64/ : /arm64/, 'Java 8 na Intela (Rosetta), nowsze na Apple');
      else assert.match(file, /ELF 64-bit.*x86-64/);
      if (major === 21) java21 = p;
      // drugi raz bez pobierania
      assert.equal(await ensureJava({ base: path.join(TMP, 'java', String(major)), major, fetch: () => { throw new Error('pobiera drugi raz'); } }), p);
    });
  }

  await step('Minecraft startuje na ' + SYS + ' (LWJGL)', async () => {
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
    const proc = await c.launch({ authorization: await Authenticator.getAuth('MiBTest'), root: path.join(TMP, 'mc'), version: { number: ver, type: 'release' },
      javaPath, memory: { max: '2G', min: '512M' } });
    assert.ok(proc, 'MCLC nie uruchomił gry');
    try { console.log('Minecraft ' + ver + ' (Java ' + major + '):', await ready); }
    finally { try { proc.kill('SIGKILL'); } catch {} }
  });

  console.log('zrzut i pliki testu:', TMP);
})();
