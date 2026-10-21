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

const PERF = ['lithium', 'ferrite-core', 'entityculling', 'immediatelyfast'];
const PERF_FILES = ['lithium-fabric-0.16.0+mc1.21.11.jar', 'ferritecore-8.0.0-fabric.jar', 'entityculling-fabric-1.9.0-mc1.21.11.jar', 'ImmediatelyFast-Fabric-1.13.0+1.21.11.jar'];
test('missingDeps: wyłączony plik liczy się jako obecny', () => {
  assert.deepStrictEqual(m.missingDeps(T, ['fabric-api-0.141.6+1.21.11.jar', ...PERF_FILES]).map(d => d.slug), ['sodium']);
  assert.deepStrictEqual(m.missingDeps(T, ['sodium-fabric-0.6.13+mc1.21.11.jar.disabled', 'fabric-api-x.jar', ...PERF_FILES.map(f => f + '.disabled')]), []);
  assert.deepStrictEqual(m.missingDeps(T, []).map(d => d.slug), ['fabric-api', 'sodium', ...PERF]);
});

test('cmpVersion: liczbowo, nie jak tekst', () => {
  assert.strictEqual(m.cmpVersion('0.19.10', '0.19.5'), 1);
  assert.strictEqual(m.cmpVersion('0.16.14', m.MIN_LOADER), -1);
  assert.strictEqual(m.cmpVersion('0.19.5', '0.19.5'), 0);
  assert.strictEqual(m.cmpVersion('1.0', '0.99.99'), 1);
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

const COS = { loggedIn: true, items: [
  { id: 'c1', name: 'Fiolet', type: 'cape', equipped: true, texture: 'data:image/png;base64,QUJD' },
  { id: 'c2', name: 'Link', type: 'cape', equipped: false, texture: 'https://evil.example/x.png' },
  { id: 'h1', name: 'Czapka', type: 'hat', equipped: false },
  { id: 'w1', name: 'Skrzydła', type: 'wings', equipped: false, texture: 'data:image/png;base64,REVG' }] };

test('cosmeticsPayload: tekstury przedmiotów (PNG w base64, też niezałożonych — do przymiarki w grze), bez adresów zewnętrznych', () => {
  assert.deepStrictEqual(JSON.parse(m.cosmeticsPayload(COS)).items, [
    { id: 'c1', name: 'Fiolet', type: 'cape', equipped: true, png: 'QUJD' },
    { id: 'c2', name: 'Link', type: 'cape', equipped: false, png: null },
    { id: 'h1', name: 'Czapka', type: 'hat', equipped: false, png: null },
    { id: 'w1', name: 'Skrzydła', type: 'wings', equipped: false, png: 'REVG' }]);
  assert.deepStrictEqual(JSON.parse(m.cosmeticsPayload(null)), { loggedIn: false, items: [] });
});

test('readEquip: tylko przedmioty gracza i pasujący typ', () => {
  assert.deepStrictEqual(m.readEquip('{"type":"cape","id":"c2"}', COS), { type: 'cape', id: 'c2' });
  assert.deepStrictEqual(m.readEquip('{"type":"cape","id":null}', COS), { type: 'cape', id: null });
  assert.strictEqual(m.readEquip('{"type":"cape","id":"h1"}', COS), null);
  assert.strictEqual(m.readEquip('{"type":"cape","id":"obcy"}', COS), null);
  assert.strictEqual(m.readEquip('{"type":"buty","id":null}', COS), null);
  assert.strictEqual(m.readEquip('zly', COS), null);
});

test('bridge: kosmetyki do gry i zakładanie z menu w grze', async () => {
  const dir = path.join(tmp(), 'mib'), equips = [];
  let cur = JSON.parse(JSON.stringify(COS)), fail = null;
  const b = m.createBridge({ dir, accounts: () => ACC, onSwitch: async () => {}, cosmetics: async () => cur, intervalMs: 60000, now: () => 99,
    onEquip: async (type, id) => { if (fail) throw new Error(fail); equips.push([type, id]); cur.items.forEach(x => { if (x.type === type) x.equipped = x.id === id; }); } });
  b.start(); b.stop();
  await b.pollOnce();
  const read = () => JSON.parse(fs.readFileSync(path.join(dir, 'cosmetics.json'), 'utf8'));
  assert.strictEqual(read().items.find(x => x.equipped).id, 'c1');
  fs.writeFileSync(path.join(dir, 'cosmetic-request.json'), '{"type":"cape","id":"c2"}');
  await b.pollOnce();
  assert.deepStrictEqual(equips, [['cape', 'c2']]);
  assert.strictEqual(read().items.find(x => x.equipped).id, 'c2', 'lista odświeżona po założeniu');
  assert.ok(!fs.existsSync(path.join(dir, 'cosmetic-request.json')));
  fail = 'Brak połączenia';
  fs.writeFileSync(path.join(dir, 'cosmetic-request.json'), '{"type":"cape","id":null}');
  await b.pollOnce();
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(dir, 'cosmetic-result.json'), 'utf8')), { ok: false, message: 'Brak połączenia', at: 99 });
});

