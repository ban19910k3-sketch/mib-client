// Podpis „ad-hoc” launchera na Maca (od 0.42.0, bez konta Apple Developer). Bez żadnego podpisu Mac z procesorem Apple
// nie uruchomi aplikacji („jest uszkodzona”). electron-builder woła to po spakowaniu (afterPack); tymczasowe części
// wersji universal (katalogi …-temp, łączone potem w jedną) pomija — podpisuje się dopiero połączoną aplikację.
const { execFileSync } = require('child_process'), path = require('path');

exports.default = async ctx => {
  if (ctx.electronPlatformName !== 'darwin' || ctx.appOutDir.endsWith('-temp')) return;
  const app = path.join(ctx.appOutDir, ctx.packager.appInfo.productFilename + '.app');
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
  execFileSync('codesign', ['--verify', '--deep', '--strict', '--verbose=2', app], { stdio: 'inherit' });
};
