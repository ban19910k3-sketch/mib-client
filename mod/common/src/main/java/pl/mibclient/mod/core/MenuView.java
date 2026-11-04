package pl.mibclient.mod.core;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

import pl.mibclient.mod.core.Setting.BoolSetting;
import pl.mibclient.mod.core.Setting.ChoiceSetting;
import pl.mibclient.mod.core.Setting.ColorSetting;
import pl.mibclient.mod.core.Setting.IntSetting;
import pl.mibclient.mod.core.Setting.TextSetting;
import pl.mibclient.mod.core.modules.Waypoints;

/**
 * Menu pod prawym Shiftem: pasek z zakładkami (Moduły, Znajomi z rozmowami, Kosmetyki, Konta), a na zakładce modułów
 * wyszukiwarka, kategorie, karty z podglądem i ustawienia wybranego modułu w prawej kolumnie.
 * Rysuje przez Canvas w jednostkach menu; kliknięcia trafiają w te same prostokąty, które zostały narysowane.
 */
public final class MenuView {
	public enum Page { GRID, SETTINGS, ACCOUNTS, COSMETICS, FRIENDS, CHAT }

	public static final int KEY_ESCAPE = 256, KEY_BACKSPACE = 259, KEY_ENTER = 257;
	private static final int FAINT = Theme.FAINT, WHITE = 0xFFFFFFFF;
	/** Linia między wierszami ustawień. */
	private static final int ROW_LINE = Theme.ROW_LINE;

	private static final class Hit {
		final String name;
		final int[] r;
		final Runnable action;

		Hit(String name, int[] r, Runnable action) {
			this.name = name;
			this.r = r;
			this.action = action;
		}
	}

	private final ModuleManager modules;
	private final MenuActions actions;
	private final List<Hit> hits = new ArrayList<Hit>();
	private Page page = Page.GRID;
	private String query = "";
	private Category category;
	private String selected;
	/** Klucz pola tekstowego, do którego trafia pisanie (TextSetting), albo null. */
	private String editing;
	private int scroll, settingsScroll, maxSettingsScroll, cosScroll, maxCosScroll, friendsScroll, maxFriendsScroll, chatScroll, maxChatScroll;
	/** Rozmowa otwarta na stronie CHAT (id znajomego) i pisana wiadomość. */
	private String chatWith, draft = "";
	private MenuLayout layout;
	/** Podglądy elementów HUD na kartach. */
	private final HudView hud;
	/** Piksele okna na jednostkę menu (ostrość podglądów). */
	private int pixels = 2;
	private boolean closeRequested;
	/** Podpowiedź pod kursorem (np. nad zębatką) i jej miejsce; rysowana na końcu, nad wszystkim. */
	private String tip;
	private int[] tipAt;

	public MenuView(ModuleManager modules, MenuActions actions) {
		this.modules = modules;
		this.actions = actions;
		this.hud = new HudView(modules);
	}

	public Page page() {
		return page;
	}

	public String query() {
		return query;
	}

	public Category category() {
		return category;
	}

	public String selected() {
		return selected;
	}

	public MenuLayout layout() {
		return layout;
	}

	/** Wiadomość, którą gracz właśnie pisze w rozmowie. */
	public String draft() {
		return draft;
	}

	/** Otwiera rozmowę ze znajomym (strona CHAT). */
	public void openChat(String friendId) {
		if (!friendId.equals(chatWith)) draft = "";
		chatWith = friendId;
		chatScroll = 0;
		page = Page.CHAT;
	}

	/** Prostokąt elementu z ostatniego rysowania, np. "pill:fps", "gear:fps", "cat:PVP", "edit_hud", "back". */
	public int[] hitRect(String name) {
		for (Hit h : hits) if (h.name.equals(name)) return h.r;
		return null;
	}

	public void openSettings(String id) {
		if (modules.def(id) == null) return;
		selected = id;
		settingsScroll = 0;
		page = Page.SETTINGS;
	}

	/** Szukanie obejmuje wszystkie moduły, bez względu na wybraną kategorię. */
	private boolean searching() {
		return !query.trim().isEmpty();
	}

	/** Moduły widoczne w siatce: wyniki wyszukiwania ze wszystkich kategorii albo moduły wybranej kategorii, alfabetycznie. */
	public List<ModuleDef> visible() {
		List<ModuleDef> l = new ArrayList<ModuleDef>();
		for (ModuleDef m : modules.all()) if ((category == null || searching() || m.category == category) && Search.matches(m, query)) l.add(m);
		Collections.sort(l, new Comparator<ModuleDef>() {
			@Override
			public int compare(ModuleDef a, ModuleDef b) {
				return a.name.compareToIgnoreCase(b.name);
			}
		});
		return l;
	}

	private List<Category> categories() {
		List<Category> l = new ArrayList<Category>();
		for (Category k : Category.values()) {
			for (ModuleDef m : modules.all()) {
				if (m.category == k) {
					l.add(k);
					break;
				}
			}
		}
		return l;
	}

	private int count(Category k) {
		int n = 0;
		for (ModuleDef m : modules.all()) if (k == null || m.category == k) n++;
		return n;
	}

	// ===== Rysowanie =====

	/** Piksele okna na jednostkę menu (MenuScreen): zaokrąglenia i podgląd HUD na kartach liczą się w pikselach okna. */
	public void pixelScale(int s) {
		pixels = Math.max(1, s);
	}

	/** Czy kliknięto krzyżyk w rogu (MenuScreen zamyka wtedy menu); odczyt kasuje prośbę. */
	public boolean takeClose() {
		boolean r = closeRequested;
		closeRequested = false;
		return r;
	}

	/** Zakładka modułów: siatka kart albo strona ustawień jednego modułu. */
	private boolean modulesTab() {
		return page == Page.GRID || page == Page.SETTINGS;
	}

	// Szklane panele nad rozmytą grą (kolory z Theme, więc działają też motywy świąteczne)
	private static final int BOX = Theme.alpha(Theme.SLAB, 0xD8), BOX_HOVER = Theme.alpha(Theme.SLAB2, 0xEC), MAIN = Theme.alpha(Theme.SLAB, 0xC4),
			CARD = Theme.alpha(Theme.SLAB2, 0xC0), CARD_HOVER = Theme.alpha(Theme.mix(Theme.SLAB2, Theme.EDGE, 0.6), 0xD8), INSET = Theme.alpha(Theme.VOID, 0xB4),
			LINE = Theme.alpha(Theme.EDGE2, 0xA0), ACCENT_BG = Theme.alpha(Theme.AM_LO, 0x5C);

	/** Promień zaokrąglenia: u jednostek menu w pikselach okna. */
	private int rad(double u) {
		return (int) Math.round(u * pixels);
	}

	/** Zaokrąglone pole (tło i ramka 1 px). */
	private void box(Canvas c, int x, int y, int w, int h, int bg, int border) {
		Shapes.round(c, x, y, w, h, rad(3), pixels, bg, border);
	}

	public void render(Canvas c, int w, int h, int mx, int my) {
		hits.clear();
		tip = null;
		if (page == Page.SETTINGS && modules.def(selected) == null || page == Page.CHAT && chatWith == null) page = Page.GRID;
		List<ModuleDef> vis = visible();
		layout = MenuLayout.compute(w, h, vis.size(), scroll, modulesTab());
		scroll = layout.scroll;
		int f0 = c.font();
		c.font(Canvas.UI);
		c.fill(0, 0, w, h, Theme.alpha(Theme.DIM, 0x58));
		Holidays.menu(Theme.ID, c, w, h, System.currentTimeMillis());
		topBar(c, mx, my);
		int[] m = layout.main;
		Shapes.round(c, m[0], m[1], m[2], m[3], rad(5), pixels, MAIN, LINE);
		if (modulesTab()) {
			sidebar(c, mx, my);
			if (page == Page.SETTINGS) settings(c, mx, my);
			else grid(c, vis, mx, my);
		} else if (page == Page.ACCOUNTS) accounts(c, mx, my);
		else if (page == Page.COSMETICS) cosmetics(c, mx, my);
		else if (page == Page.FRIENDS) friends(c, mx, my);
		else chat(c, mx, my);
		if (tip != null) {
			int tw = c.textWidth(tip) + 12, x = Math.max(2, Math.min(tipAt[0], w - tw - 2));
			box(c, x, tipAt[1], tw, 15, Theme.alpha(Theme.VOID, 0xF0), LINE);
			c.text(tip, x + 6, tipAt[1] + 4, Theme.TEXT, false);
		}
		c.font(f0);
	}

