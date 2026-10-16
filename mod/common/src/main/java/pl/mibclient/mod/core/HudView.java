package pl.mibclient.mod.core;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import pl.mibclient.mod.core.Setting.BoolSetting;
import pl.mibclient.mod.core.Setting.ChoiceSetting;
import pl.mibclient.mod.core.Setting.ColorSetting;
import pl.mibclient.mod.core.Setting.IntSetting;
import pl.mibclient.mod.core.modules.Formats;

/**
 * HUD modułów etapu 1. Każdy element rysuje się od (0,0) swojego pudełka, a rozmiar zależy od treści.
 * W trybie edytora moduł bez danych (np. brak mikstur) pokazuje przykładową treść i ramkę.
 */
public final class HudView {
	private static final int PAD = 3, KEY = 22, KGAP = 2;

	private final ModuleManager modules;

	public HudView(ModuleManager modules) {
		this.modules = modules;
	}

	/** Pudełka włączonych elementów HUD na ekranie (jednostki GUI, rozmiar po przeskalowaniu). */
	public List<HudEditorModel.Box> layout(Canvas c, GameInfo g, int sw, int sh, HudEditorModel editor, boolean editorMode) {
		List<HudEditorModel.Box> out = new ArrayList<HudEditorModel.Box>();
		for (ModuleDef d : modules.all()) {
			if (!d.hud || !modules.isOn(d.id)) continue;
			int[] size = draw(null, c, d, g, editorMode);
			if (size[0] <= 0 || size[1] <= 0) continue;
			HudPos p = editor == null ? null : editor.pending(d.id);
			if (p == null) p = modules.state(d.id).hud(d.defaultHud);
			int w = (int) Math.ceil(size[0] * p.scale), h = (int) Math.ceil(size[1] * p.scale);
			int[] xy = HudLayout.place(p, w, h, sw, sh);
			out.add(new HudEditorModel.Box(d.id, xy[0], xy[1], w, h, p.scale));
		}
		return out;
	}

	public void render(Canvas c, GameInfo g, int sw, int sh, HudEditorModel editor, boolean editorMode) {
		if (g.hideHud() && !editorMode) return;
		List<HudEditorModel.Box> boxes = layout(c, g, sw, sh, editor, editorMode);
		if (editor != null && editorMode) editor.setBoxes(boxes, sw, sh);
		for (HudEditorModel.Box b : boxes) {
			ModuleDef d = modules.def(b.id);
			c.push((float) b.scale, b.x, b.y);
			draw(new int[] {b.x, b.y}, c, d, g, editorMode);
			c.pop();
			if (editorMode) {
				boolean drag = editor != null && editor.isDragging(b.id);
				Shapes.pixelFrame(c, b.x - 1, b.y - 1, b.w + 2, b.h + 2, 1, drag ? Theme.AM_HI : Theme.AM);
			}
		}
	}

	// ===== Elementy =====

	/** Rysuje element w at (null = tylko mierzy) i zwraca jego rozmiar {w, h} przed skalowaniem. */
	private int[] draw(int[] at, Canvas c, ModuleDef d, GameInfo g, boolean editor) {
		ModuleState st = modules.state(d.id);
		String id = d.id;
		if ("keystrokes".equals(id)) return keystrokes(at, c, d, st, g);
		if ("potion_effects".equals(id)) return potions(at, c, d, st, g, editor);
		if ("armor_status".equals(id)) return armor(at, c, d, st, g, editor);
		if ("direction".equals(id) && "strip".equals(choice(d, st, "style"))) return compass(at, c, d, st, g);
		List<String> lines = lines(d, st, g, editor);
		if (lines.isEmpty()) return new int[] {0, 0};
		return textBox(at, c, d, st, lines, color(d, st, g));
	}

