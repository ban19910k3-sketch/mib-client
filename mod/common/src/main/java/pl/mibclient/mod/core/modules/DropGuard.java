package pl.mibclient.mod.core.modules;

/** Drop prevention: które przedmioty są cenne (id przedmiotu z gry, np. minecraft:diamond_sword). */
public final class DropGuard {
	private static final String[] GEAR = {"elytra", "trident", "mace", "enchanted_golden_apple", "nether_star", "heavy_core"};

	private DropGuard() {
	}

	public static boolean valuable(String itemId, boolean enchanted, boolean gear, boolean enchantedOn, boolean totem, boolean shulker) {
		if (itemId == null) return false;
		String path = itemId.substring(itemId.indexOf(':') + 1);
		if (gear) {
			if (path.startsWith("diamond_") || path.startsWith("netherite_")) return true;
			for (String g : GEAR) if (path.equals(g)) return true;
		}
		if (enchantedOn && enchanted) return true;
		if (totem && path.equals("totem_of_undying")) return true;
		return shulker && path.endsWith("shulker_box");
	}
}
