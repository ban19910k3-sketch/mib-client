package pl.mibclient.mod.core;

import static org.junit.jupiter.api.Assertions.*;

import java.io.File;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class HudViewTest {
	@TempDir
	File dir;
	ModuleManager mm;
	HudView hud;
	FakeGameInfo g;
	RecordingCanvas c;

	@BeforeEach
	void setUp() {
		Lang.setGame("pl_pl");
		mm = new ModuleManager(Config.load(new File(dir, "c.json")), ModuleCatalog.STAGE1);
		hud = new HudView(mm);
		g = new FakeGameInfo();
		c = new RecordingCanvas();
	}

	@AfterEach
	void tearDown() {
		Lang.setGame("pl_pl");
	}

	private void enable(String id) {
		if (!mm.isOn(id)) mm.toggle(id);
	}

	@Test
	void onlyEnabledModulesAreLaidOut() {
		Set<String> ids = new HashSet<String>();
		for (HudEditorModel.Box b : hud.layout(c, g, 480, 270, null, false)) ids.add(b.id);
		assertEquals(new HashSet<String>(java.util.Arrays.asList("fps", "cps", "keystrokes")), ids);
	}

	@Test
	void textReflectsGameInfo() {
		enable("ping");
		hud.render(c, g, 480, 270, null, false);
		assertTrue(c.hasText("FPS: 240"));
		assertTrue(c.hasText("Ping: 24 ms"));
		((Setting.ChoiceSetting) mm.def("fps").setting("style")).next(mm.state("fps"));
		c.clear();
		hud.render(c, g, 480, 270, null, false);
		assertTrue(c.hasText("240 FPS"));
	}

	@Test
	void cpsCountsClicks() {
		g.left.click(g.now - 100);
		g.left.click(g.now - 50);
		g.right.click(g.now - 10);
		hud.render(c, g, 480, 270, null, false);
		assertTrue(c.hasText("CPS: 2 | 1"));
		assertTrue(c.hasText("2 CPS"), "CPS pod LPM w keystrokes");
	}

	@Test
	void keystrokesHighlightPressedKey() {
		g.keys.add(GameInfo.Key.FORWARD);
		hud.render(c, g, 480, 270, null, false);
		RecordingCanvas.Text w = c.text("W");
		assertNotNull(w);
		assertEquals(Theme.VOID, w.color, "napis na wciśniętym klawiszu ciemny");
		boolean filled = false;
		for (int[] f : c.fills) if (f[4] == Theme.AM_HI && w.x >= f[0] && w.x < f[2] && w.y >= f[1] && w.y < f[3]) filled = true;
		assertTrue(filled, "tło W w kolorze wciśnięcia");
		assertEquals(0xFFFFFFFF, c.text("A").color, "napis na zwykłym klawiszu biały");
	}

	@Test
	void editorShowsPlaceholderForEmptyEffects() {
		enable("potion_effects");
		hud.render(c, g, 480, 270, null, false);
		assertFalse(c.hasTextContaining("1:30"), "bez mikstur nic w grze");
		c.clear();
		hud.render(c, g, 480, 270, new HudEditorModel(mm), true);
		assertTrue(c.hasText("Szybkość II  1:30"));
		Lang.setGame("en_us");
		c.clear();
		hud.render(c, g, 480, 270, null, true);
		assertTrue(c.hasText("Speed II  1:30"));
	}

	@Test
	void effectsAndArmor() {
		enable("potion_effects");
		enable("armor_status");
		g.effects.add(new GameInfo.Effect("Siła", 0, 600, false, "strength"));
		g.effects.add(new GameInfo.Effect("Regeneracja", 2, 0, true, "regen"));
		g.gear.add(new GameInfo.Gear("helmet", 100, 90, false));
		g.gear.add(new GameInfo.Gear("sword", 250, 10, true));
		g.gear.add(new GameInfo.Gear("apple", 0, 0, true));
		hud.render(c, g, 480, 270, null, false);
		assertTrue(c.hasText("Siła  0:30"));
		assertTrue(c.hasText("Regeneracja III  ∞"));
		assertTrue(c.items.contains("effect:strength"));
		assertTrue(c.items.contains("helmet") && c.items.contains("sword"));
		assertFalse(c.items.contains("apple"), "jedzenie (bez wytrzymałości) nie trafia do Armor status");
		assertEquals(Theme.RED, c.text("10").color, "prawie zniszczona zbroja na czerwono");
	}

	@Test
	void serverAddressAndPingHiddenInSingleplayer() {
		enable("server_address");
		enable("ping");
		g.server = null;
		g.ping = -1;
		List<HudEditorModel.Box> boxes = hud.layout(c, g, 480, 270, null, false);
		for (HudEditorModel.Box b : boxes) assertFalse(b.id.equals("server_address") || b.id.equals("ping"), b.id);
		g.server = "Play.MiB.pl:25570";
		hud.render(c, g, 480, 270, null, false);
		assertTrue(c.hasText("Play.MiB.pl"));
	}

	@Test
	void coordinatesTimePlaytimeDirectionSprint() {
		for (String id : new String[] {"coordinates", "time", "playtime", "direction", "toggle_sprint"}) enable(id);
		g.sprintToggled = true;
		g.sprinting = true;
		hud.render(c, g, 480, 270, null, false);
		assertTrue(c.hasText("X: 120") && c.hasText("Y: 64") && c.hasText("Z: -39"), "X, Y i Z w osobnych liniach");
		assertFalse(c.hasText("Równiny"), "domyślnie bez biomu, same współrzędne");
		assertTrue(c.text("Y: 64").y > c.text("X: 120").y && c.text("Z: -39").y > c.text("Y: 64").y, "Y pod X, Z pod Y");
		assertTrue(c.hasText("14:05"));
		assertTrue(c.hasText("Czas gry: 1:05:09"));
		assertTrue(c.hasText("N"), "pasek kompasu z literą N na środku");
		assertTrue(c.hasText("[Bieg (przełączony)]"));
	}

	@Test
	void scaleAndPositionFromConfig() {
		mm.state("fps").setHud(new HudPos(Anchor.TOP_RIGHT, 4, 4, 2.0));
		HudEditorModel.Box b = null;
		for (HudEditorModel.Box x : hud.layout(c, g, 480, 270, null, false)) if (x.id.equals("fps")) b = x;
		assertNotNull(b);
		assertEquals(2.0, b.scale);
		assertEquals(480 - 4 - b.w, b.x);
		assertEquals((c.textWidth("FPS: 240") + 6) * 2, b.w);
	}

	@Test
	void nothingWhenHudHidden() {
		g.hide = true;
		hud.render(c, g, 480, 270, null, false);
		assertTrue(c.fills.isEmpty() && c.texts.isEmpty());
		hud.render(c, g, 480, 270, null, true);
		assertFalse(c.texts.isEmpty(), "w edytorze HUD widać zawsze");
	}

	@Test
	void editorFramesAndFeedsBoxes() {
		HudEditorModel ed = new HudEditorModel(mm);
		hud.render(c, g, 480, 270, ed, true);
		assertEquals(3, ed.boxes().size());
		assertTrue(c.hasFillColor(Theme.AM));
	}
}
