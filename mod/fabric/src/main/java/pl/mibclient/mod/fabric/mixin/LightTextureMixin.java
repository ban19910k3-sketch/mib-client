package pl.mibclient.mod.fabric.mixin;

import com.llamalad7.mixinextras.injector.ModifyExpressionValue;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Slice;
import pl.mibclient.mod.fabric.MibClient;
//#if MC >= 26.1
import net.minecraft.client.renderer.LightmapRenderStateExtractor;
//#else
import net.minecraft.client.renderer.LightTexture;
//#endif

/** Brightness: podmienia odczyt jasności (gamma) przy liczeniu oświetlenia, bez zmiany opcji gracza. */
//#if MC >= 26.1
@Mixin(LightmapRenderStateExtractor.class)
//#else
@Mixin(LightTexture.class)
//#endif
public abstract class LightTextureMixin {
	//#if MC >= 26.1
	@ModifyExpressionValue(method = "extract",
	//#else
	@ModifyExpressionValue(method = "updateLightTexture",
	//#endif
			slice = @Slice(from = @At(value = "INVOKE", target = "Lnet/minecraft/client/Options;gamma()Lnet/minecraft/client/OptionInstance;")),
			at = @At(value = "INVOKE", target = "Lnet/minecraft/client/OptionInstance;get()Ljava/lang/Object;", ordinal = 0))
	private Object mib$gamma(Object original) {
		Double g = MibClient.get().gammaOverride();
		return g != null ? g : original;
	}
}
