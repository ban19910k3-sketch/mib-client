package pl.mibclient.mod.core.modules;

import static org.junit.jupiter.api.Assertions.*;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import org.junit.jupiter.api.Test;

class Stage34LogicTest {
	@Test
	void tntFuse() {
		assertEquals("4.0 s", Labels.fuse(80));
		assertEquals("0.1 s", Labels.fuse(2));
		assertEquals("0.0 s", Labels.fuse(-5));
		assertEquals(Labels.GREEN, Labels.fuseColor(60));
		assertEquals(Labels.YELLOW, Labels.fuseColor(30));
		assertEquals(Labels.RED, Labels.fuseColor(10));
	}

	@Test
	void itemDespawn() {
		assertEquals("5:00", Labels.despawn(0));
		assertEquals("4:59", Labels.despawn(20));
		assertEquals("0:01", Labels.despawn(5999));
		assertEquals("0:00", Labels.despawn(7000));
		assertNull(Labels.despawn(Labels.ITEM_FOREVER));
		assertEquals(Labels.WHITE, Labels.despawnColor(0));
		assertEquals(Labels.YELLOW, Labels.despawnColor(6000 - 50 * 20));
		assertEquals(Labels.RED, Labels.despawnColor(6000 - 10 * 20));
	}

	@Test
	void mobHealth() {
		assertEquals("20", Labels.health(20f));
		assertEquals("7.5", Labels.health(7.5f));
		assertEquals("3", Labels.health(3.1f));
		assertEquals(Labels.GREEN, Labels.healthColor(20, 20));
		assertEquals(Labels.YELLOW, Labels.healthColor(10, 20));
		assertEquals(Labels.RED, Labels.healthColor(2, 20));
		assertEquals(Labels.RED, Labels.healthColor(2, 0));
	}

	@Test
	void pingAndTime() {
		assertEquals(Labels.GREEN, Labels.pingColor(40));
		assertEquals(Labels.YELLOW, Labels.pingColor(120));
		assertEquals(Labels.GOLD, Labels.pingColor(250));
		assertEquals(Labels.RED, Labels.pingColor(900));
		assertEquals(6000, Labels.timeOfDay("noon"));
		assertEquals(18000, Labels.timeOfDay("midnight"));
		assertEquals(6000, Labels.timeOfDay("???"));
	}

	@Test
	void dropGuard() {
		assertTrue(DropGuard.valuable("minecraft:diamond_sword", false, true, false, false, false));
		assertTrue(DropGuard.valuable("minecraft:netherite_chestplate", false, true, false, false, false));
		assertTrue(DropGuard.valuable("minecraft:elytra", false, true, false, false, false));
		assertFalse(DropGuard.valuable("minecraft:diamond_sword", false, false, true, true, true));
		assertTrue(DropGuard.valuable("minecraft:stick", true, false, true, false, false));
		assertFalse(DropGuard.valuable("minecraft:stick", true, true, false, true, true));
		assertTrue(DropGuard.valuable("minecraft:totem_of_undying", false, false, false, true, false));
		assertTrue(DropGuard.valuable("minecraft:purple_shulker_box", false, false, false, false, true));
		assertTrue(DropGuard.valuable("minecraft:shulker_box", false, false, false, false, true));
		assertFalse(DropGuard.valuable("minecraft:dirt", false, true, true, true, true));
		assertFalse(DropGuard.valuable(null, true, true, true, true, true));
	}

	@Test
	void logCullLetsThreeThroughPerWindow() {
		LogCull c = new LogCull();
		long t = 1000;
		for (int i = 0; i < 3; i++) assertTrue(c.allow("Missing texture", t + i));
		assertFalse(c.allow("Missing texture", t + 5));
		assertTrue(c.allow("Other", t + 5));
		assertTrue(c.allow("Missing texture", t + LogCull.WINDOW_MS + 10));
		assertTrue(c.allow(null, t));
	}

	@Test
	void backupZipsWorldAndKeepsNewest() throws IOException {
		File root = Files.createTempDirectory("mib-backup").toFile();
		File world = new File(root, "Nowy swiat");
		new File(world, "region").mkdirs();
		write(new File(world, "level.dat"), "lvl");
		write(new File(world, "region/r.0.0.mca"), "chunk");
		write(new File(world, "session.lock"), "x");
		File dir = new File(root, "backups");
		File a = Backups.backup(world, dir, 2, 1700000000000L);
		File b = Backups.backup(world, dir, 2, 1700000001000L);
		File c = Backups.backup(world, dir, 2, 1700000002000L);
		assertFalse(a.exists(), "najstarsza kopia usunięta");
		assertTrue(b.exists());
		assertTrue(c.exists());
		List<String> names = new ArrayList<String>();
		ZipFile z = new ZipFile(c);
		try {
			for (ZipEntry e : java.util.Collections.list(z.entries())) names.add(e.getName());
		} finally {
			z.close();
		}
		assertTrue(names.contains("Nowy swiat/level.dat"));
		assertTrue(names.contains("Nowy swiat/region/r.0.0.mca"));
		assertFalse(names.contains("Nowy swiat/session.lock"));
		// kopie innego świata o podobnej nazwie zostają
		File other = new File(dir, "Nowy swiat 2_2023-01-01_00-00-00.zip");
		write(other, "z");
		Backups.backup(world, dir, 1, 1700000003000L);
		assertTrue(other.exists());
		assertFalse(b.exists());
	}

	private static void write(File f, String s) throws IOException {
		FileOutputStream o = new FileOutputStream(f);
		try {
			o.write(s.getBytes("UTF-8"));
		} finally {
			o.close();
		}
	}
}