	private static boolean in(int[] r, double x, double y) {
		return x >= r[0] && x < r[0] + r[2] && y >= r[1] && y < r[1] + r[3];
	}

	/** Zakładka na pasku u góry. */
	private static final class Tab {
		final String name, icon, label;
		final Page page;
		final boolean alert;

		Tab(String name, String icon, String label, Page page, boolean alert) {
			this.name = name;
			this.icon = icon;
			this.label = label;
			this.page = page;
			this.alert = alert;
		}
	}

	/** Rząd u góry: pole z logo, zakładki (Moduły, a Znajomi, Kosmetyki i Konta tylko, gdy są dostępne), język i krzyżyk. */
	private void topBar(Canvas c, int mx, int my) {
		int[] t = layout.top, lg = layout.logo;
		box(c, lg[0], lg[1], lg[2], lg[3], BOX, LINE);
		c.font(Canvas.BOLD);
		int lx = lg[0] + 10, ty = lg[1] + (lg[3] - 8) / 2;
		c.text("MiB", lx, ty, Theme.AM_HI, false);
		lx += c.textWidth("MiB") + 3;
		c.text("Client", lx, ty, Theme.TEXT, false);
		Holidays.badge(Theme.ID, c, lx + c.textWidth("Client") + 4, ty);
		c.font(Canvas.UI);

		int[] close = {t[0] + t[2] - t[3], t[1], t[3], t[3]};
		boolean closeHover = in(close, mx, my);
		box(c, close[0], close[1], close[2], close[3], closeHover ? BOX_HOVER : BOX, closeHover ? Theme.EDGE2 : LINE);
		Shapes.icon(c, "close", close[0] + (close[2] - 12) / 2, close[1] + (close[3] - 12) / 2, closeHover ? WHITE : Theme.MUTED);
		hits.add(new Hit("close", close, new Runnable() {
			@Override
			public void run() {
				closeRequested = true;
			}
		}));
		int langX = language(c, close[0] - 6, t[1], t[3], mx, my);

		List<Tab> tabs = new ArrayList<Tab>();
		tabs.add(new Tab("modules", "grid-3x3", Lang.t("menu.tab_modules"), Page.GRID, false));
		Friends fs = actions.friends();
		if (fs != null) tabs.add(new Tab("friends", "message", Lang.t("menu.friends") + (fs.unread() > 0 ? " (" + fs.unread() + ")" : ""), Page.FRIENDS,
				fs.unread() > 0 && page != Page.FRIENDS && page != Page.CHAT));
		if (actions.cosmetics() != null) tabs.add(new Tab("cosmetics", "archive", Lang.t("menu.cosmetics"), Page.COSMETICS, false));
		if (!actions.accounts().isEmpty()) tabs.add(new Tab("accounts", "users", Lang.t("menu.tab_accounts"), Page.ACCOUNTS, false));
		int x = lg[0] + lg[2] + MenuLayout.GAP, room = langX - 6 - x;
		int each = Math.min(110, (room - (tabs.size() - 1) * 6) / Math.max(1, tabs.size()));
		for (Tab tb : tabs) {
			int[] r = {x, t[1], Math.max(each, 40), t[3]};
			boolean on = tb.page == Page.GRID ? modulesTab() : tb.page == Page.FRIENDS ? page == Page.FRIENDS || page == Page.CHAT : page == tb.page;
			boolean hover = in(r, mx, my);
			box(c, r[0], r[1], r[2], r[3], on ? ACCENT_BG : hover ? BOX_HOVER : BOX, on ? Theme.AM : hover ? Theme.EDGE2 : LINE);
			String label = Shapes.ellipsize(c, tb.label, r[2] - 32, false);
			int lw = 16 + c.textWidth(label), sx = r[0] + (r[2] - lw) / 2;
			Shapes.icon(c, tb.icon, sx, r[1] + (r[3] - 12) / 2, on ? Theme.AM_HI : tb.alert ? Theme.AM : Theme.MUTED);
			c.text(label, sx + 16, r[1] + (r[3] - 8) / 2, on ? WHITE : tb.alert ? Theme.AM_HI : hover ? Theme.TEXT : Theme.MUTED, false);
			final Page target = tb.page;
			hits.add(new Hit(tb.name, r, new Runnable() {
				@Override
				public void run() {
					page = target;
				}
			}));
			x += r[2] + 6;
		}
	}

	/** Kolumna „Biblioteka” zakładki modułów: kategorie jako osobne pola i „Edytuj HUD” na dole. */
	private void sidebar(Canvas c, int mx, int my) {
		int[] s = layout.sidebar;
		c.text(Lang.t("menu.library"), s[0] + 4, s[1] + 2, Theme.MUTED, false);
		List<Category> cats = new ArrayList<Category>();
		cats.add(null);
		cats.addAll(categories());
		for (int i = 0; i < cats.size(); i++) {
			final Category k = cats.get(i);
			int[] r = layout.category(i);
			boolean on = searching() ? k == null : k == category, hover = in(r, mx, my);
			box(c, r[0], r[1], r[2], r[3], on ? ACCENT_BG : hover ? BOX_HOVER : BOX, on ? Theme.AM : hover ? Theme.EDGE2 : LINE);
			Shapes.icon(c, k == null ? "grid-3x3" : k.icon, r[0] + 8, r[1] + (r[3] - 12) / 2, on ? Theme.AM_HI : hover ? Theme.TEXT : Theme.MUTED);
			String label = k == null ? Lang.t("menu.all") : k.label();
			c.text(Shapes.ellipsize(c, label, r[2] - 32, false), r[0] + 26, r[1] + (r[3] - 8) / 2, on ? WHITE : hover ? Theme.TEXT : Theme.MUTED, false);
			hits.add(new Hit("cat:" + (k == null ? "ALL" : k.name()), r, new Runnable() {
				@Override
				public void run() {
					category = k;
					query = "";
					scroll = 0;
					page = Page.GRID;
				}
			}));
		}
		int[] e = layout.sidebarButton(0);
		boolean eh = in(e, mx, my);
		box(c, e[0], e[1], e[2], e[3], eh ? BOX_HOVER : BOX, eh ? Theme.AM : LINE);
		String et = Shapes.ellipsize(c, Lang.t("menu.edit_hud"), e[2] - 26, false);
		int ex = e[0] + (e[2] - 16 - c.textWidth(et)) / 2;
		Shapes.icon(c, "move", ex, e[1] + (e[3] - 12) / 2, Theme.AM_HI);
		c.text(et, ex + 16, e[1] + (e[3] - 8) / 2, eh ? WHITE : Theme.TEXT, false);
		hits.add(new Hit("edit_hud", e, new Runnable() {
			@Override
			public void run() {
				actions.openHudEditor(null);
			}
		}));
	}

	/** Język menu w polu obok krzyżyka (prawa krawędź right): PL / EN / AUTO, kliknięcie zmienia na następny; zwraca lewą krawędź. */
	private int language(Canvas c, int right, int y, int h, int mx, int my) {
		String cur = Lang.chosen(), label = "auto".equals(cur) ? "AUTO" : cur.toUpperCase(java.util.Locale.ROOT);
		int w = Math.max(h, c.textWidth(label) + 14);
		final int[] r = {right - w, y, w, h};
		boolean hover = in(r, mx, my);
		box(c, r[0], r[1], r[2], r[3], hover ? BOX_HOVER : BOX, hover ? Theme.AM : LINE);
		c.text(label, r[0] + (w - c.textWidth(label)) / 2, r[1] + (h - 8) / 2, hover ? Theme.AM_HI : Theme.MUTED, false);
		hits.add(new Hit("lang", r, new Runnable() {
			@Override
			public void run() {
				String cur = Lang.chosen(), next = "auto".equals(cur) ? "pl" : "pl".equals(cur) ? "en" : "auto";
				Lang.choose(next);
				actions.languageChosen(next);
			}
		}));
		return r[0];
	}

