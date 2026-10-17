package pl.mibclient.mod.fabric;

import java.util.List;
import net.fabricmc.fabric.api.client.screen.v1.ScreenEvents;
import net.fabricmc.fabric.api.client.screen.v1.Screens;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.MibGraphics;
import net.minecraft.client.gui.components.AbstractWidget;
import net.minecraft.client.gui.components.StringWidget;
import net.minecraft.client.gui.screens.PauseScreen;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.TitleScreen;
import net.minecraft.resources.MibId;
//#if MC >= 1.21.6
import net.minecraft.client.renderer.RenderPipelines;
//#elif MC >= 1.21.2
import net.minecraft.client.renderer.RenderType;
//#else
import com.mojang.blaze3d.systems.RenderSystem;
//#endif

/**
 * Logo MiB Client: na ekranie tytułowym zamiast logo Minecrafta (TitleScreenMixin) i w menu pauzy (Esc) zamiast
 * napisu „Menu gry”. Rozmiar dobierany do miejsca nad przyciskami.
 */
public final class Logo {
	private static final MibId TEXTURE = MibId.fromNamespaceAndPath("mibclient", "textures/gui/logo.png");
	/** Proporcje obrazka logo (1126×157). */
	private static final float RATIO = 1126f / 157f;
	/** Górna krawędź przycisków ekranu tytułowego (ustawiana po jego otwarciu). */
	private static int titleTop = -1;

	private Logo() {
	}

	static void register() {
		ScreenEvents.AFTER_INIT.register((client, screen, width, height) -> {
			if (screen instanceof TitleScreen) {
				titleTop = top(screen, false);
				return;
			}
			if (!(screen instanceof PauseScreen)) return;
			int top = top(screen, true);
			if (top == Integer.MAX_VALUE) return; // menu bez przycisków (F3+Esc)
			int[] box = fit(width, 4, top - 6, 44);
			//#if MC >= 26.1
			ScreenEvents.afterExtract(screen).register((s, g, mouseX, mouseY, delta) -> draw(g, box, 1f));
			//#else
			ScreenEvents.afterRender(screen).register((s, g, mouseX, mouseY, delta) -> draw(g, box, 1f));
			//#endif
		});
	}

	/**
	 * Górna krawędź przycisków menu (bez małych ikon, np. znajomych w rogu); hideTitle chowa napis z tytułem ekranu
	 * (w menu pauzy jego miejsce zajmuje logo).
	 */
	private static int top(Screen screen, boolean hideTitle) {
		//#if MC >= 26.1
		List<AbstractWidget> widgets = Screens.getWidgets(screen);
		//#else
		List<AbstractWidget> widgets = Screens.getButtons(screen);
		//#endif
		int top = Integer.MAX_VALUE;
		AbstractWidget title = null;
		for (AbstractWidget w : widgets) {
			if (w instanceof StringWidget && w.getMessage().equals(screen.getTitle())) title = w;
			else if (w.visible && w.getWidth() >= 90) top = Math.min(top, w.getY());
		}
		// bez przycisków (pauza przez F3+Esc) napis zostaje — nie ma miejsca na logo
		if (hideTitle && title != null && top != Integer.MAX_VALUE) title.visible = false;
		return top;
	}

	/** Logo między y0 a y1 (wyśrodkowane), najwyżej maxH wysokości i z marginesem 8 po bokach: {x, y, w, h}. */
	static int[] fit(int screenWidth, int y0, int y1, int maxH) {
		int h = Math.max(8, Math.min(maxH, y1 - y0));
		int w = Math.round(h * RATIO);
		if (w > screenWidth - 16) {
			w = Math.max(16, screenWidth - 16);
			h = Math.round(w / RATIO);
		}
		return new int[] {(screenWidth - w) / 2, y0 + Math.max(0, (y1 - y0 - h) / 2), w, h};
	}

	/** Ekran tytułowy: zamiast logo Minecrafta, nad przyciskami. */
	public static void drawTitle(MibGraphics g, int screenWidth, float alpha) {
		MibClient.hooks.add("title-logo");
		int top = Input.screen(Minecraft.getInstance()) instanceof TitleScreen && titleTop > 0 && titleTop != Integer.MAX_VALUE
				? titleTop : Minecraft.getInstance().getWindow().getGuiScaledHeight() / 4 + 48;
		draw(g, fit(screenWidth, 10, top - 8, 56), alpha);
	}

	static void draw(MibGraphics g, int[] box, float alpha) {
		MibClient.hooks.add("logo");
		int x = box[0], y = box[1], w = box[2], h = box[3];
		int color = (Math.round(Math.max(0f, Math.min(1f, alpha)) * 255) << 24) | 0xFFFFFF;
		//#if MC >= 1.21.6
		g.blit(RenderPipelines.GUI_TEXTURED, TEXTURE, x, y, 0, 0, w, h, w, h, color);
		//#elif MC >= 1.21.2
		g.blit(RenderType::guiTextured, TEXTURE, x, y, 0, 0, w, h, w, h, color);
		//#else
		RenderSystem.enableBlend();
		g.setColor(1f, 1f, 1f, (color >>> 24) / 255f);
		g.blit(TEXTURE, x, y, 0, 0, w, h, w, h);
		g.setColor(1f, 1f, 1f, 1f);
		//#endif
	}
}
