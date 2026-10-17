// Lista serwerów (servers.dat) wspólna dla wszystkich wersji gry, z kopią w folderze launchera.
// Przed startem gry wspólna lista trafia do instancji, po zamknięciu gry lista z instancji wraca do wspólnej.
// Żaden serwer nie ginie: listy, których launcher nie zna (pierwsze uruchomienie, inny folder gry, gra zamknięta
// bez launchera), są najpierw dołączane do wspólnej. Co launcher ostatnio zapisał do instancji, pamięta plik
// servers.dat.mib (skrót SHA-1).
const path = require('path'), crypto = require('crypto');

// ---- Napisy NBT: zmodyfikowane UTF-8 Javy (NUL jako C0 80, znaki spoza BMP jako dwie połówki po 3 bajty) ----
function readMutf8(buf, start, end) {
  let s = '';
  for (let i = start; i < end;) {
    const a = buf[i];
    if (a < 0x80) { s += String.fromCharCode(a); i += 1; }
    else if ((a & 0xe0) === 0xc0) { s += String.fromCharCode(((a & 0x1f) << 6) | (buf[i + 1] & 0x3f)); i += 2; }
    else { s += String.fromCharCode(((a & 0x0f) << 12) | ((buf[i + 1] & 0x3f) << 6) | (buf[i + 2] & 0x3f)); i += 3; }
  }
  return s;
}
function writeMutf8(s) {
  const out = [];
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c !== 0 && c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
  }
  return Buffer.from(out);
}

// ---- Minimalne NBT (bez kompresji, tak jak servers.dat) ----
function parse(buf) {
  let o = 0;
  const str = () => { const n = buf.readUInt16BE(o); o += 2; if (o + n > buf.length) throw new Error('ucięty plik'); const s = readMutf8(buf, o, o + n); o += n; return s; };
  const payload = t => {
    switch (t) {
      case 1: return buf.readInt8(o++);
      case 2: { const v = buf.readInt16BE(o); o += 2; return v; }
      case 3: { const v = buf.readInt32BE(o); o += 4; return v; }
      case 4: { const v = buf.readBigInt64BE(o); o += 8; return v; }
      case 5: { const v = buf.readFloatBE(o); o += 4; return v; }
      case 6: { const v = buf.readDoubleBE(o); o += 8; return v; }
      case 7: { const n = buf.readInt32BE(o); o += 4; if (o + n > buf.length) throw new Error('ucięty plik'); const v = Buffer.from(buf.subarray(o, o + n)); o += n; return v; }
      case 8: return str();
      case 9: { const et = buf.readInt8(o++), n = buf.readInt32BE(o); o += 4; const items = []; for (let i = 0; i < n; i++) items.push(payload(et)); return { type: et, items }; }
      case 10: { const m = []; for (;;) { const ct = buf.readInt8(o++); if (ct === 0) break; const name = str(); m.push({ t: ct, name, v: payload(ct) }); } return m; }
      case 11: { const n = buf.readInt32BE(o); o += 4; const v = []; for (let i = 0; i < n; i++) { v.push(buf.readInt32BE(o)); o += 4; } return v; }
      case 12: { const n = buf.readInt32BE(o); o += 4; const v = []; for (let i = 0; i < n; i++) { v.push(buf.readBigInt64BE(o)); o += 8; } return v; }
      default: throw new Error('nieznany znacznik NBT ' + t);
    }
  };
  const t = buf.readInt8(o++);
  if (t !== 10) throw new Error('to nie jest plik NBT');
  const name = str();
  return { name, v: payload(10) };
}

