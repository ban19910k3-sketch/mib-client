package pl.mibclient.mod.core;

import java.util.ArrayList;
import java.util.List;

/**
 * Dekoracje w motywie Halloween (Theme.HALLOWEEN): pajęczyny w górnych rogach ekranu, pająk na nitce, dynie i nagrobek
 * w lewym dolnym rogu, a na ekranie tytułowym też nietoperze i pomarańczowa poświata przy dole. Wszystko na brzegach
 * ekranu, żeby nie zasłaniać przycisków. Rysowane pikselami przez Canvas, jak reszta menu.
 */
public final class Halloween {
	private static final int WEB = 0x8CD6D3D1, WEB_FAINT = 0x50D6D3D1, SPIDER = 0xFF0A0507, SPIDER_EYE = 0xFFF97316;
	private static final String[] PUMPKIN = {"...g...", ".ooOoo.", "oOyOyOo", "oOOOOOo", "oyOyOyo", ".ooOoo."};
	private static final String[] SPIDER_SPRITE = {"k.k.k.k", ".kkkkk.", "kkekekk", ".kkkkk.", "k.k.k.k"};
	private static final String[] GRAVE = {"..SSSSSS..", ".SssssssD.", "SsssssssDD", "SsssXsssDD", "SssXXXssDD", "SsssXsssDD", "SsssXsssDD", "SsssssssDD",
			"SsssssssDD", "SsssssssDD", "vVvVvvvVvv"};
	private static final String[][] BAT = {{"b.....b", ".bb.bb.", "..bbb..", "...b..."}, {"..bbb..", ".bbbbb.", "b..b..b"}};

	private Halloween() {
	}

	/** Dekoracje menu na ekranie w×h (po przyciemnieniu gry, przed panelem); timeMs porusza pająkiem. */
	public static void menu(Canvas c, int w, int h, long timeMs) {
		int s = size(w, h);
		corners(c, w, s, timeMs);
		// dynie w lewym dolnym rogu (za panelem, gdy ekran jest mały)
		int k = Math.max(2, s / 16);
		pumpkin(c, 6, h - 6 * k - 4, k);
		pumpkin(c, 6 + 8 * k, h - 4 * k - 4, k * 2 / 3);
	}

	/**
	 * Ekran tytułowy (title = true) i menu pauzy: rysowane na wierzchu, więc tylko przy brzegach. Na ekranie tytułowym
	 * także nietoperze w górnej części i pomarańczowa poświata przy dole.
	 */
	public static void screen(Canvas c, int w, int h, long timeMs, boolean title) {
		int s = size(w, h), k = Math.max(2, s / 16);
		if (title) {
			int band = h / 9;
			for (int i = 0; i < band; i += 2) c.fill(0, h - band + i, w, h - band + i + 2, ((i * 0x50 / band) << 24) | 0xC2410C);
			for (int i = 0; i < 4; i++) {
				double t = timeMs / 1000.0, v = 16 + 5 * i;
				int span = w + 40, bx = (int) ((t * v + i * 131) % span) - 20;
				if (i % 2 == 1) bx = w - bx;
				int by = (int) (h * (0.08 + 0.07 * i) + Math.sin(t * 2 + i) * 5);
				sprite(c, BAT[(int) (timeMs / 140 + i) % 2], bx, by, k / 2 + 1);
			}
		}
		corners(c, w, s, timeMs);
		pumpkin(c, 6, h - 6 * k - 4, k);
		sprite(c, GRAVE, 6 + 8 * k, h - 11 * k - 4, k);
		pumpkin(c, 6 + 19 * k, h - 4 * k - 4, Math.max(1, k * 2 / 3));
	}

