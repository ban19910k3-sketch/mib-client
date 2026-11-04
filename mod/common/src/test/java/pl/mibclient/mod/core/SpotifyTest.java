package pl.mibclient.mod.core;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;

class SpotifyTest {
	@Test
	void parsesLauncherStateAndCountsPosition() {
		Spotify s = Spotify.parse("{\"state\":\"playing\",\"title\":\"Utwór §c\",\"artist\":\"Ktoś\",\"album\":\"Płyta\",\"position\":61000,\"duration\":180000,\"at\":1000,\"cover\":\"cover-0a1b2c3d.png\"}", 2000);
		assertTrue(s.ready() && s.playing());
		assertEquals("Utwór", s.title, "bez kodów kolorów");
		assertEquals("cover-0a1b2c3d.png", s.cover);
		assertEquals(62000, s.positionAt(2000));
		assertEquals(180000, s.positionAt(1_000_000), "nie dalej niż koniec");
		Spotify p = Spotify.parse("{\"state\":\"paused\",\"position\":5000,\"duration\":9000,\"at\":1000,\"cover\":\"../zle.png\"}", 3000);
		assertFalse(p.playing());
		assertEquals(5000, p.positionAt(9000), "pauza stoi");
		assertNull(p.cover, "zła nazwa okładki");
		assertSame(Spotify.OFF, Spotify.parse("{\"state\":\"playing\",\"at\":1}", 1 + Spotify.STALE_MS + 1), "stary plik: launcher zamknięty");
		assertTrue(Spotify.parse("{\"state\":\"unsupported\",\"at\":5}", 5).unsupported());
		assertEquals("off", Spotify.parse("{\"state\":\"hack\",\"at\":5}", 5).state);
		assertNull(Spotify.parse("zły", 0));
		assertEquals("1:01", Spotify.time(61000));
		assertEquals("0:00", Spotify.time(-5));
		assertEquals("1:02:03", Spotify.time(3723000));
	}
}