	/** Przycisk: główny (fiolet) albo zwykły (szkło z ramką). */
	private void button(Canvas c, int[] r, String icon, String label, boolean primary, boolean hover) {
		if (primary) Shapes.round(c, r[0], r[1], r[2], r[3], rad(3), pixels, hover ? Theme.BTN_HOVER : Theme.AM_LO, Theme.alpha(Theme.BTN_HI, 0x90));
		else box(c, r[0], r[1], r[2], r[3], hover ? BOX_HOVER : BOX, hover ? Theme.AM : LINE);
		int iw = icon == null ? 0 : 15;
		String t = Shapes.ellipsize(c, label, r[2] - 10 - iw, false);
		int x = r[0] + (r[2] - iw - c.textWidth(t)) / 2;
		if (icon != null) Shapes.icon(c, icon, x, r[1] + (r[3] - 12) / 2, WHITE);
		c.text(t, x + iw, r[1] + (r[3] - 8) / 2, WHITE, false);
	}

	/** Panel zakładki modułów: duży tytuł (kategoria albo wyniki), liczba modułów, wyszukiwarka i siatka kart. */
	private void grid(Canvas c, List<ModuleDef> vis, int mx, int my) {
		int[] ct = layout.content;
		String title = searching() ? Lang.t("menu.results") : category == null ? Lang.t("menu.all_title") : category.label();
		bigTitle(c, title, ct[0], ct[1], layout.search[0] - ct[0] - 10);
		int on = 0;
		for (ModuleDef m : vis) if (modules.isOn(m.id)) on++;
		c.text(Lang.t("menu.count", vis.size(), on), ct[0], ct[1] + 20, Theme.MUTED, false);

		int[] s = layout.search;
		box(c, s[0], s[1], s[2], s[3], INSET, searching() ? Theme.AM : in(s, mx, my) ? Theme.EDGE2 : LINE);
		Shapes.icon(c, "search", s[0] + 5, s[1] + (s[3] - 12) / 2, searching() ? Theme.AM_HI : Theme.MUTED);
		String shown = query.isEmpty() ? Lang.t("menu.search") : query + "_";
		c.text(Shapes.ellipsize(c, shown, s[2] - 26, false), s[0] + 21, s[1] + (s[3] - 8) / 2, query.isEmpty() ? FAINT : Theme.TEXT, false);
		hits.add(new Hit("search", s, null));

		int[] g = layout.grid;
		if (vis.isEmpty()) {
			String t = Lang.t("menu.empty");
			c.text(t, g[0] + (g[2] - c.textWidth(t)) / 2, g[1] + 30, Theme.MUTED, false);
			return;
		}
		c.scissor(g[0], g[1], g[0] + g[2], g[1] + g[3]);
		for (int i = 0; i < vis.size(); i++) {
			int[] r = layout.cards.get(i);
			if (r[1] + r[3] < g[1] || r[1] > g[1] + g[3]) continue;
			card(c, vis.get(i), r, mx, my, in(g, mx, my));
		}
		c.unscissor();
		if (layout.maxScroll > 0) {
			int x = g[0] + g[2] + 3, thumb = Math.max(12, g[3] * g[3] / (g[3] + layout.maxScroll));
			int y = g[1] + (g[3] - thumb) * layout.scroll / layout.maxScroll;
			Shapes.round(c, x, g[1], 2, g[3], rad(1), pixels, Theme.alpha(Theme.EDGE, 0x90), 0);
			Shapes.round(c, x, y, 2, thumb, rad(1), pixels, Theme.AM_LO, 0);
		}
	}

	/** Duży tytuł strony gładką grubą czcionką (1,6 raza większy). */
	private void bigTitle(Canvas c, String title, int x, int y, int maxW) {
		c.font(Canvas.TITLE);
		c.push(1.6f, x, y);
		c.text(Shapes.ellipsize(c, title, (int) (maxW / 1.6f), false), x, y, WHITE, false);
		c.pop();
		c.font(Canvas.UI);
	}

	/**
	 * Karta modułu: nazwa i przełącznik u góry, duży podgląd (element HUD z przykładową treścią, celownik albo ikona) i na
	 * dole „Ustawienia ›”, które otwierają stronę modułu (cała karta też).
	 */
	private void card(Canvas c, final ModuleDef m, int[] r, int mx, int my, boolean mouseInGrid) {
		boolean on = modules.isOn(m.id), blocked = modules.isBlocked(m.id), hover = mouseInGrid && in(r, mx, my);
		int x = r[0], y = r[1], w = r[2], h = r[3];
		box(c, x, y, w, h, hover ? CARD_HOVER : CARD, hover ? Theme.EDGE2 : on ? Theme.alpha(Theme.AM_LO, 0xC0) : LINE);
		c.font(Canvas.BOLD);
		c.text(Shapes.ellipsize(c, m.name, w - 16 - 26, false), x + 8, y + 8, blocked ? Theme.MUTED : WHITE, false);
		c.font(Canvas.UI);
		int[] pill = {x + w - 8 - 24, y + 3, 28, 18};
		if (blocked) Shapes.icon(c, "lock", x + w - 8 - 14, y + 6, FAINT);
		else toggle(c, x + w - 8 - 20, y + 7, on);
		preview(c, m, new int[] {x + 6, y + 24, w - 12, 66}, false);
		int[] gear = {x + 3, y + h - 22, w - 6, 19};
		boolean gearHover = mouseInGrid && in(gear, mx, my);
		int fc = gearHover ? Theme.AM_HI : Theme.MUTED;
		Shapes.icon(c, "settings-cog", x + 8, y + h - 18, fc);
		String st = blocked ? Lang.t("menu.blocked_short") : Lang.t("menu.settings");
		c.text(Shapes.ellipsize(c, st, w - 44, false), x + 24, y + h - 16, gearHover ? WHITE : Theme.MUTED, false);
		c.text("›", x + w - 12, y + h - 16, fc, false);
		int[] g = layout.grid;
		if (r[1] < g[1] || r[1] + r[3] > g[1] + g[3]) return; // karta częściowo schowana: nie da się jej kliknąć
		if (gearHover) {
			tip = Lang.t("menu.settings_of", m.name);
			tipAt = new int[] {gear[0], gear[1] + gear[3] + 3};
		}
		hits.add(new Hit("card:" + m.id, r, new Runnable() {
			@Override
			public void run() {
				openSettings(m.id);
			}
		}));
		hits.add(new Hit("gear:" + m.id, gear, new Runnable() {
			@Override
			public void run() {
				openSettings(m.id);
			}
		}));
		hits.add(new Hit("pill:" + m.id, pill, new Runnable() {
			@Override
			public void run() {
				if (!modules.isBlocked(m.id)) modules.toggle(m.id);
			}
		}));
	}

	/**
	 * Podgląd modułu w ciemnej ramce b: element HUD z przykładową treścią (jak w edytorze HUD, czcionką gry), celownik
	 * albo duża ikona modułu.
	 */
	private void preview(Canvas c, ModuleDef m, int[] b, boolean big) {
		box(c, b[0], b[1], b[2], b[3], INSET, 0);
		c.scissor(b[0] + 1, b[1] + 1, b[0] + b[2] - 1, b[1] + b[3] - 1);
		boolean drawn = false;
		if ("custom_crosshair".equals(m.id)) {
			crosshair(c, m, b);
			drawn = true;
		} else if (m.hud && actions.gameInfo() != null) {
			c.font(Canvas.GAME);
			drawn = hud.preview(c, actions.gameInfo(), m, b[0] + 4, b[1] + 3, b[2] - 8, b[3] - 6, pixels);
			c.font(Canvas.UI);
		}
		if (!drawn) {
			int k = big ? 4 : 2, ox = b[0] + (b[2] - 12 * k) / 2, oy = b[1] + (b[3] - 12 * k) / 2;
			c.push(k, ox, oy);
			Shapes.icon(c, m.icon, ox, oy, modules.isOn(m.id) ? Theme.AM_HI : Theme.MUTED);
			c.pop();
		}
		c.unscissor();
	}

	private void header(Canvas c, String title, int mx, int my) {
		header(c, layout.content, title, null, false, mx, my);
	}

