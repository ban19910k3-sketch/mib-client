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
	void emotesPoseTheBody() {
		for (String id : Emotes.IDS) {
			float[] a = Emotes.pose(id, 0.3);
			assertNotNull(a, id);
			assertEquals(18, a.length);
			assertFalse(Float.isNaN(a[Emotes.RIGHT_ARM]), id + ": każda emotka rusza prawą ręką");
			for (float v : a) assertTrue(Float.isNaN(v) || Math.abs(v) <= Math.PI, id + ": kąt w zakresie");
		}
		assertTrue(Emotes.pose("wave", 0)[Emotes.RIGHT_ARM] < -2, "ręka w górze");
		assertTrue(Float.isNaN(Emotes.pose("wave", 0)[Emotes.RIGHT_LEG]), "machanie nie rusza nóg (chodzenie zostaje)");
		float[] kick = Emotes.pose("take_l", 0.15), kick2 = Emotes.pose("take_l", 0.47);
		assertTrue(kick[Emotes.RIGHT_LEG + 2] > 0.3 && kick2[Emotes.LEFT_LEG + 2] < -0.3, "Take the L: kopnięcia na zmianę");
		float[] f1 = Emotes.pose("floss", 0.18), f2 = Emotes.pose("floss", 0.54);
		assertTrue(f1[Emotes.RIGHT_ARM + 2] > 0 && f2[Emotes.RIGHT_ARM + 2] < 0, "Floss: ręce z boku na bok");
		assertEquals(Math.signum(f1[Emotes.RIGHT_ARM + 2]), Math.signum(f1[Emotes.LEFT_ARM + 2]), "Floss: obie ręce w tę samą stronę");
		assertTrue(Emotes.pose("dab", 1)[Emotes.HEAD] > 0.3, "Dab: głowa w dół");
		assertEquals("Take the L", Emotes.label("take_l", true));
		assertEquals("Wave", Emotes.label("wave", false));
		assertNull(Emotes.pose("nope", 0));
	}

	@Test
	void worldMarksAreRelativeToCamera() {
		WorldMarks.Quads q = new WorldMarks.Quads();
		WorldMarks.light(q, new int[] {10, 64, -3, 0xFFFF5555, 0, 0, 0, 0xFFFFFF55}, 10.5, 66, -2.5);
		assertEquals(2, q.count);
		// środek kwadratu nad blokiem (10, 64, -3), 2 bloki pod kamerą, tuż nad podłożem
		double h = WorldMarks.LIGHT_SIZE / 2;
		assertEquals(-h, q.xyz[0], 1e-6);
		assertEquals(-2 + WorldMarks.LIGHT_LIFT, q.xyz[1], 1e-6);
		assertEquals(-h, q.xyz[2], 1e-6);
		assertEquals(h, q.xyz[6], 1e-6);
		assertEquals(0x90FF5555, q.color[0]);
		assertEquals(0x90FFFF55, q.color[4]);
		// promień: 2 słupy po 4 ściany, od punktu w górę, u góry przezroczysty
		WorldMarks.Quads b = new WorldMarks.Quads();
		WorldMarks.beam(b, 0, 70, 0, 0xFF8A2BE2, 0.5, 70, 0.5);
		assertEquals(8, b.count);
		assertEquals(0, b.xyz[1], 1e-6);
		assertEquals(WorldMarks.BEAM_HEIGHT, b.xyz[7], 1e-3);
		assertEquals(0xB08A2BE2, b.color[0]);
		assertEquals(0x008A2BE2, b.color[2]);
		for (int i = 0; i < b.count * 12; i += 3) assertTrue(Math.abs(b.xyz[i]) <= WorldMarks.BEAM_GLOW + 1e-6);
		// dużo znaczników: tablice rosną
		WorldMarks.Quads many = new WorldMarks.Quads();
		int[] m = new int[400];
		WorldMarks.light(many, m, 0, 0, 0);
		assertEquals(100, many.count);
	}
}