// Plik pobrany z Modrinth (nazwa jak u autora moda: FerriteCore bez myślnika)
const jar = slug => (slug === 'ferrite-core' ? 'ferritecore' : slug) + '-1.0.jar';
// Instalacja z katalogiem zasobów launchera (resDir), folderem mods instancji i zapisem mib-instance.json (inst)
function setup() {
  const base = tmp(), resDir = path.join(base, 'res'), modsDir = path.join(base, 'inst', 'mods'), mibDir = path.join(base, 'mib');
  fs.mkdirSync(resDir); fs.writeFileSync(path.join(resDir, T.jar), 'JAR-MIB');
  const logs = [], deps = [], inst = {};
  const ensureDep = async (slug, gv, loader) => { deps.push([slug, gv, loader]); fs.writeFileSync(path.join(modsDir, jar(slug)), 'x'); };
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
  assert.deepStrictEqual(d.deps, ['fabric-api', 'sodium', ...PERF].map(x => [x, '1.21.11', 'fabric']));
  assert.deepStrictEqual(d.inst, { mibDeps: ['fabric-api', 'sodium', ...PERF].map(jar), loader: 'fabric', loaderByMib: true });
  // drugie uruchomienie: nic nie pobiera i nie zmienia instalacji
  await d.run();
  assert.strictEqual(d.deps.length, 6);
  assert.deepStrictEqual(d.inst.mibDeps, ['fabric-api', 'sodium', ...PERF].map(jar));
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
  assert.strictEqual(d.deps.length, 6);
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
  assert.strictEqual(d.deps.length, 6);
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

test('prepareMibMod: mody na wydajność wyłączone w ustawieniach wracają po włączeniu bez pobierania', async () => {
  const d = setup();
  await d.run();
  await d.run({ settings: { perfMods: false } });
  for (const x of PERF) assert.ok(has(d, jar(x) + '.disabled'), x + ' wyłączony');
  assert.ok(has(d, 'sodium-1.0.jar') && fs.existsSync(OWN(d)), 'Sodium i mod MiB zostają');
  await d.run({ settings: { perfMods: false } });
  for (const x of PERF) assert.ok(has(d, jar(x) + '.disabled'), x + ' dalej wyłączony');
  await d.run();
  for (const x of PERF) assert.ok(has(d, jar(x)), x + ' włączony z powrotem');
  assert.strictEqual(d.deps.length, 6, 'bez ponownego pobierania');
  // mod na wydajność od gracza (nie od MiB) zostaje włączony
  const e = setup();
  fs.mkdirSync(e.modsDir, { recursive: true }); fs.writeFileSync(path.join(e.modsDir, 'lithium-moj.jar'), 'x');
  await e.run({ settings: { perfMods: false } });
  assert.ok(has(e, 'lithium-moj.jar'));
});

test('prepareMibMod: biblioteka pobrana razem z modem na wydajność wyłącza się i wraca razem z nim', async () => {
  const d = setup();
  const ensureDep = async (slug, gv, l) => { await d.ensureDep(slug, gv, l); if (slug === 'entityculling') fs.writeFileSync(path.join(d.modsDir, 'transition-1.0.jar'), 'x'); };
  await d.run({ ensureDep });
  assert.ok(d.inst.mibDeps.includes('transition-1.0.jar'));
  await d.run({ ensureDep, settings: { perfMods: false } });
  assert.ok(has(d, 'transition-1.0.jar.disabled'), 'wyłączona z modami na wydajność');
  await d.run({ ensureDep });
  assert.ok(has(d, 'transition-1.0.jar') && has(d, 'entityculling-1.0.jar'), 'wraca po włączeniu');
  await d.run({ ensureDep, settings: { mibMod: false } });
  assert.ok(has(d, 'transition-1.0.jar.disabled'), 'wyłączona z modem MiB');
  await d.run({ ensureDep });
  assert.ok(has(d, 'transition-1.0.jar'));
  assert.strictEqual(d.deps.length, 6, 'bez ponownego pobierania');
});

test('prepareMibMod: brak wersji moda dla tej wersji gry — następna próba po dobie', async () => {
  const d = setup();
  let t = 1000;
  const ensureDep = async (slug, gv, l) => { if (slug === 'entityculling') throw Object.assign(new Error('brak'), { code: 'no_version' }); return d.ensureDep(slug, gv, l); };
  await d.run({ ensureDep, now: () => t });
  assert.strictEqual(d.inst.mibMissing.entityculling, 1000);
  assert.ok(d.logs.includes('Entity Culling nie ma jeszcze wersji dla 1.21.11 — gra uruchomi się bez niego.'));
  const asked = d.deps.length;
  await d.run({ ensureDep, now: () => t });
  assert.strictEqual(d.deps.length, asked, 'bez pytania Modrinth przy każdym starcie');
  t += 25 * 3600 * 1000;
  await d.run({ now: () => t });
  assert.ok(has(d, 'entityculling-1.0.jar'), 'po dobie pobrany');
  assert.deepStrictEqual(d.inst.mibMissing, {});
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
  assert.deepStrictEqual(d.deps.map(x => x[0]), ['sodium', ...PERF]);
  assert.strictEqual(d.inst.loaderByMib, undefined, 'loader ustawiony przez gracza nie jest „od MiB”');

  const r = await d.run({ gv: '1.20.1' });
  assert.strictEqual(r.active, false);
});

test('readScreenshot: tylko .png w folderze screenshots wewnątrz folderu gry', () => {
  const root = path.join(os.tmpdir(), 'gra');
  const ok = path.join(root, 'instances', '1.21', 'screenshots', '2026-10-18_10.00.00.png');
  assert.strictEqual(m.readScreenshot(JSON.stringify({ path: ok }), root), ok);
  assert.strictEqual(m.readScreenshot(JSON.stringify({ path: path.join(root, 'screenshots', 'a.jpg') }), root), null);
  assert.strictEqual(m.readScreenshot(JSON.stringify({ path: path.join(root, 'mods', 'a.png') }), root), null);
  assert.strictEqual(m.readScreenshot(JSON.stringify({ path: path.join(os.tmpdir(), 'inna', 'screenshots', 'a.png') }), root), null);
  assert.strictEqual(m.readScreenshot(JSON.stringify({ path: path.join(root, 'screenshots', '..', '..', 'x', 'screenshots', 'a.png') }), root), null);
  assert.strictEqual(m.readScreenshot('nie json', root), null);
});

test('most: screenshot-request.json trafia do onScreenshot i znika', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mib-shot-'));
  const mibDir = path.join(dir, 'mib'), shot = path.join(dir, 'screenshots', 'a.png');
  const got = [];
  const b = m.createBridge({ dir: mibDir, accounts: () => ({ accounts: [], active: null }), onSwitch: async () => {}, onScreenshot: f => got.push(f) });
  fs.mkdirSync(mibDir, { recursive: true });
  fs.writeFileSync(path.join(mibDir, 'screenshot-request.json'), JSON.stringify({ path: shot }));
  await b.pollOnce();
  assert.deepStrictEqual(got, [shot]);
  assert.ok(!fs.existsSync(path.join(mibDir, 'screenshot-request.json')));
});