	/**
	 * Nagłówek strony: strzałka powrotu (rozmowa i strona modułu), kafelek z ikoną (gdy jest) i tytuł; strona zakładki
	 * (Znajomi, Kosmetyki, Konta) ma sam duży tytuł jak siatka modułów.
	 */
	private void header(Canvas c, int[] ct, String title, String icon, boolean on, int mx, int my) {
		int tx = ct[0];
		if (page == Page.CHAT || page == Page.SETTINGS) {
			int[] back = {ct[0], ct[1], 18, 18};
			boolean bh = in(back, mx, my);
			box(c, back[0], back[1], back[2], back[3], bh ? BOX_HOVER : BOX, bh ? Theme.AM : LINE);
			Shapes.icon(c, "arrow-left", back[0] + 3, back[1] + 3, Theme.TEXT);
			hits.add(new Hit("back", back, new Runnable() {
				@Override
				public void run() {
					page = page == Page.CHAT ? Page.FRIENDS : Page.GRID;
				}
			}));
			tx += 24;
		}
		if (icon != null) {
			Shapes.round(c, tx, ct[1], 18, 18, rad(3), pixels, on ? Theme.AM_LO : BOX, on ? Theme.alpha(Theme.BTN_HI, 0x90) : LINE);
			Shapes.icon(c, icon, tx + 3, ct[1] + 3, on ? WHITE : Theme.MUTED);
			tx += 24;
		}
		if (tx == ct[0]) bigTitle(c, title, ct[0], ct[1], ct[2]);
		else {
			c.font(Canvas.BOLD);
			c.text(title, tx, ct[1] + 5, WHITE, false);
			c.font(Canvas.UI);
		}
	}

	/** Przełącznik: zaokrąglona pigułka z kółkiem. */
	private void toggle(Canvas c, int x, int y, boolean on) {
		Shapes.round(c, x, y, 20, 10, rad(5), pixels, on ? Theme.AM : Theme.OFF, 0);
		Shapes.round(c, on ? x + 11 : x + 1, y + 1, 8, 8, rad(4), pixels, on ? WHITE : FAINT, 0);
	}

	/** Custom crosshair: celownik na środku ramki, powiększony (najwyżej ×2), zmienia się od razu z ustawieniami. */
	private void crosshair(Canvas c, ModuleDef m, int[] b) {
		ModuleState st = modules.state(m.id);
		int cx = b[0] + b[2] / 2, cy = b[1] + b[3] / 2;
		int color = ((Setting.ColorSetting) m.setting("color")).get(st);
		java.util.List<int[]> rects = pl.mibclient.mod.core.modules.CrosshairShape.rects(((Setting.ChoiceSetting) m.setting("shape")).get(st),
				((Setting.IntSetting) m.setting("size")).get(st), ((Setting.IntSetting) m.setting("thickness")).get(st),
				((Setting.IntSetting) m.setting("gap")).get(st), ((Setting.BoolSetting) m.setting("dot")).get(st),
				((Setting.BoolSetting) m.setting("outline")).get(st));
		int ext = 1;
		for (int[] r : rects) ext = Math.max(ext, Math.max(Math.max(-r[0], r[2]), Math.max(-r[1], r[3])));
		float k = Math.min(2f, (Math.min(b[2], b[3]) / 2f - 4) / ext);
		c.push(k, cx, cy);
		for (int[] r : rects) c.fill(cx + r[0], cy + r[1], cx + r[2], cy + r[3], r[4] == 1 ? 0xFF000000 : color);
		c.pop();
	}

	/** Wysokość wiersza ustawienia: w wąskiej kolumnie suwak, kolory i pole tekstowe są pod nazwą. */
	private static int rowH(Setting<?> s, boolean narrow) {
		return narrow && (s instanceof IntSetting || s instanceof ColorSetting || s instanceof TextSetting) ? 32 : 18;
	}

	/**
	 * Strona modułu (zamiast siatki): strzałka powrotu, nazwa i przełącznik, opis; z lewej duży podgląd i „Ustaw na ekranie”
	 * (albo dodawanie punktów, albo podpowiedź o klawiszu), z prawej przewijana lista opcji. W wąskim panelu podgląd
	 * jest nad listą.
	 */
	private void settings(Canvas c, int mx, int my) {
		final ModuleDef m = modules.def(selected);
		final ModuleState st = modules.state(m.id);
		final boolean blocked = modules.isBlocked(m.id);
		int[] a = layout.content;
		int left = a[0], right = a[0] + a[2], y = a[1];
		header(c, a, m.name, m.icon, modules.isOn(m.id), mx, my);
		if (!blocked) {
			int[] sw = {right - 20, y + 4, 20, 10};
			toggle(c, sw[0], sw[1], modules.isOn(m.id));
			hits.add(new Hit("toggle", new int[] {sw[0] - 2, sw[1] - 4, 24, 18}, new Runnable() {
				@Override
				public void run() {
					modules.toggle(m.id);
				}
			}));
		}
		y += 26;
		if (blocked) {
			Shapes.icon(c, "lock", left, y - 2, Theme.MUTED);
			for (String l : Shapes.wrap(c, Lang.t("menu.blocked"), right - left - 14, 2)) {
				c.text(l, left + 14, y, Theme.MUTED, false);
				y += 10;
			}
			y += 2;
		}
		for (String l : Shapes.wrap(c, m.desc(), right - left, 2)) {
			c.text(l, left, y, Theme.MUTED, false);
			y += 10;
		}
		y += 6;

		boolean wide = a[2] >= 330;
		int pw = wide ? Math.min(220, a[2] * 2 / 5) : a[2], ph = wide ? Math.min(130, a[1] + a[3] - y - 30) : 52;
		preview(c, m, new int[] {left, y, pw, ph}, wide);
		final boolean wp = "waypoints".equals(m.id);
		final String world = wp ? actions.worldKey() : null, dim = wp ? actions.dimension() : null;
		final List<Waypoints.Point> points = world == null ? java.util.Collections.<Waypoints.Point>emptyList() : Waypoints.in(st, world, dim);
		boolean keyHint = "zoom".equals(m.id) || "perspective".equals(m.id);
		int aw = wide ? pw : right - left;
		String[] hint = keyHint ? Shapes.wrap(c, Lang.t("menu.key_hint"), aw, 3) : wp && world == null ? Shapes.wrap(c, Lang.t("wp.no_world"), aw, 3) : null;
		int by = y + ph + 8;
		if (!wide) by = a[1] + a[3] - 18;
		if (m.hud) {
			String t = Lang.t("menu.place");
			int[] b = {left, by, wide ? pw : c.textWidth(t) + 30, 18};
			button(c, b, "move", t, true, in(b, mx, my));
			hits.add(new Hit("place", b, new Runnable() {
				@Override
				public void run() {
					actions.openHudEditor(m.id);
				}
			}));
		} else if (wp && world != null) {
			String t = Lang.t("wp.add");
			final int[] b = {left, by, wide ? pw : c.textWidth(t) + 30, 18};
			button(c, b, "flag", t, true, in(b, mx, my));
			hits.add(new Hit("wp_add", b, new Runnable() {
				@Override
				public void run() {
					int[] p = actions.playerBlockPos();
					if (p != null && Waypoints.add(st, world, dim, p[0], p[1], p[2], Lang.t("wp.name"))) modules.touched(m.id);
				}
			}));
		} else if (hint != null) {
			int hy = wide ? by + 2 : a[1] + a[3] - hint.length * 10;
			for (String l : hint) {
				c.text(l, left, hy, FAINT, false);
				hy += 10;
			}
		}

		int lx = wide ? left + pw + 14 : left, top = wide ? y : y + ph + 8;
		int bottom = a[1] + a[3] - (wide ? 0 : (m.hud || wp && world != null ? 24 : hint != null ? hint.length * 10 + 4 : 0));
		boolean narrow = right - lx < 260;
		int listH = 0;
		for (Setting<?> s : m.settings) listH += rowH(s, narrow);
		if (wp) listH += (1 + Math.max(1, points.size())) * 18;
		maxSettingsScroll = Math.max(0, listH - (bottom - top));
		settingsScroll = Math.max(0, Math.min(maxSettingsScroll, settingsScroll));
		if (m.settings.isEmpty() && !wp) c.text(Lang.t("menu.no_options"), lx + 3, top + 5, FAINT, false);
		c.scissor(lx, top, right, bottom);
		int ry = top - settingsScroll;
		for (Setting<?> s : m.settings) {
			int rh = rowH(s, narrow);
			if (ry + rh > top && ry < bottom) row(c, m, st, s, ry, rh, lx, right, mx, my, ry >= top && ry + rh <= bottom);
			ry += rh;
		}
		if (wp) waypointRows(c, st, world, dim, points, ry, top, bottom, lx, right, mx, my);
		c.unscissor();
		if (maxSettingsScroll > 0) {
			int bx = right + 4, thumb = Math.max(10, (bottom - top) * (bottom - top) / (bottom - top + maxSettingsScroll));
			int sy = top + (bottom - top - thumb) * settingsScroll / maxSettingsScroll;
			Shapes.round(c, bx, top, 2, bottom - top, rad(1), pixels, Theme.alpha(Theme.EDGE, 0x90), 0);
			Shapes.round(c, bx, sy, 2, thumb, rad(1), pixels, Theme.AM_LO, 0);
		}
	}

