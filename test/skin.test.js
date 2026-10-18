const test = require('node:test');
const assert = require('node:assert');
const s = require('../lib/skin');

// Nagłówek PNG z podanym rozmiarem (do sprawdzania wymiarów wystarczy IHDR)
function png(w, h, extra = 0) {
  const b = Buffer.alloc(33 + extra);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b);
  b.writeUInt32BE(13, 8); b.write('IHDR', 12); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20);
  return b;
}

test('checkSkin: tylko PNG 64×64 albo 64×32 do 256 KB', () => {
  assert.strictEqual(s.checkSkin(png(64, 64)), null);
  assert.strictEqual(s.checkSkin(png(64, 32)), null);
  assert.strictEqual(s.checkSkin(png(128, 128)), 'skin_size');
  assert.strictEqual(s.checkSkin(Buffer.from('nie png')), 'skin_not_png');
  assert.strictEqual(s.checkSkin(png(64, 64, s.MAX_BYTES)), 'skin_too_big');
});

test('guessVariant: przezroczyste piksele ramienia = smukły', () => {
  const bgra = Buffer.alloc(64 * 64 * 4, 255);
  assert.strictEqual(s.guessVariant(bgra, 64, 64), 'classic');
  for (let y = 20; y < 32; y++) for (let x = 54; x < 56; x++) bgra[(y * 64 + x) * 4 + 3] = 0;
  assert.strictEqual(s.guessVariant(bgra, 64, 64), 'slim');
  assert.strictEqual(s.guessVariant(bgra, 64, 32), 'classic', 'stary format zawsze klasyczny');
});

test('uploadSkin i currentSkin: token tylko w nagłówku do API Mojanga', async () => {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init });
    if (init.method === 'POST') return { ok: true, status: 200, json: async () => ({ skins: [{ state: 'ACTIVE', url: 'http://textures/x', variant: 'SLIM' }] }) };
    return { ok: true, status: 200, json: async () => ({ skins: [{ state: 'INACTIVE', url: 'a' }, { state: 'ACTIVE', url: 'http://textures/x', variant: 'SLIM' }] }) };
  };
  await s.uploadSkin({ fetch, token: 'TOKEN', png: png(64, 64), variant: 'slim' });
  assert.strictEqual(calls[0].url, 'https://api.minecraftservices.com/minecraft/profile/skins');
  assert.strictEqual(calls[0].init.headers.Authorization, 'Bearer TOKEN');
  assert.strictEqual(calls[0].init.body.get('variant'), 'slim');
  assert.ok(calls[0].init.body.get('file') instanceof Blob);
  const cur = await s.currentSkin({ fetch, token: 'TOKEN' });
  assert.deepStrictEqual({ url: cur.url, variant: cur.variant }, { url: 'http://textures/x', variant: 'slim' });
  await assert.rejects(s.uploadSkin({ fetch, token: 'TOKEN', png: png(32, 32) }), e => e.code === 'skin_size');
  assert.strictEqual(calls.length, 2, 'zły plik nie trafia do Mojanga');
});

test('błędy Mojanga mają kody', async () => {
  const fetch = status => async () => ({ ok: false, status, json: async () => ({}) });
  await assert.rejects(s.resetSkin({ fetch: fetch(401), token: 'x' }), e => e.code === 'skin_auth');
  await assert.rejects(s.resetSkin({ fetch: fetch(429), token: 'x' }), e => e.code === 'skin_rate');
  await assert.rejects(s.resetSkin({ fetch: fetch(500), token: 'x' }), e => e.code === 'skin_failed');
});
