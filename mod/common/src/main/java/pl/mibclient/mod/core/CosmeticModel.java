package pl.mibclient.mod.core;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * Model 3D kosmetyku (od 0.33.0: czapki ze stożkiem, rondem, uszami, porożem, śmigłem; kotylion na piersi), zapisany w samej
 * teksturze PNG — kawałek tEXt „mib-model” z JSON-em — więc przychodzi razem z teksturą (cosmetics.json, capes/). Prostopadłościany
 * jak w modelach gry (box UV): jednostki to piksele skina, y w dół, przód głowy w stronę −z; część na głowie albo tułowiu
 * (środek obrotu obu na szyi), pivot i rot (stopnie, kolejność Z·Y·X jak PartPose), spin = obrót wokół osi y części w stopniach na
 * sekundę, boxes: [u, v, x, y, z, w, h, d, powiększenie?] w teksturze jednej klatki (szerokość × szerokość/2). Te same reguły
 * sprawdza cosmeticModel w lib/profile.js launchera (wspólne przykłady w testach); zły model = czapka jak dotąd.
 */
public final class CosmeticModel {
	public static final String KEY = "mib-model";
	public static final int MAX_PARTS = 32, MAX_BOXES = 128;

	/** Rozmiar klatki tekstury (szerokość × szerokość/2). */
	public final int width, height;
	public final List<Part> parts;

	/** Kość części: głowa, tułów albo pet (współrzędne względem kotwicy peta, od 0.34.0). */
	public static final int HEAD = 0, BODY = 1, PET = 2;
	/** Widoczność części: zawsze, tylko na jawie, tylko we śnie (oczy peta). */
	public static final int ALWAYS = 0, AWAKE = 1, SLEEP = 2;

	/**
	 * Część modelu: na tułowiu, głowie albo pecie, z własnym środkiem obrotu, obrotem, kręceniem i prostopadłościanami; od 0.34.0
	 * ruch (Pets.pose): wave = kołysanie [ax, ay, az, hz, faza], step = łapka przy chodzie, sit = [ax, ay, az, dy] przy kucaniu.
	 */
	public static final class Part {
		public final int bone;
		public final boolean body;
		public final float[] pivot, rot;
		public final float spin;
		/** Każdy: u, v, x, y, z, w, h, d, powiększenie. */
		public final List<float[]> boxes;
		public final float[] wave, sit;
		public final float step;
		public final int state;

		Part(int bone, float[] pivot, float[] rot, float spin, List<float[]> boxes, float[] wave, float step, float[] sit, int state) {
			this.bone = bone;
			this.body = bone == BODY;
			this.pivot = pivot;
			this.rot = rot;
			this.spin = spin;
			this.boxes = Collections.unmodifiableList(boxes);
			this.wave = wave;
			this.step = step;
			this.sit = sit;
			this.state = state;
		}

		/** Czy część się rusza sama (kręci, kołysze, chodzi, kuca albo zależy od snu). */
		public boolean moves() {
			return spin != 0 || wave != null || step != 0 || sit != null || state != ALWAYS;
		}
	}

	private CosmeticModel(int width, int height, List<Part> parts) {
		this.width = width;
		this.height = height;
		this.parts = Collections.unmodifiableList(parts);
	}

	/** Czy któraś część się kręci. */
	public boolean spins() {
		for (Part p : parts) if (p.spin != 0) return true;
		return false;
	}

	/** Czy któraś część się rusza (Part.moves). */
	public boolean moves() {
		for (Part p : parts) if (p.moves()) return true;
		return false;
	}

	/** Model z pliku PNG albo null (bez modelu, zły PNG albo zły model). */
	public static CosmeticModel parse(byte[] png) {
		if (png == null || png.length < 24) return null;
		int[] sig = {0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a};
		for (int i = 0; i < 8; i++) if ((png[i] & 0xff) != sig[i]) return null;
		long w = u32(png, 16), h = u32(png, 20);
		if (w > 512 || h > 512 * 32 || Cosmetics.frames((int) w, (int) h) < 1) return null;
		String text = text(png, KEY);
		if (text == null) return null;
		try {
			return check(Json.parse(text), (int) w, (int) w / 2);
		} catch (RuntimeException e) {
			return null;
		}
	}

	private static long u32(byte[] b, int o) {
		return ((long) (b[o] & 0xff) << 24) | ((b[o + 1] & 0xff) << 16) | ((b[o + 2] & 0xff) << 8) | (b[o + 3] & 0xff);
	}

	/** Tekst z kawałka tEXt o danym kluczu albo null. */
	static String text(byte[] b, String key) {
		int o = 8;
		while (o + 12 <= b.length) {
			long len = u32(b, o);
			String type = new String(b, o + 4, 4, StandardCharsets.ISO_8859_1);
			if (o + 12 + len > b.length || "IEND".equals(type)) return null;
			if ("tEXt".equals(type)) {
				int end = o + 8 + (int) len, i = o + 8;
				while (i < end && b[i] != 0) i++;
				if (new String(b, o + 8, i - o - 8, StandardCharsets.ISO_8859_1).equals(key))
					return i < end ? new String(b, i + 1, end - i - 1, StandardCharsets.ISO_8859_1) : "";
			}
			o += 12 + (int) len;
		}
		return null;
	}

