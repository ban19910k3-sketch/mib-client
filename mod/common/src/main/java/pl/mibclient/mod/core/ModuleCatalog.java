package pl.mibclient.mod.core;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import pl.mibclient.mod.core.Setting.BoolSetting;
import pl.mibclient.mod.core.Setting.ChoiceSetting;
import pl.mibclient.mod.core.Setting.ColorSetting;
import pl.mibclient.mod.core.Setting.IntSetting;

/** Moduły etapów 1 i 2 (spec: docs/superpowers/specs/2026-10-16-mib-mod-design.md) i logo MiB przy nicku. */
public final class ModuleCatalog {
	private ModuleCatalog() {
	}

	private static HudPos at(Anchor a, int x, int y) {
		return new HudPos(a, x, y, 1.0);
	}

	private static BoolSetting bool(String key, String pl, String en, boolean def) {
		return new BoolSetting(key, pl, en, def);
	}

	/** Opcje wyglądu wspólne dla każdego modułu HUD, a za nimi opcje modułu. */
	private static List<Setting<?>> hud(Setting<?>... own) {
		return hudColor(0xFFFFFFFF, own);
	}

	private static List<Setting<?>> hudColor(int color, Setting<?>... own) {
		List<Setting<?>> l = new ArrayList<Setting<?>>(Arrays.asList(own));
		l.add(bool("background", "Tło", "Background", true));
		l.add(bool("shadow", "Cień tekstu", "Text shadow", true));
		l.add(new ColorSetting("color", "Kolor tekstu", "Text colour", color));
		return l;
	}

	private static List<Setting<?>> list(Setting<?>... s) {
		return new ArrayList<Setting<?>>(Arrays.asList(s));
	}

