package pl.mibclient.mod.fabric.mixin;

import com.llamalad7.mixinextras.injector.ModifyExpressionValue;
import com.llamalad7.mixinextras.injector.wrapoperation.Operation;
import com.llamalad7.mixinextras.injector.wrapoperation.WrapOperation;
import net.minecraft.client.gui.MibGraphics;
import net.minecraft.client.DeltaTracker;
import net.minecraft.client.gui.MibHud;
import net.minecraft.network.chat.numbers.BlankFormat;
import net.minecraft.network.chat.numbers.NumberFormat;
import net.minecraft.resources.MibId;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.scores.Objective;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import pl.mibclient.mod.fabric.VanillaHud;
import pl.mibclient.mod.fabric.MibClient;
//#if MC >= 26.3
import com.mojang.renderpearl.api.pipeline.RenderPipeline;
//#elif MC >= 1.21.6
import com.mojang.blaze3d.pipeline.RenderPipeline;
//#elif MC >= 1.21.2
import java.util.function.Function;
import net.minecraft.client.renderer.RenderType;
//#endif

/**
 * HUD gry: Custom crosshair (podmienia tylko obrazek celownika — reszta zostaje z gry: wskaźnik ładowania ataku,
 * ukrycie w trzeciej osobie i trybie widza, osie F3), Saturation na ikonach jedzenia, Scoreboard i Title tweaker.
 */
@Mixin(MibHud.class)
public abstract class GuiMixin {
	//#if MC >= 26.3
	@WrapOperation(method = "extractCrosshair", at = @At(value = "INVOKE",
			target = "Lnet/minecraft/client/gui/MibGraphics;blitSprite(Lcom/mojang/renderpearl/api/pipeline/RenderPipeline;Lnet/minecraft/resources/MibId;IIII)V"))
	private void mib$crosshair(MibGraphics g, RenderPipeline pipeline, MibId id, int x, int y, int w, int h, Operation<Void> original) {
		if (!isCrosshair(id) || !MibClient.get().drawCrosshair(g)) original.call(g, pipeline, id, x, y, w, h);
	}
	//#elif MC >= 26.1
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

	// Saturation: nakładka na ikony jedzenia (top, right jak w grze)
	//#if MC >= 26.1
	@Inject(method = "extractFood", at = @At("RETURN"))
	//#else
	@Inject(method = "renderFood", at = @At("RETURN"))
	//#endif
	private void mib$saturation(MibGraphics g, Player player, int top, int right, CallbackInfo ci) {
		VanillaHud.saturation(g, player, top, right);
	}

	// Scoreboard: ukrycie, skala i przesunięcie tabeli wyników
	@Inject(method = "displayScoreboardSidebar", at = @At("HEAD"), cancellable = true)
	private void mib$scoreboard(MibGraphics g, Objective objective, CallbackInfo ci) {
		if (!VanillaHud.scoreboardStart(g)) ci.cancel();
	}

	@Inject(method = "displayScoreboardSidebar", at = @At("RETURN"))
	private void mib$scoreboardEnd(MibGraphics g, Objective objective, CallbackInfo ci) {
		VanillaHud.scoreboardEnd(g);
	}

	// Scoreboard: puste liczby zamiast czerwonych (format liczb z gry)
	@ModifyExpressionValue(method = "displayScoreboardSidebar", at = @At(value = "INVOKE",
			target = "Lnet/minecraft/world/scores/Objective;numberFormatOrDefault(Lnet/minecraft/network/chat/numbers/NumberFormat;)Lnet/minecraft/network/chat/numbers/NumberFormat;"))
	private NumberFormat mib$scoreNumbers(NumberFormat original) {
		return VanillaHud.hideScoreNumbers() ? BlankFormat.INSTANCE : original;
	}

	// Title tweaker: ukrycie, skala i położenie tytułów
	//#if MC >= 26.1
	@Inject(method = "extractTitle", at = @At("HEAD"), cancellable = true)
	//#else
	@Inject(method = "renderTitle", at = @At("HEAD"), cancellable = true)
	//#endif
	private void mib$title(MibGraphics g, DeltaTracker delta, CallbackInfo ci) {
		if (!VanillaHud.titleStart(g)) ci.cancel();
	}

	//#if MC >= 26.1
	@Inject(method = "extractTitle", at = @At("RETURN"))
	//#else
	@Inject(method = "renderTitle", at = @At("RETURN"))
	//#endif
	private void mib$titleEnd(MibGraphics g, DeltaTracker delta, CallbackInfo ci) {
		VanillaHud.titleEnd(g);
	}
}
