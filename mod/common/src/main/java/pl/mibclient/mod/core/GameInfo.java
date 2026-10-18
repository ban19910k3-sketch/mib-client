package pl.mibclient.mod.core;

import java.util.Collections;
import java.util.List;
import pl.mibclient.mod.core.modules.CombatTracker;
import pl.mibclient.mod.core.modules.CpsCounter;
import pl.mibclient.mod.core.modules.Meters;

/** Dane z gry dla HUD; każda kopia moda (wersja gry) daje własną implementację. */
public interface GameInfo {
	enum Key { FORWARD, BACK, LEFT, RIGHT, JUMP, ATTACK, USE }

	/** Aktywny efekt mikstury; icon to uchwyt dla Canvas.effectIcon. */
	final class Effect {
		public final String name;
		public final int amplifier, ticks;
		public final boolean infinite;
		public final Object icon;

		public Effect(String name, int amplifier, int ticks, boolean infinite, Object icon) {
			this.name = name;
			this.amplifier = amplifier;
			this.ticks = ticks;
			this.infinite = infinite;
			this.icon = icon;
		}
	}

	/** Założony albo trzymany przedmiot; stack to ItemStack danej wersji (dla Canvas.item), id np. "minecraft:iron_helmet". */
	final class Gear {
		public final Object stack;
		public final int max, damage;
		public final boolean held;
		public final String id;

		public Gear(Object stack, int max, int damage, boolean held) {
			this(stack, max, damage, held, null);
		}

		public Gear(Object stack, int max, int damage, boolean held, String id) {
			this.stack = stack;
			this.max = max;
			this.damage = damage;
			this.held = held;
			this.id = id;
		}
	}

	/** Przedmioty jednego rodzaju w ekwipunku: id, łączna liczba i jeden stack do ikony. */
	final class Stack {
		public final String id;
		public final int count;
		public final Object stack;

		public Stack(String id, int count, Object stack) {
			this.id = id;
			this.count = count;
			this.stack = stack;
		}
	}

	/** Istota, na którą patrzysz albo którą ostatnio uderzyłeś (Damage indicator). */
	final class Target {
		/** Id istoty w świecie (jak w CombatTracker). */
		public final int id;
		public final String name;
		public final float health, maxHealth;

		public Target(int id, String name, float health, float maxHealth) {
			this.id = id;
			this.name = name;
			this.health = health;
			this.maxHealth = maxHealth;
		}
	}

	int fps();

	/** Ping w ms albo -1 (gra jednoosobowa, brak danych). */
	int ping();

	double x();

	double y();

	double z();

	float yaw();

	String biome();

	/** Adres serwera albo null w grze jednoosobowej. */
	String serverAddress();

	List<Effect> effects();

	/** Hełm, napierśnik, spodnie, buty, a na końcu przedmiot w ręce; puste pominięte. */
	List<Gear> gear();

	boolean key(Key k);

	CpsCounter leftCps();

	CpsCounter rightCps();

	long nowMs();

	long sessionStartMs();

	/** Godzina z zegara komputera: {godzina, minuta, sekunda}. */
	int[] localTime();

	boolean sprintToggled();

	boolean sneakToggled();

	boolean sprinting();

	boolean sneaking();

	/** F1: gracz schował HUD. */
	boolean hideHud();

	// ===== Etap 2 (HUD i PvP); domyślne wartości dla wersji i testów bez tych danych =====

	default float health() {
		return 20;
	}

	default float maxHealth() {
		return 20;
	}

	default float absorption() {
		return 0;
	}

	/** Punkty pancerza 0..20 (jak pasek gry). */
	default int armorValue() {
		return 0;
	}

	default int food() {
		return 20;
	}

	default float saturation() {
		return 5;
	}

	/** Gotowość ataku 0..1 (1 = pełna siła). */
	default float attackStrength() {
		return 1;
	}

	/** Ekwipunek zsumowany po rodzajach przedmiotów. */
	default List<Stack> inventory() {
		return Collections.emptyList();
	}

	default Target target() {
		return null;
	}

	/** Włączone paczki zasobów gracza (bez wbudowanych). */
	default List<String> resourcePacks() {
		return Collections.emptyList();
	}

	/** Pamięć gry w MB: {używana, największa}. */
	default long[] memoryMb() {
		Runtime r = Runtime.getRuntime();
		return new long[] {(r.totalMemory() - r.freeMemory()) >> 20, r.maxMemory() >> 20};
	}

	/** Użycie procesora przez grę 0..1 albo -1, gdy nieznane. */
	default double cpuLoad() {
		return -1;
	}

	default CombatTracker combat() {
		return null;
	}

	default Meters meters() {
		return null;
	}

	// ===== Etapy 3 i 4 =====

	/** Blok, na który patrzysz: nazwa i stack do ikony. */
	final class Looked {
		public final String name;
		public final Object stack;

		public Looked(String name, Object stack) {
			this.name = name;
			this.stack = stack;
		}
	}

	default Looked lookedBlock() {
		return null;
	}

	/** Ostatnia śmierć {x, y, z, czas w ms} albo null. */
	default double[] lastDeath() {
		return null;
	}

	/** Koń (albo inne zwierzę do jazdy) pod graczem: {prędkość w m/s, skok w blokach, zdrowie, maks. zdrowie} albo null. */
	default double[] horse() {
		return null;
	}
}
