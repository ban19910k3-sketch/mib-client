package pl.mibclient.mod.core;

import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.io.File;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/** Obrazki podglądu menu i HUD: ./gradlew -PcommonOnly :common:test -Ppreview=<katalog> --tests '*PreviewTest' */
class PreviewTest {
	@TempDir
	File dir;

	private File out() {
		String p = System.getProperty("mib.preview", "");
		assumeTrue(!p.isEmpty(), "podgląd tylko na życzenie");
		return new File(p);
	}

	private static MenuActions actions(final List<Account> accounts) {
		return new MenuActions() {
			@Override
			public void openHudEditor(String moduleId) {
			}

			@Override
			public List<Account> accounts() {
				return accounts;
			}

			@Override
			public void switchAccount(String id) {
			}

			@Override
			public String switchMessage() {
				return null;
			}
		};
	}

	private void menu(File out, String name, int ww, int wh, MenuView v) throws Exception {
		int s = MenuLayout.scale(ww, wh);
		PreviewCanvas c = new PreviewCanvas(ww, wh, s);
		c.gameBackground(ww / s, wh / s);
		v.render(c, ww / s, wh / s, -1, -1);
		c.save(new File(out, name + ".png"));
	}

	@Test
	void renderMenus() throws Exception {
		File out = out();
		Lang.setGame("pl_pl");
		ModuleManager mm = new ModuleManager(Config.load(new File(dir, "c.json")), ModuleCatalog.STAGE1);
		List<Account> acc = Arrays.asList(new Account("a", "Ban19910k", true), new Account("b", "BanAlt", false));
		MenuView v = new MenuView(mm, actions(acc));
		menu(out, "menu-1280x720", 1280, 720, v);
		menu(out, "menu-854x480", 854, 480, v);
		mm.setBlocked(Collections.singleton("zoom"));
		v.openSettings("keystrokes");
		menu(out, "menu-settings", 1280, 720, v);
		v.openSettings("custom_crosshair");
		menu(out, "menu-settings-crosshair", 1280, 720, v);
		v.keyPressed(MenuView.KEY_ESCAPE);
		v.render(new RecordingCanvas(), 640, 360, -1, -1);
		int[] r = v.hitRect("accounts");
		v.mouseClicked(r[0] + 1, r[1] + 1, 0);
		menu(out, "menu-accounts", 1280, 720, v);
		Lang.setGame("en_us");
		v.keyPressed(MenuView.KEY_ESCAPE);
		menu(out, "menu-en", 1920, 1080, v);
		Lang.setGame("pl_pl");
	}

	@Test
	void renderHud() throws Exception {
		File out = out();
		Lang.setGame("pl_pl");
		ModuleManager mm = new ModuleManager(Config.load(new File(dir, "h.json")), ModuleCatalog.STAGE1);
		for (ModuleDef d : mm.all()) if (d.hud && !mm.isOn(d.id)) mm.toggle(d.id);
		FakeGameInfo g = new FakeGameInfo();
		g.keys.add(GameInfo.Key.FORWARD);
		g.keys.add(GameInfo.Key.ATTACK);
		for (int i = 0; i < 11; i++) g.left.click(g.now - i * 50);
		g.effects.add(new GameInfo.Effect("Siła", 1, 1800, false, "s"));
		g.effects.add(new GameInfo.Effect("Szybkość", 0, 600, false, "p"));
		g.gear.add(new GameInfo.Gear("h", 363, 20, false));
		g.gear.add(new GameInfo.Gear("c", 528, 400, false));
		g.gear.add(new GameInfo.Gear("s", 1561, 0, true));
		g.sprintToggled = g.sprinting = true;
		HudView hud = new HudView(mm);
		PreviewCanvas c = new PreviewCanvas(1280, 720, 2);
		c.gameBackground(640, 360);
		hud.render(c, g, 640, 360, null, false);
		c.save(new File(out, "hud-game.png"));
		PreviewCanvas e = new PreviewCanvas(1280, 720, 2);
		e.gameBackground(640, 360);
		hud.render(e, g, 640, 360, new HudEditorModel(mm), true);
		e.save(new File(out, "hud-editor.png"));
	}
}
