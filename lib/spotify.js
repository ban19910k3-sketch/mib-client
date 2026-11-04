// Spotify z komputera (0.40.0): utwór i sterowanie aplikacją Spotify na Windows bez logowania w MiB — przez sesje
// multimediów Windows (GlobalSystemMediaTransportControls, te same co nakładka głośności). Jeden proces PowerShell
// (Windows PowerShell 5.1, bo ma WinRT) co pół sekundy wypisuje stan jako linię JSON, a polecenia (toggle, next, prev)
// czyta ze standardowego wejścia. Bez Windows albo bez WinRT: stan „unsupported”.

// Skrypt PowerShell: Await zamienia operację WinRT na zadanie .NET; sesja Spotify to ta z identyfikatorem aplikacji
// zawierającym „Spotify”; okładka (miniatura z Windows) idzie raz na utwór jako base64.
const SCRIPT = String.raw`
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'Stop'
try {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation` + '`' + String.raw`1' })[0]
  function Await($op, [Type]$t) { $task = $asTask.MakeGenericMethod($t).Invoke($null, @($op)); [void]$task.Wait(5000); $task.Result }
  [void][Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
  [void][Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime]
  $mgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
} catch {
  [Console]::Out.WriteLine((@{ state = 'unsupported'; error = $_.Exception.Message } | ConvertTo-Json -Compress))
  exit 0
}
$ErrorActionPreference = 'Continue'
function Find-Spotify { foreach ($x in $mgr.GetSessions()) { if ($x.SourceAppUserModelId -like '*Spotify*') { return $x } }; return $null }
$stdin = New-Object System.IO.StreamReader([Console]::OpenStandardInput())
$read = $stdin.ReadLineAsync()
$lastKey = ''; $tick = 0
while ($true) {
  $force = $false
  if ($read.IsCompleted) {
    $cmd = $read.Result
    if ($null -eq $cmd) { break }
    $s = Find-Spotify
    if ($s) {
      try {
        switch ($cmd.Trim()) {
          'toggle' { [void](Await ($s.TryTogglePlayPauseAsync()) ([bool])) }
          'next' { [void](Await ($s.TrySkipNextAsync()) ([bool])) }
          'prev' { [void](Await ($s.TrySkipPreviousAsync()) ([bool])) }
        }
      } catch {}
      Start-Sleep -Milliseconds 150
    }
    $read = $stdin.ReadLineAsync(); $force = $true
  }
  if ($force -or $tick % 4 -eq 0) {
    $o = @{ state = 'off' }
    try {
      $s = Find-Spotify
      if ($s) {
        $p = Await ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
        $pb = $s.GetPlaybackInfo(); $tl = $s.GetTimelineProperties()
        $o = @{ state = $(if ([string]$pb.PlaybackStatus -eq 'Playing') { 'playing' } else { 'paused' }); title = [string]$p.Title; artist = [string]$p.Artist; album = [string]$p.AlbumTitle;
          position = [int64]$tl.Position.TotalMilliseconds; duration = [int64]$tl.EndTime.TotalMilliseconds; updated = [int64]$tl.LastUpdatedTime.ToUnixTimeMilliseconds() }
        $key = [string]$p.Title + '|' + [string]$p.Artist
        if ($key -ne $lastKey -and $p.Thumbnail) {
          try {
            $st = Await ($p.Thumbnail.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
            $size = [uint32]$st.Size
            if ($size -gt 0 -and $size -lt 2000000) {
              $r = New-Object Windows.Storage.Streams.DataReader($st.GetInputStreamAt(0))
              [void](Await ($r.LoadAsync($size)) ([uint32]))
              $bytes = New-Object byte[] $size; $r.ReadBytes($bytes)
              $o.cover = [Convert]::ToBase64String($bytes)
            }
          } catch {}
        }
        $lastKey = $key
      } else { $lastKey = '' }
    } catch { $o = @{ state = 'off' } }
    [Console]::Out.WriteLine(($o | ConvertTo-Json -Compress)); [Console]::Out.Flush()
  }
  $tick++
  Start-Sleep -Milliseconds 125
}
`;