test('readStatus: serwer z aktualnego pliku, inaczej null', () => {
  const now = 100000;
  assert.strictEqual(m.readStatus(JSON.stringify({ server: 'MC.Hypixel.net:25565', at: now - 5000 }), now), 'mc.hypixel.net:25565');
  assert.strictEqual(m.readStatus(JSON.stringify({ server: 'mc.hypixel.net', at: now - 60000 }), now), null, 'stary plik = gracz w menu');
  assert.strictEqual(m.readStatus(JSON.stringify({ server: null, at: now }), now), null, 'świat jednoosobowy');
  assert.strictEqual(m.readStatus(JSON.stringify({ server: 'zły serwer; x', at: now }), now), null);
  assert.strictEqual(m.readStatus('nie json', now), null);
});

test('most: zmiana serwera z status.json trafia do onStatus raz', async () => {
  const dir = path.join(tmp(), 'mib'), got = [];
  let t = 50000;
  const b = m.createBridge({ dir, accounts: () => ({ list: [], active: null }), onSwitch: async () => {}, onStatus: s => got.push(s), now: () => t });
  fs.mkdirSync(dir, { recursive: true });
  await b.pollOnce();
  fs.writeFileSync(path.join(dir, 'status.json'), JSON.stringify({ server: 'play.mib.pl', at: t }));
  await b.pollOnce();
  await b.pollOnce();
  t += 30000;
  await b.pollOnce();
  assert.deepStrictEqual(got, [null, 'play.mib.pl', null]);
});

