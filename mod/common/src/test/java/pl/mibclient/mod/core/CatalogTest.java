package pl.mibclient.mod.core;

import static org.junit.jupiter.api.Assertions.*;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

class CatalogTest {
	@Test
	void stagesOneAndTwoWithUniqueIds() {
		Set<String> ids = new HashSet<String>();
		for (ModuleDef m : ModuleCatalog.ALL) ids.add(m.id);
		assertEquals(new HashSet<String>(Arrays.asList("armor_status", "brightness", "coordinates", "cps", "custom_crosshair", "direction",
				"fov_changer", "fps", "keystrokes", "perspective", "ping", "playtime", "potion_effects", "server_address", "time", "toggle_sprint", "zoom",
				"armor_bar", "hearts", "saturation", "item_counter", "mousestrokes", "pack_display", "player_model", "speed_meter", "stopwatch",
				"system_resources", "tps", "attack_indicator", "combo_display", "damage_indicator", "hit_indicator", "reach_display", "totem", "auto_sprint", "player_overlay",
				"boss_bar", "scoreboard", "toast_control", "camera", "snaplook", "auto_perspective", "viewmodel", "weather_changer",
				"block_indicator", "death_info", "horses", "custom_chat", "reconnect", "item_info", "nick_hider",
				"title_tweaker", "subtitles", "autohide_hud", "time_changer", "inventory", "tnt_timer", "item_despawn",
				"drop_prevention", "backups", "cull_logs",
				"animations", "block_overlay", "color_saturation", "motion_blur", "custom_fog", "dark_mode", "elytras", "item_physic", "ui_scaling", "custom_f3", "tooltips", "shulker_tooltips", "advancement_info", "hitbox", "tier_tagger", "light_level", "loot_beams", "uhc_overlay", "waypoints", "auto_text", "emotes", "keybind_search", "sound_filters")), ids);
		assertEquals(84, ModuleCatalog.ALL.size());
		assertFalse(ids.contains("jump_reset") || ids.contains("nametags") || ids.contains("screenshot") || ids.contains("mob_overlay") || ids.contains("tablist"),
				"Jump reset usunięty, Nametags, Screenshot i ping w Tab działają zawsze bez przełącznika, Mob overlay to teraz Player overlay");
	}

	@Test
	void namesMatchSpec() {
		List<String> names = new ArrayList<String>();
		for (ModuleDef m : ModuleCatalog.ALL) names.add(m.name);
		assertEquals(new HashSet<String>(Arrays.asList("Armor status", "Brightness", "Coordinates", "CPS", "Custom crosshair", "Direction",
				"FOV changer", "FPS", "Keystrokes", "Perspective", "Ping", "Playtime", "Potion effects", "Server address", "Time", "Toggle sprint", "Zoom",
				"Armor bar", "Hearts", "Saturation", "Item counter", "Mousestrokes", "Pack display", "Player model", "Speed meter", "Stopwatch",
				"System resources", "TPS", "Attack indicator", "Combo display", "Damage indicator", "Hit indicator", "Reach display", "Totem", "Auto sprint", "Player overlay",
				"Boss bar", "Scoreboard", "Toast control", "Camera", "Snaplook", "Auto perspective", "Viewmodel", "Weather changer",
				"Block indicator", "Death info", "Horses", "Custom chat", "Reconnect", "Item info", "Nick hider",
				"Title tweaker", "Subtitles", "Autohide HUD", "Time changer", "Inventory", "TNT timer", "Item despawn",
				"Drop prevention", "Backups", "Cull logs",
				"Animations", "Block overlay", "Color saturation", "Motion blur", "Custom fog", "Dark mode", "Elytras", "Item physic", "UI scaling", "Custom F3", "Tooltips", "Shulker tooltips", "Custom advancement requirements", "Hitbox", "Tier tagger", "Light level overlay", "Loot beams", "UHC overlay", "Waypoints", "Auto text", "Emotes", "Keybind search", "Sound filters")),
				new HashSet<String>(names));
	}