const STATES = ['unsupported', 'off', 'playing', 'paused'];
const COMMANDS = ['toggle', 'next', 'prev'];
const str = (v, n = 200) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f§]/g, '').trim().slice(0, n) : '');
const num = v => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.round(Number(v)) : 0);

// Linia JSON od skryptu → stan { state, title, artist, album, position, duration, updated, cover? } albo null (zła linia)
function parseLine(line) {
  let j; try { j = JSON.parse(line); } catch { return null; }
  if (!j || typeof j !== 'object' || !STATES.includes(j.state)) return null;
  if (j.state !== 'playing' && j.state !== 'paused') return { state: j.state };
  const out = { state: j.state, title: str(j.title), artist: str(j.artist), album: str(j.album), position: num(j.position), duration: num(j.duration), updated: num(j.updated) };
  if (typeof j.cover === 'string' && /^[A-Za-z0-9+/=]{16,3000000}$/.test(j.cover)) out.cover = j.cover;
  return out;
}

// Pozycja utworu teraz: Windows podaje ją z chwilą ostatniej aktualizacji, więc przy odtwarzaniu dolicza się czas od tej chwili
function positionAt(s, now = Date.now()) {
  if (!s || (s.state !== 'playing' && s.state !== 'paused')) return 0;
  const p = s.state === 'playing' && s.updated ? s.position + Math.max(0, now - s.updated) : s.position;
  return s.duration ? Math.min(p, s.duration) : p;
}

// spotify.json dla moda: stan, utwór, pozycja w chwili at i plik okładki z mib/spotify
function spotifyPayload(s, cover, now = Date.now()) {
  if (!s) return JSON.stringify({ state: 'off', at: now });
  if (s.state !== 'playing' && s.state !== 'paused') return JSON.stringify({ state: s.state, at: now });
  return JSON.stringify({ state: s.state, title: s.title, artist: s.artist, album: s.album, position: positionAt(s, now), duration: s.duration, at: now,
    ...(cover ? { cover } : {}) });
}

// Prośba moda (spotify-request.json): { cmd: toggle | next | prev | open } albo null
function readSpotifyRequest(text) {
  let j; try { j = JSON.parse(text); } catch { return null; }
  return j && typeof j.cmd === 'string' && (COMMANDS.includes(j.cmd) || j.cmd === 'open') ? j.cmd : null;
}

// Proces czytający Spotify: onState(stan) przy każdej linii; send(polecenie) steruje; stop() kończy. Poza Windows od razu
// „unsupported”. Gdy PowerShell padnie, startuje znowu po 10 s (najwyżej 5 razy).
function createSpotify({ spawn = require('child_process').spawn, platform = process.platform, onState = () => {}, log = () => {} } = {}) {
  let proc = null, stopped = true, buf = '', restarts = 0, timer = null;
  const encoded = Buffer.from(SCRIPT, 'utf16le').toString('base64');
  function start() {
    stopped = false;
    if (platform !== 'win32') { onState({ state: 'unsupported' }); return; }
    if (proc) return;
    try {
      proc = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (e) { log('Spotify: ' + e.message); onState({ state: 'unsupported' }); return; }
    proc.stdout.setEncoding('utf8');
    proc.stdout.on('data', d => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        const s = line && parseLine(line);
        if (s) onState(s);
      }
      if (buf.length > 4e6) buf = '';
    });
    proc.stderr.on('data', () => {});
    proc.on('error', () => {});
    proc.on('exit', () => {
      proc = null; buf = '';
      if (!stopped && restarts++ < 5) timer = setTimeout(start, 10000);
    });
  }
  function stop() {
    stopped = true; clearTimeout(timer);
    if (proc) { try { proc.stdin.end(); } catch {} try { proc.kill(); } catch {} proc = null; }
  }
  function send(cmd) {
    if (!COMMANDS.includes(cmd) || !proc) return false;
    try { proc.stdin.write(cmd + '\n'); return true; } catch { return false; }
  }
  return { start, stop, send, get running() { return !!proc; } };
}

module.exports = { SCRIPT, parseLine, positionAt, spotifyPayload, readSpotifyRequest, createSpotify };
