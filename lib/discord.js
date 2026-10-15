// Status na Discordzie (Rich Presence) przez lokalne IPC Discorda — bez zewnętrznych bibliotek.
// Ramka: int32 LE kod operacji, int32 LE długość, JSON. 0 = handshake, 1 = polecenie/odpowiedź.
// Zasada: nic tutaj nie może rzucić wyjątku ani zawiesić launchera — Discord jest dodatkiem.
const net = require('net'), path = require('path');

const DOWNLOAD = 'https://github.com/ban19910k3-sketch/mib-client/releases/latest';
const MAX_FRAME = 64 * 1024;

function encode(op, data) {
  const json = Buffer.from(JSON.stringify(data)), head = Buffer.alloc(8);
  head.writeInt32LE(op, 0);
  head.writeInt32LE(json.length, 4);
  return Buffer.concat([head, json]);
}

const ipcPath = i => (process.platform === 'win32' ? '\\\\?\\pipe\\discord-ipc-' + i
  : path.join(process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || '/tmp', 'discord-ipc-' + i));

// since: znacznik czasu w ms (Discord pokazuje „upłynęło”)
function buildActivity({ playing, version, since }) {
  return {
    details: playing ? 'Gra w Minecraft ' + version : 'W launcherze',
    state: 'MiB Client',
    timestamps: { start: since },
    assets: { large_image: 'mib', large_text: 'MiB Client' },
    buttons: [{ label: 'Pobierz MiB Client', url: DOWNLOAD }],
  };
}

function createPresence({ clientId, pathFor = ipcPath, pid = process.pid, retryMs = 30000 }) {
  if (!clientId) return { enabled: false, set() {}, off() {}, stop() {} };
  // gen: każde wyłączenie unieważnia stare gniazda i ich zdarzenia
  let sock = null, ready = false, connecting = false, active = false, stopped = false, timer = null, nonce = 0, gen = 0, want;

  const send = () => {
    if (!ready || !sock || want === undefined) return;
    try { sock.write(encode(1, { cmd: 'SET_ACTIVITY', args: want ? { pid, activity: want } : { pid }, nonce: String(++nonce) })); }
    catch { sock.destroy(); }
  };
  const retry = () => { if (!stopped && active && !timer) timer = setTimeout(() => { timer = null; connect(0); }, retryMs); };

  function connect(i) {
    if (stopped || !active || sock || connecting) return;
    if (i > 9) return retry(); // Discord nie działa — spróbujemy później
    connecting = true;
    const my = gen, s = net.createConnection(pathFor(i));
    let buf = Buffer.alloc(0), opened = false;
    s.on('error', () => {}); // resztę załatwia 'close'
    s.once('connect', () => {
      if (my !== gen) return s.destroy();
      opened = true; connecting = false; sock = s;
      try { s.write(encode(0, { v: 1, client_id: clientId })); } catch { s.destroy(); }
    });
    s.on('data', d => {
      buf = Buffer.concat([buf, d]);
      while (buf.length >= 8) {
        const len = buf.readInt32LE(4);
        if (len < 0 || len > MAX_FRAME) { buf = Buffer.alloc(0); return s.destroy(); } // uszkodzona ramka
        if (buf.length < 8 + len) break;
        let msg = {};
        try { msg = JSON.parse(buf.subarray(8, 8 + len)); } catch {}
        buf = buf.subarray(8 + len);
        if (msg.evt === 'READY' && s === sock) { ready = true; send(); }
      }
    });
    s.on('close', () => {
      if (my !== gen) return;
      if (!opened) { connecting = false; return connect(i + 1); } // spróbuj następnego numeru gniazda
      if (sock === s) { sock = null; ready = false; }
      retry();
    });
  }

  function off() {
    active = false; want = undefined; gen++;
    clearTimeout(timer); timer = null;
    if (sock) sock.destroy();
    sock = null; ready = false; connecting = false;
  }
  return {
    enabled: true,
    set(activity) { want = activity; active = true; if (ready) send(); else connect(0); },
    off, // wyłączony status: żadnego połączenia z Discordem
    stop() { stopped = true; off(); },
  };
}

module.exports = { buildActivity, createPresence, encode };
