package pl.mibclient.mod.fabric.mixin;

import com.llamalad7.mixinextras.injector.ModifyExpressionValue;
import net.minecraft.client.render.LightmapTextureManager;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Slice;
import pl.mibclient.mod.fabric.MibClient;

/** Brightness: podmienia odczyt jasności (gamma) przy liczeniu oświetlenia, bez zmiany opcji gracza. */
@Mixin(LightmapTextureManager.class)
public abstract class LightmapTextureManagerMixin {
	@ModifyExpressionValue(method = "update",
			slice = @Slice(from = @At(value = "INVOKE", target = "Lnet/minecraft/client/option/GameOptions;getGamma()Lnet/minecraft/client/option/SimpleOption;")),
			at = @At(value = "INVOKE", target = "Lnet/minecraft/client/option/SimpleOption;getValue()Ljava/lang/Object;", ordinal = 0))
	private Object mib$gamma(Object original) {
		Double g = MibClient.get().gammaOverride();
		return g != null ? g : original;
	}
}
