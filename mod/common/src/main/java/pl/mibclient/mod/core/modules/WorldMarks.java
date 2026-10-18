package pl.mibclient.mod.core.modules;

/**
 * Kształty rysowane w świecie (z głębią, więc chowają się za blokami): znaczniki Light level overlay i promienie
 * Waypoints. Czworokąty po 4 wierzchołki (x, y, z) względem kamery i kolor ARGB każdego wierzchołka.
 */
public final class WorldMarks {
	/** Bok kwadratu światła i jego wysokość nad blokiem (żeby nie migał z wierzchem bloku). */
	public static final double LIGHT_SIZE = 0.5, LIGHT_LIFT = 0.02;
	/** Promień punktu: wysokość, połowa szerokości środka i poświaty. */
	public static final double BEAM_HEIGHT = 256, BEAM_CORE = 0.1, BEAM_GLOW = 0.25;

	private WorldMarks() {
	}

	/** Czworokąty do narysowania: xyz[i*12 .. i*12+11] i color[i*4 .. i*4+3] to i-ty czworokąt. */
	public static final class Quads {
		public float[] xyz = new float[48];
		public int[] color = new int[16];
		public int count;

		void add(double x0, double y0, double z0, double x1, double y1, double z1, double x2, double y2, double z2,
				double x3, double y3, double z3, int c0, int c1, int c2, int c3) {
			if ((count + 1) * 12 > xyz.length) {
				xyz = java.util.Arrays.copyOf(xyz, xyz.length * 2);
				color = java.util.Arrays.copyOf(color, color.length * 2);
			}
			int p = count * 12, q = count * 4;
			xyz[p] = (float) x0; xyz[p + 1] = (float) y0; xyz[p + 2] = (float) z0;
			xyz[p + 3] = (float) x1; xyz[p + 4] = (float) y1; xyz[p + 5] = (float) z1;
			xyz[p + 6] = (float) x2; xyz[p + 7] = (float) y2; xyz[p + 8] = (float) z2;
			xyz[p + 9] = (float) x3; xyz[p + 10] = (float) y3; xyz[p + 11] = (float) z3;
			color[q] = c0; color[q + 1] = c1; color[q + 2] = c2; color[q + 3] = c3;
			count++;
		}
	}

	/** Kolor z przezroczystością alpha (0–255). */
	public static int alpha(int argb, int alpha) {
		return (Math.max(0, Math.min(255, alpha)) << 24) | (argb & 0xFFFFFF);
	}

	/**
	 * Light level overlay: znaczniki {x, y, z, kolor} (blok powietrza nad podłożem) jako płaskie kwadraty na wierzchu
	 * podłoża, półprzezroczyste.
	 */
	public static void light(Quads out, int[] marks, double camX, double camY, double camZ) {
		double h = LIGHT_SIZE / 2;
		for (int i = 0; i + 3 < marks.length; i += 4) {
			double x = marks[i] + 0.5 - camX, y = marks[i + 1] + LIGHT_LIFT - camY, z = marks[i + 2] + 0.5 - camZ;
			int c = alpha(marks[i + 3], 0x90);
			out.add(x - h, y, z - h, x - h, y, z + h, x + h, y, z + h, x + h, y, z - h, c, c, c, c);
		}
	}

	/**
	 * Waypoints: pionowy promień nad punktem (blok x, y, z), jaśniejszy środek i słabsza poświata, zanikające ku górze.
	 */
	public static void beam(Quads out, int x, int y, int z, int argb, double camX, double camY, double camZ) {
		double cx = x + 0.5 - camX, cz = z + 0.5 - camZ, y0 = y - camY, y1 = y0 + BEAM_HEIGHT;
		column(out, cx, cz, y0, y1, BEAM_CORE, alpha(argb, 0xB0), alpha(argb, 0));
		column(out, cx, cz, y0, y1, BEAM_GLOW, alpha(argb, 0x40), alpha(argb, 0));
	}

	/** Cztery ściany słupa o połowie szerokości r (dół w kolorze bottom, góra top). */
	private static void column(Quads out, double cx, double cz, double y0, double y1, double r, int bottom, int top) {
		double[][] corners = {{cx - r, cz - r}, {cx + r, cz - r}, {cx + r, cz + r}, {cx - r, cz + r}};
		for (int i = 0; i < 4; i++) {
			double[] a = corners[i], b = corners[(i + 1) % 4];
			out.add(a[0], y0, a[1], b[0], y0, b[1], b[0], y1, b[1], a[0], y1, a[1], bottom, bottom, top, top);
		}
	}
}
