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
 * Menu pod prawym Shiftem (makieta A): kategorie, wyszukiwarka, karty modułów, ustawienia modułu i zmiana konta.
 * Rysuje przez Canvas w jednostkach menu; kliknięcia trafiają w te same prostokąty, które zostały narysowane.
 */
public final class MenuView {
	public enum Page { GRID, SETTINGS, ACCOUNTS, COSMETICS }

	public static final int KEY_ESCAPE = 256, KEY_BACKSPACE = 259, KEY_ENTER = 257;
	private static final int FAINT = 0xFF6F5F82, WHITE = 0xFFFFFFFF;
	/** Tło karty włączonego modułu (lekko fioletowe). */
	private static final int CARD_ON = 0xFF160A24;
	/** Linia między wierszami ustawień. */
	private static final int ROW_LINE = 0xFF150B20;

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
	private int scroll, settingsScroll, maxSettingsScroll, cosScroll, maxCosScroll;
	private MenuLayout layout;

	public MenuView(ModuleManager modules, MenuActions actions) {
		this.modules = modules;
		this.actions = actions;
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

	public void render(Canvas c, int w, int h, int mx, int my) {
		hits.clear();
		List<ModuleDef> vis = visible();
		layout = MenuLayout.compute(w, h, vis.size(), scroll);
		scroll = layout.scroll;
		c.fill(0, 0, w, h, Theme.DIM);
		int[] p = layout.panel;
		Shapes.panel(c, p[0], p[1], p[2], p[3], Theme.VOID, Theme.EDGE2);
		sidebar(c, mx, my);
		if (page == Page.SETTINGS && modules.def(selected) != null) settings(c, mx, my);
		else if (page == Page.ACCOUNTS) accounts(c, mx, my);
		else if (page == Page.COSMETICS) cosmetics(c, mx, my);
		else {
			page = Page.GRID;
			grid(c, vis, mx, my);
		}
	}

	private static boolean in(int[] r, double x, double y) {
		return x >= r[0] && x < r[0] + r[2] && y >= r[1] && y < r[1] + r[3];
	}

	private void sidebar(Canvas c, int mx, int my) {
		int[] s = layout.sidebar;
		c.fill(s[0] + 1, s[1] + 1, s[0] + s[2], s[1] + s[3] - 1, Theme.SLAB);
		c.fill(s[0] + s[2], s[1] + 1, s[0] + s[2] + 1, s[1] + s[3] - 1, Theme.EDGE);
		c.text("MiB Client", s[0] + 10, s[1] + 10, Theme.AM_HI, true);
		c.text(Lang.pl() ? "Moduły" : "Modules", s[0] + 10, s[1] + 21, Theme.MUTED, false);
		language(c, s, mx, my);

		List<Category> cats = new ArrayList<Category>();
		cats.add(null);
		cats.addAll(categories());
		for (int i = 0; i < cats.size(); i++) {
			final Category k = cats.get(i);
			int[] r = layout.category(i);
			boolean on = (searching() ? k == null : k == category) && page == Page.GRID, hover = in(r, mx, my);
			if (on || hover) c.fill(r[0], r[1], r[0] + r[2], r[1] + r[3], Theme.SLAB2);
			if (on) c.fill(r[0], r[1], r[0] + 2, r[1] + r[3], Theme.AM);
			Shapes.icon(c, k == null ? "grid-3x3" : k.icon, r[0] + 6, r[1] + 2, on ? Theme.AM_HI : Theme.MUTED);
			String label = k == null ? Lang.t("menu.all") : k.label(), n = String.valueOf(count(k));
			c.text(Shapes.ellipsize(c, label, r[2] - 30 - c.textWidth(n) - 6, false), r[0] + 22, r[1] + 4, on || hover ? Theme.TEXT : Theme.MUTED, false);
			c.text(n, r[0] + r[2] - 6 - c.textWidth(n), r[1] + 4, FAINT, false);
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

		int slot = 0;
		boolean acc = !actions.accounts().isEmpty();
		if (acc) {
			int[] r = layout.sidebarButton(slot++);
			button(c, r, "users", Lang.t("menu.accounts"), false, in(r, mx, my));
			hits.add(new Hit("accounts", r, new Runnable() {
				@Override
				public void run() {
					page = Page.ACCOUNTS;
				}
			}));
		}
		if (actions.cosmetics() != null) {
			int[] r = layout.sidebarButton(slot++);
			button(c, r, "archive", Lang.t("menu.cosmetics"), false, in(r, mx, my));
			hits.add(new Hit("cosmetics", r, new Runnable() {
				@Override
				public void run() {
					page = Page.COSMETICS;
				}
			}));
		}
		int[] e = layout.sidebarButton(slot);
		button(c, e, "move", Lang.t("menu.edit_hud"), true, in(e, mx, my));
		hits.add(new Hit("edit_hud", e, new Runnable() {
			@Override
			public void run() {
				actions.openHudEditor(null);
			}
		}));
	}

	/** Język menu w rogu panelu bocznego: PL / EN / AUTO, kliknięcie zmienia na następny. */
	private void language(Canvas c, int[] s, int mx, int my) {
		String cur = Lang.chosen(), label = "auto".equals(cur) ? "AUTO" : cur.toUpperCase(java.util.Locale.ROOT);
		int w = c.textWidth(label) + 10, h = 12;
		final int[] r = {s[0] + s[2] - 8 - w, s[1] + 9, w, h};
		boolean hover = in(r, mx, my);
		Shapes.panel(c, r[0], r[1], r[2], r[3], hover ? Theme.SLAB2 : Theme.SLAB, hover ? Theme.AM : Theme.EDGE2);
		c.text(label, r[0] + 5, r[1] + 2, hover ? Theme.AM_HI : Theme.MUTED, false);
		hits.add(new Hit("lang", r, new Runnable() {
			@Override
			public void run() {
				String cur = Lang.chosen(), next = "auto".equals(cur) ? "pl" : "pl".equals(cur) ? "en" : "auto";
				Lang.choose(next);
				actions.languageChosen(next);
			}
		}));
	}

	/** Przycisk jak w launcherze: główny (fiolet z jaśniejszą górą i ciemniejszym dołem) albo „ghost”. */
	private void button(Canvas c, int[] r, String icon, String label, boolean primary, boolean hover) {
		if (primary) {
			Shapes.pixelRect(c, r[0], r[1], r[2], r[3], hover ? 0xFF7C3AED : Theme.AM_LO);
			c.fill(r[0] + 1, r[1], r[0] + r[2] - 1, r[1] + 1, Theme.BTN_HI);
			c.fill(r[0] + 1, r[1] + r[3] - 1, r[0] + r[2] - 1, r[1] + r[3], Theme.BTN_LO);
		} else Shapes.panel(c, r[0], r[1], r[2], r[3], Theme.SLAB2, hover ? Theme.AM_LO : Theme.EDGE2);
		int iw = icon == null ? 0 : 14;
		String t = Shapes.ellipsize(c, label, r[2] - 8 - iw, false);
		int x = r[0] + (r[2] - iw - c.textWidth(t)) / 2;
		if (icon != null) Shapes.icon(c, icon, x, r[1] + (r[3] - 12) / 2, WHITE);
		c.text(t, x + iw, r[1] + (r[3] - 8) / 2, WHITE, primary);
	}

	private void grid(Canvas c, List<ModuleDef> vis, int mx, int my) {
		int[] s = layout.search;
		Shapes.panel(c, s[0], s[1], s[2], s[3], Theme.SLAB2, Theme.EDGE2);
		Shapes.icon(c, "search", s[0] + 3, s[1] + 2, Theme.MUTED);
		String shown = query.isEmpty() ? Lang.t("menu.search") : query + "_";
		c.text(Shapes.ellipsize(c, shown, s[2] - 24, false), s[0] + 18, s[1] + 4, query.isEmpty() ? FAINT : Theme.TEXT, false);
		hits.add(new Hit("search", s, null));
		if (layout.showCount) {
			String n = Lang.t("menu.enabled", modules.enabledCount(), modules.all().size());
			int[] ct = layout.content;
			c.text(n, ct[0] + ct[2] - c.textWidth(n), s[1] + 4, Theme.MUTED, false);
		}

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
			int x = g[0] + g[2] + 4, thumb = Math.max(12, g[3] * g[3] / (g[3] + layout.maxScroll));
			int y = g[1] + (g[3] - thumb) * layout.scroll / layout.maxScroll;
			c.fill(x, g[1], x + 2, g[1] + g[3], Theme.EDGE);
			c.fill(x, y, x + 2, y + thumb, Theme.AM_LO);
		}
	}

	/**
	 * Karta modułu: kafelek z ikoną (wypełniony fioletem, gdy moduł działa), pod nim nazwa i opis w dwóch liniach, na dole
	 * stan słowem i przełącznik. Włączone karty mają jaśniejszą ramkę, więc na liście od razu widać, co działa.
	 */
	private void card(Canvas c, final ModuleDef m, int[] r, int mx, int my, boolean mouseInGrid) {
		boolean on = modules.isOn(m.id), blocked = modules.isBlocked(m.id), hover = mouseInGrid && in(r, mx, my);
		int x = r[0], y = r[1], w = r[2], h = r[3];
		Shapes.panel(c, x, y, w, h, on ? CARD_ON : hover ? Theme.SLAB2 : Theme.SLAB, on ? (hover ? Theme.AM_HI : Theme.AM) : hover ? Theme.EDGE2 : Theme.EDGE);
		if (on) c.fill(x + 2, y + 1, x + w - 2, y + 2, Theme.AM_LO);
		// kafelek ikony 18×18
		int tx = x + 6, ty = y + 6;
		if (on) {
			Shapes.pixelRect(c, tx, ty, 18, 18, Theme.AM_LO);
			c.fill(tx + 1, ty, tx + 17, ty + 1, Theme.BTN_HI);
		} else Shapes.panel(c, tx, ty, 18, 18, Theme.SLAB2, Theme.EDGE2);
		Shapes.icon(c, m.icon, tx + 3, ty + 3, on ? WHITE : blocked ? FAINT : Theme.MUTED);
		int[] gear = {x + w - 6 - 14, y + 7, 14, 14};
		boolean gearHover = in(gear, mx, my);
		Shapes.icon(c, "settings-cog", gear[0] + 1, gear[1] + 1, gearHover ? Theme.AM_HI : hover ? Theme.MUTED : FAINT);
		c.text(Shapes.ellipsize(c, m.name, w - 12, false), x + 6, y + 28, blocked ? Theme.MUTED : on ? WHITE : Theme.TEXT, on);
		String[] lines = Shapes.wrap(c, m.desc(), w - 12, 2);
		for (int i = 0; i < lines.length; i++) c.text(lines[i], x + 6, y + 39 + i * 10, Theme.MUTED, false);
		// dolny pasek: stan i przełącznik (kliknięcie w całym pasku)
		int[] pill = {x + 1, y + h - 19, w - 2, 18};
		c.fill(x + 6, pill[1], x + w - 6, pill[1] + 1, on ? 0xFF3B1F5E : Theme.EDGE);
		int ly = pill[1] + 6;
		if (blocked) {
			Shapes.icon(c, "lock", x + 5, ly - 2, FAINT);
			c.text(Shapes.ellipsize(c, Lang.t("menu.blocked_short"), w - 26, false), x + 19, ly, FAINT, false);
		} else {
			c.text(Lang.t(on ? "menu.on" : "menu.off"), x + 6, ly, on ? Theme.AM_HI : FAINT, false);
			toggle(c, x + w - 6 - 20, ly - 1, on);
		}
		int[] g = layout.grid;
		if (r[1] < g[1] || r[1] + r[3] > g[1] + g[3]) return; // karta częściowo schowana: nie da się jej kliknąć
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

	private void header(Canvas c, String title, int mx, int my) {
		header(c, title, null, false, mx, my);
	}

	/** Pasek u góry strony: strzałka powrotu, kafelek z ikoną (gdy jest) i tytuł. */
	private void header(Canvas c, String title, String icon, boolean on, int mx, int my) {
		int[] ct = layout.content;
		int[] back = {ct[0], ct[1], 16, 16};
		Shapes.panel(c, back[0], back[1], back[2], back[3], in(back, mx, my) ? Theme.SLAB2 : Theme.SLAB, Theme.EDGE2);
		Shapes.icon(c, "arrow-left", back[0] + 2, back[1] + 2, Theme.TEXT);
		hits.add(new Hit("back", back, new Runnable() {
			@Override
			public void run() {
				page = Page.GRID;
			}
		}));
		int tx = ct[0] + 22;
		if (icon != null) {
			if (on) {
				Shapes.pixelRect(c, tx, ct[1], 16, 16, Theme.AM_LO);
				c.fill(tx + 1, ct[1], tx + 15, ct[1] + 1, Theme.BTN_HI);
			} else Shapes.panel(c, tx, ct[1], 16, 16, Theme.SLAB2, Theme.EDGE2);
			Shapes.icon(c, icon, tx + 2, ct[1] + 2, on ? WHITE : Theme.MUTED);
			tx += 22;
		}
		c.text(title, tx, ct[1] + 4, WHITE, true);
	}

	private void toggle(Canvas c, int x, int y, boolean on) {
		Shapes.pixelRect(c, x, y, 20, 10, on ? Theme.AM : Theme.OFF);
		c.fill(on ? x + 12 : x + 2, y + 2, on ? x + 18 : x + 8, y + 8, on ? WHITE : FAINT);
	}

	static final int PREVIEW = 64;

	/** Podgląd celownika na tle nieba, w powiększeniu ×2 (jak w grze przy dużej skali GUI). */
	private void crosshairPreview(Canvas c, ModuleDef m, ModuleState st, int x, int y) {
		int s = PREVIEW;
		Shapes.panel(c, x, y, s, s + 12, Theme.SLAB, Theme.EDGE2);
		c.fill(x + 2, y + 2, x + s - 2, y + s / 2, 0xFF7BA4E0);
		c.fill(x + 2, y + s / 2, x + s - 2, y + s - 2, 0xFF5E8F3A);
		String t = Lang.t("menu.preview");
		c.text(t, x + (s - c.textWidth(t)) / 2, y + s + 1, Theme.MUTED, false);
		int cx = x + s / 2, cy = y + s / 2;
		int color = ((Setting.ColorSetting) m.setting("color")).get(st);
		java.util.List<int[]> rects = pl.mibclient.mod.core.modules.CrosshairShape.rects(((Setting.ChoiceSetting) m.setting("shape")).get(st),
				((Setting.IntSetting) m.setting("size")).get(st), ((Setting.IntSetting) m.setting("thickness")).get(st),
				((Setting.IntSetting) m.setting("gap")).get(st), ((Setting.BoolSetting) m.setting("dot")).get(st),
				((Setting.BoolSetting) m.setting("outline")).get(st));
		// ×2, a duży celownik pomniejszony, żeby zmieścił się w okienku
		int ext = 1;
		for (int[] r : rects) ext = Math.max(ext, Math.max(Math.max(-r[0], r[2]), Math.max(-r[1], r[3])));
		float k = Math.min(2f, (s / 2f - 4) / ext);
		c.scissor(x + 2, y + 2, x + s - 2, y + s - 2);
		c.push(k, cx, cy);
		for (int[] r : rects) c.fill(cx + r[0], cy + r[1], cx + r[2], cy + r[3], r[4] == 1 ? 0xFF000000 : color);
		c.pop();
		c.unscissor();
	}

	private void settings(Canvas c, int mx, int my) {
		final ModuleDef m = modules.def(selected);
		final ModuleState st = modules.state(m.id);
		int[] ct = layout.content;
		header(c, m.name, m.icon, modules.isOn(m.id), mx, my);
		int right = ct[0] + ct[2];
		final boolean blocked = modules.isBlocked(m.id);
		int[] sw = {right - 20, ct[1] + 3, 20, 10};
		if (blocked) {
			String t = Lang.t("menu.blocked");
			Shapes.icon(c, "lock", right - c.textWidth(t) - 14, ct[1] + 2, Theme.MUTED);
			c.text(t, right - c.textWidth(t), ct[1] + 4, Theme.MUTED, false);
		} else {
			toggle(c, sw[0], sw[1], modules.isOn(m.id));
			hits.add(new Hit("toggle", sw, new Runnable() {
				@Override
				public void run() {
					modules.toggle(m.id);
				}
			}));
		}
		String[] desc = Shapes.wrap(c, m.desc(), ct[2], 2);
		for (int i = 0; i < desc.length; i++) c.text(desc[i], ct[0], ct[1] + 22 + i * 10, Theme.MUTED, false);

		int top = ct[1] + 46, bottom = ct[1] + ct[3] - 22;
		// Custom crosshair: podgląd celownika obok ustawień, zmienia się od razu
		boolean preview = "custom_crosshair".equals(m.id);
		int listRight = preview ? right - PREVIEW - 8 : right;
		final boolean wp = "waypoints".equals(m.id);
		final String world = wp ? actions.worldKey() : null, dim = wp ? actions.dimension() : null;
		final List<Waypoints.Point> points = world == null ? java.util.Collections.<Waypoints.Point>emptyList() : Waypoints.in(st, world, dim);
		int extra = wp ? 1 + Math.max(1, points.size()) : 0;
		int listH = (m.settings.size() + extra) * 18;
		maxSettingsScroll = Math.max(0, listH - (bottom - top));
		settingsScroll = Math.max(0, Math.min(maxSettingsScroll, settingsScroll));
		c.scissor(ct[0], top, listRight, bottom);
		for (int i = 0; i < m.settings.size(); i++) {
			int y = top + i * 18 - settingsScroll;
			if (y + 18 <= top || y >= bottom) continue;
			row(c, m, st, m.settings.get(i), y, ct[0], listRight, mx, my, y >= top && y + 18 <= bottom);
		}
		if (wp) waypointRows(c, st, world, dim, points, top + m.settings.size() * 18 - settingsScroll, top, bottom, ct[0], listRight, mx, my);
		c.unscissor();
		if (preview) crosshairPreview(c, m, st, right - PREVIEW, top);

		if (m.hud) {
			String t = Lang.t("menu.place");
			int[] b = {ct[0], ct[1] + ct[3] - 16, c.textWidth(t) + 28, 16};
			button(c, b, "move", t, true, in(b, mx, my));
			hits.add(new Hit("place", b, new Runnable() {
				@Override
				public void run() {
					actions.openHudEditor(m.id);
				}
			}));
		} else if (wp) {
			String t = Lang.t("wp.add");
			final int[] b = {ct[0], ct[1] + ct[3] - 16, c.textWidth(t) + 28, 16};
			if (world != null) {
				button(c, b, "flag", t, true, in(b, mx, my));
				hits.add(new Hit("wp_add", b, new Runnable() {
					@Override
					public void run() {
						int[] p = actions.playerBlockPos();
						if (p != null && Waypoints.add(st, world, dim, p[0], p[1], p[2], Lang.t("wp.name"))) modules.touched(m.id);
					}
				}));
			} else c.text(Lang.t("wp.no_world"), ct[0], ct[1] + ct[3] - 12, FAINT, false);
		} else if ("zoom".equals(m.id) || "perspective".equals(m.id)) {
			c.text(Lang.t("menu.key_hint"), ct[0], ct[1] + ct[3] - 12, FAINT, false);
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

	private void row(Canvas c, final ModuleDef m, final ModuleState st, final Setting<?> s, int y, int left, int right, int mx, int my,
			boolean clickable) {
		// wiersz podświetlony pod myszą, cienka linia między wierszami, treść z wcięciem
		if (clickable && mx >= left && mx < right && my >= y && my < y + 18) c.fill(left, y, right, y + 18, Theme.SLAB);
		c.fill(left, y + 18 - 1, right, y + 18, ROW_LINE);
		left += 6;
		right -= 6;
		c.text(Shapes.ellipsize(c, s.label(), (right - left) / 2 - 6, false), left, y + 5, Theme.TEXT, false);
		if (s instanceof BoolSetting) {
			final BoolSetting b = (BoolSetting) s;
			int[] r = {right - 20, y + 4, 20, 10};
			toggle(c, r[0], r[1], b.get(st));
			if (clickable) hits.add(new Hit("setting:" + s.key, new int[] {right - 24, y, 24, 18}, new Runnable() {
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
			final int tx = left + (right - left) / 2, tw = right - tx - 34;
			c.fill(tx, y + 8, tx + tw, y + 10, Theme.OFF);
			int kx = tx + (int) Math.round((v - is.min) / (double) Math.max(1, is.max - is.min) * tw);
			c.fill(tx, y + 8, kx, y + 10, Theme.AM);
			c.fill(kx - 1, y + 4, kx + 2, y + 14, WHITE);
			c.text(val, right - c.textWidth(val), y + 5, Theme.MUTED, false);
			if (clickable) hits.add(new Hit("setting:" + s.key, new int[] {tx - 3, y, tw + 6, 18}, new IntClick(is, st, m.id, tx, tw)));
		} else if (s instanceof ChoiceSetting) {
			final ChoiceSetting cs = (ChoiceSetting) s;
			String t = cs.valueLabel(cs.get(st));
			int bw = c.textWidth(t) + 16;
			int[] r = {right - bw, y + 1, bw, 16};
			Shapes.panel(c, r[0], r[1], r[2], r[3], in(r, mx, my) ? Theme.SLAB2 : Theme.SLAB, Theme.EDGE2);
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
			boolean active = s.key.equals(editing) && m.id.equals(selected);
			final int[] r = {left + (right - left) / 2, y + 1, (right - left) / 2, 16};
			Shapes.panel(c, r[0], r[1], r[2], r[3], Theme.SLAB2, active ? Theme.AM : in(r, mx, my) ? Theme.AM_LO : Theme.EDGE2);
			String v = ts.get(st) + (active ? "_" : "");
			String shown = c.textWidth(v) > r[2] - 10 ? "…" + tail(c, v, r[2] - 16) : v;
			c.text(shown, r[0] + 5, r[1] + 4, v.isEmpty() ? FAINT : Theme.TEXT, false);
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
			for (int i = 0; i < pal.length; i++) {
				final int color = pal[i];
				int x = right - (pal.length - i) * 14 + 4;
				if (color == cur) Shapes.pixelFrame(c, x - 2, y + 2, 14, 14, 1, WHITE);
				Shapes.pixelRect(c, x, y + 4, 10, 10, color);
				if (clickable) hits.add(new Hit("setting:" + s.key + ":" + i, new int[] {x - 2, y + 2, 14, 14}, new Runnable() {
					@Override
					public void run() {
						cs.set(st, color);
						modules.touched(m.id);
					}
				}));
			}
		}
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
			Shapes.panel(c, ct[0], y, ct[2], 20, Theme.SLAB, a.active ? Theme.AM_LO : Theme.EDGE);
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

	/** Kosmetyki z profilu MiB: peleryny można zakładać i zdejmować, reszta jest na razie tylko w launcherze. */
	private void cosmetics(Canvas c, int mx, int my) {
		int[] ct = layout.content;
		header(c, Lang.t("menu.cosmetics"), mx, my);
		Cosmetics cs = actions.cosmetics();
		int y = ct[1] + 40;
		if (cs == null || !cs.loggedIn || cs.items.isEmpty()) {
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
		int top = y, bottom = ct[1] + ct[3] - (msg != null ? 22 : 2);
		maxCosScroll = Math.max(0, items.size() * 24 - 4 - (bottom - top));
		cosScroll = Math.max(0, Math.min(maxCosScroll, cosScroll));
		c.scissor(ct[0], top, ct[0] + ct[2], bottom);
		y = top - cosScroll;
		for (final Cosmetics.Item it : items) {
			if (y + 20 <= top || y >= bottom) {
				y += 24;
				continue;
			}
			boolean clickable = y >= top && y + 20 <= bottom;
			Shapes.panel(c, ct[0], y, ct[2], 20, Theme.SLAB, it.equipped ? Theme.AM_LO : Theme.EDGE);
			String kind = Lang.t("cos." + ("hat".equals(it.type) || "wings".equals(it.type) ? it.type : "cape"));
			c.text(Shapes.ellipsize(c, it.name, ct[2] - 150, false), ct[0] + 8, y + 6, Theme.TEXT, false);
			c.text(kind, ct[0] + ct[2] - 140, y + 6, FAINT, false);
			{
				String t = Lang.t(it.equipped ? "cos.unequip" : "cos.equip");
				int[] b = {ct[0] + ct[2] - 4 - (c.textWidth(t) + 16), y + 2, c.textWidth(t) + 16, 16};
				button(c, b, null, t, !it.equipped, in(b, mx, my));
				if (it.equipped) {
					String on = Lang.t("cos.on");
					c.text(on, b[0] - 6 - c.textWidth(on), y + 6, Theme.AM_HI, false);
				}
				if (clickable) hits.add(new Hit("cos:" + it.id, b, new Runnable() {
					@Override
					public void run() {
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

	public boolean mouseScrolled(double amount) {
		if (page == Page.SETTINGS) {
			settingsScroll = Math.max(0, Math.min(maxSettingsScroll, settingsScroll - (int) Math.round(amount * 18)));
			return true;
		}
		if (page == Page.COSMETICS) {
			cosScroll = Math.max(0, Math.min(maxCosScroll, cosScroll - (int) Math.round(amount * 24)));
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
		if (key == KEY_ESCAPE) {
			if (page == Page.GRID) return false;
			page = Page.GRID;
			return true;
		}
		if (key == KEY_BACKSPACE && page == Page.GRID && !query.isEmpty()) {
			query = query.substring(0, query.length() - 1);
			scroll = 0;
			return true;
		}
		return false;
	}

	/** Czy gracz pisze w polu tekstowym (wtedy klawisze gry nie zamykają menu). */
	public boolean typing() {
		return editedText() != null;
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
		if (page != Page.GRID || ch < 32 || ch == 127 || query.length() >= 32) return false;
		query += ch;
		scroll = 0;
		return true;
	}

	/** Czyści wyszukiwarkę (np. przy ponownym otwarciu menu). */
	public void clearQuery() {
		query = "";
		scroll = 0;
	}

}
