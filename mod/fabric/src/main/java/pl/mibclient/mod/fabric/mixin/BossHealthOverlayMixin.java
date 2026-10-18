package pl.mibclient.mod.fabric.mixin;

import net.minecraft.client.gui.MibGraphics;
import net.minecraft.client.gui.components.BossHealthOverlay;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import pl.mibclient.mod.fabric.VanillaHud;

/** Boss bar: ukrycie, skala i przesunięcie paska bossa. */
@Mixin(BossHealthOverlay.class)
public abstract class BossHealthOverlayMixin {
	//#if MC >= 26.1
	@Inject(method = "extractRenderState", at = @At("HEAD"), cancellable = true)
	//#else
	@Inject(method = "render", at = @At("HEAD"), cancellable = true)
	//#endif
	private void mib$boss(MibGraphics g, CallbackInfo ci) {
		if (!VanillaHud.bossStart(g)) ci.cancel();
	}

	//#if MC >= 26.1
	@Inject(method = "extractRenderState", at = @At("RETURN"))
	//#else
	@Inject(method = "render", at = @At("RETURN"))
	//#endif
	private void mib$bossEnd(MibGraphics g, CallbackInfo ci) {
		VanillaHud.bossEnd(g);
	}
}
