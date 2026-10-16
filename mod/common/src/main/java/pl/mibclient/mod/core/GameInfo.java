package pl.mibclient.mod.core;

import java.util.List;
import pl.mibclient.mod.core.modules.CpsCounter;

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

	/** Założony albo trzymany przedmiot; stack to ItemStack danej wersji (dla Canvas.item). */
	final class Gear {
		public final Object stack;
		public final int max, damage;
		public final boolean held;

		public Gear(Object stack, int max, int damage, boolean held) {
			this.stack = stack;
			this.max = max;
			this.damage = damage;
			this.held = held;
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
}
