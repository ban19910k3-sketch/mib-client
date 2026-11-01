# Nowe tekstury 43 kosmetyków świątecznych MiB (te same id, rodzaje i układy co w schema.sql launchera).
# Układy: peleryna 64x32 (przód 10x16 od (1,1)), czapka/maska jak hełm (głowa od (0,0), nakładka od (32,0)),
# wysoka czapka 128x64 (dolna kostka w lewej połowie, górna od x=64), skrzydła wróżki 128x64 (skrzydło 32x40 w (0,0)
# i (32,0), przyczepione lewą krawędzią), aura 64x32 (obrazki cząsteczek 8x8 w (0,0), (8,0), (16,0)).
# Animacje: klatki jedna pod drugą, co 100 ms.
import math, os, random, json, base64, io
from PIL import Image

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
os.makedirs(OUT, exist_ok=True)

def C(h, a=255):
    h = h.lstrip('#'); return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)
def sh(c, f):
    return tuple(max(0, min(255, int(round(v * f)))) for v in c[:3]) + (c[3],)
def mix(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3)) + (255,)
CLEAR = (0, 0, 0, 0)

class T:
    def __init__(s, w, h, frames=1):
        s.w, s.h, s.n = w, h, frames
        s.im = Image.new('RGBA', (w, h * frames), CLEAR)
        s.f = 0
    def p(s, x, y, c):
        if 0 <= x < s.w and 0 <= y < s.h and c is not None:
            s.im.putpixel((int(x), int(y) + s.f * s.h), c)
    def g(s, x, y):
        return s.im.getpixel((x, y + s.f * s.h))
    def rect(s, x, y, w, h, c):
        for j in range(h):
            for i in range(w): s.p(x + i, y + j, c)
    def spr(s, x, y, rows, pal):
        for j, r in enumerate(rows):
            for i, ch in enumerate(r):
                if ch in pal: s.p(x + i, y + j, pal[ch])
    def save(s, name):
        s.im.save(os.path.join(OUT, name + '.png'), optimize=True)

# ---------- głowa (czapka/maska): ściany 8x8 ----------
# side(x 0..31 dookoła: prawa 0-7, przód 8-15, lewa 16-23, tył 24-31; y 0..7 od góry); top(x,y): y=7 przy przodzie
class Head:
    def __init__(s, t, ox, oy=0):
        s.t, s.ox, s.oy = t, ox, oy
    def side(s, x, y, c):
        s.t.p(s.ox + (x % 32), s.oy + 8 + y, c)
    def top(s, x, y, c):
        s.t.p(s.ox + 8 + x, s.oy + y, c)
    def bottom(s, x, y, c):
        s.t.p(s.ox + 16 + x, s.oy + y, c)
    def face(s, which, x, y, c):  # which: right/front/left/back
        o = {'right': 0, 'front': 8, 'left': 16, 'back': 24}[which]
        s.t.p(s.ox + o + x, s.oy + 8 + y, c)
    def face_spr(s, which, rows, pal):
        for j, r in enumerate(rows):
            for i, ch in enumerate(r):
                if ch in pal: s.face(which, i, j, pal[ch])
    def top_spr(s, rows, pal):
        for j, r in enumerate(rows):
            for i, ch in enumerate(r):
                if ch in pal: s.top(i, j, pal[ch])
    def band(s, y, colf):  # colf(x) -> kolor dla x dookoła
        for x in range(32): s.side(x, y, colf(x))
    def fill_top(s, colf):
        for y in range(8):
            for x in range(8): s.top(x, y, colf(x, y))

def hat_shell(t, ox):  # wewnętrzna (10 px) i nakładka (11 px)
    return Head(t, ox), Head(t, ox + 32)

# ---------- peleryna: przód 10x16 w (1,1), tył w (12,1), boki, góra, dół ----------
class Cape:
    def __init__(s, t):
        s.t = t
    def front(s, x, y, c):
        s.t.p(1 + x, 1 + y, c)
    def back(s, x, y, c):
        s.t.p(12 + x, 1 + y, c)
    def edges(s, c):
        for y in range(16): s.t.p(0, 1 + y, c); s.t.p(11, 1 + y, c)
        for x in range(10): s.t.p(1 + x, 0, c); s.t.p(11 + x, 0, c)
    def fill(s, f, back_dark=0.62, edge=None):
        for y in range(16):
            for x in range(10):
                c = f(x, y)
                s.front(x, y, c)
                s.back(9 - x, y, sh(c, back_dark))
        s.edges(edge or sh(f(0, 0), 0.7))

def rnd(seed):
    return random.Random(seed)

# ---------- skrzydło 32x40 (przyczepione przy x=0, czubek w prawo) ----------
def wings(t, draw, back=0.8):
    w = Image.new('RGBA', (32, 40), CLEAR)
    class W:
        def p(_, x, y, c):
            if 0 <= x < 32 and 0 <= y < 40 and c is not None: w.putpixel((int(x), int(y)), c)
        def g(_, x, y):
            return w.getpixel((x, y)) if 0 <= x < 32 and 0 <= y < 40 else CLEAR
    draw(W())
    for y in range(40):
        for x in range(32):
            c = w.getpixel((x, y))
            if c[3]:
                t.p(x, y, c)
                t.p(32 + x, y, sh(c, back))

