package pl.mibclient.mod.core;

import java.util.Collections;
import java.util.List;

/** Opis modułu: nazwa, kategoria, opis PL/EN, ikona, domyślny stan, położenie na HUD i opcje. */
public final class ModuleDef {
	public final String id, name, descPl, descEn, icon;
	public final Category category;
	public final boolean hud, defaultOn;
	/** null dla modułów, które nie rysują nic na HUD. */
	public final HudPos defaultHud;
	public final List<Setting<?>> settings;

	public ModuleDef(String id, String name, Category category, String descPl, String descEn, String icon, boolean defaultOn,
			HudPos defaultHud, List<Setting<?>> settings) {
		this.id = id;
		this.name = name;
		this.category = category;
		this.descPl = descPl;
		this.descEn = descEn;
		this.icon = icon;
		this.defaultOn = defaultOn;
		this.defaultHud = defaultHud;
		this.hud = defaultHud != null;
		this.settings = Collections.unmodifiableList(settings);
	}

	public String desc() {
		return Lang.pl() ? descPl : descEn;
	}

	public Setting<?> setting(String key) {
		for (Setting<?> s : settings) if (s.key.equals(key)) return s;
		return null;
	}
}
