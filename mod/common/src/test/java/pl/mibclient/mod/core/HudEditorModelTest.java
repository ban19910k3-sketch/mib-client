package pl.mibclient.mod.core;

import static org.junit.jupiter.api.Assertions.*;

import java.io.File;
import java.util.Arrays;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class HudEditorModelTest {
	@TempDir
	File dir;
	ModuleManager mm;
	HudEditorModel ed;

	@BeforeEach
	void setUp() {
		mm = new ModuleManager(Config.load(new File(dir, "mod-config.json")), ModuleCatalog.ALL);
		ed = new HudEditorModel(mm);
		ed.setBoxes(Arrays.asList(new HudEditorModel.Box("fps", 4, 80, 40, 15, 1.0), new HudEditorModel.Box("cps", 4, 96, 40, 15, 1.0)), 480, 270);
	}

	@Test
	void dragMovesAndSavesOnRelease() {
		assertTrue(ed.mouseDown(10, 85, 0));
		ed.mouseDrag(60, 125);
		assertNull(Config.load(mm.config().file()).module("fps").hud(null), "przed puszczeniem plik bez zmian");
		assertNotNull(ed.pending("fps"));
		assertArrayEquals(new int[] {54, 120}, HudLayout.place(ed.pending("fps"), 40, 15, 480, 270));
		ed.mouseUp();
		HudPos saved = Config.load(mm.config().file()).module("fps").hud(null);
		assertNotNull(saved);
		assertArrayEquals(new int[] {54, 120}, HudLayout.place(saved, 40, 15, 480, 270));
		assertNull(ed.pending("fps"));
	}

	@Test
	void clickOutsideDoesNothing() {
		assertFalse(ed.mouseDown(300, 200, 0));
		ed.mouseDrag(310, 210);
		ed.mouseUp();
		assertNull(mm.config().module("fps").hud(null));
	}

	@Test
	void scrollChangesScaleWithinLimits() {
		for (int i = 0; i < 30; i++) ed.scroll(10, 85, 1);
		assertEquals(3.0, mm.config().module("fps").hud(null).scale, 1e-9);
		for (int i = 0; i < 40; i++) ed.scroll(10, 85, -1);
		assertEquals(0.5, mm.config().module("fps").hud(null).scale, 1e-9);
		assertFalse(ed.scroll(300, 200, 1));
	}

	@Test
	void rightClickRequestsSettings() {
		assertTrue(ed.mouseDown(10, 100, 1));
		assertEquals("cps", ed.settingsRequest());
		assertNull(ed.settingsRequest());
	}

	@Test
	void resetRestoresDefaults() {
		ed.mouseDown(10, 85, 0);
		ed.mouseDrag(200, 200);
		ed.mouseUp();
		ed.scroll(10, 100, 1);
		ed.resetAll();
		ModuleManager fresh = new ModuleManager(Config.load(mm.config().file()), ModuleCatalog.ALL);
		assertNull(fresh.config().module("fps").hud(null));
		assertNull(fresh.config().module("cps").hud(null));
	}
}
