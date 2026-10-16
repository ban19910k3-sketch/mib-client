package pl.mibclient.mod.core;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Edytor HUD bez gry: przeciąganie (z przyciąganiem), skala kółkiem, prawy przycisk = ustawienia modułu.
 * Do pliku zapisuje dopiero po puszczeniu przycisku, przewinięciu albo resecie.
 */
public final class HudEditorModel {
	public static final int SNAP = 4;

	/** Prostokąt elementu na ekranie (jednostki GUI, rozmiar po przeskalowaniu). */
	public static final class Box {
		public final String id;
		public final int x, y, w, h;
		public final double scale;

		public Box(String id, int x, int y, int w, int h, double scale) {
			this.id = id;
			this.x = x;
			this.y = y;
			this.w = w;
			this.h = h;
			this.scale = scale;
		}

		boolean contains(double px, double py) {
			return px >= x && px < x + w && py >= y && py < y + h;
		}
	}

	private final ModuleManager modules;
	private List<Box> boxes = Collections.emptyList();
	private int sw, sh;
	private Box dragging;
	private double grabX, grabY;
	private HudPos pending;
	private String settingsRequest;

	public HudEditorModel(ModuleManager modules) {
		this.modules = modules;
	}

	public void setBoxes(List<Box> boxes, int sw, int sh) {
		this.boxes = new ArrayList<Box>(boxes);
		this.sw = sw;
		this.sh = sh;
	}

	public List<Box> boxes() {
		return boxes;
	}

	public boolean isDragging(String id) {
		return dragging != null && dragging.id.equals(id);
	}

	/** Położenie w trakcie przeciągania (jeszcze niezapisane) albo null. */
	public HudPos pending(String id) {
		return pending != null && isDragging(id) ? pending : null;
	}

	private Box at(double x, double y) {
		for (int i = boxes.size() - 1; i >= 0; i--) if (boxes.get(i).contains(x, y)) return boxes.get(i);
		return null;
	}

	public boolean mouseDown(double x, double y, int button) {
		Box b = at(x, y);
		if (b == null) return false;
		if (button == 1) {
			settingsRequest = b.id;
			return true;
		}
		if (button != 0) return false;
		dragging = b;
		grabX = x - b.x;
		grabY = y - b.y;
		pending = null;
		return true;
	}

	public void mouseDrag(double x, double y) {
		if (dragging == null) return;
		List<int[]> others = new ArrayList<int[]>();
		for (Box o : boxes) if (o != dragging) others.add(new int[] {o.x, o.y, o.w, o.h});
		int[] xy = HudLayout.snap((int) Math.round(x - grabX), (int) Math.round(y - grabY), dragging.w, dragging.h, others, sw, sh, SNAP);
		int[] in = HudLayout.place(HudLayout.toPos(xy[0], xy[1], dragging.w, dragging.h, sw, sh, dragging.scale), dragging.w, dragging.h, sw, sh);
		pending = HudLayout.toPos(in[0], in[1], dragging.w, dragging.h, sw, sh, dragging.scale);
	}

	public void mouseUp() {
		if (dragging != null && pending != null) {
			modules.config().module(dragging.id).setHud(pending);
			modules.config().save();
		}
		dragging = null;
		pending = null;
	}

	public boolean scroll(double x, double y, double amount) {
		Box b = at(x, y);
		if (b == null || amount == 0) return false;
		ModuleDef d = modules.def(b.id);
		ModuleState s = modules.state(b.id);
		HudPos cur = s.hud(d != null && d.defaultHud != null ? d.defaultHud : HudLayout.toPos(b.x, b.y, b.w, b.h, sw, sh, b.scale));
		double next = Math.round((cur.scale + (amount > 0 ? 0.1 : -0.1)) * 10) / 10.0;
		s.setHud(cur.withScale(Math.max(ModuleState.MIN_SCALE, Math.min(ModuleState.MAX_SCALE, next))));
		modules.config().save();
		return true;
	}

	public void resetAll() {
		for (ModuleDef d : modules.all()) if (d.hud) modules.state(d.id).clearHud();
		modules.config().save();
		dragging = null;
		pending = null;
	}

	/** Id modułu, którego ustawienia gracz chce otworzyć (prawy przycisk); czytane raz. */
	public String settingsRequest() {
		String r = settingsRequest;
		settingsRequest = null;
		return r;
	}
}
