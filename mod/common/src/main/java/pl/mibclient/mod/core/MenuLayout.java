package pl.mibclient.mod.core;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Układ menu (makieta A) w jednostkach menu: okno gry podzielone przez scale(). Panel do 520×300,
 * pasek boczny po lewej, wyszukiwarka u góry, siatka kart (do 4 kolumn, przewijana).
 */
public final class MenuLayout {
	public static final int PANEL_W = 520, PANEL_H = 300, MARGIN = 10, PAD = 10, SIDEBAR = 112, SIDEBAR_SMALL = 96;
	public static final int SEARCH_H = 16, CARD_H = 80, CARD_MIN_W = 84, GAP = 6, ROW_H = 16, COUNT_W = 96;

	/** Ile pikseli okna przypada na jednostkę menu: całkowita, żeby font i ikony były ostre. */
	public static int scale(int windowW, int windowH) {
		return Math.max(1, Math.min(6, Math.min(windowW / 540, windowH / 320)));
	}

	public final int[] panel, sidebar, content, search, grid;
	public final int columns, cardW, maxScroll, scroll;
	public final boolean showCount;
	public final List<int[]> cards;

	private MenuLayout(int[] panel, int[] sidebar, int[] content, int[] search, int[] grid, int columns, int cardW, int maxScroll, int scroll,
			boolean showCount, List<int[]> cards) {
		this.panel = panel;
		this.sidebar = sidebar;
		this.content = content;
		this.search = search;
		this.grid = grid;
		this.columns = columns;
		this.cardW = cardW;
		this.maxScroll = maxScroll;
		this.scroll = scroll;
		this.showCount = showCount;
		this.cards = cards;
	}

	public static MenuLayout compute(int w, int h, int cardCount, int scroll) {
		int pw = Math.max(200, Math.min(PANEL_W, w - 2 * MARGIN)), ph = Math.max(160, Math.min(PANEL_H, h - 2 * MARGIN));
		int px = (w - pw) / 2, py = (h - ph) / 2;
		int sw = pw < 360 ? SIDEBAR_SMALL : SIDEBAR;
		int cx = px + sw + PAD, cw = pw - sw - 2 * PAD, cy = py + PAD, ch = ph - 2 * PAD;
		boolean showCount = cw >= 280;
		int[] search = {cx, cy, showCount ? cw - COUNT_W : cw, SEARCH_H};
		int gy = cy + SEARCH_H + 8, gh = py + ph - PAD - gy;
		int cols = Math.max(1, Math.min(4, (cw + GAP) / (CARD_MIN_W + GAP)));
		int cardW = (cw - GAP * (cols - 1)) / cols;
		int rows = (cardCount + cols - 1) / cols;
		int contentH = rows == 0 ? 0 : rows * CARD_H + (rows - 1) * GAP;
		int max = Math.max(0, contentH - gh), sc = Math.max(0, Math.min(max, scroll));
		List<int[]> cards = new ArrayList<int[]>();
		for (int i = 0; i < cardCount; i++) {
			int col = i % cols, row = i / cols;
			cards.add(new int[] {cx + col * (cardW + GAP), gy + row * (CARD_H + GAP) - sc, cardW, CARD_H});
		}
		return new MenuLayout(new int[] {px, py, pw, ph}, new int[] {px, py, sw, ph}, new int[] {cx, cy, cw, ch}, search,
				new int[] {cx, gy, cw, gh}, cols, cardW, max, sc, showCount, Collections.unmodifiableList(cards));
	}

	/** i-ta pozycja listy kategorii w pasku bocznym. */
	public int[] category(int i) {
		return new int[] {sidebar[0] + 6, sidebar[1] + 36 + i * (ROW_H + 2), sidebar[2] - 12, ROW_H};
	}

	/** Przycisk na dole paska bocznego; slot 0 = najniżej. */
	public int[] sidebarButton(int slot) {
		return new int[] {sidebar[0] + 6, sidebar[1] + sidebar[3] - 6 - ROW_H - slot * (ROW_H + 4), sidebar[2] - 12, ROW_H};
	}
}
