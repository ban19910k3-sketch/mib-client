// Po spakowaniu launchera (electron-builder afterPack):
// - Mac (od 0.42.0, bez konta Apple Developer): podpis „ad-hoc”. Bez żadnego podpisu Mac z procesorem Apple nie uruchomi
//   aplikacji („jest uszkodzona”). Tymczasowe części wersji universal (katalogi …-temp, łączone potem w jedną) pomija —
//   podpisuje się dopiero połączoną aplikację.
// - Linux (od 0.43.0): mib-client to mały skrypt, który uruchamia właściwy program (mib-client.bin). Gdy system blokuje
//   zwykłym programom przestrzenie nazw (Ubuntu 23.10+), sandbox Chromium nie ma jak ruszyć, a w AppImage nie da się
//   dać chrome-sandbox uprawnień setuid — wtedy (i dla roota) dodaje --no-sandbox, inaczej launcher w ogóle by nie wstał.
const { execFileSync } = require('child_process'), path = require('path'), fs = require('fs');

const LINUX_RUN = `#!/bin/sh
d=$(dirname "$(readlink -f "$0")")
if [ "$(cat /proc/sys/kernel/apparmor_restrict_unprivileged_userns 2>/dev/null)" = 1 ] || [ "$(cat /proc/sys/kernel/unprivileged_userns_clone 2>/dev/null)" = 0 ] || [ "$(id -u)" = 0 ]; then
  exec "$d/mib-client.bin" --no-sandbox "$@"
fi
exec "$d/mib-client.bin" "$@"
`;

exports.LINUX_RUN = LINUX_RUN;
exports.default = async ctx => {
  if (ctx.electronPlatformName === 'linux') {
    const exe = path.join(ctx.appOutDir, ctx.packager.executableName);
    fs.renameSync(exe, exe + '.bin');
    fs.writeFileSync(exe, LINUX_RUN, { mode: 0o755 });
    return;
  }
  if (ctx.electronPlatformName !== 'darwin' || ctx.appOutDir.endsWith('-temp')) return;
  const app = path.join(ctx.appOutDir, ctx.packager.appInfo.productFilename + '.app');
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
  execFileSync('codesign', ['--verify', '--deep', '--strict', '--verbose=2', app], { stdio: 'inherit' });
};