	/**
	 * Zmrok na panoramie (za przyciskami): od fioletowej nocy u góry do pomarańczowej poświaty przy ziemi i blady
	 * księżyc z prawej strony.
	 */
	public static void dusk(Canvas c, int w, int h) {
		int bands = 24;
		for (int i = 0; i < bands; i++) {
			double t = (i + 0.5) / bands;
			int top = 0x9C12061E, mid = 0x7A1A0810, low = 0x8A4A1608;
			int col = t < 0.6 ? mix(top, mid, t / 0.6) : mix(mid, low, (t - 0.6) / 0.4);
			c.fill(0, h * i / bands, w, h * (i + 1) / bands, col);
		}
		int r = Math.max(8, Math.min(w, h) / 14), mx = w * 4 / 5, my = h / 5;
		disc(c, mx, my, r + 4, 0x18FFE4B5);
		disc(c, mx, my, r, 0xE6FFF1D6);
		disc(c, mx - r / 3, my + r / 4, r / 3, 0x30A08C70);
	}

	/** Koło z poziomych pasków (jeden pasek na wiersz pikseli). */
	private static void disc(Canvas c, int cx, int cy, int r, int argb) {
		for (int y = -r; y <= r; y++) {
			int half = (int) Math.round(Math.sqrt(r * r - y * y));
			c.fill(cx - half, cy + y, cx + half + 1, cy + y + 1, argb);
		}
	}

	private static int mix(int a, int b, double t) {
		int out = 0;
		for (int sh = 0; sh < 32; sh += 8) {
			int x = (a >>> sh) & 0xFF, y = (b >>> sh) & 0xFF;
			out |= ((int) Math.round(x + (y - x) * t) & 0xFF) << sh;
		}
		return out;
	}

	/** Ekran ładowania gry: pajęczyny w rogach i dynie (alpha: gra ściemnia ekran ładowania na końcu). */
	public static void loading(Canvas c, int w, int h, float alpha) {
		Canvas f = faded(c, alpha);
		int s = size(w, h), k = Math.max(2, s / 16);
		web(f, 0, 0, s, false);
		web(f, w, 0, s, true);
		pumpkin(f, 6, h - 6 * k - 4, k);
		pumpkin(f, w - 6 - 7 * k, h - 6 * k - 4, k);
	}

	private static int size(int w, int h) {
		return Math.max(28, Math.min(64, Math.min(w, h) / 6));
	}

	/** Pajęczyny w obu górnych rogach i pająk, który zjeżdża na nitce z prawej i powoli się kołysze. */
	private static void corners(Canvas c, int w, int s, long timeMs) {
		web(c, 0, 0, s, false);
		web(c, w, 0, s, true);
		int sx = w - s * 2 / 5, len = s + (int) Math.round(Math.sin(timeMs / 900.0) * s / 5.0);
		c.fill(sx, s / 3, sx + 1, len, WEB);
		sprite(c, SPIDER_SPRITE, sx - 3, len, 1);
	}

	/** Canvas, który rysuje z przezroczystością alpha (0–1). */
	static Canvas faded(final Canvas c, final float alpha) {
		if (alpha >= 1f) return c;
		final float a = Math.max(0f, alpha);
		return new Canvas() {
			@Override
			public void fill(int x1, int y1, int x2, int y2, int argb) {
				c.fill(x1, y1, x2, y2, (Math.round((argb >>> 24) * a) << 24) | (argb & 0xFFFFFF));
			}

			@Override
			public void text(String t, int x, int y, int argb, boolean shadow) {
				c.text(t, x, y, (Math.round((argb >>> 24) * a) << 24) | (argb & 0xFFFFFF), shadow);
			}

			@Override
			public int textWidth(String t) {
				return c.textWidth(t);
			}

			@Override
			public int lineHeight() {
				return c.lineHeight();
			}

			@Override
			public void push(float scale, int ox, int oy) {
				c.push(scale, ox, oy);
			}

			@Override
			public void pop() {
				c.pop();
			}

			@Override
			public void scissor(int x1, int y1, int x2, int y2) {
				c.scissor(x1, y1, x2, y2);
			}

			@Override
			public void unscissor() {
				c.unscissor();
			}

			@Override
			public void item(Object stack, int x, int y) {
				c.item(stack, x, y);
			}

			@Override
			public void effectIcon(Object handle, int x, int y) {
				c.effectIcon(handle, x, y);
			}
		};
	}

