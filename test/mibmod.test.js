const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), os = require('os'), path = require('path');
const m = require('../lib/mibmod');

const T = m.TARGETS['1.21.11'];
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mibmod-'));

test('planMod: kiedy wgrać mod MiB', () => {
  assert.deepStrictEqual(m.planMod({ gv: '1.21.11', loader: null, enabled: true, jarExists: true }), { use: true, target: T });
  assert.strictEqual(m.planMod({ gv: '1.21.11', loader: 'fabric', enabled: true, jarExists: true }).use, true);
  assert.deepStrictEqual(m.planMod({ gv: '1.21.11', loader: 'forge', enabled: true, jarExists: true }), { use: false, reason: 'loader_conflict' });
  assert.deepStrictEqual(m.planMod({ gv: '1.21.11', loader: null, enabled: false, jarExists: true }), { use: false, reason: 'off' });
  assert.deepStrictEqual(m.planMod({ gv: '1.8.9', loader: null, enabled: true, jarExists: true }), { use: false, reason: 'unsupported' });
  assert.deepStrictEqual(m.planMod({ gv: '1.21.11', loader: null, enabled: true, jarExists: false }), { use: false, reason: 'missing_jar' });
});

test('TARGETS: wszystkie wersje od 1.21 do 26.3, te same co mod/versions', () => {
  const dirs = fs.readdirSync(path.join(__dirname, '..', 'mod', 'versions')).sort();
  assert.deepStrictEqual([...m.VERSIONS].sort(), dirs);
  for (const v of m.VERSIONS) assert.strictEqual(m.TARGETS[v].jar, 'mib-mod-fabric-' + v + '.jar');
  for (const v of ['1.21', '1.21.5', '1.21.11', '26.1', '26.3']) assert.strictEqual(m.planMod({ gv: v, loader: null, enabled: true, jarExists: true }).use, true);
  for (const v of ['1.20.6', '1.8.9', '26.4']) assert.strictEqual(m.planMod({ gv: v, loader: null, enabled: true, jarExists: true }).reason, 'unsupported');
});

test('missingDeps: wyłączony plik liczy się jako obecny', () => {
  assert.deepStrictEqual(m.missingDeps(T, ['fabric-api-0.141.6+1.21.11.jar']).map(d => d.slug), ['sodium']);
  assert.deepStrictEqual(m.missingDeps(T, ['sodium-fabric-0.6.13+mc1.21.11.jar.disabled', 'fabric-api-x.jar']), []);
  assert.deepStrictEqual(m.missingDeps(T, []).map(d => d.slug), ['fabric-api', 'sodium']);
});

test('isMibFile', () => {
  assert.strictEqual(m.isMibFile('mib-client-mod.jar'), true);
  assert.strictEqual(m.isMibFile('mib-client-mod.jar.disabled'), true);
  assert.strictEqual(m.isMibFile('sodium.jar'), false);
});

const ACC = { active: 'a1', list: [{ id: 'a1', name: 'Ania', t: 'SEKRET' }, { id: 'b2', name: 'Bartek', t: 'SEKRET2' }] };

test('accountsPayload: bez tokenów', () => {
  const s = m.accountsPayload(ACC);
  assert.ok(!s.includes('SEKRET'));
  assert.deepStrictEqual(JSON.parse(s), [{ id: 'a1', name: 'Ania', active: true }, { id: 'b2', name: 'Bartek', active: false }]);
  assert.strictEqual(m.accountsPayload(undefined), '[]');
});

test('readSwitch: tylko poprawne, znane, nieaktywne konto', () => {
  assert.strictEqual(m.readSwitch('{zly', ACC), null);
  assert.strictEqual(m.readSwitch('{"id":"x9"}', ACC), null);
  assert.strictEqual(m.readSwitch('{"id":"a1"}', ACC), null);
  assert.strictEqual(m.readSwitch(JSON.stringify({ id: 'b'.repeat(65) }), { active: null, list: [{ id: 'b'.repeat(65) }] }), null);
  assert.strictEqual(m.readSwitch('{"id":5}', ACC), null);
  assert.strictEqual(m.readSwitch('{"id":"b2","at":1}', ACC), 'b2');
});

