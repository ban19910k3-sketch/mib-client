package pl.mibclient.mod.fabric.mixin;

import net.minecraft.client.network.AbstractClientPlayerEntity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;
import pl.mibclient.mod.fabric.MibClient;

/** FOV changer: bez zmiany pola widzenia przy biegu i miksturach. */
@Mixin(AbstractClientPlayerEntity.class)
public abstract class AbstractClientPlayerEntityMixin {
	@Inject(method = "getFovMultiplier", at = @At("HEAD"), cancellable = true)
	private void mib$fixedFov(boolean firstPerson, float fovEffectScale, CallbackInfoReturnable<Float> cir) {
		if (MibClient.get().fixedFovMultiplier()) cir.setReturnValue(1.0f);
	}
}
