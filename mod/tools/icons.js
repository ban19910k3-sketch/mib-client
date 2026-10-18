// Ikony pixelarticons (SVG 24×24) -> PixelIcons.java (12×12, piksel zapalony, gdy któryś z 4 źródłowych jest zapalony).
// Użycie: node mod/tools/icons.js <katalog z SVG pixelarticons> <wyjściowy PixelIcons.java>
// Ikony z siatki 12×12 rysują się ostro w każdej całkowitej skali menu, także na 1.8.9.
const fs = require('fs'), path = require('path');

const ICONS = [
  // moduły etapu 1
  'shield', 'sun', 'map-pin', 'mouse', 'frame', 'compass', 'eye', 'speed-fast', 'keyboard', 'wifi', 'hourglass', 'potion', 'cloud-server', 'clock', 'zap', 'zoom-in', 'rotate-360',
  // moduły etapu 2 i gracze MiB
  'shield-sharp', 'heart', 'apple', 'backpack', 'cursor-minimal', 'image', 'human', 'speed-medium', 'alarm-clock', 'cpu', 'server', 'target',
  'trending-up', 'skull', 'x', 'arrow-big-up', 'arrows-horizontal', 'trophy', 'user',
  // moduły etapów 3 i 4
  'crown', 'bulletlist', 'bell-off', 'camera', 'label', 'undo', 'shuffle', 'hand', 'cloud-sun', 'blocks', 'road-sign', 'speed-slow',
  'reload', 'info-box', 'eye-off',
  'heading', 'badge-captions', 'list-box', 'bomb', 'trash', 'moon', 'save', 'box', 'filter', 'article',
  // menu i kategorie
  'search', 'settings-cog', 'arrow-left', 'move', 'users', 'close', 'lock', 'grid-3x3', 'layout', 'sword', 'map', 'message', 'archive', 'check',
];

// Własne rysunki tam, gdzie oryginał ma detale 1 px, które giną przy pomniejszeniu do 12×12
const CUSTOM = {
  target: [
    '.....##.....', '...######...', '..#..##..#..', '.#...##...#.', '.#........#.', '####....####',
    '####....####', '.#........#.', '.#...##...#.', '..#..##..#..', '...######...', '.....##.....'],
  x: [
    '............', '.##......##.', '.###....###.', '..##....##..', '............', '............',
    '............', '............', '..##....##..', '.###....###.', '.##......##.', '............'],
  'trending-up': [
    '............', '.........##.', '.........##.', '......##.##.', '......##.##.', '...##.##.##.',
    '...##.##.##.', '##.##.##.##.', '##.##.##.##.', '##.##.##.##.', '###########.', '............'],
  cpu: [
    '...#..#..#..', '.##########.', '.#........#.', '##.######.##', '.#.#....#.#.', '##.#....#.##',
    '.#.#....#.#.', '##.######.##', '.#........#.', '.##########.', '...#..#..#..', '............'],
  human: [
    '....####....', '....####....', '....####....', '.##########.', '.#.######.#.', '.#.######.#.',
    '.#.######.#.', '...##..##...', '...##..##...', '...##..##...', '...##..##...', '............'],
  'rotate-360': [
    '............', '....####.#..', '..##....###.', '.#.....####.', '.#..........', '#...........',
    '#..........#', '.#........#.', '.#........#.', '..##....##..', '....####....', '............'],
  keyboard: [
    '............', '............', '############', '#.##.##.##.#', '#..........#', '#.##.##.##.#',
    '#..........#', '#.########.#', '#..........#', '############', '............', '............'],
  'settings-cog': [
    '.....##.....', '..#.####.#..', '.##########.', '..###..###..', '.###....###.', '####....####',
    '####....####', '.###....###.', '..###..###..', '.##########.', '..#.####.#..', '.....##.....'],
};
const customRows = art => art.map(l => [...l].reduce((r, ch, x) => (ch === '#' ? r | (1 << (11 - x)) : r), 0));