test('most: powiadomienie o znajomym trafia do notice.json, każde z nowym id', () => {
  const dir = path.join(tmp(), 'mib');
  const b = m.createBridge({ dir, accounts: () => ({ list: [], active: null }), onSwitch: async () => {}, now: () => 777 });
  b.notice({ type: 'invite', nick: 'Ala', version: '1.21.11', server: 'play.mib.pl' });
  const a = JSON.parse(fs.readFileSync(path.join(dir, 'notice.json'), 'utf8'));
  assert.deepStrictEqual(a, { id: '777-1', type: 'invite', nick: 'Ala', version: '1.21.11', server: 'play.mib.pl', at: 777 });
  b.notice({ type: 'cokolwiek', nick: 'Bob' });
  const c = JSON.parse(fs.readFileSync(path.join(dir, 'notice.json'), 'utf8'));
  assert.deepStrictEqual(c, { id: '777-2', type: 'started', nick: 'Bob', version: null, server: null, at: 777 });
  b.start(); b.stop();
  assert.ok(!fs.existsSync(path.join(dir, 'notice.json')), 'stare powiadomienie znika przy starcie gry');
});

test('most: znajomi i rozmowa dla menu w grze, wysyłanie wiadomości i błąd z kodem', async () => {
  const dir = path.join(tmp(), 'mib'), sent = [];
  let t = 100000, fail = null;
  const msgs = [{ id: 1, mine: false, body: 'Siema', read: true }];
  const b = m.createBridge({ dir, accounts: () => ({ list: [], active: null }), onSwitch: async () => {}, now: () => t,
    friends: async () => ({ loggedIn: true, list: [{ id: 'a', nick: 'Ala', status: 'game', server: 'play.mib.pl', unread: 2 }] }),
    chat: async id => (id === 'a' ? msgs : []),
    onSend: async (to, body) => { if (fail) throw new Error(fail); sent.push(to + ':' + body); msgs.push({ id: 2, mine: true, body, read: false }); } });
  fs.mkdirSync(dir, { recursive: true });
  const read = n => JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8'));
  await b.pollOnce();
  assert.deepStrictEqual(read('friends.json'), { loggedIn: true, list: [{ id: 'a', nick: 'Ala', status: 'game', server: 'play.mib.pl', unread: 2 }] });
  assert.ok(!fs.existsSync(path.join(dir, 'chat.json')), 'bez prośby moda nie ma rozmowy');
  fs.writeFileSync(path.join(dir, 'chat-request.json'), JSON.stringify({ with: 'a', at: t }));
  await b.pollOnce();
  assert.deepStrictEqual(read('chat.json'), { with: 'a', at: t, messages: [{ id: 1, mine: false, body: 'Siema', read: true }] });
  t += 1000;
  fs.writeFileSync(path.join(dir, 'chat-send.json'), JSON.stringify({ to: 'a', body: 'Hej!', at: t }));
  await b.pollOnce();
  assert.deepStrictEqual(sent, ['a:Hej!']);
  assert.ok(!fs.existsSync(path.join(dir, 'chat-send.json')), 'wiadomość odebrana');
  assert.equal(read('chat.json').messages.length, 2, 'rozmowa odświeżona od razu po wysłaniu');
  assert.equal(read('chat.json').at, t);
  fail = 'message_limit';
  fs.writeFileSync(path.join(dir, 'chat-send.json'), JSON.stringify({ to: 'a', body: 'Znowu', at: t }));
  await b.pollOnce();
  assert.deepStrictEqual(read('chat-result.json'), { ok: false, message: 'message_limit', at: t });
  t += 20000;
  const before = fs.readFileSync(path.join(dir, 'chat.json'), 'utf8');
  msgs.push({ id: 3, mine: false, body: 'Nowa', read: false });
  for (let i = 0; i < 3; i++) await b.pollOnce();
  assert.equal(fs.readFileSync(path.join(dir, 'chat.json'), 'utf8'), before, 'stara prośba (ponad 10 s): rozmowa już się nie odświeża');
  b.notice({ type: 'message', nick: 'Ala', text: 'Siema' });
  assert.equal(read('notice.json').text, 'Siema');
  assert.equal(read('notice.json').type, 'message');
});

