package pl.mibclient.mod.core;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;

class ShapesTest {
	@Test
	void pixelRectSkipsCorners() {
		RecordingCanvas c = new RecordingCanvas();
		Shapes.pixelRect(c, 0, 0, 10, 10, Theme.SLAB);
		for (int y = 0; y < 10; y++) {
			for (int x = 0; x < 10; x++) {
				boolean corner = (x == 0 || x == 9) && (y == 0 || y == 9);
				assertEquals(!corner, c.covered(x, y), x + "," + y);
				if (!corner) assertEquals(1, c.coverCount(x, y), "bez nakładania " + x + "," + y);
			}
		}
	}

	@Test
	void frameHasNoCornersAndNoOverlap() {
		RecordingCanvas c = new RecordingCanvas();
		Shapes.pixelFrame(c, 0, 0, 10, 8, 2, Theme.EDGE);
		assertFalse(c.covered(0, 0));
		assertTrue(c.covered(1, 0));
		assertTrue(c.covered(1, 1));
		assertFalse(c.covered(2, 2));
		for (int y = 0; y < 8; y++) for (int x = 0; x < 10; x++) assertTrue(c.coverCount(x, y) <= 1, x + "," + y);
	}

	@Test
	void iconDrawsRuns() {
		RecordingCanvas c = new RecordingCanvas();
		Shapes.icon(c, "lock", 100, 50, Theme.AM);
		assertFalse(c.fills.isEmpty());
		for (int[] f : c.fills) {
			assertTrue(f[0] >= 100 && f[2] <= 112 && f[1] >= 50 && f[3] <= 62);
			assertEquals(1, f[3] - f[1]);
		}
		c.clear();
		Shapes.icon(c, "brak-takiej", 0, 0, Theme.AM);
		assertTrue(c.fills.isEmpty());
	}

	@Test
	void wrapEllipsizes() {
		RecordingCanvas c = new RecordingCanvas();
		String[] l = Shapes.wrap(c, "Wciśnięte klawisze WASD i myszki", 60, 2);
		assertEquals(2, l.length);
		assertEquals("Wciśnięte", l[0]);
		assertTrue(l[1].endsWith("…"), l[1]);
		assertTrue(c.textWidth(l[1]) <= 60, l[1]);
		assertArrayEquals(new String[] {"Klatki na", "sekundę"}, Shapes.wrap(c, "Klatki na sekundę", 60, 2));
		assertArrayEquals(new String[] {"FPS"}, Shapes.wrap(c, "FPS", 60, 2));
	}

	@Test
	void longSingleWordIsCut() {
		RecordingCanvas c = new RecordingCanvas();
		String[] l = Shapes.wrap(c, "Najdłuższesłowoświata", 60, 2);
		assertEquals(1, l.length);
		assertTrue(c.textWidth(l[0]) <= 60);
		assertTrue(l[0].endsWith("…"));
	}

	@Test
	void allCatalogAndCategoryIconsExist() {
		for (ModuleDef m : ModuleCatalog.STAGE1) assertNotNull(PixelIcons.get(m.icon), m.id + " -> " + m.icon);
		for (Category k : Category.values()) assertNotNull(PixelIcons.get(k.icon), k + " -> " + k.icon);
		for (String k : new String[] {"search", "settings-cog", "arrow-left", "move", "users", "close", "lock", "grid-3x3", "check"}) {
			assertNotNull(PixelIcons.get(k), k);
			assertEquals(12, PixelIcons.get(k).length, k);
		}
	}
}
