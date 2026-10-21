package pl.mibclient.mod.core;

/**
 * Aury MiB (od 0.22.0): cząsteczki wokół postaci. Ruch wynika z końcówki id kosmetyku, obrazki 8×8 są w pierwszym
 * rzędzie tekstury 64×32. Cząsteczki to funkcja czasu (bez stanu), tak samo jak auraParticles w launcherze
 * (lib/profile.js) — te same liczby dla tego samego czasu i numeru gracza.
 */
public final class Auras {
	public static final int NONE = 0, SOULS = 1, PUMPKINS = 2, GHOSTS = 3, MAGIC = 4;
	private static final String[] NAMES = {"souls", "pumpkins", "ghosts", "magic"};
	/** Liczby na cząsteczkę w tablicy wyniku: x, y, z (piksele postaci, blok = 16; y od stóp), komórka, rozmiar piksela, krycie. */
	public static final int STRIDE = 6, MAX = 64;
	private static final double TAU = Math.PI * 2;

	private Auras() {
	}

	/** Ruch aury z końcówki id (np. halloween_aura_magic) albo NONE. */
	public static int style(String id) {
		if (id == null) return NONE;
		for (int i = 0; i < NAMES.length; i++) if (id.endsWith("_" + NAMES[i])) return i + 1;
		return NONE;
	}

	static long h32(int x) {
		x = (x ^ (x >>> 16)) * 0x45d9f3b;
		x = (x ^ (x >>> 16)) * 0x45d9f3b;
		return (x ^ (x >>> 16)) & 0xffffffffL;
	}

	private static double rnd(int seed, int i, int k, int j) {
		return h32(seed ^ ((i + 1) * 0x9e3779b1) ^ (k * 0x85ebca77) ^ ((j + 1) * 0xc2b2ae3d)) / 4294967296.0;
	}

	/** Czas aury w sekundach (powtarza się co godzinę, jak w launcherze). */
	public static double time(long millis) {
		return (millis % 3600000L) / 1000.0;
	}

	/** Cząsteczki w chwili t (sekundy) dla gracza seed, w out (co najmniej MAX * STRIDE); zwraca ich liczbę. */
	public static int particles(int style, double t, int seed, float[] out) {
		int n = 0;
		if (style == GHOSTS) {
			for (int i = 0; i < 3; i++) {
				double a = -t * 0.9 + i * TAU / 3;
				n = put(out, n, Math.cos(a) * 16, 17 + Math.sin(t * 2.2 + i * 2) * 4, Math.sin(a) * 16, 0, 0.9, 0.9);
			}
		} else if (style == SOULS) {
			for (int i = 0; i < 22; i++) {
				double life = life(seed, i, 1.1, 1.8), tt = t + rnd(seed, i, 0, 1) * life;
				int k = (int) Math.floor(tt / life);
				double age = tt - k * life, a = rnd(seed, i, k, 2) * TAU, r = 7 + 5 * rnd(seed, i, k, 3);
				n = put(out, n, Math.cos(a) * r, 2 * rnd(seed, i, k, 4) + (6 + 4 * rnd(seed, i, k, 5)) * age, Math.sin(a) * r,
						age < life * 0.4 ? 0 : age < life * 0.75 ? 1 : 2, 0.7, Math.min(1, (life - age) * 4));
			}
		} else if (style == PUMPKINS) {
			for (int i = 0; i < 8; i++) {
				double life = 2.4, tt = t + rnd(seed, i, 0, 1) * life;
				int k = (int) Math.floor(tt / life);
				double age = tt - k * life, a = rnd(seed, i, k, 2) * TAU + age * 1.8, r = 9 + 2 * rnd(seed, i, k, 3);
				n = put(out, n, Math.cos(a) * r, 2 + 2 * rnd(seed, i, k, 4) + 9 * age, Math.sin(a) * r, 0, 0.9, Math.min(1, (life - age) * 3));
			}
			for (int i = 100; i < 116; i++) {
				double life = life(seed, i, 0.6, 1.2), tt = t + rnd(seed, i, 0, 1) * life;
				int k = (int) Math.floor(tt / life);
				double age = tt - k * life, a = rnd(seed, i, k, 2) * TAU, r = 4 + 9 * rnd(seed, i, k, 3);
				n = put(out, n, Math.cos(a) * r, 6 * rnd(seed, i, k, 4) + (8 + 6 * rnd(seed, i, k, 5)) * age, Math.sin(a) * r,
						age % 0.2 < 0.1 ? 1 : 2, 0.8, Math.min(1, (life - age) * 3));
			}
		} else if (style == MAGIC) {
			for (int i = 0; i < 60; i++) {
				double life = life(seed, i, 1.4, 2), tt = t + rnd(seed, i, 0, 1) * life;
				int k = (int) Math.floor(tt / life);
				double age = tt - k * life, a = (t - age) * 5 + (rnd(seed, i, k, 2) - 0.5) * 0.6 + age * 2.2, r = 10 - age * 3;
				n = put(out, n, Math.cos(a) * r, 1 + (14 + 4 * rnd(seed, i, k, 3)) * age, Math.sin(a) * r, age % 0.3 < 0.15 ? 0 : 1, 0.7, Math.min(1, (life - age) * 2));
			}
		}
		return n;
	}

	private static double life(int seed, int i, double l0, double l1) {
		return l0 + (l1 - l0) * rnd(seed, i, 0, 0);
	}

	private static int put(float[] out, int n, double x, double y, double z, int cell, double size, double alpha) {
		int o = n * STRIDE;
		out[o] = (float) x;
		out[o + 1] = (float) y;
		out[o + 2] = (float) z;
		out[o + 3] = cell;
		out[o + 4] = (float) size;
		out[o + 5] = (float) alpha;
		return n + 1;
	}
}
