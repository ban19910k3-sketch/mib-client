package pl.mibclient.mod.core;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Base64;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;

/** Model 3D kosmetyku w PNG — te same przypadki co w test/profile.test.js launchera (cosmeticModel). */
class CosmeticModelTest {
	static final String GOOD = "{\"parts\":[{\"boxes\":[[0,0,-4,-9,-4,8,1,8]]},{\"bone\":\"body\",\"pivot\":[2,4,0],\"rot\":[0,0,-16],\"spin\":90,\"boxes\":[[0,9,-1,0,-3,2,4,1,-0.1]]}]}";
	static final String[] BAD = {"{\"parts\":[]}", "{\"parts\":[{\"boxes\":[]}]}", "{\"parts\":[{\"bone\":\"arm\",\"boxes\":[[0,0,0,0,0,1,1,1]]}]}",
			"{\"parts\":[{\"boxes\":[[0,0,0,0,0,1,1]]}]}", "{\"parts\":[{\"boxes\":[[0.5,0,0,0,0,1,1,1]]}]}", "{\"parts\":[{\"boxes\":[[40,0,0,0,0,8,1,8]]}]}",
			"{\"parts\":[{\"boxes\":[[0,30,0,0,0,1,2,1]]}]}", "{\"parts\":[{\"boxes\":[[0,0,65,0,0,1,1,1]]}]}", "{\"parts\":[{\"pivot\":null,\"boxes\":[[0,0,0,0,0,1,1,1]]}]}",
			"{\"parts\":[{\"rot\":[0,0],\"boxes\":[[0,0,0,0,0,1,1,1]]}]}", "{\"parts\":[{\"spin\":\"x\",\"boxes\":[[0,0,0,0,0,1,1,1]]}]}",
			"{\"parts\":[{\"boxes\":[[0,0,0,0,0,1,1,1,9]]}]}", "{\"parts\":[{\"boxes\":[[0,0,0,0,0,-1,1,1]]}]}", "nie json",
			// ruch części (0.34.0)
			"{\"parts\":[{\"wave\":[1,2,3,1],\"boxes\":[[0,0,0,0,0,1,1,1]]}]}", "{\"parts\":[{\"wave\":[1,2,3,0,0],\"boxes\":[[0,0,0,0,0,1,1,1]]}]}",
			"{\"parts\":[{\"wave\":[1,2,3,1,2],\"boxes\":[[0,0,0,0,0,1,1,1]]}]}", "{\"parts\":[{\"step\":91,\"boxes\":[[0,0,0,0,0,1,1,1]]}]}",
			"{\"parts\":[{\"sit\":[0,0,0],\"boxes\":[[0,0,0,0,0,1,1,1]]}]}", "{\"parts\":[{\"state\":\"x\",\"boxes\":[[0,0,0,0,0,1,1,1]]}]}",
			"{\"parts\":[{\"state\":null,\"boxes\":[[0,0,0,0,0,1,1,1]]}]}", "{\"parts\":[{\"wave\":null,\"boxes\":[[0,0,0,0,0,1,1,1]]}]}",
			"{\"parts\":[{\"bone\":\"pet\",\"step\":null,\"boxes\":[[0,0,0,0,0,1,1,1]]}]}"};
	/** Pet z ruchem: kołysanie, łapka, kucanie, oczy tylko we śnie (ten sam w test/profile.test.js). */
	static final String PET = "{\"parts\":[{\"bone\":\"pet\",\"rot\":[5,0,0],\"wave\":[20,0,10,1,0.1],\"step\":30,\"sit\":[0,0,10,2],\"boxes\":[[0,0,-2,-4,-2,4,4,4]]},{\"bone\":\"pet\",\"state\":\"sleep\",\"boxes\":[[0,8,-1,-3,-2.1,2,1,0]]}]}";

