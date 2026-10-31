#!/usr/bin/env python3
# Gładka czcionka menu MiB w grze (od 0.30.0): litery Geist (fonts/geist-*.woff2 launchera, licencja OFL w fonts/LICENSES.txt)
# narysowane w obrazki dla dostawcy "bitmap" Minecrafta -> assets/mibclient/font/ui*.json i textures/font/ui*.png.
# Bitmapa zamiast "ttf", bo wymiary są wtedy pewne i te same w podglądzie (PreviewCanvas czyta te same pliki).
# Jednostki czcionki: komórka 24 wysoka, linia bazowa na 20; FabricCanvas rysuje w skali 0,5, więc w menu to 12 i 10,
# a odstęp między literami (gra dodaje 1) wynosi pół jednostki menu.
# Użycie: python3 mod/tools/fonts.py   (potrzebne: pip install fonttools brotli pillow)
import io, json, os
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', '..', 'fonts')
RES = os.path.join(HERE, '..', 'fabric', 'src', 'main', 'resources', 'assets', 'mibclient')
COLS = 16
# czcionki: nazwa -> (grubość, pikseli na jednostkę czcionki)
FACES = {'ui': (500, 2), 'ui_bold': (650, 2), 'ui_title': (700, 4)}
HEIGHT, ASCENT = 24, 20          # w jednostkach czcionki
EM = 18.5                        # wielkość litery w jednostkach czcionki (wielkie litery ~13 = 6,5 jednostki menu)

CHARS = [chr(c) for c in range(0x21, 0x7F)]
CHARS += [chr(c) for c in range(0xA1, 0x100) if c != 0xAD]
CHARS += [chr(c) for c in range(0x100, 0x180)]
CHARS += list('…·×→←↑↓–—„”“’‘«»€•✓')


def instance(path, wght):
    f = TTFont(path)
    f = instancer.instantiateVariableFont(f, {'wght': wght})
    f.flavor = None
    out = io.BytesIO()
    f.save(out)
    out.seek(0)
    return out, set(f.getBestCmap())


def build(name, wght, ppu):
    faces = []
    for src in ('geist-latin.woff2', 'geist-ext.woff2'):
        data, cmap = instance(os.path.join(SRC, src), wght)
        faces.append((ImageFont.truetype(data, round(EM * ppu)), cmap))
    chars = [ch for ch in CHARS if any(ord(ch) in cm for _, cm in faces)]
    rows = [chars[i:i + COLS] for i in range(0, len(chars), COLS)]
    rows[-1] += ['\u0000'] * (COLS - len(rows[-1]))
    cw, ch_ = 22 * ppu, HEIGHT * ppu
    img = Image.new('RGBA', (cw * COLS, ch_ * len(rows)), (0, 0, 0, 0))
    for r, row in enumerate(rows):
        for c, chh in enumerate(row):
            if chh == '\u0000':
                continue
            font = next(f for f, cm in faces if ord(chh) in cm)
            mask = Image.new('L', (cw, ch_), 0)
            ImageDraw.Draw(mask).text((ppu // 4, ASCENT * ppu), chh, font=font, fill=255, anchor='ls')
            glyph = Image.new('RGBA', (cw, ch_), (255, 255, 255, 0))
            glyph.putalpha(mask)
            img.alpha_composite(glyph, (c * cw, r * ch_))
    os.makedirs(os.path.join(RES, 'textures', 'font'), exist_ok=True)
    img.save(os.path.join(RES, 'textures', 'font', name + '.png'), optimize=True)
    space = round(EM * 0.26)
    providers = [{'type': 'space', 'advances': {' ': space, ' ': space}},
                 {'type': 'bitmap', 'file': 'mibclient:font/' + name + '.png', 'height': HEIGHT, 'ascent': ASCENT, 'chars': [''.join(r) for r in rows]},
                 {'type': 'reference', 'id': 'minecraft:default'}]
    with open(os.path.join(RES, 'font', name + '.json'), 'w', encoding='utf-8') as f:
        json.dump({'providers': providers}, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print(name, img.size, len(chars), 'znaków')


for n, (w, p) in FACES.items():
    build(n, w, p)
