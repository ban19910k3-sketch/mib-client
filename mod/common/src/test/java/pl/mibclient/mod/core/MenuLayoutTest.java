package pl.mibclient.mod.core;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;

class MenuLayoutTest {
	@Test
	void scaleFollowsWindow() {
		assertEquals(3, MenuLayout.scale(1920, 1080));
		assertEquals(2, MenuLayout.scale(1280, 720));
		assertEquals(1, MenuLayout.scale(854, 480));
		assertEquals(1, MenuLayout.scale(320, 240));
		assertEquals(6, MenuLayout.scale(7680, 4320));
	}

	@Test
	void normalWindowHasFourColumnsInsideGrid() {
		MenuLayout l = MenuLayout.compute(640, 360, 16, 0);
		assertEquals(4, l.columns);
		assertEquals(520, l.panel[2]);
		for (int[] c : l.cards) {
			assertTrue(c[0] >= l.grid[0] && c[0] + c[2] <= l.grid[0] + l.grid[2], "karta w poziomie w siatce");
		}
		assertTrue(l.showCount);
		assertEquals(16, l.cards.size());
	}

	@Test
	void tinyWindowUsesFewerColumns() {
		MenuLayout l = MenuLayout.compute(320, 240, 16, 0);
		assertTrue(l.columns <= 2, "kolumny " + l.columns);
		assertTrue(l.maxScroll > 0);
		assertTrue(l.panel[0] >= 0 && l.panel[0] + l.panel[2] <= 320);
		assertTrue(l.panel[1] >= 0 && l.panel[1] + l.panel[3] <= 240);
	}

	@Test
	void scrollIsClampedAndMovesCards() {
		MenuLayout a = MenuLayout.compute(320, 240, 16, 0), b = MenuLayout.compute(320, 240, 16, 99999);
		assertEquals(a.maxScroll, b.scroll);
		assertEquals(a.cards.get(0)[1] - b.scroll, b.cards.get(0)[1]);
		assertEquals(0, MenuLayout.compute(320, 240, 16, -50).scroll);
	}

	@Test
	void sidebarItemsStayInsidePanel() {
		MenuLayout l = MenuLayout.compute(640, 360, 16, 0);
		int[] cat = l.category(4), btn = l.sidebarButton(1);
		assertTrue(cat[1] + cat[3] < btn[1], "kategorie nad przyciskami");
		assertTrue(l.sidebarButton(0)[1] + 16 <= l.panel[1] + l.panel[3]);
	}
}
