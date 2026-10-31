package pl.mibclient.mod.core;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Układ menu w jednostkach menu: okno gry podzielone przez scale(). Panel do 680×380, u góry pasek z logo, zakładkami,
 * językiem i zamknięciem. Na zakładce modułów: z lewej wyszukiwarka i kategorie, w środku nagłówek i siatka kart z
 * podglądem (do 4 kolumn, przewijana), z prawej panel ustawień wybranego modułu (gdy panel jest dość szeroki; w małym
 * oknie ustawienia zajmują miejsce siatki). Pozostałe zakładki mają całą szerokość pod paskiem.
 */
public final class MenuLayout {
	public static final int PANEL_W = 680, PANEL_H = 380, MARGIN = 10, PAD = 10, TOP = 26, SIDEBAR = 112, SIDEBAR_SMALL = 96, DETAIL = 148;
	/** Najwęższy panel, w którym ustawienia mieszczą się obok siatki. */
	public static final int DETAIL_MIN_PANEL = 470;
	public static final int SEARCH_H = 18, HEAD_H = 36, CARD_H = 104, CARD_MIN_W = 108, GAP = 6, ROW_H = 20;

	/** Ile pikseli okna przypada na jednostkę menu: całkowita, żeby font i ikony były ostre. */
	public static int scale(int windowW, int windowH) {
		return Math.max(1, Math.min(6, Math.min(windowW / 540, windowH / 320)));
	}

	/** Prostokąty {x, y, w, h}; sidebar, detail, search i grid są null poza zakładką modułów (detail także w małym oknie). */
	public final int[] panel, top, sidebar, detail, content, search, grid;
	public final int columns, cardW, maxScroll, scroll;
	public final List<int[]> cards;

	private MenuLayout(int[] panel, int[] top, int[] sidebar, int[] detail, int[] content, int[] search, int[] grid, int columns, int cardW,
			int maxScroll, int scroll, List<int[]> cards) {
		this.panel = panel;
		this.top = top;
		this.sidebar = sidebar;
		this.detail = detail;
		this.content = content;
		this.search = search;
		this.grid = grid;
		this.columns = columns;
		this.cardW = cardW;
		this.maxScroll = maxScroll;
		this.scroll = scroll;
		this.cards = cards;
	}

	public static MenuLayout compute(int w, int h, int cardCount, int scroll) {
		return compute(w, h, cardCount, scroll, true);
	}

	/** modules = zakładka modułów (pasek boczny, siatka i panel ustawień); inaczej treść ma całą szerokość pod paskiem. */
	public static MenuLayout compute(int w, int h, int cardCount, int scroll, boolean modules) {
		int pw = Math.max(200, Math.min(PANEL_W, w - 2 * MARGIN)), ph = Math.max(160, Math.min(PANEL_H, h - 2 * MARGIN));
		int px = (w - pw) / 2, py = (h - ph) / 2;
		int[] panel = {px, py, pw, ph}, top = {px, py, pw, TOP};
		int by = py + TOP, bh = ph - TOP;
		if (!modules) {
			return new MenuLayout(panel, top, null, null, new int[] {px + PAD, by + PAD, pw - 2 * PAD, bh - 2 * PAD}, null, null, 0, 0, 0, 0,
					Collections.<int[]>emptyList());
		}
		int sw = pw < 360 ? SIDEBAR_SMALL : SIDEBAR;
		int[] sidebar = {px, by, sw, bh};
		int[] detail = pw >= DETAIL_MIN_PANEL ? new int[] {px + pw - DETAIL, by, DETAIL, bh} : null;
		int cx = px + sw + PAD, cw = (detail != null ? detail[0] : px + pw) - PAD - cx, cy = by + PAD, ch = bh - 2 * PAD;
		int[] search = {px + 6, by + 10, sw - 12, SEARCH_H};
		int gy = cy + HEAD_H, gh = by + bh - PAD - gy;
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
		return new MenuLayout(panel, top, sidebar, detail, new int[] {cx, cy, cw, ch}, search, new int[] {cx, gy, cw, gh}, cols, cardW, max, sc,
				Collections.unmodifiableList(cards));
	}

	/** i-ta pozycja listy kategorii w pasku bocznym (pod wyszukiwarką). */
	public int[] category(int i) {
		return new int[] {sidebar[0] + 6, search[1] + SEARCH_H + 12 + i * (ROW_H + 3), sidebar[2] - 12, ROW_H};
	}

	/** Przycisk na dole paska bocznego; slot 0 = najniżej. */
	public int[] sidebarButton(int slot) {
		return new int[] {sidebar[0] + 6, sidebar[1] + sidebar[3] - 10 - ROW_H - slot * (ROW_H + 4), sidebar[2] - 12, ROW_H};
	}
}
