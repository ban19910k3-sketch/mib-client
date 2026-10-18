package pl.mibclient.mod.core;

import java.util.Collection;
import java.util.Locale;

/**
 * Logo MiB przy nicku na czacie: szuka nadawcy wiadomości wśród nicków graczy MiB. Serwery formatują czat po swojemu
 * („&lt;Nick&gt; tekst”, „[Ranga] Nick: tekst”, „Nick » tekst”), więc nadawca to nick przed pierwszym separatorem
 * (najbliższy separatora). Wiadomości bez separatora (dołączenie do gry, śmierć) nie dostają logo.
 */
public final class ChatSender {
	private ChatSender() {
	}

	private static final String[] SEPARATORS = {": ", "> ", "» ", "→ "};
	/** Dłuższy początek to już nie ranga i nick, tylko zwykły tekst z dwukropkiem. */
	private static final int MAX_HEADER = 64;

	/** Miejsce w tekście wiadomości na logo MiB (przed nickiem nadawcy albo przed „&lt;” w czacie bez pluginów) albo -1. */
	public static int badgeAt(String text, Collection<String> names) {
		if (text == null || names.isEmpty()) return -1;
		int end = -1;
		for (String s : SEPARATORS) {
			int i = text.indexOf(s);
			if (i > 0 && (end < 0 || i < end)) end = i;
		}
		if (end < 0 || end > MAX_HEADER) return -1;
		String head = text.substring(0, end).toLowerCase(Locale.ROOT);
		int best = -1;
		for (String n : names) {
			if (n == null || n.isEmpty()) continue;
			String name = n.toLowerCase(Locale.ROOT);
			for (int i = head.indexOf(name); i >= 0; i = head.indexOf(name, i + 1)) {
				// „[Nick: …]” to komunikat komendy, nie wiadomość gracza
				boolean command = i > 0 && head.charAt(i - 1) == '[' && i + name.length() == end;
				if (!command && !nameChar(head, i - 1) && !nameChar(head, i + name.length()) && i > best) best = i;
			}
		}
		return best > 0 && text.charAt(best - 1) == '<' ? best - 1 : best;
	}

	private static boolean nameChar(String s, int i) {
		if (i < 0 || i >= s.length()) return false;
		char c = s.charAt(i);
		return c == '_' || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9');
	}
}
