package pl.mibclient.mod.core;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class LangTest {
	@AfterEach
	void reset() {
		Lang.setGame("pl_pl");
	}

	@Test
	void polishForPlCodes() {
		Lang.setGame("pl_pl");
		assertTrue(Lang.pl());
		assertEquals("Szukaj modułu…", Lang.t("menu.search"));
		assertEquals("Włączone: 3 z 16", Lang.t("menu.enabled", 3, 16));
		Lang.setGame("en_us");
		assertFalse(Lang.pl());
		assertEquals("Search modules…", Lang.t("menu.search"));
		assertEquals("Enabled: 3 of 16", Lang.t("menu.enabled", 3, 16));
		assertEquals("no.such.key", Lang.t("no.such.key"));
		Lang.setGame(null);
		assertFalse(Lang.pl());
	}

	@Test
	void categoryLabels() {
		Lang.setGame("pl_pl");
		assertEquals("Czat i serwer", Category.CHAT.label());
		Lang.setGame("en_gb");
		assertEquals("Chat & server", Category.CHAT.label());
	}
}
