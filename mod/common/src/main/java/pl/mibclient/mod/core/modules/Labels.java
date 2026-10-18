package pl.mibclient.mod.core.modules;

import java.util.Locale;

/** Napisy nad rzeczami w świecie (TNT timer, Item despawn, Mob overlay), ping na liście graczy i pora dnia z Time changer. */
public final class Labels {
	/** Leżący przedmiot znika po tylu tickach (5 minut). */
	public static final int ITEM_LIFETIME = 6000;
	/** Wiek przedmiotu, który nigdy nie znika. */
	public static final int ITEM_FOREVER = -32768;

	public static final int GREEN = 0x55FF55, YELLOW = 0xFFFF55, GOLD = 0xFFAA00, RED = 0xFF5555, WHITE = 0xFFFFFF;

	private Labels() {
	}

	/** Czas do wybuchu TNT: „3.2 s”. */
	public static String fuse(int ticks) {
		return String.format(Locale.ROOT, "%.1f s", Math.max(0, ticks) / 20.0);
	}

	public static int fuseColor(int ticks) {
		return ticks > 40 ? GREEN : ticks > 20 ? YELLOW : RED;
	}

	/** Czas do zniknięcia przedmiotu „4:59” albo null (przedmiot nie znika). */
	public static String despawn(int age) {
		if (age == ITEM_FOREVER) return null;
		int left = Math.max(0, ITEM_LIFETIME - age), s = (left + 19) / 20;
		return String.format(Locale.ROOT, "%d:%02d", s / 60, s % 60);
	}

	public static int despawnColor(int age) {
		int left = ITEM_LIFETIME - age;
		return left <= 30 * 20 ? RED : left <= 60 * 20 ? YELLOW : WHITE;
	}

	/** Zdrowie: całe liczby bez przecinka, połówki z jednym miejscem („7.5”). */
	public static String health(float hp) {
		float r = Math.round(hp * 2) / 2f;
		return r == Math.floor(r) ? String.valueOf((int) r) : String.format(Locale.ROOT, "%.1f", r);
	}

	public static int healthColor(float hp, float max) {
		float f = max <= 0 ? 0 : hp / max;
		return f > 0.6f ? GREEN : f > 0.3f ? YELLOW : RED;
	}

	/** Kolor pingu: zielony do 80 ms, żółty do 150, pomarańczowy do 300, dalej czerwony. */
	public static int pingColor(int ms) {
		return ms <= 80 ? GREEN : ms <= 150 ? YELLOW : ms <= 300 ? GOLD : RED;
	}

	/** Pora dnia z Time changer w tickach świata (0 = 6:00 rano). */
	public static long timeOfDay(String key) {
		if ("morning".equals(key)) return 1000;
		if ("sunset".equals(key)) return 12000;
		if ("night".equals(key)) return 14000;
		if ("midnight".equals(key)) return 18000;
		return 6000;
	}
}
