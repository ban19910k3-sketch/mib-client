package pl.mibclient.mod.fabric;

import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gl.RenderPipelines;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.hud.InGameHud;
import net.minecraft.entity.effect.StatusEffect;
import net.minecraft.item.ItemStack;
import net.minecraft.registry.entry.RegistryEntry;
import org.joml.Matrix3x2fStack;
import pl.mibclient.mod.core.Canvas;

/** Canvas części wspólnej na DrawContext z 1.21.11. */
public final class FabricCanvas implements Canvas {
	private final DrawContext ctx;
	private final TextRenderer font;

	public FabricCanvas(DrawContext ctx, TextRenderer font) {
		this.ctx = ctx;
		this.font = font;
	}

	@Override
	public void fill(int x1, int y1, int x2, int y2, int argb) {
		ctx.fill(x1, y1, x2, y2, argb);
	}

	@Override
	public void text(String s, int x, int y, int argb, boolean shadow) {
		ctx.drawText(font, s, x, y, argb, shadow);
	}

	@Override
	public int textWidth(String s) {
		return font.getWidth(s);
	}

	@Override
	public int lineHeight() {
		return 9;
	}

	@Override
	public void push(float scale, int ox, int oy) {
		Matrix3x2fStack m = ctx.getMatrices();
		m.pushMatrix();
		m.translate(ox, oy);
		m.scale(scale, scale);
		m.translate(-ox, -oy);
	}

	@Override
	public void pop() {
		ctx.getMatrices().popMatrix();
	}

	@Override
	public void scissor(int x1, int y1, int x2, int y2) {
		ctx.enableScissor(x1, y1, x2, y2);
	}

	@Override
	public void unscissor() {
		ctx.disableScissor();
	}

	@Override
	public void item(Object stack, int x, int y) {
		if (!(stack instanceof ItemStack s) || s.isEmpty()) return;
		ctx.drawItem(s, x, y);
		ctx.drawStackOverlay(font, s, x, y);
	}

	@Override
	@SuppressWarnings("unchecked")
	public void effectIcon(Object handle, int x, int y) {
		if (!(handle instanceof RegistryEntry<?> e)) return;
		ctx.drawGuiTexture(RenderPipelines.GUI_TEXTURED, InGameHud.getEffectTexture((RegistryEntry<StatusEffect>) e), x, y, 18, 18);
	}
}