	private List<String> lines(ModuleDef d, ModuleState st, GameInfo g, boolean editor) {
		String id = d.id;
		boolean pl = Lang.pl();
		if ("fps".equals(id)) return one("number_first".equals(choice(d, st, "style")) ? g.fps() + " FPS" : "FPS: " + g.fps());
		if ("cps".equals(id)) {
			long now = g.nowMs();
			String t = "CPS: " + g.leftCps().cps(now);
			return one(bool(d, st, "right") ? t + " | " + g.rightCps().cps(now) : t);
		}
		if ("ping".equals(id)) {
			int p = g.ping();
			if (p < 0 && !editor) return Collections.emptyList();
			return one("Ping: " + (p < 0 ? 24 : p) + " ms");
		}
		if ("coordinates".equals(id)) {
			List<String> l = new ArrayList<String>();
			String xyz = Formats.coords(g.x(), g.y(), g.z(), integer(d, st, "decimals"));
			l.add(bool(d, st, "facing") ? xyz + "  " + Formats.facing(g.yaw()) : xyz);
			if (bool(d, st, "biome") && g.biome() != null) l.add(g.biome());
			return l;
		}
		if ("server_address".equals(id)) {
			String a = g.serverAddress();
			if (a == null && !editor) return Collections.emptyList();
			return one(Formats.address(a == null ? "play.mib.pl" : a, bool(d, st, "port")));
		}
		if ("playtime".equals(id)) return one((pl ? "Czas gry: " : "Playtime: ") + Formats.duration(g.nowMs() - g.sessionStartMs()));
		if ("time".equals(id)) {
			int[] t = g.localTime();
			return one(Formats.clock(t[0], t[1], t[2], bool(d, st, "h24"), bool(d, st, "seconds")));
		}
		if ("direction".equals(id)) return one(Formats.facing(g.yaw()));
		if ("toggle_sprint".equals(id)) {
			if (!bool(d, st, "show")) return Collections.emptyList();
			if (g.sneakToggled() && g.sneaking()) return one("[" + Lang.t("sprint.sneak") + "]");
			if (g.sprintToggled() && g.sprinting()) return one("[" + Lang.t("sprint.sprint") + "]");
			return editor ? one("[" + Lang.t("sprint.sprint") + "]") : Collections.<String>emptyList();
		}
		return Collections.emptyList();
	}

	private int color(ModuleDef d, ModuleState st, GameInfo g) {
		if ("ping".equals(d.id) && bool(d, st, "quality_color")) return Formats.pingColor(g.ping() < 0 ? 24 : g.ping());
		return colorOpt(d, st, "color");
	}

	private int[] textBox(int[] at, Canvas c, ModuleDef d, ModuleState st, List<String> lines, int color) {
		int w = 0;
		for (String l : lines) w = Math.max(w, c.textWidth(l));
		w += 2 * PAD;
		int h = lines.size() * 10 - 1 + 2 * PAD;
		if (at == null) return new int[] {w, h};
		if (bool(d, st, "background")) c.fill(at[0], at[1], at[0] + w, at[1] + h, Theme.HUD_BG);
		for (int i = 0; i < lines.size(); i++) c.text(lines.get(i), at[0] + PAD, at[1] + PAD + i * 10, color, bool(d, st, "shadow"));
		return new int[] {w, h};
	}

