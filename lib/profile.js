// Logika profilu MiB bez sieci. Działa w procesie głównym (require) i w interfejsie (<script>, window.MibProfile).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MibProfile = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  // Crockford base32: bez I, L, O, U, żeby kod dało się przepisać z kartki
  const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  // Bez argumentów JVM: z profilu nie mogą przyjść flagi uruchamiające kod na komputerze gracza
  const SYNCED_KEYS = ['ram', 'width', 'height', 'priority', 'hideUpdates', 'lang', 'bg', 'anim', 'fx', 'style'];

  // ===== Motyw launchera (od 0.36.0): gotowe palety albo własne kolory — a: akcent, b: tło, c: karty, x: cząsteczki =====
  // „mib” (null) to zwykły wygląd z trybem i akcentem z Ustawień. Motyw świąteczny zawsze wygrywa (style.css, Theme w modzie).
  const STYLES = {
    ocean: { a: '#38bdf8', b: '#020814', c: '#0a1628', x: '#7dd3fc' },
    las: { a: '#22c55e', b: '#030a06', c: '#0b1a10', x: '#86efac' },
    lawa: { a: '#f4511e', b: '#0d0402', c: '#1c0a06', x: '#ffb38a' },
    snieg: { a: '#2563eb', b: '#eef3fa', c: '#ffffff', x: '#93c5fd' },
    neon: { a: '#ec4899', b: '#07020f', c: '#120822', x: '#22d3ee' },
  };
  const STYLE_IDS = ['mib', ...Object.keys(STYLES), 'custom'];
  const HEX6 = /^#[0-9a-f]{6}$/;
  const rgbOf = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const hexOf = c => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const mixHex = (a, b, t) => { const x = rgbOf(a), y = rgbOf(b); return hexOf(x.map((v, i) => v + (y[i] - v) * t)); };
  const luma = h => { const [r, g, b] = rgbOf(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  // Motyw z ustawień albo z profilu: {p, a, b, c, x} albo null (zwykły wygląd MiB); gotowe palety mają zawsze swoje kolory
  function styleOf(v) {
    if (!v || typeof v !== 'object' || !STYLE_IDS.includes(v.p) || v.p === 'mib') return null;
    if (v.p !== 'custom') return { p: v.p, ...STYLES[v.p] };
    const out = { p: 'custom' };
    for (const k of ['a', 'b', 'c', 'x']) {
      const h = String(v[k] || '').toLowerCase();
      if (!HEX6.test(h)) return null;
      out[k] = h;
    }
    return out;
  }
  // Wszystkie kolory interfejsu z czterech wybranych: jasne tło = jasny tryb (ciemne napisy)
  function stylePalette(s) {
    const light = luma(s.b) > 0.4, ink = light ? '#141420' : '#f1ecf8', t = mixHex(ink, s.a, 0.06);
    return {
      light, void: s.b, slab: s.c, slab2: mixHex(s.c, ink, 0.05), edge: mixHex(s.c, ink, 0.1), edge2: mixHex(mixHex(s.c, ink, 0.16), s.a, 0.18),
      am: s.a, amHi: light ? mixHex(s.a, '#000000', 0.3) : mixHex(s.a, '#ffffff', 0.55), amLo: mixHex(s.a, '#000000', 0.32),
      t, m: mixHex(t, s.b, 0.42), t2: mixHex(t, s.b, 0.2), faint: mixHex(t, s.b, 0.6), hi: light ? '#0b0b12' : '#ffffff',
      goHi: mixHex(s.a, '#ffffff', 0.2), goLo: mixHex(s.a, '#000000', 0.45), go: mixHex(s.a, '#000000', 0.12), x: s.x,
    };
  }
  // CSS motywu (wstawiany po style.css): ustępuje motywom świątecznym jak tryb i akcent
  function styleCss(s) {
    const p = stylePalette(s);
    return ':root[data-style][data-mode]:not(.t-halloween):not(.themed){color-scheme:' + (p.light ? 'light' : 'dark') + ';--void:' + p.void + ';--slab:' + p.slab +
      ';--slab2:' + p.slab2 + ';--edge:' + p.edge + ';--edge2:' + p.edge2 + ';--am:' + p.am + ';--am-hi:' + p.amHi + ';--am-lo:' + p.amLo + ';--t:' + p.t +
      ';--m:' + p.m + ';--t2:' + p.t2 + ';--faint:' + p.faint + ';--hi:' + p.hi + '}';
  }
  // Kolory dla menu w grze (-Dmib.colors, Theme w modzie): VOID, SLAB, SLAB2, EDGE, EDGE2, AM, AM_HI, AM_LO, TEXT, MUTED, BTN_HI, BTN_LO, BTN
  function styleGame(s) {
    if (!s) return '';
    const p = stylePalette(s);
    return [p.void, p.slab, p.slab2, p.edge, p.edge2, p.am, p.amHi, p.amLo, p.t, p.m, p.goHi, p.goLo, p.go].map(h => h.slice(1)).join(',');
  }
  // Kod do udostępnienia: MIBT-akcent-tło-karty-cząsteczki (wklejony daje motyw Własny albo gotowy o tych kolorach)
  const styleCode = s => (s ? 'MIBT-' + [s.a, s.b, s.c, s.x].map(h => h.slice(1)).join('-') : '');
  function parseStyleCode(code) {
    const m = /^\s*MIBT-([0-9a-f]{6})-([0-9a-f]{6})-([0-9a-f]{6})-([0-9a-f]{6})\s*$/i.exec(String(code || ''));
    if (!m) return null;
    const c = { a: '#' + m[1].toLowerCase(), b: '#' + m[2].toLowerCase(), c: '#' + m[3].toLowerCase(), x: '#' + m[4].toLowerCase() };
    const p = Object.keys(STYLES).find(k => ['a', 'b', 'c', 'x'].every(f => STYLES[k][f] === c[f]));
    return p ? { p, ...STYLES[p] } : { p: 'custom', ...c };
  }

  function validateNick(nick) {
    const n = String(nick == null ? '' : nick);
    if (n.length < 3 || n.length > 16) return 'nick_length';
    if (!/^[A-Za-z0-9_]+$/.test(n)) return 'nick_chars';
    return null;
  }

  const formatMibId = num => 'MIB-' + String(num).padStart(6, '0');

  function newRecoveryCode(randomBytes) {
    const b = randomBytes(16);
    let s = '';
    for (let i = 0; i < 16; i++) s += ALPHABET[b[i] & 31];
    return s.match(/.{4}/g).join('-');
  }

  const normalizeRecoveryCode = input => String(input || '').toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');

  function pickSynced(obj) {
    const out = {};
    for (const k of SYNCED_KEYS) if (obj && obj[k] !== undefined && !(k === 'bg' && obj[k] === 'custom')) out[k] = obj[k];
    return out;
  }

  // Ustawienia z profilu przepuszczamy tylko w bezpiecznych zakresach i wartościach
  const int = (v, lo, hi) => (Number.isInteger(v) && v >= lo && v <= hi ? v : undefined);
  const oneOf = (v, list) => (list.includes(v) ? v : undefined);
  function sanitizeSynced(x) {
    const o = x || {}, out = {
      ram: int(o.ram, 512, 65536), width: int(o.width, 320, 7680), height: int(o.height, 240, 4320),
      priority: typeof o.priority === 'boolean' ? o.priority : undefined, hideUpdates: typeof o.hideUpdates === 'boolean' ? o.hideUpdates : undefined,
      lang: oneOf(o.lang, ['pl', 'en']), bg: oneOf(o.bg, ['violet', 'black', 'blue']), anim: oneOf(o.anim, ['full', 'short', 'off']), fx: oneOf(o.fx, ['0', '1']),
      style: o.style && o.style.p === 'mib' ? { p: 'mib' } : styleOf(o.style) || undefined,
    };
    for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
    return out;
  }

  // Co zrobić z ustawieniami po zalogowaniu: 'apply' = weź z profilu, 'push' = wyślij lokalne, 'none' = są takie same
  function mergeSettings(localAt, remote) {
    if (!remote) return 'push';
    if (localAt == null) return 'apply';
    if (remote.updatedAt > localAt) return 'apply';
    if (remote.updatedAt < localAt) return 'push';
    return 'none';
  }

  const clampSessionMinutes = ms => Math.min(1440, Math.max(0, Math.round(ms / 60000)));

  function favouriteVersion(stats) {
    let best = null, max = -1;
    for (const [gv, s] of Object.entries(stats || {})) if (s && s.min > max) { max = s.min; best = gv; }
    return best;
  }

  function formatPlaytime(min) {
    const h = Math.floor(min / 60), m = min % 60;
    return h ? h + ' h ' + String(m).padStart(2, '0') + ' min' : m + ' min';
  }

  // Kopii z profilu nie nadpisujemy, dopóki ten komputer jej nie przejrzał (przywrócił albo zastąpił)
  const backupDecision = s => (s.hasRemote && !s.reviewed ? 'hold' : 'push');

  // Wymiary z nagłówka PNG (IHDR) albo null, gdy to nie PNG
  function pngInfo(buf) {
    const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (!buf || buf.length < 24 || sig.some((v, i) => buf[i] !== v)) return null;
    const u32 = o => ((buf[o] << 24) >>> 0) + (buf[o + 1] << 16) + (buf[o + 2] << 8) + buf[o + 3];
    return { width: u32(16), height: u32(20) };
  }
  // Tekstura kosmetyku jak peleryna w Minecrafcie: klatka 64×32 albo jej wielokrotność (HD) do 512×256.
  // Animowana: klatki jedna pod drugą (np. 64×128 = 4 klatki), zmiana co CAPE_FRAME_MS (tak samo w grze: Cosmetics.java)
  const CAPE_FRAME_MS = 100, CAPE_MAX_FRAMES = 32;
  function capeFrames(w, h) {
    if (w % 64 !== 0 || w < 64 || w > 512 || h <= 0 || h % (w / 2) !== 0) return 0;
    const n = h / (w / 2);
    return n <= CAPE_MAX_FRAMES ? n : 0;
  }
  const validCapeSize = (w, h) => capeFrames(w, h) > 0;
  // Czapka z teksturą szeroką na co najmniej 128 px (klatka 128×64) jest wysoka: druga kostka nad głową z prawej połowy
  // tekstury (od x = 64), węższa to zwykła czapka jak hełm (od 0.25.0; w modzie Cosmetics.tallHat)
  const hatModel = w => (w >= 128 ? 'tall' : 'helmet');

  // Model 3D kosmetyku (od 0.33.0: czapki ze stożkiem, rondem, uszami, porożem, śmigłem; kotylion na piersi). Prostopadłościany
  // jak w modelach Minecrafta (Blockbench, „box UV”) zapisane w samej teksturze PNG — kawałek tEXt „mib-model” z JSON-em —
  // więc model jedzie wszędzie razem z teksturą (baza, sklep, prezenty, players.json i capes/ dla gry). Jednostki to piksele
  // skina, osie jak w modelu gry: y w dół, przód głowy w stronę −z, x+ to lewa strona postaci; „bone” head albo body
  // (środek obrotu obu na szyi), pivot i rot (stopnie, kolejność Z·Y·X jak PartPose) dla całej części, spin = obrót wokół
  // osi y części w stopniach na sekundę, boxes: [u, v, x, y, z, w, h, d, powiększenie?] w układzie tekstury jednej klatki
  // (szerokość × szerokość/2). W modzie to samo sprawdza CosmeticModel.java (wspólne przykłady w testach).
  const MODEL_KEY = 'mib-model', MODEL_MAX_PARTS = 32, MODEL_MAX_BOXES = 128;
  function bytesOf(src) {
    if (typeof src !== 'string') return src;
    const b64 = src.slice(src.indexOf(',') + 1);
    if (typeof Buffer !== 'undefined') return Buffer.from(b64, 'base64');
    const s = atob(b64), out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  // Tekst z kawałka tEXt o danym kluczu albo null
  function pngText(buf, key) {
    const u32 = o => ((buf[o] << 24) >>> 0) + (buf[o + 1] << 16) + (buf[o + 2] << 8) + buf[o + 3];
    for (let o = 8; o + 12 <= buf.length;) {
      const len = u32(o), type = String.fromCharCode(buf[o + 4], buf[o + 5], buf[o + 6], buf[o + 7]);
      if (o + 12 + len > buf.length || type === 'IEND') return null;
      if (type === 'tEXt') {
        let k = '', i = o + 8;
        for (; i < o + 8 + len && buf[i] !== 0; i++) k += String.fromCharCode(buf[i]);
        if (k === key) {
          let s = '';
          for (i++; i < o + 8 + len; i++) s += String.fromCharCode(buf[i]);
          return s;
        }
      }
      o += 12 + len;
    }
    return null;
  }
  const num = (v, lim) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= lim;
  const vec = (v, lim) => (v === undefined ? [0, 0, 0] : Array.isArray(v) && v.length === 3 && v.every(x => num(x, lim)) ? v.slice() : null);
  // Model z JSON-u sprawdzony pod teksturę tw×th albo null (zły model = czapka jak dotąd: hełm albo wysoka)
  function checkModel(j, tw, th) {
    if (!j || typeof j !== 'object' || !Array.isArray(j.parts) || !j.parts.length || j.parts.length > MODEL_MAX_PARTS) return null;
    const parts = [];
    let count = 0;
    for (const p of j.parts) {
      if (!p || typeof p !== 'object' || !Array.isArray(p.boxes)) return null;
      const bone = p.bone === undefined ? 'head' : p.bone, pivot = vec(p.pivot, 64), rot = vec(p.rot, 360), spin = p.spin === undefined ? 0 : p.spin;
      if (!['head', 'body', 'pet'].includes(bone) || !pivot || !rot || !num(spin, 7200)) return null;
      // ruch części (od 0.34.0): kołysanie, łapki przy chodzie, poza przy kucaniu, widoczność na jawie/we śnie
      // brak pola = bez ruchu; null albo coś innego = zły model (jak w CosmeticModel.java)
      const wave = p.wave === undefined ? null : p.wave, step = p.step === undefined ? 0 : p.step, sit = p.sit === undefined ? null : p.sit;
      const state = p.state === undefined ? null : p.state;
      if (p.wave === null || p.sit === null || p.state === null) return null;
      if (wave !== null && !(Array.isArray(wave) && wave.length === 5 && wave.slice(0, 3).every(a => num(a, 180)) && num(wave[3], 10) && wave[3] > 0
        && num(wave[4], 1) && wave[4] >= 0)) return null;
      if (!num(step, 90) || (sit !== null && !(Array.isArray(sit) && sit.length === 4 && sit.slice(0, 3).every(a => num(a, 180)) && num(sit[3], 16)))) return null;
      if (state !== null && state !== 'awake' && state !== 'sleep') return null;
      const boxes = [];
      for (const b of p.boxes) {
        if (!Array.isArray(b) || (b.length !== 8 && b.length !== 9) || !b.every(x => num(x, 512))) return null;
        const [u, v, x, y, z, w, h, d, inf = 0] = b;
        if (![u, v, w, h, d].every(Number.isInteger) || u < 0 || v < 0 || w < 0 || h < 0 || d < 0 || w > 64 || h > 64 || d > 64) return null;
        if (u + 2 * (w + d) > tw || v + d + h > th || ![x, y, z].every(c => num(c, 64)) || !num(inf, 8)) return null;
        boxes.push([u, v, x, y, z, w, h, d, inf]);
      }
      count += boxes.length;
      if (!boxes.length || count > MODEL_MAX_BOXES) return null;
      parts.push({ bone, pivot, rot, spin, boxes, wave: wave && wave.slice(), step, sit: sit && sit.slice(), state });
    }
    return { w: tw, h: th, parts };
  }
  // Model z tekstury (Uint8Array, Buffer albo data:image/png;base64,…) albo null
  function cosmeticModel(src) {
    let buf;
    try { buf = bytesOf(src); } catch { return null; }
    const info = pngInfo(buf);
    if (!info || capeFrames(info.width, info.height) < 1) return null;
    const txt = pngText(buf, MODEL_KEY);
    if (txt == null) return null;
    try { return checkModel(JSON.parse(txt), info.width, info.width / 2); } catch { return null; }
  }
  // Poza części w chwili t (sekundy) i stanie gracza ctx = { t, run, sleep, crouch, walk (0..1 siła kroku), phase (krok, radiany) }:
  // obrót [x, y, z] w stopniach (rot + kręcenie + kołysanie + łapki + kucanie), przesunięcie w dół dy i czy widać część.
  // Bez pamięci — w modzie to samo liczy Pets.pose (wspólne liczby w testach).
  function partPose(part, ctx) {
    const c = ctx || {}, t = c.t || 0, rot = part.rot.slice();
    let dy = 0;
    if (part.spin) rot[1] += (part.spin * t) % 360;
    if (part.wave) {
      const [ax, ay, az, hz0, ph] = part.wave, hz = hz0 * (c.run ? 1.8 : 1), k = (c.run ? 1.4 : 1) * (c.sleep ? 0.3 : 1);
      const sw = Math.sin(2 * Math.PI * (hz * t + ph)) * k;
      rot[0] += ax * sw; rot[1] += ay * sw; rot[2] += az * sw;
    }
    if (part.step) rot[0] += part.step * Math.sin(c.phase || 0) * (c.walk || 0);
    if (c.crouch && part.sit) { rot[0] += part.sit[0]; rot[1] += part.sit[1]; rot[2] += part.sit[2]; dy = part.sit[3]; }
    const visible = !part.state || (part.state === 'sleep') === !!c.sleep;
    return { rot, dy, visible };
  }
  // Gdzie jest pet (kotwica pod łapkami) w pikselach modelu gracza: y w dół od szyi, x+ = lewa strona; tryby jak w Pets.anchor
  const PET_MODES = ['fly', 'shoulder', 'walk'], PET_SLEEP_MS = 30000;
  // Ustawienia peta z bazy albo z pliku: znane wartości, imię do 16 znaków bez znaków sterujących (inaczej puste)
  function petSettings(x) {
    const o = x && typeof x === 'object' ? x : {}, name = typeof o.name === 'string' ? o.name.trim() : '';
    return { mode: PET_MODES.includes(o.mode) ? o.mode : 'fly', side: o.side === 'right' ? 'right' : 'left',
      name: name.length <= 16 && !/[\u0000-\u001f\u007f]/.test(name) ? name : '' };
  }
  function petAnchor(mode, side, t, sleep) {
    const s = side === 'right' ? -1 : 1;
    if (mode === 'shoulder') return { bone: 'body', pos: [s * 6, 0, 0], scale: 0.6 };
    if (mode === 'walk') return { bone: 'root', pos: [s * 14, 24, 3], scale: 1 };
    return { bone: 'root', pos: [s * 11, -3 + (sleep ? 1 : 1.2 * Math.sin(2 * Math.PI * 0.5 * (t || 0))), 1], scale: 0.8 };
  }
  // UV prostopadłościanu w kolejności ścian BoxGeometry z three.js (px, nx, py, ny, pz, nz) — tak jak skinview3d układa skina
  function boxUVs(u, v, w, h, d, tw, th) {
    const f = (x0, y0, x1, y1) => [[x0 / tw, 1 - y1 / th], [x1 / tw, 1 - y1 / th], [x1 / tw, 1 - y0 / th], [x0 / tw, 1 - y0 / th]];
    const top = f(u + d, v, u + w + d, v + d), bottom = f(u + w + d, v, u + 2 * w + d, v + d);
    const right = f(u, v + d, u + d, v + d + h), front = f(u + d, v + d, u + w + d, v + d + h);
    const left = f(u + w + d, v + d, u + w + 2 * d, v + h + d), back = f(u + w + 2 * d, v + d, u + 2 * w + 2 * d, v + h + d);
    const order = [[left, 3, 2, 0, 1], [right, 3, 2, 0, 1], [top, 3, 2, 0, 1], [bottom, 0, 1, 3, 2], [front, 3, 2, 0, 1], [back, 3, 2, 0, 1]];
    const out = [];
    for (const [q, ...ix] of order) for (const i of ix) out.push(q[i][0], q[i][1]);
    return out;
  }
  // Obrót Z·Y·X (stopnie) punktu p
  function rotZYX(p, r) {
    const [ax, ay, az] = r.map(a => a * Math.PI / 180);
    let [x, y, z] = p;
    [y, z] = [y * Math.cos(ax) - z * Math.sin(ax), y * Math.sin(ax) + z * Math.cos(ax)];
    [x, z] = [x * Math.cos(ay) + z * Math.sin(ay), -x * Math.sin(ay) + z * Math.cos(ay)];
    [x, y] = [x * Math.cos(az) - y * Math.sin(az), x * Math.sin(az) + y * Math.cos(az)];
    return [x, y, z];
  }
  // Ściany modelu widziane pod kątem (obrót yaw wokół pionu, potem pochylenie pitch — widać wierzch) do miniatury: od
  // najdalszej, każda z trzema rogami na ekranie (pole tekstury: lewy górny, prawy górny, lewy dolny), polem tekstury
  // [u, v, szer, wys] i jasnością jak w grze (góra 1, przód i tył 0,8, boki 0,6)
  function modelFaces(model, yaw, pitch) {
    const out = [];
    const view = p => {
      let [x, y, z] = rotZYX(p, [0, yaw, 0]);
      const a = pitch * Math.PI / 180;
      [y, z] = [y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];
      return [x, y, z];
    };
    for (const part of model.parts) for (const [u, v, x, y, z, w, h, d, inf] of part.boxes) {
      if (part.state === 'sleep') continue; // zamknięte oczy tylko we śnie
      const x0 = x - inf, y0 = y - inf, z0 = z - inf, x1 = x + w + inf, y1 = y + h + inf, z1 = z + d + inf;
      const P = (px, py, pz) => { const r = rotZYX([px, py, pz], part.rot); return view([r[0] + part.pivot[0], r[1] + part.pivot[1], r[2] + part.pivot[2]]); };
      const faces = [
        [[u + d, v + d, w, h], P(x0, y0, z0), P(x1, y0, z0), P(x0, y1, z0), 0.8],
        [[u + d, v, w, d], P(x0, y0, z1), P(x1, y0, z1), P(x0, y0, z0), 1],
        [[u, v + d, d, h], P(x0, y0, z1), P(x0, y0, z0), P(x0, y1, z1), 0.6],
        [[u + d + w, v + d, d, h], P(x1, y0, z0), P(x1, y0, z1), P(x1, y1, z0), 0.6],
        [[u + 2 * d + w, v + d, w, h], P(x1, y0, z1), P(x0, y0, z1), P(x1, y1, z1), 0.8],
      ];
      for (const [uv, a, b, c, shade] of faces) {
        if (!uv[2] || !uv[3]) continue;
        // zwrot ściany: iloczyn wektorowy krawędzi na ekranie (rogi lewy górny → prawy górny → lewy dolny)
        const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
        if (cross <= 1e-6) continue;
        out.push({ uv, p: [a, b, c].map(q => [q[0], q[1]]), depth: (b[2] + c[2]) / 2, shade });
      }
    }
    return out.sort((m, n) => n.depth - m.depth);
  }

  // Znajomi, którzy właśnie weszli do gry (wcześniej poza grą albo nowi na liście). prev = mapa id -> status
  // z poprzedniego sprawdzenia; null = pierwsze sprawdzenie (bez powiadomień o tych, którzy już grają)
  function friendsStarted(prev, list) {
    const map = {}, started = [];
    for (const f of list || []) {
      if (!f || f.state !== 'friend') continue;
      map[f.id] = f.status;
      if (prev && f.status === 'game' && prev[f.id] !== 'game') started.push(f);
    }
    return { started, map };
  }
  // Nowe zaproszenia do gry: każde (od kogo + kiedy) tylko raz
  function newInvites(seen, invites) {
    const keys = new Set(), fresh = [];
    for (const i of invites || []) {
      const k = i.from_id + '@' + i.created_at;
      keys.add(k);
      if (!seen || !seen.has(k)) fresh.push(i);
    }
    return { fresh, seen: keys };
  }
  // Nowe wiadomości do powiadomień: od kogo przybyło coś od ostatniego sprawdzenia. seen = id nadawcy -> ostatnie
  // id wiadomości; null = pierwsze sprawdzenie (bez powiadomień o tym, co czekało wcześniej — to pokazuje licznik)
  function newMessages(seen, unread) {
    const map = {}, fresh = [];
    for (const u of unread || []) {
      const last = Number(u.last_id) || 0, before = (seen && seen[u.from_id]) || 0;
      map[u.from_id] = Math.max(last, before);
      if (seen && last > before) fresh.push(u);
    }
    return { fresh, seen: map };
  }
  // Nowe wiersze do powiadomień (prezenty, zmiany w pomysłach): każdy klucz tylko raz; seen null = pierwsze sprawdzenie
  // bez powiadomień (to, co czekało, pokazuje okno prezentu albo licznik)
  function freshKeys(seen, rows, key) {
    const keys = new Set(), fresh = [];
    for (const r of rows || []) {
      const k = key(r);
      keys.add(k);
      if (seen && !seen.has(k)) fresh.push(r);
    }
    return { fresh, seen: keys };
  }
  const IDEA_STATUS = { pl: { new: 'Wysłany', seen: 'Przeczytany', planned: 'W planach', done: 'Zrobione', rejected: 'Odrzucony' },
    en: { new: 'Sent', seen: 'Read', planned: 'Planned', done: 'Done', rejected: 'Declined' } };
  // Powiadomienie { type: 'started' | 'invite' | 'message' | 'gift' | 'idea', nick, version, server, text, status } -> { title, body }
  function friendNotice(n, lang) {
    const en = lang === 'en';
    if (n.type === 'news') return { title: en ? 'Important news' : 'Ważna aktualność', body: String(n.text || '') };
    // święta (od 0.25.0): nagroda świąteczna albo nowe okienko kalendarza adwentowego (kind: gift / advent)
    if (n.type === 'holiday') return n.kind === 'advent'
      ? { title: en ? 'Advent calendar' : 'Kalendarz adwentowy', body: en ? 'A new window (' + n.day + ' December) is waiting on the launcher home page.' : 'Nowe okienko (' + n.day + ' grudnia) czeka na stronie głównej launchera.' }
      : { title: en ? 'Holiday reward' : 'Nagroda świąteczna', body: (en ? n.name + ': claim your reward on the launcher home page.' : n.name + ': odbierz nagrodę na stronie głównej launchera.') };
    if (n.type === 'gift') return { title: (en ? 'A gift from ' : 'Prezent od ') + (n.nick || 'MiB'),
      body: (en ? n.text + ' is waiting for you. Claim it in the launcher.' : n.text + ' czeka na Ciebie. Odbierz w launcherze.') };
    if (n.type === 'idea') {
      const st = IDEA_STATUS[en ? 'en' : 'pl'][n.status] || n.status, r = String(n.text || '');
      return { title: en ? 'Your idea got an answer' : 'Odpowiedź na Twój pomysł',
        body: (en ? 'Status: ' : 'Status: ') + st + (r ? ' — ' + (r.length > 120 ? r.slice(0, 119) + '…' : r) : '') };
    }
    if (n.type === 'message') {
      const t = String(n.text || '');
      return { title: (en ? 'Message from ' : 'Wiadomość od ') + n.nick, body: t.length > 140 ? t.slice(0, 139) + '…' : t };
    }
    // party (od 0.38.0): zaproszenie, lider gra na serwerze (Dołącz), wiadomość na czacie party
    if (n.type === 'party_invite') return { title: en ? 'Party invite' : 'Zaproszenie do party',
      body: en ? n.nick + ' invites you to a party. Answer on the Friends page.' : n.nick + ' zaprasza Cię do party. Odpowiedz na stronie Znajomi.' };
    if (n.type === 'party_play') return { title: en ? 'Your party is playing' : 'Party gra',
      body: en ? 'Leader ' + n.nick + ' is playing on ' + n.server + ' (Minecraft ' + n.version + ') — Join' : 'Lider ' + n.nick + ' gra na ' + n.server + ' (Minecraft ' + n.version + ') — Dołącz' };
    if (n.type === 'party_msg') {
      const t = String(n.text || '');
      return { title: 'Party — ' + n.nick, body: t.length > 140 ? t.slice(0, 139) + '…' : t };
    }
    if (n.type === 'invite') return { title: en ? 'Game invite' : 'Zaproszenie do gry',
      body: en ? n.nick + ' invites you to play on ' + n.server + ' (Minecraft ' + n.version + ').' : n.nick + ' zaprasza Cię do gry na ' + n.server + ' (Minecraft ' + n.version + ').' };
    const v = n.version ? ' ' + n.version : '', srv = n.server ? (en ? ' on ' : ' na ') + n.server : '';
    return { title: en ? 'Friend playing' : 'Znajomy w grze', body: n.nick + (en ? ' is now playing Minecraft' : ' gra teraz w Minecraft') + v + srv + '.' };
  }

  // ===== Party (od 0.38.0) =====
  const PARTY_MAX = 8;
  // Lider gra na serwerze, a ja nie jestem na tym samym: { key, nick, server, version } do „Lider gra na X — Dołącz”;
  // key zmienia się przy zmianie serwera albo wersji lidera (wtedy nowe powiadomienie), null = nic do pokazania
  function partyPlay(s) {
    if (!s || !Array.isArray(s.members) || !s.leader || s.leader === s.me) return null;
    const l = s.members.find(m => m.id === s.leader), me = s.members.find(m => m.id === s.me);
    if (!l || l.status !== 'game' || !l.server || !l.version) return null;
    if (me && me.status === 'game' && me.server === l.server && me.version === l.version) return null;
    return { key: l.id + '|' + l.server + '|' + l.version, nick: l.nick, server: l.server, version: l.version };
  }
  // Party jako wpis na liście znajomych w menu gry (friends.json): „Party (3/8)”, status i serwer lidera, członkowie
  // w jednej linii (lider pierwszy z gwiazdką), nowe wiadomości czatu party; null = nie jestem w party
  function partyEntry(s, unread = 0) {
    if (!s || !Array.isArray(s.members) || !s.members.length) return null;
    const l = s.members.find(m => m.id === s.leader) || s.members[0];
    const rest = s.members.filter(m => m !== l);
    return { id: 'party', nick: 'Party (' + s.members.length + '/' + PARTY_MAX + ')', status: l.status || 'offline', server: l.status === 'game' ? l.server || null : null,
      unread: Math.max(0, Number(unread) || 0), party: true, members: ['★' + l.nick, ...rest.map(m => m.nick)].join(' · ') };
  }
  // Wiadomości czatu party do menu gry: cudze z nickiem na początku (rozmowa w grze nie ma podpisów)
  function partyChatRows(rows, clean = t => t) {
    return (Array.isArray(rows) ? rows : []).map(m => ({ id: Number(m.id), mine: !!m.mine, read: true, body: m.mine ? String(m.body) : (m.nick || '?') + ': ' + clean(String(m.body)) }));
  }

  // Pomysł gracza: te same limity sprawdza baza (submit_idea)
  const IDEA_CATEGORIES = ['feature', 'cosmetic', 'bug', 'other'];
  function validateIdea({ category, body } = {}) {
    if (!IDEA_CATEGORIES.includes(category)) return 'idea_category';
    const n = String(body == null ? '' : body).trim().length;
    if (n < 10) return 'idea_short';
    if (n > 1000) return 'idea_long';
    return null;
  }

  // Osiągnięcia liczone z liczb profilu (profile_card): [id, nazwa, opis, liczba, cel]; founder to 0 albo 1
  const ACHIEVEMENTS = [
    ['first_game', 'Pierwsza gra', 'Uruchom grę przez MiB Client.', 'launches', 1],
    ['regular', 'Stały bywalec', 'Uruchom grę 100 razy.', 'launches', 100],
    ['hours_10', '10 godzin w grze', 'Graj 10 godzin przez MiB Client.', 'playtime_min', 600],
    ['veteran', 'Weteran', 'Graj 100 godzin przez MiB Client.', 'playtime_min', 6000],
    ['friend', 'Pierwszy znajomy', 'Dodaj pierwszego znajomego.', 'friends', 1],
    ['squad', 'Paczka', 'Miej 5 znajomych.', 'friends', 5],
    ['popular', 'Popularny', 'Miej 20 znajomych.', 'friends', 20],
    ['idea', 'Pomysłowy', 'Wyślij pomysł w zakładce Pomysły.', 'ideas', 1],
    ['idea_done', 'Twój pomysł w MiB', 'Twórca zrobił Twój pomysł.', 'ideas_done', 1],
    ['bug_hunter', 'Łowca błędów', 'Zgłoś błąd, za który twórca da nagrodę.', 'bugs_found', 1],
    ['collector', 'Kolekcjoner', 'Zbierz 5 kosmetyków.', 'owned', 5],
    ['time_traveler', 'Podróżnik w czasie', 'Zagraj w 5 wersjach Minecrafta.', 'versions', 5],
    ['founder', 'Założyciel', 'Jeden z pierwszych 1000 profili MiB.', 'founder', 1],
  ];
  function achievements(card) {
    const c = card || {};
    return ACHIEVEMENTS.map(([id, name, desc, stat, goal]) => {
      const v = stat === 'founder' ? (c.founder ? 1 : 0) : Math.max(0, Number(c[stat]) || 0);
      return { id, name, desc, goal, value: Math.min(v, goal), done: v >= goal };
    });
  }
  // Lista zmian z build/release-notes.md (okno „Co nowego”): sekcje „## Dodane” itd. z punktami „- …”
  function releaseNotes(md) {
    const out = [];
    for (const line of String(md || '').split(/\r?\n/)) {
      const hd = /^##\s+(.+?)\s*$/.exec(line), it = /^\s*[-*]\s+(.+?)\s*$/.exec(line);
      if (hd) out.push({ title: hd[1], items: [] });
      else if (it && out.length) out[out.length - 1].items.push(it[1]);
    }
    return out.filter(x => x.items.length);
  }

  // Filtr wulgaryzmów (wiadomości i pomysły innych graczy): słowo z przekleństwem to pierwsza litera i gwiazdki.
  // Słowo porównujemy po uproszczeniu: małe litery bez polskich znaków, cyfry i znaki jak litery (k0rw4, $hit), bez kropek
  // w środku (k.u.r.w.a), a druga wersja także bez powtórzeń liter (kuuurwa). BAD_PART: fragment słowa, BAD_WORD: całe słowo.
  const BAD_PART = ['kurw', 'chuj', 'pierdol', 'pierdal', 'jeb', 'pizd', 'kutas', 'dziwk', 'cwel', 'fuck', 'shit', 'bitch', 'nigg', 'faggot', 'whore', 'ashol'];
  const BAD_WORD = /^(huj\w*|cip(a|y|e|o|ka|ki|ko|ke)|fiut(a|y|em|ami)?|dick|dicks|cunt|cunts|slut|sluts|retard|retarded|ass|niga|nigas|niger|nigers)$/;
  const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's', '!': 'i' };
  const PL = { ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z' };
  function badWord(core) {
    const n1 = core.toLowerCase().replace(/./g, ch => LEET[ch] || PL[ch] || ch).replace(/[^a-z]/g, ''), n2 = n1.replace(/(.)\1+/g, '$1');
    if (n1.length < 3) return false;
    return BAD_PART.some(b => n1.includes(b) || n2.includes(b)) || BAD_WORD.test(n1) || BAD_WORD.test(n2);
  }
  function cleanText(text) {
    return String(text == null ? '' : text).replace(/\S+/g, tok => {
      const m = /^([("'„«]*)(.*?)([.,!?;:)"'”»…]*)$/.exec(tok), core = m[2];
      return core && badWord(core) ? m[1] + core[0] + '*'.repeat(core.length - 1) + m[3] : tok;
    });
  }

  // Link do sklepu MiB Coins (od 0.23.0): tylko https z domeną, bez spacji i znaków HTML, do 300 znaków (tak samo sprawdza baza)
  const validShopUrl = u => typeof u === 'string' && u.length <= 300 && /^https:\/\/[^\s<>"'\/]+\.[^\s<>"']+$/.test(u);

  // Skrzydła (od 0.22.0): tekstura szeroka na co najmniej 128 pikseli to skrzydła jak u wróżki (klatka 128×64: przód
  // skrzydła w polu 16×20 od (0,0) w jednostkach 64×32, tył od (16,0)), węższa to elytra. Tak samo w modzie.
  const wingsModel = w => (w >= 128 ? 'fairy' : 'elytra');

  // Aury (od 0.22.0): ruch cząsteczek z końcówki id kosmetyku, obrazki 8×8 w pierwszym rzędzie tekstury 64×32.
  // Cząsteczki to funkcja czasu (bez stanu), więc launcher i mod (Auras.java) liczą je tak samo.
  // od 0.25.0 także snow (opadają z góry: śnieg, płatki, konfetti) i burst (fajerwerki nad głową)
  const AURA_STYLES = ['souls', 'pumpkins', 'ghosts', 'magic', 'snow', 'burst'];
  const auraStyle = id => AURA_STYLES.find(s => typeof id === 'string' && id.endsWith('_' + s)) || null;
  function h32(x) {
    x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
    x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
    return (x ^ (x >>> 16)) >>> 0;
  }
  const rnd = (seed, i, k, j) => h32(seed ^ Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(k, 0x85ebca77) ^ Math.imul(j + 1, 0xc2b2ae3d)) / 4294967296;
  // Cząsteczka i z n, która żyje od l0 do l1 sekund i rodzi się od nowa: { age, life, k (numer życia) }
  function cycle(seed, i, t, l0, l1) {
    const life = l0 + (l1 - l0) * rnd(seed, i, 0, 0), tt = t + rnd(seed, i, 0, 1) * life, k = Math.floor(tt / life);
    return { age: tt - k * life, life, k };
  }
  // Cząsteczki aury w chwili t (sekundy) dla gracza o numerze seed: x, z w poziomie i y od stóp w pikselach postaci
  // (blok = 16), cell = komórka tekstury, size = rozmiar piksela obrazka, alpha = krycie
  function auraParticles(style, t, seed) {
    const out = [], TAU = Math.PI * 2;
    const add = (x, y, z, cell, size, alpha) => out.push({ x, y, z, cell, size, alpha });
    if (style === 'ghosts') {
      for (let i = 0; i < 3; i++) { const a = -t * 0.9 + i * TAU / 3; add(Math.cos(a) * 16, 17 + Math.sin(t * 2.2 + i * 2) * 4, Math.sin(a) * 16, 0, 0.9, 0.9); }
    } else if (style === 'souls') {
      for (let i = 0; i < 22; i++) {
        const c = cycle(seed, i, t, 1.1, 1.8), a = rnd(seed, i, c.k, 2) * TAU, r = 7 + 5 * rnd(seed, i, c.k, 3);
        add(Math.cos(a) * r, 2 * rnd(seed, i, c.k, 4) + (6 + 4 * rnd(seed, i, c.k, 5)) * c.age, Math.sin(a) * r,
          c.age < c.life * 0.4 ? 0 : c.age < c.life * 0.75 ? 1 : 2, 0.7, Math.min(1, (c.life - c.age) * 4));
      }
    } else if (style === 'pumpkins') {
      for (let i = 0; i < 8; i++) {
        const c = cycle(seed, i, t, 2.4, 2.4), a = rnd(seed, i, c.k, 2) * TAU + c.age * 1.8, r = 9 + 2 * rnd(seed, i, c.k, 3);
        add(Math.cos(a) * r, 2 + 2 * rnd(seed, i, c.k, 4) + 9 * c.age, Math.sin(a) * r, 0, 0.9, Math.min(1, (c.life - c.age) * 3));
      }
      for (let i = 100; i < 116; i++) {
        const c = cycle(seed, i, t, 0.6, 1.2), a = rnd(seed, i, c.k, 2) * TAU, r = 4 + 9 * rnd(seed, i, c.k, 3);
        add(Math.cos(a) * r, 6 * rnd(seed, i, c.k, 4) + (8 + 6 * rnd(seed, i, c.k, 5)) * c.age, Math.sin(a) * r, c.age % 0.2 < 0.1 ? 1 : 2, 0.8, Math.min(1, (c.life - c.age) * 3));
      }
    } else if (style === 'magic') {
      for (let i = 0; i < 60; i++) {
        const c = cycle(seed, i, t, 1.4, 2), a = (t - c.age) * 5 + (rnd(seed, i, c.k, 2) - 0.5) * 0.6 + c.age * 2.2, r = 10 - c.age * 3;
        add(Math.cos(a) * r, 1 + (14 + 4 * rnd(seed, i, c.k, 3)) * c.age, Math.sin(a) * r, c.age % 0.3 < 0.15 ? 0 : 1, 0.7, Math.min(1, (c.life - c.age) * 2));
      }
    } else if (style === 'snow') {
      for (let i = 0; i < 26; i++) {
        const c = cycle(seed, i, t, 2.6, 4), a = rnd(seed, i, c.k, 2) * TAU, r = 4 + 10 * rnd(seed, i, c.k, 3), sw = Math.sin(c.age * 2 + rnd(seed, i, c.k, 4) * TAU) * 1.2;
        add(Math.cos(a) * r + sw, 38 - 36 * c.age / c.life, Math.sin(a) * r, Math.floor(rnd(seed, i, c.k, 5) * 3), 0.7, Math.min(1, c.age * 3, (c.life - c.age) * 3));
      }
    } else if (style === 'burst') {
      for (let b = 0; b < 3; b++) {
        const c = cycle(seed, 200 + b, t, 1.4, 1.8), cx = (rnd(seed, 200 + b, c.k, 2) - 0.5) * 14, cy = 30 + 4 * rnd(seed, 200 + b, c.k, 3), cz = (rnd(seed, 200 + b, c.k, 4) - 0.5) * 14;
        const d = 7 * (1 - Math.pow(1 - c.age / c.life, 2)), alpha = Math.min(1, c.age * 8, (c.life - c.age) * 3);
        for (let j = 0; j < 12; j++) {
          const th = j * TAU / 12 + b, el = ((j % 3) - 1) * 0.6;
          add(cx + Math.cos(th) * Math.cos(el) * d, cy + Math.sin(el) * d - 3 * c.age * c.age, cz + Math.sin(th) * Math.cos(el) * d, b, 0.6, alpha);
        }
      }
    }
    return out;
  }

  // ===== Motywy świąteczne (od 0.25.0): te same daty co w bazie (public.themes, private.theme_season) i w modzie (Theme) =====
  // Daty: 'MM-DD' albo 'E-7' / 'E+2' (dni od Wielkanocy). Bez połączenia z bazą launcher używa tych wbudowanych.
  const DEFAULT_THEMES = [['niepodleglosc', '11-08', '11-12'], ['boze', '12-01', '01-06'], ['sylwester', '12-31', '01-01'], ['walentynki', '02-10', '02-15'],
    ['wielkanoc', 'E-7', 'E+2'], ['primaaprilis', '04-01', '04-01'], ['urodzinymc', '05-17', '05-17'], ['dziendziecka', '06-01', '06-01'], ['wakacje', '06-25', '08-31'],
    ['urodzinymib', '10-10', '10-14'], ['halloween', '10-15', '11-05']].map(([id, starts, ends], i) => ({ id, starts, ends, enabled: true, forced: false, sort: i + 1 }));
  const THEME_IDS = DEFAULT_THEMES.map(t => t.id);
  const day0 = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  // Wielkanoc w roku y (algorytm Meeusa/Jonesa/Butchera)
  function easter(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    return new Date(y, Math.floor((h + l - 7 * m + 114) / 31) - 1, ((h + l - 7 * m + 114) % 31) + 1);
  }
  const validThemeDate = spec => /^(\d\d-\d\d|E[+-]\d{1,2})$/.test(String(spec || ''));
  function themeDate(spec, y) {
    if (spec[0] === 'E') { const e = easter(y); return new Date(e.getFullYear(), e.getMonth(), e.getDate() + Number(spec.slice(1))); }
    return new Date(y, Number(spec.slice(0, 2)) - 1, Number(spec.slice(3, 5)));
  }
  // Okres motywu, który trwa w dniu d albo zaczyna się najbliższy po nim: { season, from, to }
  function themeSpan(t, d) {
    const day = day0(d);
    for (let y = day.getFullYear() - 1; y <= day.getFullYear() + 1; y++) {
      const from = themeDate(t.starts, y);
      let to = themeDate(t.ends, y);
      if (to < from) to = themeDate(t.ends, y + 1);
      if (to >= day) return { season: y, from, to };
    }
    return null;
  }
  // Rok sezonu, gdy motyw trwa w dniu d (null: nie trwa albo wyłączony); wymuszony („Włącz teraz”) trwa zawsze
  function themeSeason(t, d) {
    if (!t || !t.enabled) return null;
    if (t.forced) return day0(d).getFullYear();
    if (!validThemeDate(t.starts) || !validThemeDate(t.ends)) return null;
    const sp = themeSpan(t, d), day = day0(d);
    return sp && day >= sp.from && day <= sp.to ? sp.season : null;
  }
  // Wygląd na dziś: wymuszony, a z trwających ten najkrótszy (Sylwester na wierzchu Bożego Narodzenia); '' = zwykły
  function themeNow(themes, d = new Date()) {
    const list = (Array.isArray(themes) && themes.length ? themes : DEFAULT_THEMES).filter(t => t && THEME_IDS.includes(t.id));
    const forced = list.find(t => t.enabled && t.forced);
    if (forced) return forced.id;
    let best = null, len = Infinity;
    for (const t of list) {
      if (themeSeason(t, d) == null) continue;
      const sp = themeSpan(t, d), n = sp.to - sp.from;
      if (n < len) { best = t; len = n; }
    }
    return best ? best.id : '';
  }
  // Profil MiB po zalogowaniu kontem Microsoft (od 0.26.0, profil za kontem od 0.27.0): 'none' — zostaje (ten sam
  // Minecraft, brak sieci, konto bez profilu), 'link' — profil e-mail łączymy z tym kontem, 'login' — profil tego konta
  // (zalogowanie, założenie albo przełączenie z profilu innego konta)
  function mcProfileAction(st, mcUuid) {
    if (!st || st.offline || st.needsProfile || st.loading) return 'none';
    const u = s => String(s || '').replace(/-/g, '').toLowerCase();
    if (st.loggedIn && st.mcUuid && u(st.mcUuid) === u(mcUuid)) return 'none';
    if (st.loggedIn && !st.mcUuid) return 'link';
    return 'login';
  }
  // Sklep do oglądania bez logowania (od 0.35.0): kosmetyki z ceną, a z kolekcji świątecznych tylko w czasie święta —
  // to samo co private.on_sale w bazie (tabele cosmetics i themes czytają wszyscy)
  function browseCatalog(list, themes, d = new Date()) {
    const th = Array.isArray(themes) ? themes.filter(t => t && Array.isArray(t.items)) : [];
    return (Array.isArray(list) ? list : []).filter(c => {
      if (!c || c.price == null) return false;
      const of = th.filter(t => t.items.includes(c.id));
      return !of.length || of.some(t => themeSeason(t, d) != null);
    });
  }
  // Zgodność z 0.24.0: tylko Halloween według dat wbudowanych
  function season(d = new Date()) {
    return themeNow(DEFAULT_THEMES, d) === 'halloween' ? 'halloween' : '';
  }

  return { STYLES, STYLE_IDS, styleOf, stylePalette, styleCss, styleGame, styleCode, parseStyleCode, mcProfileAction, browseCatalog, PARTY_MAX, partyPlay, partyEntry, partyChatRows, season, DEFAULT_THEMES, THEME_IDS, easter, themeDate, themeSpan, themeSeason, themeNow, validThemeDate, IDEA_CATEGORIES, achievements, releaseNotes, cleanText, validateIdea, pngInfo, validCapeSize, capeFrames, CAPE_FRAME_MS, validShopUrl, wingsModel, hatModel, cosmeticModel, boxUVs, modelFaces, partPose, petAnchor, petSettings, PET_MODES, PET_SLEEP_MS, AURA_STYLES, auraStyle, auraParticles, h32, friendsStarted, newInvites, newMessages, freshKeys, friendNotice, SYNCED_KEYS, sanitizeSynced, validateNick, formatMibId, newRecoveryCode, normalizeRecoveryCode, pickSynced, mergeSettings, clampSessionMinutes, favouriteVersion, formatPlaytime, backupDecision };
});
