package pl.mibclient.mod.fabric.mixin;

import net.minecraft.client.gui.MibGraphics;
import net.minecraft.client.gui.components.SubtitleOverlay;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import pl.mibclient.mod.fabric.VanillaHud;

/** Subtitles: rozmiar i położenie napisów do dźwięków. */
@Mixin(SubtitleOverlay.class)
public abstract class SubtitleOverlayMixin {
	//#if MC >= 26.1
	@Inject(method = "extractRenderState", at = @At("HEAD"))
	//#else
	@Inject(method = "render", at = @At("HEAD"))
	//#endif
	private void mib$start(MibGraphics g, CallbackInfo ci) {
		VanillaHud.subtitlesStart(g);
	}

	//#if MC >= 26.1
	@Inject(method = "extractRenderState", at = @At("RETURN"))
	//#else
	@Inject(method = "render", at = @At("RETURN"))
	//#endif
	private void mib$end(MibGraphics g, CallbackInfo ci) {
		VanillaHud.subtitlesEnd(g);
	}
}
