// Status na Discordzie (Rich Presence) przez lokalne IPC Discorda — bez zewnętrznych bibliotek.
// Ramka: int32 LE kod operacji, int32 LE długość, JSON. 0 = handshake, 1 = polecenie/odpowiedź.
const net = require('net'), path = require('path');

const DOWNLOAD = 'https://github.com/ban19910k3-sketch/mib-client/releases/latest';

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
  if (!clientId) return { enabled: false, set() {}, stop() {} };
  let sock = null, ready = false, want, stopped = false, timer = null, nonce = 0, buf = Buffer.alloc(0);

  const send = () => {
    if (!ready || want === undefined) return;
    sock.write(encode(1, { cmd: 'SET_ACTIVITY', args: want ? { pid, activity: want } : { pid }, nonce: String(++nonce) }));
  };
  const retry = () => { if (!stopped && !timer) timer = setTimeout(() => { timer = null; connect(0); }, retryMs); };
  function connect(i) {
    if (stopped || sock) return;
    if (i > 9) return retry(); // Discord nie działa — spróbujemy później
    const s = net.createConnection(pathFor(i));
    s.once('error', () => { s.destroy(); if (sock === s) sock = null; if (!ready) connect(i + 1); });
    s.once('connect', () => {
      sock = s;
      s.write(encode(0, { v: 1, client_id: clientId }));
    });
    s.on('data', d => {
      buf = Buffer.concat([buf, d]);
      while (buf.length >= 8 && buf.length >= 8 + buf.readInt32LE(4)) {
        let msg = {};
        try { msg = JSON.parse(buf.subarray(8, 8 + buf.readInt32LE(4))); } catch {}
        buf = buf.subarray(8 + buf.readInt32LE(4));
        if (msg.evt === 'READY') { ready = true; send(); }
      }
    });
    s.on('close', () => { if (sock === s) { sock = null; ready = false; buf = Buffer.alloc(0); retry(); } });
  }
  return {
    enabled: true,
    set(activity) { want = activity; if (ready) send(); else connect(0); },
    stop() { stopped = true; clearTimeout(timer); if (sock) sock.destroy(); sock = null; },
  };
}

module.exports = { buildActivity, createPresence, encode };
