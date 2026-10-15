const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net'), path = require('node:path'), os = require('node:os'), fs = require('node:fs');
const { diagnoseCrash } = require('../lib/crash');
const { buildActivity, createPresence, encode } = require('../lib/discord');
const { pngInfo, validCapeSize } = require('../lib/profile');

test('diagnoseCrash recognizes common causes', () => {
  assert.equal(diagnoseCrash('Exception in thread "main" java.lang.OutOfMemoryError: Java heap space'), 'memory');
  assert.equal(diagnoseCrash('java.lang.UnsupportedClassVersionError: net/minecraft/client/main/Main has been compiled by a more recent version'), 'java');
  assert.equal(diagnoseCrash('Error: Could not create the Java Virtual Machine.\nInvalid maximum heap size: -Xmx99999G'), 'jvm');
  assert.equal(diagnoseCrash('net.fabricmc.loader.impl.FormattedException: Mod resolution encountered an incompatible mod set!'), 'mods');
  assert.equal(diagnoseCrash('Caused by: net.minecraftforge.fml.common.MissingModsException: Mod sodium requires fabric-api'), 'mods');
  assert.equal(diagnoseCrash('GLFW error 65542: WGL: The driver does not appear to support OpenGL'), 'gpu');
  assert.equal(diagnoseCrash('org.lwjgl.LWJGLException: Pixel format not accelerated'), 'gpu');
  assert.equal(diagnoseCrash('some random line'), 'unknown');
  assert.equal(diagnoseCrash(''), 'unknown');
});

test('buildActivity for launcher and game', () => {
  const l = buildActivity({ playing: false, since: 1000 });
  assert.equal(l.details, 'W launcherze');
  assert.equal(l.timestamps.start, 1000); // Discord: milisekundy
  assert.equal(l.assets.large_image, 'mib');
  assert.equal(l.buttons[0].url, 'https://github.com/ban19910k3-sketch/mib-client/releases/latest');
  const g = buildActivity({ playing: true, version: '1.8.9', since: 5000 });
  assert.equal(g.details, 'Gra w Minecraft 1.8.9');
  assert.equal(g.timestamps.start, 5000);
});

test('encode frames like Discord IPC', () => {
  const b = encode(1, { a: 1 });
  assert.equal(b.readInt32LE(0), 1);
  assert.equal(b.readInt32LE(4), 7);
  assert.equal(b.subarray(8).toString(), '{"a":1}');
});

// Atrapa klienta Discorda na gnieździe: odbiera handshake, odpowiada READY, zapisuje aktywności
function fakeDiscord(file) {
  const got = [];
  const server = net.createServer(sock => {
    let buf = Buffer.alloc(0);
    sock.on('data', d => {
      buf = Buffer.concat([buf, d]);
      while (buf.length >= 8 && buf.length >= 8 + buf.readInt32LE(4)) {
        const op = buf.readInt32LE(0), len = buf.readInt32LE(4), msg = JSON.parse(buf.subarray(8, 8 + len));
        buf = buf.subarray(8 + len);
        got.push({ op, msg });
        if (op === 0) sock.write(encode(1, { cmd: 'DISPATCH', evt: 'READY', data: {} }));
      }
    });
  });
  return new Promise(r => server.listen(file, () => r({ server, got })));
}

test('presence connects, sends the handshake and the activity, and clears it', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dc-')), file = path.join(dir, 'discord-ipc-0');
  const { server, got } = await fakeDiscord(file);
  const p = createPresence({ clientId: '123', pathFor: i => (i === 0 ? file : path.join(dir, 'none-' + i)), pid: 42 });
  p.set(buildActivity({ playing: true, version: '1.8.9', since: 0 }));
  await new Promise(r => setTimeout(r, 300));
  p.set(null);
  await new Promise(r => setTimeout(r, 200));
  p.stop();
  server.close();
  assert.deepEqual(got[0], { op: 0, msg: { v: 1, client_id: '123' } });
  const acts = got.filter(g => g.msg.cmd === 'SET_ACTIVITY');
  assert.equal(acts[0].msg.args.pid, 42);
  assert.equal(acts[0].msg.args.activity.details, 'Gra w Minecraft 1.8.9');
  assert.equal(acts.at(-1).msg.args.activity, undefined, 'wyczyszczenie statusu');
});

test('presence without Discord running fails silently', async () => {
  const p = createPresence({ clientId: '123', pathFor: i => path.join(os.tmpdir(), 'brak-discorda-' + process.pid + '-' + i), retryMs: 50 });
  p.set(buildActivity({ playing: false, since: 0 }));
  await new Promise(r => setTimeout(r, 200));
  p.stop();
});

test('presence is disabled without a client id', () => {
  const p = createPresence({ clientId: '' });
  assert.equal(p.enabled, false);
  p.set({});
  p.stop();
});

// PNG: 8 bajtów sygnatury, potem chunk IHDR z szerokością i wysokością
const png = (w, h) => { const b = Buffer.alloc(33); Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b); b.write('IHDR', 12); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); return b; };

test('pngInfo and cape sizes', () => {
  assert.deepEqual(pngInfo(png(64, 32)), { width: 64, height: 32 });
  assert.equal(pngInfo(Buffer.from('nie png')), null);
  assert.equal(validCapeSize(64, 32), true);
  assert.equal(validCapeSize(128, 64), true);
  assert.equal(validCapeSize(22, 17), false);
  assert.equal(validCapeSize(64, 64), false);
  assert.equal(validCapeSize(1024, 512), false);
});