test('bridge: konta, żądanie zmiany, błąd', async () => {
  const dir = path.join(tmp(), 'mib'), calls = [];
  let fail = null;
  const acc = { active: ACC.active, list: [...ACC.list] };
  const b = m.createBridge({ dir, accounts: () => acc, onSwitch: async id => { calls.push(id); if (fail) throw new Error(fail); }, intervalMs: 60000, now: () => 1234 });
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'switch-request.json'), '{"id":"b2"}');
  fs.writeFileSync(path.join(dir, 'switch-result.json'), '{"ok":false}');
  b.start(); b.stop();
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(dir, 'accounts.json'), 'utf8')).map(x => x.id), ['a1', 'b2']);
  assert.ok(!fs.existsSync(path.join(dir, 'switch-request.json')), 'stare żądanie usunięte przy starcie');
  assert.ok(!fs.existsSync(path.join(dir, 'switch-result.json')));

  await b.pollOnce();
  assert.deepStrictEqual(calls, []);
  fs.writeFileSync(path.join(dir, 'switch-request.json'), '{"id":"b2"}');
  await b.pollOnce();
  assert.deepStrictEqual(calls, ['b2']);
  assert.ok(!fs.existsSync(path.join(dir, 'switch-request.json')));
  assert.ok(!fs.existsSync(path.join(dir, 'switch-result.json')), 'udana zmiana nie zapisuje wyniku');

  fail = 'Sesja wygasła';
  fs.writeFileSync(path.join(dir, 'switch-request.json'), '{"id":"b2"}');
  await b.pollOnce();
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(dir, 'switch-result.json'), 'utf8')), { ok: false, message: 'Sesja wygasła', at: 1234 });

  // zmiana kont w launcherze trafia do accounts.json przy następnym sprawdzeniu
  acc.list.push({ id: 'c3', name: 'Celina', t: 'S3' });
  await b.pollOnce();
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(dir, 'accounts.json'), 'utf8')).map(x => x.id), ['a1', 'b2', 'c3']);

  fs.writeFileSync(path.join(dir, 'switch-request.json'), '{"id":"nieznane"}');
  await b.pollOnce();
  assert.strictEqual(calls.length, 2, 'nieznane konto nie wywołuje zmiany');
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(dir, 'switch-result.json'), 'utf8')).ok, false);
});

// Instalacja z katalogiem zasobów launchera (resDir), folderem mods instancji i zapisem mib-instance.json (inst)
function setup() {
  const base = tmp(), resDir = path.join(base, 'res'), modsDir = path.join(base, 'inst', 'mods'), mibDir = path.join(base, 'mib');
  fs.mkdirSync(resDir); fs.writeFileSync(path.join(resDir, T.jar), 'JAR-MIB');
  const logs = [], deps = [], inst = {};
  const ensureDep = async (slug, gv, loader) => { deps.push([slug, gv, loader]); fs.writeFileSync(path.join(modsDir, slug + '-1.0.jar'), 'x'); };
  const d = { base, resDir, modsDir, mibDir, logs, deps, inst, ensureDep, log: s => logs.push(s) };
  d.run = (o = {}) => m.prepareMibMod({ gv: '1.21.11', inst: { ...d.inst }, settings: {}, modsDir, resDir, mibDir, ensureDep, setInst: x => Object.assign(d.inst, x), log: d.log, ...o });
  return d;
}
const OWN = d => path.join(d.modsDir, m.MOD_FILE);
const has = (d, f) => fs.existsSync(path.join(d.modsDir, f));

test('prepareMibMod: aktywny — kopiuje mod, dociąga zależności, ustawia Fabric, wspólny katalog mib', async () => {
  const d = setup();
  const r = await d.run();
  assert.deepStrictEqual(r, { active: true, jvmArgs: ['-Dmib.dir=' + d.mibDir] });
  assert.strictEqual(fs.readFileSync(OWN(d), 'utf8'), 'JAR-MIB');
  assert.deepStrictEqual(d.deps, [['fabric-api', '1.21.11', 'fabric'], ['sodium', '1.21.11', 'fabric']]);
  assert.deepStrictEqual(d.inst, { mibDeps: ['fabric-api-1.0.jar', 'sodium-1.0.jar'], loader: 'fabric', loaderByMib: true });
  // drugie uruchomienie: nic nie pobiera i nie zmienia instalacji
  await d.run();
  assert.strictEqual(d.deps.length, 2);
  assert.deepStrictEqual(d.inst.mibDeps, ['fabric-api-1.0.jar', 'sodium-1.0.jar']);
});