	/** Waypoints: nagłówek i punkty tego świata (kolor, nazwa, współrzędne, usuwanie). */
	private void waypointRows(Canvas c, final ModuleState st, final String world, final String dim, List<Waypoints.Point> points, int y, int top,
			int bottom, int left, int right, int mx, int my) {
		c.text(Lang.t("wp.title"), left + 6, y + 7, Theme.AM_HI, false);
		y += 18;
		if (points.isEmpty()) {
			c.text(Lang.t(world == null ? "wp.no_world" : "wp.none"), left + 6, y + 5, FAINT, false);
			return;
		}
		for (int i = 0; i < points.size(); i++, y += 18) {
			if (y + 18 <= top || y >= bottom) continue;
			Waypoints.Point p = points.get(i);
			c.fill(left, y + 17, right, y + 18, ROW_LINE);
			Shapes.pixelRect(c, left + 6, y + 5, 8, 8, p.color);
			c.text(Shapes.ellipsize(c, p.name, (right - left) / 2 - 24, false), left + 20, y + 5, Theme.TEXT, false);
			String xyz = p.x + " " + p.y + " " + p.z;
			c.text(xyz, right - 26 - c.textWidth(xyz), y + 5, Theme.MUTED, false);
			final int[] del = {right - 20, y + 2, 14, 14};
			Shapes.icon(c, "close", del[0] + 1, del[1] + 1, in(del, mx, my) ? Theme.BAD : FAINT);
			final int index = i;
			if (y >= top && y + 18 <= bottom) hits.add(new Hit("wp_del:" + i, del, new Runnable() {
				@Override
				public void run() {
					Waypoints.remove(st, world, dim, index);
					modules.touched("waypoints");
				}
			}));
		}
	}

	/**
	 * Wiersz ustawienia wysokości rh: nazwa z lewej i kontrolka z prawej, a w wąskiej kolumnie (rh = 32) suwak, kolory i pole
	 * tekstowe pod nazwą, na całą szerokość.
	 */
	private void row(Canvas c, final ModuleDef m, final ModuleState st, final Setting<?> s, int y, int rh, int left, int right, int mx, int my,
			boolean clickable) {
		// wiersz podświetlony pod myszą, cienka linia między wierszami, treść z wcięciem
		if (clickable && mx >= left && mx < right && my >= y && my < y + rh) Shapes.round(c, left, y, right - left, rh - 1, rad(2), pixels, BOX_HOVER, 0);
		c.fill(left, y + rh - 1, right, y + rh, ROW_LINE);
		int inset = right - left < 200 ? 3 : 6;
		left += inset;
		right -= inset;
		boolean stacked = rh > 18;
		int half = (right - left) / 2 - 6;
		if (s instanceof BoolSetting) {
			final BoolSetting b = (BoolSetting) s;
			label(c, s, left, y, right - left - 28);
			toggle(c, right - 20, y + 4, b.get(st));
			if (clickable) hits.add(new Hit("setting:" + s.key, new int[] {right - 24, y, 24 + inset, 18}, new Runnable() {
				@Override
				public void run() {
					b.toggle(st);
					modules.touched(m.id);
				}
			}));
		} else if (s instanceof IntSetting) {
			final IntSetting is = (IntSetting) s;
			int v = is.get(st);
			String val = String.valueOf(v);
			label(c, s, left, y, stacked ? right - left - c.textWidth(val) - 6 : half);
			c.text(val, right - c.textWidth(val), y + 5, Theme.MUTED, false);
			final int tx = stacked ? left : left + (right - left) / 2, tw = stacked ? right - left : right - tx - 34, ty = stacked ? y + 21 : y + 8;
			c.fill(tx, ty, tx + tw, ty + 2, Theme.OFF);
			int kx = tx + (int) Math.round((v - is.min) / (double) Math.max(1, is.max - is.min) * tw);
			c.fill(tx, ty, kx, ty + 2, Theme.AM);
			c.fill(kx - 1, ty - 4, kx + 2, ty + 6, WHITE);
			if (clickable) hits.add(new Hit("setting:" + s.key, new int[] {tx - 3, ty - 8, tw + 6, 18}, new IntClick(is, st, m.id, tx, tw)));
		} else if (s instanceof ChoiceSetting) {
			final ChoiceSetting cs = (ChoiceSetting) s;
			String t = Shapes.ellipsize(c, cs.valueLabel(cs.get(st)), right - left - 46, false);
			int bw = c.textWidth(t) + 16;
			int[] r = {right - bw, y + 1, bw, 16};
			label(c, s, left, y, right - left - bw - 8);
			box(c, r[0], r[1], r[2], r[3], in(r, mx, my) ? BOX_HOVER : BOX, LINE);
			c.text(t, r[0] + 8, r[1] + 4, Theme.TEXT, false);
			if (clickable) hits.add(new Hit("setting:" + s.key, r, new Runnable() {
				@Override
				public void run() {
					cs.next(st);
					modules.touched(m.id);
				}
			}));
		} else if (s instanceof TextSetting) {
			final TextSetting ts = (TextSetting) s;
			label(c, s, left, y, stacked ? right - left : half);
			boolean active = s.key.equals(editing) && m.id.equals(selected);
			final int[] r = stacked ? new int[] {left, y + 15, right - left, 15} : new int[] {left + (right - left) / 2, y + 1, (right - left) / 2, 16};
			box(c, r[0], r[1], r[2], r[3], Theme.VOID, active ? Theme.AM : in(r, mx, my) ? Theme.AM_LO : Theme.EDGE2);
			String v = ts.get(st) + (active ? "_" : "");
			String shown = c.textWidth(v) > r[2] - 10 ? "…" + tail(c, v, r[2] - 16) : v;
			c.text(shown, r[0] + 5, r[1] + (r[3] - 8) / 2, v.isEmpty() ? FAINT : Theme.TEXT, false);
			if (clickable) hits.add(new Hit("setting:" + s.key, r, new Runnable() {
				@Override
				public void run() {
					editing = ts.key;
				}
			}));
		} else if (s instanceof ColorSetting) {
			final ColorSetting cs = (ColorSetting) s;
			int cur = cs.get(st);
			int[] pal = ColorSetting.PALETTE;
			label(c, s, left, y, stacked ? right - left : right - left - pal.length * 14 - 6);
			for (int i = 0; i < pal.length; i++) {
				final int color = pal[i];
				int x = stacked ? left + 2 + i * 14 : right - (pal.length - i) * 14 + 4, sy = stacked ? y + 16 : y + 2;
				if (color == cur) Shapes.pixelFrame(c, x - 2, sy, 14, 14, 1, WHITE);
				Shapes.pixelRect(c, x, sy + 2, 10, 10, color);
				if (clickable) hits.add(new Hit("setting:" + s.key + ":" + i, new int[] {x - 2, sy, 14, 14}, new Runnable() {
					@Override
					public void run() {
						cs.set(st, color);
						modules.touched(m.id);
					}
				}));
			}
		}
	}

	private static void label(Canvas c, Setting<?> s, int x, int y, int maxW) {
		c.text(Shapes.ellipsize(c, s.label(), Math.max(12, maxW), false), x, y + 5, Theme.TEXT, false);
	}