	private static boolean num(Object v, double lim) {
		if (!(v instanceof Double)) return false;
		double d = (Double) v;
		return !Double.isNaN(d) && !Double.isInfinite(d) && Math.abs(d) <= lim;
	}

	/** Wektor 3 liczb; brak klucza = zera, null albo co innego = zły model (jak w launcherze). */
	private static float[] vec(Map<?, ?> m, String key, double lim) {
		if (!m.containsKey(key)) return new float[3];
		Object v = m.get(key);
		if (!(v instanceof List) || ((List<?>) v).size() != 3) return null;
		float[] out = new float[3];
		for (int i = 0; i < 3; i++) {
			Object x = ((List<?>) v).get(i);
			if (!num(x, lim)) return null;
			out[i] = ((Double) x).floatValue();
		}
		return out;
	}

	/** Dokładnie n liczb albo null. */
	private static float[] nums(Object v, int n) {
		if (!(v instanceof List) || ((List<?>) v).size() != n) return null;
		float[] out = new float[n];
		for (int i = 0; i < n; i++) {
			Object x = ((List<?>) v).get(i);
			if (!num(x, 1e6)) return null;
			out[i] = ((Double) x).floatValue();
		}
		return out;
	}

	private static boolean whole(double d) {
		return d == Math.rint(d);
	}

	static CosmeticModel check(Object json, int tw, int th) {
		if (!(json instanceof Map)) return null;
		Object ps = ((Map<?, ?>) json).get("parts");
		if (!(ps instanceof List) || ((List<?>) ps).isEmpty() || ((List<?>) ps).size() > MAX_PARTS) return null;
		List<Part> parts = new ArrayList<Part>();
		int count = 0;
		for (Object po : (List<?>) ps) {
			if (!(po instanceof Map)) return null;
			Map<?, ?> p = (Map<?, ?>) po;
			Object bone = p.containsKey("bone") ? p.get("bone") : "head", spinV = p.containsKey("spin") ? p.get("spin") : Double.valueOf(0);
			float[] pivot = vec(p, "pivot", 64), rot = vec(p, "rot", 360);
			if (!("head".equals(bone) || "body".equals(bone) || "pet".equals(bone)) || pivot == null || rot == null || !num(spinV, 7200) || !(p.get("boxes") instanceof List)) return null;
			float[] wave = null, sit = null;
			if (p.containsKey("wave")) {
				wave = nums(p.get("wave"), 5);
				if (wave == null || Math.abs(wave[0]) > 180 || Math.abs(wave[1]) > 180 || Math.abs(wave[2]) > 180 || !(wave[3] > 0 && wave[3] <= 10) || wave[4] < 0 || wave[4] > 1) return null;
			}
			if (p.containsKey("sit")) {
				sit = nums(p.get("sit"), 4);
				if (sit == null || Math.abs(sit[0]) > 180 || Math.abs(sit[1]) > 180 || Math.abs(sit[2]) > 180 || Math.abs(sit[3]) > 16) return null;
			}
			Object stepV = p.containsKey("step") ? p.get("step") : Double.valueOf(0), stateV = p.containsKey("state") ? p.get("state") : "";
			if (!num(stepV, 90) || !("".equals(stateV) && !p.containsKey("state") || "awake".equals(stateV) || "sleep".equals(stateV))) return null;
			List<float[]> boxes = new ArrayList<float[]>();
			for (Object bo : (List<?>) p.get("boxes")) {
				if (!(bo instanceof List)) return null;
				List<?> b = (List<?>) bo;
				if (b.size() != 8 && b.size() != 9) return null;
				double[] v = new double[9];
				for (int i = 0; i < b.size(); i++) {
					if (!num(b.get(i), 512)) return null;
					v[i] = (Double) b.get(i);
				}
				double u = v[0], vv = v[1], w = v[5], h = v[6], d = v[7];
				for (double c : new double[] {u, vv, w, h, d}) if (!whole(c) || c < 0) return null;
				if (w > 64 || h > 64 || d > 64 || u + 2 * (w + d) > tw || vv + d + h > th) return null;
				if (Math.abs(v[2]) > 64 || Math.abs(v[3]) > 64 || Math.abs(v[4]) > 64 || Math.abs(v[8]) > 8) return null;
				float[] f = new float[9];
				for (int i = 0; i < 9; i++) f[i] = (float) v[i];
				boxes.add(f);
			}
			count += boxes.size();
			if (boxes.isEmpty() || count > MAX_BOXES) return null;
			parts.add(new Part("body".equals(bone) ? BODY : "pet".equals(bone) ? PET : HEAD, pivot, rot, ((Double) spinV).floatValue(), boxes, wave,
					((Double) stepV).floatValue(), sit, "awake".equals(stateV) ? AWAKE : "sleep".equals(stateV) ? SLEEP : ALWAYS));
		}
		return new CosmeticModel(tw, th, parts);
	}
}
