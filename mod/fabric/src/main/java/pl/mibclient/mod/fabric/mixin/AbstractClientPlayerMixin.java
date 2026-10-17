package pl.mibclient.mod.fabric.mixin;

import net.minecraft.client.player.AbstractClientPlayer;
import net.minecraft.resources.MibId;
//#if MC >= 1.21.9
import net.minecraft.core.ClientAsset;
import net.minecraft.world.entity.player.PlayerSkin;
//#else
import net.minecraft.client.resources.PlayerSkin;
//#endif
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;
import pl.mibclient.mod.fabric.MibClient;

/**
 * FOV changer: bez zmiany pola widzenia przy biegu i miksturach; luneta i napinanie łuku działają jak w grze.
 * Kosmetyki: założona peleryna MiB zamiast peleryny ze skórki (na własnej postaci).
 */
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

	@Inject(method = "getSkin", at = @At("RETURN"), cancellable = true)
	private void mib$cape(CallbackInfoReturnable<PlayerSkin> cir) {
		MibId cape = MibClient.get().capeFor((AbstractClientPlayer) (Object) this);
		if (cape == null) return;
		PlayerSkin s = cir.getReturnValue();
		//#if MC >= 1.21.9
		cir.setReturnValue(new PlayerSkin(s.body(), new ClientAsset.ResourceTexture(cape, cape), s.elytra(), s.model(), s.secure()));
		//#else
		cir.setReturnValue(new PlayerSkin(s.texture(), s.textureUrl(), cape, s.elytraTexture(), s.model(), s.secure()));
		//#endif
	}
}
