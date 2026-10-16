package pl.mibclient.mod.core;

import static org.junit.jupiter.api.Assertions.*;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class ConfigTest {
	@TempDir
	File dir;

	private File file() {
		return new File(dir, "mod-config.json");
	}

	private void write(String s) throws IOException {
		Files.write(file().toPath(), s.getBytes(StandardCharsets.UTF_8));
	}

	private String read() throws IOException {
		return new String(Files.readAllBytes(file().toPath()), StandardCharsets.UTF_8);
	}

	@Test
	void missingFileGivesDefaults() {
		Config c = Config.load(file());
		assertTrue(c.module("fps").enabled(true));
		assertFalse(c.module("fps").enabled(false));
		assertFalse(file().exists());
	}

	@Test
	void saveAndReload() {
		Config c = Config.load(file());
		ModuleState m = c.module("fps");
		m.setEnabled(false);
		m.setOption("color", 0xFFFFFFFFL);
		m.setHud(new HudPos(Anchor.TOP_RIGHT, 4, 6, 1.5));
		c.save();

		Config r = Config.load(file());
		ModuleState n = r.module("fps");
		assertFalse(n.enabled(true));
		assertEquals(0xFFFFFFFFL, ((Number) n.option("color")).longValue());
		assertEquals(new HudPos(Anchor.TOP_RIGHT, 4, 6, 1.5), n.hud(null));
	}

	@Test
	void corruptFileIsBackedUp() throws IOException {
		write("nie json");
		Config c = Config.load(file());
		assertTrue(c.module("fps").enabled(true));
		String[] bad = dir.list((d, n) -> n.matches("mod-config\\.json\\.bad-\\d+"));
		assertNotNull(bad);
		assertEquals(1, bad.length);
	}

	@Test
	void nonObjectRootIsBackedUp() throws IOException {
		write("[1,2,3]");
		Config c = Config.load(file());
		assertTrue(c.module("fps").enabled(true));
		assertEquals(1, dir.list((d, n) -> n.startsWith("mod-config.json.bad-")).length);
	}

	@Test
	void wrongTypesFallBackToDefaults() throws IOException {
		write("{\"modules\":{\"fps\":{\"enabled\":\"tak\",\"options\":5,\"hud\":{\"anchor\":\"XYZ\",\"x\":\"a\"}},\"cps\":7}}");
		Config c = Config.load(file());
		HudPos def = new HudPos(Anchor.TOP_LEFT, 1, 2, 1.0);
		assertTrue(c.module("fps").enabled(true));
		assertEquals(def, c.module("fps").hud(def));
		assertNull(c.module("fps").option("x"));
		assertTrue(c.module("cps").enabled(true));
		c.module("cps").setEnabled(false);
		c.save();
		assertFalse(Config.load(file()).module("cps").enabled(true));
	}

	@Test
	void unknownKeysSurviveSave() throws IOException {
		write("{\"version\":1,\"extra\":5,\"modules\":{\"waypoints\":{\"x\":1},\"fps\":{\"options\":{\"future\":true}}}}");
		Config c = Config.load(file());
		c.module("fps").setEnabled(true);
		c.save();
		Map<?, ?> root = (Map<?, ?>) Json.parse(read());
		assertEquals(5.0, ((Number) root.get("extra")).doubleValue());
		Map<?, ?> modules = (Map<?, ?>) root.get("modules");
		assertEquals(1.0, ((Number) ((Map<?, ?>) modules.get("waypoints")).get("x")).doubleValue());
		Map<?, ?> fps = (Map<?, ?>) modules.get("fps");
		assertEquals(Boolean.TRUE, ((Map<?, ?>) fps.get("options")).get("future"));
		assertEquals(Boolean.TRUE, fps.get("enabled"));
	}

	@Test
	void saveIsAtomicAndCreatesDirectory() {
		File nested = new File(new File(dir, "mib"), "mod-config.json");
		Config c = Config.load(nested);
		c.module("fps").setEnabled(true);
		c.save();
		assertTrue(nested.exists());
		assertFalse(new File(nested.getParentFile(), "mod-config.json.tmp").exists());
	}
}