function write(root) {
  const parts = [];
  const b = n => { const x = Buffer.alloc(n); parts.push(x); return x; };
  const str = s => { const d = writeMutf8(s); b(2).writeUInt16BE(d.length); parts.push(d); };
  const payload = (t, v) => {
    switch (t) {
      case 1: b(1).writeInt8(v); break;
      case 2: b(2).writeInt16BE(v); break;
      case 3: b(4).writeInt32BE(v); break;
      case 4: b(8).writeBigInt64BE(v); break;
      case 5: b(4).writeFloatBE(v); break;
      case 6: b(8).writeDoubleBE(v); break;
      case 7: b(4).writeInt32BE(v.length); parts.push(v); break;
      case 8: str(v); break;
      case 9: b(1).writeInt8(v.type); b(4).writeInt32BE(v.items.length); for (const x of v.items) payload(v.type, x); break;
      case 10: for (const e of v) { b(1).writeInt8(e.t); str(e.name); payload(e.t, e.v); } b(1).writeInt8(0); break;
      case 11: b(4).writeInt32BE(v.length); for (const x of v) b(4).writeInt32BE(x); break;
      case 12: b(4).writeInt32BE(v.length); for (const x of v) b(8).writeBigInt64BE(x); break;
    }
  };
  b(1).writeInt8(10); str(root.name); payload(10, root.v);
  return Buffer.concat(parts);
}

// Serwery z pliku: lista wpisów NBT (każdy to compound z polami ip, name, icon…)
function servers(root) {
  const e = root.v.find(x => x.name === 'servers' && x.t === 9);
  return e ? e.v.items : [];
}
const ipOf = s => { const e = s.find(x => x.name === 'ip'); return e ? String(e.v).trim().toLowerCase() : ''; };
const valid = buf => { try { parse(buf); return true; } catch { return false; } };

// Łączy listy w kolejności (pierwsza wygrywa przy tym samym adresie)
function merge(bufs) {
  const out = [], seen = new Set();
  for (const buf of bufs) {
    let root; try { root = parse(buf); } catch { continue; }
    for (const s of servers(root)) { const ip = ipOf(s); if (!ip || seen.has(ip)) continue; seen.add(ip); out.push(s); }
  }
  return write({ name: '', v: [{ t: 9, name: 'servers', v: { type: 10, items: out } }] });
}

const sha1 = buf => crypto.createHash('sha1').update(buf).digest('hex');
const read = (fs, f) => { try { return fs.readFileSync(f); } catch { return null; } };
// zapis przez plik tymczasowy: przerwany zapis nie zostawia uciętej listy
function put(fs, f, buf) {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f + '.tmp', buf);
  fs.renameSync(f + '.tmp', f);
}
const markOf = inst => inst + '.mib';

// Przed startem gry: wspólna lista (uzupełniona o listy, których launcher jeszcze nie zna) -> instancja
function before({ fs = require('fs'), shared, instance, instancesDir }) {
  const inst = path.join(instance, 'servers.dat');
  try {
    let sh = read(fs, shared);
    if (sh && !valid(sh)) sh = null; // uszkodzona wspólna lista: odbudowa z instancji
    const unknown = [];
    const consider = f => {
      const b = read(fs, f), mark = read(fs, markOf(f));
      if (b && valid(b) && (!mark || mark.toString() !== sha1(b))) unknown.push(b);
    };
    consider(inst);
    // pierwszy raz (albo nowy folder gry): listy ze wszystkich instancji
    if (!sh) { try { for (const d of fs.readdirSync(instancesDir)) { const f = path.join(instancesDir, d, 'servers.dat'); if (f !== inst) consider(f); } } catch {} }
    if (unknown.length) { sh = merge(sh ? [sh, ...unknown] : unknown); put(fs, shared, sh); }
    if (!sh) return;
    const cur = read(fs, inst);
    if (!cur || !cur.equals(sh)) {
      if (cur) put(fs, inst + '.bak', cur);
      put(fs, inst, sh);
    }
    put(fs, markOf(inst), Buffer.from(sha1(sh)));
  } catch {}
}

// Po zamknięciu gry: lista z instancji (zmieniona w grze) -> wspólna
function after({ fs = require('fs'), shared, instance }) {
  const inst = path.join(instance, 'servers.dat');
  try {
    const b = read(fs, inst);
    if (!b || !valid(b)) return; // uszkodzony plik nie nadpisuje dobrej kopii
    put(fs, shared, b);
    put(fs, markOf(inst), Buffer.from(sha1(b)));
  } catch {}
}

module.exports = { parse, write, merge, before, after };
