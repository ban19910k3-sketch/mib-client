package pl.mibclient.mod.core;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;

class MenuLayoutTest {
	@Test
	void scaleFollowsWindow() {
		assertEquals(2, MenuLayout.scale(1920, 1080), "od 0.40.0 mniejsze menu na dużych ekranach");
		assertEquals(3, MenuLayout.scale(2560, 1440));
		assertEquals(2, MenuLayout.scale(1600, 900));
		assertEquals(2, MenuLayout.scale(1280, 720));
		assertEquals(1, MenuLayout.scale(854, 480));
		assertEquals(1, MenuLayout.scale(320, 240));
		assertEquals(5, MenuLayout.scale(7680, 4320));
	}

	@Test
	void normalWindowHasFourColumnsNextToLibrary() {
		MenuLayout l = MenuLayout.compute(640, 360, 16, 0);
		assertEquals(4, l.columns);
		assertEquals(620, l.panel[2]);
		for (int[] c : l.cards) assertTrue(c[0] >= l.grid[0] && c[0] + c[2] <= l.grid[0] + l.grid[2], "karta w poziomie w siatce");
		assertTrue(l.sidebar[0] + l.sidebar[2] < l.main[0], "biblioteka obok panelu");
		assertTrue(l.main[1] > l.top[1] + l.top[3], "panel pod polami u góry");
		assertTrue(l.search[0] + l.search[2] <= l.content[0] + l.content[2], "wyszukiwarka w prawym górnym rogu panelu");
		assertTrue(l.grid[1] >= l.search[1] + l.search[3]);
		assertEquals(16, l.cards.size());
	}

	@Test
	void bigWindowUsesUpToFiveColumns() {
		MenuLayout l = MenuLayout.compute(960, 540, 16, 0);
		assertEquals(MenuLayout.MAX_W, l.panel[2]);
		assertEquals(MenuLayout.MAX_H, l.panel[3]);
		assertEquals(5, l.columns);
	}

	@Test
	void otherTabsUseWholeWidth() {
		MenuLayout l = MenuLayout.compute(640, 360, 16, 0, false);
		assertNull(l.sidebar);
		assertNull(l.grid);
		assertEquals(l.panel[0], l.main[0]);
		assertEquals(l.panel[2], l.main[2]);
		assertTrue(l.content[1] > l.top[1] + l.top[3]);
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
	void sidebarItemsStayInsideColumn() {
		MenuLayout l = MenuLayout.compute(640, 360, 16, 0);
		int[] cat = l.category(6), btn = l.sidebarButton(0);
		assertTrue(cat[1] + cat[3] < btn[1], "kategorie nad przyciskiem");
		assertEquals(l.sidebar[1] + l.sidebar[3], btn[1] + btn[3]);
	}
}
