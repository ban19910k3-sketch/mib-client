package pl.mibclient.mod.core;

import java.awt.Color;
import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.AffineTransform;
import java.awt.image.BufferedImage;
import java.io.File;
import java.io.IOException;
import java.util.ArrayDeque;
import javax.imageio.ImageIO;

/** Podgląd rysowania do PNG (tylko w testach): ten sam kod menu i HUD, font zastępczy zamiast fontu Minecrafta. */
public class PreviewCanvas implements Canvas {
	public final BufferedImage img;
	private final Graphics2D g;
	private final FontMetrics fm;
	private final ArrayDeque<AffineTransform> stack = new ArrayDeque<AffineTransform>();

	public PreviewCanvas(int windowW, int windowH, int scale) {
		img = new BufferedImage(windowW, windowH, BufferedImage.TYPE_INT_ARGB);
		g = img.createGraphics();
		g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_OFF);
		g.scale(scale, scale);
		g.setFont(new Font(Font.SANS_SERIF, Font.PLAIN, 8));
		fm = g.getFontMetrics();
	}

	/** Tło udające świat gry: niebo, wzgórza, ziemia. */
	public void gameBackground(int w, int h) {
		for (int y = 0; y < h; y++) {
			float t = y / (float) h;
			g.setColor(new Color(0.43f + t * 0.2f, 0.62f + t * 0.15f, 0.91f));
			g.fillRect(0, y, w, 1);
		}
		g.setColor(new Color(0x5f9a31));
		g.fillRect(0, h * 2 / 3, w, 12);
		g.setColor(new Color(0x6b4629));
		g.fillRect(0, h * 2 / 3 + 12, w, h);
	}

	@Override
	public void fill(int x1, int y1, int x2, int y2, int argb) {
		g.setColor(new Color(argb, true));
		g.fillRect(x1, y1, x2 - x1, y2 - y1);
	}

	// ===== Gładka czcionka MiB: te same obrazki i wymiary co w grze (dostawca "bitmap": szerokość litery od
	// ostatniej niepustej kolumny, odstęp +1, spacja z dostawcy "space"); w menu skala 0,5, linia bazowa na y + 7 =====
	private static final class Face {
		BufferedImage img;
		final java.util.Map<Character, int[]> cells = new java.util.HashMap<Character, int[]>();
		final java.util.Map<Character, Integer> adv = new java.util.HashMap<Character, Integer>();
		int cw, chh, space;
		final java.util.Map<Integer, BufferedImage> tinted = new java.util.HashMap<Integer, BufferedImage>();
	}

	private static final Face[] FACES = new Face[4];
	private int face = GAME;

	@SuppressWarnings("unchecked")
	private static Face load(String name) {
		try {
			File dir = new File("../fabric/src/main/resources/assets/mibclient");
			String json = new String(java.nio.file.Files.readAllBytes(new File(dir, "font/" + name + ".json").toPath()), "UTF-8");
			Face f = new Face();
			for (Object o : (java.util.List<Object>) ((java.util.Map<String, Object>) Json.parse(json)).get("providers")) {
				java.util.Map<String, Object> pr = (java.util.Map<String, Object>) o;
				if ("space".equals(pr.get("type"))) f.space = ((Number) ((java.util.Map<String, Object>) pr.get("advances")).get(" ")).intValue();
				if (!"bitmap".equals(pr.get("type"))) continue;
				java.util.List<Object> rows = (java.util.List<Object>) pr.get("chars");
				f.img = ImageIO.read(new File(dir, "textures/font/" + name + ".png"));
				int cols = ((String) rows.get(0)).length();
				f.cw = f.img.getWidth() / cols;
				f.chh = f.img.getHeight() / rows.size();
				double scale = ((Number) pr.get("height")).doubleValue() / f.chh;
				for (int r = 0; r < rows.size(); r++) {
					String row = (String) rows.get(r);
					for (int c = 0; c < row.length(); c++) {
						char ch = row.charAt(c);
						if (ch == 0) continue;
						int k = 0;
						for (int px = f.cw - 1; px >= 0 && k == 0; px--)
							for (int py = 0; py < f.chh; py++) if ((f.img.getRGB(c * f.cw + px, r * f.chh + py) >>> 24) != 0) {
								k = px + 1;
								break;
							}
						f.cells.put(ch, new int[] {c * f.cw, r * f.chh});
						f.adv.put(ch, (int) (0.5 + k * scale) + 1);
					}
				}
			}
			return f;
		} catch (IOException e) {
			throw new RuntimeException(e);
		}
	}

	private Face face() {
		if (face == GAME) return null;
		if (FACES[face] == null) FACES[face] = load(new String[] {null, "ui", "ui_bold", "ui_title"}[face]);
		return FACES[face];
	}

	@Override
	public void font(int f) {
		face = f >= 0 && f < 4 ? f : GAME;
	}

	@Override
	public int font() {
		return face;
	}

	private int advance(Face f, char ch) {
		if (ch == ' ' || ch == '\u00a0') return f.space;
		Integer a = f.adv.get(ch);
		return a != null ? a : 12;
	}

	@Override
	public void text(String s, int x, int y, int argb, boolean shadow) {
		Face f = face();
		if (f != null) {
			BufferedImage t = f.tinted.get(argb);
			if (t == null) {
				t = new BufferedImage(f.img.getWidth(), f.img.getHeight(), BufferedImage.TYPE_INT_ARGB);
				int rgb = argb & 0xFFFFFF, a0 = argb >>> 24;
				for (int py = 0; py < t.getHeight(); py++)
					for (int px = 0; px < t.getWidth(); px++) t.setRGB(px, py, ((f.img.getRGB(px, py) >>> 24) * a0 / 255) << 24 | rgb);
				f.tinted.put(argb, t);
			}
			AffineTransform old = g.getTransform();
			Object interp = g.getRenderingHint(RenderingHints.KEY_INTERPOLATION);
			g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_NEAREST_NEIGHBOR);
			double pen = 0, k = 24.0 / f.chh * 0.5;
			for (int i = 0; i < s.length(); i++) {
				char ch = s.charAt(i);
				int[] cell = f.cells.get(ch);
				if (cell != null) {
					g.setTransform(old);
					g.translate(x + pen * 0.5, y - 3);
					g.scale(k, k);
					g.drawImage(t, 0, 0, f.cw, f.chh, cell[0], cell[1], cell[0] + f.cw, cell[1] + f.chh, null);
				}
				pen += advance(f, ch);
			}
			g.setTransform(old);
			if (interp != null) g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, interp);
			return;
		}
		textGame(s, x, y, argb, shadow);
	}

	private void textGame(String s, int x, int y, int argb, boolean shadow) {
		if (shadow) {
			g.setColor(new Color(0x3F3F3F));
			g.drawString(s, x + 1, y + 1 + fm.getAscent() - 1);
		}
		g.setColor(new Color(argb, true));
		g.drawString(s, x, y + fm.getAscent() - 1);
	}

	@Override
	public int textWidth(String s) {
		Face f = face();
		if (f != null) {
			int w = 0;
			for (int i = 0; i < s.length(); i++) w += advance(f, s.charAt(i));
			return (w + 1) / 2;
		}
		return fm.stringWidth(s);
	}

	@Override
	public int lineHeight() {
		return 9;
	}

	@Override
	public void push(float scale, int ox, int oy) {
		stack.push(g.getTransform());
		g.translate(ox, oy);
		g.scale(scale, scale);
		g.translate(-ox, -oy);
	}

	@Override
	public void pop() {
		g.setTransform(stack.pop());
	}

	/** Przycięcia jak w grze: stos, a każde nowe jest częścią wspólną z poprzednim. */
	private final ArrayDeque<java.awt.Shape> clips = new ArrayDeque<java.awt.Shape>();

	@Override
	public void scissor(int x1, int y1, int x2, int y2) {
		java.awt.Shape prev = g.getClip();
		clips.push(prev == null ? new java.awt.Rectangle(-100000, -100000, 200000, 200000) : prev);
		g.clipRect(x1, y1, x2 - x1, y2 - y1);
	}

	@Override
	public void unscissor() {
		java.awt.Shape prev = clips.isEmpty() ? null : clips.pop();
		g.setClip(clips.isEmpty() ? null : prev);
	}

	@Override
	public void item(Object stack, int x, int y) {
		fill(x + 2, y + 2, x + 14, y + 14, 0xFF8B8B8B);
		fill(x + 4, y + 4, x + 12, y + 12, 0xFFC6C6C6);
	}

	@Override
	public void effectIcon(Object handle, int x, int y) {
		fill(x + 2, y + 2, x + 16, y + 16, 0xFF60A5FA);
	}

	public void save(File f) throws IOException {
		f.getParentFile().mkdirs();
		ImageIO.write(img, "png", f);
	}

	/** Postać w podglądzie: prosta sylwetka (jak skin Steve'a) wyśrodkowana w prostokącie, wysokość ok. 1,8 × size. */
	@Override
	public void player(int x1, int y1, int x2, int y2, int size) {
		int h = size * 9 / 5, u = Math.max(1, h / 32), cx = (x1 + x2) / 2, top = y2 - 4 - 32 * u;
		fill(cx - 4 * u, top, cx + 4 * u, top + 8 * u, 0xFF8D6044);
		fill(cx - 4 * u, top + 8 * u, cx + 4 * u, top + 20 * u, 0xFF00A8A8);
		fill(cx - 8 * u, top + 8 * u, cx - 4 * u, top + 20 * u, 0xFF8D6044);
		fill(cx + 4 * u, top + 8 * u, cx + 8 * u, top + 20 * u, 0xFF8D6044);
		fill(cx - 4 * u, top + 20 * u, cx, top + 32 * u, 0xFF3B3B9E);
		fill(cx, top + 20 * u, cx + 4 * u, top + 32 * u, 0xFF3B3B9E);
	}
}
