package pl.mibclient.mod.core;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import pl.mibclient.mod.core.Setting.BoolSetting;
import pl.mibclient.mod.core.Setting.ChoiceSetting;
import pl.mibclient.mod.core.Setting.ColorSetting;
import pl.mibclient.mod.core.Setting.IntSetting;
import pl.mibclient.mod.core.Setting.TextSetting;

/** Moduły menu pod prawym Shiftem (lista ze spec: docs/superpowers/specs/2026-10-16-mib-mod-design.md, bez Jump reset; Nametags i Screenshot działają zawsze, poza menu). */
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
		new ModuleDef("auto_sprint", "Auto sprint", Category.PVP, "Biegasz zawsze, gdy idziesz do przodu (bez trzymania klawisza biegu)",
			"You always sprint while walking forward (no need to hold the sprint key)", "zap", false, null, list()),
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
		new ModuleDef("saturation", "Saturation", Category.HUD, "Nasycenie na ikonach jedzenia nad paskiem przedmiotów: lekko pomarańczowe, maleje razem z nasyceniem",
			"Saturation on the hunger icons above the hotbar: light orange, shrinks as saturation drops", "apple", false, null, list(
				new ColorSetting("color", "Kolor", "Colour", 0xFFFFB24D))),
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
		new ModuleDef("reach_display", "Reach display", Category.PVP, "Odległość ostatniego trafienia w blokach", "Distance of your last hit in blocks",
			"arrows-horizontal", false, at(Anchor.TOP_RIGHT, 4, 98), hud(
				new IntSetting("decimals", "Miejsca po przecinku", "Decimal places", 2, 1, 3, 1))),
		new ModuleDef("player_overlay", "Player overlay", Category.PVP, "Zdrowie graczy obok ich nicku nad głową",
			"Players' health next to their name above their head", "users", false, null, list(
				new IntSetting("radius", "Zasięg (bloki)", "Range (blocks)", 32, 4, 64, 4),
				bool("mobs", "Także zdrowie nad mobami", "Health above mobs too", false))),
		new ModuleDef("totem", "Totem", Category.PVP, "Twoje totemy i totemy zużyte przez przeciwników",
			"Your totems and totems used up by opponents", "trophy", false, at(Anchor.TOP_RIGHT, 4, 114), hud(
				bool("pops", "Totemy przeciwników", "Opponents' totems", true))),

		// ===== Etap 3: wygląd i kamera =====
		new ModuleDef("boss_bar", "Boss bar", Category.HUD, "Ukrycie, rozmiar i położenie paska bossa", "Hide, resize or move the boss bar",
			"crown", false, null, list(
				bool("hide", "Ukryj pasek bossa", "Hide the boss bar", true),
				new IntSetting("scale", "Rozmiar (%)", "Size (%)", 100, 50, 150, 10),
				new IntSetting("offset_y", "Przesunięcie w dół", "Move down", 0, 0, 100, 5))),
		new ModuleDef("scoreboard", "Scoreboard", Category.HUD, "Ukrycie, rozmiar i położenie tabeli wyników z boku ekranu",
			"Hide, resize or move the scoreboard on the side of the screen", "bulletlist", false, null, list(
				bool("hide", "Ukryj tabelę wyników", "Hide the scoreboard", true),
				bool("hide_numbers", "Ukryj czerwone liczby", "Hide the red numbers", false),
				new IntSetting("scale", "Rozmiar (%)", "Size (%)", 100, 50, 150, 10),
				new IntSetting("offset_y", "Przesunięcie w pionie", "Move vertically", 0, -100, 100, 5))),
		new ModuleDef("title_tweaker", "Title tweaker", Category.HUD, "Rozmiar i położenie tytułów na środku ekranu",
			"Size and position of the titles in the middle of the screen", "heading", false, null, list(
				bool("hide", "Ukryj tytuły", "Hide titles", false),
				new IntSetting("scale", "Rozmiar (%)", "Size (%)", 70, 30, 150, 10),
				new IntSetting("offset_y", "Przesunięcie w pionie", "Move vertically", 0, -100, 100, 5))),
		new ModuleDef("subtitles", "Subtitles", Category.HUD, "Rozmiar i położenie napisów do dźwięków (włączasz je w ustawieniach gry)",
			"Size and position of sound subtitles (turn them on in the game settings)", "badge-captions", false, null, list(
				new IntSetting("scale", "Rozmiar (%)", "Size (%)", 100, 50, 150, 10),
				new IntSetting("offset_y", "Przesunięcie w górę", "Move up", 0, 0, 150, 5))),
		new ModuleDef("autohide_hud", "Autohide HUD", Category.HUD, "Chowa HUD MiB, gdy masz otwarty ekwipunek lub inne menu gry",
			"Hides the MiB HUD while the inventory or another game menu is open", "eye-off", false, null, list(
				bool("chat", "Także przy pisaniu na czacie", "Also while typing in chat", false))),
		new ModuleDef("toast_control", "Toast control", Category.HUD, "Wyłącza wyskakujące powiadomienia (przepisy, osiągnięcia)",
			"Turns off pop-up notifications (recipes, advancements)", "bell-off", false, null, list(
				bool("recipes", "Ukryj nowe przepisy", "Hide new recipes", true),
				bool("advancements", "Ukryj osiągnięcia", "Hide advancements", false),
				bool("tutorial", "Ukryj podpowiedzi samouczka", "Hide tutorial hints", true),
				bool("system", "Ukryj komunikaty systemowe", "Hide system messages", false))),
		new ModuleDef("camera", "Camera", Category.LOOK, "Bez bujania kamery przy chodzeniu i własna odległość kamery w trzeciej osobie",
			"No view bobbing and your own third-person camera distance", "camera", false, null, list(
				bool("no_bob", "Bez bujania kamery", "No view bobbing", true),
				new IntSetting("distance", "Odległość w trzeciej osobie", "Third-person distance", 4, 1, 16, 1))),
		new ModuleDef("snaplook", "Snaplook", Category.LOOK, "Szybki podgląd za siebie pod klawiszem (domyślnie Z)",
			"Quick look behind you while holding a key (Z by default)", "undo", false, null, list()),
		new ModuleDef("auto_perspective", "Auto perspective", Category.LOOK, "Sam przełącza na trzecią osobę przy lataniu elytrą i jeździe konnej",
			"Switches to third person while flying with an elytra or riding", "shuffle", false, null, list(
				bool("elytra", "Przy lataniu elytrą", "While flying with an elytra", true),
				bool("riding", "Przy jeździe (koń, łódka…)", "While riding (horse, boat…)", true))),
		new ModuleDef("viewmodel", "Viewmodel", Category.LOOK, "Położenie i rozmiar ręki i przedmiotu w pierwszej osobie",
			"Position and size of your hand and held item in first person", "hand", false, null, list(
				new IntSetting("x", "W bok", "Sideways", 0, -20, 20, 1),
				new IntSetting("y", "W górę", "Up", 0, -20, 20, 1),
				new IntSetting("z", "Do przodu", "Forward", 0, -20, 20, 1),
				new IntSetting("scale", "Rozmiar (%)", "Size (%)", 100, 50, 150, 5))),
		new ModuleDef("weather_changer", "Weather changer", Category.LOOK, "Własna pogoda (tylko u Ciebie)", "Your own weather (only for you)",
			"cloud-sun", false, null, list(
				new ChoiceSetting("weather", "Pogoda", "Weather", "clear", new String[] {"clear", "rain", "thunder"},
					new String[] {"Słońce", "Deszcz", "Burza"}, new String[] {"Clear", "Rain", "Thunder"}))),
		new ModuleDef("time_changer", "Time changer", Category.LOOK, "Własna pora dnia (tylko u Ciebie)", "Your own time of day (only for you)",
			"moon", false, null, list(
				new ChoiceSetting("time", "Pora dnia", "Time of day", "noon", new String[] {"morning", "noon", "sunset", "night", "midnight"},
					new String[] {"Rano", "Południe", "Zachód słońca", "Wieczór", "Północ"},
					new String[] {"Morning", "Noon", "Sunset", "Evening", "Midnight"}))),
		new ModuleDef("inventory", "Inventory", Category.LOOK, "Ekwipunek i skrzynie bez przyciemnienia gry w tle",
			"Inventory and chests without darkening the game behind them", "backpack", false, null, list()),

		// ===== Etap 4: świat, przedmioty, czat i narzędzia =====
		new ModuleDef("block_indicator", "Block indicator", Category.WORLD, "Nazwa bloku, na który patrzysz", "Name of the block you are looking at",
			"blocks", false, at(Anchor.TOP, 0, 44), hud()),
		new ModuleDef("death_info", "Death info", Category.WORLD, "Miejsce ostatniej śmierci (przez 5 minut)", "Where you last died (for 5 minutes)",
			"road-sign", false, at(Anchor.TOP_LEFT, 4, 218), hud()),
		new ModuleDef("horses", "Horses", Category.WORLD, "Prędkość, skok i zdrowie konia, na którym jedziesz", "Speed, jump and health of the horse you ride",
			"speed-slow", false, at(Anchor.LEFT, 4, 40), hud()),
		new ModuleDef("tnt_timer", "TNT timer", Category.WORLD, "Odliczanie nad zapalonym TNT", "Countdown above lit TNT",
			"bomb", false, null, list()),
		new ModuleDef("item_despawn", "Item despawn", Category.WORLD, "Czas do zniknięcia leżących przedmiotów (od kiedy je widzisz)",
			"Time until dropped items disappear (since you first saw them)", "trash", false, null, list(
				new IntSetting("radius", "Zasięg (bloki)", "Range (blocks)", 8, 4, 32, 2))),
		new ModuleDef("tablist", "Tablist", Category.CHAT, "Ping liczbami na liście graczy (Tab)", "Ping as numbers in the player list (Tab)",
			"list-box", true, null, list()),
		new ModuleDef("custom_chat", "Custom chat", Category.CHAT, "Godzina przy wiadomościach i dłuższa historia czatu",
			"Time next to messages and a longer chat history", "message", false, null, list(
				bool("time", "Godzina przy wiadomościach", "Time next to messages", true),
				bool("seconds", "Z sekundami", "With seconds", false),
				bool("long_history", "Dłuższa historia (500 wiadomości)", "Longer history (500 messages)", true))),
		new ModuleDef("reconnect", "Reconnect", Category.CHAT, "Przycisk „Połącz ponownie” po rozłączeniu i automatyczne łączenie",
			"A Reconnect button after a disconnect and automatic reconnecting", "reload", true, null, list(
				bool("auto", "Łącz automatycznie", "Reconnect automatically", false),
				new IntSetting("delay", "Po ilu sekundach", "After how many seconds", 5, 3, 30, 1))),
		new ModuleDef("item_info", "Item info", Category.OTHER, "Wytrzymałość przedmiotów liczbami w ich opisie",
			"Item durability as numbers in the item tooltip", "info-box", true, null, list()),
		new ModuleDef("drop_prevention", "Drop prevention", Category.OTHER, "Nie wyrzucisz przez przypadek cennych przedmiotów (Q i w ekwipunku)",
			"You won't drop valuable items by accident (Q and in the inventory)", "lock", false, null, list(
				bool("gear", "Diamentowe i netherytowe, elytra, trójząb, buława", "Diamond and netherite, elytra, trident, mace", true),
				bool("enchanted", "Zaklęte przedmioty", "Enchanted items", true),
				bool("totem", "Totemy", "Totems", true),
				bool("shulker", "Shulkery", "Shulker boxes", true))),
		new ModuleDef("backups", "Backups", Category.OTHER, "Kopia świata jednoosobowego po wyjściu z niego (folder mib/backups)",
			"A backup of your singleplayer world when you leave it (mib/backups folder)", "save", false, null, list(
				new IntSetting("keep", "Ile kopii trzymać", "How many backups to keep", 3, 1, 10, 1))),
		new ModuleDef("cull_logs", "Cull logs", Category.OTHER, "Nie zapisuje w logach gry tych samych komunikatów w kółko",
			"Stops the game log from filling up with the same message over and over", "filter", false, null, list()),
		// ===== Etapy 3 i 4: reszta listy =====
		new ModuleDef("animations", "Animations", Category.LOOK, "Animacje jak w 1.7: blok mieczem pod prawym przyciskiem myszy i bez opadania przedmiotu po uderzeniu",
			"1.7-style animations: sword blocking on right click and no item dip after hitting", "sword", false, null, list(
				bool("block", "Blok mieczem (prawy przycisk)", "Sword blocking (right click)", true),
				bool("no_dip", "Bez opadania przedmiotu po uderzeniu", "No item dip after hitting", true))),
		new ModuleDef("block_overlay", "Block overlay", Category.LOOK, "Własny kolor i grubość obwódki bloku, na który patrzysz",
			"Your own colour and thickness of the block outline", "frame", false, null, list(
				new ColorSetting("color", "Kolor obwódki", "Outline colour", 0xFFD6B0FF),
				new IntSetting("thickness", "Grubość (od 1.21.11)", "Thickness (1.21.11+)", 2, 1, 6, 1))),
		new ModuleDef("color_saturation", "Color saturation", Category.LOOK, "Nasycenie kolorów świata", "Colour saturation of the world",
			"colors-swatch", false, null, list(
				new ChoiceSetting("level", "Nasycenie", "Saturation", "high", new String[] {"gray", "low", "high", "max"},
					new String[] {"Szarość", "Słabe", "Mocne", "Bardzo mocne"}, new String[] {"Grayscale", "Low", "High", "Very high"}))),
		new ModuleDef("motion_blur", "Motion blur", Category.LOOK, "Rozmycie ruchu przy obracaniu kamery", "Motion blur when turning the camera",
			"speed-fast", false, null, list(
				new ChoiceSetting("strength", "Siła", "Strength", "medium", new String[] {"low", "medium", "high"},
					new String[] {"Słaba", "Średnia", "Mocna"}, new String[] {"Low", "Medium", "High"}))),
		new ModuleDef("custom_fog", "Custom fog", Category.LOOK, "Bez mgły na odległość, pod wodą i w lawie", "No distance fog, underwater fog or lava fog",
			"cloud", false, null, list(
				bool("terrain", "Bez mgły na odległość", "No distance fog", true),
				bool("fluids", "Bez mgły pod wodą i w lawie", "No fog in water and lava", false))),
		new ModuleDef("dark_mode", "Dark mode", Category.LOOK, "Ciemny wygląd ekwipunku, skrzyń i innych okien z przedmiotami",
			"Dark inventory, chests and other item windows", "moon", false, null, list()),
		new ModuleDef("elytras", "Elytras", Category.LOOK, "Ukrywanie elytry i peleryna MiB na elytrze", "Hide elytras and show your MiB cape on the elytra",
			"feather", false, null, list(
				bool("hide", "Ukryj elytrę", "Hide the elytra", false),
				bool("cape", "Peleryna MiB na elytrze", "MiB cape on the elytra", true))),
		new ModuleDef("item_physic", "Item physic", Category.LOOK, "Wyrzucone przedmioty leżą płasko i nie wirują", "Dropped items lie flat and don't spin",
			"diamond-gem", false, null, list()),
		new ModuleDef("ui_scaling", "UI scaling", Category.LOOK, "Dokładniejsza skala interfejsu (od 1.21.6 gra przyjmuje tylko pełne liczby)",
			"Finer interface scale (from 1.21.6 the game accepts whole numbers only)", "aspect-ratio", false, null, list(
				new IntSetting("scale", "Skala (100 = 1×)", "Scale (100 = 1×)", 250, 100, 600, 25))),
		new ModuleDef("custom_f3", "Custom F3", Category.HUD, "Krótszy ekran F3: wersja, FPS, pozycja, blok, kierunek, biom i światło",
			"A shorter F3 screen: version, FPS, position, block, facing, biome and light", "debug", false, null, list(
				bool("short", "Krótka lewa kolumna", "Short left column", true),
				bool("hide_right", "Ukryj prawą kolumnę", "Hide the right column", false))),
		new ModuleDef("tooltips", "Tooltips", Category.OTHER, "Jedzenie w opisie przedmiotu i rozmiar dymków z opisem",
			"Food values in item tooltips and tooltip size", "article", false, null, list(
				bool("food", "Głód i nasycenie jedzenia", "Food hunger and saturation", true),
				new IntSetting("scale", "Rozmiar dymków (%)", "Tooltip size (%)", 100, 50, 150, 10))),
		new ModuleDef("shulker_tooltips", "Shulker tooltips", Category.WORLD, "Podgląd zawartości shulkera w opisie przedmiotu",
			"Shulker box contents preview in the item tooltip", "box", false, null, list()),
		new ModuleDef("advancement_info", "Custom advancement requirements", Category.OTHER, "Czego brakuje do osiągnięcia (po najechaniu na nie)",
			"What is missing for an advancement (when you hover it)", "trophy", false, null, list(
				new IntSetting("max", "Najwięcej pozycji", "Max entries", 8, 3, 20, 1))),
		new ModuleDef("hitbox", "Hitbox", Category.PVP, "Własny kolor ramek hitboxów, tylko gracze albo zawsze widoczne",
			"Your own hitbox colour, players only or always visible", "expand", false, null, list(
				new ColorSetting("color", "Kolor", "Colour", 0xFFFFFFFF),
				bool("players", "Tylko gracze", "Players only", false),
				bool("always", "Zawsze (bez F3+B)", "Always (without F3+B)", false))),
		new ModuleDef("tier_tagger", "Tier tagger", Category.PVP, "Tier gracza z MCTiers obok nicku (nad głową i w Tab)",
			"The player's MCTiers tier next to their name (above the head and in Tab)", "flag", false, null, list(
				new ChoiceSetting("mode", "Tryb", "Mode", "best", pl.mibclient.mod.core.modules.Tiers.MODES,
					new String[] {"Najlepszy", "Vanilla", "Sword", "Pot", "Nethop", "UHC", "Axe", "SMP", "Mace"},
					new String[] {"Best", "Vanilla", "Sword", "Pot", "Nethop", "UHC", "Axe", "SMP", "Mace"}))),
		new ModuleDef("light_level", "Light level overlay", Category.WORLD, "Gdzie mogą się pojawić moby: czerwone zawsze, żółte w nocy",
			"Where mobs can spawn: red always, yellow at night", "lightbulb", false, null, list(
				new IntSetting("radius", "Zasięg (bloki)", "Range (blocks)", 8, 4, 16, 1))),
		new ModuleDef("loot_beams", "Loot beams", Category.WORLD, "Promienie nad leżącymi przedmiotami w kolorze rzadkości",
			"Light beams above dropped items in their rarity colour", "zap", false, null, list(
				bool("common", "Także zwykłe przedmioty", "Common items too", false),
				new IntSetting("height", "Wysokość (bloki)", "Height (blocks)", 3, 1, 8, 1))),
		new ModuleDef("uhc_overlay", "UHC overlay", Category.WORLD, "Większe sztabki złota, złote jabłka i głowy leżące na ziemi",
			"Bigger gold ingots, golden apples and heads on the ground", "apple", false, null, list(
				new IntSetting("scale", "Powiększenie (%)", "Size (%)", 200, 125, 300, 25))),
		new ModuleDef("waypoints", "Waypoints", Category.WORLD, "Punkty w świecie z nazwą i odległością (dodajesz je klawiszem, domyślnie N)",
			"Points in the world with name and distance (add them with a key, N by default)", "flag", false, null, list(
				new IntSetting("max_distance", "Najdalej (bloki, 0 = bez limitu)", "Max distance (blocks, 0 = no limit)", 0, 0, 10000, 100))),
		new ModuleDef("auto_text", "Auto text", Category.CHAT, "Klawisze wysyłające zapisane wiadomości lub komendy (przypisz je w Sterowaniu)",
			"Keys that send saved messages or commands (bind them in Controls)", "comment", false, null, list(
				new TextSetting("text1", "Wiadomość 1", "Message 1", "gg", 100),
				new TextSetting("text2", "Wiadomość 2", "Message 2", "/spawn", 100),
				new TextSetting("text3", "Wiadomość 3", "Message 3", "", 100))),
		new ModuleDef("emotes", "Emotes", Category.OTHER, "Emotki postaci pod klawiszem (domyślnie B), widać je w trzeciej osobie",
			"Character emotes on a key (B by default), visible in third person", "smile", false, null, list(
				new ChoiceSetting("emote", "Emotka", "Emote", "wave", new String[] {"wave", "dance", "clap", "point", "cheer"},
					new String[] {"Machanie", "Taniec", "Klaskanie", "Wskazywanie", "Radość"}, new String[] {"Wave", "Dance", "Clap", "Point", "Cheer"}),
				new IntSetting("seconds", "Czas (sekundy)", "Duration (seconds)", 4, 2, 10, 1),
				bool("camera", "Pokaż postać od przodu", "Show yourself from the front", true))),
		new ModuleDef("keybind_search", "Keybind search", Category.OTHER, "Wyszukiwarka w ustawieniach klawiszy (Sterowanie)",
			"A search box in the key binds settings (Controls)", "keyboard", false, null, list()),
		new ModuleDef("sound_filters", "Sound filters", Category.OTHER, "Pogłos w jaskiniach i wytłumione dźwięki pod wodą",
			"Reverb in caves and muffled sounds underwater", "music", false, null, list(
				bool("caves", "Pogłos w jaskiniach", "Cave reverb", true),
				bool("water", "Wytłumienie pod wodą", "Underwater muffling", true))),
		new ModuleDef("nick_hider", "Nick hider", Category.OTHER, "Ukrywa Twój nick na liście graczy i nad głową (np. do nagrywania)",
			"Hides your name in the player list and above your head (e.g. for recording)", "eye-off", false, null, list())));

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
