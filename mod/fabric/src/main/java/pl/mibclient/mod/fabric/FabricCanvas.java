package pl.mibclient.mod.fabric;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.MibGraphics;
import net.minecraft.client.gui.screens.inventory.InventoryScreen;
import net.minecraft.client.player.LocalPlayer;
import net.minecraft.core.Holder;
import net.minecraft.resources.MibId;
import net.minecraft.world.effect.MobEffect;
import net.minecraft.world.item.ItemStack;
import pl.mibclient.mod.core.Canvas;
//#if MC >= 1.21.6
import net.minecraft.client.gui.MibHud;
import net.minecraft.client.renderer.RenderPipelines;
import org.joml.Matrix3x2fStack;
//#else
import com.mojang.blaze3d.vertex.PoseStack;
import net.minecraft.client.renderer.texture.TextureAtlasSprite;
//#endif
//#if MC >= 1.21.2 && MC < 1.21.6
import net.minecraft.client.renderer.RenderType;
//#endif
//#if MC < 1.21.2
import com.mojang.blaze3d.systems.RenderSystem;
//#endif

/** Canvas części wspólnej na rysowaniu GUI danej wersji gry. */
public final class FabricCanvas implements Canvas {
	private final MibGraphics g;
	private final Font font;

	public FabricCanvas(MibGraphics g, Font font) {
		this.g = g;
		this.font = font;
	}

	@Override
	public void fill(int x1, int y1, int x2, int y2, int argb) {
		g.fill(x1, y1, x2, y2, argb);
	}

	@Override
	public void text(String s, int x, int y, int argb, boolean shadow) {
		//#if MC >= 26.1
		g.text(font, s, x, y, argb, shadow);
		//#else
		g.drawString(font, s, x, y, argb, shadow);
		//#endif
	}

	@Override
	public int textWidth(String s) {
		return font.width(s);
	}

	@Override
	public int lineHeight() {
		return 9;
	}

	@Override
	public void push(float scale, int ox, int oy) {
		//#if MC >= 1.21.6
		Matrix3x2fStack m = g.pose();
		m.pushMatrix();
		m.translate(ox, oy);
		m.scale(scale, scale);
		m.translate(-ox, -oy);
		//#else
		PoseStack m = g.pose();
		m.pushPose();
		m.translate(ox, oy, 0);
		m.scale(scale, scale, 1);
		m.translate(-ox, -oy, 0);
		//#endif
	}

	@Override
	public void pop() {
		//#if MC >= 1.21.6
		g.pose().popMatrix();
		//#else
		g.pose().popPose();
		//#endif
	}

	@Override
	public void scissor(int x1, int y1, int x2, int y2) {
		g.enableScissor(x1, y1, x2, y2);
	}

	@Override
	public void unscissor() {
		g.disableScissor();
	}

	@Override
	public void item(Object stack, int x, int y) {
		if (!(stack instanceof ItemStack s) || s.isEmpty()) return;
		//#if MC >= 26.1
		g.item(s, x, y);
		g.itemDecorations(font, s, x, y);
		//#else
		g.renderItem(s, x, y);
		g.renderItemDecorations(font, s, x, y);
		//#endif
	}

	@Override
	@SuppressWarnings("unchecked")
	public void effectIcon(Object handle, int x, int y) {
		if (!(handle instanceof Holder<?> h)) return;
		Holder<MobEffect> e = (Holder<MobEffect>) h;
		//#if MC >= 1.21.6
		g.blitSprite(RenderPipelines.GUI_TEXTURED, MibHud.getMobEffectSprite(e), x, y, 18, 18);
		//#else
		TextureAtlasSprite sprite = Minecraft.getInstance().getMobEffectTextures().get(e);
		//#if MC >= 1.21.2
		g.blitSprite(RenderType::guiTextured, sprite, x, y, 18, 18);
		//#else
		g.blit(x, y, 0, 18, 18, sprite);
		//#endif
		//#endif
	}

	@Override
	public void player(int x1, int y1, int x2, int y2, int size) {
		LocalPlayer p = Minecraft.getInstance().player;
		if (p == null) return;
		// „mysz” na środku: postać patrzy prosto przed siebie
		float cx = (x1 + x2) / 2f, cy = (y1 + y2) / 2f;
		//#if MC >= 26.1
		InventoryScreen.extractEntityInInventoryFollowsMouse(g, x1, y1, x2, y2, size, 0.0625f, cx, cy, p);
		//#else
		InventoryScreen.renderEntityInInventoryFollowsMouse(g, x1, y1, x2, y2, size, 0.0625f, cx, cy, p);
		//#endif
	}

	/**
	 * Fragment tekstury (u, v, w, h; tekstura texW×texH) w (x, y) w rozmiarze w×h z kolorem ARGB (przezroczystość
	 * i zabarwienie). Wspólne dla logo, ekranu ładowania i nakładek HUD na każdej wersji gry.
	 */
	public static void blit(MibGraphics g, MibId tex, int x, int y, float u, float v, int w, int h, int texW, int texH, int argb) {
		//#if MC >= 1.21.6
		g.blit(RenderPipelines.GUI_TEXTURED, tex, x, y, u, v, w, h, texW, texH, argb);
		//#elif MC >= 1.21.2
		g.blit(RenderType::guiTextured, tex, x, y, u, v, w, h, texW, texH, argb);
		//#else
		RenderSystem.enableBlend();
		g.setColor(((argb >> 16) & 0xFF) / 255f, ((argb >> 8) & 0xFF) / 255f, (argb & 0xFF) / 255f, (argb >>> 24) / 255f);
		g.blit(tex, x, y, u, v, w, h, texW, texH);
		g.setColor(1f, 1f, 1f, 1f);
		//#endif
	}

	/** Przesunięcie (dx, dy) i skala wokół punktu (ox, oy) dla rysowania gry (pasek bossa, tabela wyników). */
	public static void pushTransform(MibGraphics g, float scale, int ox, int oy, int dx, int dy) {
		//#if MC >= 1.21.6
		Matrix3x2fStack m = g.pose();
		m.pushMatrix();
		m.translate(ox + dx, oy + dy);
		m.scale(scale, scale);
		m.translate(-ox, -oy);
		//#else
		PoseStack m = g.pose();
		m.pushPose();
		m.translate(ox + dx, oy + dy, 0);
		m.scale(scale, scale, 1);
		m.translate(-ox, -oy, 0);
		//#endif
	}

	public static void popTransform(MibGraphics g) {
		//#if MC >= 1.21.6
		g.pose().popMatrix();
		//#else
		g.pose().popPose();
		//#endif
	}
}
