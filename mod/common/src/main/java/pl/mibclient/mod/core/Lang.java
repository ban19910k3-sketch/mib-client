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
		put("menu.on", "Włączony", "Enabled");
		put("menu.off", "Wyłączony", "Disabled");
		put("menu.all", "Wszystkie", "All");
		put("menu.edit_hud", "Edytuj HUD", "Edit HUD");
		put("menu.accounts", "Zmień konto", "Switch account");
		put("menu.blocked", "Zablokowane na tym serwerze", "Blocked on this server");
		put("menu.blocked_short", "Zablokowane", "Blocked");
		put("menu.back", "Wstecz", "Back");
		put("menu.place", "Ustaw na ekranie", "Place on screen");
		put("menu.preview", "Podgląd", "Preview");
		put("menu.cosmetics", "Kosmetyki", "Cosmetics");
		put("cos.hint", "Założona peleryna jest widoczna na Twojej postaci w grze.", "Your equipped cape is shown on your character in game.");
		put("cos.login", "Załóż profil MiB w launcherze, żeby zbierać peleryny.", "Create a MiB profile in the launcher to collect capes.");
		put("cos.empty", "Nie masz jeszcze kosmetyków. Kody odbierzesz w launcherze (Kosmetyki).", "No cosmetics yet. Redeem codes in the launcher (Cosmetics).");
		put("cos.equip", "Załóż", "Equip");
		put("cos.unequip", "Zdejmij", "Take off");
		put("cos.on", "Założona", "Equipped");
		put("cos.soon", "Wkrótce w grze", "Coming to the game soon");
		put("cos.cape", "Peleryna", "Cape");
		put("cos.hat", "Czapka", "Hat");
		put("cos.wings", "Skrzydła", "Wings");
		put("cos.working", "Zmieniam…", "Changing…");
		put("cos.failed", "Nie udało się: %s", "Failed: %s");
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
		put("hud.reach", "Zasięg: %s", "Reach: %s");
		put("hud.stopwatch", "Stoper: %s", "Stopwatch: %s");
		put("hud.totems", "Totemy: %d", "Totems: %d");
		put("hud.popped", "%s: −%d totem", "%s: −%d totem");
		put("hud.attack", "Atak: %d%%", "Attack: %d%%");
		put("hud.no_packs", "Bez paczek zasobów", "No resource packs");
		put("jump.perfect", "Jump reset: idealny", "Jump reset: perfect");
		put("jump.late", "Jump reset: za późno (%d t)", "Jump reset: too late (%d t)");
		put("jump.early", "Jump reset: za wcześnie (%d t)", "Jump reset: too early (%d t)");
		put("jump.none", "Jump reset: bez skoku", "Jump reset: no jump");
		put("key.stopwatch", "Stoper", "Stopwatch");
		put("hud.death", "Śmierć: %s", "Death: %s");
		put("hud.horse_speed", "Prędkość: %s m/s", "Speed: %s m/s");
		put("hud.horse_jump", "Skok: %s bl.", "Jump: %s blocks");
		put("hud.horse_health", "Zdrowie: %s/%s", "Health: %s/%s");
		put("reconnect", "Połącz ponownie", "Reconnect");
		put("item.durability", "Wytrzymałość: %d / %d", "Durability: %d / %d");
		put("drop.blocked", "Drop prevention: %s zostaje w ekwipunku", "Drop prevention: %s stays in your inventory");
		put("reconnect.in", "Połącz ponownie (%d)", "Reconnect (%d)");

	}

	/** Język wybrany w menu: "pl", "en" albo null (jak język gry). */
	private static volatile String chosen;

	/** Kod języka gry, np. "pl_pl" albo "en_us". */
	public static void setGame(String code) {
		pl = code != null && code.toLowerCase(Locale.ROOT).startsWith("pl");
	}

	/** Język menu i HUD: "pl", "en" albo "auto" (jak gra). */
	public static void choose(String code) {
		chosen = "pl".equals(code) || "en".equals(code) ? code : null;
	}

	public static String chosen() {
		return chosen == null ? "auto" : chosen;
	}

	public static boolean pl() {
		return chosen != null ? "pl".equals(chosen) : pl;
	}

	public static String t(String key, Object... args) {
		String[] v = T.get(key);
		if (v == null) return key;
		String s = pl() ? v[0] : v[1];
		return args.length == 0 ? s : String.format(Locale.ROOT, s, args);
	}
}
