package pl.mibclient.mod.core;

import static org.junit.jupiter.api.Assertions.*;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Arrays;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class MibPlayersTest {
	private static final UUID PREMIUM = UUID.fromString("33333333-3333-4333-8333-333333333333");
	/** UUID z nicku (serwer bez kont Microsoft), wersja 3. */
	private static final UUID OFFLINE = UUID.nameUUIDFromBytes("OfflinePlayer:Gracz".getBytes(StandardCharsets.UTF_8));

	@TempDir
	File dir;

	@Test
	void findsByUuidOnPremiumServersAndByNameOtherwise() {
		MibPlayers p = MibPlayers.parse("{\"players\":[{\"uuid\":\"33333333-3333-4333-8333-333333333333\",\"name\":\"Gracz\",\"cape\":\"cape_start\"},"
				+ "{\"uuid\":\"x\"},{\"name\":\"bez uuid\"},{\"uuid\":\"44444444-4444-4444-8444-444444444444\",\"name\":\"Drugi\",\"cape\":\"../zly\"}]}");
		assertEquals(2, p.size());
		assertEquals("cape_start", p.find(PREMIUM, "ktokolwiek").cape);
		assertNull(p.find(UUID.fromString("55555555-5555-4555-8555-555555555555"), "Gracz"), "prawdziwe konto o tym nicku to nie ten gracz");
		assertEquals("Gracz", p.find(OFFLINE, "gracz").name);
		assertNull(p.find(OFFLINE, "Inny"));
		assertNull(p.find(null, "Drugi").cape, "zła nazwa peleryny odrzucona");
		MibPlayers q = MibPlayers.parse("{\"players\":[{\"uuid\":\"33333333-3333-4333-8333-333333333333\",\"name\":\"Gracz\",\"hat\":\"hat_one\",\"wings\":\"x/../y\"}]}");
		assertEquals("hat_one", q.find(PREMIUM, "Gracz").cosmetic("hat"));
		assertNull(q.find(PREMIUM, "Gracz").cosmetic("wings"), "zła nazwa skrzydeł odrzucona");
		assertNull(q.find(PREMIUM, "Gracz").cosmetic("cape"));
		assertEquals(0, MibPlayers.parse("zepsuty").size());
		assertEquals(0, MibPlayers.parse("[1]").size());
	}

	@Test
	void requestIsSortedAndSplitsAccountsFromNames() {
		String r = MibPlayers.request(Arrays.asList(new MibPlayers.Seen(OFFLINE, "Zeta"), new MibPlayers.Seen(PREMIUM, "Gracz"),
				new MibPlayers.Seen(UUID.nameUUIDFromBytes(new byte[] {1}), "Alfa"), new MibPlayers.Seen(OFFLINE, "zły nick!")));
		assertEquals("{\"ids\":[\"33333333-3333-4333-8333-333333333333\"],\"names\":[\"Alfa\",\"Zeta\"]}", r);
	}

	@Test
	void bridgeWritesRequestOnceAndReadsPlayersAndCapes() throws Exception {
		LauncherBridge b = new LauncherBridge(dir);
		b.requestPlayers("{\"ids\":[],\"names\":[\"A\"]}");
		File req = new File(dir, "players-request.json");
		assertEquals("{\"ids\":[],\"names\":[\"A\"]}", new String(Files.readAllBytes(req.toPath()), StandardCharsets.UTF_8));
		req.delete();
		b.requestPlayers("{\"ids\":[],\"names\":[\"A\"]}");
		assertFalse(req.exists(), "ta sama lista nie jest zapisywana drugi raz");
		assertEquals(0, b.players().size());
		Files.write(new File(dir, "players.json").toPath(), "{\"players\":[{\"uuid\":\"33333333-3333-4333-8333-333333333333\",\"name\":\"Gracz\",\"cape\":\"cape_a\"}]}".getBytes(StandardCharsets.UTF_8));
		MibPlayers p = b.players();
		assertEquals(1, p.size());
		assertSame(p, b.players(), "bez zmiany pliku bez ponownego czytania");
		assertNull(b.capeFile("cape_a"));
		new File(dir, "capes").mkdirs();
		Files.write(new File(dir, "capes/cape_a.png").toPath(), new byte[] {1});
		assertNotNull(b.capeFile("cape_a"));
		assertNull(b.capeFile("../cape_a"));
	}

	@Test
	void animatedCosmeticFrames() {
		assertEquals(1, Cosmetics.frames(64, 32));
		assertEquals(4, Cosmetics.frames(64, 128));
		assertEquals(8, Cosmetics.frames(128, 512));
		assertEquals(0, Cosmetics.frames(64, 48), "niepełna klatka");
		assertEquals(0, Cosmetics.frames(64, 32 * 33), "najwyżej 32 klatki");
		assertEquals(0, Cosmetics.frames(22, 17));
		assertEquals(0, Cosmetics.frame(1, 123456), "jedna klatka: zawsze pierwsza");
		assertEquals(0, Cosmetics.frame(4, 0));
		assertEquals(1, Cosmetics.frame(4, Cosmetics.FRAME_MS));
		assertEquals(0, Cosmetics.frame(4, 4 * Cosmetics.FRAME_MS), "po ostatniej znowu pierwsza");
	}
}
