package pl.mibclient.mod.core;

import static org.junit.jupiter.api.Assertions.*;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.Test;

class HudLayoutTest {
	@Test
	void roundTripTopRight() {
		HudPos p = HudLayout.toPos(436, 4, 40, 10, 480, 270, 1.0);
		assertEquals(new HudPos(Anchor.TOP_RIGHT, 4, 4, 1.0), p);
		assertArrayEquals(new int[] {436, 4}, HudLayout.place(p, 40, 10, 480, 270));
	}

	@Test
	void roundTripEveryAnchor() {
		int[][] pts = {{10, 10}, {220, 10}, {420, 10}, {10, 130}, {220, 130}, {420, 130}, {10, 250}, {220, 250}, {420, 250}};
		for (int[] xy : pts) {
			HudPos p = HudLayout.toPos(xy[0], xy[1], 41, 11, 480, 270, 1.5);
			assertArrayEquals(xy, HudLayout.place(p, 41, 11, 480, 270), p.toString());
			assertEquals(1.5, p.scale);
		}
		assertEquals(Anchor.CENTER, HudLayout.toPos(220, 130, 41, 11, 480, 270, 1).anchor);
		assertEquals(Anchor.BOTTOM_LEFT, HudLayout.toPos(10, 250, 41, 11, 480, 270, 1).anchor);
	}

	@Test
	void positionIsClampedAfterResize() {
		HudPos p = new HudPos(Anchor.BOTTOM_RIGHT, -300, -200, 1.0);
		int[] xy = HudLayout.place(p, 40, 10, 320, 240);
		assertTrue(xy[0] >= 0 && xy[0] + 40 <= 320, "x " + xy[0]);
		assertTrue(xy[1] >= 0 && xy[1] + 10 <= 240, "y " + xy[1]);
		int[] big = HudLayout.place(new HudPos(Anchor.TOP_LEFT, 4, 4, 1), 500, 300, 320, 240);
		assertArrayEquals(new int[] {0, 0}, big);
	}

	@Test
	void snapsToScreenEdgeAndCenter() {
		List<int[]> none = Collections.emptyList();
		assertArrayEquals(new int[] {2, 50}, HudLayout.snap(3, 50, 40, 10, none, 480, 270, 4));
		assertArrayEquals(new int[] {438, 50}, HudLayout.snap(436, 50, 40, 10, none, 480, 270, 4));
		assertArrayEquals(new int[] {220, 50}, HudLayout.snap(223, 50, 40, 10, none, 480, 270, 4));
		assertArrayEquals(new int[] {100, 50}, HudLayout.snap(100, 50, 40, 10, none, 480, 270, 4));
		List<int[]> other = Arrays.asList(new int[] {100, 100, 50, 20});
		assertArrayEquals(new int[] {150, 120}, HudLayout.snap(153, 118, 40, 10, other, 480, 270, 4));
	}
}
