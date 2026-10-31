package pl.mibclient.mod.core;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Układ menu (od 0.30.0) w jednostkach menu: okno gry podzielone przez scale(). U góry osobne pola: logo, zakładki, język
 * i krzyżyk; niżej na zakładce modułów kolumna „Biblioteka” z kategoriami i „Edytuj HUD”, obok szklany panel z tytułem,
 * wyszukiwarką i siatką kart (do 5 kolumn, przewijana). Pozostałe zakładki mają panel na całą szerokość.
 */
public final class MenuLayout {
	public static final int MARGIN = 10, TOP_H = 22, GAP = 8, SIDEBAR = 112, PAD = 12, MAX_W = 900, MAX_H = 520;
	public static final int SEARCH_W = 150, SEARCH_H = 18, HEAD_H = 34, CARD_H = 116, CARD_MIN_W = 104, CARD_GAP = 6, ROW_H = 20;

	/** Ile pikseli okna przypada na jednostkę menu: całkowita, żeby ikony były ostre. */
	public static int scale(int windowW, int windowH) {
		return Math.max(1, Math.min(6, Math.min(windowW / 540, windowH / 320)));
	}

	/**
	 * Prostokąty {x, y, w, h}: panel = całe menu, top = rząd pól u góry, logo = pole z logo, main = szklany panel treści,
	 * content = jego wnętrze; sidebar, search i grid tylko na zakładce modułów.
	 */
	public final int[] panel, top, logo, sidebar, main, content, search, grid;
	public final int columns, cardW, maxScroll, scroll;
	public final List<int[]> cards;

	private MenuLayout(int[] panel, int[] top, int[] logo, int[] sidebar, int[] main, int[] content, int[] search, int[] grid, int columns,
			int cardW, int maxScroll, int scroll, List<int[]> cards) {
		this.panel = panel;
		this.top = top;
		this.logo = logo;
		this.sidebar = sidebar;
		this.main = main;
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

	/** modules = zakładka modułów (kategorie i siatka kart); inaczej panel treści ma całą szerokość. */
	public static MenuLayout compute(int w, int h, int cardCount, int scroll, boolean modules) {
		int pw = Math.max(240, Math.min(MAX_W, w - 2 * MARGIN)), ph = Math.max(160, Math.min(MAX_H, h - 2 * MARGIN));
		int px = (w - pw) / 2, py = (h - ph) / 2, sw = pw < 400 ? 88 : SIDEBAR;
		int by = py + TOP_H + GAP, bh = py + ph - by;
		int mx = modules ? px + sw + GAP : px;
		int[] main = {mx, by, px + pw - mx, bh}, content = {mx + PAD, by + PAD, main[2] - 2 * PAD, bh - 2 * PAD};
		int[] top = {px, py, pw, TOP_H}, logo = {px, py, sw, TOP_H};
		if (!modules)
			return new MenuLayout(new int[] {px, py, pw, ph}, top, logo, null, main, content, null, null, 0, 0, 0, 0, Collections.<int[]>emptyList());
		int sWidth = Math.min(SEARCH_W, content[2] / 2);
		int[] search = {content[0] + content[2] - sWidth, content[1] + 2, sWidth, SEARCH_H};
		int gy = content[1] + HEAD_H, gw = content[2] - 6, gh = by + bh - PAD - gy;
		int cols = Math.max(1, Math.min(5, (gw + CARD_GAP) / (CARD_MIN_W + CARD_GAP)));
		int cardW = (gw - CARD_GAP * (cols - 1)) / cols;
		int rows = (cardCount + cols - 1) / cols;
		int contentH = rows == 0 ? 0 : rows * CARD_H + (rows - 1) * CARD_GAP;
		int max = Math.max(0, contentH - gh), sc = Math.max(0, Math.min(max, scroll));
		List<int[]> cards = new ArrayList<int[]>();
		for (int i = 0; i < cardCount; i++) {
			int col = i % cols, row = i / cols;
			cards.add(new int[] {content[0] + col * (cardW + CARD_GAP), gy + row * (CARD_H + CARD_GAP) - sc, cardW, CARD_H});
		}
		return new MenuLayout(new int[] {px, py, pw, ph}, top, logo, new int[] {px, by, sw, bh}, main, content, search,
				new int[] {content[0], gy, gw, gh}, cols, cardW, max, sc, Collections.unmodifiableList(cards));
	}

	/** i-ta kategoria w kolumnie „Biblioteka” (pod napisem). */
	public int[] category(int i) {
		return new int[] {sidebar[0], sidebar[1] + 16 + i * (ROW_H + 6), sidebar[2], ROW_H};
	}

	/** Przycisk na dole kolumny; slot 0 = najniżej. */
	public int[] sidebarButton(int slot) {
		return new int[] {sidebar[0], sidebar[1] + sidebar[3] - 22 - slot * 28, sidebar[2], 22};
	}
}
