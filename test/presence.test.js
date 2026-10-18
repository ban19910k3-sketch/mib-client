const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), os = require('os'), path = require('path');
const { createMibPresence, JOIN_URL } = require('../lib/presence');
const m = require('../lib/mibmod');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mibp-'));
const PNG = 'data:image/png;base64,' + Buffer.from('png!').toString('base64');

function fakeApi(over = {}) {
  const calls = [];
  const api = {
    calls,
    async mibHello(a) { calls.push(['hello', a]); return { uuid: '33333333-3333-4333-8333-333333333333', name: a.name, token: 'tok' }; },
    async mibPing(a) { calls.push(['ping', a]); return true; },
    async mibWho(a) { calls.push(['who', a]); return [{ uuid: '33333333-3333-4333-8333-333333333333', name: 'Gracz', cape: 'cape_a' }, { uuid: '44444444-4444-4444-8444-444444444444', name: 'Inny', cape: null }]; },
    async capeTextures(a) { calls.push(['tex', a]); return [{ id: 'cape_a', texture: PNG }, { id: '../zly', texture: PNG }]; },
    ...over,
  };
  return api;
}

test('start: Mojang potwierdza konto (join), token Minecrafta nie trafia do bazy', async () => {
  const sent = [];
  const fetch = async (url, opt) => { sent.push({ url, body: JSON.parse(opt.body) }); return { status: 204, ok: true }; };
  const api = fakeApi();
  const p = createMibPresence({ fetch, api, randomBytes: n => Buffer.alloc(n, 0xab), pingMs: 60000 });
  assert.strictEqual(await p.start({ access_token: 'SEKRET', uuid: '3333-3333', name: 'Gracz' }), true);
  assert.strictEqual(sent[0].url, JOIN_URL);
  assert.deepStrictEqual(sent[0].body, { accessToken: 'SEKRET', selectedProfile: '33333333', serverId: 'ab'.repeat(16) });
  assert.deepStrictEqual(api.calls[0], ['hello', { name: 'Gracz', serverId: 'ab'.repeat(16) }]);
  assert.ok(!JSON.stringify(api.calls).includes('SEKRET'), 'token Minecrafta tylko do Mojanga');
  assert.strictEqual(p.active, true);
  await p.stop();
  assert.deepStrictEqual(api.calls.at(-1), ['ping', { uuid: '33333333-3333-4333-8333-333333333333', token: 'tok', online: false }]);
  assert.strictEqual(p.active, false);
});

test('start: błąd Mojanga albo bazy rzuca dalej, zły nick bez zgłoszenia', async () => {
  const api = fakeApi();
  const bad = createMibPresence({ fetch: async () => ({ status: 403, ok: false }), api, randomBytes: n => Buffer.alloc(n) });
  await assert.rejects(bad.start({ access_token: 'x', uuid: 'u', name: 'Gracz' }), /Mojang 403/);
  const noDb = createMibPresence({ fetch: async () => ({ status: 204 }), api: fakeApi({ async mibHello() { return { error: 'schema_outdated' }; } }), randomBytes: n => Buffer.alloc(n) });
  await assert.rejects(noDb.start({ access_token: 'x', uuid: 'u', name: 'Gracz' }), /schema_outdated/);
  let called = false;
  const p = createMibPresence({ fetch: async () => { called = true; return { status: 204 }; }, api, randomBytes: n => Buffer.alloc(n) });
  assert.strictEqual(await p.start({ access_token: 'x', uuid: 'u', name: 'zły nick!' }), false);
  assert.strictEqual(called, false);
});

test('players: gracze MiB i pobrane tekstury peleryn (tylko bezpieczne nazwy, odświeżane po godzinie)', async () => {
  const dir = tmp(), capes = path.join(dir, 'capes');
  let t = 1_000_000;
  const api = fakeApi();
  const p = createMibPresence({ fetch: async () => ({}), api, randomBytes: n => Buffer.alloc(n), now: () => t });
  assert.deepStrictEqual(await p.players({ ids: [], names: [] }, capes), []);
  const rows = await p.players({ ids: ['33333333-3333-4333-8333-333333333333'], names: ['Inny'] }, capes);
  assert.strictEqual(rows.length, 2);
  assert.strictEqual(fs.readFileSync(path.join(capes, 'cape_a.png'), 'utf8'), 'png!');
  assert.ok(!fs.existsSync(path.join(dir, 'zly.png')));
  assert.deepStrictEqual(api.calls.filter(c => c[0] === 'tex').length, 1);
  t = fs.statSync(path.join(capes, 'cape_a.png')).mtimeMs + 1000;
  await p.players({ ids: ['33333333-3333-4333-8333-333333333333'], names: [] }, capes);
  assert.strictEqual(api.calls.filter(c => c[0] === 'tex').length, 1, 'świeża tekstura nie jest pobierana drugi raz');
  t += 3600_000;
  await p.players({ ids: ['33333333-3333-4333-8333-333333333333'], names: [] }, capes);
  assert.strictEqual(api.calls.filter(c => c[0] === 'tex').length, 2);
  const off = createMibPresence({ fetch: async () => ({}), api: fakeApi({ async mibWho() { return { error: 'offline' }; } }), randomBytes: n => Buffer.alloc(n) });
  assert.strictEqual(await off.players({ ids: ['33333333-3333-4333-8333-333333333333'], names: [] }, capes), null);
});

test('most: żądanie graczy z gry -> players.json, tylko poprawne dane', async () => {
  assert.deepStrictEqual(m.readPlayersRequest('{"ids":["33333333-3333-4333-8333-33333333333A","zly"],"names":["Gracz","zły nick",7]}'),
    { ids: ['33333333-3333-4333-8333-33333333333a'], names: ['Gracz'] });
  assert.strictEqual(m.readPlayersRequest('[1]'), null);
  assert.strictEqual(m.readPlayersRequest('zepsuty'), null);
  assert.deepStrictEqual(JSON.parse(m.playersPayload([{ uuid: '33333333-3333-4333-8333-333333333333', name: 'Gracz', cape: '../x' }, { uuid: 'zly', name: 'A' }])),
    { players: [{ uuid: '33333333-3333-4333-8333-333333333333', name: 'Gracz', cape: null, hat: null, wings: null }] });

  const dir = tmp();
  const asked = [];
  const b = m.createBridge({ dir, accounts: () => ({ list: [] }), onSwitch: async () => {}, intervalMs: 60000, refreshEvery: 1000,
    players: async req => { asked.push(req); return [{ uuid: '33333333-3333-4333-8333-333333333333', name: 'Gracz', cape: 'cape_a' }]; } });
  fs.writeFileSync(path.join(dir, 'players.json'), 'stary');
  b.start(); b.stop();
  assert.ok(!fs.existsSync(path.join(dir, 'players.json')), 'gracze z poprzedniej sesji usunięci przy starcie');
  await b.pollOnce();
  assert.strictEqual(asked.length, 0, 'bez żądania z gry bez pytania');
  fs.writeFileSync(path.join(dir, 'players-request.json'), '{"ids":["33333333-3333-4333-8333-333333333333"],"names":[]}');
  await b.pollOnce();
  await b.pollOnce();
  assert.strictEqual(asked.length, 1, 'ta sama lista: jedno pytanie');
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(dir, 'players.json'), 'utf8')).players[0].cape, 'cape_a');
  fs.writeFileSync(path.join(dir, 'players-request.json'), '{"ids":[],"names":["Inny"]}');
  await b.pollOnce();
  assert.deepStrictEqual(asked[1], { ids: [], names: ['Inny'] });
});
