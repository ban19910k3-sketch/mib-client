package pl.mibclient.mod.core;

/** Położenie elementu HUD: kotwica, przesunięcie od niej (w jednostkach GUI) i rozmiar. */
public final class HudPos {
	public final Anchor anchor;
	public final int x, y;
	public final double scale;

	public HudPos(Anchor anchor, int x, int y, double scale) {
		this.anchor = anchor;
		this.x = x;
		this.y = y;
		this.scale = scale;
	}

	public HudPos withScale(double s) {
		return new HudPos(anchor, x, y, s);
	}

	@Override
	public boolean equals(Object o) {
		if (!(o instanceof HudPos)) return false;
		HudPos p = (HudPos) o;
		return anchor == p.anchor && x == p.x && y == p.y && Math.abs(scale - p.scale) < 1e-9;
	}

	@Override
	public int hashCode() {
		return anchor.hashCode() * 31 * 31 + x * 31 + y;
	}

	@Override
	public String toString() {
		return anchor + "(" + x + "," + y + ")x" + scale;
	}
}
