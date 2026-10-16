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
}
