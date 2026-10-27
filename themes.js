// Motywy świąteczne launchera (od 0.25.0): który motyw jest dziś (daty z bazy, bez sieci wbudowane), klasa t-<id> na
// <html>, ozdoby w #hw, cząsteczki w tle (konfiguracja dla ui.js), żarty na Prima Aprilis i motyw dla gry (-Dmib.theme).
// Halloween ma swoje ozdoby w index.html i style.css; pozostałe motywy rysują tu pikselowe obrazki z siatek znaków.
(() => {
  const root = document.documentElement, P = window.MibProfile;
  const KEY = 'mib-themes', OFF = 'mibthemes';
  const read = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
  let themes = null, current = '';
  try { themes = JSON.parse(read(KEY, 'null')); } catch {}
  const listeners = [];

  // ===== Pikselowe obrazki: siatka znaków + paleta → data URL (skala 1, CSS powiększa bez wygładzania) =====
  function img(rows, pal) {
    const c = document.createElement('canvas'); c.width = rows[0].length; c.height = rows.length;
    const x = c.getContext('2d');
    rows.forEach((r, j) => [...r].forEach((ch, i) => { if (pal[ch]) { x.fillStyle = pal[ch]; x.fillRect(i, j, 1, 1); } }));
    return 'url(' + c.toDataURL() + ')';
  }
  const FLAKE = ['W.W.W', '.WiW.', 'WiWiW', '.WiW.', 'W.W.W'];
  const HEART = ['.RR.RR.', 'REERRRR', 'RERRRRR', 'RRRRRRR', '.RRRRR.', '..RRR..', '...R...'];
  const BUTTER = [['V...V', 'VV.VV', '.VkV.', 'VV.VV', 'V...V'], ['.....', '.V.V.', 'VVkVV', '.V.V.', '.....']];
  const GRASS = ['AAAAA', 'AaAAa', 'DDdDD', 'DdDDD', 'DDDDd'];
  const BALLOON = ['.BBB.', 'BBBBB', 'BWBBB', 'BBBBB', '.BBB.', '..B..', '..s..', '..s..', '..s..'];
  const BAT = [['X.....X', '.XX.XX.', '..XXX..', '...X...'], ['..XXX..', '.XXXXX.', 'X..X..X']];
  const PUMP = ['....G....', '...GG....', '.oOOOOOo.', 'oOyOOOyOo', 'oOOOOOOOo', 'oOyOyOyOo', 'oOOyOyOOo', '.oOOOOOo.'];

  // ===== Cząsteczki w tle (ui.js): kolory odłamków, kierunek (-1 w górę, 1 w dół) i większe obrazki =====
  // flyers: side = przelatują w poprzek, fall = spadają, rise = lecą w górę; pals = losowa paleta dla każdego
  const FX = {
    '': { colors: ['#a855f7', '#c084fc', '#d6b0ff', '#7c3aed'], dir: -1 },
    halloween: { colors: ['#f97316', '#fb923c', '#fdba74', '#c2410c'], dir: -1, flyers: [
      { kind: 'side', n: 3, frames: BAT, pals: [{ X: '#4a2530' }], speed: [28, 54], size: [2, 3], alpha: 1 },
      { kind: 'side', n: 2, frames: [PUMP], pals: [{ G: '#65a30d', o: '#c2410c', O: '#ea580c', y: '#fde047' }], speed: [10, 20], size: [3, 4], alpha: 0.8 }] },
    niepodleglosc: { colors: ['#ffffff', '#fecdd3', '#dc143c', '#f43f5e'], dir: -1 },
    boze: { colors: ['#ffffff', '#f1f5f9', '#e0f2fe', '#bae6fd'], dir: 1, flyers: [
      { kind: 'fall', n: 8, frames: [FLAKE], pals: [{ W: '#ffffff', i: '#bfdbfe' }], speed: [14, 26], size: [2, 3], alpha: 0.85 }] },
    sylwester: { colors: ['#facc15', '#fde68a', '#22d3ee', '#f472b6'], dir: -1, bursts: ['#facc15', '#22d3ee', '#f472b6', '#ffffff'] },
    walentynki: { colors: ['#f43f5e', '#fda4af', '#fbcfe8', '#e11d48'], dir: -1, flyers: [
      { kind: 'rise', n: 6, frames: [HEART], pals: [{ R: '#f43f5e', E: '#fda4af' }, { R: '#ec4899', E: '#fbcfe8' }], speed: [14, 24], size: [2, 3], alpha: 0.8 }] },
    wielkanoc: { colors: ['#f9a8d4', '#fde68a', '#c4b5fd', '#bbf7d0'], dir: 1, flyers: [
      { kind: 'side', n: 2, frames: BUTTER, pals: [{ V: '#c4b5fd', k: '#3b1660' }, { V: '#fde68a', k: '#78350f' }], speed: [18, 30], size: [3, 3], alpha: 0.9 }] },
    primaaprilis: { colors: ['#22d3ee', '#f472b6', '#facc15', '#a3e635'], dir: -1 },
    urodzinymc: { colors: ['#6abe30', '#4b8a22', '#8b5a2b', '#a3e635'], dir: 1, flyers: [
      { kind: 'fall', n: 5, frames: [GRASS], pals: [{ A: '#6abe30', a: '#4b8a22', D: '#8b5a2b', d: '#5e3a1a' }], speed: [16, 28], size: [3, 4], alpha: 0.85 }] },
    dziendziecka: { colors: ['#dc143c', '#f97316', '#facc15', '#38bdf8'], dir: 1, flyers: [
      { kind: 'rise', n: 5, frames: [BALLOON], pals: ['#ef4444', '#facc15', '#38bdf8', '#a855f7', '#22c55e'].map(B => ({ B, W: '#ffffff', s: '#e5e7eb' })), speed: [12, 22], size: [3, 4], alpha: 0.9 }] },
    wakacje: { colors: ['#a5f3fc', '#22d3ee', '#ffffff', '#2dd4bf'], dir: -1 },
    urodzinymib: { colors: ['#a855f7', '#facc15', '#f472b6', '#22d3ee'], dir: 1 },
  };

  // ===== Ozdoby w #hw: [klasa, siatka lub klatki, paleta, skala, styl pozycji, tylko na stronie głównej] =====
  const DECOR = {
    niepodleglosc: [['flag', [['p.........', 'pWWWWWWWW.', 'pWWWWWWWWW', 'pWWWWWWWWW', 'pRRRRRRRRR', 'pRRRRRRRRR', 'pRRRRRRRR.', 'p.........', 'p', 'p', 'p', 'p', 'p'],
        ['p.........', 'pWWWWWWWWW', 'pWWWWWWWWW', 'pWWWWWWWW.', 'pRRRRRRRRR', 'pRRRRRRRR.', 'pRRRRRRRRR', 'p.........', 'p', 'p', 'p', 'p', 'p']],
      { W: '#f8fafc', R: '#dc143c', p: '#a8a29e' }, 4, 'left:236px;top:14px', false]],
    boze: [['lights', [['..............', 'kkk.......kkk.', '...kkk.kkk....', '......R.......', '.....RRR......', '......R.......'],
        ['..............', 'kkk.......kkk.', '...kkk.kkk....', '......Y.......', '.....YYY......', '......Y.......']], { k: '#1f3a27', R: '#ef4444', Y: '#facc15' }, 3, 'left:220px;right:0;top:0;background-repeat:repeat-x', false],
      ['tree', [['......Y......', '.....YYY.....', '......G......', '.....GGG.....', '....GGRGG....', '...GGGGGGG...', '....GGGGG....', '...GGYGGGG...', '..GGGGGGRGG..', '.GGGGGGGGGGG.', '...GGGGGGG...', '..GGBGGGGGG..', '.GGGGGGGYGGG.', 'GGGGGGGGGGGGG', '.....bbb.....', '.....bbb.....'],
        ['......y......', '.....yyy.....', '......G......', '.....GGG.....', '....GGYGG....', '...GGGGGGG...', '....GGGGG....', '...GGRGGGG...', '..GGGGGGBGG..', '.GGGGGGGGGGG.', '...GGGGGGG...', '..GGYGGGGGG..', '.GGGGGGGRGGG.', 'GGGGGGGGGGGGG', '.....bbb.....', '.....bbb.....']],
        { G: '#15803d', Y: '#facc15', y: '#fef3c7', R: '#ef4444', B: '#38bdf8', b: '#78350f' }, 4, 'left:244px;bottom:14px', true],
      ['gifts', ['..Y.....Y..', '.RYR...gYg.', 'RRYRR.ggYgg', 'YYYYY.YYYYY', 'RRYRR.ggYgg', 'RRYRR.ggYgg'], { R: '#dc2626', g: '#16a34a', Y: '#facc15' }, 4, 'left:306px;bottom:14px', true]],
    sylwester: [['stars', ['..........', '....Y.....', '...YYY....', '....Y.....', '..........'], { Y: '#facc15' }, 3, 'left:220px;right:0;top:4px;background-repeat:repeat-x;opacity:.8', false],
      ['bottle', ['...gg...', '...YY...', '...gg...', '..gggg..', '.gggggg.', '.gYYYYg.', '.gYKKYg.', '.gYYYYg.', '.gggggg.', '.gggggg.', '.gggggg.', '.gggggg.'], { g: '#14532d', Y: '#facc15', K: '#0b0610' }, 4, 'left:248px;bottom:14px', true],
      ['clock', ['..kkkkk..', '.kWWkWWk.', 'kWWWkWWWk', 'kWWWkWWWk', 'kkWWkWWkk', 'kWWWWWWWk', 'kWWWWWWWk', '.kWWkWWk.', '..kkkkk..'], { k: '#facc15', W: '#f8fafc' }, 4, 'left:290px;bottom:14px', true]],
    walentynki: [['hearts', ['............', '..RR.RR.....', '.RRRRRRR....', '..RRRRR.....', '...RRR......', '....R.......'], { R: '#f43f5e' }, 3, 'left:220px;right:0;top:2px;background-repeat:repeat-x;opacity:.75', false],
      ['bigheart', [['.RR...RR.', 'REER.RRRR', 'RERRRRRRR', 'RRRRRRRRR', '.RRRRRRR.', '..RRRRR..', '...RRR...', '....R....'], ['.........', '.RR...RR.', 'REERRRRRR', 'RERRRRRRR', '.RRRRRRR.', '..RRRRR..', '...RRR...', '....R....']],
        { R: '#e11d48', E: '#fda4af' }, 5, 'left:248px;bottom:16px', true]],
    wielkanoc: [['basket', ['..M..Y..q..', '.MMMYYYqqq.', '.MWMYRYqWq.', 'xXxXxXxXxXx', 'XxXxXxXxXxX', '.xXxXxXxXx.', '..XxXxXxX..'], { M: '#ec4899', Y: '#facc15', q: '#38bdf8', W: '#ffffff', R: '#ef4444', X: '#c9a24a', x: '#92702c' }, 4, 'left:248px;bottom:14px', true],
      ['bunny', ['.W.W..', '.WSWS.', '.W.W..', 'WWWW..', 'WkWWW.', 'WWWWW.', '.WWWWW', '.WWWWW', 'WW.WW.'], { W: '#f8fafc', S: '#f9a8d4', k: '#1c1424' }, 4, 'left:300px;bottom:14px', true]],
    urodzinymc: [['blocks', ['AAAAAAAAAAAAAAAAAAAAAAAA', 'AaAAaAAaAAAaAAaAAaAAaAAa', 'DDaDDDDDaDDDDDaDDDDaDDDD', 'DdDDDdDDDDdDDDdDDDDdDDDd', 'DDDdDDDDdDDDdDDDDdDDDdDD', 'DdDDDDdDDDDDDdDDDdDDDDDD'],
      { A: '#6abe30', a: '#4b8a22', D: '#8b5a2b', d: '#5e3a1a' }, 4, 'left:244px;bottom:14px', true]],
    dziendziecka: [['balloons', ['.RR..YY..QQ.', 'RRRRYYYYQQQQ', 'RWRRYWYYQWQQ', 'RRRRYYYYQQQQ', '.RR..YY..QQ.', '..s...s...s.', '...s..s..s..', '....s.s.s...', '.....sss....', '......s.....', '......s.....'],
      { R: '#ef4444', Y: '#facc15', Q: '#38bdf8', W: '#ffffff', s: '#e5e7eb' }, 4, 'left:250px;bottom:18px', true]],
    wakacje: [['sun', [['..Y..Y..Y..', '...........', 'Y..uuuuu..Y', '..uuuuuuu..', '..uuuuuuu..', 'Y.uuuuuuu.Y', '..uuuuuuu..', '..uuuuuuu..', 'Y..uuuuu..Y', '...........', '..Y..Y..Y..'],
        ['...........', '.Y...Y...Y.', '...uuuuu...', 'Y.uuuuuuu.Y', '..uuuuuuu..', '..uuuuuuu..', '..uuuuuuu..', 'Y.uuuuuuu.Y', '...uuuuu...', '.Y...Y...Y.', '...........']],
      { u: '#fde047', Y: '#fb923c' }, 4, 'left:240px;top:12px', false],
      ['palm', ['.gg.gg.', 'gggggg.', '.ggbgg.', 'g..b..g', '...b...', '...b...', '...b...', '..bb...', '..b....', 'XXXXXXX'], { g: '#15803d', b: '#7c4a21', X: '#f2d78a' }, 5, 'left:250px;bottom:14px', true]],
    urodzinymib: [['bunting', ['PPP.YYY.SSS.CCC.', '.P...Y...S...C..'], { P: '#a855f7', Y: '#facc15', S: '#f472b6', C: '#22d3ee' }, 3, 'left:220px;right:0;top:0;background-repeat:repeat-x', false],
      ['cake', [['....O....', '....v....', '....v....', 'SSSSSSSSS', 'SsSSsSSsS', 'BBBBBBBBB', 'LLLLLLLLL', 'BBBBBBBBB'], ['....u....', '....v....', '....v....', 'SSSSSSSSS', 'SsSSsSSsS', 'BBBBBBBBB', 'LLLLLLLLL', 'BBBBBBBBB']],
        { O: '#f97316', u: '#fde047', v: '#a855f7', S: '#fbcfe8', s: '#f472b6', B: '#8b5a2b', L: '#fef3c7' }, 5, 'left:250px;bottom:14px', true]],
  };
  let halloweenDecor = null;
  function decorate(id) {
    const hw = document.getElementById('hw');
    if (!hw) return;
    if (!halloweenDecor) halloweenDecor = [...hw.children].map(n => n.cloneNode(true));
    if (id === 'halloween' || !DECOR[id]) { hw.replaceChildren(...(id === 'halloween' ? halloweenDecor.map(n => n.cloneNode(true)) : [])); return; }
    hw.replaceChildren(...DECOR[id].map(([cls, rows, pal, k, pos, home]) => {
      const frames = Array.isArray(rows[0]) ? rows : [rows], w = Math.max(...frames[0].map(r => r.length)), h = frames[0].length;
      const pad = fr => fr.map(r => r.padEnd(w, '.'));
      const e = document.createElement('i');
      e.className = 'deco ' + cls + (home ? ' home' : '');
      e.setAttribute('style', pos + ';width:' + (pos.includes('right:0') ? 'auto' : w * k + 'px') + ';height:' + h * k + 'px;background-size:' + w * k + 'px ' + h * k + 'px');
      e.style.backgroundImage = img(pad(frames[0]), pal);
      if (frames.length > 1) { e.style.setProperty('--a', img(pad(frames[0]), pal)); e.style.setProperty('--b', img(pad(frames[1]), pal)); e.classList.add('blink'); }
      return e;
    }));
  }

  // ===== Wybór motywu =====
  const off = () => read(OFF, '1') === '0';
  function compute() { return off() ? '' : P.themeNow(themes); }
  function apply(id) {
    const was = current;
    current = id || '';
    for (const c of [...root.classList]) if (c.startsWith('t-') || c === 'themed') root.classList.remove(c);
    if (current) { root.classList.add('t-' + current); if (current !== 'halloween') root.classList.add('themed'); }
    decorate(current);
    if (window.mib && mib.call) mib.call('theme:set', current).catch(() => {});
    if (was !== current) for (const f of listeners) try { f(current); } catch {}
  }
  async function refresh() {
    try {
      const l = await mib.call('prof:themes');
      if (Array.isArray(l) && l.length) { themes = l; write(KEY, JSON.stringify(l)); }
    } catch {}
    const id = compute();
    if (id !== current) apply(id); else if (window.mib && mib.call) mib.call('theme:set', current).catch(() => {});
  }

  // ===== Prima Aprilis: przycisk GRAJ raz ucieka przy najechaniu =====
  let fled = false;
  document.addEventListener('mouseover', e => {
    const go = e.target.closest && e.target.closest('#go');
    if (!go || fled || current !== 'primaaprilis' || root.classList.contains('noanim')) return;
    fled = true;
    go.style.transition = 'translate .25s steps(4)';
    go.style.translate = (Math.random() < 0.5 ? -1 : 1) * 140 + 'px -40px';
    setTimeout(() => { go.style.translate = ''; setTimeout(() => { go.style.transition = ''; }, 300); }, 1300);
    // tr i toast są w ui.js (ładowany po tym pliku, ale przed pierwszym najechaniem myszą)
    if (typeof toast === 'function') toast(typeof tr === 'function' ? tr('Prima aprilis! Już możesz grać.') : 'Prima aprilis! Już możesz grać.');
  });

  window.MibThemes = {
    get id() { return current; },
    fx: () => FX[current] || FX[''],
    onChange: f => listeners.push(f),
    refresh,
    setEnabled(on) { write(OFF, on ? '1' : '0'); apply(compute()); },
    get enabled() { return !off(); },
  };
  // klasa z <head> (index.html) zgadza się z obliczoną; ozdoby i motyw dla gry od razu, potem świeże daty z bazy
  apply(compute());
  refresh();
  setInterval(() => { const id = compute(); if (id !== current) apply(id); }, 600000);
  window.addEventListener('focus', () => { const id = compute(); if (id !== current) apply(id); });
})();