	private int[] keystrokes(int[] at, Canvas c, ModuleDef d, ModuleState st, GameInfo g) {
		boolean mouse = bool(d, st, "mouse"), space = bool(d, st, "space");
		int w = 3 * KEY + 2 * KGAP, h = 2 * KEY + KGAP + (mouse ? KGAP + KEY : 0) + (space ? KGAP + 10 : 0);
		if (at == null) return new int[] {w, h};
		int x = at[0], y = at[1];
		key(c, d, st, x + KEY + KGAP, y, KEY, KEY, "W", g.key(GameInfo.Key.FORWARD));
		key(c, d, st, x, y + KEY + KGAP, KEY, KEY, "A", g.key(GameInfo.Key.LEFT));
		key(c, d, st, x + KEY + KGAP, y + KEY + KGAP, KEY, KEY, "S", g.key(GameInfo.Key.BACK));
		key(c, d, st, x + 2 * (KEY + KGAP), y + KEY + KGAP, KEY, KEY, "D", g.key(GameInfo.Key.RIGHT));
		int ny = y + 2 * (KEY + KGAP);
		if (mouse) {
			int half = (w - KGAP) / 2;
			boolean cps = bool(d, st, "mouse_cps");
			long now = g.nowMs();
			String l = cps ? g.leftCps().cps(now) + " CPS" : (Lang.pl() ? "LPM" : "LMB");
			String r = cps ? g.rightCps().cps(now) + " CPS" : (Lang.pl() ? "PPM" : "RMB");
			key(c, d, st, x, ny, half, KEY, l, g.key(GameInfo.Key.ATTACK));
			key(c, d, st, x + half + KGAP, ny, w - half - KGAP, KEY, r, g.key(GameInfo.Key.USE));
			ny += KEY + KGAP;
		}
		if (space) {
			boolean on = g.key(GameInfo.Key.JUMP);
			key(c, d, st, x, ny, w, 10, "", on);
			c.fill(x + w / 2 - 10, ny + 4, x + w / 2 + 10, ny + 5, on ? Theme.VOID : colorOpt(d, st, "color"));
		}
		return new int[] {w, h};
	}

	private void key(Canvas c, ModuleDef d, ModuleState st, int x, int y, int w, int h, String label, boolean down) {
		if (down) c.fill(x, y, x + w, y + h, colorOpt(d, st, "pressed"));
		else if (bool(d, st, "background")) c.fill(x, y, x + w, y + h, Theme.HUD_BG);
		if (label.isEmpty()) return;
		c.text(label, x + (w - c.textWidth(label)) / 2, y + (h - 8) / 2, down ? Theme.VOID : colorOpt(d, st, "color"), !down && bool(d, st, "shadow"));
	}

	private int[] potions(int[] at, Canvas c, ModuleDef d, ModuleState st, GameInfo g, boolean editor) {
		List<GameInfo.Effect> list = g.effects();
		if (list.isEmpty()) {
			if (!editor) return new int[] {0, 0};
			list = Collections.singletonList(new GameInfo.Effect(Lang.pl() ? "Szybkość" : "Speed", 1, 1800, false, null));
		}
		boolean icons = bool(d, st, "icons"), names = bool(d, st, "names");
		int rowH = icons ? 20 : 12, w = 0;
		List<String> texts = new ArrayList<String>();
		for (GameInfo.Effect e : list) {
			String time = Formats.potion(e.ticks, e.infinite);
			String t = names ? e.name + roman(e.amplifier) + "  " + time : time;
			texts.add(t);
			w = Math.max(w, (icons ? 20 : 0) + c.textWidth(t));
		}
		w += 2 * PAD;
		int h = list.size() * rowH + 2 * PAD - 2;
		if (at == null) return new int[] {w, h};
		if (bool(d, st, "background")) c.fill(at[0], at[1], at[0] + w, at[1] + h, Theme.HUD_BG);
		for (int i = 0; i < list.size(); i++) {
			int y = at[1] + PAD + i * rowH;
			if (icons && list.get(i).icon != null) c.effectIcon(list.get(i).icon, at[0] + PAD, y);
			c.text(texts.get(i), at[0] + PAD + (icons ? 20 : 0), y + (rowH - 8) / 2, colorOpt(d, st, "color"), bool(d, st, "shadow"));
		}
		return new int[] {w, h};
	}

	private static String roman(int amplifier) {
		String[] r = {"", " II", " III", " IV", " V", " VI", " VII", " VIII", " IX", " X"};
		return amplifier >= 0 && amplifier < r.length ? r[amplifier] : " " + (amplifier + 1);
	}

