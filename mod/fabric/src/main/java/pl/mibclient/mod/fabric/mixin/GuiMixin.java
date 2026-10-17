package pl.mibclient.mod.fabric.mixin;

import com.llamalad7.mixinextras.injector.wrapoperation.Operation;
import com.llamalad7.mixinextras.injector.wrapoperation.WrapOperation;
import net.minecraft.client.gui.MibGraphics;
import net.minecraft.client.gui.MibHud;
import net.minecraft.resources.MibId;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import pl.mibclient.mod.fabric.MibClient;
//#if MC >= 1.21.6
import com.mojang.blaze3d.pipeline.RenderPipeline;
//#elif MC >= 1.21.2
import java.util.function.Function;
import net.minecraft.client.renderer.RenderType;
//#endif

/**
 * Custom crosshair: podmienia tylko obrazek celownika. Reszta zostaje z gry: wskaźnik ładowania ataku,
 * ukrycie w trzeciej osobie i trybie widza, osie F3.
 */
@Mixin(MibHud.class)
public abstract class GuiMixin {
	//#if MC >= 26.1
	@WrapOperation(method = "extractCrosshair", at = @At(value = "INVOKE",
			target = "Lnet/minecraft/client/gui/MibGraphics;blitSprite(Lcom/mojang/blaze3d/pipeline/RenderPipeline;Lnet/minecraft/resources/MibId;IIII)V"))
	private void mib$crosshair(MibGraphics g, RenderPipeline pipeline, MibId id, int x, int y, int w, int h, Operation<Void> original) {
		if (!isCrosshair(id) || !MibClient.get().drawCrosshair(g)) original.call(g, pipeline, id, x, y, w, h);
	}
	//#elif MC >= 1.21.6
	@WrapOperation(method = "renderCrosshair", at = @At(value = "INVOKE",
			target = "Lnet/minecraft/client/gui/MibGraphics;blitSprite(Lcom/mojang/blaze3d/pipeline/RenderPipeline;Lnet/minecraft/resources/MibId;IIII)V"))
	private void mib$crosshair(MibGraphics g, RenderPipeline pipeline, MibId id, int x, int y, int w, int h, Operation<Void> original) {
		if (!isCrosshair(id) || !MibClient.get().drawCrosshair(g)) original.call(g, pipeline, id, x, y, w, h);
	}
	//#elif MC >= 1.21.2
	@WrapOperation(method = "renderCrosshair", at = @At(value = "INVOKE",
			target = "Lnet/minecraft/client/gui/MibGraphics;blitSprite(Ljava/util/function/Function;Lnet/minecraft/resources/MibId;IIII)V"))
	private void mib$crosshair(MibGraphics g, Function<MibId, RenderType> type, MibId id, int x, int y, int w, int h, Operation<Void> original) {
		if (!isCrosshair(id) || !MibClient.get().drawCrosshair(g)) original.call(g, type, id, x, y, w, h);
	}
	//#else
	@WrapOperation(method = "renderCrosshair", at = @At(value = "INVOKE",
			target = "Lnet/minecraft/client/gui/MibGraphics;blitSprite(Lnet/minecraft/resources/MibId;IIII)V"))
	private void mib$crosshair(MibGraphics g, MibId id, int x, int y, int w, int h, Operation<Void> original) {
		if (!isCrosshair(id) || !MibClient.get().drawCrosshair(g)) original.call(g, id, x, y, w, h);
	}
	//#endif

	private static boolean isCrosshair(MibId id) {
		return "hud/crosshair".equals(id.getPath());
	}
}