	@Test
	void defaultsOn() {
		Set<String> on = new HashSet<String>();
		for (ModuleDef m : ModuleCatalog.ALL) if (m.defaultOn) on.add(m.id);
		assertEquals(new HashSet<String>(Arrays.asList("fps", "cps", "keystrokes", "zoom", "reconnect", "item_info")), on);
	}

	@Test
	void everyHudModuleHasDefaultPosition() {
		Set<String> notHud = new HashSet<String>(Arrays.asList("brightness", "custom_crosshair", "fov_changer", "perspective", "zoom", "hit_indicator", "saturation",
				"boss_bar", "scoreboard", "toast_control", "camera", "snaplook", "auto_perspective", "viewmodel", "weather_changer",
				"custom_chat", "reconnect", "item_info", "nick_hider", "title_tweaker", "subtitles", "autohide_hud", "time_changer", "inventory",
				"tnt_timer", "item_despawn", "player_overlay", "auto_sprint", "drop_prevention", "backups", "cull_logs",
				"animations", "block_overlay", "color_saturation", "motion_blur", "custom_fog", "dark_mode", "elytras", "item_physic", "ui_scaling", "custom_f3", "tooltips", "shulker_tooltips", "advancement_info", "hitbox", "tier_tagger", "light_level", "loot_beams", "uhc_overlay", "waypoints", "auto_text", "emotes", "keybind_search", "sound_filters"));
		for (ModuleDef m : ModuleCatalog.ALL) {
			assertEquals(!notHud.contains(m.id), m.hud, m.id);
			assertEquals(m.hud, m.defaultHud != null, m.id);
			assertFalse(m.descPl.isEmpty(), m.id);
			assertFalse(m.descEn.isEmpty(), m.id);
			Set<String> keys = new HashSet<String>();
			for (Setting<?> s : m.settings) assertTrue(keys.add(s.key), m.id + "." + s.key);
		}
	}

	@Test
	void categoriesFollowSpec() {
		assertEquals(Category.HUD, ModuleCatalog.get("fps").category);
		assertEquals(Category.PVP, ModuleCatalog.get("zoom").category);
		assertEquals(Category.PVP, ModuleCatalog.get("toggle_sprint").category);
		assertEquals(Category.PVP, ModuleCatalog.get("auto_sprint").category);
		assertEquals(Category.PVP, ModuleCatalog.get("player_overlay").category);
		assertEquals(Category.LOOK, ModuleCatalog.get("brightness").category);
		assertNull(ModuleCatalog.get("nope"));
	}

	@Test
	void settingsCoerceBadValues() {
		Config c = Config.load(new java.io.File(System.getProperty("java.io.tmpdir"), "mib-none-" + System.nanoTime() + ".json"));
		ModuleState s = c.module("zoom");
		Setting.IntSetting factor = (Setting.IntSetting) ModuleCatalog.get("zoom").setting("factor");
		assertEquals(4, (int) factor.get(s));
		s.setOption("factor", "dużo");
		assertEquals(4, (int) factor.get(s));
		s.setOption("factor", 500);
		assertEquals(4, (int) factor.get(s));
		factor.set(s, 500);
		assertEquals(50, (int) factor.get(s));
		Setting.ChoiceSetting shape = (Setting.ChoiceSetting) ModuleCatalog.get("custom_crosshair").setting("shape");
		ModuleState x = c.module("custom_crosshair");
		assertEquals("plus", shape.get(x));
		shape.next(x);
		assertEquals("dot", shape.get(x));
		x.setOption("shape", "triangle");
		assertEquals("plus", shape.get(x));
		Setting.ColorSetting color = (Setting.ColorSetting) ModuleCatalog.get("custom_crosshair").setting("color");
		color.set(x, 0xFF4ADE80);
		assertEquals(0xFF4ADE80, (int) color.get(x));
	}
}
