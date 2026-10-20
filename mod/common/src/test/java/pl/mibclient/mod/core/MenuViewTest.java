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
	final java.util.Map<String, String> trying = new java.util.HashMap<String, String>();
	String world;
	int[] pos = {10, 64, -20};
	Friends friends;
	Friends.Chat chat;
	String chatErr;

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

			@Override
			public void tryOn(String type, String id) {
				calls.add("try:" + type + ":" + id);
				if (id == null) trying.remove(type);
				else trying.put(type, id);
			}

			@Override
			public String tryingOn(String type) {
				return trying.get(type);
			}

			@Override
			public String worldKey() {
				return world;
			}

			@Override
			public String dimension() {
				return "minecraft:overworld";
			}

			@Override
			public int[] playerBlockPos() {
				return pos;
			}

			@Override
			public Friends friends() {
				return friends;
			}

			@Override
			public Friends.Chat chat(String friendId) {
				calls.add("chat:" + friendId);
				return chat != null && chat.with.equals(friendId) ? chat : null;
			}

			@Override
			public void sendMessage(String friendId, String body) {
				calls.add("send:" + friendId + ":" + body);
			}

			@Override
			public String chatMessage() {
				return chatErr;
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
		for (char ch : "fps".toCharArray()) v.charTyped(ch);
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
	void searchFindsModulesFromOtherCategories() {
		click("cat:HUD");
		render();
		for (char ch : "zoom".toCharArray()) v.charTyped(ch);
		render();
		assertEquals(1, cards(), "Zoom (PvP) znaleziony, choć wybrana jest kategoria HUD");
		assertNotNull(v.hitRect("pill:zoom"));
		click("cat:PVP");
		assertEquals("", v.query(), "wybranie kategorii czyści wyszukiwarkę");
	}

	@Test
	void categoryFiltersCards() {
		click("cat:PVP");
		render();
		assertEquals(12, cards());
		assertEquals(Category.PVP, v.category());
		click("cat:ALL");
		render();
		assertTrue(cards() >= 12, "większość kart widoczna na normalnym oknie");
	}

	@Test
	void gearOpensSettingsAndEscReturns() {
		for (char ch : "fps".toCharArray()) v.charTyped(ch);
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
		assertTrue(c.hasText("Załóż profil MiB w launcherze, żeby zbierać kosmetyki."));
		cosmetics = new Cosmetics(true, Arrays.asList(new Cosmetics.Item("c1", "Fiolet", "cape", true, "QUJD"),
				new Cosmetics.Item("c2", "Złota", "cape", false, null), new Cosmetics.Item("h1", "Korona", "hat", false, null)));
		render();
		assertTrue(c.hasText("Założona") && c.hasText("Zdejmij") && c.hasText("Załóż"));
		assertFalse(c.hasText("Wkrótce w grze"), "czapki i skrzydła też zakłada się w grze");
		click("cos:c2");
		click("cos:c1");
		click("cos:h1");
		assertEquals(Arrays.asList("equip:cape:c2", "equip:cape:null", "equip:hat:h1"), calls);
		render();
		assertTrue(c.hasText("Zmieniam…"));
	}

	@Test
	void cosmeticsPageTriesItemsOnBeforeEquipping() {
		cosmetics = new Cosmetics(true, Arrays.asList(new Cosmetics.Item("c1", "Fiolet", "cape", true, "QUJD"),
				new Cosmetics.Item("c2", "Złota", "cape", false, "REVG"), new Cosmetics.Item("h1", "Korona", "hat", false, null)));
		click("cosmetics");
		render();
		assertTrue(c.hasText("Kliknij przedmiot, żeby go przymierzyć."));
		assertNull(v.hitRect("try:c1"), "założonej się nie przymierza");
		assertNull(v.hitRect("try:h1"), "bez tekstury nie ma przymiarki");
		click("try:c2");
		render();
		assertTrue(c.hasText("Przymierzasz"));
		click("try:c2");
		click("cos:c2");
		assertEquals(Arrays.asList("try:cape:c2", "try:cape:null", "equip:cape:c2"), calls);
		assertTrue(c.players > 0, "postać z przymierzanym przedmiotem w podglądzie");
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
		assertTrue(c.hasText("Disabled"));
	}

	@Test
	void textSettingIsTypedInMenu() {
		v.openSettings("auto_text");
		click("setting:text1");
		assertTrue(v.typing());
		assertTrue(v.keyPressed(MenuView.KEY_BACKSPACE));
		assertTrue(v.keyPressed(MenuView.KEY_BACKSPACE));
		for (char ch : "/hub".toCharArray()) assertTrue(v.charTyped(ch));
		ModuleDef d = mm.def("auto_text");
		assertEquals("/hub", ((Setting.TextSetting) d.setting("text1")).get(mm.state("auto_text")));
		render();
		assertTrue(c.hasText("/hub_"));
		// Esc kończy pisanie, ale zostaje na stronie ustawień
		assertTrue(v.keyPressed(MenuView.KEY_ESCAPE));
		assertFalse(v.typing());
		assertEquals(MenuView.Page.SETTINGS, v.page());
		// kliknięcie obok też kończy pisanie
		click("setting:text2");
		assertTrue(v.typing());
		v.mouseClicked(1, 1, 0);
		assertFalse(v.typing());
	}

	@Test
	void waypointsAddedAndRemovedFromMenu() {
		v.openSettings("waypoints");
		render();
		assertNull(v.hitRect("wp_add"), "poza światem nie ma przycisku dodawania");
		world = "mp:play.example.net";
		click("wp_add");
		pos = new int[] {1, 2, 3};
		click("wp_add");
		render();
		assertTrue(c.hasText("Punkt 1"));
		assertTrue(c.hasText("1 2 3"));
		click("wp_del:0");
		render();
		assertFalse(c.hasText("Punkt 1"));
		assertTrue(c.hasText("Punkt 2"));
	}

	private Friends twoFriends(int unread) {
		return new Friends(true, Arrays.asList(new Friends.Friend("b", "Bob", "offline", null, 0),
				new Friends.Friend("a", "Ala", "game", "play.mib.pl", unread)));
	}

	@Test
	void friendsPageListsFriendsAndOpensChat() {
		render();
		assertNull(v.hitRect("friends"), "bez launchera nie ma przycisku Znajomi");
		friends = Friends.LOGGED_OUT;
		click("friends");
		assertEquals(MenuView.Page.FRIENDS, v.page());
		render();
		assertTrue(c.hasTextContaining("Zaloguj się do profilu MiB"));
		friends = twoFriends(2);
		render();
		assertTrue(c.hasText("Znajomi (2)"), "licznik nowych wiadomości na przycisku");
		assertTrue(c.hasText("2 nowe") && c.hasText("W grze · play.mib.pl") && c.hasText("Offline"));
		assertTrue(v.hitRect("friend:a")[1] < v.hitRect("friend:b")[1], "z nowymi wiadomościami i w grze na górze");
		click("friend:a");
		assertEquals(MenuView.Page.CHAT, v.page());
		render();
		assertTrue(c.hasText("Wczytywanie rozmowy…"));
		assertTrue(calls.contains("chat:a"), "menu prosi launcher o rozmowę");
		chat = new Friends.Chat("a", 1, Arrays.asList(new Friends.Message(1, false, "Siema, gramy?", true, false),
				new Friends.Message(2, true, "Jasne", true, false)));
		render();
		assertTrue(c.hasText("Siema, gramy?") && c.hasText("Jasne") && c.hasText("przeczytana"));
		for (char ch : "Wchodzę§!".toCharArray()) assertTrue(v.charTyped(ch));
		assertEquals("Wchodzę!", v.draft(), "bez kodów kolorów §");
		assertTrue(v.typing(), "w rozmowie klawisze piszą, nie sterują grą");
		v.keyPressed(MenuView.KEY_BACKSPACE);
		v.charTyped('!');
		v.keyPressed(MenuView.KEY_ENTER);
		assertTrue(calls.contains("send:a:Wchodzę!"));
		assertEquals("", v.draft(), "po wysłaniu pole jest puste");
		v.keyPressed(MenuView.KEY_ENTER);
		assertEquals(1, calls.stream().filter(x -> x.startsWith("send:")).count(), "pustej wiadomości się nie wysyła");
		assertTrue(v.keyPressed(MenuView.KEY_ESCAPE));
		assertEquals(MenuView.Page.FRIENDS, v.page(), "Esc w rozmowie wraca do listy znajomych");
		assertTrue(v.keyPressed(MenuView.KEY_ESCAPE));
		assertEquals(MenuView.Page.GRID, v.page());
	}

	@Test
	void chatWrapsLongMessagesAndShowsErrors() {
		friends = twoFriends(0);
		v.openChat("a");
		StringBuilder link = new StringBuilder("https://");
		for (int i = 0; i < 120; i++) link.append('x');
		chat = new Friends.Chat("a", 1, Arrays.asList(new Friends.Message(1, false, link.toString(), false, false),
				new Friends.Message(2, true, "krótka", false, true)));
		chatErr = Lang.t("chat.message_limit");
		render();
		int[] ct = v.layout().content;
		for (RecordingCanvas.Text t : c.texts) assertTrue(t.x + c.textWidth(t.s) <= ct[0] + ct[2], "tekst w panelu: " + t.s);
		assertTrue(c.hasText("Za dużo wiadomości naraz. Odczekaj chwilę."));
		assertTrue(c.hasText("krótka"), "wiadomość w drodze też widać");
		for (int i = 0; i < 2000; i++) v.charTyped('a');
		assertEquals(Friends.MAX_MESSAGE, v.draft().length(), "najwyżej 500 znaków");
		click("send");
		assertTrue(calls.contains("send:a:" + v.draft()) || calls.stream().anyMatch(x -> x.startsWith("send:a:aaa")));
		friends = new Friends(true, Arrays.asList(new Friends.Friend("b", "Bob", "offline", null, 0)));
		render();
		assertEquals(MenuView.Page.FRIENDS, v.page(), "usunięty znajomy: wraca lista");
	}

	@Test
	void friendsJsonAndChatJsonParse() {
		Friends f = Friends.parse("{\"loggedIn\":true,\"list\":[{\"id\":\"a\",\"nick\":\"Ala\",\"status\":\"game\",\"server\":\"play.mib.pl\",\"unread\":3},{\"id\":5}]}");
		assertEquals(1, f.list.size());
		assertEquals(3, f.unread());
		assertEquals("W grze · play.mib.pl", f.get("a").statusText());
		assertSame(Friends.LOGGED_OUT, Friends.parse("{\"loggedIn\":false}"));
		assertNull(Friends.parse("zepsute"));
		Friends.Chat ch = Friends.parseChat("{\"with\":\"a\",\"at\":5,\"messages\":[{\"id\":1,\"mine\":true,\"body\":\"hej\",\"read\":true},{\"body\":\"bez id\"}]}");
		assertEquals("a", ch.with);
		assertEquals(1, ch.messages.size());
		assertTrue(ch.messages.get(0).mine && ch.messages.get(0).read);
		assertEquals(2, ch.withPending(Arrays.asList("w drodze")).messages.size());
	}
}
