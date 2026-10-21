package pl.mibclient.mod.core;

import java.util.ArrayList;
import java.util.List;

/**
 * Dekoracje menu w motywie Halloween (Theme.HALLOWEEN): pajęczyny w górnych rogach ekranu, pająk na nitce i dynia
 * przy nazwie MiB Client. Rysowane pikselami przez Canvas, jak reszta menu.
 */
public final class Halloween {
	private static final int WEB = 0x8CD6D3D1, WEB_FAINT = 0x50D6D3D1, SPIDER = 0xFF0A0507, SPIDER_EYE = 0xFFF97316;
	private static final String[] PUMPKIN = {"...g...", ".ooOoo.", "oOyOyOo", "oOOOOOo", "oyOyOyo", ".ooOoo."};
	private static final String[] SPIDER_SPRITE = {"k.k.k.k", ".kkkkk.", "kkekekk", ".kkkkk.", "k.k.k.k"};

	private Halloween() {
	}

	/** Dekoracje menu na ekranie w×h (po przyciemnieniu gry, przed panelem); timeMs porusza pająkiem. */
	public static void menu(Canvas c, int w, int h, long timeMs) {
		int s = Math.max(28, Math.min(64, Math.min(w, h) / 6));
		web(c, 0, 0, s, false);
		web(c, w, 0, s, true);
		// pająk zjeżdża na nitce z prawej pajęczyny i powoli się kołysze
		int sx = w - s * 2 / 5, len = s + (int) Math.round(Math.sin(timeMs / 900.0) * s / 5.0);
		c.fill(sx, s / 3, sx + 1, len, WEB);
		sprite(c, SPIDER_SPRITE, sx - 3, len, 1);
		// dynie w lewym dolnym rogu (za panelem, gdy ekran jest mały)
		int k = Math.max(2, s / 16);
		pumpkin(c, 6, h - 6 * k - 4, k);
		pumpkin(c, 6 + 8 * k, h - 4 * k - 4, k * 2 / 3);
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
