package pl.mibclient.mod.core;

/** Ramka edytora HUD: podpowiedź u góry i przyciski „Przywróć domyślne” oraz „Gotowe” na dole (jednostki GUI). */
public final class HudEditorView {
	public static final String RESET = "reset", DONE = "done";

	private int[] reset = new int[4], done = new int[4];

	public void render(Canvas c, int sw, int sh, int mx, int my) {
		String hint = Lang.t("hud.hint");
		int hw = c.textWidth(hint) + 12;
		Shapes.pixelRect(c, (sw - hw) / 2, 6, hw, 15, Theme.DIM);
		c.text(hint, (sw - hw) / 2 + 6, 10, Theme.TEXT, false);

		String r = Lang.t("hud.reset"), d = Lang.t("hud.done");
		int rw = c.textWidth(r) + 16, dw = c.textWidth(d) + 24, y = sh - 30, x = (sw - rw - dw - 6) / 2;
		reset = new int[] {x, y, rw, 16};
		done = new int[] {x + rw + 6, y, dw, 16};
		Shapes.panel(c, reset[0], reset[1], reset[2], reset[3], in(reset, mx, my) ? Theme.SLAB2 : Theme.SLAB, Theme.EDGE2);
		c.text(r, reset[0] + 8, y + 4, Theme.TEXT, false);
		Shapes.pixelRect(c, done[0], done[1], done[2], done[3], in(done, mx, my) ? 0xFF7C3AED : Theme.AM_LO);
		c.fill(done[0] + 1, y, done[0] + dw - 1, y + 1, Theme.BTN_HI);
		c.fill(done[0] + 1, y + 15, done[0] + dw - 1, y + 16, Theme.BTN_LO);
		c.text(d, done[0] + 12, y + 4, 0xFFFFFFFF, true);
	}

	/** RESET, DONE albo null, gdy kliknięcie nie trafiło w przycisk. */
	public String click(double x, double y) {
		if (in(reset, x, y)) return RESET;
		if (in(done, x, y)) return DONE;
		return null;
	}

	private static boolean in(int[] r, double x, double y) {
		return x >= r[0] && x < r[0] + r[2] && y >= r[1] && y < r[1] + r[3];
	}
}
