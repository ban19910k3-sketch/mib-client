package pl.mibclient.mod.core.modules;

import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import pl.mibclient.mod.core.Theme;

/** Teksty modułów HUD. */
public final class Formats {
	private Formats() {
	}

	private static final String[] FACING = {"S", "SW", "W", "NW", "N", "NE", "E", "SE"};
	private static final Pattern PORT = Pattern.compile("^([^:\\[\\]]+|\\[[^\\]]*\\]):(\\d{1,5})$");

	/** Yaw Minecrafta: 0 = południe, 90 = zachód, 180 = północ, 270 = wschód. */
	public static String facing(float yaw) {
		double n = ((yaw % 360) + 360) % 360;
		return FACING[(int) Math.round(n / 45.0) % 8];
	}

	/** Trzy linie: X, pod nim Y, pod nim Z. Bez miejsc po przecinku pozycja bloku (jak F3), inaczej dokładna. */
	public static String[] coordLines(double x, double y, double z, int decimals) {
		return new String[] {"X: " + num(x, decimals), "Y: " + num(y, decimals), "Z: " + num(z, decimals)};
	}

	private static String num(double v, int decimals) {
		return decimals <= 0 ? String.valueOf((long) Math.floor(v)) : String.format(Locale.ROOT, "%." + decimals + "f", v);
	}

	/** Bez miejsc po przecinku pokazuje pozycję bloku (jak F3), inaczej dokładną. */
	public static String coords(double x, double y, double z, int decimals) {
		if (decimals <= 0) return "X " + (long) Math.floor(x) + "  Y " + (long) Math.floor(y) + "  Z " + (long) Math.floor(z);
		String f = "%." + decimals + "f";
		return "X " + String.format(Locale.ROOT, f, x) + "  Y " + String.format(Locale.ROOT, f, y) + "  Z " + String.format(Locale.ROOT, f, z);
	}

	public static String clock(int h, int m, int s, boolean h24, boolean seconds) {
		String tail = String.format(Locale.ROOT, ":%02d", m) + (seconds ? String.format(Locale.ROOT, ":%02d", s) : "");
		if (h24) return String.format(Locale.ROOT, "%02d", h) + tail;
		int h12 = h % 12 == 0 ? 12 : h % 12;
		return h12 + tail + (h < 12 ? " AM" : " PM");
	}

	public static String duration(long ms) {
		long t = Math.max(0, ms / 1000), h = t / 3600, m = (t / 60) % 60, s = t % 60;
		return h > 0 ? String.format(Locale.ROOT, "%d:%02d:%02d", h, m, s) : String.format(Locale.ROOT, "%d:%02d", m, s);
	}

	public static String potion(int ticks, boolean infinite) {
		if (infinite) return "∞";
		int s = Math.max(0, ticks / 20);
		return String.format(Locale.ROOT, "%d:%02d", s / 60, s % 60);
	}

	public static int pingColor(int ms) {
		if (ms < 0) return Theme.MUTED;
		if (ms < 80) return Theme.GOOD;
		if (ms < 150) return Theme.WARN;
		return Theme.RED;
	}

	public static String durability(int max, int damage, boolean percent) {
		if (max <= 0) return "";
		int left = Math.max(0, max - damage);
		return percent ? Math.round(left * 100f / max) + "%" : String.valueOf(left);
	}

	/** Adres serwera do HUD. Domyślny port 25565 nigdy nie jest pokazywany. */
	public static String address(String raw, boolean port) {
		if (raw == null) return "";
		String a = raw.trim();
		Matcher m = PORT.matcher(a);
		if (!m.matches()) return a;
		return port && !"25565".equals(m.group(2)) ? a : m.group(1);
	}

	/** Liczba z miejscami po przecinku (kropka, jak w grze). */
	public static String decimal(double v, int places) {
		return String.format(Locale.ROOT, "%." + Math.max(0, places) + "f", v);
	}

	/** Zdrowie w połówkach serc: 18.5 zamiast 18.500002, całe bez przecinka. */
	public static String hp(float v) {
		float r = Math.round(v * 2) / 2f;
		return r == Math.floor(r) ? String.valueOf((int) r) : decimal(r, 1);
	}

	public static int tpsColor(double tps) {
		if (tps < 0) return Theme.MUTED;
		if (tps >= 18) return Theme.GOOD;
		if (tps >= 15) return Theme.WARN;
		return Theme.RED;
	}

	/** Stoper: minuty:sekundy.dziesiąte (godziny, gdy dłużej). */
	public static String stopwatch(long ms) {
		long t = Math.max(0, ms), tenths = (t / 100) % 10, s = (t / 1000) % 60, m = (t / 60000) % 60, h = t / 3600000;
		return h > 0 ? String.format(Locale.ROOT, "%d:%02d:%02d.%d", h, m, s, tenths) : String.format(Locale.ROOT, "%02d:%02d.%d", m, s, tenths);
	}

	// ===== Armor bar =====

	/** Punkty pancerza części zbroi z gry (hełm, napierśnik, spodnie, buty) dla materiałów z gry. */
	private static final String[] MATERIALS = {"leather", "chainmail", "iron", "golden", "diamond", "netherite", "copper", "turtle"};
	private static final int[][] POINTS = {{1, 3, 2, 1}, {2, 5, 4, 1}, {2, 6, 5, 2}, {2, 5, 3, 1}, {3, 8, 6, 3}, {3, 8, 6, 3}, {2, 4, 3, 1}, {2, 0, 0, 0}};
	private static final int[] COLORS = {0xFFB0703F, 0xFFAAAAAA, 0xFFE8E8E8, 0xFFFFE15C, 0xFF5DEAF2, 0xFF6B5D66, 0xFFE58A55, 0xFF55C15A};
	private static final String[] SLOTS = {"_helmet", "_chestplate", "_leggings", "_boots"};

	/** Kolor materiału zbroi z id przedmiotu (np. "minecraft:diamond_chestplate") albo szary. */
	public static int armorColor(String id) {
		int m = material(id);
		return m < 0 ? 0xFFB0B0B0 : COLORS[m];
	}

	private static int material(String id) {
		if (id == null) return -1;
		String path = id.substring(id.indexOf(':') + 1);
		for (int i = 0; i < MATERIALS.length; i++) if (path.startsWith(MATERIALS[i] + "_")) return i;
		return -1;
	}

	/**
	 * Kolory 20 punktów paska zbroi (po 2 na ikonę) według założonych części, w kolejności hełm, napierśnik, spodnie, buty.
	 * Punkty ponad tabelę (np. z zaklęć innych modów) mają kolor ostatniej części; 0 = punkt pusty.
	 */
	public static int[] armorPoints(List<String> ids, int armor) {
		int[] out = new int[20];
		int n = 0, last = 0xFFB0B0B0;
		for (String id : ids) {
			int m = material(id), slot = -1;
			String path = id == null ? "" : id.substring(id.indexOf(':') + 1);
			for (int i = 0; i < SLOTS.length; i++) if (path.endsWith(SLOTS[i])) slot = i;
			if (m < 0 || slot < 0) continue;
			last = COLORS[m];
			for (int k = 0; k < POINTS[m][slot] && n < 20; k++) out[n++] = COLORS[m];
		}
		int total = Math.max(0, Math.min(20, armor));
		for (int i = 0; i < 20; i++) out[i] = i < total ? (out[i] != 0 ? out[i] : last) : 0;
		return out;
	}
}
