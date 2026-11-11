// Launcher na Macu (od 0.42.0): Java dla każdego systemu (lib/java.js) i własne aktualizacje (lib/macupdate.js)
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');
const { javaAsset, findJava, ensureJava } = require('../lib/java');
const mu = require('../lib/macupdate');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mib-mac-test-'));
const res = (ok, body = Buffer.alloc(0), status = ok ? 200 : 404) => ({ ok, status, arrayBuffer: async () => body });

test('javaAsset: adres, archiwum i java dla Windows, Maca (Intel i Apple) i Linuksa', () => {
  const base = 'https://api.adoptium.net/v3/binary/latest/21/ga/';
  assert.deepEqual(javaAsset(21, 'win32', 'x64'), { url: base + 'windows/x64/jre/hotspot/normal/eclipse', archive: 'zip', bin: ['bin', 'java.exe'] });
  assert.deepEqual(javaAsset(21, 'darwin', 'arm64'), { url: base + 'mac/aarch64/jre/hotspot/normal/eclipse', archive: 'tar.gz', bin: ['Contents', 'Home', 'bin', 'java'] });
  assert.equal(javaAsset(8, 'darwin', 'x64').url, 'https://api.adoptium.net/v3/binary/latest/8/ga/mac/x64/jre/hotspot/normal/eclipse');
  assert.deepEqual(javaAsset(17, 'linux', 'x64').bin, ['bin', 'java']);
});

test('findJava: pierwszy rozpakowany katalog z java, brak katalogu = null', () => {
  const d = tmp();
  assert.equal(findJava(path.join(d, 'nie-ma'), ['bin', 'java']), null);
  fs.mkdirSync(path.join(d, 'pusty'));
  fs.mkdirSync(path.join(d, 'jdk8u-jre', 'Contents', 'Home', 'bin'), { recursive: true });
  fs.writeFileSync(path.join(d, 'jdk8u-jre', 'Contents', 'Home', 'bin', 'java'), '');
  assert.equal(findJava(d, ['Contents', 'Home', 'bin', 'java']), path.join(d, 'jdk8u-jre', 'Contents', 'Home', 'bin', 'java'));
});

test('ensureJava na Macu: tar.gz rozpakowany tarem, plik usunięty, java wykonywalna; drugi raz bez pobierania', async () => {
  const base = path.join(tmp(), 'java', '21'), urls = [], runs = [];
  const run = async (cmd, args) => {
    runs.push([cmd, ...args]);
    assert.ok(fs.existsSync(args[1]), 'archiwum zapisane przed rozpakowaniem');
    const bin = path.join(base, 'jdk-21.0.5+11-jre', 'Contents', 'Home', 'bin');
    fs.mkdirSync(bin, { recursive: true }); fs.writeFileSync(path.join(bin, 'java'), '#!/bin/sh\n');
  };
  const fetch = async u => { urls.push(u); return res(true, Buffer.from('tgz')); };
  const p = await ensureJava({ base, major: 21, fetch, run, platform: 'darwin', arch: 'arm64' });
  assert.equal(p, path.join(base, 'jdk-21.0.5+11-jre', 'Contents', 'Home', 'bin', 'java'));
  assert.deepEqual(urls, [javaAsset(21, 'darwin', 'arm64').url]);
  assert.deepEqual(runs, [['tar', '-xzf', path.join(base, 'java.tar.gz'), '-C', base]]);
  assert.equal(fs.existsSync(path.join(base, 'java.tar.gz')), false, 'archiwum usunięte');
  assert.equal(fs.statSync(p).mode & 0o111, 0o111, 'java wykonywalna');
  assert.equal(await ensureJava({ base, major: 21, fetch: () => assert.fail('pobiera drugi raz'), platform: 'darwin', arch: 'arm64' }), p);
});

