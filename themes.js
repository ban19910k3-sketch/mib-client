// Motywy świąteczne launchera (od 0.25.0): który motyw jest dziś (daty z bazy, bez sieci wbudowane), klasa t-<id> na
// <html>, ozdoby w #hw, cząsteczki w tle (konfiguracja dla ui.js), żarty na Prima Aprilis i motyw dla gry (-Dmib.theme).
// Halloween ma swoje ozdoby w index.html i style.css; pozostałe motywy rysują tu pikselowe obrazki z siatek znaków.
(() => {
  const root = document.documentElement, P = window.MibProfile;
  const KEY = 'mib-themes', OFF = 'mibthemes', SKIP = 'mibthemeskip';
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
  const QMARK = ['.WWW.', 'W...W', '...W.', '..W..', '..W..', '.....', '..W..'];
  const BUBBLE = ['.WW.', 'Ww.W', 'W..W', '.WW.'];
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
    primaaprilis: { colors: ['#22d3ee', '#f472b6', '#facc15', '#a3e635'], dir: 1, flyers: [
      { kind: 'rise', n: 5, frames: [QMARK], pals: ['#22d3ee', '#f472b6', '#facc15', '#a3e635'].map(W => ({ W })), speed: [12, 22], size: [2, 3], alpha: 0.7 }] },
    urodzinymc: { colors: ['#6abe30', '#4b8a22', '#8b5a2b', '#a3e635'], dir: 1, flyers: [
      { kind: 'fall', n: 5, frames: [GRASS], pals: [{ A: '#6abe30', a: '#4b8a22', D: '#8b5a2b', d: '#5e3a1a' }], speed: [16, 28], size: [3, 4], alpha: 0.85 }] },
    dziendziecka: { colors: ['#dc143c', '#f97316', '#facc15', '#38bdf8'], dir: 1, flyers: [
      { kind: 'rise', n: 5, frames: [BALLOON], pals: ['#ef4444', '#facc15', '#38bdf8', '#a855f7', '#22c55e'].map(B => ({ B, W: '#ffffff', s: '#e5e7eb' })), speed: [12, 22], size: [3, 4], alpha: 0.9 }] },
    wakacje: { colors: ['#a5f3fc', '#22d3ee', '#ffffff', '#2dd4bf'], dir: -1, flyers: [
      { kind: 'rise', n: 7, frames: [BUBBLE], pals: [{ W: '#a5f3fc', w: '#ecfeff' }, { W: '#5eead4', w: '#f0fdfa' }], speed: [14, 26], size: [2, 3], alpha: 0.6 }] },
    urodzinymib: { colors: ['#a855f7', '#facc15', '#f472b6', '#22d3ee'], dir: 1, flyers: [
      { kind: 'rise', n: 4, frames: [BALLOON], pals: ['#a855f7', '#facc15', '#f472b6'].map(B => ({ B, W: '#ffffff', s: '#e5e7eb' })), speed: [12, 22], size: [3, 3], alpha: 0.85 }] },
  };

  // ===== Ozdoby (od 0.47.0): girlanda pod górnym paskiem na każdej stronie (#hw), scena w banerze strony głównej (#hero),
  // ikonka przy nazwie w pasku bocznym i plakietka ze świętem w banerze. Pikselowe obrazki: siatka znaków + paleta,
  // dwie klatki = miganie. Wpis: [klasa, siatka lub klatki, paleta, skala, pozycja w CSS]; pas = left i right:0 (powtarzany w poziomie).
  const NP = { W: '#f8fafc', w: '#cbd5e1', R: '#dc143c', r: '#9f1239', s: '#a8a29e', p: '#d6d3d1', P: '#78716c', G: '#facc15' };
  const BZ = { K: '#111827', O: '#f97316', k: '#1f3a27', R: '#ef4444', Y: '#facc15', G: '#22c55e', B: '#38bdf8', r: '#7f1d1d', y: '#713f12', g: '#14532d', b: '#0c4a6e', T: '#15803d', t: '#166534', D: '#0f5132', S: '#fef9c3', n: '#78350f', W: '#f8fafc', i: '#dbeafe', I: '#93c5fd' };
  const SY = { Y: '#facc15', y: '#a16207', W: '#fffbeb', S: '#e5e7eb', s: '#9ca3af', C: '#22d3ee', P: '#f472b6', g: '#14532d', G: '#166534', K: '#0b0610', L: '#fde68a', k: '#3f3f46' };
  const WA = { R: '#f43f5e', r: '#be123c', E: '#fda4af', P: '#ec4899', p: '#9d174d', L: '#fbcfe8', s: '#9f7a85', W: '#fff1f2' };
  const WI = { O: '#f97316', y: '#eab308', q: '#c4b5fd', M: '#f472b6', Y: '#fde047', Q: '#7dd3fc', V: '#c4b5fd', G: '#86efac', W: '#ffffff', R: '#fb7185', s: '#a8a29e', A: '#4ade80', a: '#16a34a', d: '#15803d', X: '#d4a64a', x: '#92702c', S: '#f9a8d4', k: '#1c1424', w: '#e5e7eb' };
  const PA = { C: '#22d3ee', P: '#f472b6', Y: '#facc15', L: '#a3e635', V: '#a78bfa', s: '#94a3b8', W: '#f8fafc', k: '#0f172a', B: '#fde047' };
  const MC = { A: '#6abe30', a: '#4b8a22', D: '#8b5a2b', d: '#5e3a1a', F: '#fde047', f: '#f97316', w: '#8b5a2b', W: '#5e3a1a', s: '#a8a29e', Y: '#facc15', G: '#22c55e', b: '#8b5a2b' };
  const DZ = { R: '#ef4444', Y: '#facc15', Q: '#38bdf8', G: '#22c55e', V: '#a855f7', O: '#f97316', W: '#ffffff', s: '#e5e7eb', k: '#94a3b8' };
  const WK = { u: '#fde047', U: '#facc15', Y: '#fb923c', g: '#22c55e', G: '#15803d', b: '#7c4a21', B: '#5b3416', X: '#f2d78a', x: '#d6b25e', W: '#e0f2fe', Q: '#22d3ee', q: '#0891b2', D: '#0e7490', O: '#f97316', P: '#f472b6', T: '#2dd4bf', s: '#94a3b8' };
  const MB = { P: '#a855f7', p: '#7e22ce', Y: '#facc15', S: '#f472b6', C: '#22d3ee', s: '#a8a29e', O: '#f97316', u: '#fde047', v: '#e9d5ff', K: '#fbcfe8', k: '#f472b6', B: '#6b21a8', L: '#fef3c7', b: '#3b0764', W: '#ffffff' };
  const NP_ICO = ['..www..', '.wWWWw.', 'wWRRRWw', 'wWRrRWw', 'wWRRRWw', '.wWWWw.', '..R.R..'];
  const NP_GARLAND = ['ssssssssssssssssssss', '.WWWWWWw..RRRRRRr...', '..WWWWw....RRRRr....', '...WWw......RRr.....', '....w........r......'];
  const NP_FLAG = [['G..............', 'pWWWWWWWW......', 'pWWWWWWWWWWw...', 'pWWWWWWWWWWWWw.', 'pWWWWWWWWWWWWWw', 'pRRRRRRRRRRRRRr', 'pRRRRRRRRRRRRr.', 'pRRRRRRRRRRr...', 'pRRRRRRRr......', 'p..............', 'p..............', 'p..............', 'p..............', 'p..............', 'P..............', 'PP.............'], ['G..............', 'pWWWWWWw.......', 'pWWWWWWWWWWw...', 'pWWWWWWWWWWWWWw', 'pWWWWWWWWWWWWWw', 'pRRRRRRRRRRRRRr', 'pRRRRRRRRRRRRRr', 'pRRRRRRRRRRr...', 'pRRRRRRr.......', 'p..............', 'p..............', 'p..............', 'p..............', 'p..............', 'P..............', 'PP.............']];
  const BZ_ICO = ['...S...', '..SYS..', '...T...', '..TRT..', '.TTTYT.', 'TBTTTRT', '...n...'];
  const BZ_LIGHTS = [['kk......................kk', '..kkk..................kkk', '.....kkk............kkk...', '..k.....kkkk....kkkk...k..', '.RRR.......kkkkkk.....GGG.', '.RRR...k............k.GGG.', '..R...YYY....k.....BBB.G..', '......YYY...BBB....BBB....', '.......Y....BBB.....B.....', '.............B............'], ['kk......................kk', '..kkk..................kkk', '.....kkk............kkk...', '..k.....kkkk....kkkk...k..', '.rrr.......kkkkkk.....ggg.', '.rrr...k............k.ggg.', '..r...YYY....k.....bbb.g..', '......YYY...bbb....bbb....', '.......Y....bbb.....b.....', '.............b............']];
  const BZ_TREE = [['......S......', '.....SYS.....', '......T......', '.....TTt.....', '....TRTTt....', '...TTTTYTt...', '....TTTTt....', '...TYTTTTt...', '..TTTTTTRTt..', '.TTBTTTTTTTt.', '...TTTTTTt...', '..TTTRTTTTt..', '.TTTTTTTYTTt.', 'TTYTTTTTTTBTt', 'DDDDDDDDDDDDD', '.....nnn.....', '.....nnn.....'], ['......Y......', '.....YSY.....', '......T......', '.....TTt.....', '....TYTTt....', '...TTTTRTt...', '....TTTTt....', '...TBTTTTt...', '..TTTTTTYTt..', '.TTRTTTTTTTt.', '...TTTTTTt...', '..TTTYTTTTt..', '.TTTTTTTBTTt.', 'TTRTTTTTTTYTt', 'DDDDDDDDDDDDD', '.....nnn.....', '.....nnn.....']];
  const BZ_GIFTS = ['...Y.Y.........', '....Y....g.g...', '.RRRYRRR..g....', '.RRRYRRR.BBYBB.', '.YYYYYYY.BBYBB.', '.RRRYRRR.YYYYY.', '.RRRYRRR.BBYBB.', '.RRRYRRR.BBYBB.'];
  const BZ_SNOW = ['....WW..........WWW.........', '..WWWWWW.....WWWWWWWW....WW.', 'WWWWWWWWWWWWWWWWWWWWWWWWWWWW', 'WWiWWWWWWWiWWWWWWWWWiWWWWWWW', 'iiWiiiWiiiiiWiiiWiiiiiiWiiii', 'IiiIiiiiIiiiiIiiiiIiiiIiiiIi'];
  const SY_ICO = ['...Y...', '.Y.W.Y.', '..WYW..', 'YWYWYWY', '..WYW..', '.Y.W.Y.', '...Y...'];
  const SY_GARLAND = [['ssssssssssssssssssssssss', '.Y......S.....P.....C...', 'YYY....SSS...PPP...CCC..', '.Y......S.....P.....C...', '....Y.........S.....P...', '...YYY.......SSS........', '....Y.........S.........'], ['ssssssssssssssssssssssss', '.W......Y.....S.....P...', 'WWW....YYY...SSS...PPP..', '.W......Y.....S.....P...', '....C.........Y.....S...', '...CCC.......YYY........', '....C.........Y.........']];
  const SY_BOTTLE = ['...LL...', '...yy...', '...gg...', '...gg...', '..gGgg..', '.gGgggg.', '.gYYYYg.', '.gYKKYg.', '.gYYYYg.', '.gGgggg.', '.gGgggg.', '.gGgggg.', '.gggggg.'];
  const SY_CLOCK = ['..yYYYy..', '.yWWkWWy.', 'yWWWkWWWy', 'YWWWkWWWY', 'YWWWkkkWY', 'YWWWWWWWY', 'yWWWWWWWy', '.yWWWWWy.', '..yYYYy..'];
  const SY_GLASS = ['S...S', 'SLLLS', 'SLWLS', '.SLS.', '..S..', '..S..', '.SSS.'];
  const WA_ICO = ['.RR.RR.', 'REERRRR', 'RERRRRr', 'RRRRRRr', '.RRRRr.', '..RRr..', '...r...'];
  const WA_GARLAND = ['ssssssssssssssssssssss', '..s.........s.........', '.RR.RR....PP.PP.......', 'RERRRRR..PLPPPPP......', 'RRRRRRr..PPPPPPp......', '.RRRRr....PPPPp.......', '..RRr......PPp........', '...r........p.........'];
  const WA_HEART = [['..RRRR...RRRR..', '.RREERR.RRRRRR.', 'RREERRRRRRRRRRr', 'RERRRRRRRRRRRRr', 'RRRRRRRRRRRRRRr', 'RRRRRRRRRRRRRRr', '.RRRRRRRRRRRRr.', '..RRRRRRRRRRr..', '...RRRRRRRRr...', '....RRRRRRr....', '.....RRRRr.....', '......RRr......', '.......r.......'], ['...............', '..RRRR...RRRR..', '.RREERRRRRRRRR.', '.REERRRRRRRRRr.', '.RERRRRRRRRRRr.', '.RRRRRRRRRRRRr.', '..RRRRRRRRRRr..', '...RRRRRRRRr...', '....RRRRRRr....', '.....RRRRr.....', '......RRr......', '.......r.......', '...............']];
  const WA_SMALL = ['.PP.PP.', 'PLPPPPP', 'PPPPPPp', '.PPPPp.', '..PPp..', '...p...'];
  const WI_ICO = ['..MMM..', '.MWMWM.', 'MMMMMMM', 'YYYYYYY', 'QQWQQWQ', '.QQQQQ.', '..QQQ..'];
  const WI_GARLAND = ['ssssssssssssssssssssssssssss', '.MMMMM..YYYYY..QQQQQ..GGGGG.', '..MMM....YYY....QQQ....GGG..', '...M......Y......Q......G...'];
  const WI_GRASS = ['.A..A...A....A..A...A..A....', 'AAA.AA.AAA..AAA.AA.AAAAAA.A.', 'AaAAAAAAaAAAAaAAAAAAaAAAAAAA', 'aAaAaaAaAaAaaAaAaaAaAaAaaAaA', 'daddaddaddaddaddaddaddaddadd'];
  const WI_BUNNY = ['..ww.ww...', '..wS.wS...', '..wS.wS...', '..ww.ww...', '.wwwwww...', '.wkwwkw...', '.wwSSww...', '..wwww....', '.wwwwwww..', 'wwwwwwwww.', 'wwwwwwwwwW', 'wwwwwwwww.', '.ww..ww...'];
  const WI_BASKET = ['...xxxxxx...', '..x......x..', '.x..M.Y.Q.x.', '.xMMMYYYQQx.', '.MWMMYRYQWQ.', 'XxXxXxXxXxXx', 'xXxXxXxXxXxX', '.XxXxXxXxXx.', '..xXxXxXxX..'];
  const PA_ICO = ['Y.....P', 'YY...PP', '.YYCPP.', '.YCCCP.', '.CCCCC.', 'WkWkWkW', '.......'];
  const PA_GARLAND = ['...C......P......Y......L...', '..CCC....PPP....YYY....LLL..', '.CCCCC..PPPPP..YYYYY..LLLLL.', 'ssssssssssssssssssssssssssss'];
  const PA_JESTER = [['B.........B', 'YY.......PP', '.YY.....PP.', '.YYY...PPP.', '..YYYCPPP..', '..YYCCCPP..', '...CCCCC...', '..WkWkWkW..', '..kWkWkWk..'], ['.B.......B.', 'YY.......PP', '.YY.....PP.', '.YYY...PPP.', '..YYYCPPP..', '..YYCCCPP..', '...CCCCC...', '..WkWkWkW..', '..kWkWkWk..']];
  const PA_Q = ['.WWWW.', 'WW..WW', '....WW', '...WW.', '..WW..', '..WW..', '......', '..WW..'];
  const MC_ICO = ['AAAAAAA', 'AaAAaAA', 'DaDDDaD', 'DDdDDDD', 'DDDDdDD', 'DdDDDDD', 'DDDDDdD'];
  const MC_GARLAND = ['ssssssssssssssssssssss', '.AAAAA..DDDDD..YYYYY..', '..AAA....DDD....YYY...', '...A......D......Y....'];
  const MC_BLOCKS = ['AAAAAAAAAAAAAAAAAAAAAAAA', 'AaAAaAAaAAAaAAaAAaAAaAAa', 'DDaDDDDDaDDDDDaDDDDaDDDD', 'DdDDDdDDDDdDDDdDDDDdDDDd', 'DDDdDDDDdDDDdDDDDdDDDdDD'];
  const MC_TORCH = [['........F........', '.......fFf.......', '.......FFF.......', '........w........', '........w........', '........W........', 'AAAAAAAAAAAAAAAAA', 'AaAAaAAAaAAaAAaAA', 'DDaDDDDDDDaDDDDDD', 'DdDDDdDDDDDDdDDDD', 'DDDDDDDdDDDDDDDdD', 'DdDDDDDDDDdDDDDDD', 'DDDdDDDDdDDDDDDDD'], ['.......F.........', '.......FfF.......', '.......FFF.......', '........w........', '........w........', '........W........', 'AAAAAAAAAAAAAAAAA', 'AaAAaAAAaAAaAAaAA', 'DDaDDDDDDDaDDDDDD', 'DdDDDdDDDDDDdDDDD', 'DDDDDDDdDDDDDDDdD', 'DdDDDDDDDDdDDDDDD', 'DDDdDDDDdDDDDDDDD']];
  const DZ_ICO = ['.RRR.', 'RWRRR', 'RRRRR', 'RRRRR', '.RRR.', '..s..', '..s..'];
  const DZ_GARLAND = ['kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk', '.RRRRR.OOOOO.YYYYY.GGGGG.QQQQQ.VVVVV', '..RRR...OOO...YYY...GGG...QQQ...VVV.', '...R.....O.....Y.....G.....Q.....V..'];
  const DZ_BALLOONS = ['..RR.....QQ...', '.RRRR...QQQQ..', '.RWRR.YYQWQQ..', '.RRRRYYYYQQQ..', '..RRYWYYYQQ...', '...R.YYYY.Q...', '...s..YY..s...', '....s..Y.s....', '.....s.s.s....', '......sss.....', '.......s......', '.......s......', '.......s......'];
  const WK_ICO = ['Y..Y..Y', '..uuu..', '.uUuuu.', 'YuuuuuY', '.uuuuU.', '..uuu..', 'Y..Y..Y'];
  const WK_GARLAND = ['ssssssssssssssssssssss', '.OOOOO..TTTTT..uuuuu..', '..OOO....TTT....uuu...', '...O......T......u....'];
  const WK_SEA = ['...WW.........WW.........WW...', '.WQQQW.....WQQQQW.....WQQQQW..', 'QQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ', 'qQQqQQQQqQQQqQQQQqQQQqQQQQqQQQ', 'qqqqqqqqqqqqqqqqqqqqqqqqqqqqqq', 'XXxXXXXXxXXXXXXXxXXXXXxXXXXXXX'];
  const WK_PALM = ['..gg...gg....', '.gGGg.gGGg...', 'gG..gggG..g..', '.....GG.Gg...', '...gGbbGG.g..', '..g..bb..g...', '.....b.......', '.....bb......', '......b......', '......bb.....', '......bb.....', '.....BbB.....'];
  const WK_SUN = [['..Y...Y...Y..', '.............', 'Y...uuuuu...Y', '...uuuuuuu...', '..uuUuuuuuu..', '..uuuuuuuuu..', 'Y.uuuuuuuuu.Y', '..uuuuuuuuU..', '..uuuuuuuuu..', '...uuuuuuU...', 'Y...uuuuu...Y', '.............', '..Y...Y...Y..'], ['.............', '.Y....Y....Y.', '....uuuuu....', 'Y..uuuuuuu..Y', '..uuUuuuuuu..', '..uuuuuuuuu..', '..uuuuuuuuu..', '..uuuuuuuuU..', '..uuuuuuuuu..', 'Y..uuuuuuU..Y', '....uuuuu....', '.Y....Y....Y.', '.............']];
  const MB_ICO = ['...O...', '...v...', '.KKKKK.', '.KkKkK.', '.BBBBB.', '.LLLLL.', '.BBBBB.'];
  const MB_GARLAND = ['ssssssssssssssssssssssss', '.PPPPP.YYYYY.SSSSS.CCCCC', '..PPP...YYY...SSS...CCC.', '...P.....Y.....S.....C..'];
  const MB_CAKE = [['...O.....u.....O...', '...u.....O.....u...', '...v.....v.....v...', '...v.....v.....v...', '.KKKKKKKKKKKKKKKKK.', 'KKkKKKkKKKKkKKKkKKK', 'KkkKkkkkKKkkkKkkKkK', 'BBBBBBBBBBBBBBBBBBB', 'BBBBBBBBBBBBBBBBBBB', 'LLLLLLLLLLLLLLLLLLL', 'BBBBBBBBBBBBBBBBBBB', 'BBBBBBBBBBBBBBBBBBB', '.bbbbbbbbbbbbbbbbb.'], ['...u.....O.....u...', '...O.....u.....O...', '...v.....v.....v...', '...v.....v.....v...', '.KKKKKKKKKKKKKKKKK.', 'KKkKKKkKKKKkKKKkKKK', 'KkkKkkkkKKkkkKkkKkK', 'BBBBBBBBBBBBBBBBBBB', 'BBBBBBBBBBBBBBBBBBB', 'LLLLLLLLLLLLLLLLLLL', 'BBBBBBBBBBBBBBBBBBB', 'BBBBBBBBBBBBBBBBBBB', '.bbbbbbbbbbbbbbbbb.']];
  // ===== Dodatkowe ozdoby (od 0.47.1): więcej rzeczy kojarzących się z danym świętem =====
  const NP_COCKADE = ['...wWWWw...', '..WRRRRRW..', '.WRrWWWrRW.', 'wRrWWWWWrRw', 'WRWWRRRWWRW', 'WRWWRrRWWRW', 'wRrWWRWWrRw', '.WRrWWWrRW.', '..WRRRRRW..', '...WR.RW...', '..WRr.rRW..', '..Rr...rR..', '.Rr.....rR.'];
  const BZ_SNOWMAN = ['...KKKKK...', '...KKKKK...', '..KKKKKKK..', '...WWWWW...', '..WWKWKWW..', '..WWWOOWW..', '...WWWWW...', '..RRRRRRR..', '.WWWWRWWWW.', 'WWWWWKWWWWi', 'WWWWWWWWWWi', 'WWWWWKWWWWi', '.WWWWWWWWi.', '..iiiiiii..'];
  const SY_DIGITS = { 0: ['###', '#.#', '#.#', '#.#', '###'], 1: ['.#.', '##.', '.#.', '.#.', '###'], 2: ['###', '..#', '###', '#..', '###'], 3: ['###', '..#', '.##', '..#', '###'], 4: ['#.#', '#.#', '###', '..#', '..#'],
    5: ['###', '#..', '###', '..#', '###'], 6: ['###', '#..', '###', '#.#', '###'], 7: ['###', '..#', '.#.', '.#.', '.#.'], 8: ['###', '#.#', '###', '#.#', '###'], 9: ['###', '#.#', '###', '..#', '###'] };
  // rok, który się zaczyna (od lipca następny — także przy Sylwestrze włączonym wcześniej z panelu), pikselowymi cyframi
  const syYear = () => { const d = new Date(), y = String(d.getFullYear() + (d.getMonth() >= 6 ? 1 : 0)); return [0, 1, 2, 3, 4].map(r => [...y].map(c => SY_DIGITS[c][r].replace(/#/g, r ? 'Y' : 'L')).join('.')); };
  const SY_FIREWORK = [['....C....', '.C..C..C.', '..C.C.C..', '...CWC...', 'CCCWWWCCC', '...CWC...', '..C.C.C..', '.C..C..C.', '....C....'], ['C...C...C', '.........', '..C.C.C..', '...C.C...', 'C.C.W.C.C', '...C.C...', '..C.C.C..', '.........', 'C...C...C']];
  const WA_LETTER = ['sssssssssssss', 'sLWLLLLLLLWLs', 'sLLWLLLLLWLLs', 'sLLLWLLLWLLLs', 'sLLLLWRWLLLLs', 'sLLLLRRRLLLLs', 'sLLLLLRLLLLLs', 'sLLLLLLLLLLLs', 'sssssssssssss'];
  const WI_EGG = ['..MMM..', '.MMMMM.', '.YYYYY.', 'MWMWMWM', 'MMMMMMM', 'QQQQQQQ', '.QWQWQ.', '.QQQQQ.', '..QQQ..'];
  const WI_EGGS = WI_EGG.map((r, i) => r + '.' + r.replace(/M/g, 'q').replace(/Q/g, 'G').replace(/Y/g, 'R').replace(/q/g, 'V') + '.' + r.replace(/M/g, 'Y').replace(/Q/g, 'M').replace(/Y/g, 'Q'));
  const WI_CHICK = ['...YYY..', '..YYkYY.', '..YYYYOO', '.YYYYYY.', 'YyYYYYYY', 'YYyYYYYY', '.YYYYYY.', '..O..O..'];
  const MC_CAKE = ['.WWWWWWWWWW.', 'WWRWWWWWRWWW', 'WWWWWRWWWWWW', 'CCCCCCCCCCCC', 'bbbbbbbbbbbb', 'bBbbbbBbbbbb', 'CCCCCCCCCCCC', 'bbbBbbbbbBbb', 'BBBBBBBBBBBB'];
  const MC_GEM = ['..QQQ..', '.QWQQQ.', 'QWQQQQq', 'QQQQQqq', '.QQQqq.', '..Qqq..', '...q...'];
  const MCK = { W: '#ffffff', R: '#ef4444', C: '#fde68a', b: '#a16207', B: '#713f12', Q: '#67e8f9', q: '#0891b2' };
  const DZ_RAINBOW = ['......................', '.......RRRRRRRR.......', '.....RRROOOOOORRR.....', '....RROOYYYYYYOORR....', '...ROOYYYGGGGYYYOOR...', '..RROYYGGQQQQGGYYORR..', '..ROYYGQQQVVQQQGYYOR..', '.ROOYGQQVVVVVVQQGYOOR.', '.ROYGGQV......VQGGYOR.', '.ROYGQVV......VVQGYOR.', 'RROYGQV........VQGYORR'];
  const DZ_KITE = [['....Q....', '...QQR...', '..QQQRR..', '.QQQQRRR.', 'YYYYsGGGG', '.YYYsGGG.', '..YYsGG..', '...YsG...', '....s....', '.....s...', '....RsR..', '......s..', '.....YsY.', '.......s.'], ['....Q....', '...QQR...', '..QQQRR..', '.QQQQRRR.', 'YYYYsGGGG', '.YYYsGGG.', '..YYsGG..', '...YsG...', '....s....', '...s.....', '..RsR....', '..s......', '.YsY.....', '.s.......']];
  const WK_UMBRELLA = ['......O......', '....OWOWO....', '..OWOWOWOWO..', '.OWOWOWOWOWO.', 'OWOWOWOWOWOWO', 'b.....B.....b', '......B......', '......B......', '......B......', '......B......', '......B......', '.....XBX.....'];
  const WK_ICECREAM = ['..PPP..', '.PPWPP.', '.PPPPP.', 'TTTTTTT', '.TTWTT.', 'XxXxXxX', '.xXxXx.', '.XxXxX.', '..xXx..', '..XxX..', '...x...'];
  const MB_GIFTS = BZ_GIFTS.map(r => r.replace(/R/g, 'P').replace(/B/g, 'C').replace(/g/g, 'S'));
  const MB_BALLOONS = DZ_BALLOONS.map(r => r.replace(/R/g, 'P').replace(/Q/g, 'S'));
  // życzenia pod „Witaj, Gracz.” na stronie głównej (tłumaczenia w EN w ui.js)
  const GREET = { halloween: 'Cukierek albo psikus!', niepodleglosc: 'Wszystkiego dobrego w Święto Niepodległości!', boze: 'Wesołych Świąt i samych wygranych walk!',
    sylwester: 'Szczęśliwego Nowego Roku!', walentynki: 'Wszystkiego miłego w Walentynki!', wielkanoc: 'Wesołych Świąt Wielkanocnych!',
    primaaprilis: 'Dziś nie wierz nikomu. Nawet przyciskowi GRAJ.', urodzinymc: 'Wszystkiego najlepszego, Minecraft!',
    dziendziecka: 'Wszystkiego najlepszego z okazji Dnia Dziecka!', wakacje: 'Udanych wakacji — więcej czasu na granie!',
    urodzinymib: 'MiB Client ma urodziny — dzięki, że grasz z nami!' };
  const STRIP = 'left:0;right:0;bottom:0';
  const DECOR = {
    niepodleglosc: { name: 'Święto Niepodległości', ico: [NP_ICO, NP], top: ['bunting', NP_GARLAND, NP, 3],
      hero: [['flag', NP_FLAG, NP, 4, 'right:26px;bottom:0'], ['cockade', NP_COCKADE, NP, 3, 'right:104px;bottom:14px']] },
    boze: { name: 'Boże Narodzenie', ico: [BZ_ICO, BZ], top: ['lights', BZ_LIGHTS, BZ, 2],
      hero: [['snow', BZ_SNOW, BZ, 3, STRIP], ['tree', BZ_TREE, BZ, 4, 'right:78px;bottom:9px'], ['gifts', BZ_GIFTS, BZ, 3, 'right:20px;bottom:9px'], ['snowman', BZ_SNOWMAN, BZ, 3, 'right:146px;bottom:9px']] },
    sylwester: { name: 'Sylwester', ico: [SY_ICO, SY], top: ['stars', SY_GARLAND, SY, 2],
      hero: () => [['bottle', SY_BOTTLE, SY, 4, 'right:104px;bottom:10px'], ['glass', SY_GLASS, SY, 4, 'right:74px;bottom:10px'], ['clock', SY_CLOCK, SY, 4, 'right:20px;bottom:10px'],
        ['year', syYear(), SY, 5, 'right:150px;top:16px'], ['firework', SY_FIREWORK, SY, 4, 'right:40px;top:12px'], ['firework fw2', SY_FIREWORK, { ...SY, C: '#f472b6' }, 3, 'right:96px;top:46px']] },
    walentynki: { name: 'Walentynki', ico: [WA_ICO, WA], top: ['hearts', WA_GARLAND, WA, 2],
      hero: [['heart', WA_HEART, WA, 4, 'right:24px;bottom:14px'], ['heart2', WA_SMALL, WA, 3, 'right:96px;bottom:70px'], ['letter', WA_LETTER, WA, 4, 'right:96px;bottom:12px']] },
    wielkanoc: { name: 'Wielkanoc', ico: [WI_ICO, WI], top: ['bunting', WI_GARLAND, WI, 3],
      hero: [['grass', WI_GRASS, WI, 3, STRIP], ['basket', WI_BASKET, WI, 4, 'right:68px;bottom:8px'], ['bunny', WI_BUNNY, WI, 4, 'right:18px;bottom:8px'], ['chick', WI_CHICK, WI, 3, 'right:126px;bottom:9px'], ['eggs', WI_EGGS, WI, 3, 'right:160px;bottom:9px']] },
    primaaprilis: { name: 'Prima Aprilis', ico: [PA_ICO, PA], top: ['bunting', PA_GARLAND, PA, 3],
      hero: [['jester', PA_JESTER, PA, 5, 'right:24px;bottom:14px'], ['q', PA_Q, PA, 3, 'right:96px;bottom:60px']] },
    urodzinymc: { name: 'Urodziny Minecrafta', ico: [MC_ICO, MC], top: ['bunting', MC_GARLAND, MC, 3],
      hero: [['blocks', MC_BLOCKS, MC, 3, STRIP], ['torch', MC_TORCH, MC, 4, 'right:20px;bottom:15px'], ['cake', MC_CAKE, MCK, 4, 'right:96px;bottom:15px'], ['gem', MC_GEM, MCK, 4, 'right:160px;bottom:15px']] },
    dziendziecka: { name: 'Dzień Dziecka', ico: [DZ_ICO, DZ], top: ['bunting', DZ_GARLAND, DZ, 3],
      hero: [['rainbow', DZ_RAINBOW, { ...DZ, R: '#ef4444', O: '#f97316', Y: '#facc15', G: '#22c55e', Q: '#38bdf8', V: '#a855f7' }, 5, 'right:110px;bottom:0'], ['balloons', DZ_BALLOONS, DZ, 5, 'right:20px;bottom:6px'], ['kite', DZ_KITE, { ...DZ, s: '#e5e7eb' }, 4, 'right:96px;top:10px']] },
    wakacje: { name: 'Wakacje', ico: [WK_ICO, WK], top: ['bunting', WK_GARLAND, WK, 3],
      hero: [['sea', WK_SEA, WK, 3, STRIP], ['sun', WK_SUN, WK, 3, 'right:22px;top:14px'], ['palm', WK_PALM, WK, 4, 'right:26px;bottom:12px'], ['umbrella', WK_UMBRELLA, WK, 4, 'right:96px;bottom:12px'], ['icecream', WK_ICECREAM, WK, 3, 'right:162px;bottom:14px']] },
    urodzinymib: { name: 'Urodziny MiB Client', ico: [MB_ICO, MB], top: ['bunting', MB_GARLAND, MB, 3],
      hero: [['cake', MB_CAKE, MB, 4, 'right:20px;bottom:10px'], ['gifts', MB_GIFTS, MB, 3, 'right:104px;bottom:10px'], ['balloons', MB_BALLOONS, MB, 4, 'right:156px;bottom:8px']] },
  };
  function sprite([cls, rows, pal, k, pos]) {
    const frames = Array.isArray(rows[0]) ? rows : [rows], w = Math.max(...frames[0].map(r => r.length)), h = frames[0].length;
    const pad = fr => fr.map(r => r.padEnd(w, '.')), strip = /left:/.test(pos) && /right:0/.test(pos);
    const e = document.createElement('i');
    e.className = 'deco ' + cls + (strip ? ' strip' : '');
    e.setAttribute('style', pos + ';width:' + (strip ? 'auto' : w * k + 'px') + ';height:' + h * k + 'px;background-size:' + w * k + 'px ' + h * k + 'px');
    e.style.backgroundImage = img(pad(frames[0]), pal);
    if (frames.length > 1) { e.style.setProperty('--a', img(pad(frames[0]), pal)); e.style.setProperty('--b', img(pad(frames[1]), pal)); e.classList.add('blink'); }
    return e;
  }
  let halloweenDecor = null;
  function decorate(id) {
    const hw = document.getElementById('hw'), hero = document.getElementById('hero'), d = DECOR[id];
    if (!hw) return;
    if (!halloweenDecor) halloweenDecor = [...hw.children].map(n => n.cloneNode(true));
    if (hero) for (const n of hero.querySelectorAll('.hol')) n.remove();
    root.style.removeProperty('--hol-ico');
    // życzenia zamiast podpisu pod „Witaj, Gracz.” (pierwotny tekst wraca po święcie)
    const lead = document.querySelector('#p-home .ptitle .lead');
    if (lead) { if (lead.dataset.orig === undefined) lead.dataset.orig = lead.textContent; lead.textContent = GREET[id] || lead.dataset.orig; lead.classList.toggle('hol-greet', !!GREET[id]); }
    if (!d) { hw.replaceChildren(...(id === 'halloween' ? halloweenDecor.map(n => n.cloneNode(true)) : [])); return; }
    hw.replaceChildren(sprite([d.top[0], d.top[1], d.top[2], d.top[3], 'left:var(--side-w);right:0;top:var(--top-h)']));
    root.style.setProperty('--hol-ico', img(d.ico[0], d.ico[1]));
    if (!hero) return;
    const art = document.createElement('div');
    art.className = 'hol hol-art';
    art.append(...(typeof d.hero === 'function' ? d.hero() : d.hero).map(sprite));
    hero.append(art);
    const tag = document.createElement('span');
    tag.className = 'hol hol-tag';
    tag.append(document.createElement('i'), document.createTextNode(d.name));
    const t = hero.querySelector('.hero-t > div');
    if (t) t.append(tag);
  }

  // ===== Wybór motywu =====
  const off = () => read(OFF, '1') === '0';
  // święto ukryte przez gracza do swojego końca (od 0.47.0, wybór motywu, trybu albo koloru w Ustawieniach → Wygląd)
  const skip = () => { try { return JSON.parse(read(SKIP, 'null')); } catch { return null; } };
  // okno podglądu motywu z panelu admina (od 0.47.3): zawsze podglądane święto, bez ustawień gracza
  const PV = P.previewTheme(location.search);
  function compute() { return PV !== null ? PV : off() ? '' : P.themeShown(themes, skip()); }
  const NAMES = { halloween: 'Halloween' };
  const themeName = id => (DECOR[id] && DECOR[id].name) || NAMES[id] || id;
  function apply(id) {
    const was = current;
    current = id || '';
    for (const c of [...root.classList]) if (c.startsWith('t-') || c === 'themed') root.classList.remove(c);
    if (current) { root.classList.add('t-' + current); if (current !== 'halloween') root.classList.add('themed'); }
    decorate(current);
    if (window.mib && mib.call && PV === null) mib.call('theme:set', current).catch(() => {});
    if (was !== current) for (const f of listeners) try { f(current); } catch {}
  }
  async function refresh() {
    try {
      const l = await mib.call('prof:themes');
      if (Array.isArray(l) && l.length) { themes = l; write(KEY, JSON.stringify(l)); }
    } catch {}
    const id = compute();
    if (id !== current) apply(id); else if (window.mib && mib.call && PV === null) mib.call('theme:set', current).catch(() => {});
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
    name: themeName,
    // gracz wybrał własny wygląd: trwające święto znika do swojego końca; zwraca {id, until} albo null
    skipNow() {
      if (!current) return null;
      const sk = P.themeSkipFor(themes, current);
      if (sk) { write(SKIP, JSON.stringify(sk)); apply(compute()); }
      return sk;
    },
    unskip() { try { localStorage.removeItem(SKIP); } catch {} apply(compute()); },
    // ukryte dziś święto {id, until} albo null
    get skipped() { const sk = skip(); return !off() && sk && P.themeNow(themes) === sk.id && !compute() ? sk : null; },
    fx: () => FX[current] || FX[''],
    onChange: f => listeners.push(f),
    refresh,
    setEnabled(on) { write(OFF, on ? '1' : '0'); apply(compute()); for (const f of listeners) try { f(current); } catch {} },
    get enabled() { return !off(); },
  };
  // klasa z <head> (index.html) zgadza się z obliczoną; ozdoby i motyw dla gry od razu, potem świeże daty z bazy
  apply(compute());
  refresh();
  setInterval(() => { const id = compute(); if (id !== current) apply(id); }, 600000);
  window.addEventListener('focus', () => { const id = compute(); if (id !== current) apply(id); });
})();
