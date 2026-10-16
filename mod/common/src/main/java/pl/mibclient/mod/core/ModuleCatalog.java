package pl.mibclient.mod.core;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import pl.mibclient.mod.core.Setting.BoolSetting;
import pl.mibclient.mod.core.Setting.ChoiceSetting;
import pl.mibclient.mod.core.Setting.ColorSetting;
import pl.mibclient.mod.core.Setting.IntSetting;

/** Moduły etapu 1 (spec: docs/superpowers/specs/2026-10-16-mib-mod-design.md). */
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
		List<Setting<?>> l = new ArrayList<Setting<?>>(Arrays.asList(own));
		l.add(bool("background", "Tło", "Background", true));
		l.add(bool("shadow", "Cień tekstu", "Text shadow", true));
		l.add(new ColorSetting("color", "Kolor tekstu", "Text colour", 0xFFFFFFFF));
		return l;
	}

	private static List<Setting<?>> list(Setting<?>... s) {
		return new ArrayList<Setting<?>>(Arrays.asList(s));
	}

	public static final List<ModuleDef> STAGE1 = Collections.unmodifiableList(Arrays.asList(
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
		new ModuleDef("coordinates", "Coordinates", Category.HUD, "Pozycja X Y Z, kierunek i biom", "X Y Z position, facing and biome",
			"map-pin", false, at(Anchor.TOP_LEFT, 4, 128), hud(
				bool("facing", "Pokaż kierunek", "Show facing", true),
				bool("biome", "Pokaż biom", "Show biome", true),
				new IntSetting("decimals", "Miejsca po przecinku", "Decimal places", 0, 0, 1, 1))),
		new ModuleDef("server_address", "Server address", Category.HUD, "Adres serwera na HUD", "Server address on the HUD",
			"cloud-server", false, at(Anchor.TOP_LEFT, 4, 160), hud(
				bool("port", "Pokaż port", "Show port", false))),
		new ModuleDef("playtime", "Playtime", Category.HUD, "Czas tej sesji gry", "Time played this session",
			"hourglass", false, at(Anchor.TOP_LEFT, 4, 176), hud()),
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
		new ModuleDef("armor_status", "Armor status", Category.HUD, "Założona zbroja i trzymany przedmiot z wytrzymałością",
			"Worn armour and held item with durability", "shield", false, at(Anchor.BOTTOM_RIGHT, 4, 4), hud(
				bool("held", "Pokaż przedmiot w ręce", "Show held item", true),
				bool("percent", "Wytrzymałość w procentach", "Durability as percentage", false),
				new ChoiceSetting("layout", "Układ", "Layout", "vertical", new String[] {"vertical", "horizontal"},
					new String[] {"Pionowo", "Poziomo"}, new String[] {"Vertical", "Horizontal"}))),
		new ModuleDef("toggle_sprint", "Toggle sprint", Category.PVP, "Bieg i skradanie bez trzymania klawisza",
			"Sprint and sneak without holding the key", "zap", false, at(Anchor.TOP_LEFT, 4, 192), hud(
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
		new ModuleDef("fov_changer", "FOV changer", Category.LOOK, "Własne pole widzenia, bez zmian przy biegu i miksturach szybkości",
			"Custom field of view, no changes from sprinting or speed potions", "eye", false, null, list(
				new IntSetting("fov", "Pole widzenia", "Field of view", 90, 30, 110, 1),
				bool("no_effects", "Bez zmian przy biegu i miksturach", "No change from sprint or potions", true))),
		new ModuleDef("brightness", "Brightness", Category.LOOK, "Pełna jasność (fullbright)", "Full brightness (fullbright)",
			"sun", false, null, list(
				new IntSetting("level", "Jasność (%)", "Brightness (%)", 100, 0, 100, 5)))));

	public static ModuleDef get(String id) {
		for (ModuleDef m : STAGE1) if (m.id.equals(id)) return m;
		return null;
	}
}
