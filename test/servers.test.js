const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), os = require('os'), path = require('path');
const s = require('../lib/servers');

const entry = (name, ip, extra = []) => [{ t: 8, name: 'name', v: name }, { t: 8, name: 'ip', v: ip }, ...extra];
const file = list => s.write({ name: '', v: [{ t: 9, name: 'servers', v: { type: 10, items: list } }] });
const ips = buf => s.parse(buf).v.find(x => x.name === 'servers').v.items.map(e => e.find(x => x.name === 'ip').v);

test('NBT: zapis i odczyt bez zmian (z ikoną i bajtami)', () => {
  const buf = file([entry('Hypixel', 'mc.hypixel.net', [{ t: 8, name: 'icon', v: 'iVBOR' }, { t: 1, name: 'acceptTextures', v: 1 }])]);
  assert.ok(s.write(s.parse(buf)).equals(buf));
  assert.deepStrictEqual(ips(buf), ['mc.hypixel.net']);
});

test('merge: suma list bez powtórek (adres bez wielkości liter)', () => {
  const m = s.merge([file([entry('A', 'a.pl'), entry('B', 'b.pl')]), file([entry('B2', 'B.pl'), entry('C', 'c.pl')]), Buffer.from('zły')]);
  assert.deepStrictEqual(ips(m), ['a.pl', 'b.pl', 'c.pl']);
});

test('before/after: wspólna lista dla wszystkich wersji gry', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'srv-')), inst = path.join(base, 'instances'), shared = path.join(base, 'launcher', 'servers.dat');
  const v1 = path.join(inst, '1.21.11'), v2 = path.join(inst, '26.1');
  fs.mkdirSync(v1, { recursive: true }); fs.mkdirSync(v2, { recursive: true });
  fs.writeFileSync(path.join(v1, 'servers.dat'), file([entry('A', 'a.pl')]));
  fs.writeFileSync(path.join(v2, 'servers.dat'), file([entry('B', 'b.pl')]));
  // pierwszy start: łączy listy ze wszystkich instancji
  s.before({ shared, instance: v1, instancesDir: inst });
  assert.deepStrictEqual(ips(fs.readFileSync(shared)), ['a.pl', 'b.pl']);
  assert.deepStrictEqual(ips(fs.readFileSync(path.join(v1, 'servers.dat'))), ['a.pl', 'b.pl']);
  // gracz dodał serwer w grze na 1.21.11
  fs.writeFileSync(path.join(v1, 'servers.dat'), file([entry('A', 'a.pl'), entry('B', 'b.pl'), entry('C', 'c.pl')]));
  s.after({ shared, instance: v1 });
  // nowa wersja gry (np. po aktualizacji) dostaje tę samą listę
  const v3 = path.join(inst, '26.3');
  s.before({ shared, instance: v3, instancesDir: inst });
  assert.deepStrictEqual(ips(fs.readFileSync(path.join(v3, 'servers.dat'))), ['a.pl', 'b.pl', 'c.pl']);
  // uszkodzony plik w instancji nie psuje wspólnej listy
  fs.writeFileSync(path.join(v3, 'servers.dat'), 'zepsute');
  s.after({ shared, instance: v3 });
  assert.deepStrictEqual(ips(fs.readFileSync(shared)), ['a.pl', 'b.pl', 'c.pl']);
});

test('NBT: nazwy z emoji i NUL zapisane jak w Javie (zmodyfikowane UTF-8)', () => {
  const buf = file([entry('🔥 PvP\u0000', 'pvp.pl')]);
  const name = Buffer.from([0xed, 0xa0, 0xbd, 0xed, 0xb4, 0xa5, 0x20, 0x50, 0x76, 0x50, 0xc0, 0x80]);
  assert.ok(buf.includes(name), 'emoji jako dwie połówki po 3 bajty, NUL jako C0 80');
  assert.ok(s.write(s.parse(buf)).equals(buf));
  assert.strictEqual(s.parse(buf).v[0].v.items[0][0].v, '🔥 PvP\u0000');
});

test('before: serwery dodane, gdy launcher był zamknięty, nie giną', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'srv-')), inst = path.join(base, 'instances'), shared = path.join(base, 'l', 'servers.dat'), v = path.join(inst, '1.21.4');
  fs.mkdirSync(v, { recursive: true });
  fs.writeFileSync(path.join(v, 'servers.dat'), file([entry('A', 'a.pl')]));
  s.before({ shared, instance: v, instancesDir: inst });
  // gra działa dalej po zamknięciu launchera: gracz dodaje serwer, after() się nie wykonuje
  fs.writeFileSync(path.join(v, 'servers.dat'), file([entry('A', 'a.pl'), entry('B', 'b.pl')]));
  s.before({ shared, instance: v, instancesDir: inst });
  assert.deepStrictEqual(ips(fs.readFileSync(path.join(v, 'servers.dat'))), ['a.pl', 'b.pl']);
  assert.deepStrictEqual(ips(fs.readFileSync(shared)), ['a.pl', 'b.pl']);
});

test('before: ucięta wspólna lista jest odbudowana z instancji', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'srv-')), inst = path.join(base, 'instances'), shared = path.join(base, 'l', 'servers.dat'), v = path.join(inst, '26.1');
  fs.mkdirSync(v, { recursive: true }); fs.mkdirSync(path.dirname(shared), { recursive: true });
  const good = file([entry('A', 'a.pl'), entry('B', 'b.pl')]);
  fs.writeFileSync(path.join(v, 'servers.dat'), good);
  fs.writeFileSync(shared, good.subarray(0, 20));
  s.before({ shared, instance: v, instancesDir: inst });
  assert.deepStrictEqual(ips(fs.readFileSync(path.join(v, 'servers.dat'))), ['a.pl', 'b.pl']);
  assert.deepStrictEqual(ips(fs.readFileSync(shared)), ['a.pl', 'b.pl']);
});

test('before: nowy folder gry — jego listy dołączają do wspólnej', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'srv-')), shared = path.join(base, 'l', 'servers.dat');
  const a = path.join(base, 'gra1', 'instances'), b = path.join(base, 'gra2', 'instances');
  fs.mkdirSync(path.join(a, '1.21'), { recursive: true }); fs.mkdirSync(path.join(b, '26.3'), { recursive: true });
  fs.writeFileSync(path.join(a, '1.21', 'servers.dat'), file([entry('A', 'a.pl')]));
  s.before({ shared, instance: path.join(a, '1.21'), instancesDir: a });
  fs.writeFileSync(path.join(b, '26.3', 'servers.dat'), file([entry('C', 'c.pl')]));
  s.before({ shared, instance: path.join(b, '26.3'), instancesDir: b });
  assert.deepStrictEqual(ips(fs.readFileSync(path.join(b, '26.3', 'servers.dat'))), ['a.pl', 'c.pl']);
  assert.ok(fs.existsSync(path.join(b, '26.3', 'servers.dat.bak')), 'kopia listy przed nadpisaniem');
});

