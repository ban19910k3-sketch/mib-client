package pl.mibclient.mod.fabric.mixin;

import org.spongepowered.asm.mixin.Mixin;
//#if MC < 26.1
import com.llamalad7.mixinextras.sugar.Local;
import net.minecraft.client.gui.MibGraphics;
import net.minecraft.client.renderer.PanoramaRenderer;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import pl.mibclient.mod.fabric.Logo;
//#else
import net.minecraft.client.gui.screens.TitleScreen;
//#endif

/**
 * Motyw Halloween: zmrok i księżyc na panoramie menu gry (rysowane zaraz po panoramie, więc pod przyciskami).
 * Od 26.1 klasy panoramy nie ma — tam zmrok dokłada TitleScreenMixin, a ta wstawka jest pusta.
 */
//#if MC < 26.1
@Mixin(PanoramaRenderer.class)
public abstract class PanoramaRendererMixin {
	@Inject(method = "render", at = @At("TAIL"))
	private void mib$dusk(CallbackInfo ci, @Local(argsOnly = true) MibGraphics g) {
		Logo.dusk(g);
	}
}
//#else
@Mixin(TitleScreen.class)
public abstract class PanoramaRendererMixin {
}
//#endif
