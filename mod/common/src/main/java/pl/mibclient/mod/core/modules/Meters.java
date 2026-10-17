package pl.mibclient.mod.core.modules;

/** Liczniki HUD etapu 2: TPS serwera, prędkość, stoper i ruch myszy (Mousestrokes). Czas w ms. */
public final class Meters {
	public final Tps tps = new Tps();
	public final Speed speed = new Speed();
	public final Stopwatch stopwatch = new Stopwatch();
	public final MouseTrail mouse = new MouseTrail();

	/**
	 * Szacowana wydajność serwera: serwer co sekundę (20 ticków) wysyła czas świata; TPS = ticki świata / czas.
	 * Średnia z 5 ostatnich pomiarów, najwyżej 20.
	 */
	public static final class Tps {
		private final double[] samples = new double[5];
		private int n, next;
		private long lastGameTime = -1, lastAt;

		public void onTime(long gameTime, long now) {
			if (lastGameTime >= 0 && gameTime > lastGameTime) {
				long dt = now - lastAt, dg = gameTime - lastGameTime;
				if (dt >= 300 && dg <= 1200) {
					samples[next] = Math.min(20.0, dg * 1000.0 / dt);
					next = (next + 1) % samples.length;
					n = Math.min(n + 1, samples.length);
				}
			}
			if (lastGameTime < 0 || gameTime > lastGameTime || gameTime < lastGameTime - 1200) {
				lastGameTime = gameTime;
				lastAt = now;
			}
		}

		/** TPS albo -1, gdy jeszcze nie ma pomiaru. */
		public double tps() {
			if (n == 0) return -1;
			double sum = 0;
			for (int i = 0; i < n; i++) sum += samples[i];
			return sum / n;
		}

		public void reset() {
			n = 0;
			next = 0;
			lastGameTime = -1;
		}
	}

	/** Prędkość ruchu w blokach na sekundę: średnia z ostatnich 10 ticków (pół sekundy). */
	public static final class Speed {
		private final double[] d = new double[10];
		private int n, next;
		private double lx, ly, lz;
		private boolean has;

		public void tick(double x, double y, double z, boolean vertical) {
			if (has) {
				double dx = x - lx, dy = vertical ? y - ly : 0, dz = z - lz;
				double step = Math.sqrt(dx * dx + dy * dy + dz * dz);
				d[next] = step > 50 ? 0 : step; // teleport to nie ruch
				next = (next + 1) % d.length;
				n = Math.min(n + 1, d.length);
			}
			lx = x;
			ly = y;
			lz = z;
			has = true;
		}

		public double bps() {
			if (n == 0) return 0;
			double sum = 0;
			for (int i = 0; i < n; i++) sum += d[i];
			return sum / n * 20.0;
		}

		public void reset() {
			n = 0;
			next = 0;
			has = false;
		}
	}

	/** Stoper pod klawiszem: naciśnięcie startuje od zera albo zatrzymuje. */
	public static final class Stopwatch {
		private long start = -1, stop = -1;

		public void press(long now) {
			if (running()) stop = now;
			else {
				start = now;
				stop = -1;
			}
		}

		public boolean running() {
			return start >= 0 && stop < 0;
		}

		public boolean started() {
			return start >= 0;
		}

		public long elapsed(long now) {
			if (start < 0) return 0;
			return (stop >= 0 ? stop : now) - start;
		}
	}

	/** Mousestrokes: kropka odsuwa się w stronę ruchu myszy i wraca do środka w ok. 0,2 s. Pozycja -1..1. */
	public static final class MouseTrail {
		private double x, y;
		private long at = -1;

		public void move(double dx, double dy, double sensitivity, long now) {
			decay(now);
			double k = 0.004 * sensitivity;
			x = clamp(x + dx * k);
			y = clamp(y + dy * k);
		}

		public double[] pos(long now) {
			decay(now);
			return new double[] {x, y};
		}

		private void decay(long now) {
			if (at >= 0 && now > at) {
				double f = Math.pow(0.5, (now - at) / 60.0);
				x *= f;
				y *= f;
			}
			at = now;
		}

		private static double clamp(double v) {
			return Math.max(-1, Math.min(1, v));
		}
	}
}
