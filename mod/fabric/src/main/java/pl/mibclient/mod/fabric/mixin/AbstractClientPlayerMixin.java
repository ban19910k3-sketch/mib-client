package pl.mibclient.mod.fabric.mixin;

import net.minecraft.client.player.AbstractClientPlayer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;
import pl.mibclient.mod.fabric.MibClient;

/** FOV changer: bez zmiany pola widzenia przy biegu i miksturach; luneta i napinanie łuku działają jak w grze. */
@Mixin(AbstractClientPlayer.class)
public abstract class AbstractClientPlayerMixin {
	//#if MC >= 1.21.2
	@Inject(method = "getFieldOfViewModifier", at = @At("HEAD"), cancellable = true)
	private void mib$fixedFov(boolean firstPerson, float fovEffectScale, CallbackInfoReturnable<Float> cir) {
		fixed(cir);
	}
	//#else
	@Inject(method = "getFieldOfViewModifier", at = @At("HEAD"), cancellable = true)
	private void mib$fixedFov(CallbackInfoReturnable<Float> cir) {
		fixed(cir);
	}
	//#endif

	private void fixed(CallbackInfoReturnable<Float> cir) {
		if (!((AbstractClientPlayer) (Object) this).isUsingItem() && MibClient.get().fixedFovMultiplier()) cir.setReturnValue(1.0f);
	}
}