// Wielokąty ze ścieżki SVG złożonej z M/L/H/V/Z (także małymi literami, czyli względnie)
function polygons(d) {
  const tok = d.match(/[MmLlHhVvZz]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) || [];
  const polys = [];
  let cur = null, x = 0, y = 0, sx = 0, sy = 0, cmd = null, i = 0;
  const num = () => { const v = parseFloat(tok[i++]); if (Number.isNaN(v)) throw new Error('zła liczba w ścieżce'); return v; };
  while (i < tok.length) {
    if (/[A-Za-z]/.test(tok[i])) cmd = tok[i++];
    else if (!cmd) throw new Error('ścieżka bez komendy');
    switch (cmd) {
      case 'M': case 'm': {
        const nx = num(), ny = num();
        x = cmd === 'm' ? x + nx : nx; y = cmd === 'm' ? y + ny : ny;
        cur = [[x, y]]; polys.push(cur); sx = x; sy = y;
        cmd = cmd === 'm' ? 'l' : 'L';
        break;
      }
      case 'L': case 'l': { const nx = num(), ny = num(); x = cmd === 'l' ? x + nx : nx; y = cmd === 'l' ? y + ny : ny; cur.push([x, y]); break; }
      case 'H': case 'h': { const nx = num(); x = cmd === 'h' ? x + nx : nx; cur.push([x, y]); break; }
      case 'V': case 'v': { const ny = num(); y = cmd === 'v' ? y + ny : ny; cur.push([x, y]); break; }
      case 'Z': case 'z': x = sx; y = sy; cmd = null; break;
      default: throw new Error('nieobsługiwana komenda ' + cmd);
    }
  }
  return polys;
}

// Reguła nonzero (domyślna w SVG), test w środku piksela
function rasterize(d, size = 24) {
  const polys = polygons(d), g = Array.from({ length: size }, () => Array(size).fill(false));
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
    const cx = px + 0.5, cy = py + 0.5;
    let wn = 0;
    for (const p of polys) for (let k = 0; k < p.length; k++) {
      const [x0, y0] = p[k], [x1, y1] = p[(k + 1) % p.length];
      const left = (x1 - x0) * (cy - y0) - (cx - x0) * (y1 - y0);
      if (y0 <= cy && y1 > cy && left > 0) wn++;
      else if (y0 > cy && y1 <= cy && left < 0) wn--;
    }
    g[py][px] = wn !== 0;
  }
  return g;
}

// 24×24 -> 12 wierszy bitów (bit 11 = lewa kolumna)
function downsample(g) {
  const rows = [];
  for (let y = 0; y < 12; y++) {
    let r = 0;
    for (let x = 0; x < 12; x++) if (g[2 * y][2 * x] || g[2 * y][2 * x + 1] || g[2 * y + 1][2 * x] || g[2 * y + 1][2 * x + 1]) r |= 1 << (11 - x);
    rows.push(r);
  }
  return rows;
}

function iconRows(svgText) {
  const ds = [...svgText.matchAll(/\bd="([^"]+)"/g)].map(m => m[1]);
  if (!ds.length) throw new Error('brak ścieżki w SVG');
  return downsample(rasterize(ds.join(' ')));
}

function generate(svgDir, out) {
  const rowsOf = k => (CUSTOM[k] ? customRows(CUSTOM[k]) : iconRows(fs.readFileSync(path.join(svgDir, k + '.svg'), 'utf8')));
  const entries = ICONS.map(k => `\t\tput("${k}", ${rowsOf(k).map(r => '0x' + r.toString(16).padStart(3, '0')).join(', ')});`);
  const java = `package pl.mibclient.mod.core;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * Ikony pikselowe 12×12 (wiersz = 12 bitów, bit 11 = lewa kolumna). Plik WYGENEROWANY przez mod/tools/icons.js.
 * Źródło: pixelarticons 2.4.2, Copyright (c) 2019 Gerrit Halfmann, licencja MIT (pełna treść: fonts/LICENSES.txt).
 * Ikony z CUSTOM w mod/tools/icons.js to własne rysunki MiB (oryginały mają detale 1 px, które giną w 12×12).
 */
public final class PixelIcons {
	private PixelIcons() {
	}

	private static final Map<String, int[]> ICONS = new LinkedHashMap<String, int[]>();

	private static void put(String key, int... rows) {
		ICONS.put(key, rows);
	}

	static {
${entries.join('\n')}
	}

	/** Wiersze ikony albo null, gdy nie ma takiej ikony. */
	public static int[] get(String key) {
		return ICONS.get(key);
	}

	public static Set<String> keys() {
		return Collections.unmodifiableSet(ICONS.keySet());
	}
}
`;
  fs.writeFileSync(out, java);
  return ICONS.length;
}

if (require.main === module) {
  const [svgDir, out] = process.argv.slice(2);
  if (!svgDir || !out) { console.error('Użycie: node mod/tools/icons.js <katalog SVG> <PixelIcons.java>'); process.exit(2); }
  console.log('ikony:', generate(svgDir, out));
}
module.exports = { polygons, rasterize, downsample, iconRows, customRows, ICONS, CUSTOM };