def outline(W, col, inside=None):
    pts = [(x, y) for y in range(40) for x in range(32) if W.g(x, y)[3]]
    S = set(pts)
    for x, y in pts:
        if any((x + dx, y + dy) not in S for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            W.p(x, y, col)

def shape_fill(W, inside, colf):
    for y in range(40):
        for x in range(32):
            if inside(x, y): W.p(x, y, colf(x, y))

def ell(x, y, cx, cy, rx, ry):
    return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1

# ---------- cząsteczki aury 8x8 ----------
def aura(name, cells):
    t = T(64, 32)
    for i, (rows, pal) in enumerate(cells):
        t.spr(i * 8, 0, rows, pal)
    t.save(name)

W_ = C('#ffffff'); K = C('#14101c')

# =====================================================================
# ŚWIĘTO NIEPODLEGŁOŚCI
# =====================================================================
def niepodleglosc_cape_flaga():
    n = 8; t = T(64, 32, n); cp = Cape(t)
    WH, RD, GOLD = C('#f4f4f6'), C('#d4213d'), C('#e8b33a')
    for f in range(n):
        t.f = f
        def col(x, y):
            base = WH if y < 8 else RD
            wave = math.sin((x * 0.7 + y * 0.35) - f * (2 * math.pi / n))
            c = sh(base, 1 + 0.10 * wave)
            if (x + y) % 2 == 0: c = sh(c, 0.97)
            if y == 7: c = sh(WH, 0.86)
            return c
        cp.fill(col, edge=GOLD)
        for y in range(16):
            cp.front(0, y, sh(GOLD, 0.9)); cp.front(9, y, sh(GOLD, 0.9))
        # orzeł w koronie (mały, złoty) na czerwonym
        cp_eagle = ['..g..g..', '.gGggGg.', 'gGGGGGGg', '.gGGGGg.', '..gGGg..', '..g..g..']
        for j, r in enumerate(cp_eagle):
            for i, ch in enumerate(r):
                if ch != '.': cp.front(1 + i, 9 + j, sh(GOLD, 1.12 if ch == 'G' else 0.85))
    t.save('niepodleglosc_cape_flaga')

def niepodleglosc_hat_kotylion():
    t = T(64, 32); inner, over = hat_shell(t, 0)
    WH, RD, R2 = C('#f6f6f8'), C('#d4213d'), C('#a3122b')
    # kotylion po lewej stronie głowy (lewa ściana) i biało-czerwona opaska
    for x in range(32):
        over.side(x, 1, WH if (x // 2) % 2 == 0 else RD)
    rows = ['..rRRr..', '.rWWWWr.', 'rWwRRwWr', 'RWRrrRWR', 'RWRrrRWR', 'rWwRRwWr', '.rWWWWr.', '..rRRr..']
    over.face_spr('left', rows, {'r': R2, 'R': RD, 'W': WH, 'w': C('#d9d9e0')})
    over.face_spr('front', ['', '', '', '', '', '', '', ''], {})
    # wstążki pod kotylionem
    for y in range(3):
        over.face('left', 2, 5 + y, RD); over.face('left', 5, 5 + y, WH)
    t.save('niepodleglosc_hat_kotylion')

def sparkle(c1, c2, c3):
    return ['...a....', '...b....', '.a.c.a..', 'abcccba.', '.a.c.a..', '...b....', '...a....', '........'], {'a': c3, 'b': c2, 'c': c1}

def niepodleglosc_aura_iskry_magic():
    WH, RD = C('#ffffff'), C('#ff3654')
    aura('niepodleglosc_aura_iskry_magic', [
        sparkle(WH, C('#ffe0e6'), C('#ff8fa3', 200)),
        sparkle(RD, C('#ff6b80'), C('#ffb3c0', 200)),
        (['........', '........', '...ab...', '..abba..', '..abba..', '...ab...', '........', '........'], {'a': C('#ff6b80', 220), 'b': WH}),
    ])

# =====================================================================
# ZIMA
# =====================================================================
def zima_cape_sweter():
    t = T(64, 32); cp = Cape(t)
    RD, R2, WH, GR = C('#c81e35'), C('#a01529'), C('#f5f2ea'), C('#1f7a45')
    flake = ['....w.....', '..w.w.w...', '...www....', 'wwwwWwwww.', '...www....', '..w.w.w...', '....w.....']
    def col(x, y):
        c = RD
        if y in (0, 15): c = GR
        elif y in (1, 14): c = WH
        elif y == 2 or y == 13: c = GR if x % 2 else WH
        if y in (3, 12): c = R2
        # dzianina: jaśniejsze „V” co drugą kolumnę
        if c in (RD,) and (x + y) % 2 == 0: c = sh(c, 1.08)
        return c
    cp.fill(col)
    for j, r in enumerate(flake):
        for i, ch in enumerate(r):
            if ch != '.': cp.front(i, 5 + j, WH if ch == 'w' else C('#ffd84a'))
    # renifery w pasku (małe) na tyle — wewnętrzna strona zostaje gładka
    t.save('zima_cape_sweter')

def zima_cape_zorza():
    n = 8; t = T(64, 32, n); cp = Cape(t); r = rnd(3)
    stars = [(r.randrange(10), r.randrange(16)) for _ in range(9)]
    for f in range(n):
        t.f = f
        ph = f * 2 * math.pi / n
        def col(x, y):
            base = mix(C('#06102a'), C('#0d1f4a'), y / 15)
            for k, (cc, amp, off) in enumerate([(C('#36f5a0'), 1.0, 0), (C('#22c4d6'), 0.8, 2.1), (C('#9b5cf6'), 0.6, 4.2)]):
                yy = 4 + k * 3 + 2.2 * math.sin(x * 0.55 + ph + off)
                d = abs(y - yy)
                if d < 2.2: base = mix(base, cc, (1 - d / 2.2) * amp * 0.85)
            return base
        cp.fill(col, back_dark=0.55, edge=C('#06102a'))
        for i, (x, y) in enumerate(stars):
            if (f + i) % 3: cp.front(x, y, C('#e9f3ff') if y > 9 else C('#ffffff', 255))
        for x in range(10):
            cp.front(x, 15, C('#e8f4ff')); cp.front(x, 14, C('#cfe4f5') if x % 3 else C('#e8f4ff'))
    t.save('zima_cape_zorza')

def zima_cape_sniezynki():
    n = 8; t = T(64, 32, n); cp = Cape(t); r = rnd(5)
    flakes = [(r.randrange(10), r.randrange(16), r.choice([1, 2])) for _ in range(12)]
    for f in range(n):
        t.f = f
        cp.fill(lambda x, y: mix(C('#123a7a'), C('#0a1f47'), y / 15), back_dark=0.6, edge=C('#0a1f47'))
        for (x, y, sp) in flakes:
            yy = (y + f * sp * 2 // 2) % 16
            xx = (x + (1 if (yy // 4) % 2 else 0)) % 10
            cp.front(xx, yy, C('#ffffff'))
            if sp == 2:
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    if 0 <= xx + dx < 10 and 0 <= yy + dy < 16: cp.front(xx + dx, yy + dy, C('#bfe0ff'))
        for x in range(10):
            cp.front(x, 15, C('#f2f8ff')); cp.front(x, 14, C('#f2f8ff') if (x + f) % 4 else C('#d6ebff'))
    t.save('zima_cape_sniezynki')

def tall_hat(name, lower, upper, frames=1):
    t = T(128, 64, frames)
    for f in range(frames):
        t.f = f
        li, lo = hat_shell(t, 0); ui, uo = hat_shell(t, 64)
        lower(li, lo, f); upper(ui, uo, f)
    t.save(name)

def zima_hat_mikolaj():
    RD, R2, R3, WH, W2 = C('#d1203a'), C('#a8152c'), C('#e23a52'), C('#fbfbff'), C('#dfe3ee')
    def lower(i, o, f):  # czerwień nad czołem i futrzany brzeg; twarz zostaje odkryta
        for x in range(32):
            for y in (0, 1): i.side(x, y, R3 if (x + y) % 3 == 0 else RD)
            for y in (2, 3): o.side(x, y, WH if (x + y) % 3 else W2)
        i.fill_top(lambda x, y: RD)
    def upper(i, o, f):  # stożek, pompon na czubku
        for y in range(8):
            ins = (7 - y) // 2
            for x in range(32):
                k = x % 8
                if ins <= k < 8 - ins: i.side(x, y, R2 if x >= 24 or k in (ins, 7 - ins) else (R3 if (x + y) % 4 == 0 else RD))
        pom = ['........', '........', '...ww...', '..wWWw..', '..wWWw..', '...ww...', '........', '........']
        o.top_spr(pom, {'w': W2, 'W': WH})
        for x in range(32):
            if 3 <= x % 8 <= 4: o.side(x, 0, WH); o.side(x, 1, W2)
    tall_hat('zima_hat_mikolaj', lower, upper)

def zima_hat_renifer():
    BR, B2, B3, BAND = C('#8a5a2b'), C('#6b4220'), C('#a8743c'), C('#c8a06a')
    def lower(i, o, f):
        for x in range(32):  # opaska
            o.side(x, 0, BAND); o.side(x, 1, sh(BAND, 0.8))
        for side in ('right', 'left'):  # nasady rogów
            for y in range(0, 3): o.face(side, 3, y, BR); o.face(side, 4, y, BR)
        ear = ['........', '..bb....', '.bBBb...', '.bPPb...', '..bb....']
        for side in ('right', 'left'):
            o.face_spr(side, ['', '', ''] + ear, {'b': B2, 'B': B3, 'P': C('#e3a08a')})
    def upper(i, o, f):  # rozgałęzione rogi po bokach
        ant = ['B......B', 'B..B..B.', '.B.B.B..', '.BBBBB..', '...BB...', '...BB...', '...BB...', '...BB...']
        for side in ('right', 'left'):
            o.face_spr(side, ant, {'B': BR})
            for j, r in enumerate(ant):
                for k, ch in enumerate(r):
                    if ch == 'B' and k % 3 == 0: o.face(side, k, j, B3)
    tall_hat('zima_hat_renifer', lower, upper)

def zima_hat_elf():
    GN, G2, G3, RD, WH, GD = C('#1f9a4a'), C('#157338'), C('#2fbf5f'), C('#d1203a'), C('#ffffff'), C('#f2c230')
    def lower(i, o, f):
        for x in range(32):
            for y in (0, 1): i.side(x, y, G3 if (x + 2 * y) % 5 == 0 else GN)
            o.side(x, 2, RD if (x // 2) % 2 else WH); o.side(x, 3, sh(RD, 0.85) if (x // 2) % 2 else C('#e6e6ee'))
        i.fill_top(lambda x, y: GN)
    def upper(i, o, f):
        for y in range(8):
            ins = (7 - y) // 2
            for x in range(32):
                k = x % 8
                if ins <= k < 8 - ins: i.side(x, y, G2 if x >= 24 or k in (ins, 7 - ins) else (G3 if (x + y) % 5 == 0 else GN))
        bell = ['........', '........', '...yy...', '..yYYy..', '..yYYy..', '...yy...', '........', '........']
        o.top_spr(bell, {'y': C('#c99a1c'), 'Y': GD})
        for x in range(32):
            if 3 <= x % 8 <= 4: o.side(x, 0, GD)
    tall_hat('zima_hat_elf', lower, upper)

def zima_hat_balwan():
    SN, S2, S3, CO, CA, BK, BD = C('#f4f7fb'), C('#d7dfeb'), C('#ffffff'), C('#1b1b22'), C('#f07a1a'), C('#16131c'), C('#c81e35')
    def lower(i, o, f):  # głowa bałwana
        for y in range(8):
            for x in range(32): i.side(x, y, S2 if (x * 7 + y * 3) % 11 == 0 else (S3 if (x + y) % 4 == 0 else SN))
        i.fill_top(lambda x, y: SN)
        face = ['........', '........', '.CC..CC.', '.CC..CC.', '...AAA..', '....AAa.', '.C.C.C..', '..C.C...']
        i.face_spr('front', face, {'C': CO, 'A': CA, 'a': sh(CA, 0.8)})
        o.face('front', 5, 4, CA); o.face('front', 6, 5, CA)
    def upper(i, o, f):  # cylinder z czerwoną wstążką
        for y in range(8):
            for x in range(32):
                if 1 <= x % 8 <= 6: i.side(x, y, BK if y < 6 else (BD if y == 6 else sh(BK, 1.6)))
        i.fill_top(lambda x, y: sh(BK, 1.3) if 1 <= x <= 6 and 1 <= y <= 6 else None)
        for x in range(32): o.side(x, 7, sh(BK, 1.5))
        o.face('front', 2, 6, C('#2f9d4a')); o.face('front', 3, 6, C('#e23a52'))
    tall_hat('zima_hat_balwan', lower, upper)

def ice_wing(W, f, n):
    def inside(x, y):
        return ell(x, y, 13, 11, 14, 11) or ell(x, y, 9, 27, 9, 9)
    shim = f * 40 // n
    def col(x, y):
        c = mix(C('#c9f2ff'), C('#5fb8f0'), min(1, (x + y * 0.4) / 30))
        if (x + y - shim) % 13 in (0, 1): c = mix(c, C('#ffffff'), 0.7)
        return c
    shape_fill(W, inside, col)
    for k in range(1, 6):  # żyłki kryształu
        for s in range(0, 26):
            x, y = s * math.cos(k * 0.32 - 0.5), s * math.sin(k * 0.32 - 0.5) + 10
            if inside(int(x), int(y)): W.p(int(x), int(y), C('#e8fbff'))
    outline(W, C('#2f7fc1'))

def zima_wings_lod():
    n = 6; t = T(128, 64, n)
    for f in range(n):
        t.f = f; wings(t, lambda W: ice_wing(W, f, n))
    t.save('zima_wings_lod')

FLAKE = (['...a....', '.a.b.a..', '..bcb...', 'abcccba.', '..bcb...', '.a.b.a..', '...a....', '........'],)
def zima_aura_snieg_snow():
    aura('zima_aura_snieg_snow', [
        (FLAKE[0], {'a': C('#bfe0ff', 210), 'b': C('#e6f3ff'), 'c': W_}),
        (['........', '..a.a...', '...b....', '.abcba..', '...b....', '..a.a...', '........', '........'], {'a': C('#bfe0ff', 200), 'b': C('#e6f3ff'), 'c': W_}),
        (['........', '........', '...a....', '..aba...', '...a....', '........', '........', '........'], {'a': C('#cfe8ff', 200), 'b': W_}),
    ])

def gift(c, c2, rib):
    return (['..y.y...', '...y....', 'RRRyRRR.', 'rRRyRRr.', 'yyyyyyy.', 'rRRyRRr.', 'rRRyRRr.', '.rrYrr..'],
            {'R': c, 'r': c2, 'y': rib, 'Y': sh(rib, 0.8)})

def zima_aura_prezenty_ghosts():
    aura('zima_aura_prezenty_ghosts', [gift(C('#d1203a'), C('#a01529'), C('#ffd84a')), gift(C('#1f9a4a'), C('#157338'), C('#ffffff')), gift(C('#3d6fe0'), C('#2a4fb0'), C('#ffd84a'))])

# =====================================================================
# ADWENT (nagrody z kalendarza)
# =====================================================================
def adwent_hat_pompon():
    PU, P2, P3, WH, W2 = C('#7c3aed'), C('#5b21b6'), C('#a368ff'), C('#ffffff'), C('#e6defa')
    def lower(i, o, f):  # dzianina nad czołem i biały wywinięty brzeg
        for x in range(32):
            for y in (0, 1): i.side(x, y, P3 if (x + y) % 2 == 0 else PU)
            o.side(x, 2, WH); o.side(x, 3, W2 if x % 2 else WH)
        i.fill_top(lambda x, y: P3 if (x + y) % 2 else PU)
    def upper(i, o, f):  # niska kopuła czapki i pompon tuż nad nią
        for y in range(4, 8):
            ins = 7 - y
            for x in range(32):
                k = x % 8
                if ins <= k < 8 - ins: i.side(x, y, P3 if (x + y) % 2 == 0 else (P2 if x >= 24 else PU))
        for y in range(1, 4):
            for x in range(32):
                if 2 <= x % 8 <= 5: o.side(x, y, WH if (x + y) % 2 else W2)
        pom = ['........', '..wwww..', '.wWWWWw.', '.wWWWWw.', '.wWWWWw.', '.wWWWWw.', '..wwww..', '........']
        o.top_spr(pom, {'w': W2, 'W': WH})
    tall_hat('adwent_hat_pompon', lower, upper)

def adwent_mask_broda():
    t = T(64, 32); i, o = hat_shell(t, 0)
    WH, W2, W3 = C('#ffffff'), C('#e4e7f0'), C('#c9cede')
    beard = ['........', '........', '........', '........', '.WwWWwW.', 'WWWWWWWW', 'wWWwWWWw', '.WwWWwW.']
    must = ['........', '........', '........', '.WWWWWW.', 'WWw..wWW', '........', '........', '........']
    o.face_spr('front', beard, {'W': WH, 'w': W2})
    o.face_spr('front', must, {'W': WH, 'w': W3})
    for side in ('right', 'left'):
        o.face_spr(side, ['', '', '', '', 'W.......' if side == 'left' else '.......W', 'WW......' if side == 'left' else '......WW', 'WWW.....' if side == 'left' else '.....WWW', 'WW......' if side == 'left' else '......WW'], {'W': W2})
    i.face_spr('front', ['', '', '', '', '', '', '.WWWWWW.', '..WWWW..'], {'W': W3})
    t.save('adwent_mask_broda')

STAR = (['...y....', '...y....', 'yyyYyyy.', '.yYYYy..', '..yYy...', '.y...y..', '........', '........'],)
def adwent_aura_gwiazdki_snow():
    G, G2, G3 = C('#ffd34a'), C('#ffefa8'), C('#e9a91c')
    aura('adwent_aura_gwiazdki_snow', [
        (STAR[0], {'y': G, 'Y': G2}),
        (['........', '...y....', '..yYy...', '.yYYYy..', '..yYy...', '...y....', '........', '........'], {'y': G3, 'Y': G2}),
        (['........', '........', '...y....', '..yYy...', '...y....', '........', '........', '........'], {'y': G, 'Y': C('#ffffff')}),
    ])

def adwent_cape_gwiazda():
    n = 8; t = T(64, 32, n); cp = Cape(t)
    for f in range(n):
        t.f = f
        tw = 0.5 + 0.5 * math.sin(f * 2 * math.pi / n)
        def col(x, y):
            c = mix(C('#0b1440'), C('#1c1050'), y / 15)
            d = math.hypot(x - 4.5, y - 5)
            if d < 5: c = mix(c, C('#ffd34a'), (1 - d / 5) * (0.25 + 0.2 * tw))
            return c
        cp.fill(col, edge=C('#ffd34a'))
        star = ['....Y....', '....Y....', '...yYy...', 'YYyYWYyYY', '..yYYYy..', '..Y.y.Y..', '.Y.....Y.']
        for j, r in enumerate(star):
            for i, ch in enumerate(r):
                if ch != '.': cp.front(i, 2 + j, {'Y': C('#ffd34a'), 'y': C('#ffe98a'), 'W': C('#ffffff')}[ch] if not (ch == 'W' and tw < 0.3) else C('#fff3b0'))
        for k in range(6):  # ogon komety
            x, y = 6 + k // 2, 9 + k
            if 0 <= x < 10 and y < 16: cp.front(x, y, mix(C('#ffe98a'), C('#1c1050'), k / 7))
        for k, (x, y) in enumerate([(1, 12), (8, 1), (2, 14), (7, 13)]):
            if (f + k) % 2: cp.front(x, y, C('#ffffff'))
    t.save('adwent_cape_gwiazda')

def angel_wing(W, f, n):
    # skrzydło z piór: wypukły górny łuk, pióra coraz dłuższe ku czubkowi
    def top(x):
        return 4 - int(4 * math.sin(math.pi * min(x, 28) / 28)) + x // 6
    def inside(x, y):
        return 0 <= x <= 30 and top(x) <= y <= top(x) + 12 + x * 0.8 and y < 40
    glow = f * 40 // n
    def col(x, y):
        d = y - top(x)
        c = C('#ffffff') if d < 6 else (C('#f4f5fb') if (x // 3) % 2 else C('#e9ebf6'))
        if d >= 6 and x % 3 == 0: c = C('#d5d9ea')
        if (x + y - glow) % 19 == 0: c = C('#fff3b0')
        return c
    shape_fill(W, inside, col)
    for x in range(31):
        end = int(top(x) + 12 + x * 0.8)
        if x % 3 == 2 and end < 40: W.p(x, end, CLEAR)
    outline(W, C('#b9bfd8'))
    for x in range(31): W.p(x, top(x), C('#f2c230'))

def adwent_wings_aniol():
    n = 6; t = T(128, 64, n)
    for f in range(n):
        t.f = f; wings(t, lambda W: angel_wing(W, f, n), back=0.86)
    t.save('adwent_wings_aniol')

# =====================================================================
# SYLWESTER
# =====================================================================
def burst(c, c2):
    return (['...a....', '.a.b.a..', '..bcb...', 'abcccba.', '..bcb...', '.a.b.a..', '...a....', '........'], {'a': sh(c, 0.85), 'b': c, 'c': c2})

def sylwester_aura_fajerwerki_burst():
    aura('sylwester_aura_fajerwerki_burst', [burst(C('#ffcf3a'), C('#fff6c9')), burst(C('#ff4fa8'), C('#ffd1e9')), burst(C('#3ad8ff'), C('#d4f6ff'))])

def sylwester_hat_cylinder():
    BK, B2, B3, GD, G2 = C('#17141f'), C('#2a2536'), C('#0e0c14'), C('#e8b33a'), C('#fff1b8')
    def lower(i, o, f):  # rondo na czubku głowy
        for x in range(32): o.side(x, 0, B2); o.side(x, 1, B3)
        o.fill_top(lambda x, y: B2 if x in (0, 7) or y in (0, 7) else None)
    def upper(i, o, f):
        for y in range(8):
            for x in range(32):
                c = BK if (x % 8) not in (0, 7) else B2
                if y == 6: c = GD if (x + y) % 3 else G2
                if y == 7: c = B3
                i.side(x, y, c)
        i.fill_top(lambda x, y: B2 if (x in (0, 7) or y in (0, 7)) else BK)
        o.face_spr('front', ['', '', '', '', '', '', '...gg...', ''], {'g': C('#ffffff')})
    tall_hat('sylwester_hat_cylinder', lower, upper)

def sylwester_cape_konfetti():
    n = 8; t = T(64, 32, n); cp = Cape(t); r = rnd(9)
    COLS = [C('#ffcf3a'), C('#ff4fa8'), C('#3ad8ff'), C('#ffffff'), C('#9b5cf6')]
    bits = [(r.randrange(10), r.randrange(16), r.choice(COLS), r.choice([1, 2])) for _ in range(16)]
    for f in range(n):
        t.f = f
        cp.fill(lambda x, y: mix(C('#1a1426'), C('#0d0a14'), y / 15) if (x + y) % 5 else C('#221a33'), edge=C('#e8b33a'))
        for y in range(16): cp.front(0, y, C('#e8b33a')); cp.front(9, y, C('#e8b33a'))
        for (x, y, c, sp) in bits:
            yy = (y + f * sp) % 16
            cp.front(x, yy, c)
            if sp == 1 and x + 1 < 9: cp.front(x + 1, yy, sh(c, 0.75))
    t.save('sylwester_cape_konfetti')

# =====================================================================
# WALENTYNKI
# =====================================================================
def amor_wing(W):
    def inside(x, y):
        return ell(x, y, 14, 13, 15, 12) and y <= 26 or ell(x, y, 10, 26, 10, 9)
    def col(x, y):
        row = int(y // 5)
        c = C('#ffffff') if row % 2 == 0 else C('#ffe3ef')
        if x > 18: c = mix(c, C('#ffb3d1'), (x - 18) / 14)
        return c
    shape_fill(W, inside, col)
    heart = ['.RR.RR.', 'RrRRRRR', 'RRRRRRR', '.RRRRR.', '..RRR..', '...R...']
    for j, rr in enumerate(heart):
        for i, ch in enumerate(rr):
            if ch != '.': W.p(9 + i, 9 + j, C('#e8264f') if ch == 'R' else C('#ff8fa8'))
    outline(W, C('#f08fb3'))

def walentynki_wings_amor():
    t = T(128, 64); wings(t, amor_wing, back=0.9); t.save('walentynki_wings_amor')

HEART = ['.RR.RR..', 'RrRRRRR.', 'RRRRRRR.', '.RRRRR..', '..RRR...', '...R....', '........', '........']
def walentynki_aura_serca_souls():
    aura('walentynki_aura_serca_souls', [
        (HEART, {'R': C('#ff3a62'), 'r': C('#ffc2cf')}),
        (HEART, {'R': C('#ff8fb0'), 'r': C('#ffffff')}),
        (['........', '.RR.RR..', '.RRRRR..', '..RRR...', '...R....', '........', '........', '........'], {'R': C('#ffd1de', 220)}),
    ])

def walentynki_hat_wianek():
    t = T(64, 32); i, o = hat_shell(t, 0)
    LF, L2, RS, R2, PK = C('#2f8a3e'), C('#1f6a2e'), C('#e8264f'), C('#b0173a'), C('#ff8fb0')
    for x in range(32):
        o.side(x, 0, LF if x % 2 else L2); o.side(x, 1, L2 if x % 3 else LF)
        if x % 4 == 1:
            o.side(x, 0, RS if (x // 4) % 2 else PK); o.side(x + 1, 0, R2 if (x // 4) % 2 else sh(PK, 0.85))
            o.side(x, 1, R2 if (x // 4) % 2 else sh(PK, 0.8))
    for y in range(8):  # wianek widoczny z góry: pierścień
        for x in range(8):
            if x in (0, 7) or y in (0, 7): o.top(x, y, RS if (x + y) % 4 == 0 else (PK if (x + y) % 4 == 2 else LF))
    t.save('walentynki_hat_wianek')

# =====================================================================
# WIELKANOC
# =====================================================================
def wielkanoc_hat_uszy():
    WH, W2, PK, P2 = C('#ffffff'), C('#e8e6ef'), C('#ffb3cd'), C('#f58fb3')
    def lower(i, o, f):  # różowa opaska
        for x in range(32): o.side(x, 0, PK if x % 2 else P2)
        o.fill_top(lambda x, y: (PK if x % 2 else P2) if y in (3, 4) else None)
    def upper(i, o, f):  # dwa uszy z różowym środkiem
        ear = ['.ww..ww.', 'wWWwwWWw', 'wPPwwPPw', 'wPPwwPPw', 'wPPwwPPw', 'wPPwwPPw', 'wWPwwPWw', '.WW..WW.']
        o.face_spr('front', ear, {'w': W2, 'W': WH, 'P': PK})
        o.face_spr('back', ear, {'w': W2, 'W': WH, 'P': W2})
        for side in ('right', 'left'):
            for y in range(1, 8): o.face(side, 3, y, W2); o.face(side, 4, y, WH)
    tall_hat('wielkanoc_hat_uszy', lower, upper)

def egg_col(x, y, pal):
    band = (y + (1 if x % 4 < 2 else 0)) // 2
    c = pal[band % len(pal)]
    if (x + y) % 4 == 0: c = sh(c, 1.1)
    return c

def wielkanoc_hat_pisanka():
    PAL = [C('#ffcf3a'), C('#ff6b8a'), C('#3ad8b0'), C('#8f6bff')]
    def lower(i, o, f):  # dół skorupki nad czołem z postrzępionym brzegiem
        for x in range(32):
            for y in range(4):
                if y < 3 or x % 2 == 0: i.side(x, y, egg_col(x, y + 8, PAL))
        i.fill_top(lambda x, y: PAL[0])
    def upper(i, o, f):  # zwężony czubek jajka
        for y in range(8):
            ins = max(0, (7 - y) // 2)
            for x in range(32):
                if ins <= x % 8 < 8 - ins: i.side(x, y, egg_col(x, y, PAL))
        i.fill_top(lambda x, y: PAL[2] if 2 <= x <= 5 and 2 <= y <= 5 else None)
    tall_hat('wielkanoc_hat_pisanka', lower, upper)

def wielkanoc_cape_pisanki():
    t = T(64, 32); cp = Cape(t)
    def col(x, y):
        c = mix(C('#c9f2d9'), C('#9ee0b8'), y / 15)
        if y >= 13: c = C('#4fbf6a') if (x + y) % 2 else C('#3aa357')
        return c
    cp.fill(col, edge=C('#3aa357'))
    eggs = [(1, 2, [C('#ff6b8a'), C('#ffffff')]), (6, 4, [C('#8f6bff'), C('#ffcf3a')]), (2, 8, [C('#3ad8ff'), C('#ffffff')]), (6, 10, [C('#ffcf3a'), C('#ff6b8a')])]
    egg = ['.AA.', 'ABBA', 'AAAA', 'ABBA', '.AA.']
    for (ex, ey, pal) in eggs:
        for j, r in enumerate(egg):
            for i, ch in enumerate(r):
                if ch != '.': cp.front(ex + i, ey + j, pal[0] if ch == 'A' else pal[1])
    t.save('wielkanoc_cape_pisanki')

def wielkanoc_aura_platki_snow():
    aura('wielkanoc_aura_platki_snow', [
        (['........', '..pP....', '.pPPp...', '.pPPPp..', '..pPPp..', '...pp...', '........', '........'], {'p': C('#ff8fb3'), 'P': C('#ffd1e1')}),
        (['........', '...wW...', '..wWWw..', '..wWWw..', '...ww...', '........', '........', '........'], {'w': C('#f2e6ff'), 'W': C('#ffffff')}),
        (['........', '..y.y...', '...Y....', '..y.y...', '........', '........', '........', '........'], {'y': C('#ffd34a'), 'Y': C('#fff3b0')}),
    ])

def butterfly_wing(W):
    def inside(x, y):
        return ell(x, y, 14, 12, 15, 11) or ell(x, y, 11, 28, 10, 9)
    def col(x, y):
        c = mix(C('#ff9a1f'), C('#ff6a00'), min(1, x / 28))
        return c
    shape_fill(W, inside, col)
    for k in range(4):  # czarne żyłki
        for s in range(30):
            a = -0.55 + k * 0.42
            x, y = int(s * math.cos(a)), int(14 + s * math.sin(a))
            if inside(x, y): W.p(x, y, C('#1a1208'))
    outline(W, C('#1a1208'))
    pts = [(x, y) for y in range(40) for x in range(32) if W.g(x, y)[3]]
    for (x, y) in pts:  # białe kropki na czarnym brzegu
        if W.g(x, y) == C('#1a1208') and (x * 3 + y) % 7 == 0 and x > 8: W.p(x, y, C('#ffffff'))

def wielkanoc_wings_motyl():
    t = T(128, 64); wings(t, butterfly_wing, back=0.82); t.save('wielkanoc_wings_motyl')

# =====================================================================
# PRIMA APRILIS
# =====================================================================
def primaaprilis_hat_blazen():
    RD, YL, PU, GD = C('#d1203a'), C('#ffcf3a'), C('#7c3aed'), C('#e8b33a')
    def lower(i, o, f):  # szachownica nad czołem, fioletowy brzeg z dzwoneczkami
        for x in range(32):
            for y in range(3): i.side(x, y, RD if ((x // 2) + (y // 2)) % 2 else YL)
            o.side(x, 3, PU if (x // 2) % 2 else sh(PU, 0.7))
            if x % 4 == 1: o.side(x, 4, GD)
        i.fill_top(lambda x, y: RD if (x // 4 + y // 4) % 2 else YL)
    def upper(i, o, f):  # dwa opadające rogi z dzwonkami
        horn_r = ['......YY', '.....RY.', '....RR..', '...RR...', '..RR....', '.RR.....', 'RR......', 'RR......']
        o.face_spr('right', horn_r, {'R': RD, 'Y': GD})
        o.face_spr('left', [r[::-1] for r in horn_r], {'R': YL, 'Y': GD})
        for side, c in (('front', RD), ('back', YL)):
            o.face_spr(side, ['', '', '', '', '', '', 'c......c', 'cccccccc'], {'c': c})
    tall_hat('primaaprilis_hat_blazen', lower, upper)

def primaaprilis_cape_glitch():
    n = 6; t = T(64, 32, n)
    cp = Cape(t)
    for f in range(n):
        t.f = f; r = rnd(100 + f)
        shift = {r.randrange(16): r.choice([-2, -1, 1, 2]) for _ in range(3)}
        def col(x, y):
            xx = x - shift.get(y, 0)
            c = C('#160a26') if (xx + y) % 2 else C('#1d0e33')
            if 2 <= xx <= 7 and 3 <= y <= 9:  # litera M
                if xx in (2, 7) or (y - 3 == xx - 2 and xx <= 4) or (y - 3 == 7 - xx and xx >= 5): c = C('#a855f7')
            if y == (f * 3) % 16: c = sh(c, 1.8)
            return c
        cp.fill(col, edge=C('#3ad8ff'))
        for y, s in shift.items():
            for x in range(10):
                if (x + y) % 3 == 0: cp.front(x, y, C('#ff3a8c') if s > 0 else C('#3ad8ff'))
    t.save('primaaprilis_cape_glitch')

# =====================================================================
# URODZINY MINECRAFTA
# =====================================================================
def grass_px(x, y, r):
    if y < 3 or (y == 3 and r.random() < 0.5):
        return [C('#5fb33a'), C('#4f9a2e'), C('#6cc443')][r.randrange(3)]
    return [C('#866043'), C('#6b4b32'), C('#9a7350'), C('#7a5539')][r.randrange(4)] if r.random() < 0.9 else C('#a0a0a0')

def urodzinymc_cape_trawa():
    t = T(64, 32); cp = Cape(t); r = rnd(11)
    grid = [[grass_px(x, y % 8, r) for x in range(10)] for y in range(16)]
    cp.fill(lambda x, y: grid[y][x], edge=C('#4f9a2e'))
    t.save('urodzinymc_cape_trawa')

def urodzinymc_aura_kostki_ghosts():
    G, G2, D, D2 = C('#5fb33a'), C('#7bd14f'), C('#866043'), C('#6b4b32')
    blk = ['..gGGg..', '.gGGGGg.', 'gGGGGGGg', 'dGGGGGGD', 'ddgGGgDD', 'dddgdDDD', 'ddddDDDD', '.dddDDD.']
    pal = {'g': G, 'G': G2, 'd': D, 'D': D2}
    aura('urodzinymc_aura_kostki_ghosts', [(blk, pal), (blk, pal), (blk, pal)])

# =====================================================================
# DZIEŃ DZIECKA
# =====================================================================
def dziendziecka_hat_smiglo():
    COLS = [C('#d1203a'), C('#ffcf3a'), C('#3d6fe0'), C('#2fbf5f')]
    def lower(i, o, f):  # czapeczka z kolorowych klinów i daszek z przodu
        for x in range(32):
            for y in range(4): i.side(x, y, COLS[(x // 4) % 4] if y < 3 else sh(COLS[(x // 4) % 4], 0.75))
        i.fill_top(lambda x, y: COLS[(0 if x < 4 else 1) + (0 if y < 4 else 2)])
        o.face_spr('front', ['', '', '', 'bbbbbbbb', '.bbbbbb.', '', '', ''], {'b': C('#2f4fb0')})
    def upper(i, o, f):  # trzonek przez całą kostkę i kręcące się śmigło na górze
        for x in range(32):
            if x % 8 == 3:
                for y in range(2, 8): i.side(x, y, C('#ffcf3a') if y % 2 else C('#e8b33a'))
        a = f * math.pi / 4
        for s_ in range(-4, 4):
            x, y = 3.5 + (s_ + 0.5) * math.cos(a), 3.5 + (s_ + 0.5) * math.sin(a)
            o.top(int(round(x)), int(round(y)), C('#d1203a') if s_ < 0 else C('#3d6fe0'))
        o.top(3, 3, C('#ffcf3a')); o.top(4, 4, C('#ffcf3a')); o.top(3, 4, C('#e8b33a')); o.top(4, 3, C('#e8b33a'))
    tall_hat('dziendziecka_hat_smiglo', lower, upper, frames=4)

def dziendziecka_aura_banki_souls():
    aura('dziendziecka_aura_banki_souls', [
        (['..abba..', '.b....c.', 'a.w....b', 'b......a', 'b......c', 'c......b', '.c....b.', '..bccb..'], {'a': C('#ff8fd8', 230), 'b': C('#9be7ff', 230), 'c': C('#c9a8ff', 230), 'w': W_}),
        (['........', '..abb...', '.bw..c..', '.a...b..', '.c...a..', '..bca...', '........', '........'], {'a': C('#ff8fd8', 230), 'b': C('#9be7ff', 230), 'c': C('#c9a8ff', 230), 'w': W_}),
        (['........', '........', '...ab...', '..w..b..', '..b..a..', '...ba...', '........', '........'], {'a': C('#ffd1f0', 200), 'b': C('#bfefff', 200), 'w': W_}),
    ])

# =====================================================================
# WAKACJE
# =====================================================================
def wakacje_mask_okulary():
    t = T(64, 32); i, o = hat_shell(t, 0)
    FR, LN, L2, SH_ = C('#111018'), C('#1f2a44'), C('#2f4f8a'), C('#9fd6ff')
    glasses = ['........', '........', '........', 'FFFFFFFF', 'FLLFFLLF', 'FlLF.lLF', '.FF..FF.', '........']
    o.face_spr('front', glasses, {'F': FR, 'L': LN, 'l': L2})
    o.face('front', 1, 4, SH_); o.face('front', 5, 4, SH_)
    for side in ('right', 'left'):
        for x in range(8): o.face(side, x, 3, FR)
    t.save('wakacje_mask_okulary')

def wakacje_hat_slomkowy():
    t = T(64, 32); i, o = hat_shell(t, 0)
    ST, S2, S3, RB = C('#e8c879'), C('#cfa955'), C('#f6dc98'), C('#d1203a')
    for y in range(3):
        for x in range(32):
            c = S3 if (x + y) % 2 == 0 else ST
            if (x + 2 * y) % 6 == 0: c = S2
            if y == 2: c = RB if x % 8 else sh(RB, 0.8)
            i.side(x, y, c)
    i.fill_top(lambda x, y: S3 if (x + y) % 2 else ST)
    for x in range(32): o.side(x, 3, ST if x % 2 else S3)
    o.face_spr('left', ['', '', '...y....', '..y.y...', ''], {'y': C('#ffcf3a')})
    t.save('wakacje_hat_slomkowy')

def wakacje_cape_palmy():
    t = T(64, 32); cp = Cape(t)
    def col(x, y):
        if y < 8: c = mix(C('#ff7a3a'), C('#ffcf6a'), y / 7)
        elif y < 12: c = mix(C('#2f8fc9'), C('#1f6aa0'), (y - 8) / 4)
        else: c = C('#f3d89a') if (x + y) % 3 else C('#e6c47e')
        d = math.hypot(x - 6, y - 7.5)
        if y < 8 and d < 3: c = C('#fff1b8') if d < 2 else C('#ffe07a')
        if y in (9, 11) and (x + y) % 4 == 0: c = C('#9fd6ff')
        return c
    cp.fill(col, edge=C('#1f6aa0'))
    palm = ['.ggg...', 'gg.gg..', 'g.b..g.', '..b....', '..b....', '..b....', '..b....', '.bb....', '.b.....', '.b.....', 'bbb....']
    for j, r in enumerate(palm):
        for i, ch in enumerate(r):
            if ch != '.': cp.front(i, 3 + j, C('#2f6a2a') if ch == 'g' else C('#5a3b1e'))
    t.save('wakacje_cape_palmy')

def wakacje_aura_babelki_souls():
    aura('wakacje_aura_babelki_souls', [
        (['..bbbb..', '.b....b.', 'b.w....b', 'b.w....b', 'b......b', 'b......b', '.b....b.', '..bbbb..'], {'b': C('#5fd0ff', 230), 'w': W_}),
        (['........', '..bbb...', '.bw..b..', '.b...b..', '.b...b..', '..bbb...', '........', '........'], {'b': C('#7fdcff', 220), 'w': W_}),
        (['........', '........', '...bb...', '..bw.b..', '..b..b..', '...bb...', '........', '........'], {'b': C('#a8e8ff', 200), 'w': W_}),
    ])

def parrot_wing(W):
    def inside(x, y):
        return (y >= 1 and y <= 36 and x <= 31 and y >= x * 0.2 and y <= 10 + (31 - x) * 0.9) or ell(x, y, 8, 30, 8, 8)
    def col(x, y):
        t_ = x / 31
        if t_ < 0.33: c = C('#e8263a')
        elif t_ < 0.66: c = C('#ffcf3a')
        else: c = C('#2f8fe0')
        if y > 24 and x < 16: c = C('#2fbf5f')
        if (int(y - x * 0.2) // 4) % 2: c = sh(c, 0.86)
        return c
    shape_fill(W, inside, col)
    for y in range(40):
        for x in range(32):
            if inside(x, y) and not inside(x, y + 1) and x % 3 == 1: W.p(x, y, C('#1a1a2a'))
    outline(W, C('#1a1a2a'))

def wakacje_wings_papuga():
    t = T(128, 64); wings(t, parrot_wing, back=0.85); t.save('wakacje_wings_papuga')

# =====================================================================
# URODZINY MIB
# =====================================================================
def urodzinymib_cape_rok():
    n = 8; t = T(64, 32, n); cp = Cape(t); r = rnd(21)
    conf = [(r.randrange(10), r.randrange(16), r.choice([C('#ffcf3a'), C('#ff4fa8'), C('#3ad8ff'), C('#ffffff')])) for _ in range(10)]
    for f in range(n):
        t.f = f
        glow = 0.5 + 0.5 * math.sin(f * 2 * math.pi / n)
        def col(x, y):
            c = mix(C('#3b1272'), C('#140726'), y / 15)
            d = math.hypot(x - 4.5, y - 6)
            if d < 5: c = mix(c, C('#a855f7'), (1 - d / 5) * (0.35 + 0.35 * glow))
            return c
        cp.fill(col, edge=C('#a855f7'))
        m = ['M......M', 'MM....MM', 'M.M..M.M', 'M..MM..M', 'M......M', 'M......M']
        for j, row in enumerate(m):
            for i, ch in enumerate(row):
                if ch == 'M': cp.front(1 + i, 2 + j, mix(C('#d6b0ff'), C('#ffffff'), glow))
        one = ['.1.', '11.', '.1.', '.1.', '111']
        for j, row in enumerate(one):
            for i, ch in enumerate(row):
                if ch == '1': cp.front(4 + i, 10 + j, C('#ffcf3a'))
        for (x, y, c) in conf:
            cp.front(x, (y + f) % 16, c) if (x < 3 or x > 6) else None
    t.save('urodzinymib_cape_rok')

def urodzinymib_aura_konfetti_snow():
    aura('urodzinymib_aura_konfetti_snow', [
        (['........', '..aa....', '..aaa...', '...aa...', '........', '........', '........', '........'], {'a': C('#ffcf3a')}),
        (['........', '...b....', '..bb....', '..b.....', '..bb....', '........', '........', '........'], {'b': C('#ff4fa8')}),
        (['........', '........', '..cc....', '...cc...', '........', '........', '........', '........'], {'c': C('#3ad8ff')}),
    ])

def urodzinymib_hat_tort():
    PK, P2, CR, SP, S2, CH = C('#ff8fc8'), C('#f06aa8'), C('#fff4e6'), C('#d9a066'), C('#c08a52'), C('#d1203a')
    def lower(i, o, f):  # tort na czubku głowy: polewa, krem, biszkopt, talerzyk
        for x in range(32):
            for y in range(4):
                if y == 0: c = PK
                elif y == 1: c = CR if (x % 3) else P2
                elif y == 2: c = SP if (x + y) % 3 else S2
                else: c = C('#f2f2f8')
                i.side(x, y, c)
            if x % 4 == 1: o.side(x, 0, CH)
            if x % 3 == 0: o.side(x, 1, P2)
        i.fill_top(lambda x, y: PK if (x + y) % 5 else C('#ffffff'))
    def upper(i, o, f):  # świeczka z płomieniem (migocze)
        for x in range(32):
            if x % 8 in (3, 4):
                for y in range(4, 8): i.side(x, y, C('#a368ff') if (y + x) % 2 else C('#ffffff'))
        flame = [['...yy...', '..yYYy..', '..yWWy..', '...oo...'], ['..yy....', '..yYYy..', '...yWWy.', '...oo...'],
                 ['....yy..', '..yYYy..', '.yWWy...', '...oo...'], ['...yy...', '...YY...', '..yWWy..', '...oo...']][f]
        for side in ('front', 'back', 'left', 'right'):
            o.face_spr(side, flame, {'y': C('#ffb43a'), 'Y': C('#ffe07a'), 'W': C('#ffffff'), 'o': C('#ff6a1a')})
    tall_hat('urodzinymib_hat_tort', lower, upper, frames=4)

def _koniec():
    pass

ALL = [n for n in list(globals()) if n.split('_')[0] in ('niepodleglosc', 'zima', 'adwent', 'sylwester', 'walentynki', 'wielkanoc', 'primaaprilis', 'urodzinymc', 'dziendziecka', 'wakacje', 'urodzinymib') and callable(globals()[n])]
if __name__ == '__main__':
    for n in ALL: globals()[n]()
    print(len(ALL), 'tekstur')
