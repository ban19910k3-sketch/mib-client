package pl.mibclient.mod.core;

/** Kategorie modułów w lewej kolumnie menu. */
public enum Category {
	HUD("HUD", "HUD", "layout"),
	PVP("PvP", "PvP", "sword"),
	LOOK("Wygląd", "Look", "sun"),
	WORLD("Świat", "World", "map"),
	CHAT("Czat i serwer", "Chat & server", "message"),
	OTHER("Inne", "Other", "archive");

	private final String pl, en;
	public final String icon;

	Category(String pl, String en, String icon) {
		this.pl = pl;
		this.en = en;
		this.icon = icon;
	}

	public String label() {
		return Lang.pl() ? pl : en;
	}
}
