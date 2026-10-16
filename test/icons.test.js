const test = require('node:test');
const assert = require('node:assert/strict');
const { rasterize, downsample, iconRows } = require('../mod/tools/icons');

const lit = rows => {
  const out = [];
  rows.forEach((r, y) => { for (let x = 0; x < 12; x++) if (r & (1 << (11 - x))) out.push(x + ',' + y); });
  return out.sort();
};

test('square 4x4 at (2,2) becomes 2x2 at (1,1) in the 12x12 grid', () => {
  assert.deepEqual(lit(downsample(rasterize('M2 2h4v4H2z'))), ['1,1', '1,2', '2,1', '2,2']);
});

test('L-shaped polygon with absolute L/H/V commands', () => {
  const g = rasterize('M0 0H4V2H2V4H0Z');
  assert.equal(g[0][3], true);
  assert.equal(g[1][1], true);
  assert.equal(g[3][1], true);
  assert.equal(g[3][3], false, 'wcięcie litery L puste');
});

test('relative subpaths after z start from the previous subpath start', () => {
  const g = rasterize('M4 20h16v2H4zm16-10h2v10h-2z');
  assert.equal(g[20][4], true);
  assert.equal(g[10][20], true);
  assert.equal(g[10][19], false);
});

test('odd sizes round up to whole 12x12 pixels (any lit source pixel lights the target)', () => {
  assert.deepEqual(lit(downsample(rasterize('M3 3h1v1H3z'))), ['1,1']);
});

test('iconRows reads every path of an SVG file', () => {
  const rows = iconRows('<svg viewBox="0 0 24 24"><path d="M0 0h2v2H0z"/><path d="M22 22h2v2h-2z"/></svg>');
  assert.deepEqual(lit(rows), ['0,0', '11,11']);
  assert.throws(() => iconRows('<svg></svg>'));
});

test('custom 12x12 drawings are exactly 12 rows of 12 pixels', () => {
  const { CUSTOM, customRows } = require('../mod/tools/icons');
  for (const [k, art] of Object.entries(CUSTOM)) {
    assert.equal(art.length, 12, k);
    for (const l of art) assert.match(l, /^[#.]{12}$/, k);
  }
  assert.deepEqual(lit(customRows(['#...........', ...Array(11).fill('............')])), ['0,0']);
});
