package pl.mibclient.mod.core.modules;

import java.util.Arrays;

/**
 * Emotki postaci: lista (do ustawień i koła wyboru pod B) i ułożenie ciała w chwili t (sekundy od startu).
 * Poza to 18 kątów w radianach: głowa, tułów, prawa ręka, lewa ręka, prawa noga, lewa noga — po {X, Y, Z}.
 * NaN = zostaje ruch z gry (np. nogi przy chodzeniu). Kąty jak w modelu Minecrafta: X ujemny = do przodu
 * (ręka -π/2 przed siebie, -π w górę), Z dodatni przesuwa dół ręki i nogi w prawo postaci (prawa ręka od ciała,
 * lewa do ciała), głowa X dodatni = w dół, Y dodatni = obrót w prawo.
 */
public final class Emotes {
	private Emotes() {
	}

	public static final String[] IDS = {"wave", "dance", "clap", "point", "cheer", "dab", "take_l", "floss", "facepalm", "zombie"};
	public static final String[] PL = {"Machanie", "Taniec", "Klaskanie", "Wskazywanie", "Radość", "Dab", "Take the L", "Floss", "Facepalm", "Zombie"};
	public static final String[] EN = {"Wave", "Dance", "Clap", "Point", "Cheer", "Dab", "Take the L", "Floss", "Facepalm", "Zombie"};

	public static final int HEAD = 0, BODY = 3, RIGHT_ARM = 6, LEFT_ARM = 9, RIGHT_LEG = 12, LEFT_LEG = 15;
	private static final float N = Float.NaN;

	public static String label(String id, boolean pl) {
		int i = Arrays.asList(IDS).indexOf(id);
		return i < 0 ? id : (pl ? PL : EN)[i];
	}

	private static float[] keep() {
		float[] p = new float[18];
		Arrays.fill(p, N);
		return p;
	}

	private static void set(float[] p, int part, double x, double y, double z) {
		p[part] = (float) x;
		p[part + 1] = (float) y;
		p[part + 2] = (float) z;
	}

	/** Ręce {prawa X, prawa Z, lewa X, lewa Z}, reszta ciała jak w grze. */
	private static float[] arms(double rx, double rz, double lx, double lz) {
		float[] p = keep();
		set(p, RIGHT_ARM, rx, 0, rz);
		set(p, LEFT_ARM, lx, 0, lz);
		return p;
	}

	/** Ułożenie ciała dla emotki id w chwili t albo null, gdy nie ma takiej emotki. */
	public static float[] pose(String id, double t) {
		double s = Math.sin(t * Math.PI * 4);
		// wejście w pozę w ułamku sekundy (tam, gdzie poza się nie powtarza)
		double in = Math.min(1, t / 0.2);
		if ("wave".equals(id)) return arms(-2.8, 0.3 + 0.35 * s, 0, 0);
		if ("dance".equals(id)) {
			double a = Math.sin(t * Math.PI * 3);
			return arms(-1.2 + 0.9 * a, 0.5, -1.2 - 0.9 * a, -0.5);
		}
		if ("clap".equals(id)) {
			double z = 0.35 + 0.25 * Math.abs(s);
			return arms(-1.4, -z, -1.4, z);
		}
		if ("point".equals(id)) return arms(-Math.PI / 2, 0, 0, 0);
		if ("cheer".equals(id)) return arms(-2.9 + 0.2 * s, 0.4, -2.9 + 0.2 * s, -0.4);
		if ("dab".equals(id)) {
			// prawa ręka wyciągnięta w górę w bok, lewa przez twarz w tę samą stronę, głowa schowana w łokieć
			float[] p = keep();
			set(p, RIGHT_ARM, 0, 0, 2.3 * in);
			set(p, LEFT_ARM, -0.6 * in, 0, 2.2 * in);
			set(p, HEAD, 0.55 * in, -0.25 * in, 0.15 * in);
			return p;
		}
		if ("take_l".equals(id)) {
			// „L” na czole prawą ręką, kopnięcia nogami na zmianę w bok, głowa kiwa się w rytm
			double b = Math.sin(t * Math.PI * 2 * 1.6), r = Math.max(0, b), l = Math.max(0, -b);
			float[] p = keep();
			set(p, RIGHT_ARM, -0.4 * in, 0, -2.58 * in);
			set(p, LEFT_ARM, 0.2 * Math.sin(t * Math.PI * 3.2), 0, -0.25);
			set(p, RIGHT_LEG, -0.3 * r, 0, 0.7 * r);
			set(p, LEFT_LEG, -0.3 * l, 0, -0.7 * l);
			set(p, HEAD, -0.1, 0.25 * Math.sin(t * Math.PI * 1.6), 0);
			return p;
		}
		if ("floss".equals(id)) {
			// proste ręce razem z boku na bok (ta przy ciele przechodzi z przodu), biodra w drugą stronę
			double a = Math.sin(t * Math.PI * 2 * 1.4);
			float[] p = keep();
			set(p, RIGHT_ARM, 0.55 * a, 0, 0.6 * a);
			set(p, LEFT_ARM, -0.55 * a, 0, 0.6 * a);
			set(p, BODY, 0, 0, -0.12 * a);
			set(p, RIGHT_LEG, 0, 0, 0.15 * a);
			set(p, LEFT_LEG, 0, 0, 0.15 * a);
			set(p, HEAD, 0, 0, 0.08 * a);
			return p;
		}
		if ("facepalm".equals(id)) {
			// dłoń na twarzy, głowa w dół i powolne kręcenie głową
			float[] p = keep();
			set(p, RIGHT_ARM, -0.48 * in, 0, -2.44 * in);
			set(p, LEFT_ARM, 0, 0, 0);
			set(p, HEAD, 0.45 * in, 0.18 * Math.sin(t * Math.PI * 1.6), 0);
			return p;
		}
		if ("zombie".equals(id)) {
			// ręce przed siebie jak zombie z Minecrafta, głowa przechylona
			double w = 0.08 * Math.sin(t * Math.PI * 2);
			float[] p = arms(-1.45 + w, -0.05, -1.45 - w, 0.05);
			set(p, HEAD, 0.1, 0, 0.2);
			return p;
		}
		return null;
	}
}
