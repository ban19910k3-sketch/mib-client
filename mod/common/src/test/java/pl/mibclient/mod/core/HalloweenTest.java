package pl.mibclient.mod.core;

import static org.junit.jupiter.api.Assertions.*;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

class HalloweenTest {
	/** Motyw według daty: od 15 października do 5 listopada włącznie (tak samo jak season w launcherze). */
	@Test
	void seasonByDate() {
		assertFalse(Theme.halloween(java.time.LocalDate.of(2026, 10, 14)));
		assertTrue(Theme.halloween(java.time.LocalDate.of(2026, 10, 15)));
		assertTrue(Theme.halloween(java.time.LocalDate.of(2026, 10, 31)));
		assertTrue(Theme.halloween(java.time.LocalDate.of(2026, 11, 5)));
		assertFalse(Theme.halloween(java.time.LocalDate.of(2026, 11, 6)));
		assertFalse(Theme.halloween(java.time.LocalDate.of(2027, 1, 1)));
	}

	/** Prawdziwy czas w milisekundach jest większy niż int: numer klatki nie może wyjść ujemny. */
	@Test
	void drawsWithRealClockTimes() {
		long[] times = {0L, 1234L, System.currentTimeMillis(), 1_761_000_000_000L, Long.MAX_VALUE / 2};
		for (long t : times) {
			for (int[] size : new int[][] {{640, 360}, {427, 240}, {1920, 1080}}) {
				RecordingCanvas c = new RecordingCanvas();
				Halloween.screen(c, size[0], size[1], t, true);
				Halloween.screen(c, size[0], size[1], t, false);
				Halloween.menu(c, size[0], size[1], t);
				Halloween.dusk(c, size[0], size[1]);
				Halloween.loading(c, size[0], size[1], 0.5f);
			}
		}
	}

	@Test
	void webPixelsAreUniqueAndInsideTheCorner() {
		List<int[]> px = Halloween.webPixels(40);
		Set<Integer> seen = new HashSet<Integer>();
		for (int[] p : px) {
			assertTrue(p[0] >= 0 && p[1] >= 0 && p[0] <= 40 && p[1] <= 40, "piksel poza rogiem");
			assertTrue(seen.add(p[0] * 1000 + p[1]), "piksel dwa razy (podwójna przezroczystość)");
		}
		assertTrue(px.size() > 100);
	}
}
