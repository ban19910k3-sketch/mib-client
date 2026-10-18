package pl.mibclient.mod.fabric.mixin;

import net.minecraft.client.gui.MibGraphics;
import net.minecraft.client.gui.screens.Screen;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import pl.mibclient.mod.fabric.VanillaHud;

/** Inventory: ekwipunek i skrzynie bez przyciemnienia gry w tle. */
@Mixin(Screen.class)
public abstract class ScreenMixin {
	//#if MC >= 26.1
	@Inject(method = "extractTransparentBackground", at = @At("HEAD"), cancellable = true)
	//#else
	@Inject(method = "renderTransparentBackground", at = @At("HEAD"), cancellable = true)
	//#endif
	private void mib$noDim(MibGraphics g, CallbackInfo ci) {
		if (VanillaHud.noContainerDim(this)) ci.cancel();
	}
}
