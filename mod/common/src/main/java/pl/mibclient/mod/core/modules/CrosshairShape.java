package pl.mibclient.mod.core.modules;

import java.util.ArrayList;
import java.util.List;

/**
 * Kształt celownika jako prostokąty {x1, y1, x2, y2, obwódka(1/0)} względem środkowego piksela [0,1).
 * Obwódki są na początku listy, żeby rysować je pod spodem.
 */
public final class CrosshairShape {
	private CrosshairShape() {
	}

	public static List<int[]> rects(String shape, int size, int thickness, int gap, boolean dot, boolean outline) {
		int t = Math.max(1, thickness), c0 = -((t - 1) / 2), c1 = c0 + t;
		List<int[]> f = new ArrayList<int[]>();
		if ("dot".equals(shape)) {
			// bok nieparzysty, żeby kropka była na środku ekranu
			int side = Math.max(1, size / 2) | 1, d0 = -((side - 1) / 2);
			f.add(new int[] {d0, d0, d0 + side, d0 + side});
		} else if ("circle".equals(shape)) {
			int r = Math.max(2, size);
			for (int ring = 0; ring < t; ring++) circle(f, r + ring);
		} else if ("x".equals(shape)) {
			for (int i = gap + 1; i <= gap + size; i++) {
				f.add(new int[] {i + c0, i + c0, i + c1, i + c1});
				f.add(new int[] {-i + c0, -i + c0, -i + c1, -i + c1});
				f.add(new int[] {i + c0, -i + c0, i + c1, -i + c1});
				f.add(new int[] {-i + c0, i + c0, -i + c1, i + c1});
			}
		} else if ("square".equals(shape)) {
			int r = size + gap;
			f.add(new int[] {-r, -r, r + 1, -r + t});
			f.add(new int[] {-r, r + 1 - t, r + 1, r + 1});
			f.add(new int[] {-r, -r + t, -r + t, r + 1 - t});
			f.add(new int[] {r + 1 - t, -r + t, r + 1, r + 1 - t});
		} else {
			f.add(new int[] {c1 + gap, c0, c1 + gap + size, c1});
			f.add(new int[] {c0 - gap - size, c0, c0 - gap, c1});
			f.add(new int[] {c0, c0 - gap - size, c1, c0 - gap});
			f.add(new int[] {c0, c1 + gap, c1, c1 + gap + size});
		}
		if (dot && !"dot".equals(shape)) f.add(new int[] {c0, c0, c1, c1});

		List<int[]> out = new ArrayList<int[]>();
		if (outline) for (int[] r : f) out.add(new int[] {r[0] - 1, r[1] - 1, r[2] + 1, r[3] + 1, 1});
		for (int[] r : f) out.add(new int[] {r[0], r[1], r[2], r[3], 0});
		return out;
	}

	/** Okrąg algorytmem punktu środkowego, z pikseli 1×1. */
	private static void circle(List<int[]> f, int r) {
		int x = r, y = 0, err = 1 - r;
		while (x >= y) {
			int[][] pts = {{x, y}, {y, x}, {-y, x}, {-x, y}, {-x, -y}, {-y, -x}, {y, -x}, {x, -y}};
			for (int[] p : pts) f.add(new int[] {p[0], p[1], p[0] + 1, p[1] + 1});
			y++;
			if (err < 0) err += 2 * y + 1;
			else {
				x--;
				err += 2 * (y - x) + 1;
			}
		}
	}
}
