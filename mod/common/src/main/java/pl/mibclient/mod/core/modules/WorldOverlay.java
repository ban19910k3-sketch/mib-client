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
}
