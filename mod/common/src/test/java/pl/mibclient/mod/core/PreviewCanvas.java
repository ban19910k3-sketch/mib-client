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

	@Override
	public void text(String s, int x, int y, int argb, boolean shadow) {
		if (shadow) {
			g.setColor(new Color(0x3F3F3F));
			g.drawString(s, x + 1, y + 1 + fm.getAscent() - 1);
		}
		g.setColor(new Color(argb, true));
		g.drawString(s, x, y + fm.getAscent() - 1);
	}

	@Override
	public int textWidth(String s) {
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

	@Override
	public void scissor(int x1, int y1, int x2, int y2) {
		g.setClip(x1, y1, x2 - x1, y2 - y1);
	}

	@Override
	public void unscissor() {
		g.setClip(null);
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
