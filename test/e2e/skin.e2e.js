// Postać 3D w Kosmetykach na każdym systemie (od 0.47.3; zadanie „skin” w desktop.yml: Linux, Windows, Mac z Apple i z Intelem).
// Gracz z kontem Microsoft (atrapa msmc przez MIB_TEST_HOOKS, Mojang przez podmieniony fetch) i profilem MiB w pelerynie
// wchodzi w Kosmetyki, klika filtry i zakładki i 20 razy otwiera okno zakupu. Każda klatka postaci jest liczona prosto
// z WebGL (piksele postaci w trzech wierszach), a zrzuty pokazują, co widać w oknie. Postać nie może zniknąć ani stracić
// kontekstu WebGL, skin i peleryna wczytują się raz, a Mojang dostaje jedno pytanie o skin.
// Uruchomienie: node test/e2e/skin.e2e.js (na Linuksie przez xvfb-run -a). Wynik też jako adnotacja przebiegu.
const assert = require('assert'), path = require('path'), fs = require('fs'), os = require('os'), zlib = require('zlib');
const { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const { _electron } = require(execSync('npm root -g').toString().trim() + '/playwright');
const { createFake } = require('../fake-supabase');
const SYS = { darwin: 'Mac', win32: 'Windows', linux: 'Linux' }[process.platform] || process.platform;

function png(w, h, px) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set(px(x, y), y * (w * 4 + 1) + 1 + x * 4);
  const crc = b => { let c = ~0; for (const v of b) { c ^= v; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1; } return ~c >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4), c = Buffer.alloc(4), td = Buffer.concat([Buffer.from(t), d]); l.writeUInt32BE(d.length); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

(async () => {
  const fake = createFake();
  await new Promise(r => fake.server.listen(0, '127.0.0.1', r));
  for (const t of fake.st.themes || []) t.enabled = false; // zwykły wygląd: tło bez zieleni
  const NAME = 'Gracz', UUID = '5e1f2c3d4b5a69788796a5b4c3d2e1f0';
  fake.st.mojang = { [NAME]: UUID };
  // zielony skin (tło launchera jest fioletowe), peleryna z dwiema klatkami
  const skin = png(64, 64, () => [20, 220, 40, 255]).toString('base64');
  const cape = 'data:image/png;base64,' + png(64, 64, (x, y) => [120, 40 + (y >= 32 ? 100 : 0), 200, 255]).toString('base64');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'mib-skin-'));
  const app = await _electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', ROOT],
    env: { ...process.env, MIB_TEST_HOOKS: '1', MIB_SUPA_URL: 'http://127.0.0.1:' + fake.server.address().port, XDG_CONFIG_HOME: home } });
  const errors = [];
  try {
    await app.evaluate((_, { name, uuid, skin }) => {
      const msmc = globalThis.__mibRequire('msmc');
      const mc = { profile: { id: uuid, name, skins: [] }, validate: () => true, mclc: () => ({ access_token: 'mc-token', client_token: 'c', uuid, name, meta: { type: 'msa', demo: false } }) };
      const xbox = { getMinecraft: async () => mc, save: () => 'msmc-refresh-' + name };
      msmc.Auth.prototype.launch = async function () { return xbox; };
      msmc.Auth.prototype.refresh = async function () { return xbox; };
      const f = globalThis.fetch, buf = Buffer.from(skin, 'base64');
      globalThis.__mojang = 0;
      globalThis.fetch = (u, o) => {
        u = String(u);
        if (u.startsWith('https://sessionserver.mojang.com/')) return Promise.resolve(new Response(null, { status: 204 }));
        if (u.endsWith('/minecraft/profile')) { globalThis.__mojang++; return Promise.resolve(new Response(JSON.stringify({ id: uuid, name, skins: [{ state: 'ACTIVE', url: 'https://textures.minecraft.net/texture/mib', variant: 'CLASSIC' }] }), { status: 200, headers: { 'content-type': 'application/json' } })); }
        if (u.startsWith('https://textures.minecraft.net/') || u.startsWith('https://mc-heads.net/')) return Promise.resolve(new Response(buf, { status: 200 }));
        return f(u, o);
      };
    }, { name: NAME, uuid: UUID, skin });
    const w = await app.firstWindow();
    w.on('pageerror', e => errors.push(e.message));
    await w.setViewportSize({ width: 1280, height: 760 }).catch(() => {});
    await w.waitForSelector('#app.on', { timeout: 30000 });
    await w.click('#w-go', { timeout: 5000 }).catch(() => {});
    await w.waitForSelector('#gate.on #g-go', { timeout: 20000 });
    await w.click('#g-go');
    let st = null;
    for (const end = Date.now() + 30000; Date.now() < end && !(st && st.state === 'ok'); await new Promise(r => setTimeout(r, 250))) st = await w.evaluate(() => window.mib.call('profile:status'));
    assert.equal(st && st.state, 'ok', 'profil MiB po zalogowaniu: ' + JSON.stringify(st));
    const u = fake.st.users[0];
    fake.cosmetics.cape_start.texture = cape;
    fake.cosmetics.cape_view = { id: 'cape_view', name: 'Peleryna podgląd', type: 'cape', image_url: null, price: 50, texture: cape };
    fake.st.owned.push({ user: u.id, cosmetic: 'cape_start', at: new Date().toISOString() });
    u.equipped = { cape: 'cape_start' };
    // każda klatka postaci w Kosmetykach: piksele postaci w trzech wierszach, odczytane zaraz po rysowaniu
    await w.evaluate(() => {
      const P = skinview3d.SkinViewer.prototype, r0 = P.render, s = window.__s = { frames: [], skin: 0, cape: 0, lost: 0 };
      P.render = function () {
        r0.call(this);
        if (this.canvas.id !== 'skin3d' || !s.on) return;
        const gl = this.renderer.getContext(), W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, px = new Uint8Array(W * 4);
        let n = 0;
        for (const y of [0.3, 0.5, 0.7]) { gl.readPixels(0, Math.floor(H * y), W, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); for (let i = 3; i < px.length; i += 4) if (px[i] > 0) n++; }
        s.frames.push(n);
      };
      const l0 = P.loadSkin, c0 = P.loadCape;
      P.loadSkin = function (src, o) { if (this.canvas.id === 'skin3d' && typeof src === 'string') s.skin++; return l0.call(this, src, o); };
      P.loadCape = function (src, o) { if (this.canvas.id === 'skin3d') s.cape++; return c0.call(this, src, o); };
      document.addEventListener('webglcontextlost', e => { if (e.target.id === 'skin3d') s.lost++; }, true);
    });
    await w.click('#side .nav[data-p="cos"]:not([data-tab="shop"])');
    await w.waitForFunction(() => { const c = document.getElementById('skin3d'); return c && c.dataset.back === 'cape'; }, null, { timeout: 20000 });
    await w.waitForTimeout(1500);
    // od teraz liczymy: wejście w Kosmetyki wczytało skin i pelerynę po razie
    await w.evaluate(() => Object.assign(window.__s, { on: true, skin: 0, cape: 0 }));
    // co widać w oknie: zielone piksele postaci na zrzucie płótna
    const visible = async () => {
      const b64 = (await w.locator('#skin3d').screenshot()).toString('base64');
      return app.evaluate(({ nativeImage }, b) => { const d = nativeImage.createFromBuffer(Buffer.from(b, 'base64')).toBitmap(); let n = 0; for (let k = 0; k < d.length; k += 4) if (d[k + 1] > 90 && d[k + 1] > d[k] * 1.6 && d[k + 1] > d[k + 2] * 1.6) n++; return n; }, b64);
    };
    const shots = [];
    for (const sel of ['#cos-kinds .kind[data-k="cape"]', '#cos-kinds .kind[data-k="all"]', '#cos-tabs [data-t="skin"]', '#cos-tabs [data-t="mine"]', '#cos-tabs [data-t="log"]', '#cos-tabs [data-t="mine"]']) {
      await w.click(sel);
      for (let i = 0; i < 4; i++) { shots.push(await visible()); await w.waitForTimeout(120); }
    }
    await w.click('#cos-tabs [data-t="shop"]');
    await w.waitForSelector('#shop-grid .cosi[data-id="cape_view"]');
    for (let i = 0; i < 20; i++) {
      await w.click('#shop-grid .cosi[data-id="cape_view"] button:has-text("Kup")');
      await w.waitForSelector('#buy canvas');
      await w.waitForTimeout(200);
      await w.press('#buy', 'Escape');
      await w.waitForSelector('#buy', { state: 'detached' });
    }
    await w.click('#cos-tabs [data-t="mine"]');
    await w.waitForSelector('#cos-code');
    await w.waitForTimeout(1500);
    for (let i = 0; i < 6; i++) { shots.push(await visible()); await w.waitForTimeout(150); }
    const s = await w.evaluate(() => ({ ...window.__s, frames: window.__s.frames }));
    const glLost = await w.$eval('#skin3d', c => { const g = c.getContext('webgl2') || c.getContext('webgl'); return !g || g.isContextLost(); });
    const mojang = await app.evaluate(() => globalThis.__mojang);
    const fr = s.frames, med = fr.slice().sort((a, b) => a - b)[fr.length >> 1] || 0, blank = fr.filter(n => n < med * 0.25).length;
    const info = { frames: fr.length, median: med, blankFrames: blank, minShot: Math.min(...shots), shots: shots.length, skinLoads: s.skin, capeLoads: s.cape, contextLost: s.lost, glLost, mojang, errors };
    console.log('::notice::Postać 3D w Kosmetykach (' + SYS + '): ' + JSON.stringify(info));
    await w.screenshot({ path: path.join(home, 'kosmetyki.png') }).catch(() => {});
    assert.ok(fr.length > 60 && med > 50, 'postać rysuje się w Kosmetykach: ' + JSON.stringify(info));
    assert.equal(blank, 0, 'żadna klatka bez postaci');
    assert.ok(Math.min(...shots) > 100, 'postać widać na każdym zrzucie: ' + shots.join(','));
    assert.equal(s.lost, 0, 'postać nie traci kontekstu WebGL po 20 oknach zakupu');
    assert.equal(glLost, false);
    assert.equal(s.skin, 0, 'filtr, zakładki i okna zakupu nie wczytują skina od nowa');
    assert.equal(s.cape, 0, 'ani peleryny');
    assert.equal(mojang, 1, 'jedno pytanie do Mojanga o skin (zapamiętany na 5 minut)');
    assert.deepEqual(errors, []);
    console.log('ok postać 3D w Kosmetykach na ' + SYS);
  } finally {
    await app.close().catch(() => {});
    fake.server.close();
  }
  process.exit(0);
})().catch(e => { console.error('::error::Postać 3D w Kosmetykach (' + SYS + '): ' + String(e && e.message || e).split('\n')[0]); console.error(e); process.exit(1); });