	private int[] armor(int[] at, Canvas c, ModuleDef d, ModuleState st, GameInfo g, boolean editor) {
		List<GameInfo.Gear> list = new ArrayList<GameInfo.Gear>();
		for (GameInfo.Gear x : g.gear()) if (!x.held || bool(d, st, "held")) list.add(x);
		if (list.isEmpty()) {
			if (!editor) return new int[] {0, 0};
			return textBox(at, c, d, st, one(d.name), colorOpt(d, st, "color"));
		}
		boolean percent = bool(d, st, "percent"), horizontal = "horizontal".equals(choice(d, st, "layout"));
		List<String> texts = new ArrayList<String>();
		int maxT = 0, sumW = 0;
		for (GameInfo.Gear x : list) {
			String t = Formats.durability(x.max, x.damage, percent);
			texts.add(t);
			maxT = Math.max(maxT, c.textWidth(t));
			sumW += 16 + (t.isEmpty() ? 0 : 2 + c.textWidth(t)) + 4;
		}
		int w = horizontal ? sumW - 4 + 2 * PAD : 16 + 2 + maxT + 2 * PAD, h = horizontal ? 16 + 2 * PAD : list.size() * 17 - 1 + 2 * PAD;
		if (at == null) return new int[] {w, h};
		if (bool(d, st, "background")) c.fill(at[0], at[1], at[0] + w, at[1] + h, Theme.HUD_BG);
		int x = at[0] + PAD, y = at[1] + PAD;
		for (int i = 0; i < list.size(); i++) {
			GameInfo.Gear gr = list.get(i);
			c.item(gr.stack, x, y);
			int left = gr.max > 0 ? (gr.max - gr.damage) * 100 / gr.max : 100;
			int col = left <= 15 ? Theme.RED : left <= 40 ? Theme.WARN : colorOpt(d, st, "color");
			c.text(texts.get(i), x + 18, y + 4, col, bool(d, st, "shadow"));
			if (horizontal) x += 16 + (texts.get(i).isEmpty() ? 0 : 2 + c.textWidth(texts.get(i))) + 4;
			else y += 17;
		}
		return new int[] {w, h};
	}

	/** Pasek kompasu: litery stron świata przesuwają się z obrotem gracza, znacznik na środku. */
	private int[] compass(int[] at, Canvas c, ModuleDef d, ModuleState st, GameInfo g) {
		int w = 120, h = 16;
		if (at == null) return new int[] {w, h};
		if (bool(d, st, "background")) c.fill(at[0], at[1], at[0] + w, at[1] + h, Theme.HUD_BG);
		double heading = ((g.yaw() + 180) % 360 + 360) % 360;
		String[] names = {"N", "NE", "E", "SE", "S", "SW", "W", "NW"};
		int mid = at[0] + w / 2, color = colorOpt(d, st, "color");
		c.scissor(at[0], at[1], at[0] + w, at[1] + h);
		for (int deg = 0; deg < 360; deg += 15) {
			double delta = ((deg - heading + 540) % 360) - 180;
			if (Math.abs(delta) > 62) continue;
			int x = mid + (int) Math.round(delta);
			if (deg % 45 == 0) {
				String n = names[deg / 45];
				c.text(n, x - c.textWidth(n) / 2, at[1] + 5, deg % 90 == 0 ? color : Theme.MUTED, bool(d, st, "shadow"));
			} else c.fill(x, at[1] + 7, x + 1, at[1] + 10, Theme.MUTED);
		}
		c.unscissor();
		c.fill(mid, at[1], mid + 1, at[1] + 3, Theme.AM);
		return new int[] {w, h};
	}

	// ===== Opcje =====

	private static List<String> one(String s) {
		return Collections.singletonList(s);
	}

	private static boolean bool(ModuleDef d, ModuleState st, String key) {
		Setting<?> s = d.setting(key);
		return s instanceof BoolSetting && ((BoolSetting) s).get(st);
	}

	private static int integer(ModuleDef d, ModuleState st, String key) {
		Setting<?> s = d.setting(key);
		return s instanceof IntSetting ? ((IntSetting) s).get(st) : 0;
	}

	private static String choice(ModuleDef d, ModuleState st, String key) {
		Setting<?> s = d.setting(key);
		return s instanceof ChoiceSetting ? ((ChoiceSetting) s).get(st) : "";
	}

	private static int colorOpt(ModuleDef d, ModuleState st, String key) {
		Setting<?> s = d.setting(key);
		return s instanceof ColorSetting ? ((ColorSetting) s).get(st) : Theme.TEXT;
	}
}
