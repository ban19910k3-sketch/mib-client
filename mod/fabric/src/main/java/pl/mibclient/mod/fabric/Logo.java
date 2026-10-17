package pl.mibclient.mod.fabric;

import net.fabricmc.fabric.api.client.screen.v1.ScreenEvents;
import net.minecraft.client.gui.MibGraphics;
import net.minecraft.client.gui.screens.PauseScreen;
import net.minecraft.resources.MibId;
//#if MC >= 1.21.6
import net.minecraft.client.renderer.RenderPipelines;
//#elif MC >= 1.21.2
import net.minecraft.client.renderer.RenderType;
//#else
import com.mojang.blaze3d.systems.RenderSystem;
//#endif

/**
 * Logo MiB Client w menu pauzy (Esc), nad przyciskami. Na ekranie tytułowym logo Minecrafta podmieniają pliki
 * assets/minecraft/textures/gui/title (minecraft.png, edition.png) — bez kodu, tak samo na każdej wersji.
 */
final class Logo {
	private static final MibId TEXTURE = MibId.fromNamespaceAndPath("mibclient", "textures/gui/logo.png");
	private static final int W = 128, H = 32;

	private Logo() {
	}

	static void register() {
		ScreenEvents.AFTER_INIT.register((client, screen, width, height) -> {
			if (!(screen instanceof PauseScreen)) return;
			//#if MC >= 26.1
			ScreenEvents.afterExtract(screen).register((s, g, mouseX, mouseY, delta) -> draw(g, s.width));
			//#else
			ScreenEvents.afterRender(screen).register((s, g, mouseX, mouseY, delta) -> draw(g, s.width));
			//#endif
		});
	}

	/** Tekstura 512×128 rysowana jako 128×32 jednostek GUI na środku u góry. */
	static void draw(MibGraphics g, int screenWidth) {
		MibClient.hooks.add("logo");
		int x = (screenWidth - W) / 2, y = 4;
		//#if MC >= 1.21.6
		g.blit(RenderPipelines.GUI_TEXTURED, TEXTURE, x, y, 0, 0, W, H, W, H);
		//#elif MC >= 1.21.2
		g.blit(RenderType::guiTextured, TEXTURE, x, y, 0, 0, W, H, W, H);
		//#else
		RenderSystem.enableBlend();
		g.blit(TEXTURE, x, y, 0, 0, W, H, W, H);
		//#endif
	}
}
