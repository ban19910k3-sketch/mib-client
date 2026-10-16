package pl.mibclient.mod.core.modules;

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
}