	/** Koniec tekstu mieszczący się w maxW (pole tekstowe pokazuje to, co się właśnie pisze). */
	private static String tail(Canvas c, String s, int maxW) {
		int i = 0;
		while (i < s.length() && c.textWidth(s.substring(i)) > maxW) i++;
		return s.substring(i);
	}

	/** Kliknięcie w suwak: wartość z miejsca kliknięcia (pozycja myszy znana dopiero przy kliknięciu). */
	private final class IntClick implements Runnable {
		final IntSetting s;
		final ModuleState st;
		final String id;
		final int tx, tw;
		double mx;

		IntClick(IntSetting s, ModuleState st, String id, int tx, int tw) {
			this.s = s;
			this.st = st;
			this.id = id;
			this.tx = tx;
			this.tw = tw;
		}

		@Override
		public void run() {
			double f = Math.max(0, Math.min(1, (mx - tx) / Math.max(1, tw)));
			s.set(st, (int) Math.round(s.min + f * (s.max - s.min)));
			modules.touched(id);
		}
	}

	private void accounts(Canvas c, int mx, int my) {
		int[] ct = layout.content;
		header(c, Lang.t("menu.accounts"), mx, my);
		c.text(Lang.t("acc.hint"), ct[0], ct[1] + 22, Theme.MUTED, false);
		List<Account> list = actions.accounts();
		int y = ct[1] + 40;
		for (final Account a : list) {
			box(c, ct[0], y, ct[2], 20, BOX, a.active ? Theme.AM_LO : LINE);
			c.text(Shapes.ellipsize(c, a.name, ct[2] - 90, false), ct[0] + 8, y + 6, Theme.TEXT, false);
			if (a.active) {
				String t = Lang.t("acc.active");
				c.text(t, ct[0] + ct[2] - 8 - c.textWidth(t), y + 6, Theme.AM_HI, false);
			} else {
				String t = Lang.t("acc.switch");
				int[] b = {ct[0] + ct[2] - 4 - (c.textWidth(t) + 16), y + 2, c.textWidth(t) + 16, 16};
				button(c, b, null, t, true, in(b, mx, my));
				hits.add(new Hit("acc:" + a.id, b, new Runnable() {
					@Override
					public void run() {
						actions.switchAccount(a.id);
					}
				}));
			}
			y += 24;
		}
		String msg = actions.switchMessage();
		if (msg != null) for (String l : Shapes.wrap(c, msg, ct[2], 3)) {
			c.text(l, ct[0], y + 4, msg.equals(Lang.t("acc.working")) ? Theme.AM_HI : Theme.BAD, false);
			y += 10;
		}
	}

	/**
	 * Kosmetyki z profilu MiB: z lewej obracająca się postać gracza (przodem i tyłem), z prawej lista. Klik w przedmiot
	 * to przymiarka (widać ją na postaci, do zamknięcia menu), „Załóż” zakłada go naprawdę. Prezenty od MiB są na górze
	 * listy z przyciskiem „Odbierz”.
	 */
	private void cosmetics(Canvas c, int mx, int my) {
		int[] ct = layout.content;
		header(c, Lang.t("menu.cosmetics"), mx, my);
		Cosmetics cs = actions.cosmetics();
		int y = ct[1] + 40;
		if (cs == null || !cs.loggedIn || cs.items.isEmpty() && cs.gifts.isEmpty()) {
			int ty = ct[1] + 22;
			for (String l : Shapes.wrap(c, Lang.t(cs == null || !cs.loggedIn ? "cos.login" : "cos.empty"), ct[2], 3)) {
				c.text(l, ct[0], ty, Theme.MUTED, false);
				ty += 10;
			}
			return;
		}
		c.text(Lang.t("cos.hint"), ct[0], ct[1] + 22, Theme.MUTED, false);
		// peleryny na górze, potem czapki i skrzydła; lista przewijana kółkiem
		List<Cosmetics.Item> items = new ArrayList<Cosmetics.Item>();
		for (Cosmetics.Item it : cs.items) if ("cape".equals(it.type)) items.add(it);
		for (Cosmetics.Item it : cs.items) if (!"cape".equals(it.type)) items.add(it);
		String msg = actions.cosmeticMessage();
		y = petRows(c, cs, ct, y, mx, my);
		int top = y, bottom = ct[1] + ct[3] - (msg != null ? 22 : 2);
		// podgląd postaci: obrót 50° na sekundę, więc co kilka sekund widać pelerynę i skrzydła z tyłu
		int pw = ct[2] >= 300 ? 84 : 0, lx = ct[0] + (pw > 0 ? pw + 8 : 0), lw = ct[2] - (lx - ct[0]);
		if (pw > 0) {
			box(c, ct[0], top, pw, bottom - top, BOX, LINE);
			int size = Math.max(20, Math.min(pw * 2 / 5, (bottom - top) * 2 / 7));
			c.playerTurned(ct[0] + 2, top + 2, ct[0] + pw - 2, bottom - 2, size, (System.currentTimeMillis() / 20) % 360);
		}
		maxCosScroll = Math.max(0, (cs.gifts.size() + items.size()) * 24 - 4 - (bottom - top));
		cosScroll = Math.max(0, Math.min(maxCosScroll, cosScroll));
		c.scissor(lx, top, lx + lw, bottom);
		y = top - cosScroll;
		for (final Cosmetics.Gift g : cs.gifts) {
			if (y + 20 > top && y < bottom) {
				box(c, lx, y, lw, 20, BOX, Theme.AM);
				Shapes.icon(c, "archive", lx + 6, y + 4, Theme.AM_HI);
				String t = Lang.t("cos.claim");
				int[] b = {lx + lw - 4 - (c.textWidth(t) + 16), y + 2, c.textWidth(t) + 16, 16};
				c.text(Shapes.ellipsize(c, Lang.t("cos.gift", g.name), b[0] - lx - 30, false), lx + 22, y + 6, Theme.AM_HI, false);
				button(c, b, null, t, true, in(b, mx, my));
				if (y >= top && y + 20 <= bottom) hits.add(new Hit("gift:" + g.id, b, new Runnable() {
					@Override
					public void run() {
						actions.claimGift(g.id);
					}
				}));
			}
			y += 24;
		}
		for (final Cosmetics.Item it : items) {
			if (y + 20 <= top || y >= bottom) {
				y += 24;
				continue;
			}
			boolean clickable = y >= top && y + 20 <= bottom;
			final boolean trying = it.id.equals(actions.tryingOn(it.type));
			box(c, lx, y, lw, 20, BOX, it.equipped ? Theme.AM_LO : trying ? Theme.AM_HI : LINE);
			String kind = Lang.t("cos." + (java.util.Arrays.asList("hat", "mask", "wings", "aura", "pet", "tail", "back").contains(it.type) ? it.type : "cape"));
			c.text(Shapes.ellipsize(c, it.name, lw - 150, false), lx + 8, y + 6, Theme.TEXT, false);
			// przymiarka: cały wiersz (przycisk niżej ma pierwszeństwo, bo sprawdzany jest od końca)
			if (clickable && it.png != null && !it.equipped) hits.add(new Hit("try:" + it.id, new int[] {lx, y, lw, 20}, new Runnable() {
				@Override
				public void run() {
					actions.tryOn(it.type, trying ? null : it.id);
				}
			}));
			{
				String t = Lang.t(it.equipped ? "cos.unequip" : "cos.equip");
				int[] b = {lx + lw - 4 - (c.textWidth(t) + 16), y + 2, c.textWidth(t) + 16, 16};
				button(c, b, null, t, !it.equipped, in(b, mx, my));
				String label = it.equipped ? Lang.t("cos.on") : trying ? Lang.t("cos.trying") : null;
				if (label != null) c.text(label, b[0] - 6 - c.textWidth(label), y + 6, Theme.AM_HI, false);
				// rodzaj przedmiotu przed napisem „Założona” / „Przymierzasz” (szerokość zależy od czcionki)
				c.text(kind, (label != null ? b[0] - 6 - c.textWidth(label) : b[0]) - 14 - c.textWidth(kind), y + 6, FAINT, false);
				if (clickable) hits.add(new Hit("cos:" + it.id, b, new Runnable() {
					@Override
					public void run() {
						if (trying) actions.tryOn(it.type, null);
						actions.equip(it.type, it.equipped ? null : it.id);
					}
				}));
			}
			y += 24;
		}
		c.unscissor();
		y = bottom + 2;
		if (msg != null) for (String l : Shapes.wrap(c, msg, ct[2], 2)) {
			c.text(l, ct[0], y, msg.equals(Lang.t("cos.working")) ? Theme.AM_HI : Theme.BAD, false);
			y += 10;
		}
	}

