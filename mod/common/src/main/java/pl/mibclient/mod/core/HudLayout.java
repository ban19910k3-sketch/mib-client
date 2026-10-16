package pl.mibclient.mod.core;

import java.util.List;

/**
 * Pozycje elementów HUD liczone od kotwicy (rogu, krawędzi albo środka ekranu), więc po zmianie rozdzielczości
 * element zostaje przy swoim rogu. Wszystkie wartości w jednostkach GUI, w = szerokość już po przeskalowaniu.
 */
public final class HudLayout {
	private HudLayout() {
	}

	public static final int EDGE_GAP = 2;

	private static int origin(int part, int size, int screen) {
		return part == 0 ? 0 : part == 1 ? (screen - size) / 2 : screen - size;
	}

	public static int[] place(HudPos p, int w, int h, int sw, int sh) {
		int x = origin(p.anchor.col, w, sw) + (p.anchor.col == 2 ? -p.x : p.x);
		int y = origin(p.anchor.row, h, sh) + (p.anchor.row == 2 ? -p.y : p.y);
		return new int[] {clamp(x, 0, Math.max(0, sw - w)), clamp(y, 0, Math.max(0, sh - h))};
	}

	public static HudPos toPos(int x, int y, int w, int h, int sw, int sh, double scale) {
		int col = third(x + w / 2, sw), row = third(y + h / 2, sh);
		int px = col == 2 ? origin(2, w, sw) - x : x - origin(col, w, sw);
		int py = row == 2 ? origin(2, h, sh) - y : y - origin(row, h, sh);
		return new HudPos(Anchor.of(col, row), px, py, scale);
	}

	private static int third(int c, int size) {
		return c * 3 < size ? 0 : c * 3 < size * 2 ? 1 : 2;
	}

	/**
	 * Przyciąganie: krawędzie do krawędzi ekranu (z odstępem 2), środek do środka ekranu, krawędzie do krawędzi
	 * innych elementów {x, y, w, h}. Wybiera najbliższy cel w zasięgu threshold.
	 */
	public static int[] snap(int x, int y, int w, int h, List<int[]> others, int sw, int sh, int threshold) {
		int[] xs = new int[2 + 1 + others.size() * 4], ys = new int[xs.length];
		int n = 0;
		xs[n] = EDGE_GAP;
		ys[n++] = EDGE_GAP;
		xs[n] = sw - EDGE_GAP - w;
		ys[n++] = sh - EDGE_GAP - h;
		xs[n] = (sw - w) / 2;
		ys[n++] = (sh - h) / 2;
		for (int[] o : others) {
			xs[n] = o[0];
			ys[n++] = o[1];
			xs[n] = o[0] + o[2];
			ys[n++] = o[1] + o[3];
			xs[n] = o[0] - w;
			ys[n++] = o[1] - h;
			xs[n] = o[0] + o[2] - w;
			ys[n++] = o[1] + o[3] - h;
		}
		return new int[] {best(x, xs, threshold), best(y, ys, threshold)};
	}

	private static int best(int v, int[] targets, int threshold) {
		int bestV = v, bestD = threshold + 1;
		for (int t : targets) {
			int d = Math.abs(t - v);
			if (d < bestD) {
				bestD = d;
				bestV = t;
			}
		}
		return bestV;
	}

	static int clamp(int v, int lo, int hi) {
		return Math.max(lo, Math.min(hi, v));
	}
}