test('prepareMibMod: wyłączony — usuwa mod i cofa to, co dodał (sam MiB w folderze)', async () => {
  const d = setup();
  await d.run();
  const r = await d.run({ settings: { mibMod: false } });
  assert.deepStrictEqual(r, { active: false, jvmArgs: [] });
  assert.ok(!fs.existsSync(OWN(d)));
  assert.ok(has(d, 'sodium-1.0.jar.disabled') && has(d, 'fabric-api-1.0.jar.disabled'));
  assert.strictEqual(d.inst.loader, null);
  // ponowne włączenie przywraca wszystko bez pobierania
  await d.run();
  assert.ok(has(d, 'sodium-1.0.jar') && has(d, 'fabric-api-1.0.jar') && fs.existsSync(OWN(d)));
  assert.strictEqual(d.inst.loader, 'fabric');
  assert.strictEqual(d.deps.length, 2);
});

test('prepareMibMod: wyłączony przy innych modach — wyłącza tylko Sodium, Fabric API i loader zostają', async () => {
  const d = setup();
  await d.run();
  fs.writeFileSync(path.join(d.modsDir, 'inny-mod.jar'), 'x');
  await d.run({ settings: { mibMod: false } });
  assert.ok(has(d, 'sodium-1.0.jar.disabled') && has(d, 'fabric-api-1.0.jar'));
  assert.strictEqual(d.inst.loader, 'fabric');
});

test('prepareMibMod: Sodium wyłączony ręcznie przez gracza zostaje wyłączony', async () => {
  const d = setup();
  await d.run();
  fs.renameSync(path.join(d.modsDir, 'sodium-1.0.jar'), path.join(d.modsDir, 'sodium-1.0.jar.disabled'));
  await d.run();
  assert.ok(has(d, 'sodium-1.0.jar.disabled'));
  assert.strictEqual(d.deps.length, 2);
});

test('prepareMibMod: błąd pobrania Fabric API — gra bez moda', async () => {
  const d = setup();
  fs.mkdirSync(d.modsDir, { recursive: true }); fs.writeFileSync(OWN(d), 'stary');
  const r = await d.run({ ensureDep: async () => { throw new Error('sieć'); } });
  assert.strictEqual(r.active, false);
  assert.ok(!fs.existsSync(OWN(d)));
  assert.ok(d.logs.includes('Nie udało się pobrać Fabric API — gra uruchomi się bez moda MiB.'));
});

test('prepareMibMod: błąd pobrania Sodium nie blokuje moda', async () => {
  const d = setup();
  const r = await d.run({ ensureDep: async slug => { if (slug === 'sodium') throw new Error('sieć'); return d.ensureDep(slug, '1.21.11', 'fabric'); } });
  assert.strictEqual(r.active, true);
  assert.ok(fs.existsSync(OWN(d)));
});

test('prepareMibMod: instalacja z Forge', async () => {
  const d = setup();
  const r = await d.run({ inst: { loader: 'forge' } });
  assert.strictEqual(r.active, false);
  assert.ok(d.logs.includes('Ta instalacja 1.21.11 używa Forge — mod MiB działa tylko z Fabric. Gra uruchomi się bez niego.'));
});

test('prepareMibMod: wyłączone ręcznie Fabric API zostaje włączone, inne wersje gry bez zmian', async () => {
  const d = setup();
  fs.mkdirSync(d.modsDir, { recursive: true }); fs.writeFileSync(path.join(d.modsDir, 'fabric-api-0.1.jar.disabled'), 'x');
  d.inst.loader = 'fabric';
  await d.run();
  assert.ok(has(d, 'fabric-api-0.1.jar'));
  assert.deepStrictEqual(d.deps.map(x => x[0]), ['sodium']);
  assert.strictEqual(d.inst.loaderByMib, undefined, 'loader ustawiony przez gracza nie jest „od MiB”');

  const r = await d.run({ gv: '1.20.1' });
  assert.strictEqual(r.active, false);
});
