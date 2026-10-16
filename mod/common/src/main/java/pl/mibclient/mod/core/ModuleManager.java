package pl.mibclient.mod.core;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Stan modułów: ustawienie gracza (w pliku) i blokada serwera (tylko na czas gry na danym serwerze).
 * Moduł działa, gdy gracz go włączył i serwer go nie blokuje.
 */
public final class ModuleManager {
	public interface Listener {
		void changed(String id, boolean on);
	}

	private final Config config;
	private final List<ModuleDef> modules;
	private final List<Listener> listeners = new ArrayList<Listener>();
	private Set<String> blocked = Collections.emptySet();

	public ModuleManager(Config config, List<ModuleDef> modules) {
		this.config = config;
		this.modules = modules;
	}

	public Config config() {
		return config;
	}

	public List<ModuleDef> all() {
		return modules;
	}

	public ModuleDef def(String id) {
		for (ModuleDef m : modules) if (m.id.equals(id)) return m;
		return null;
	}

	public ModuleState state(String id) {
		return config.module(id);
	}

	/** Ustawienie gracza, bez patrzenia na blokadę serwera. */
	public boolean wanted(String id) {
		ModuleDef d = def(id);
		return d != null && config.module(id).enabled(d.defaultOn);
	}

	public boolean isOn(String id) {
		return wanted(id) && !blocked.contains(id);
	}

	public boolean isBlocked(String id) {
		return blocked.contains(id);
	}

	public void toggle(String id) {
		if (def(id) == null) return;
		boolean before = isOn(id);
		config.module(id).setEnabled(!wanted(id));
		config.save();
		if (isOn(id) != before) fire(id, isOn(id));
	}

	/** Po zmianie opcji modułu: zapis i powiadomienie (np. Toggle sprint stosuje nowe opcje od razu). */
	public void touched(String id) {
		config.save();
		if (def(id) != null) fire(id, isOn(id));
	}

	public void setBlocked(Set<String> ids) {
		List<String> was = new ArrayList<String>();
		for (ModuleDef m : modules) if (isOn(m.id)) was.add(m.id);
		blocked = ids == null ? Collections.<String>emptySet() : Collections.unmodifiableSet(new HashSet<String>(ids));
		for (ModuleDef m : modules) if (was.contains(m.id) != isOn(m.id)) fire(m.id, isOn(m.id));
	}

	public int enabledCount() {
		int n = 0;
		for (ModuleDef m : modules) if (isOn(m.id)) n++;
		return n;
	}

	public void addListener(Listener l) {
		listeners.add(l);
	}

	private void fire(String id, boolean on) {
		for (Listener l : listeners) l.changed(id, on);
	}
}
