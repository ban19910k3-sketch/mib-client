package pl.mibclient.mod.core;

import java.util.ArrayList;
import java.util.List;

/** Pikselowe prostokąty i ramki (bez pikseli w rogach, jak clip-path w launcherze), ikony i zawijanie tekstu. */
public final class Shapes {
	private Shapes() {
	}

	public static void pixelRect(Canvas c, int x, int y, int w, int h, int argb) {
		if (w <= 0 || h <= 0) return;
		if (w < 3 || h < 3) {
			c.fill(x, y, x + w, y + h, argb);
			return;
		}
		c.fill(x + 1, y, x + w - 1, y + h, argb);
		c.fill(x, y + 1, x + 1, y + h - 1, argb);
		c.fill(x + w - 1, y + 1, x + w, y + h - 1, argb);
	}

	/** Ramka grubości t. Tylko zewnętrzna linia ma ścięte rogi; prostokąty się nie nakładają. */
	public static void pixelFrame(Canvas c, int x, int y, int w, int h, int t, int argb) {
		for (int k = 0; k < t && w - 2 * k > 1 && h - 2 * k > 1; k++) {
			int x1 = x + k, y1 = y + k, x2 = x + w - k, y2 = y + h - k, cut = k == 0 ? 1 : 0;
			c.fill(x1 + cut, y1, x2 - cut, y1 + 1, argb);
			c.fill(x1 + cut, y2 - 1, x2 - cut, y2, argb);
			c.fill(x1, y1 + 1, x1 + 1, y2 - 1, argb);
			c.fill(x2 - 1, y1 + 1, x2, y2 - 1, argb);
		}
	}

	/** Panel z tłem i ramką 1 px. */
	public static void panel(Canvas c, int x, int y, int w, int h, int bg, int border) {
		pixelRect(c, x, y, w, h, bg);
		pixelFrame(c, x, y, w, h, 1, border);
	}

	/**
	 * Zaokrąglony prostokąt (od 0.30.0, menu w grze): promień r w pikselach okna (pixels = pikseli okna na jednostkę menu),
	 * tło bg i ramka 1 px (przezroczysta = bez ramki). Prostokąty się nie nakładają, więc półprzezroczyste tło ma w rogach
	 * ten sam odcień co w środku.
	 */
	public static void round(Canvas c, int x, int y, int w, int h, int r, int pixels, int bg, int border) {
		int p = Math.max(1, pixels), W = w * p, H = h * p, R = Math.max(1, Math.min(r, Math.min(W, H) / 2));
		if (W <= 0 || H <= 0) return;
		boolean b = (border >>> 24) != 0, f = (bg >>> 24) != 0;
		int[] in = corner(R);
		c.push(1f / p, x, y);
		for (int i = 0; i < R; i++) {
			int a = in[i], e = !b ? a : i == 0 ? W / 2 : Math.min(W / 2, Math.max(a + 1, in[i - 1]));
			for (int yy : new int[] {y + i, y + H - 1 - i}) {
				if (b) {
					c.fill(x + a, yy, x + e, yy + 1, border);
					c.fill(x + W - e, yy, x + W - a, yy + 1, border);
				}
				if (f && W - 2 * e > 0) c.fill(x + e, yy, x + W - e, yy + 1, bg);
				if (i == 0 && b) c.fill(x + e, yy, x + W - e, yy + 1, border);
			}
		}
		if (H > 2 * R) {
			if (b) {
				c.fill(x, y + R, x + 1, y + H - R, border);
				c.fill(x + W - 1, y + R, x + W, y + H - R, border);
			}
			if (f) c.fill(x + (b ? 1 : 0), y + R, x + W - (b ? 1 : 0), y + H - R, bg);
		}
		c.pop();
	}

	/** Wcięcie rzędów rogu koła o promieniu r (rząd 0 = najbardziej zewnętrzny). */
	static int[] corner(int r) {
		int[] in = new int[r];
		for (int i = 0; i < r; i++) in[i] = (int) Math.round(r - Math.sqrt(r * r - (r - i - 0.5) * (r - i - 0.5)));
		return in;
	}

	/** Ikona 12×12; poziome ciągi pikseli rysowane jednym prostokątem. */
	public static void icon(Canvas c, String key, int x, int y, int argb) {
		int[] rows = PixelIcons.get(key);
		if (rows == null) return;
		for (int r = 0; r < rows.length; r++) {
			int start = -1;
			for (int col = 0; col <= 12; col++) {
				boolean on = col < 12 && (rows[r] & (1 << (11 - col))) != 0;
				if (on && start < 0) start = col;
				if (!on && start >= 0) {
					c.fill(x + start, y + r, x + col, y + r + 1, argb);
					start = -1;
				}
			}
		}
	}

	/** Zawija tekst do szerokości maxW, najwyżej maxLines linii; gdy się nie mieści, ostatnia kończy się na „…”. */
	public static String[] wrap(Canvas c, String text, int maxW, int maxLines) {
		List<String> lines = new ArrayList<String>();
		String line = "";
		String[] words = text.trim().split("\\s+");
		int i = 0;
		for (; i < words.length; i++) {
			String next = line.isEmpty() ? words[i] : line + " " + words[i];
			if (c.textWidth(next) <= maxW || line.isEmpty()) {
				line = next;
				continue;
			}
			lines.add(line);
			line = words[i];
			if (lines.size() == maxLines) break;
		}
		boolean cut = i < words.length;
		if (!cut) lines.add(line);
		if (lines.size() > maxLines) {
			lines = lines.subList(0, maxLines);
			cut = true;
		}
		String[] out = lines.toArray(new String[0]);
		if (out.length > 0) {
			String last = out[out.length - 1];
			if (cut || c.textWidth(last) > maxW) out[out.length - 1] = ellipsize(c, last, maxW, cut);
		}
		return out;
	}

	/** Wszystkie linie tekstu w szerokości maxW; słowa dłuższe niż linia są łamane (np. linki w wiadomościach). */
	public static List<String> wrapAll(Canvas c, String text, int maxW) {
		List<String> lines = new ArrayList<String>();
		String line = "";
		for (String w : text.trim().split("\\s+")) {
			String next = line.isEmpty() ? w : line + " " + w;
			if (c.textWidth(next) <= maxW) {
				line = next;
				continue;
			}
			if (!line.isEmpty()) lines.add(line);
			line = w;
			while (c.textWidth(line) > maxW && line.length() > 1) {
				int n = line.length() - 1;
				while (n > 1 && c.textWidth(line.substring(0, n)) > maxW) n--;
				lines.add(line.substring(0, n));
				line = line.substring(n);
			}
		}
		if (!line.isEmpty() || lines.isEmpty()) lines.add(line);
		return lines;
	}

	public static String ellipsize(Canvas c, String s, int maxW, boolean force) {
		if (!force && c.textWidth(s) <= maxW) return s;
		String e = "…";
		String t = s;
		while (!t.isEmpty() && c.textWidth(t + e) > maxW) t = t.substring(0, t.length() - 1);
		return t.trim() + e;
	}
}
