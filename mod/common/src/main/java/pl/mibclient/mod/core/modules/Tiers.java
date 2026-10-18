package pl.mibclient.mod.core.modules;

import java.util.Map;
import pl.mibclient.mod.core.Json;

/**
 * Tier tagger: tier gracza z MCTiers (https://mctiers.com/api/v2/profile/&lt;uuid&gt;/rankings — mapa tryb -&gt;
 * {tier, pos, peak_tier, peak_pos, retired}). pos 0 = High, 1 = Low; niższy tier jest lepszy.
 */
public final class Tiers {
	public static final String API = "https://mctiers.com/api/v2/profile/";
	public static final String[] MODES = {"best", "vanilla", "sword", "pot", "nethop", "uhc", "axe", "smp", "mace"};

	private Tiers() {
	}

	/** Tier do pokazania („HT3”, „LT1”, „RHT2” dla emerytowanych) albo null; mode "best" = najlepszy ze wszystkich trybów. */
	public static String tier(String rankingsJson, String mode) {
		Object v;
		try {
			v = Json.parse(rankingsJson);
		} catch (RuntimeException e) {
			return null;
		}
		if (!(v instanceof Map)) return null;
		String best = null;
		int bestScore = Integer.MAX_VALUE;
		for (Map.Entry<?, ?> e : ((Map<?, ?>) v).entrySet()) {
			if (!"best".equals(mode) && !mode.equals(e.getKey())) continue;
			if (!(e.getValue() instanceof Map)) continue;
			Map<?, ?> r = (Map<?, ?>) e.getValue();
			boolean retired = Boolean.TRUE.equals(r.get("retired"));
			Object t = retired && r.get("peak_tier") instanceof Number ? r.get("peak_tier") : r.get("tier");
			Object p = retired && r.get("peak_pos") instanceof Number ? r.get("peak_pos") : r.get("pos");
			if (!(t instanceof Number) || !(p instanceof Number)) continue;
			int tier = ((Number) t).intValue(), pos = ((Number) p).intValue(), score = tier * 2 + pos;
			if (score < bestScore) {
				bestScore = score;
				best = (retired ? "R" : "") + (pos == 0 ? "H" : "L") + "T" + tier;
			}
		}
		return best;
	}

	/** Kolor tieru jak w TierTagger (złoty HT1 … szary LT5, emerytowani szarzy). */
	public static int color(String tier) {
		if (tier == null || tier.startsWith("R")) return 0xA2D6FF;
		String t = tier;
		if ("HT1".equals(t)) return 0xE8BA3A;
		if ("LT1".equals(t)) return 0xD5B355;
		if ("HT2".equals(t)) return 0xC4D3E7;
		if ("LT2".equals(t)) return 0xA0A7B2;
		if ("HT3".equals(t)) return 0xF89F5A;
		if ("LT3".equals(t)) return 0xC67B42;
		if ("HT4".equals(t)) return 0x81749A;
		if ("HT5".equals(t)) return 0x8F82A8;
		return 0x655B79;
	}
}
