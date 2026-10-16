package pl.mibclient.mod.core.modules;

/** Przybliżenie: trzymany klawisz, kółko myszy i płynne dochodzenie do celu. */
public final class ZoomState {
	public static final double MIN = 1.5, MAX = 50, STEP = 1.2, SPEED = 12;

	private int base = 4;
	private double factor = 4;
	private boolean held;
	private double current = 1;

	/** Przybliżenie z ustawień modułu (używane przy każdym wciśnięciu klawisza). */
	public void setBase(int base) {
		this.base = base;
	}

	public void setHeld(boolean h) {
		if (h && !held) factor = base;
		held = h;
	}

	public boolean active() {
		return held;
	}

	public double factor() {
		return factor;
	}

	public void scroll(double notches) {
		if (!held) return;
		factor = Math.max(MIN, Math.min(MAX, factor * Math.pow(STEP, notches)));
	}

	/** Mnożnik pola widzenia na tę klatkę (1 = bez przybliżenia). */
	public float fovMultiplier(float frameSeconds, boolean smooth) {
		double target = held ? 1 / factor : 1;
		if (!smooth) current = target;
		else current += (target - current) * (1 - Math.exp(-SPEED * Math.max(0, frameSeconds)));
		if (Math.abs(current - target) < 1e-4) current = target;
		return (float) current;
	}
}
