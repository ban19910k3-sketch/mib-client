package pl.mibclient.mod.core.modules;

import static org.junit.jupiter.api.Assertions.*;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;
import pl.mibclient.mod.core.Theme;

class ModulesLogicTest {
	@Test
	void cpsCountsOnlyLastSecond() {
		CpsCounter c = new CpsCounter();
		c.click(0);
		c.click(100);
		c.click(900);
		c.click(1500);
		assertEquals(2, c.cps(1500));
		assertEquals(0, c.cps(10_000));
	}

	@Test
	void facingFollowsMinecraftYaw() {
		assertEquals("S", Formats.facing(0));
		assertEquals("W", Formats.facing(90));
		assertEquals("N", Formats.facing(180));
		assertEquals("E", Formats.facing(-90));
		assertEquals("NE", Formats.facing(225));
		assertEquals("S", Formats.facing(720));
		assertEquals("S", Formats.facing(-361));
	}

	@Test
	void coordsUseBlockPositionOrDecimals() {
		assertEquals("X 1  Y 64  Z -39", Formats.coords(1.6, 64, -38.2, 0));
		assertEquals("X 1.6  Y 64.0  Z -38.2", Formats.coords(1.6, 64, -38.2, 1));
	}

	@Test
	void timesAndDurations() {
		assertEquals("1:05:09", Formats.duration(3909000));
		assertEquals("5:09", Formats.duration(309000));
		assertEquals("0:00", Formats.duration(-5));
		assertEquals("1:30", Formats.potion(1800, false));
		assertEquals("∞", Formats.potion(1800, true));
		assertEquals("14:05", Formats.clock(14, 5, 9, true, false));
		assertEquals("14:05:09", Formats.clock(14, 5, 9, true, true));
		assertEquals("2:05 PM", Formats.clock(14, 5, 9, false, false));
		assertEquals("12:00 AM", Formats.clock(0, 0, 0, false, false));
	}

	@Test
	void pingDurabilityAddress() {
		assertEquals(0xFFF87171, Formats.pingColor(200));
		assertEquals(Theme.GOOD, Formats.pingColor(20));
		assertEquals(Theme.WARN, Formats.pingColor(100));
		assertEquals(Theme.MUTED, Formats.pingColor(-1));
		assertEquals("75%", Formats.durability(100, 25, true));
		assertEquals("75", Formats.durability(100, 25, false));
		assertEquals("", Formats.durability(0, 0, false));
		assertEquals("play.mib.pl", Formats.address("play.mib.pl:25565", true));
		assertEquals("play.mib.pl:25570", Formats.address("play.mib.pl:25570", true));
		assertEquals("play.mib.pl", Formats.address("play.mib.pl:25570", false));
		assertEquals("", Formats.address(null, true));
	}

	@Test
	void zoomFactorScrollAndReset() {
		ZoomState z = new ZoomState();
		z.setBase(4);
		z.setHeld(true);
		assertTrue(z.active());
		assertEquals(0.25f, z.fovMultiplier(0.016f, false), 1e-6);
		z.scroll(1);
		assertEquals(4.8, z.factor(), 1e-9);
		z.scroll(30);
		assertEquals(50, z.factor(), 1e-9);
		z.scroll(-100);
		assertEquals(1.5, z.factor(), 1e-9);
		z.setHeld(false);
		assertEquals(1.0f, z.fovMultiplier(0.016f, false), 1e-6);
		z.setHeld(true);
		assertEquals(4, z.factor(), 1e-9);
	}

	@Test
	void smoothZoomReachesTarget() {
		ZoomState z = new ZoomState();
		z.setBase(4);
		z.setHeld(true);
		float m = 1;
		for (int i = 0; i < 60; i++) m = z.fovMultiplier(1 / 60f, true);
		assertEquals(0.25f, m, 0.01);
		assertTrue(z.fovMultiplier(0, true) < 1);
	}

	private static List<int[]> fills(List<int[]> rs) {
		List<int[]> out = new ArrayList<int[]>();
		for (int[] r : rs) if (r[4] == 0) out.add(r);
		return out;
	}

	private static boolean has(List<int[]> rs, int... r) {
		for (int[] x : rs) if (Arrays.equals(Arrays.copyOf(x, 4), r)) return true;
		return false;
	}

	@Test
	void crosshairPlusArms() {
		List<int[]> r = CrosshairShape.rects("plus", 5, 1, 2, false, false);
		assertEquals(4, r.size());
		assertTrue(has(r, 3, 0, 8, 1));
		assertTrue(has(r, -7, 0, -2, 1));
		assertTrue(has(r, 0, -7, 1, -2));
		assertTrue(has(r, 0, 3, 1, 8));
		assertEquals(5, CrosshairShape.rects("plus", 5, 1, 2, true, false).size());
		assertTrue(has(CrosshairShape.rects("plus", 5, 1, 2, true, false), 0, 0, 1, 1));
	}

	@Test
	void crosshairOutlineDoublesAndComesFirst() {
		List<int[]> r = CrosshairShape.rects("plus", 5, 1, 2, false, true);
		assertEquals(8, r.size());
		assertEquals(1, r.get(0)[4]);
		assertEquals(4, fills(r).size());
		assertTrue(has(r, 2, -1, 9, 2));
	}

	@Test
	void otherShapesAreNonEmptyAndSymmetric() {
		for (String s : new String[] {"dot", "circle", "x", "square"}) {
			List<int[]> r = CrosshairShape.rects(s, 5, 1, 2, false, false);
			assertFalse(r.isEmpty(), s);
			int minX = 99, maxX = -99;
			for (int[] x : r) {
				minX = Math.min(minX, x[0]);
				maxX = Math.max(maxX, x[2]);
			}
			assertEquals(1 - minX, maxX, s + " symetryczny względem środkowego piksela");
		}
		assertEquals(4, CrosshairShape.rects("unknown", 5, 1, 2, false, false).size(), "nieznany kształt = plus");
	}
}
