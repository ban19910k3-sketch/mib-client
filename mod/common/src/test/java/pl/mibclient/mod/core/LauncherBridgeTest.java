package pl.mibclient.mod.core;

import static org.junit.jupiter.api.Assertions.*;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class LauncherBridgeTest {
	@TempDir
	File dir;

	private void write(String name, String s) throws Exception {
		Files.write(new File(dir, name).toPath(), s.getBytes(StandardCharsets.UTF_8));
	}

	@Test
	void writesServerStatusForFriends() throws Exception {
		LauncherBridge b = new LauncherBridge(dir);
		b.writeStatus("play.mib.pl", 1234L);
		Map<?, ?> st = (Map<?, ?>) Json.parse(new String(Files.readAllBytes(new File(dir, "status.json").toPath()), StandardCharsets.UTF_8));
		assertEquals("play.mib.pl", st.get("server"));
		assertEquals(1234L, ((Number) st.get("at")).longValue());
		b.writeStatus(null, 2000L);
		st = (Map<?, ?>) Json.parse(new String(Files.readAllBytes(new File(dir, "status.json").toPath()), StandardCharsets.UTF_8));
		assertNull(st.get("server"), "świat jednoosobowy bez adresu");
	}

	@Test
	void missingFileMeansNoAccounts() {
		assertTrue(new LauncherBridge(dir).accounts().isEmpty());
		assertTrue(new LauncherBridge(new File(dir, "nie-ma")).accounts().isEmpty());
	}

	@Test
	void readsAccountsAndWritesRequest() throws Exception {
		write("accounts.json", "[{\"id\":\"a1\",\"name\":\"Ban19910k\",\"active\":true},{\"id\":\"a2\",\"name\":\"BanAlt\"},{\"name\":\"bez id\"},7]");
		LauncherBridge b = new LauncherBridge(dir);
		List<Account> l = b.accounts();
		assertEquals(2, l.size());
		assertEquals("Ban19910k", l.get(0).name);
		assertTrue(l.get(0).active);
		assertFalse(l.get(1).active);
		b.requestSwitch("a2");
		Map<?, ?> req = (Map<?, ?>) Json.parse(new String(Files.readAllBytes(new File(dir, "switch-request.json").toPath()), StandardCharsets.UTF_8));
		assertEquals("a2", req.get("id"));
		assertTrue(((Number) req.get("at")).longValue() > 0);
		assertFalse(new File(dir, "switch-request.json.tmp").exists());
	}

	@Test
	void badAccountsFileMeansNoAccounts() throws Exception {
		write("accounts.json", "{zepsute");
		assertTrue(new LauncherBridge(dir).accounts().isEmpty());
	}

	@Test
	void cosmeticsAndEquipRequest() throws Exception {
		LauncherBridge b = new LauncherBridge(dir);
		assertNull(b.cosmetics(), "launcher jeszcze nic nie zapisał");
		write("cosmetics.json", "{\"loggedIn\":false,\"items\":[]}");
		assertFalse(b.cosmetics().loggedIn);
		write("cosmetics.json", "{\"loggedIn\":true,\"items\":[{\"id\":\"c1\",\"name\":\"Fiolet\",\"type\":\"cape\",\"equipped\":true,\"png\":\"QUJD\"},"
				+ "{\"id\":\"c2\",\"name\":\"Złota\",\"type\":\"cape\",\"png\":null},{\"name\":\"bez id\"}]}");
		Cosmetics c = b.cosmetics();
		assertTrue(c.loggedIn);
		assertEquals(2, c.items.size());
		assertEquals("c1", c.equippedCape().id);
		assertEquals("QUJD", c.equippedCape().png);
		b.requestEquip("cape", null);
		String req = new String(Files.readAllBytes(new File(dir, "cosmetic-request.json").toPath()), StandardCharsets.UTF_8);
		assertTrue(req.startsWith("{\"type\":\"cape\",\"id\":null,\"at\":"), req);
		write("cosmetic-result.json", "{\"ok\":false,\"message\":\"Brak sieci\",\"at\":" + (System.currentTimeMillis() + 5) + "}");
		assertEquals("Brak sieci", b.cosmeticFailure(System.currentTimeMillis() - 1000));
	}

	@Test
	void failureOnlyWhenNewer() throws Exception {
		LauncherBridge b = new LauncherBridge(dir);
		assertNull(b.failure(0));
		write("switch-result.json", "{\"ok\":false,\"message\":\"Sesja wygasła\",\"at\":1000}");
		assertEquals("Sesja wygasła", b.failure(500));
		assertNull(b.failure(2000));
		write("switch-result.json", "{\"ok\":true,\"at\":3000}");
		assertNull(b.failure(0));
	}
}