test('ensureJava: Mac z procesorem Apple bez Javy na arm64 (Java 8) bierze wersję na Intela', async () => {
  const base = path.join(tmp(), 'java', '8'), urls = [];
  const run = async () => { const b = path.join(base, 'jdk8u-jre', 'Contents', 'Home', 'bin'); fs.mkdirSync(b, { recursive: true }); fs.writeFileSync(path.join(b, 'java'), ''); };
  const fetch = async u => { urls.push(u); return res(!u.includes('aarch64'), Buffer.from('tgz')); };
  await ensureJava({ base, major: 8, fetch, run, platform: 'darwin', arch: 'arm64' });
  assert.deepEqual(urls, [javaAsset(8, 'darwin', 'arm64').url, javaAsset(8, 'darwin', 'x64').url]);
});

test('ensureJava: błąd pobierania z kodem, na Windows bez drugiej próby; zip na Windows przez AdmZip', async () => {
  const urls = [];
  await assert.rejects(ensureJava({ base: path.join(tmp(), 'j'), major: 21, fetch: async u => { urls.push(u); return res(false, undefined, 503); }, platform: 'win32', arch: 'arm64' }), /kod 503/);
  assert.equal(urls.length, 1);
  const AdmZip = require('adm-zip'), z = new AdmZip();
  z.addFile('jdk-21-jre/bin/java.exe', Buffer.from('exe'));
  const base = path.join(tmp(), 'java', '21');
  const p = await ensureJava({ base, major: 21, fetch: async () => res(true, z.toBuffer()), platform: 'win32', arch: 'x64', run: () => assert.fail('bez tar') });
  assert.equal(p, path.join(base, 'jdk-21-jre', 'bin', 'java.exe'));
  await assert.rejects(ensureJava({ base: path.join(tmp(), 'pusta'), major: 21, fetch: async () => res(true, new AdmZip().toBuffer()), platform: 'win32', arch: 'x64' }), /nie znaleziono Javy/);
});

test('macupdate.newer: porównanie wersji liczbami', () => {
  assert.equal(mu.newer('0.42.0', '0.41.0'), true);
  assert.equal(mu.newer('0.42.10', '0.42.9'), true);
  assert.equal(mu.newer('1.0', '0.99.99'), true);
  assert.equal(mu.newer('0.42.0', '0.42.0'), false);
  assert.equal(mu.newer('0.41.9', '0.42.0'), false);
});

test('macupdate.latest: tylko wydanie z zipem na Maca, adres zipa, opis', async () => {
  const rel = (tag, names, body = '## Dodane\n- Mac') => async (u, o) => {
    assert.equal(u, 'https://api.github.com/repos/ban19910k3-sketch/mib-client/releases/latest');
    assert.equal(o.headers['User-Agent'], 'MiB-Client');
    return { ok: true, json: async () => ({ tag_name: tag, body, assets: names.map(name => ({ name })) }) };
  };
  assert.deepEqual(await mu.latest(rel('v0.42.0', ['MiB-Client-Setup-0.42.0.exe', 'MiB-Client-0.42.0-mac.zip', 'MiB-Client-mac.dmg'])),
    { version: '0.42.0', notes: '## Dodane\n- Mac', zip: 'https://github.com/ban19910k3-sketch/mib-client/releases/download/v0.42.0/MiB-Client-0.42.0-mac.zip' });
  assert.equal(await mu.latest(rel('v0.42.0', ['MiB-Client-Setup-0.42.0.exe'])), null, 'Mac jeszcze się nie zbudował');
  assert.equal(await mu.latest(rel('v0.42.0', ['MiB-Client-0.41.0-mac.zip'])), null, 'zip innej wersji');
  assert.equal(await mu.latest(rel('nightly', ['MiB-Client-nightly-mac.zip'])), null);
  await assert.rejects(mu.latest(async () => ({ ok: false, status: 403 })), /kod 403/);
});

test('macupdate.appBundle i canSelfUpdate: tylko aplikacja w zwykłym folderze z prawem zapisu', () => {
  assert.equal(mu.appBundle('/Applications/MiB Client.app/Contents/MacOS/MiB Client'), '/Applications/MiB Client.app');
  assert.equal(mu.appBundle('/usr/local/bin/electron'), null);
  assert.equal(mu.canSelfUpdate(null), false);
  assert.equal(mu.canSelfUpdate('/private/var/folders/x/T/AppTranslocation/ABC/d/MiB Client.app'), false, 'nieprzeniesiona z Pobranych');
  assert.equal(mu.canSelfUpdate('/Volumes/MiB Client 0.42.0/MiB Client.app'), false, 'prosto z dmg');
  const d = tmp();
  assert.equal(mu.canSelfUpdate(path.join(d, 'MiB Client.app')), true);
  const ro = { constants: fs.constants, accessSync: () => { throw new Error('EACCES'); } };
  assert.equal(mu.canSelfUpdate(path.join(d, 'MiB Client.app'), ro), false);
});