	/**
	 * Nad listą kosmetyków (od 0.34.0): przy założonym pecie jego tryb (lata, ramię, chodzi) i strona, a zawsze przełącznik
	 * „Pety innych graczy”. Zwraca y pod tymi wierszami.
	 */
	private int petRows(Canvas c, Cosmetics cs, int[] ct, int y, int mx, int my) {
		int x = ct[0], w = ct[2];
		if (cs.equipped("pet") != null) {
			box(c, x, y, w, 20, BOX, LINE);
			c.text(Lang.t("cos.pet"), x + 8, y + 6, Theme.TEXT, false);
			int bx = x + w - 4;
			final int mode = cs.petMode, side = cs.petSide;
			int[][] opts = {{1, -1}, {1, 1}, {0, Pets.WALK}, {0, Pets.SHOULDER}, {0, Pets.FLY}};
			for (int[] o : opts) {
				final boolean isSide = o[0] == 1;
				final int v = o[1];
				String t = Lang.t(isSide ? (v < 0 ? "cos.pet_right" : "cos.pet_left") : "cos.pet_" + Pets.modeName(v));
				int bw = c.textWidth(t) + 12;
				bx -= bw;
				int[] b = {bx, y + 2, bw, 16};
				boolean on = isSide ? side == v : mode == v;
				button(c, b, null, t, on, in(b, mx, my));
				hits.add(new Hit("pet:" + (isSide ? "side" : "mode") + v, b, new Runnable() {
					@Override
					public void run() {
						actions.setPet(isSide ? mode : v, isSide ? v : side);
					}
				}));
				bx -= isSide && v > 0 ? 10 : 3;
			}
			y += 24;
		}
		box(c, x, y, w, 20, BOX, LINE);
		c.text(Lang.t("cos.show_pets"), x + 8, y + 6, Theme.TEXT, false);
		final boolean show = actions.showPets();
		toggle(c, x + w - 26, y + 5, show);
		hits.add(new Hit("pet:show", new int[] {x, y, w, 20}, new Runnable() {
			@Override
			public void run() {
				actions.setShowPets(!show);
			}
		}));
		return y + 26;
	}

	/** Znajomi: lista (najpierw w grze, potem w launcherze, offline), klik otwiera rozmowę; licznik nowych wiadomości. */
	private void friends(Canvas c, int mx, int my) {
		int[] ct = layout.content;
		header(c, Lang.t("menu.friends"), mx, my);
		Friends fs = actions.friends();
		if (fs == null || !fs.loggedIn || fs.list.isEmpty()) {
			int ty = ct[1] + 22;
			for (String l : Shapes.wrap(c, Lang.t(fs == null || !fs.loggedIn ? "friends.login" : "friends.empty"), ct[2], 3)) {
				c.text(l, ct[0], ty, Theme.MUTED, false);
				ty += 10;
			}
			return;
		}
		c.text(Lang.t("friends.hint"), ct[0], ct[1] + 22, Theme.MUTED, false);
		List<Friends.Friend> list = new ArrayList<Friends.Friend>(fs.list);
		Collections.sort(list, new Comparator<Friends.Friend>() {
			@Override
			public int compare(Friends.Friend a, Friends.Friend b) {
				int d = rank(a) - rank(b);
				return d != 0 ? d : a.nick.compareToIgnoreCase(b.nick);
			}
		});
		int top = ct[1] + 40, bottom = ct[1] + ct[3] - 2;
		maxFriendsScroll = Math.max(0, list.size() * 24 - 4 - (bottom - top));
		friendsScroll = Math.max(0, Math.min(maxFriendsScroll, friendsScroll));
		c.scissor(ct[0], top, ct[0] + ct[2], bottom);
		int y = top - friendsScroll;
		for (final Friends.Friend f : list) {
			if (y + 20 <= top || y >= bottom) {
				y += 24;
				continue;
			}
			final int[] r = {ct[0], y, ct[2], 20};
			boolean clickable = y >= top && y + 20 <= bottom, hover = clickable && in(r, mx, my);
			box(c, r[0], y, r[2], 20, hover ? BOX_HOVER : BOX, f.unread > 0 ? Theme.AM : hover ? Theme.EDGE2 : LINE);
			// party (od 0.38.0): ikonka grupy zamiast kropki statusu, członkowie zamiast statusu
			if (f.party) Shapes.icon(c, "users", r[0] + 4, y + 4, "game".equals(f.status) ? Theme.GOOD : Theme.AM_HI);
			else Shapes.round(c, r[0] + 7, y + 7, 6, 6, rad(3), pixels, "game".equals(f.status) ? Theme.GOOD : "launcher".equals(f.status) ? Theme.AM : Theme.OFF, 0);
			String right = f.unread > 0 ? Lang.t("friends.new", f.unread) : null;
			int rw = right != null ? c.textWidth(right) + 12 : 16;
			String nick = Shapes.ellipsize(c, f.nick, Math.min(110, r[2] / 3), false);
			c.text(nick, r[0] + 19, y + 6, f.party ? Theme.AM_HI : Theme.TEXT, false);
			int sx = r[0] + 19 + c.textWidth(nick) + 10;
			c.text(Shapes.ellipsize(c, f.statusText(), r[0] + r[2] - rw - 8 - sx, false), sx, y + 6, f.party ? Theme.TEXT : "game".equals(f.status) ? Theme.GOOD : FAINT, false);
			if (right != null) c.text(right, r[0] + r[2] - 8 - c.textWidth(right), y + 6, Theme.AM_HI, false);
			else Shapes.icon(c, "message", r[0] + r[2] - 16, y + 4, hover ? Theme.AM_HI : FAINT);
			if (clickable) hits.add(new Hit("friend:" + f.id, r, new Runnable() {
				@Override
				public void run() {
					openChat(f.id);
				}
			}));
			y += 24;
		}
		c.unscissor();
	}

	private static int rank(Friends.Friend f) {
		return f.party ? -1 : f.unread > 0 ? 0 : "game".equals(f.status) ? 1 : "launcher".equals(f.status) ? 2 : 3;
	}

