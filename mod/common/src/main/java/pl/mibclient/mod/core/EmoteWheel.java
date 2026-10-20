package pl.mibclient.mod.core;

import pl.mibclient.mod.core.modules.Emotes;

/**
 * Koło emotek (przytrzymanie B): emotki rozłożone po okręgu wokół środka ekranu, pierwsza na górze, dalej zgodnie
 * z ruchem wskazówek zegara. Wybiera kierunek myszy od środka (jak w grach); środek koła to „nic”.
 */
public final class EmoteWheel {
	public static final int BW = 76, BH = 18, DEAD = 16;
	private final String[] ids;

	public EmoteWheel() {
		this(Emotes.IDS);
	}

	public EmoteWheel(String[] ids) {
		this.ids = ids;
	}

	public int size() {
		return ids.length;
	}

	public String id(int i) {
		return ids[i];
	}

	/** Promień koła na ekranie sw×sh (jednostki GUI): przy 10 emotkach sąsiednie przyciski się nie nakładają od 94. */
	public static int radius(int sw, int sh) {
		return Math.max(70, Math.min(120, Math.min(sw, sh) / 2 - BH - 6));
	}

	/** Poziomy promień: koło rozciągnięte na boki (przyciski są szerokie), ale w granicach ekranu. */
	private static int radiusX(int sw, int sh) {
		return Math.max(radius(sw, sh), Math.min(radius(sw, sh) * 7 / 5, sw / 2 - BW / 2 - 6));
	}

	/** Środek przycisku emotki i {x, y}. */
	private int[] center(int i, int sw, int sh) {
		double a = -Math.PI / 2 + i * 2 * Math.PI / ids.length;
		return new int[] {sw / 2 + (int) Math.round(Math.cos(a) * radiusX(sw, sh)), sh / 2 + (int) Math.round(Math.sin(a) * radius(sw, sh))};
	}

	/** Prostokąt przycisku emotki i {x, y, w, h}. */
	public int[] slot(int i, int sw, int sh) {
		int[] c = center(i, sw, sh);
		return new int[] {c[0] - BW / 2, c[1] - BH / 2, BW, BH};
	}

	/** Emotka wskazana myszą: ta, w której stronę od środka wskazuje mysz (poza martwym polem w środku), albo -1. */
	public int pick(int sw, int sh, double mx, double my) {
		double dx = mx - sw / 2.0, dy = my - sh / 2.0;
		if (dx * dx + dy * dy < DEAD * DEAD) return -1;
		double a = Math.atan2(dy, dx), best = Double.MAX_VALUE;
		int pick = -1;
		for (int i = 0; i < ids.length; i++) {
			int[] c = center(i, sw, sh);
			double d = Math.abs(Math.atan2(c[1] - sh / 2.0, c[0] - sw / 2.0) - a);
			d = Math.min(d, 2 * Math.PI - d);
			if (d < best) {
				best = d;
				pick = i;
			}
		}
		return pick;
	}

	public void render(Canvas c, int sw, int sh, double mx, double my) {
		int hovered = pick(sw, sh, mx, my), cx = sw / 2, cy = sh / 2, r = radius(sw, sh);
		c.fill(0, 0, sw, sh, 0x70050010);
		// pikselowy owal i kropki od środka do wskazanej emotki
		int rx = radiusX(sw, sh);
		for (int k = 0; k < 72; k++) {
			double a = k * 2 * Math.PI / 72;
			int x = cx + (int) Math.round(Math.cos(a) * rx), y = cy + (int) Math.round(Math.sin(a) * r);
			c.fill(x, y, x + 1, y + 1, Theme.AM_LO);
		}
		if (hovered >= 0) {
			int[] t = center(hovered, sw, sh);
			double len = Math.hypot(t[0] - cx, t[1] - cy);
			for (double d = DEAD + 6; d < len - BH / 2.0 - 2; d += 5) {
				int x = cx + (int) Math.round((t[0] - cx) * d / len), y = cy + (int) Math.round((t[1] - cy) * d / len);
				c.fill(x - 1, y - 1, x + 1, y + 1, Theme.AM);
			}
		}
		String title = Lang.t("emotes.title"), hint = hovered >= 0 ? Emotes.label(ids[hovered], Lang.pl()) : Lang.t("emotes.hint");
		int w = Math.max(c.textWidth(title), c.textWidth(hint)) + 16;
		Shapes.panel(c, cx - w / 2, cy - 13, w, 26, Theme.SLAB, hovered >= 0 ? Theme.AM : Theme.EDGE2);
		c.text(title, cx - c.textWidth(title) / 2, cy - 10, Theme.AM_HI, false);
		c.text(hint, cx - c.textWidth(hint) / 2, cy + 2, hovered >= 0 ? Theme.TEXT : Theme.MUTED, false);
		for (int i = 0; i < ids.length; i++) {
			int[] s = slot(i, sw, sh);
			boolean on = i == hovered;
			if (on) {
				Shapes.pixelRect(c, s[0], s[1], s[2], s[3], Theme.AM_LO);
				c.fill(s[0] + 1, s[1], s[0] + s[2] - 1, s[1] + 1, Theme.BTN_HI);
				c.fill(s[0] + 1, s[1] + s[3] - 1, s[0] + s[2] - 1, s[1] + s[3], Theme.BTN_LO);
			} else Shapes.panel(c, s[0], s[1], s[2], s[3], Theme.SLAB, Theme.EDGE2);
			String t = Shapes.ellipsize(c, Emotes.label(ids[i], Lang.pl()), s[2] - 8, false);
			c.text(t, s[0] + (s[2] - c.textWidth(t)) / 2, s[1] + (s[3] - 8) / 2, on ? 0xFFFFFFFF : Theme.TEXT, on);
		}
	}
}
