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
	void normalWindowHasThreeColumnsAndSettingsColumn() {
		MenuLayout l = MenuLayout.compute(640, 360, 16, 0);
		assertEquals(3, l.columns);
		assertEquals(620, l.panel[2]);
		assertNotNull(l.detail, "ustawienia obok siatki");
		for (int[] c : l.cards) {
			assertTrue(c[0] >= l.grid[0] && c[0] + c[2] <= l.grid[0] + l.grid[2], "karta w poziomie w siatce");
			assertTrue(c[0] + c[2] < l.detail[0], "karta nie wchodzi na ustawienia");
		}
		assertTrue(l.sidebar[0] + l.sidebar[2] < l.grid[0]);
		assertEquals(l.panel[0] + l.panel[2], l.detail[0] + l.detail[2]);
		assertEquals(16, l.cards.size());
		assertTrue(l.grid[1] > l.top[1] + l.top[3], "siatka pod paskiem zakładek");
	}

	@Test
	void bigWindowGetsBiggerPanel() {
		MenuLayout l = MenuLayout.compute(800, 450, 16, 0);
		assertEquals(MenuLayout.PANEL_W, l.panel[2]);
		assertEquals(MenuLayout.PANEL_H, l.panel[3]);
		assertTrue(l.columns >= 3);
	}

	@Test
	void otherTabsUseWholeWidth() {
		MenuLayout l = MenuLayout.compute(640, 360, 16, 0, false);
		assertNull(l.sidebar);
		assertNull(l.detail);
		assertNull(l.grid);
		assertEquals(l.panel[2] - 2 * MenuLayout.PAD, l.content[2]);
		assertTrue(l.content[1] > l.top[1] + l.top[3]);
	}

	@Test
	void tinyWindowUsesFewerColumnsWithoutSettingsColumn() {
		MenuLayout l = MenuLayout.compute(320, 240, 16, 0);
		assertTrue(l.columns <= 2, "kolumny " + l.columns);
		assertNull(l.detail, "w małym oknie ustawienia zastępują siatkę");
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
		int[] cat = l.category(6), btn = l.sidebarButton(0);
		assertTrue(l.search[1] + l.search[3] < l.category(0)[1], "wyszukiwarka nad kategoriami");
		assertTrue(cat[1] + cat[3] < btn[1], "kategorie nad przyciskiem");
		assertTrue(btn[1] + btn[3] <= l.panel[1] + l.panel[3]);
	}
}
