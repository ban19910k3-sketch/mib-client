package pl.mibclient.mod.core;

import static org.junit.jupiter.api.Assertions.*;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.Test;

class ChatSenderTest {
	private static final List<String> MIB = Arrays.asList("Steve", "Ban_19");

	@Test
	void vanillaChatPutsBadgeBeforeBracket() {
		assertEquals(0, ChatSender.badgeAt("<Steve> siema", MIB));
		assertEquals(-1, ChatSender.badgeAt("<Alex> siema Steve", MIB), "nick gracza MiB w treści cudzej wiadomości");
	}

	@Test
	void serverFormatsWithRanksAndSeparators() {
		assertEquals(6, ChatSender.badgeAt("[VIP] Steve: gg", MIB));
		assertEquals(8, ChatSender.badgeAt("[Gracz] Ban_19 » elo", MIB));
		assertEquals(8, ChatSender.badgeAt("[12:30] Steve: hej", MIB), "godzina z dwukropkiem bez spacji to nie separator");
		assertEquals(0, ChatSender.badgeAt("steve > hej", MIB), "wielkość liter bez znaczenia");
	}

	@Test
	void onlyWholeNamesBeforeTheSeparator() {
		assertEquals(-1, ChatSender.badgeAt("Steve123: hej", MIB));
		assertEquals(-1, ChatSender.badgeAt("Steve dołączył do gry", MIB), "bez separatora to nie wiadomość gracza");
		assertEquals(-1, ChatSender.badgeAt("Alex: Steve: hej", MIB));
		assertEquals(-1, ChatSender.badgeAt("<Steve> hej", Collections.<String>emptyList()));
		assertEquals(-1, ChatSender.badgeAt("", MIB));
		assertEquals(-1, ChatSender.badgeAt("[Steve: Ustawiono tryb gry]", MIB), "komunikat komendy w nawiasie");
	}

	@Test
	void senderClosestToSeparatorWins() {
		assertEquals(14, ChatSender.badgeAt("[Klan Ban_19] Steve: hej", MIB));
		assertEquals(6, ChatSender.badgeAt("[Klan Ban_19] Alex: hej", MIB), "jedyny nick MiB przed separatorem");
	}
}
