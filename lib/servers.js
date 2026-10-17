// Lista serwerów (servers.dat) wspólna dla wszystkich wersji gry, z kopią w folderze launchera.
// Przed startem gry nowsza wspólna lista trafia do instancji, po zamknięciu gry lista z instancji wraca do wspólnej.
// Za pierwszym razem listy ze wszystkich instancji są łączone (po adresie), żeby żaden serwer nie zniknął.
const path = require('path');

// ---- Minimalne NBT (bez kompresji, tak jak servers.dat) ----
function parse(buf) {
  let o = 0;
  const str = () => { const n = buf.readUInt16BE(o); o += 2; const s = buf.toString('utf8', o, o + n); o += n; return s; };
  const payload = t => {
    switch (t) {
      case 1: return buf.readInt8(o++);
      case 2: { const v = buf.readInt16BE(o); o += 2; return v; }
      case 3: { const v = buf.readInt32BE(o); o += 4; return v; }
      case 4: { const v = buf.readBigInt64BE(o); o += 8; return v; }
      case 5: { const v = buf.readFloatBE(o); o += 4; return v; }
      case 6: { const v = buf.readDoubleBE(o); o += 8; return v; }
      case 7: { const n = buf.readInt32BE(o); o += 4; const v = Buffer.from(buf.subarray(o, o + n)); o += n; return v; }
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
  const str = s => { const d = Buffer.from(s, 'utf8'); b(2).writeUInt16BE(d.length); parts.push(d); };
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

// Łączy listy w kolejności (pierwsza wygrywa przy tym samym adresie)
function merge(bufs) {
  const out = [], seen = new Set();
  for (const buf of bufs) {
    let root; try { root = parse(buf); } catch { continue; }
    for (const s of servers(root)) { const ip = ipOf(s); if (!ip || seen.has(ip)) continue; seen.add(ip); out.push(s); }
  }
  return write({ name: '', v: [{ t: 9, name: 'servers', v: { type: 10, items: out } }] });
}

// Przed startem gry: wspólna lista -> instancja (pierwszy raz: połączone listy ze wszystkich instancji)
function before({ fs = require('fs'), shared, instance, instancesDir }) {
  const inst = path.join(instance, 'servers.dat');
  try {
    if (!fs.existsSync(shared)) {
      const files = [inst];
      try { for (const d of fs.readdirSync(instancesDir)) { const f = path.join(instancesDir, d, 'servers.dat'); if (f !== inst) files.push(f); } } catch {}
      const bufs = files.filter(f => fs.existsSync(f)).map(f => fs.readFileSync(f));
      if (!bufs.length) return;
      fs.mkdirSync(path.dirname(shared), { recursive: true });
      fs.writeFileSync(shared, merge(bufs));
    }
    if (!fs.existsSync(inst) || !fs.readFileSync(inst).equals(fs.readFileSync(shared))) {
      fs.mkdirSync(instance, { recursive: true });
      fs.copyFileSync(shared, inst);
    }
  } catch {}
}

// Po zamknięciu gry: lista z instancji (zmieniona w grze) -> wspólna
function after({ fs = require('fs'), shared, instance }) {
  const inst = path.join(instance, 'servers.dat');
  try {
    if (!fs.existsSync(inst)) return;
    parse(fs.readFileSync(inst)); // uszkodzony plik nie nadpisuje dobrej kopii
    fs.mkdirSync(path.dirname(shared), { recursive: true });
    fs.copyFileSync(inst, shared);
  } catch {}
}

module.exports = { parse, write, merge, before, after };
