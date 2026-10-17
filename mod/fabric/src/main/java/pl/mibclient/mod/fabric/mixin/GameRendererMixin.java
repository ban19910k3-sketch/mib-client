package pl.mibclient.mod.fabric.mixin;

import net.minecraft.client.Camera;
import net.minecraft.client.renderer.GameRenderer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;
import pl.mibclient.mod.fabric.MibClient;

/** FOV changer i Zoom zmieniają pole widzenia świata (nie ręki). */
@Mixin(GameRenderer.class)
public abstract class GameRendererMixin {
	//#if MC >= 1.21.2
	@Inject(method = "getFov", at = @At("RETURN"), cancellable = true)
	private void mib$fov(Camera camera, float partialTick, boolean useFovSetting, CallbackInfoReturnable<Float> cir) {
		if (useFovSetting) cir.setReturnValue(MibClient.get().modifyFov(cir.getReturnValue()));
	}
	//#else
	@Inject(method = "getFov", at = @At("RETURN"), cancellable = true)
	private void mib$fov(Camera camera, float partialTick, boolean useFovSetting, CallbackInfoReturnable<Double> cir) {
		if (useFovSetting) cir.setReturnValue((double) MibClient.get().modifyFov(cir.getReturnValue().floatValue()));
	}
	//#endif
}
