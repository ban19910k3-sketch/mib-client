package pl.mibclient.mod.core;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;
import pl.mibclient.mod.core.modules.Emotes;

class EmoteWheelTest {
	@Test
	void mouseDirectionPicksTheEmote() {
		EmoteWheel w = new EmoteWheel();
		assertEquals(10, w.size());
		assertEquals(-1, w.pick(640, 360, 320, 180), "środek koła: nic");
		assertEquals(-1, w.pick(640, 360, 325, 184), "martwe pole w środku");
		assertEquals(0, w.pick(640, 360, 320, 40), "w górę: pierwsza emotka");
		assertEquals(5, w.pick(640, 360, 322, 340), "w dół: szósta (naprzeciwko)");
		for (int i = 0; i < w.size(); i++) {
			int[] s = w.slot(i, 640, 360);
			assertEquals(i, w.pick(640, 360, s[0] + s[2] / 2.0, s[1] + s[3] / 2.0), "środek przycisku " + w.id(i));
		}
	}

	@Test
	void buttonsDoNotOverlapAndFitTheScreen() {
		for (int[] size : new int[][] {{320, 240}, {480, 270}, {640, 360}, {960, 540}}) {
			EmoteWheel w = new EmoteWheel();
			int[] mid = {size[0] / 2 - EmoteWheel.PW / 2, size[1] / 2 - EmoteWheel.PH / 2, EmoteWheel.PW, EmoteWheel.PH};
			for (int i = 0; i < w.size(); i++) {
				int[] a = w.slot(i, size[0], size[1]);
				boolean clear = a[0] + a[2] <= mid[0] || mid[0] + mid[2] <= a[0] || a[1] + a[3] <= mid[1] || mid[1] + mid[3] <= a[1];
				assertTrue(clear, w.id(i) + " zasłania podgląd w środku na " + size[0] + "x" + size[1]);
				assertTrue(a[0] >= 0 && a[1] >= 0 && a[0] + a[2] <= size[0] && a[1] + a[3] <= size[1], "na ekranie " + size[0] + "x" + size[1]);
				for (int j = i + 1; j < w.size(); j++) {
					int[] b = w.slot(j, size[0], size[1]);
					boolean apart = a[0] + a[2] <= b[0] || b[0] + b[2] <= a[0] || a[1] + a[3] <= b[1] || b[1] + b[3] <= a[1];
					assertTrue(apart, w.id(i) + " i " + w.id(j) + " się nakładają na " + size[0] + "x" + size[1]);
				}
			}
		}
	}

	@Test
	void wheelShowsLabelsAndTheHoveredEmote() {
		Lang.setGame("pl_pl");
		EmoteWheel w = new EmoteWheel();
		RecordingCanvas c = new RecordingCanvas();
		w.render(c, 640, 360, 320, 180);
		for (String id : Emotes.IDS) assertTrue(c.hasText(Emotes.label(id, true)), id);
		assertTrue(c.hasText("Wskaż emotkę myszką") && c.hasText("Emotki"));
		assertEquals(1, c.players, "w środku koła stoi postać gracza");
		int[] s = w.slot(7, 640, 360);
		c = new RecordingCanvas();
		w.render(c, 640, 360, s[0] + 5, s[1] + 5);
		assertEquals(2, c.texts.stream().filter(t -> t.s.equals("Floss")).count(), "wskazana emotka też w środku koła");
		assertTrue(c.hasText("Puść B albo kliknij"));
	}
}
