package pl.mibclient.mod.core;

import java.util.ArrayList;
import java.util.List;

/** Atrapa Canvas do testów: zapisuje wywołania, znak ma szerokość 6, linia 9. */
public class RecordingCanvas implements Canvas {
	public static final class Text {
		public final String s;
		public final int x, y, color;

		Text(String s, int x, int y, int color) {
			this.s = s;
			this.x = x;
			this.y = y;
			this.color = color;
		}
	}

	public final List<int[]> fills = new ArrayList<int[]>();
	public final List<Text> texts = new ArrayList<Text>();
	public final List<String> items = new ArrayList<String>();
	public int pushes, pops;

	@Override
	public void fill(int x1, int y1, int x2, int y2, int argb) {
		fills.add(new int[] {x1, y1, x2, y2, argb});
	}

	@Override
	public void text(String s, int x, int y, int argb, boolean shadow) {
		texts.add(new Text(s, x, y, argb));
	}

	@Override
	public int textWidth(String s) {
		return s.length() * 6;
	}

	@Override
	public int lineHeight() {
		return 9;
	}

	@Override
	public void push(float scale, int ox, int oy) {
		pushes++;
	}

	@Override
	public void pop() {
		pops++;
	}

	@Override
	public void scissor(int x1, int y1, int x2, int y2) {
	}

	@Override
	public void unscissor() {
	}

	@Override
	public void item(Object stack, int x, int y) {
		items.add(String.valueOf(stack));
	}

	@Override
	public void effectIcon(Object handle, int x, int y) {
		items.add("effect:" + handle);
	}

	public void clear() {
		fills.clear();
		texts.clear();
		items.clear();
	}

	/** Czy piksel (x, y) jest pokryty przez któryś fill. */
	public boolean covered(int x, int y) {
		for (int[] f : fills) if (x >= f[0] && x < f[2] && y >= f[1] && y < f[3]) return true;
		return false;
	}

	public int coverCount(int x, int y) {
		int n = 0;
		for (int[] f : fills) if (x >= f[0] && x < f[2] && y >= f[1] && y < f[3]) n++;
		return n;
	}

	public boolean hasText(String s) {
		for (Text t : texts) if (t.s.equals(s)) return true;
		return false;
	}

	public boolean hasTextContaining(String s) {
		for (Text t : texts) if (t.s.contains(s)) return true;
		return false;
	}

	public Text text(String s) {
		for (Text t : texts) if (t.s.equals(s)) return t;
		return null;
	}

	public boolean hasFillColor(int color) {
		for (int[] f : fills) if (f[4] == color) return true;
		return false;
	}
}
