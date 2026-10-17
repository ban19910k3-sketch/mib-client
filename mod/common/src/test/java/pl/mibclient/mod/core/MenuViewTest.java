package pl.mibclient.mod.core;

import static org.junit.jupiter.api.Assertions.*;

import java.io.File;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class MenuViewTest {
	@TempDir
	File dir;
	ModuleManager mm;
	MenuView v;
	RecordingCanvas c;
	List<Account> accounts = new ArrayList<Account>();
	List<String> calls = new ArrayList<String>();
	String message, cosMessage;
	Cosmetics cosmetics;

	@BeforeEach
	void setUp() {
		Lang.setGame("pl_pl");
		mm = new ModuleManager(Config.load(new File(dir, "mod-config.json")), ModuleCatalog.ALL);
		v = new MenuView(mm, new MenuActions() {
			@Override
			public void openHudEditor(String moduleId) {
				calls.add("hud:" + moduleId);
			}

			@Override
			public List<Account> accounts() {
				return accounts;
			}

			@Override
			public void switchAccount(String id) {
				calls.add("switch:" + id);
				message = Lang.t("acc.working");
			}

			@Override
			public String switchMessage() {
				return message;
			}

			@Override
			public Cosmetics cosmetics() {
				return cosmetics;
			}

			@Override
			public void equip(String type, String id) {
				calls.add("equip:" + type + ":" + id);
				cosMessage = Lang.t("cos.working");
			}

			@Override
			public String cosmeticMessage() {
				return cosMessage;
			}
		});
		c = new RecordingCanvas();
	}

	@AfterEach
	void tearDown() {
		Lang.setGame("pl_pl");
	}

	private void render() {
		c.clear();
		v.render(c, 640, 360, -1, -1);
	}

	private void click(String hit) {
		render();
		int[] r = v.hitRect(hit);
		assertNotNull(r, "brak elementu " + hit);
		assertTrue(v.mouseClicked(r[0] + r[2] / 2.0, r[1] + r[3] / 2.0, 0));
	}

	private int cards() {
		int n = 0;
		for (ModuleDef m : mm.all()) if (v.hitRect("pill:" + m.id) != null) n++;
		return n;
	}

	@Test
	void pillTogglesModule() {
		assertTrue(mm.isOn("fps"));
		click("pill:fps");
		assertFalse(mm.isOn("fps"));
		click("pill:fps");
		assertTrue(mm.isOn("fps"));
	}

	@Test
	void searchFiltersCards() {
		render();
		assertTrue(c.hasText("Szukaj modułu…"));
		for (char ch : "zoom".toCharArray()) v.charTyped(ch);
		render();
		assertEquals(1, cards());
		assertNotNull(v.hitRect("pill:zoom"));
		v.keyPressed(MenuView.KEY_BACKSPACE);
		assertEquals("zoo", v.query());
		for (char ch : "xyz".toCharArray()) v.charTyped(ch);
		render();
		assertEquals(0, cards());
		assertTrue(c.hasText("Nie znaleziono modułów"));
	}

	@Test
	void categoryFiltersCards() {
		click("cat:PVP");
		render();
		assertEquals(10, cards());
		assertEquals(Category.PVP, v.category());
		click("cat:ALL");
		render();
		assertTrue(cards() >= 12, "większość kart widoczna na normalnym oknie");
	}

	@Test
	void gearOpensSettingsAndEscReturns() {
		click("gear:fps");
		assertEquals(MenuView.Page.SETTINGS, v.page());
		assertEquals("fps", v.selected());
		Setting.BoolSetting bg = (Setting.BoolSetting) mm.def("fps").setting("background");
		assertTrue(bg.get(mm.state("fps")));
		click("setting:background");
		assertFalse(bg.get(mm.state("fps")));
		assertFalse(Config.load(mm.config().file()).module("fps").option("background") == null, "zapisane do pliku");
		click("place");
		assertEquals(Collections.singletonList("hud:fps"), calls);
		assertTrue(v.keyPressed(MenuView.KEY_ESCAPE));
		assertEquals(MenuView.Page.GRID, v.page());
		assertFalse(v.keyPressed(MenuView.KEY_ESCAPE), "Esc na siatce zamyka menu");
	}

	@Test
	void settingsControlsChangeValues() {
		v.openSettings("custom_crosshair");
		click("setting:shape");
		assertEquals("dot", ((Setting.ChoiceSetting) mm.def("custom_crosshair").setting("shape")).get(mm.state("custom_crosshair")));
		click("setting:color:2");
		assertEquals(0xFF4ADE80, (int) ((Setting.ColorSetting) mm.def("custom_crosshair").setting("color")).get(mm.state("custom_crosshair")));
		render();
		int[] size = v.hitRect("setting:size");
		v.mouseClicked(size[0] + size[2] - 3, size[1] + 9, 0);
		assertEquals(15, (int) ((Setting.IntSetting) mm.def("custom_crosshair").setting("size")).get(mm.state("custom_crosshair")));
		v.mouseClicked(size[0] + 3, size[1] + 9, 0);
		assertEquals(1, (int) ((Setting.IntSetting) mm.def("custom_crosshair").setting("size")).get(mm.state("custom_crosshair")));
		assertNull(v.hitRect("place"), "celownik nie jest elementem HUD");
	}

	@Test
	void accountsButtonHiddenWithoutAccounts() {
		render();
		assertFalse(c.hasText("Zmień konto"));
		assertNull(v.hitRect("accounts"));
		accounts.add(new Account("a1", "Ban19910k", true));
		accounts.add(new Account("a2", "BanAlt", false));
		click("accounts");
		assertEquals(MenuView.Page.ACCOUNTS, v.page());
		render();
		assertTrue(c.hasText("aktywne"));
		assertNull(v.hitRect("acc:a1"));
		click("acc:a2");
		assertEquals(Collections.singletonList("switch:a2"), calls);
		render();
		assertTrue(c.hasText("Zmieniam konto… gra uruchomi się ponownie."));
	}

	@Test
	void cosmeticsPageEquipsAndTakesOffCapes() {
		render();
		assertNull(v.hitRect("cosmetics"), "bez launchera nie ma przycisku Kosmetyki");
		cosmetics = Cosmetics.LOGGED_OUT;
		click("cosmetics");
		assertEquals(MenuView.Page.COSMETICS, v.page());
		render();
		assertTrue(c.hasText("Załóż profil MiB w launcherze, żeby zbierać peleryny."));
		cosmetics = new Cosmetics(true, Arrays.asList(new Cosmetics.Item("c1", "Fiolet", "cape", true, "QUJD"),
				new Cosmetics.Item("c2", "Złota", "cape", false, null), new Cosmetics.Item("h1", "Korona", "hat", false, null)));
		render();
		assertTrue(c.hasText("Założona") && c.hasText("Zdejmij") && c.hasText("Załóż") && c.hasText("Wkrótce w grze"));
		assertNull(v.hitRect("cos:h1"), "czapki na razie tylko w launcherze");
		click("cos:c2");
		click("cos:c1");
		assertEquals(Arrays.asList("equip:cape:c2", "equip:cape:null"), calls);
		render();
		assertTrue(c.hasText("Zmieniam…"));
	}

	@Test
	void cosmeticsPageScrollsAndListsCapesFirst() {
		List<Cosmetics.Item> list = new ArrayList<Cosmetics.Item>();
		list.add(new Cosmetics.Item("h0", "Korona", "hat", false, null));
		for (int i = 1; i <= 14; i++) list.add(new Cosmetics.Item("c" + i, "Peleryna " + i, "cape", i == 14, null));
		cosmetics = new Cosmetics(true, list);
		click("cosmetics");
		render();
		assertNotNull(v.hitRect("cos:c1"), "peleryny na górze, przed czapką");
		assertNull(v.hitRect("cos:c14"), "założona peleryna niżej, poza ekranem");
		for (int i = 0; i < 20; i++) v.mouseScrolled(-1);
		render();
		assertNotNull(v.hitRect("cos:c14"), "po przewinięciu da się ją zdjąć");
		click("cos:c14");
		assertEquals(Collections.singletonList("equip:cape:null"), calls);
	}

	@Test
	void blockedModuleShowsLockAndIgnoresClicks() {
		mm.setBlocked(Collections.singleton("zoom"));
		for (char ch : "zoom".toCharArray()) v.charTyped(ch);
		render();
		assertTrue(c.hasTextContaining("Zablok"));
		click("pill:zoom");
		assertTrue(mm.config().module("zoom").enabled(true), "klik w zablokowany moduł nic nie zmienia");
		v.openSettings("zoom");
		render();
		assertTrue(c.hasText("Zablokowane na tym serwerze"));
		assertNull(v.hitRect("toggle"));
	}

	@Test
	void scrollStaysWithinRange() {
		c.clear();
		v.render(c, 320, 240, -1, -1);
		int max = v.layout().maxScroll;
		assertTrue(max > 0);
		for (int i = 0; i < 300; i++) v.mouseScrolled(-1);
		c.clear();
		v.render(c, 320, 240, -1, -1);
		assertEquals(max, v.layout().scroll);
		for (int i = 0; i < 300; i++) v.mouseScrolled(1);
		c.clear();
		v.render(c, 320, 240, -1, -1);
		assertEquals(0, v.layout().scroll);
	}

	@Test
	void englishLabels() {
		Lang.setGame("en_us");
		render();
		assertTrue(c.hasText("Search modules…"));
		assertTrue(c.hasText("Edit HUD"));
		assertTrue(c.hasText("ENABLED"));
	}
}