	/** PNG z samym nagłówkiem i kawałkiem tEXt (bez obrazka — wystarczy do odczytu modelu). */
	static byte[] png(int w, int h, String text, String key) {
		ByteArrayOutputStream out = new ByteArrayOutputStream();
		out.write(new byte[] {(byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a}, 0, 8);
		byte[] ihdr = new byte[13];
		put(ihdr, 0, w);
		put(ihdr, 4, h);
		ihdr[8] = 8;
		ihdr[9] = 6;
		chunk(out, "IHDR", ihdr);
		if (text != null) chunk(out, "tEXt", (key + "\0" + text).getBytes(StandardCharsets.ISO_8859_1));
		chunk(out, "IEND", new byte[0]);
		return out.toByteArray();
	}

	static byte[] png(int w, int h, String text) {
		return png(w, h, text, "mib-model");
	}

	private static void put(byte[] b, int o, int v) {
		b[o] = (byte) (v >>> 24);
		b[o + 1] = (byte) (v >>> 16);
		b[o + 2] = (byte) (v >>> 8);
		b[o + 3] = (byte) v;
	}

	private static void chunk(ByteArrayOutputStream out, String type, byte[] data) {
		byte[] len = new byte[4];
		put(len, 0, data.length);
		out.write(len, 0, 4);
		out.write(type.getBytes(StandardCharsets.ISO_8859_1), 0, 4);
		out.write(data, 0, data.length);
		out.write(new byte[4], 0, 4);
	}

	@Test
	void readsModelFromPng() {
		CosmeticModel m = CosmeticModel.parse(png(64, 32, GOOD));
		assertNotNull(m);
		assertEquals(64, m.width);
		assertEquals(32, m.height);
		assertEquals(2, m.parts.size());
		CosmeticModel.Part head = m.parts.get(0), body = m.parts.get(1);
		assertFalse(head.body);
		assertArrayEquals(new float[3], head.pivot);
		assertArrayEquals(new float[] {0, 0, -4, -9, -4, 8, 1, 8, 0}, head.boxes.get(0));
		assertTrue(body.body);
		assertArrayEquals(new float[] {2, 4, 0}, body.pivot);
		assertArrayEquals(new float[] {0, 0, -16}, body.rot);
		assertEquals(90f, body.spin);
		assertArrayEquals(new float[] {0, 9, -1, 0, -3, 2, 4, 1, -0.1f}, body.boxes.get(0));
		assertTrue(m.spins());
		// animacja (klatki 64×32 jedna pod drugą): model w układzie jednej klatki
		assertEquals(32, CosmeticModel.parse(png(64, 96, GOOD)).height);
	}

	@Test
	void rejectsBadModels() {
		for (String bad : BAD) assertNull(CosmeticModel.parse(png(64, 32, bad)), bad);
		assertNull(CosmeticModel.parse(png(64, 32, null)), "bez modelu");
		assertNull(CosmeticModel.parse(png(64, 32, GOOD, "Comment")), "inny klucz");
		assertNull(CosmeticModel.parse(png(64, 33, GOOD)), "zły rozmiar tekstury");
		assertNull(CosmeticModel.parse("nie png".getBytes(StandardCharsets.UTF_8)));
		assertNull(CosmeticModel.parse(null));
		assertNotNull(CosmeticModel.parse(png(128, 64, "{\"parts\":[{\"boxes\":[[40,0,0,0,0,8,1,8]]}]}")), "szersza tekstura mieści więcej");
		StringBuilder many = new StringBuilder("{\"parts\":[");
		for (int i = 0; i < 33; i++) many.append(i == 0 ? "" : ",").append("{\"boxes\":[[0,0,0,0,0,1,1,1]]}");
		assertNull(CosmeticModel.parse(png(64, 32, many + "]}")), "za dużo części");
	}

	/** Czapki z modelem 3D z bazy (supabase/schema.sql, 0.33.0) czyta też mod — te same pliki co w launcherze. */
	@Test
	void hatsFromSchemaParse() throws Exception {
		File sql = null;
		for (String p : new String[] {"../../supabase/schema.sql", "../supabase/schema.sql"}) if (new File(p).isFile()) sql = new File(p);
		assertNotNull(sql, "brak supabase/schema.sql");
		String s = new String(Files.readAllBytes(sql.toPath()), StandardCharsets.UTF_8);
		String[] ids = {"zima_hat_mikolaj", "zima_hat_renifer", "zima_hat_elf", "adwent_hat_pompon", "sylwester_hat_cylinder", "wielkanoc_hat_uszy",
				"primaaprilis_hat_blazen", "dziendziecka_hat_smiglo", "wakacje_hat_slomkowy", "niepodleglosc_hat_kotylion"};
		for (String id : ids) {
			Matcher m = Pattern.compile("\\('" + id + "', '(?:[^']|'')*', 'hat', (?:null|\\d+), 'data:image/png;base64,([A-Za-z0-9+/=]+)'\\)").matcher(s);
			assertTrue(m.find(), id);
			CosmeticModel cm = CosmeticModel.parse(Base64.getDecoder().decode(m.group(1)));
			assertNotNull(cm, id);
			if (id.endsWith("kotylion")) for (CosmeticModel.Part p : cm.parts) assertTrue(p.body, "kotylion na piersi");
			if (id.endsWith("smiglo")) assertTrue(cm.spins(), "śmigło się kręci");
		}
	}

	/** Pozy i miejsce peta — te same liczby co partPose/petAnchor w launcherze. */
	@Test
	void petPoseMatchesLauncher() {
		CosmeticModel m = CosmeticModel.parse(png(64, 32, PET));
		assertNotNull(m);
		CosmeticModel.Part a = m.parts.get(0), e = m.parts.get(1);
		assertEquals(CosmeticModel.PET, a.bone);
		assertArrayEquals(new float[] {20, 0, 10, 1, 0.1f}, a.wave);
		assertArrayEquals(new float[] {0, 0, 10, 2}, a.sit);
		assertEquals(30f, a.step);
		assertEquals(CosmeticModel.SLEEP, e.state);
		assertTrue(m.moves());
		float[] r = new float[3];
		assertEquals(0f, Pets.pose(a, 0.37f, false, false, false, 0, 0, r));
		assertEquals(8.7476262917145, r[0], 1e-4);
		assertEquals(1.8738131458572502, r[2], 1e-4);
		Pets.pose(a, 0.37f, true, false, false, 0, 0, r);
		assertEquals(-22.858628475476404, r[0], 1e-4);
		assertEquals(-13.929314237738202, r[2], 1e-4);
		Pets.pose(a, 0.37f, false, true, false, 0, 0, r);
		assertEquals(6.12428788751435, r[0], 1e-4);
		Pets.pose(a, 0.37f, false, false, false, 1, 1.1f, r);
		assertEquals(35.48384709355756, r[0], 1e-4);
		assertEquals(2f, Pets.pose(a, 0.37f, false, false, true, 0, 0, r));
		assertEquals(11.87381314585725, r[2], 1e-4);
		assertTrue(Float.isNaN(Pets.pose(e, 1, false, false, false, 0, 0, r)), "oczy zamknięte tylko we śnie");
		assertFalse(Float.isNaN(Pets.pose(e, 1, false, true, false, 0, 0, r)));
		float[] pos = new float[3];
		assertEquals(0.8f, Pets.anchor(Pets.FLY, -1, 0.37f, false, pos));
		assertArrayEquals(new float[] {-11, -1.8986944491792226f, 1}, pos, 1e-4f);
		Pets.anchor(Pets.FLY, 1, 0.37f, true, pos);
		assertArrayEquals(new float[] {11, -2, 1}, pos);
		assertEquals(0.6f, Pets.anchor(Pets.SHOULDER, -1, 0, false, pos));
		assertArrayEquals(new float[] {-6, 0, 0}, pos);
		assertEquals(1f, Pets.anchor(Pets.WALK, 1, 0, false, pos));
		assertArrayEquals(new float[] {14, 24, 3}, pos);
		assertEquals(Pets.FLY, Pets.mode("nie_ma"));
		assertEquals(-1, Pets.side("right"));
		assertTrue(Pets.sleeping(30000) && !Pets.sleeping(29999));
		// imię peta: nad najwyższym punktem modelu, obrócone z ciałem gracza (twarzą na południe lewa strona to wschód)
		assertEquals(-4f, Pets.top(m));
		double[] o = new double[3];
		Pets.nameOffset(Pets.WALK, 1, 0, false, -4, 0, o);
		assertEquals(14 * 0.9375 / 16, o[0], 1e-9);
		assertEquals((24 - (24 - 4 - 3)) * 0.9375 / 16, o[1], 1e-9);
		assertEquals(-3 * 0.9375 / 16, o[2], 1e-9, "z tyłu gracza patrzącego na południe = na północ");
		Pets.nameOffset(Pets.WALK, 1, 0, false, -4, 90, o);
		assertEquals(3 * 0.9375 / 16, o[0], 1e-9, "obrócony na zachód: tył to wschód");
		assertEquals(14 * 0.9375 / 16, o[2], 1e-9, "lewa strona to południe");
	}

	/** Pety, ogony i plecaki z bazy (0.34.0; pet za grę na telefonie od 0.44.0) czyta też mod — te same 115 co w launcherze. */
	@Test
	void petsFromSchemaParse() throws Exception {
		File sql = null;
		for (String p : new String[] {"../../supabase/schema.sql", "../supabase/schema.sql"}) if (new File(p).isFile()) sql = new File(p);
		assertNotNull(sql, "brak supabase/schema.sql");
		String s = new String(Files.readAllBytes(sql.toPath()), StandardCharsets.UTF_8);
		Matcher m = Pattern.compile("\\('([a-z0-9_]+)', '(?:[^']|'')*', '(pet|tail|back)', (?:null|\\d+), 'data:image/png;base64,([A-Za-z0-9+/=]+)'\\)").matcher(s);
		int n = 0;
		while (m.find()) {
			CosmeticModel cm = CosmeticModel.parse(Base64.getDecoder().decode(m.group(3)));
			assertNotNull(cm, m.group(1));
			for (CosmeticModel.Part p : cm.parts) assertEquals("pet".equals(m.group(2)) ? CosmeticModel.PET : CosmeticModel.BODY, p.bone, m.group(1));
			n++;
		}
		assertEquals(115, n);
	}
}
