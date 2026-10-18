package pl.mibclient.mod.core.modules;

import java.util.ArrayList;
import java.util.List;

/** Light level overlay i Custom F3: decyzje bez klas gry. */
public final class WorldOverlay {
	/** Brak znacznika. */
	public static final int NONE = 0;

	private WorldOverlay() {
	}

	/**
	 * Kolor znacznika światła na bloku, na którym może stanąć mob: czerwony = moby pojawiają się zawsze (światło bloków 0
	 * i niebo ≤ 7), żółty = tylko w nocy (światło bloków 0, ale niebo jasne), NONE = bezpiecznie.
	 */
	public static int lightColor(int blockLight, int skyLight) {
		if (blockLight > 0) return NONE;
		return skyLight <= 7 ? 0xFFFF5555 : 0xFFFFFF55;
	}

	/** Linie lewej kolumny w skróconym F3: wersja, FPS, pozycja, blok, kierunek, biom, światło. */
	static final String[] SHORT = {"XYZ", "Block:", "Facing:", "Biome:", "Client Light:", "Light:"};

	/** Custom F3: lewa kolumna skrócona (shortLeft), prawa schowana (hideRight). */
	public static List<String> debugLines(List<String> lines, boolean left, boolean shortLeft, boolean hideRight) {
		if (!left) return hideRight ? new ArrayList<String>() : lines;
		if (!shortLeft) return lines;
		List<String> out = new ArrayList<String>();
		for (int i = 0; i < lines.size(); i++) {
			String l = lines.get(i);
			if (l == null) continue;
			boolean keep = i == 0 || l.contains(" fps");
			for (String p : SHORT) if (l.startsWith(p)) keep = true;
			if (keep) out.add(l);
		}
		return out;
	}

	/**
	 * Emotki: kąty rąk {prawa X, prawa Z, lewa X, lewa Z} w radianach dla emotki w chwili t (sekundy od startu).
	 * X: -π/2 = ręka do przodu, -π = w górę; Z prawej ręki dodatni = od ciała (lewej odwrotnie).
	 */
	public static float[] emote(String id, double t) {
		double s = Math.sin(t * Math.PI * 4);
		if ("wave".equals(id)) return new float[] {-2.8f, (float) (0.3 + 0.35 * s), 0f, 0f};
		if ("dance".equals(id)) {
			double a = Math.sin(t * Math.PI * 3);
			return new float[] {(float) (-1.2 + 0.9 * a), 0.5f, (float) (-1.2 - 0.9 * a), -0.5f};
		}
		if ("clap".equals(id)) {
			float z = (float) (0.35 + 0.25 * Math.abs(s));
			return new float[] {-1.4f, -z, -1.4f, z};
		}
		if ("point".equals(id)) return new float[] {(float) (-Math.PI / 2), 0f, 0f, 0f};
		if ("cheer".equals(id)) return new float[] {(float) (-2.9 + 0.2 * s), 0.4f, (float) (-2.9 + 0.2 * s), -0.4f};
		return null;
	}
}
