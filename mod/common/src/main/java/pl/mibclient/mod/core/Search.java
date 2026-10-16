package pl.mibclient.mod.core;

import java.text.Normalizer;
import java.util.Locale;

/** Wyszukiwarka modułów: bez wielkości liter i polskich znaków, każde słowo musi pasować. */
public final class Search {
	private Search() {
	}

	public static String normalize(String s) {
		String n = Normalizer.normalize(s.toLowerCase(Locale.ROOT), Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
		return n.replace('ł', 'l');
	}

	public static boolean matches(ModuleDef m, String query) {
		if (query == null) return true;
		String hay = normalize(m.name + " " + m.desc());
		for (String w : normalize(query).trim().split("\\s+")) {
			if (!w.isEmpty() && !hay.contains(w)) return false;
		}
		return true;
	}
}
