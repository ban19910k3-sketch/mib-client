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
