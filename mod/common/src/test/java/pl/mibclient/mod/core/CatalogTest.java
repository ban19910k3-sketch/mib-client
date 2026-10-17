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
	void stage1HasExactly17UniqueIds() {
		Set<String> ids = new HashSet<String>();
		for (ModuleDef m : ModuleCatalog.STAGE1) ids.add(m.id);
		assertEquals(new HashSet<String>(Arrays.asList("armor_status", "brightness", "coordinates", "cps", "custom_crosshair", "direction",
				"fov_changer", "fps", "keystrokes", "perspective", "ping", "playtime", "potion_effects", "server_address", "time", "toggle_sprint", "zoom")), ids);
		assertEquals(17, ModuleCatalog.STAGE1.size());
	}

	@Test
	void namesMatchSpec() {
		List<String> names = new ArrayList<String>();
		for (ModuleDef m : ModuleCatalog.STAGE1) names.add(m.name);
		assertEquals(new HashSet<String>(Arrays.asList("Armor status", "Brightness", "Coordinates", "CPS", "Custom crosshair", "Direction",
				"FOV changer", "FPS", "Keystrokes", "Perspective", "Ping", "Playtime", "Potion effects", "Server address", "Time", "Toggle sprint", "Zoom")),
				new HashSet<String>(names));
	}

	@Test
	void defaultsOn() {
		Set<String> on = new HashSet<String>();
		for (ModuleDef m : ModuleCatalog.STAGE1) if (m.defaultOn) on.add(m.id);
		assertEquals(new HashSet<String>(Arrays.asList("fps", "cps", "keystrokes", "zoom")), on);
	}

	@Test
	void everyHudModuleHasDefaultPosition() {
		Set<String> notHud = new HashSet<String>(Arrays.asList("brightness", "custom_crosshair", "fov_changer", "perspective", "zoom"));
		for (ModuleDef m : ModuleCatalog.STAGE1) {
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