	/** Dynia (7×6 pikseli razy scale) z lewym górnym rogiem w (x, y). */
	public static void pumpkin(Canvas c, int x, int y, int scale) {
		sprite(c, PUMPKIN, x, y, scale);
	}

	private static void sprite(Canvas c, String[] rows, int x, int y, int k) {
		for (int j = 0; j < rows.length; j++) {
			for (int i = 0; i < rows[j].length(); i++) {
				int col = color(rows[j].charAt(i));
				if (col != 0) c.fill(x + i * k, y + j * k, x + (i + 1) * k, y + (j + 1) * k, col);
			}
		}
	}

	private static int color(char ch) {
		switch (ch) {
			case 'g': return 0xFF65A30D;
			case 'o': return 0xFFC2410C;
			case 'O': return 0xFFEA580C;
			case 'y': return 0xFFFDE047;
			case 'k': return SPIDER;
			case 'e': return SPIDER_EYE;
			case 'b': return 0xFF1A0C10;
			case 'S': return 0xFFA8A29E;
			case 's': return 0xFF78716C;
			case 'D': return 0xFF44403C;
			case 'X': return 0xFF292524;
			case 'v': return 0xFF3F6212;
			case 'V': return 0xFF65A30D;
			default: return 0;
		}
	}

	/**
	 * Pajęczyna w rogu: pięć nici z rogu (x, y) i cztery łuki między nimi, uginające się do rogu; mirror = róg prawy
	 * (pajęczyna idzie w lewo).
	 */
	static void web(Canvas c, int x, int y, int size, boolean mirror) {
		for (int[] p : webPixels(size)) {
			int px = mirror ? x - 1 - p[0] : x + p[0];
			c.fill(px, y + p[1], px + 1, y + p[1] + 1, p[2] == 1 ? WEB : WEB_FAINT);
		}
	}

	private static int cachedSize = -1;
	private static List<int[]> cached;

	/** Piksele pajęczyny dla rogu (0, 0), każdy raz: {x, y, 1 = nić główna / 0 = łuk}. */
	static synchronized List<int[]> webPixels(int size) {
		if (size == cachedSize) return cached;
		java.util.Map<Integer, int[]> out = new java.util.LinkedHashMap<Integer, int[]>();
		int spokes = 5, rings = 4;
		double[][] tip = new double[spokes][];
		for (int k = 0; k < spokes; k++) {
			double a = Math.PI / 2 * k / (spokes - 1), len = size * (k == 0 || k == spokes - 1 ? 1.0 : 0.92);
			tip[k] = new double[] {Math.cos(a) * len, Math.sin(a) * len};
			line(out, 0, 0, tip[k][0], tip[k][1], 1);
		}
		for (int r = 1; r <= rings; r++) {
			double f = r / (rings + 0.6);
			for (int k = 0; k < spokes - 1; k++) {
				double ax = tip[k][0] * f, ay = tip[k][1] * f, bx = tip[k + 1][0] * f, by = tip[k + 1][1] * f;
				// środek łuku bliżej rogu: nić ugina się pod własnym ciężarem
				double mx = (ax + bx) / 2 * 0.86, my = (ay + by) / 2 * 0.86;
				line(out, ax, ay, mx, my, 0);
				line(out, mx, my, bx, by, 0);
			}
		}
		cached = new ArrayList<int[]>(out.values());
		cachedSize = size;
		return cached;
	}

	private static void line(java.util.Map<Integer, int[]> out, double x0, double y0, double x1, double y1, int kind) {
		int n = (int) Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)));
		for (int i = 0; i <= n; i++) {
			double t = n == 0 ? 0 : (double) i / n;
			int x = (int) Math.round(x0 + (x1 - x0) * t), y = (int) Math.round(y0 + (y1 - y0) * t);
			int[] old = out.get(x * 65536 + y);
			if (old == null || old[2] < kind) out.put(x * 65536 + y, new int[] {x, y, kind});
		}
	}
}
