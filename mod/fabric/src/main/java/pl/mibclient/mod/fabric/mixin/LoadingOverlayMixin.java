package pl.mibclient.mod.fabric.mixin;

import com.llamalad7.mixinextras.injector.ModifyExpressionValue;
import com.llamalad7.mixinextras.injector.wrapoperation.Operation;
import com.llamalad7.mixinextras.injector.wrapoperation.WrapOperation;
import net.minecraft.client.gui.MibGraphics;
import net.minecraft.client.gui.screens.LoadingOverlay;
import net.minecraft.resources.MibId;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import pl.mibclient.mod.fabric.Logo;
//#if MC >= 26.3
import com.mojang.renderpearl.api.pipeline.RenderPipeline;
//#elif MC >= 1.21.6
import com.mojang.blaze3d.pipeline.RenderPipeline;
//#elif MC >= 1.21.2
import java.util.function.Function;
import net.minecraft.client.renderer.RenderType;
//#endif

/**
 * Ekran ładowania (start gry, wczytywanie paczek zasobów): ciemne tło MiB, animowane logo MiB Client z
 * numerem wersji zamiast logo Mojang Studios i fioletowy pasek postępu.
 */
@Mixin(LoadingOverlay.class)
public abstract class LoadingOverlayMixin {
	@Shadow
	private float currentProgress;

	//#if MC >= 26.1
	@ModifyExpressionValue(method = "extractRenderState", at = @At(value = "INVOKE", target = "Ljava/util/function/IntSupplier;getAsInt()I"))
	//#else
	@ModifyExpressionValue(method = "render", at = @At(value = "INVOKE", target = "Ljava/util/function/IntSupplier;getAsInt()I"))
	//#endif
	private int mib$background(int original) {
		return Logo.LOADING_BACKGROUND;
	}

	// Logo Mojang Studios to dwie połówki rysowane osobno (druga z v = 60): w miejsce pierwszej logo MiB, druga znika
	//#if MC >= 26.3
	@WrapOperation(method = "extractRenderState", at = @At(value = "INVOKE",
			target = "Lnet/minecraft/client/gui/MibGraphics;blit(Lcom/mojang/renderpearl/api/pipeline/RenderPipeline;Lnet/minecraft/resources/MibId;IIFFIIIIIII)V"))
	private void mib$logo(MibGraphics g, RenderPipeline pipeline, MibId id, int x, int y, float u, float v, int w, int h, int uw, int vh, int tw, int th,
			int color, Operation<Void> original) {
		if (v < 1) Logo.drawLoading(g, (color >>> 24) / 255f);
	}
	//#elif MC >= 26.1
	@WrapOperation(method = "extractRenderState", at = @At(value = "INVOKE",
			target = "Lnet/minecraft/client/gui/MibGraphics;blit(Lcom/mojang/blaze3d/pipeline/RenderPipeline;Lnet/minecraft/resources/MibId;IIFFIIIIIII)V"))
	private void mib$logo(MibGraphics g, RenderPipeline pipeline, MibId id, int x, int y, float u, float v, int w, int h, int uw, int vh, int tw, int th,
			int color, Operation<Void> original) {
		if (v < 1) Logo.drawLoading(g, (color >>> 24) / 255f);
	}
	//#elif MC >= 1.21.6
	@WrapOperation(method = "render", at = @At(value = "INVOKE",
			target = "Lnet/minecraft/client/gui/MibGraphics;blit(Lcom/mojang/blaze3d/pipeline/RenderPipeline;Lnet/minecraft/resources/MibId;IIFFIIIIIII)V"))
	private void mib$logo(MibGraphics g, RenderPipeline pipeline, MibId id, int x, int y, float u, float v, int w, int h, int uw, int vh, int tw, int th,
			int color, Operation<Void> original) {
		if (v < 1) Logo.drawLoading(g, (color >>> 24) / 255f);
	}
	//#elif MC >= 1.21.2
	@WrapOperation(method = "render", at = @At(value = "INVOKE",
			target = "Lnet/minecraft/client/gui/MibGraphics;blit(Ljava/util/function/Function;Lnet/minecraft/resources/MibId;IIFFIIIIIII)V"))
	private void mib$logo(MibGraphics g, Function<MibId, RenderType> type, MibId id, int x, int y, float u, float v, int w, int h, int uw, int vh, int tw,
			int th, int color, Operation<Void> original) {
		if (v < 1) Logo.drawLoading(g, (color >>> 24) / 255f);
	}
	//#else
	@WrapOperation(method = "render", at = @At(value = "INVOKE",
			target = "Lnet/minecraft/client/gui/MibGraphics;blit(Lnet/minecraft/resources/MibId;IIIIFFIIII)V"))
	private void mib$logo(MibGraphics g, MibId id, int x, int y, int w, int h, float u, float v, int uw, int vh, int tw, int th, Operation<Void> original) {
		if (v < 1) Logo.drawLoading(g, -1f);
	}
	//#endif

	//#if MC >= 26.1
	@Inject(method = "extractProgressBar", at = @At("HEAD"), cancellable = true)
	//#else
	@Inject(method = "drawProgressBar", at = @At("HEAD"), cancellable = true)
	//#endif
	private void mib$bar(MibGraphics g, int x1, int y1, int x2, int y2, float alpha, CallbackInfo ci) {
		Logo.drawLoadingBar(g, x1, y1, x2, y2, currentProgress, alpha);
		ci.cancel();
	}
}
