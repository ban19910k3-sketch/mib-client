package pl.mibclient.mod.core;

import static org.junit.jupiter.api.Assertions.*;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class NoticeTest {
	@TempDir
	File dir;

	@AfterEach
	void lang() {
		Lang.choose("auto");
		Lang.setGame("pl_pl");
	}

	@Test
	void parsesLauncherNotice() {
		Notice n = Notice.parse("{\"id\":\"5-1\",\"type\":\"invite\",\"nick\":\"Ala\",\"version\":\"1.21.11\",\"server\":\"play.mib.pl\",\"at\":5}");
		assertNotNull(n);
		assertTrue(n.invite());
		assertEquals("Zaproszenie do gry", n.title());
		assertEquals("Ala zaprasza Cię na play.mib.pl (Minecraft 1.21.11). Dołącz w launcherze: Znajomi.", n.body());
		Notice s = Notice.parse("{\"id\":\"6-2\",\"type\":\"started\",\"nick\":\"Bob\",\"version\":\"26.1\",\"server\":null,\"at\":6}");
		assertEquals("Bob gra teraz w Minecraft 26.1.", s.body());
		Lang.choose("en");
		assertEquals("Friend playing", s.title());
		assertEquals("Bob is now playing Minecraft 26.1.", s.body());
	}

	@Test
	void parsesMessageNotice() {
		Notice n = Notice.parse("{\"id\":\"7-3\",\"type\":\"message\",\"nick\":\"Ala\",\"text\":\"Gramy?\",\"at\":7}");
		assertTrue(n.message());
		assertEquals("Wiadomość od Ala", n.title());
		assertEquals("Gramy? (odpowiesz pod prawym Shiftem: Znajomi)", n.body());
		assertNull(Notice.parse("{\"id\":\"7-4\",\"type\":\"message\",\"nick\":\"Ala\",\"at\":7}"), "wiadomość bez treści");
	}

	@Test
	void parsesGiftNotice() {
		Notice n = Notice.parse("{\"id\":\"8-1\",\"type\":\"gift\",\"nick\":\"MiB\",\"text\":\"Peleryna Złota\",\"at\":8}");
		assertTrue(n.gift());
		assertEquals("Prezent od MiB!", n.title());
		assertEquals("Peleryna Złota czeka na Ciebie. Odbierz w launcherze.", n.body());
		assertNull(Notice.parse("{\"id\":\"8-2\",\"type\":\"gift\",\"nick\":\"MiB\",\"at\":8}"), "prezent bez nazwy");
	}

	@Test
	void rejectsBrokenNotices() {
		assertNull(Notice.parse("nie json"));
		assertNull(Notice.parse("{\"id\":\"1\",\"nick\":\"  \",\"at\":1}"));
		assertNull(Notice.parse("{\"id\":\"1\",\"type\":\"invite\",\"nick\":\"Ala\",\"at\":1}"), "zaproszenie bez serwera");
		assertNull(Notice.parse("{\"nick\":\"Ala\",\"at\":1}"));
	}

	@Test
	void boardShowsEachNoticeOnceAndHidesOldOnes() {
		Notice.Board b = new Notice.Board();
		Notice n = new Notice("a", "started", "Ala", null, null, 1000);
		b.offer(n, 1500);
		assertSame(n, b.current(1500));
		assertSame(n, b.current(1500 + Notice.SHOW_MS - 1));
		assertNull(b.current(1500 + Notice.SHOW_MS), "znika po SHOW_MS");
		b.offer(n, 9000);
		assertNull(b.current(9000), "to samo powiadomienie drugi raz się nie pokazuje");
		b.offer(new Notice("b", "started", "Bob", null, null, 0), Notice.MAX_AGE_MS + 1);
		assertNull(b.current(Notice.MAX_AGE_MS + 1), "sprzed minuty: już nieaktualne");
		Notice c = new Notice("c", "invite", "Ola", "1.21.4", "mc.x.pl", 20000);
		b.offer(c, 20000);
		Notice d = new Notice("d", "started", "Ela", null, null, 20500);
		b.offer(d, 20500);
		assertSame(d, b.current(20500), "nowe zastępuje poprzednie");
	}

	@Test
	void boardSlidesInFromTheRightAndFitsTheScreen() {
		Notice.Board b = new Notice.Board();
		b.offer(new Notice("a", "invite", "Ala", "1.21.11", "play.mib.pl", 0), 0);
		RecordingCanvas start = new RecordingCanvas();
		b.render(start, 400, 0);
		RecordingCanvas mid = new RecordingCanvas();
		b.render(mid, 400, 1000);
		int left0 = Integer.MAX_VALUE, left1 = Integer.MAX_VALUE, right1 = 0;
		for (int[] f : start.fills) left0 = Math.min(left0, f[0]);
		for (int[] f : mid.fills) {
			left1 = Math.min(left1, f[0]);
			right1 = Math.max(right1, f[2]);
		}
		assertTrue(left0 >= 400, "na początku jeszcze poza ekranem");
		assertTrue(left1 < 400 && right1 <= 400 - 4, "po chwili cały w prawym rogu");
		assertEquals("Zaproszenie do gry", mid.texts.get(0).s);
		StringBuilder all = new StringBuilder();
		for (int i = 1; i < mid.texts.size(); i++) {
			assertTrue(mid.texts.get(i).x + mid.textWidth(mid.texts.get(i).s) <= right1, "tekst w okienku");
			all.append(mid.texts.get(i).s).append(' ');
		}
		assertTrue(all.toString().contains("play.mib.pl"));
		RecordingCanvas none = new RecordingCanvas();
		b.render(none, 400, Notice.SHOW_MS);
		assertTrue(none.fills.isEmpty() && none.texts.isEmpty(), "po czasie nic nie rysuje");
	}

	@Test
	void bridgeReadsNoticeFile() throws Exception {
		LauncherBridge br = new LauncherBridge(dir);
		assertNull(br.notice());
		Files.write(new File(dir, "notice.json").toPath(),
				"{\"id\":\"9-1\",\"type\":\"started\",\"nick\":\"Ala\",\"version\":\"1.21.11\",\"server\":\"play.mib.pl\",\"at\":9}".getBytes(StandardCharsets.UTF_8));
		Notice n = br.notice();
		assertEquals("9-1", n.id);
		assertSame(n, br.notice(), "bez zmiany pliku ten sam obiekt");
	}
}
