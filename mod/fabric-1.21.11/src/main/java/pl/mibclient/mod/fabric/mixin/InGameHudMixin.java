package pl.mibclient.mod.fabric.mixin;

import com.llamalad7.mixinextras.injector.wrapoperation.Operation;
import com.llamalad7.mixinextras.injector.wrapoperation.WrapOperation;
import com.mojang.blaze3d.pipeline.RenderPipeline;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.hud.InGameHud;
import net.minecraft.util.Identifier;
import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import pl.mibclient.mod.fabric.MibClient;

/**
 * Custom crosshair: podmienia tylko obrazek celownika. Reszta zostaje z gry: wskaźnik ładowania ataku,
 * ukrycie w trzeciej osobie i trybie widza, osie F3.
 */
@Mixin(InGameHud.class)
public abstract class InGameHudMixin {
	@Shadow
	@Final
	private static Identifier CROSSHAIR_TEXTURE;

	@WrapOperation(method = "renderCrosshair", at = @At(value = "INVOKE",
			target = "Lnet/minecraft/client/gui/DrawContext;drawGuiTexture(Lcom/mojang/blaze3d/pipeline/RenderPipeline;Lnet/minecraft/util/Identifier;IIII)V"))
	private void mib$crosshair(DrawContext ctx, RenderPipeline pipeline, Identifier id, int x, int y, int w, int h, Operation<Void> original) {
		if (CROSSHAIR_TEXTURE.equals(id) && MibClient.get().drawCrosshair(ctx)) return;
		original.call(ctx, pipeline, id, x, y, w, h);
	}
}
