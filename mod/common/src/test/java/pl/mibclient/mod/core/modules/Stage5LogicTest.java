package pl.mibclient.mod.core.modules;

import static org.junit.jupiter.api.Assertions.*;

import java.io.File;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import pl.mibclient.mod.core.Config;
import pl.mibclient.mod.core.ModuleState;

class Stage5LogicTest {
	@TempDir
	File dir;

	@Test
	void waypointsKeepWorldAndDimension() {
		ModuleState s = Config.load(new File(dir, "c.json")).module("waypoints");
		assertTrue(Waypoints.add(s, "mp:a", "minecraft:overworld", 1, 64, 2, "Punkt"));
		assertTrue(Waypoints.add(s, "mp:a", "minecraft:the_nether", 5, 70, 5, "Punkt"));
		assertTrue(Waypoints.add(s, "sp:Świat", "minecraft:overworld", 0, 0, 0, "Punkt"));
		List<Waypoints.Point> here = Waypoints.in(s, "mp:a", "minecraft:overworld");
		assertEquals(1, here.size());
		assertEquals("Punkt 1", here.get(0).name);
		assertEquals("Punkt 2", Waypoints.in(s, "mp:a", "minecraft:the_nether").get(0).name);
		assertEquals("Punkt 1", Waypoints.in(s, "sp:Świat", "minecraft:overworld").get(0).name);
		Waypoints.remove(s, "mp:a", "minecraft:overworld", 0);
		assertTrue(Waypoints.in(s, "mp:a", "minecraft:overworld").isEmpty());
		assertEquals(2, Waypoints.all(s).size());
		// złe wpisy w pliku nie psują listy
		s.setOption(Waypoints.KEY, Arrays.asList("zły", null));
		assertTrue(Waypoints.all(s).isEmpty());
	}

	@Test
	void waypointLimit() {
		ModuleState s = Config.load(new File(dir, "c.json")).module("waypoints");
		for (int i = 0; i < Waypoints.MAX; i++) assertTrue(Waypoints.add(s, "w", "d", i, 0, 0, "P"));
		assertFalse(Waypoints.add(s, "w", "d", 0, 0, 0, "P"));
	}

	@Test
	void projectionPutsPointsOnScreen() {
		// patrzymy na południe (+Z), punkt 10 bloków przed nami: środek ekranu
		double[] p = Waypoints.project(0, 0, 10, 0, 0, 0, 0f, 0f, 70, 400, 200);
		assertEquals(200, p[0], 0.01);
		assertEquals(100, p[1], 0.01);
		assertEquals(10, p[2], 0.01);
		// za plecami: brak
		assertNull(Waypoints.project(0, 0, -10, 0, 0, 0, 0f, 0f, 70, 400, 200));
		// na wschód (+X) przy patrzeniu na południe: po lewej stronie ekranu
		assertTrue(Waypoints.project(3, 0, 10, 0, 0, 0, 0f, 0f, 70, 400, 200)[0] < 200);
		// wyżej: wyżej na ekranie
		assertTrue(Waypoints.project(0, 3, 10, 0, 0, 0, 0f, 0f, 70, 400, 200)[1] < 100);
		// patrzymy na zachód (yaw 90 = -X): punkt na zachodzie na środku
		double[] w = Waypoints.project(-10, 0, 0, 0, 0, 0, 90f, 0f, 70, 400, 200);
		assertEquals(200, w[0], 0.01);
		// patrzymy w dół (pitch 90): punkt pod nami na środku
		double[] d = Waypoints.project(0, -10, 0, 0, 0, 0, 0f, 90f, 70, 400, 200);
		assertEquals(200, d[0], 0.01);
		assertEquals(100, d[1], 0.01);
	}

	@Test
	void tiersFromMcTiersRankings() {
		String json = "{\"sword\":{\"tier\":3,\"pos\":1,\"peak_tier\":2,\"peak_pos\":0,\"attained\":1,\"retired\":false},"
				+ "\"vanilla\":{\"tier\":2,\"pos\":0,\"peak_tier\":null,\"peak_pos\":null,\"attained\":1,\"retired\":false},"
				+ "\"uhc\":{\"tier\":4,\"pos\":0,\"peak_tier\":1,\"peak_pos\":1,\"attained\":1,\"retired\":true}}";
		assertEquals("RLT1", Tiers.tier(json, "best"));
		assertEquals("LT3", Tiers.tier(json, "sword"));
		assertEquals("HT2", Tiers.tier(json, "vanilla"));
		assertNull(Tiers.tier(json, "mace"));
		assertNull(Tiers.tier("{}", "best"));
		assertNull(Tiers.tier("not json", "best"));
		assertNull(Tiers.tier("[1,2]", "best"));
		assertEquals(0xE8BA3A, Tiers.color("HT1"));
		assertEquals(0xA2D6FF, Tiers.color("RHT2"));
	}

	@Test
	void lightLevelMarks() {
		assertEquals(WorldOverlay.NONE, WorldOverlay.lightColor(5, 0));
		assertEquals(0xFFFF5555, WorldOverlay.lightColor(0, 0));
		assertEquals(0xFFFFFF55, WorldOverlay.lightColor(0, 15));
	}

	@Test
	void shortF3() {
		List<String> left = Arrays.asList("Minecraft 1.21 (1.21/vanilla)", "60 fps T: 120 vsync", "Integrated server @ 5 ms", "C: 100/200",
				"XYZ: 1 / 2 / 3", "Block: 1 2 3", "Chunk: 0 0 0", "Facing: north", "Client Light: 15", "Biome: minecraft:plains", "Local Difficulty: 1");
		assertEquals(Arrays.asList("Minecraft 1.21 (1.21/vanilla)", "60 fps T: 120 vsync", "XYZ: 1 / 2 / 3", "Block: 1 2 3", "Facing: north",
				"Client Light: 15", "Biome: minecraft:plains"), WorldOverlay.debugLines(left, true, true, false));
		assertSame(left, WorldOverlay.debugLines(left, true, false, true));
		assertTrue(WorldOverlay.debugLines(Arrays.asList("Java: 21"), false, true, true).isEmpty());
		assertEquals(1, WorldOverlay.debugLines(Arrays.asList("Java: 21"), false, true, false).size());
	}

	@Test
	void emotesMoveArms() {
		for (String id : new String[] {"wave", "dance", "clap", "point", "cheer"}) {
			float[] a = WorldOverlay.emote(id, 0.3);
			assertNotNull(a, id);
			assertEquals(4, a.length);
		}
		assertTrue(WorldOverlay.emote("wave", 0)[0] < -2, "ręka w górze");
		assertNull(WorldOverlay.emote("nope", 0));
	}
}
