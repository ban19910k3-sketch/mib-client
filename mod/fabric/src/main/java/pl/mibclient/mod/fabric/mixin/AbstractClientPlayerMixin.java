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
 * Kosmetyki: założona peleryna MiB zamiast peleryny ze skórki, z Elytras także na elytrze; skrzydła MiB jako tekstura elytry.
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
		AbstractClientPlayer p = (AbstractClientPlayer) (Object) this;
		MibId cape = MibClient.get().capeFor(p), wings = MibClient.get().cosmeticFor(p, "wings");
		if (cape == null && wings == null) return;
		PlayerSkin s = cir.getReturnValue();
		// skrzydła MiB mają pierwszeństwo przed peleryną na elytrze (Elytras)
		MibId elytra = wings != null ? wings : pl.mibclient.mod.fabric.Looks.capeOnElytra() ? cape : null;
		//#if MC >= 1.21.9
		ClientAsset.Texture c = cape == null ? s.cape() : new ClientAsset.ResourceTexture(cape, cape);
		ClientAsset.Texture e = elytra == null ? s.elytra() : new ClientAsset.ResourceTexture(elytra, elytra);
		cir.setReturnValue(new PlayerSkin(s.body(), c, e, s.model(), s.secure()));
		//#else
		cir.setReturnValue(new PlayerSkin(s.texture(), s.textureUrl(), cape == null ? s.capeTexture() : cape, elytra == null ? s.elytraTexture() : elytra, s.model(), s.secure()));
		//#endif
	}
}