	/**
	 * Rozmowa: wiadomości jak w launcherze (moje z prawej na fiolecie, znajomego z lewej), najnowsze na dole, przewijane
	 * kółkiem; na dole pole do pisania (Enter wysyła) i przycisk „Wyślij”.
	 */
	private void chat(Canvas c, int mx, int my) {
		int[] ct = layout.content;
		Friends fs = actions.friends();
		Friends.Friend f = fs == null ? null : fs.get(chatWith);
		if (f == null) { // już nie znajomy albo wylogowany: wraca lista
			page = Page.FRIENDS;
			friends(c, mx, my);
			return;
		}
		header(c, Shapes.ellipsize(c, f.nick, ct[2] / 2 - 30, false), mx, my);
		String st = Shapes.ellipsize(c, f.statusText(), ct[2] / 2, false);
		c.text(st, ct[0] + ct[2] - c.textWidth(st), ct[1] + 4, f.party ? Theme.TEXT : "game".equals(f.status) ? Theme.GOOD : FAINT, false);
		Friends.Chat ch = actions.chat(f.id);
		String err = actions.chatMessage();
		int inputY = ct[1] + ct[3] - 16, top = ct[1] + 22, bottom = inputY - (err != null ? 14 : 4);
		box(c, ct[0], top, ct[2], bottom - top, BOX, LINE);
		int lh = c.lineHeight() + 1, bw = Math.max(60, ct[2] * 3 / 4);
		if (ch == null || ch.messages.isEmpty()) {
			String t = ch == null ? Lang.t("chat.loading") : f.party ? Lang.t("friends.party.hint") : Lang.t("chat.empty", f.nick);
			c.text(Shapes.ellipsize(c, t, ct[2] - 12, false), ct[0] + (ct[2] - Math.min(ct[2] - 12, c.textWidth(t))) / 2, (top + bottom) / 2 - 4, Theme.MUTED, false);
		} else {
			int lastMine = -1;
			for (int i = 0; i < ch.messages.size(); i++) if (ch.messages.get(i).mine && !ch.messages.get(i).pending) lastMine = i;
			List<List<String>> lines = new ArrayList<List<String>>();
			int total = 0;
			for (int i = 0; i < ch.messages.size(); i++) {
				List<String> l = Shapes.wrapAll(c, ch.messages.get(i).body, bw - 12);
				lines.add(l);
				total += l.size() * lh + 6 + 4 + (i == lastMine && ch.messages.get(i).read ? 10 : 0);
			}
			maxChatScroll = Math.max(0, total - (bottom - top - 8));
			chatScroll = Math.max(0, Math.min(maxChatScroll, chatScroll));
			c.scissor(ct[0] + 1, top + 1, ct[0] + ct[2] - 1, bottom - 1);
			int y = bottom - 4 + chatScroll;
			for (int i = ch.messages.size() - 1; i >= 0 && y > top; i--) {
				Friends.Message m = ch.messages.get(i);
				List<String> l = lines.get(i);
				if (i == lastMine && m.read) {
					y -= 10;
					String t = Lang.t("chat.read");
					c.text(t, ct[0] + ct[2] - 6 - c.textWidth(t), y, FAINT, false);
				}
				int w = 0;
				for (String s : l) w = Math.max(w, c.textWidth(s));
				int h = l.size() * lh + 6, x = m.mine ? ct[0] + ct[2] - 6 - (w + 12) : ct[0] + 6;
				y -= h;
				if (y + h > top) {
					if (m.mine) {
						Shapes.round(c, x, y, w + 12, h, rad(4), pixels, m.pending ? Theme.OFF : Theme.AM_LO, 0);
					} else box(c, x, y, w + 12, h, BOX_HOVER, LINE);
					for (int k = 0; k < l.size(); k++) c.text(l.get(k), x + 6, y + 4 + k * lh, m.pending ? Theme.MUTED : m.mine ? WHITE : Theme.TEXT, false);
				}
				y -= 4;
			}
			c.unscissor();
		}
		if (err != null) c.text(Shapes.ellipsize(c, err, ct[2], false), ct[0], inputY - 12, Theme.BAD, false);
		String t = Lang.t("chat.send");
		int[] sb = {ct[0] + ct[2] - (c.textWidth(t) + 16), inputY, c.textWidth(t) + 16, 16};
		int[] field = {ct[0], inputY, sb[0] - 6 - ct[0], 16};
		box(c, field[0], field[1], field[2], field[3], BOX_HOVER, Theme.AM);
		String shown = draft.isEmpty() ? Lang.t("chat.placeholder") : draft + "_";
		if (!draft.isEmpty() && c.textWidth(shown) > field[2] - 10) shown = "…" + tail(c, shown, field[2] - 16);
		c.text(Shapes.ellipsize(c, shown, field[2] - 10, false), field[0] + 5, field[1] + 4, draft.isEmpty() ? FAINT : Theme.TEXT, false);
		hits.add(new Hit("chat_input", field, null));
		button(c, sb, null, t, true, in(sb, mx, my));
		hits.add(new Hit("send", sb, new Runnable() {
			@Override
			public void run() {
				send();
			}
		}));
	}

	private void send() {
		String b = draft.trim();
		if (b.isEmpty() || chatWith == null) return;
		actions.sendMessage(chatWith, b);
		draft = "";
		chatScroll = 0;
	}

	// ===== Wejście =====

	public boolean mouseClicked(double x, double y, int button) {
		editing = null; // kliknięcie poza polem kończy pisanie (kliknięcie w pole włącza je znowu)
		for (int i = hits.size() - 1; i >= 0; i--) {
			Hit h = hits.get(i);
			if (!in(h.r, x, y)) continue;
			if (h.action == null) return true;
			if (button == 1 && h.name.startsWith("card:")) {
				openSettings(h.name.substring(5));
				return true;
			}
			if (button != 0) return true;
			if (h.action instanceof IntClick) ((IntClick) h.action).mx = x;
			h.action.run();
			return true;
		}
		return false;
	}

	/** Kółko myszy w punkcie (x, y) (MenuScreen); na każdej stronie przewija się jej lista. */
	public boolean mouseScrolled(double x, double y, double amount) {
		return mouseScrolled(amount);
	}

	public boolean mouseScrolled(double amount) {
		if (page == Page.SETTINGS) {
			settingsScroll = Math.max(0, Math.min(maxSettingsScroll, settingsScroll - (int) Math.round(amount * 18)));
			return true;
		}
		if (page == Page.COSMETICS) {
			cosScroll = Math.max(0, Math.min(maxCosScroll, cosScroll - (int) Math.round(amount * 24)));
			return true;
		}
		if (page == Page.FRIENDS) {
			friendsScroll = Math.max(0, Math.min(maxFriendsScroll, friendsScroll - (int) Math.round(amount * 24)));
			return true;
		}
		if (page == Page.CHAT) {
			chatScroll = Math.max(0, Math.min(maxChatScroll, chatScroll + (int) Math.round(amount * 20)));
			return true;
		}
		if (page != Page.GRID || layout == null) return false;
		scroll = Math.max(0, Math.min(layout.maxScroll, scroll - (int) Math.round(amount * 24)));
		return true;
	}

	public boolean keyPressed(int key) {
		TextSetting ts = editedText();
		if (ts != null) {
			ModuleState st = modules.state(selected);
			if (key == KEY_BACKSPACE) {
				String v = ts.get(st);
				if (!v.isEmpty()) {
					ts.set(st, v.substring(0, v.length() - 1));
					modules.touched(selected);
				}
				return true;
			}
			if (key == KEY_ESCAPE || key == KEY_ENTER) {
				editing = null;
				return true;
			}
		}
		if (page == Page.CHAT) {
			if (key == KEY_BACKSPACE) {
				if (!draft.isEmpty()) draft = draft.substring(0, draft.length() - 1);
				return true;
			}
			if (key == KEY_ENTER) {
				send();
				return true;
			}
			if (key == KEY_ESCAPE) {
				page = Page.FRIENDS;
				return true;
			}
		}
		if (key == KEY_ESCAPE) {
			if (page == Page.GRID) return false;
			page = Page.GRID;
			return true;
		}
		if (key == KEY_BACKSPACE && searchable() && !query.isEmpty()) {
			query = query.substring(0, query.length() - 1);
			scroll = 0;
			return true;
		}
		return false;
	}

	/** Czy gracz pisze w polu tekstowym (wtedy klawisze gry nie zamykają menu). */
	public boolean typing() {
		return editedText() != null || page == Page.CHAT;
	}

	/** Pole tekstowe, w którym właśnie się pisze (tylko na stronie ustawień jego modułu). */
	private TextSetting editedText() {
		if (editing == null || page != Page.SETTINGS || modules.def(selected) == null) return null;
		Setting<?> s = modules.def(selected).setting(editing);
		return s instanceof TextSetting ? (TextSetting) s : null;
	}

	public boolean charTyped(char ch) {
		TextSetting ts = editedText();
		if (ts != null) {
			if (ch < 32 || ch == 127) return true;
			ModuleState st = modules.state(selected);
			String v = ts.get(st);
			if (v.length() < ts.maxLength) {
				ts.set(st, v + ch);
				modules.touched(selected);
			}
			return true;
		}
		if (page == Page.CHAT) {
			if (ch >= 32 && ch != 127 && ch != '\u00a7' && draft.length() < (Friends.PARTY.equals(chatWith) ? Friends.MAX_PARTY_MESSAGE : Friends.MAX_MESSAGE)) draft += ch;
			return true;
		}
		if (!searchable() || ch < 32 || ch == 127 || query.length() >= 32) return false;
		query += ch;
		scroll = 0;
		return true;
	}

	/** Pisanie trafia do wyszukiwarki tylko na siatce modułów. */
	private boolean searchable() {
		return page == Page.GRID;
	}

	/** Czyści wyszukiwarkę (np. przy ponownym otwarciu menu). */
	public void clearQuery() {
		query = "";
		scroll = 0;
	}

}
