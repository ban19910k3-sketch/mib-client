package pl.mibclient.mod.core.modules;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import pl.mibclient.mod.core.ModuleState;

/**
 * Waypoints: punkty w świecie zapisane w ustawieniach modułu (opcja "points", lista map) i rzutowanie punktu na ekran
 * (napis w HUD nad punktem, bez rysowania w świecie). Punkt pamięta świat (serwer albo zapis gry) i wymiar.
 */
public final class Waypoints {
	public static final String KEY = "points";
	public static final int MAX = 50;
	/** Kolory kolejnych punktów. */
	public static final int[] COLORS = {0xFFD6B0FF, 0xFF4ADE80, 0xFF60A5FA, 0xFFFACC15, 0xFFF87171, 0xFFFFFFFF};

	private Waypoints() {
	}

	public static final class Point {
		public final String name, world, dim;
		public final int x, y, z, color;

		public Point(String name, String world, String dim, int x, int y, int z, int color) {
			this.name = name;
			this.world = world;
			this.dim = dim;
			this.x = x;
			this.y = y;
			this.z = z;
			this.color = color;
		}
	}

	/** Wszystkie punkty (złe wpisy w pliku są pomijane). */
	public static List<Point> all(ModuleState s) {
		List<Point> out = new ArrayList<Point>();
		Object v = s.option(KEY);
		if (!(v instanceof List)) return out;
		for (Object o : (List<?>) v) {
			if (!(o instanceof Map)) continue;
			Map<?, ?> m = (Map<?, ?>) o;
			Object n = m.get("name"), w = m.get("world"), d = m.get("dim"), x = m.get("x"), y = m.get("y"), z = m.get("z"), c = m.get("color");
			if (!(n instanceof String) || !(w instanceof String) || !(d instanceof String) || !(x instanceof Number) || !(y instanceof Number)
					|| !(z instanceof Number)) continue;
			int color = c instanceof Number ? (int) ((Number) c).longValue() : COLORS[0];
			out.add(new Point((String) n, (String) w, (String) d, ((Number) x).intValue(), ((Number) y).intValue(), ((Number) z).intValue(), color));
		}
		return out;
	}

	/** Punkty tego świata i wymiaru. */
	public static List<Point> in(ModuleState s, String world, String dim) {
		List<Point> out = new ArrayList<Point>();
		for (Point p : all(s)) if (p.world.equals(world) && p.dim.equals(dim)) out.add(p);
		return out;
	}

	/** Dodaje punkt „Punkt N” (N = kolejny numer w tym świecie); false, gdy jest już MAX punktów. */
	public static boolean add(ModuleState s, String world, String dim, int x, int y, int z, String prefix) {
		List<Point> l = all(s);
		if (l.size() >= MAX) return false;
		int n = 1;
		for (Point p : l) if (p.world.equals(world)) n++;
		l.add(new Point(prefix + " " + n, world, dim, x, y, z, COLORS[(n - 1) % COLORS.length]));
		save(s, l);
		return true;
	}

	/** Usuwa i-ty punkt z listy punktów tego świata (kolejność jak w in()). */
	public static void remove(ModuleState s, String world, String dim, int i) {
		List<Point> l = all(s), mine = in(s, world, dim);
		if (i < 0 || i >= mine.size()) return;
		Point gone = mine.get(i);
		for (int k = 0; k < l.size(); k++) {
			Point p = l.get(k);
			if (p.world.equals(gone.world) && p.dim.equals(gone.dim) && p.name.equals(gone.name) && p.x == gone.x && p.y == gone.y && p.z == gone.z) {
				l.remove(k);
				break;
			}
		}
		save(s, l);
	}

	private static void save(ModuleState s, List<Point> l) {
		List<Object> out = new ArrayList<Object>();
		for (Point p : l) {
			Map<String, Object> m = new LinkedHashMap<String, Object>();
			m.put("name", p.name);
			m.put("world", p.world);
			m.put("dim", p.dim);
			m.put("x", p.x);
			m.put("y", p.y);
			m.put("z", p.z);
			m.put("color", p.color & 0xFFFFFFFFL);
			out.add(m);
		}
		s.setOption(KEY, out);
	}

	/**
	 * Punkt świata (px, py, pz) na ekranie {x, y, odległość} albo null, gdy jest za kamerą. Kamera w (cx, cy, cz),
	 * obrót jak w grze (yaw: 0 = na południe, rośnie w prawo; pitch: dodatni = w dół), fovY = pionowe pole widzenia.
	 */
	public static double[] project(double px, double py, double pz, double cx, double cy, double cz, float yaw, float pitch, double fovY,
			int w, int h) {
		double ry = Math.toRadians(yaw), rp = Math.toRadians(pitch);
		double fx = -Math.sin(ry) * Math.cos(rp), fy = -Math.sin(rp), fz = Math.cos(ry) * Math.cos(rp);
		double rx = -Math.cos(ry), rz = -Math.sin(ry); // w prawo (poziomo)
		// w górę = prawo × przód
		double ux = 0 * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - 0 * fx;
		double dx = px - cx, dy = py - cy, dz = pz - cz;
		double depth = dx * fx + dy * fy + dz * fz;
		if (depth < 0.05) return null;
		double sx = dx * rx + dz * rz, sy = dx * ux + dy * uy + dz * uz;
		double focal = (h / 2.0) / Math.tan(Math.toRadians(fovY) / 2);
		return new double[] {w / 2.0 + sx / depth * focal, h / 2.0 - sy / depth * focal, Math.sqrt(dx * dx + dy * dy + dz * dz)};
	}
}