	public static final List<ModuleDef> ALL = Collections.unmodifiableList(Arrays.asList(
		new ModuleDef("keystrokes", "Keystrokes", Category.HUD,
			"Wciśnięte WASD, spacja i przyciski myszy z CPS", "Pressed WASD, space and mouse buttons with CPS",
			"keyboard", true, at(Anchor.TOP_LEFT, 4, 4), hud(
				bool("space", "Pokaż spację", "Show space bar", false),
				bool("mouse", "Pokaż przyciski myszy", "Show mouse buttons", true),
				bool("mouse_cps", "CPS pod przyciskami myszy", "CPS under mouse buttons", true),
				new ColorSetting("pressed", "Kolor wciśnięcia", "Pressed colour", Theme.AM_HI))),
		new ModuleDef("fps", "FPS", Category.HUD, "Klatki na sekundę", "Frames per second",
			"speed-fast", true, at(Anchor.TOP_LEFT, 4, 80), hud(
				new ChoiceSetting("style", "Wygląd", "Style", "label_first", new String[] {"label_first", "number_first"},
					new String[] {"FPS: 240", "240 FPS"}, new String[] {"FPS: 240", "240 FPS"}))),
		new ModuleDef("cps", "CPS", Category.HUD, "Kliknięcia na sekundę (lewy i prawy)", "Clicks per second (left and right)",
			"mouse", true, at(Anchor.TOP_LEFT, 4, 96), hud(
				bool("right", "Pokaż prawy przycisk", "Show right button", true))),
		new ModuleDef("ping", "Ping", Category.HUD, "Opóźnienie do serwera", "Latency to the server",
			"wifi", false, at(Anchor.TOP_LEFT, 4, 112), hud(
				bool("quality_color", "Kolor wg jakości", "Colour by quality", true))),
		new ModuleDef("coordinates", "Coordinates", Category.HUD, "Pozycja X, Y i Z pod sobą", "X, Y and Z position, one under another",
			"map-pin", false, at(Anchor.TOP_LEFT, 4, 128), hud(
				bool("facing", "Pokaż kierunek", "Show facing", false),
				bool("biome", "Pokaż biom", "Show biome", false),
				new IntSetting("decimals", "Miejsca po przecinku", "Decimal places", 0, 0, 1, 1))),
		new ModuleDef("server_address", "Server address", Category.HUD, "Adres serwera na HUD", "Server address on the HUD",
			"cloud-server", false, at(Anchor.TOP_LEFT, 4, 170), hud(
				bool("port", "Pokaż port", "Show port", false))),
		new ModuleDef("playtime", "Playtime", Category.HUD, "Czas tej sesji gry", "Time played this session",
			"hourglass", false, at(Anchor.TOP_LEFT, 4, 186), hud()),
		new ModuleDef("direction", "Direction", Category.HUD, "Kompas N/E/S/W u góry ekranu", "N/E/S/W compass at the top of the screen",
			"compass", false, at(Anchor.TOP, 0, 4), hud(
				new ChoiceSetting("style", "Wygląd", "Style", "strip", new String[] {"strip", "letter"},
					new String[] {"Pasek", "Litera"}, new String[] {"Strip", "Letter"}))),
		new ModuleDef("time", "Time", Category.HUD, "Godzina z zegara komputera", "Time from your computer clock",
			"clock", false, at(Anchor.TOP_RIGHT, 4, 4), hud(
				bool("h24", "Format 24-godzinny", "24-hour format", true),
				bool("seconds", "Pokaż sekundy", "Show seconds", false))),
		new ModuleDef("potion_effects", "Potion effects", Category.HUD, "Aktywne mikstury z czasem", "Active potion effects with time left",
			"potion", false, at(Anchor.RIGHT, 4, 0), hud(
				bool("icons", "Pokaż ikony", "Show icons", true),
				bool("names", "Pokaż nazwy", "Show names", true))),
		new ModuleDef("armor_status", "Armor status", Category.HUD, "Zbroja i trzymany przedmiot z wytrzymałością (tylko rzeczy, które się zużywają)",
			"Worn armour and held item with durability (only items that wear out)", "shield", false, at(Anchor.BOTTOM_RIGHT, 4, 4), hud(
				bool("held", "Pokaż przedmiot w ręce", "Show held item", true),
				bool("percent", "Wytrzymałość w procentach", "Durability as percentage", false),
				new ChoiceSetting("layout", "Układ", "Layout", "vertical", new String[] {"vertical", "horizontal"},
					new String[] {"Pionowo", "Poziomo"}, new String[] {"Vertical", "Horizontal"}))),
		new ModuleDef("toggle_sprint", "Toggle sprint", Category.PVP, "Bieg i skradanie bez trzymania klawisza",
			"Sprint and sneak without holding the key", "zap", false, at(Anchor.TOP_LEFT, 4, 202), hud(
				bool("sprint", "Przełączany bieg", "Toggle sprint", true),
				bool("sneak", "Przełączane skradanie", "Toggle sneak", false),
				bool("show", "Pokaż stan na ekranie", "Show status on screen", true))),
		new ModuleDef("zoom", "Zoom", Category.PVP, "Przybliżenie pod klawiszem (domyślnie C), kółkiem bliżej i dalej",
			"Zoom while holding a key (C by default), scroll to adjust", "zoom-in", true, null, list(
				new IntSetting("factor", "Przybliżenie (x)", "Zoom level (x)", 4, 2, 50, 1),
				bool("scroll", "Kółko myszy zmienia przybliżenie", "Scroll changes zoom", true),
				bool("smooth", "Płynne przybliżenie", "Smooth zoom", true),
				bool("cinematic", "Płynna kamera podczas zoomu", "Smooth camera while zoomed", false))),
		new ModuleDef("custom_crosshair", "Custom crosshair", Category.PVP, "Własny celownik: kształt, kolor, rozmiar, kropka",
			"Your own crosshair: shape, colour, size, dot", "frame", false, null, list(
				new ChoiceSetting("shape", "Kształt", "Shape", "plus", new String[] {"plus", "dot", "circle", "x", "square"},
					new String[] {"Plus", "Kropka", "Okrąg", "Iks", "Kwadrat"}, new String[] {"Plus", "Dot", "Circle", "X", "Square"}),
				new IntSetting("size", "Rozmiar", "Size", 5, 1, 15, 1),
				new IntSetting("thickness", "Grubość", "Thickness", 1, 1, 4, 1),
				new IntSetting("gap", "Odstęp od środka", "Gap", 2, 0, 6, 1),
				bool("dot", "Kropka na środku", "Centre dot", false),
				bool("outline", "Czarna obwódka", "Black outline", true),
				new ColorSetting("color", "Kolor", "Colour", 0xFFFFFFFF))),
		new ModuleDef("perspective", "Perspective", Category.LOOK, "Kamera 360° wokół postaci pod klawiszem (domyślnie lewy Alt), postać dalej patrzy przed siebie",
			"360° camera around your character while holding a key (left Alt by default), your character keeps looking ahead", "rotate-360", false, null, list(
				bool("hold", "Trzymaj klawisz (wyłączone: naciśnij, żeby włączyć i wyłączyć)", "Hold the key (off: press to turn on and off)", true))),
		new ModuleDef("fov_changer", "FOV changer", Category.LOOK, "Własne pole widzenia, bez zmian przy biegu i miksturach szybkości",
			"Custom field of view, no changes from sprinting or speed potions", "eye", false, null, list(
				new IntSetting("fov", "Pole widzenia", "Field of view", 90, 30, 110, 1),
				bool("no_effects", "Bez zmian przy biegu i miksturach", "No change from sprint or potions", true))),
		new ModuleDef("brightness", "Brightness", Category.LOOK, "Pełna jasność (fullbright)", "Full brightness (fullbright)",
			"sun", false, null, list(
				new IntSetting("level", "Jasność (%)", "Brightness (%)", 100, 0, 100, 5))),

		// ===== Etap 2: HUD i PvP =====
		new ModuleDef("armor_bar", "Armor bar", Category.HUD, "Pasek pancerza w kolorach materiału założonej zbroi",
			"Armour bar in the colours of your armour material", "shield-sharp", false, at(Anchor.BOTTOM, -46, 58), hud(
				bool("empty", "Pokaż puste pola", "Show empty slots", true),
				bool("number", "Liczba punktów obok", "Number of points next to it", false))),
		new ModuleDef("hearts", "Hearts", Category.HUD, "Zdrowie liczbą i serca absorpcji", "Health as a number and absorption hearts",
			"heart", false, at(Anchor.BOTTOM, -128, 22), hudColor(0xFFFF5555,
				bool("absorption", "Pokaż absorpcję (złote serca)", "Show absorption (golden hearts)", true),
				bool("max", "Pokaż maksimum", "Show maximum", false))),
		new ModuleDef("saturation", "Saturation", Category.HUD, "Nasycenie i głód liczbami", "Saturation and hunger as numbers",
			"apple", false, at(Anchor.BOTTOM, 128, 22), hudColor(0xFFFFC857,
				bool("food", "Pokaż głód", "Show hunger", true))),
		new ModuleDef("item_counter", "Item counter", Category.HUD, "Liczba strzał, pereł, złotych jabłek i innych przedmiotów w ekwipunku",
			"How many arrows, pearls, golden apples and more you carry", "backpack", false, at(Anchor.LEFT, 4, 0), hud(
				bool("arrows", "Strzały", "Arrows", true),
				bool("pearls", "Perły Endu", "Ender pearls", true),
				bool("gapples", "Złote jabłka", "Golden apples", true),
				bool("totems", "Totemy", "Totems", true),
				bool("potions", "Mikstury", "Potions", false),
				bool("xp", "Butelki z doświadczeniem", "Bottles o' enchanting", false),
				bool("webs", "Pajęczyny", "Cobwebs", false),
				bool("wind", "Ładunki wiatru", "Wind charges", false),
				new ChoiceSetting("layout", "Układ", "Layout", "vertical", new String[] {"vertical", "horizontal"},
					new String[] {"Pionowo", "Poziomo"}, new String[] {"Vertical", "Horizontal"}))),
		new ModuleDef("mousestrokes", "Mousestrokes", Category.HUD, "Ruch myszy pokazany na HUD", "Mouse movement shown on the HUD",
			"cursor-minimal", false, at(Anchor.TOP_LEFT, 78, 4), hud(
				new IntSetting("sensitivity", "Czułość", "Sensitivity", 5, 1, 10, 1))),
		new ModuleDef("pack_display", "Pack display", Category.HUD, "Nazwy włączonych paczek zasobów", "Names of your enabled resource packs",
			"image", false, at(Anchor.BOTTOM_LEFT, 4, 4), hud(
				new IntSetting("max", "Najwięcej paczek", "Most packs", 3, 1, 10, 1))),
		new ModuleDef("player_model", "Player model", Category.HUD, "Twoja postać na HUD", "Your character on the HUD",
			"human", false, at(Anchor.BOTTOM_LEFT, 4, 24), list(
				new IntSetting("size", "Rozmiar", "Size", 30, 15, 60, 5),
				bool("background", "Tło", "Background", false))),
		new ModuleDef("speed_meter", "Speed meter", Category.HUD, "Prędkość ruchu w blokach na sekundę", "Movement speed in blocks per second",
			"speed-medium", false, at(Anchor.TOP_RIGHT, 4, 20), hud(
				bool("vertical", "Licz też ruch w górę i w dół", "Include up and down movement", false),
				new IntSetting("decimals", "Miejsca po przecinku", "Decimal places", 2, 0, 3, 1))),
		new ModuleDef("stopwatch", "Stopwatch", Category.HUD, "Stoper pod klawiszem (domyślnie J): start od zera albo stop",
			"Stopwatch on a key (J by default): start from zero or stop", "alarm-clock", false, at(Anchor.TOP, 0, 24), hud()),
		new ModuleDef("system_resources", "System resources", Category.HUD, "Użycie procesora i pamięci przez grę", "CPU and memory used by the game",
			"cpu", false, at(Anchor.TOP_RIGHT, 4, 36), hud(
				bool("cpu", "Procesor", "CPU", true),
				bool("ram", "Pamięć", "Memory", true))),
		new ModuleDef("tps", "TPS", Category.HUD, "Szacowana wydajność serwera (20 = bez lagów)", "Estimated server performance (20 = no lag)",
			"server", false, at(Anchor.TOP_RIGHT, 4, 66), hud(
				bool("quality_color", "Kolor wg jakości", "Colour by quality", true))),
		new ModuleDef("attack_indicator", "Attack indicator", Category.PVP, "Gotowość ataku jako pasek albo procent pod celownikiem",
			"Attack readiness as a bar or percentage under the crosshair", "target", false, at(Anchor.CENTER, 0, 14), hud(
				new ChoiceSetting("style", "Wygląd", "Style", "bar", new String[] {"bar", "percent"},
					new String[] {"Pasek", "Procent"}, new String[] {"Bar", "Percentage"}),
				bool("only_charging", "Tylko podczas ładowania", "Only while charging", true))),
		new ModuleDef("combo_display", "Combo display", Category.PVP, "Licznik trafień z rzędu, zanim przeciwnik Cię trafi",
			"Hits in a row before the opponent hits you", "trending-up", false, at(Anchor.TOP_RIGHT, 4, 82), hud(
				bool("hide_zero", "Ukryj, gdy brak combo", "Hide without a combo", true))),
		new ModuleDef("damage_indicator", "Damage indicator", Category.PVP, "Zdrowie celu i zadane mu obrażenia",
			"Your target's health and the damage you dealt", "skull", false, at(Anchor.CENTER, 0, -48), hud(
				bool("damage", "Pokaż zadane obrażenia", "Show damage dealt", true))),
		new ModuleDef("hit_indicator", "Hit indicator", Category.PVP, "Znacznik przy celowniku i dźwięk, gdy trafisz przeciwnika",
			"Marker at the crosshair and a sound when you hit an opponent", "x", false, null, list(
				bool("sound", "Dźwięk trafienia", "Hit sound", true),
				new ColorSetting("color", "Kolor znacznika", "Marker colour", 0xFFFF5555))),
		new ModuleDef("jump_reset", "Jump reset", Category.PVP, "Podpowiedź, czy skok po otrzymaniu ciosu był w dobrym momencie (bez automatu)",
			"Tells you if your jump after getting hit was on time (no automation)", "arrow-big-up", false, at(Anchor.CENTER, 0, 28), hud()),
		new ModuleDef("reach_display", "Reach display", Category.PVP, "Odległość ostatniego trafienia w blokach", "Distance of your last hit in blocks",
			"arrows-horizontal", false, at(Anchor.TOP_RIGHT, 4, 98), hud(
				new IntSetting("decimals", "Miejsca po przecinku", "Decimal places", 2, 1, 3, 1))),
		new ModuleDef("totem", "Totem", Category.PVP, "Twoje totemy i totemy zużyte przez przeciwników",
			"Your totems and totems used up by opponents", "trophy", false, at(Anchor.TOP_RIGHT, 4, 114), hud(
				bool("pops", "Totemy przeciwników", "Opponents' totems", true))),

		// ===== Gracze MiB =====
		new ModuleDef("mib_badge", "MiB players", Category.OTHER, "Logo MiB przed nickiem graczy MiB (nad głową i w Tab) i ich peleryny",
			"MiB logo before the names of MiB players (above heads and in Tab) and their capes", "user", true, null, list(
				bool("capes", "Peleryny innych graczy MiB", "Other MiB players' capes", true)))));

	/** Grupy przedmiotów dla Item counter: klucz opcji i id przedmiotów z gry. */
	public static final String[][] ITEM_GROUPS = {
		{"arrows", "minecraft:arrow", "minecraft:spectral_arrow", "minecraft:tipped_arrow"},
		{"pearls", "minecraft:ender_pearl"},
		{"gapples", "minecraft:golden_apple", "minecraft:enchanted_golden_apple"},
		{"totems", "minecraft:totem_of_undying"},
		{"potions", "minecraft:splash_potion", "minecraft:lingering_potion", "minecraft:potion"},
		{"xp", "minecraft:experience_bottle"},
		{"webs", "minecraft:cobweb"},
		{"wind", "minecraft:wind_charge"},
	};

	public static ModuleDef get(String id) {
		for (ModuleDef m : ALL) if (m.id.equals(id)) return m;
		return null;
	}
}
