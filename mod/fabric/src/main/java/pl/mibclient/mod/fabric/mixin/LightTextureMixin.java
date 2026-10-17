//#if MC < 26.1
package pl.mibclient.mod.fabric.mixin;

import com.llamalad7.mixinextras.injector.ModifyExpressionValue;
import net.minecraft.client.renderer.LightTexture;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Slice;
import pl.mibclient.mod.fabric.MibClient;

/** Brightness: podmienia odczyt jasności (gamma) przy liczeniu oświetlenia, bez zmiany opcji gracza. */
@Mixin(LightTexture.class)
public abstract class LightTextureMixin {
	@ModifyExpressionValue(method = "updateLightTexture",
			slice = @Slice(from = @At(value = "INVOKE", target = "Lnet/minecraft/client/Options;gamma()Lnet/minecraft/client/OptionInstance;")),
			at = @At(value = "INVOKE", target = "Lnet/minecraft/client/OptionInstance;get()Ljava/lang/Object;", ordinal = 0))
	private Object mib$gamma(Object original) {
		Double g = MibClient.get().gammaOverride();
		return g != null ? g : original;
	}
}
//#else
package pl.mibclient.mod.fabric.mixin;

/** Od 26.1 jasność liczy się w LightmapRenderState — wstawka dla tych wersji jeszcze w przygotowaniu (nie ma jej w mibclient.mixins.json). */
final class LightTextureMixin {
	private LightTextureMixin() {
	}
}
//#endif
