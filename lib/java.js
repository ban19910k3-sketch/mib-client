// Java dla gry pobierana automatycznie (Eclipse Temurin z Adoptium), na Windows, Macu i Linuksie (od 0.42.0 także Mac).
// Windows: zip z bin/java.exe; Mac: tar.gz z Contents/Home/bin/java; Linux: tar.gz z bin/java.
const path = require('path');

// Plik do pobrania dla systemu i procesora: adres, rodzaj archiwum i ścieżka do java w rozpakowanym katalogu
function javaAsset(major, platform = process.platform, arch = process.arch) {
  const os = platform === 'win32' ? 'windows' : platform === 'darwin' ? 'mac' : 'linux';
  const a = arch === 'arm64' ? 'aarch64' : 'x64';
  return {
    url: 'https://api.adoptium.net/v3/binary/latest/' + major + '/ga/' + os + '/' + a + '/jre/hotspot/normal/eclipse',
    archive: os === 'windows' ? 'zip' : 'tar.gz',
    bin: os === 'windows' ? ['bin', 'java.exe'] : os === 'mac' ? ['Contents', 'Home', 'bin', 'java'] : ['bin', 'java'],
  };
}

// java w katalogu base (jeden podkatalog na rozpakowaną Javę) albo null
function findJava(base, bin, fs = require('fs')) {
  try {
    for (const d of fs.readdirSync(base)) {
      const p = path.join(base, d, ...bin);
      if (fs.existsSync(p)) return p;
    }
  } catch {}
  return null;
}

// Pobiera i rozpakowuje Javę major do base (raz); zwraca ścieżkę do java. Na Macu z procesorem Apple, gdy nie ma wersji
// na arm64 (np. Java 8), bierze wersję na Intela (działa przez Rosettę).
async function ensureJava({ base, major, fetch, log = () => {}, platform = process.platform, arch = process.arch, fs = require('fs'),
  run = (cmd, args) => new Promise((ok, no) => require('child_process').execFile(cmd, args, e => (e ? no(e) : ok()))) }) {
  let asset = javaAsset(major, platform, arch);
  let p = findJava(base, asset.bin, fs);
  if (p) return p;
  log('Pobieranie Javy ' + major + ' (jednorazowo, ok. 50 MB)…');
  let r = await fetch(asset.url);
  if (!r.ok && platform === 'darwin' && arch === 'arm64') {
    asset = javaAsset(major, platform, 'x64');
    r = await fetch(asset.url);
  }
  if (!r.ok) throw new Error('nie udało się pobrać Javy (kod ' + r.status + ')');
  fs.mkdirSync(base, { recursive: true });
  const buf = Buffer.from(await r.arrayBuffer());
  if (asset.archive === 'zip') {
    const AdmZip = require('adm-zip');
    new AdmZip(buf).extractAllTo(base, true);
  } else {
    const file = path.join(base, 'java.tar.gz');
    fs.writeFileSync(file, buf);
    try { await run('tar', ['-xzf', file, '-C', base]); } finally { try { fs.unlinkSync(file); } catch {} }
  }
  p = findJava(base, asset.bin, fs);
  if (!p) throw new Error('nie znaleziono Javy po rozpakowaniu');
  if (platform !== 'win32') { try { fs.chmodSync(p, 0o755); } catch {} }
  log('Java ' + major + ' gotowa.');
  return p;
}

module.exports = { javaAsset, findJava, ensureJava };
