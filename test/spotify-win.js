// Test skryptu Spotify na prawdziwym Windows (workflow „Spotify (Windows)”): PowerShell z WinRT musi się uruchomić,
// wypisywać poprawne linie stanu i przyjąć polecenie bez padnięcia. Na serwerze CI nie ma Spotify, więc stan to „off”
// (albo „unsupported”, gdy system nie ma sesji multimediów — wtedy wypisuje powód).
const { spawn } = require('child_process');
const { SCRIPT, parseLine } = require('../lib/spotify');
const p = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from(SCRIPT, 'utf16le').toString('base64')], { stdio: ['pipe', 'pipe', 'pipe'] });
let out = '', err = '';
p.stdout.on('data', d => { out += d; process.stdout.write('[stdout] ' + d); });
p.stderr.on('data', d => { err += d; process.stdout.write('[stderr] ' + d); });
setTimeout(() => p.stdin.write('toggle\n'), 5000);
setTimeout(() => p.stdin.write('next\n'), 6000);
setTimeout(() => {
  const alive = p.exitCode === null;
  p.stdin.end(); p.kill();
  const lines = out.split(/\r?\n/).filter(Boolean), states = lines.map(parseLine);
  console.log('linie:', lines.length, 'stany:', states.map(s => s && s.state).join(','));
  if (!lines.length || states.some(s => !s)) { console.error('::error::skrypt Spotify nie wypisał poprawnych linii stanu'); process.exit(1); }
  if (states[0].state === 'unsupported') { console.log('::warning::WinRT niedostępne na tym systemie: ' + lines[0]); process.exit(0); }
  if (!alive) { console.error('::error::skrypt Spotify padł po poleceniu'); process.exit(1); }
  if (lines.length < 5) { console.error('::error::za mało linii stanu (' + lines.length + ')'); process.exit(1); }
  console.log('ok');
  process.exit(0);
}, 12000);
