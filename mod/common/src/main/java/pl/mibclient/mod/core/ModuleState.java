package pl.mibclient.mod.core;

import java.util.LinkedHashMap;
import java.util.Map;

/** Ustawienia jednego modułu w pliku. Odczyt nigdy nie rzuca: złe wartości dają domyślne. */
public final class ModuleState {
	public static final double MIN_SCALE = 0.5, MAX_SCALE = 3.0;

	private final Config config;
	private final String id;

	ModuleState(Config config, String id) {
		this.config = config;
		this.id = id;
	}

	public String id() {
		return id;
	}

	private Map<String, Object> node(boolean create) {
		return Config.child(config.modules(create), id, create);
	}

	public boolean enabled(boolean def) {
		Map<String, Object> n = node(false);
		Object v = n == null ? null : n.get("enabled");
		return v instanceof Boolean ? (Boolean) v : def;
	}

	public void setEnabled(boolean on) {
		node(true).put("enabled", on);
	}

	public Object option(String key) {
		Map<String, Object> o = Config.child(node(false), "options", false);
		return o == null ? null : o.get(key);
	}

	public void setOption(String key, Object value) {
		Config.child(node(true), "options", true).put(key, value);
	}

	public HudPos hud(HudPos def) {
		Map<String, Object> h = Config.child(node(false), "hud", false);
		if (h == null) return def;
		Anchor a = Anchor.parse(h.get("anchor"));
		Object x = h.get("x"), y = h.get("y"), s = h.get("scale");
		if (a == null || !(x instanceof Number) || !(y instanceof Number)) return def;
		double sc = s instanceof Number ? ((Number) s).doubleValue() : 1.0;
		if (!(sc >= MIN_SCALE && sc <= MAX_SCALE)) sc = 1.0;
		return new HudPos(a, ((Number) x).intValue(), ((Number) y).intValue(), sc);
	}

	public void setHud(HudPos p) {
		Map<String, Object> h = new LinkedHashMap<String, Object>();
		h.put("anchor", p.anchor.name());
		h.put("x", p.x);
		h.put("y", p.y);
		h.put("scale", Math.round(p.scale * 100) / 100.0);
		node(true).put("hud", h);
	}

	public void clearHud() {
		Map<String, Object> n = node(false);
		if (n != null) n.remove("hud");
	}
}
