package pl.mibclient.mod.core;

/**
 * Pety MiB (od 0.34.0): gdzie jest pet przy graczu (tryb lata / ramię / chodzi, strona) i poza części modelu w danej chwili
 * (kręcenie, kołysanie, łapki przy chodzie, kucanie, sen). Bez pamięci — to samo liczą partPose i petAnchor w lib/profile.js
 * launchera (wspólne liczby w testach). Jednostki to piksele modelu gracza: y w dół od szyi, x+ = lewa strona gracza.
 */
public final class Pets {
	public static final int FLY = 0, SHOULDER = 1, WALK = 2;
	/** Pet zasypia, gdy gracz tyle stoi bez ruchu. */
	public static final long SLEEP_MS = 30000;

	private Pets() {
	}

	/** Tryb z nazwy (fly, shoulder, walk); nieznany = lata. */
	public static int mode(String s) {
		return "shoulder".equals(s) ? SHOULDER : "walk".equals(s) ? WALK : FLY;
	}

	public static String modeName(int mode) {
		return mode == SHOULDER ? "shoulder" : mode == WALK ? "walk" : "fly";
	}

	/** Strona: +1 lewa (domyślnie), −1 prawa. */
	public static int side(String s) {
		return "right".equals(s) ? -1 : 1;
	}

	/** Imię peta z pliku: do 16 znaków bez znaków sterujących, inaczej null (bez imienia). */
	public static String name(Object v) {
		if (!(v instanceof String)) return null;
		String s = ((String) v).trim();
		if (s.isEmpty() || s.length() > 16) return null;
		for (int i = 0; i < s.length(); i++) if (Character.isISOControl(s.charAt(i))) return null;
		return s;
	}

	public static boolean sleeping(long stillMs) {
		return stillMs >= SLEEP_MS;
	}

	/** Czy pet w tym trybie siedzi na tułowiu (pochyla się z nim przy kucaniu); inaczej przy całej postaci. */
	public static boolean onBody(int mode) {
		return mode == SHOULDER;
	}

	/** Kotwica peta (pod łapkami) do pos[0..2]; zwraca skalę peta. */
	public static float anchor(int mode, int side, float t, boolean sleep, float[] pos) {
		if (mode == SHOULDER) {
			pos[0] = side * 6;
			pos[1] = 0;
			pos[2] = 0;
			return 0.6f;
		}
		if (mode == WALK) {
			pos[0] = side * 14;
			pos[1] = 24;
			pos[2] = 3;
			return 1f;
		}
		pos[0] = side * 11;
		pos[1] = (float) (-3 + (sleep ? 1 : 1.2 * Math.sin(2 * Math.PI * 0.5 * t)));
		pos[2] = 1;
		return 0.8f;
	}

	/**
	 * Poza części w chwili t (sekundy): obrót w stopniach do rot[0..2], zwraca przesunięcie w dół (kucanie) albo NaN, gdy części
	 * teraz nie widać (oczy na jawie/we śnie). walk = siła kroku 0..1, phase = krok w radianach.
	 */
	public static float pose(CosmeticModel.Part p, float t, boolean run, boolean sleep, boolean crouch, float walk, float phase, float[] rot) {
		double x = p.rot[0], y = p.rot[1], z = p.rot[2];
		float dy = 0;
		if (p.spin != 0) y += (p.spin * (double) t) % 360;
		if (p.wave != null) {
			double hz = p.wave[3] * (run ? 1.8 : 1), k = (run ? 1.4 : 1) * (sleep ? 0.3 : 1);
			double sw = Math.sin(2 * Math.PI * (hz * t + p.wave[4])) * k;
			x += p.wave[0] * sw;
			y += p.wave[1] * sw;
			z += p.wave[2] * sw;
		}
		if (p.step != 0) x += p.step * Math.sin(phase) * walk;
		if (crouch && p.sit != null) {
			x += p.sit[0];
			y += p.sit[1];
			z += p.sit[2];
			dy = p.sit[3];
		}
		rot[0] = (float) x;
		rot[1] = (float) y;
		rot[2] = (float) z;
		boolean visible = p.state == CosmeticModel.ALWAYS || (p.state == CosmeticModel.SLEEP) == sleep;
		return visible ? dy : Float.NaN;
	}
}
