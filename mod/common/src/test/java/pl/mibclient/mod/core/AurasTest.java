package pl.mibclient.mod.core;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;

class AurasTest {
	@Test
	void styleFromIdEnding() {
		assertEquals(Auras.SOULS, Auras.style("halloween_aura_souls"));
		assertEquals(Auras.MAGIC, Auras.style("zimowa_aura_magic"));
		assertEquals(Auras.NONE, Auras.style("aura_magic_x"));
		assertEquals(Auras.NONE, Auras.style(null));
	}

	/** Te same liczby co w launcherze (test/profile.test.js: auraParticles). */
	@Test
	void sameNumbersAsLauncher() {
		assertEquals(0L, Auras.h32(0));
		assertEquals(824515495L, Auras.h32(1));
		assertEquals(1952335732L, Auras.h32(123456789));
		assertEquals(3253613923L, Auras.h32(-5));
		float[] out = new float[Auras.MAX * Auras.STRIDE];
		assertEquals(22, Auras.particles(Auras.SOULS, 12.345, 777, out));
		assertEquals(7.760290074110731, out[0], 1e-4);
		assertEquals(3.370260721633739, out[1], 1e-4);
		assertEquals(-4.649836497573228, out[2], 1e-4);
	}

	@Test
	void particlesStayAroundThePlayerAndMoveSmoothly() {
		int[] counts = {0, 22, 24, 3, 60};
		float[] a = new float[Auras.MAX * Auras.STRIDE], b = new float[Auras.MAX * Auras.STRIDE];
		for (int style = 1; style <= 4; style++) {
			for (double t = 0; t < 30; t += 0.37) {
				int n = Auras.particles(style, t, 42, a);
				assertEquals(counts[style], n);
				Auras.particles(style, t + 0.01, 42, b);
				for (int i = 0; i < n; i++) {
					int o = i * Auras.STRIDE;
					assertTrue(Math.hypot(a[o], a[o + 2]) <= 17 && a[o + 1] >= 0 && a[o + 1] <= 40, "styl " + style + " poza postacią");
					assertTrue(a[o + 5] >= 0 && a[o + 5] <= 1 && a[o + 3] >= 0 && a[o + 3] <= 2);
					double moved = Math.sqrt(Math.pow(b[o] - a[o], 2) + Math.pow(b[o + 1] - a[o + 1], 2) + Math.pow(b[o + 2] - a[o + 2], 2));
					assertTrue(moved < 1 || a[o + 5] < 0.1 || b[o + 1] < a[o + 1], "styl " + style + " skok o " + moved);
				}
			}
		}
		assertEquals(0, Auras.particles(Auras.NONE, 1, 1, a));
	}

	@Test
	void timeRepeatsEveryHour() {
		assertEquals(1.5, Auras.time(3600000L + 1500), 1e-9);
	}
}