test('jarLoader i dropError: rozpoznanie moda z .jar i zgodność z loaderem wersji gry', () => {
  const AdmZip = require('adm-zip');
  const jar = files => { const z = new AdmZip(); for (const f of files) z.addFile(f, Buffer.from('{}')); return z.toBuffer(); };
  assert.equal(m.jarLoader(jar(['fabric.mod.json'])), 'fabric');
  assert.equal(m.jarLoader(jar(['META-INF/mods.toml'])), 'forge');
  assert.equal(m.jarLoader(jar(['META-INF/neoforge.mods.toml'])), 'neoforge');
  assert.equal(m.jarLoader(jar(['quilt.mod.json'])), 'quilt');
  assert.equal(m.jarLoader(jar(['readme.txt'])), null, 'zip bez opisu moda');
  assert.equal(m.jarLoader(Buffer.from('to nie zip')), null);
  assert.equal(m.dropError('fabric', 'fabric'), null);
  assert.equal(m.dropError('fabric', null), null, 'pierwszy mod wybiera loader');
  assert.equal(m.dropError('forge', 'fabric'), 'wrong_loader');
  assert.equal(m.dropError('neoforge', null), 'wrong_loader', 'launcher obsługuje Fabric i Forge');
  assert.equal(m.dropError(null, 'fabric'), 'not_mod');
});

test('prezenty w menu gry: lista w cosmetics.json i odbieranie (cosmetic-request.json z polem gift)', async () => {
  const withGifts = { ...COS, gifts: [{ id: 7, name: 'Korona', type: 'hat', message: 'Dzięki!', texture: 'data:image/png;base64,QUJD' }, { id: 'zle' }] };
  assert.deepStrictEqual(JSON.parse(m.cosmeticsPayload(withGifts)).gifts, [{ id: 7, name: 'Korona', type: 'hat', message: 'Dzięki!' }], 'bez tekstur i złych wpisów');
  assert.strictEqual(m.readClaim('{"gift":7}', withGifts), 7);
  assert.strictEqual(m.readClaim('{"gift":8}', withGifts), null, 'tylko prezenty gracza');
  assert.strictEqual(m.readClaim('{"type":"cape","id":"c1"}', withGifts), null);
  const dir = path.join(tmp(), 'mib'), claims = [];
  let cur = JSON.parse(JSON.stringify(withGifts));
  const b = m.createBridge({ dir, accounts: () => ACC, onSwitch: async () => {}, cosmetics: async () => cur, intervalMs: 60000, now: () => 5,
    onClaim: async id => { claims.push(id); cur.gifts = []; cur.items.push({ id: 'h2', name: 'Korona', type: 'hat', equipped: false }); } });
  await b.pollOnce();
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(dir, 'cosmetics.json'), 'utf8')).gifts.length, 1);
  fs.writeFileSync(path.join(dir, 'cosmetic-request.json'), '{"gift":7,"at":5}');
  await b.pollOnce();
  assert.deepStrictEqual(claims, [7]);
  const after = JSON.parse(fs.readFileSync(path.join(dir, 'cosmetics.json'), 'utf8'));
  assert.deepStrictEqual([after.gifts.length, after.items.some(x => x.id === 'h2')], [0, true], 'po odebraniu prezent jest na liście przedmiotów');
  fs.writeFileSync(path.join(dir, 'cosmetic-request.json'), '{"gift":7,"at":6}');
  await b.pollOnce();
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(dir, 'cosmetic-result.json'), 'utf8')).ok, false, 'drugi raz: błąd w grze');
  b.notice({ type: 'news', nick: 'MiB', text: 'Turniej za godzinę' });
  assert.deepStrictEqual((({ type, text }) => ({ type, text }))(JSON.parse(fs.readFileSync(path.join(dir, 'notice.json'), 'utf8'))), { type: 'news', text: 'Turniej za godzinę' });
});
