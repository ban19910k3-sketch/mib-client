package pl.mibclient.mod.core;

import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import pl.mibclient.mod.core.modules.CpsCounter;

/** Atrapa danych gry do testów HUD. */
public class FakeGameInfo implements GameInfo {
	public int fps = 240, ping = 24;
	public double x = 120.4, y = 64, z = -38.6;
	public float yaw = 180;
	public String biome = "Równiny", server = "play.mib.pl:25565";
	public final List<Effect> effects = new ArrayList<Effect>();
	public final List<Gear> gear = new ArrayList<Gear>();
	public final Set<Key> keys = EnumSet.noneOf(Key.class);
	public final CpsCounter left = new CpsCounter(), right = new CpsCounter();
	public long now = 100_000, start = 100_000 - 3_909_000;
	public int[] time = {14, 5, 9};
	public boolean sprintToggled, sneakToggled, sprinting, sneaking, hide;

	@Override
	public int fps() {
		return fps;
	}

	@Override
	public int ping() {
		return ping;
	}

	@Override
	public double x() {
		return x;
	}

	@Override
	public double y() {
		return y;
	}

	@Override
	public double z() {
		return z;
	}

	@Override
	public float yaw() {
		return yaw;
	}

	@Override
	public String biome() {
		return biome;
	}

	@Override
	public String serverAddress() {
		return server;
	}

	@Override
	public List<Effect> effects() {
		return effects;
	}

	@Override
	public List<Gear> gear() {
		return gear;
	}

	@Override
	public boolean key(Key k) {
		return keys.contains(k);
	}

	@Override
	public CpsCounter leftCps() {
		return left;
	}

	@Override
	public CpsCounter rightCps() {
		return right;
	}

	@Override
	public long nowMs() {
		return now;
	}

	@Override
	public long sessionStartMs() {
		return start;
	}

	@Override
	public int[] localTime() {
		return time;
	}

	@Override
	public boolean sprintToggled() {
		return sprintToggled;
	}

	@Override
	public boolean sneakToggled() {
		return sneakToggled;
	}

	@Override
	public boolean sprinting() {
		return sprinting;
	}

	@Override
	public boolean sneaking() {
		return sneaking;
	}

	@Override
	public boolean hideHud() {
		return hide;
	}
}
