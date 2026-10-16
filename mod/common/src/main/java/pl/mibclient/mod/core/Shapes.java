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

	public static String ellipsize(Canvas c, String s, int maxW, boolean force) {
		if (!force && c.textWidth(s) <= maxW) return s;
		String e = "…";
		String t = s;
		while (!t.isEmpty() && c.textWidth(t + e) > maxW) t = t.substring(0, t.length() - 1);
		return t.trim() + e;
	}
}
