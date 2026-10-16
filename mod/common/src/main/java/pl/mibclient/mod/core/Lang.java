package pl.mibclient.mod.core;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/** Napisy menu po polsku, gdy gra jest po polsku (pl_*), a w każdym innym języku po angielsku. */
public final class Lang {
	private Lang() {
	}

	private static volatile boolean pl = true;
	private static final Map<String, String[]> T = new HashMap<String, String[]>();

	private static void put(String key, String pl, String en) {
		T.put(key, new String[] {pl, en});
	}

	static {
		put("menu.search", "Szukaj modułu…", "Search modules…");
		put("menu.enabled", "Włączone: %d z %d", "Enabled: %d of %d");
		put("menu.on", "WŁĄCZONY", "ENABLED");
		put("menu.off", "WYŁĄCZONY", "DISABLED");
		put("menu.all", "Wszystkie", "All");
		put("menu.edit_hud", "Edytuj HUD", "Edit HUD");
		put("menu.accounts", "Zmień konto", "Switch account");
		put("menu.blocked", "Zablokowane na tym serwerze", "Blocked on this server");
		put("menu.blocked_short", "Zablokowane", "Blocked");
		put("menu.back", "Wstecz", "Back");
		put("menu.place", "Ustaw na ekranie", "Place on screen");
		put("menu.empty", "Nie znaleziono modułów", "No modules found");
		put("menu.key_hint", "Klawisz zmienisz w Sterowaniu Minecrafta", "Change the key in Minecraft Controls");
		put("acc.active", "aktywne", "active");
		put("acc.switch", "Przełącz", "Switch");
		put("acc.working", "Zmieniam konto… gra uruchomi się ponownie.", "Switching account… the game will restart.");
		put("acc.failed", "Nie udało się zmienić konta: %s", "Couldn't switch account: %s");
		put("acc.hint", "Zmiana konta uruchamia grę ponownie.", "Switching accounts restarts the game.");
		put("hud.hint", "Przeciągnij elementy myszką. Kółko: rozmiar. Prawy przycisk: ustawienia.",
			"Drag elements with the mouse. Scroll: size. Right click: settings.");
		put("hud.reset", "Przywróć domyślne", "Reset to defaults");
		put("hud.done", "Gotowe", "Done");
		put("key.category", "MiB Client", "MiB Client");
		put("key.menu", "Menu MiB", "MiB menu");
		put("key.zoom", "Zoom", "Zoom");
		put("sprint.sprint", "Bieg (przełączony)", "Sprinting (toggled)");
		put("sprint.sneak", "Skradanie (przełączone)", "Sneaking (toggled)");
		put("sprint.running", "Bieg", "Sprinting");
	}

	/** Kod języka gry, np. "pl_pl" albo "en_us". */
	public static void setGame(String code) {
		pl = code != null && code.toLowerCase(Locale.ROOT).startsWith("pl");
	}

	public static boolean pl() {
		return pl;
	}

	public static String t(String key, Object... args) {
		String[] v = T.get(key);
		if (v == null) return key;
		String s = pl ? v[0] : v[1];
		return args.length == 0 ? s : String.format(Locale.ROOT, s, args);
	}
}
