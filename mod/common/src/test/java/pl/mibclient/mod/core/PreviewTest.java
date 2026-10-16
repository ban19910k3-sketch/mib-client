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
}