test('macupdate.swapScript: czeka na launcher, podmienia z powrotem przy błędzie, ścieżki bezpieczne w cudzysłowach', async () => {
  const s = mu.swapScript({ pid: 4242, app: "/Users/o'neil/Apps/MiB Client.app", fresh: '/tmp/x $(rm -rf ~)/MiB Client.app' });
  assert.match(s, /^#!\/bin\/sh\n/);
  assert.match(s, /APP='\/Users\/o'\\''neil\/Apps\/MiB Client\.app'/);
  assert.match(s, /NEW='\/tmp\/x \$\(rm -rf ~\)\/MiB Client\.app'/, 'bez podstawiania poleceń');
  assert.match(s, /kill -0 4242/);
  assert.match(s, /if mv "\$APP" "\$APP\.old"; then\n  if mv "\$NEW" "\$APP"; then rm -rf "\$APP\.old"; else rm -rf "\$APP"; mv "\$APP\.old" "\$APP"; fi\nfi/,
    'stara usuwana dopiero po udanej podmianie, przy błędzie wraca; gdy starej nie da się przenieść — nic nie rusza');
  assert.match(s, /xattr -dr com\.apple\.quarantine "\$APP"/);
  assert.match(s, /open "\$APP"\n$/);
  assert.equal(mu.swapScript({ pid: '1; rm -rf /', app: 'a', fresh: 'b' }).includes('rm -rf /'), false, 'pid tylko jako liczba');
  // prawdziwa podmiana (bez „open” i xattr, których nie ma poza Makiem)
  if (process.platform === 'win32') return;
  const d = tmp(), app = path.join(d, "Apps o'k", 'MiB Client.app'), fresh = path.join(d, 'new', 'MiB Client.app');
  fs.mkdirSync(app, { recursive: true }); fs.writeFileSync(path.join(app, 'v'), 'stara');
  fs.mkdirSync(fresh, { recursive: true }); fs.writeFileSync(path.join(fresh, 'v'), 'nowa');
  const script = mu.swapScript({ pid: 999999, app, fresh }).replace(/^(xattr|open) .*$/gm, ':');
  require('child_process').execFileSync('/bin/sh', ['-c', script]);
  assert.equal(fs.readFileSync(path.join(app, 'v'), 'utf8'), 'nowa');
  assert.equal(fs.existsSync(fresh) || fs.existsSync(app + '.old'), false);
  // brak nowej aplikacji: zostaje stara
  require('child_process').execFileSync('/bin/sh', ['-c', mu.swapScript({ pid: 999999, app, fresh: path.join(d, 'nie-ma.app') }).replace(/^(xattr|open) .*$/gm, ':')]);
  assert.equal(fs.readFileSync(path.join(app, 'v'), 'utf8'), 'nowa');
  assert.equal(fs.existsSync(app + '.old'), false);
  // starej nie ma gdzie przenieść (brak aplikacji): nowa zostaje nieruszona
  fs.mkdirSync(fresh, { recursive: true }); fs.writeFileSync(path.join(fresh, 'v'), 'nowa2');
  require('child_process').execFileSync('/bin/sh', ['-c', mu.swapScript({ pid: 999999, app: path.join(d, 'brak', 'MiB Client.app'), fresh }).replace(/^(xattr|open) .*$/gm, ':')], { stdio: 'ignore' });
  assert.equal(fs.readFileSync(path.join(fresh, 'v'), 'utf8'), 'nowa2');
});

test('macupdate.download: zapis z postępem, przerwane pobieranie to błąd', async () => {
  const body = [Buffer.alloc(50, 1), Buffer.alloc(50, 2)];
  const r = (len, chunks) => ({ ok: true, status: 200, headers: { get: h => (h === 'content-length' ? String(len) : null) }, body: (async function* () { yield* chunks; })() });
  const file = path.join(tmp(), 'u.zip'), prog = [];
  assert.equal(await mu.download({ url: 'u', file, fetch: async () => r(100, body), onProgress: p => prog.push(p) }), 100);
  assert.deepEqual(prog, [50, 100]);
  assert.equal(fs.readFileSync(file).length, 100);
  await assert.rejects(mu.download({ url: 'u', file, fetch: async () => r(200, body) }), /przerwane/);
  await assert.rejects(mu.download({ url: 'u', file, fetch: async () => ({ ok: false, status: 404 }) }), /kod 404/);
  assert.match(mu.DMG_URL, /^https:\/\/github\.com\/ban19910k3-sketch\/mib-client\/releases\/latest\/download\/MiB-Client-mac\.dmg$/);
});

// ===== Ikona Minecrafta w Docku (0.47.0): starsze wersje gry same jej nie ustawiają na Macu =====
test('dockIcon: minecraft.icns z zasobów Mojanga (sprawdzony skrót), raz pobrany do folderu launchera; dockArgs dla Javy', async () => {
  const crypto = require('crypto'), fs = require('fs'), os = require('os'), path = require('path');
  const mac = require('../lib/macupdate');
  const icns = Buffer.concat([Buffer.from('icns'), Buffer.alloc(60, 7)]), hash = crypto.createHash('sha1').update(icns).digest('hex');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mib-dock-')), calls = [];
  const json = o => ({ ok: true, json: async () => o });
  const fetch = async u => {
    calls.push(u);
    if (u.includes('version_manifest')) return json({ versions: [{ id: '1.12.2', url: 'https://piston-meta/v/1.12.2.json' }] });
    if (u.endsWith('1.12.2.json')) return json({ assetIndex: { url: 'https://piston-meta/i/1.12.json' } });
    if (u.endsWith('1.12.json')) return json({ objects: { 'icons/minecraft.icns': { hash, size: icns.length } } });
    if (u === 'https://resources.download.minecraft.net/' + hash.slice(0, 2) + '/' + hash) return { ok: true, arrayBuffer: async () => icns };
    return { ok: false, status: 404 };
  };
  const p = await mac.dockIcon({ dir, roots: [], fetch });
  assert.equal(p, path.join(dir, 'minecraft.icns'));
  assert.deepEqual(fs.readFileSync(p), icns);
  const n = calls.length;
  assert.equal(await mac.dockIcon({ dir, roots: [], fetch }), p, 'drugi raz z dysku');
  assert.equal(calls.length, n, 'bez sieci');
  // z indeksu i obiektu w folderze gry (bez sieci)
  const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'mib-dock-')), root = fs.mkdtempSync(path.join(os.tmpdir(), 'mib-root-'));
  fs.mkdirSync(path.join(root, 'assets', 'indexes'), { recursive: true });
  fs.writeFileSync(path.join(root, 'assets', 'indexes', '1.8.json'), JSON.stringify({ objects: { 'icons/minecraft.icns': { hash } } }));
  fs.mkdirSync(path.join(root, 'assets', 'objects', hash.slice(0, 2)), { recursive: true });
  fs.writeFileSync(path.join(root, 'assets', 'objects', hash.slice(0, 2), hash), icns);
  assert.equal(await mac.dockIcon({ dir: dir2, roots: [root], fetch: () => { throw new Error('sieć'); } }), path.join(dir2, 'minecraft.icns'));
  // zły plik (inny skrót) nie zostaje zapisany
  const dir3 = fs.mkdtempSync(path.join(os.tmpdir(), 'mib-dock-'));
  assert.equal(await mac.dockIcon({ dir: dir3, roots: [], fetch: async u => (u.includes('resources.download') ? { ok: true, arrayBuffer: async () => Buffer.from('icnsZLE') } : fetch(u)) }), null);
  assert.equal(fs.existsSync(path.join(dir3, 'minecraft.icns')), false);
  assert.deepEqual(mac.dockArgs(p), ['-Xdock:icon=' + p, '-Xdock:name=Minecraft']);
  assert.deepEqual(mac.dockArgs(null), ['-Xdock:name=Minecraft']);
});
