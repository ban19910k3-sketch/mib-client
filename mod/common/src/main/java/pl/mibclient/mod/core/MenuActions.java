package pl.mibclient.mod.core;

import java.util.List;

/** To, czego menu potrzebuje od gry i launchera. */
public interface MenuActions {
	/** Otwiera edytor HUD; moduleId (może być null) to moduł, z którego ustawień przyszło polecenie. */
	void openHudEditor(String moduleId);

	/** Konta z launchera; pusta lista chowa przycisk „Zmień konto”. */
	List<Account> accounts();

	void switchAccount(String id);

	/** Komunikat po próbie zmiany konta albo null. */
	String switchMessage();

	/** Kosmetyki z profilu MiB albo null, gdy gra działa bez launchera (przycisk „Kosmetyki” jest wtedy schowany). */
	default Cosmetics cosmetics() {
		return null;
	}

	/** Zakłada (id) albo zdejmuje (id = null) kosmetyk danego typu. */
	default void equip(String type, String id) {
	}

	/** Komunikat po próbie zmiany kosmetyku albo null. */
	default String cosmeticMessage() {
		return null;
	}
}
