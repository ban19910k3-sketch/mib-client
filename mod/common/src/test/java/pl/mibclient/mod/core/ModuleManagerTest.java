package pl.mibclient.mod.core;

import static org.junit.jupiter.api.Assertions.*;

import java.io.File;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class ModuleManagerTest {
	@TempDir
	File dir;

	private ModuleManager manager() {
		return new ModuleManager(Config.load(new File(dir, "mod-config.json")), ModuleCatalog.ALL);
	}

	@Test
	void blockedModuleIsOffButSettingKept() {
		ModuleManager m = manager();
		final List<String> events = new ArrayList<String>();
		m.addListener((id, on) -> events.add(id + "=" + on));
		assertTrue(m.isOn("zoom"));
		m.setBlocked(Collections.singleton("zoom"));
		assertFalse(m.isOn("zoom"));
		assertTrue(m.isBlocked("zoom"));
		assertTrue(m.config().module("zoom").enabled(true));
		assertEquals(Collections.singletonList("zoom=false"), events);
		m.setBlocked(Collections.<String>emptySet());
		assertTrue(m.isOn("zoom"));
		assertEquals("zoom=true", events.get(1));
	}

	@Test
	void togglePersists() {
		ModuleManager m = manager();
		assertTrue(m.isOn("fps"));
		m.toggle("fps");
		assertFalse(m.isOn("fps"));
		assertFalse(manager().isOn("fps"));
	}

	@Test
	void togglingBlockedModuleChangesSettingOnly() {
		ModuleManager m = manager();
		m.setBlocked(Collections.singleton("fps"));
		final List<String> events = new ArrayList<String>();
		m.addListener((id, on) -> events.add(id));
		m.toggle("fps");
		assertFalse(m.config().module("fps").enabled(true));
		assertTrue(events.isEmpty());
	}

	@Test
	void enabledCountIgnoresBlocked() {
		ModuleManager m = manager();
		assertEquals(6, m.enabledCount());
		m.setBlocked(Collections.singleton("cps"));
		assertEquals(5, m.enabledCount());
		assertEquals(63, m.all().size());
	}

	@Test
	void unknownIdIsOff() {
		assertFalse(manager().isOn("waypoints"));
	}
}
