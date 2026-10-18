package pl.mibclient.mod.fabric.mixin;

import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import pl.mibclient.mod.fabric.Looks;
//#if MC >= 1.21.2
import net.minecraft.client.renderer.entity.layers.WingsLayer;
import net.minecraft.client.renderer.entity.state.HumanoidRenderState;
import pl.mibclient.mod.fabric.MibSelfState;
//#else
import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.entity.layers.ElytraLayer;
import net.minecraft.world.entity.LivingEntity;
//#endif

/** Elytras: ukrycie elytry własnej postaci. */
//#if MC >= 1.21.2
@Mixin(WingsLayer.class)
//#else
@Mixin(ElytraLayer.class)
//#endif
public abstract class WingsLayerMixin {
	//#if MC >= 1.21.9
	@Inject(method = "submit(Lcom/mojang/blaze3d/vertex/PoseStack;Lnet/minecraft/client/renderer/SubmitNodeCollector;ILnet/minecraft/client/renderer/entity/state/HumanoidRenderState;FF)V",
			at = @At("HEAD"), cancellable = true)
	private void mib$hide(com.mojang.blaze3d.vertex.PoseStack pose, net.minecraft.client.renderer.SubmitNodeCollector out, int light, HumanoidRenderState state,
			float a, float b, CallbackInfo ci) {
		if (Looks.hideElytra(((MibSelfState) state).mib$self())) ci.cancel();
	}
	//#elif MC >= 1.21.2
	@Inject(method = "render(Lcom/mojang/blaze3d/vertex/PoseStack;Lnet/minecraft/client/renderer/MultiBufferSource;ILnet/minecraft/client/renderer/entity/state/HumanoidRenderState;FF)V",
			at = @At("HEAD"), cancellable = true)
	private void mib$hide(com.mojang.blaze3d.vertex.PoseStack pose, net.minecraft.client.renderer.MultiBufferSource out, int light, HumanoidRenderState state,
			float a, float b, CallbackInfo ci) {
		if (Looks.hideElytra(((MibSelfState) state).mib$self())) ci.cancel();
	}
	//#else
	@Inject(method = "render(Lcom/mojang/blaze3d/vertex/PoseStack;Lnet/minecraft/client/renderer/MultiBufferSource;ILnet/minecraft/world/entity/LivingEntity;FFFFFF)V",
			at = @At("HEAD"), cancellable = true)
	private void mib$hide(com.mojang.blaze3d.vertex.PoseStack pose, net.minecraft.client.renderer.MultiBufferSource out, int light, LivingEntity entity,
			float a, float b, float c, float d, float e, float f, CallbackInfo ci) {
		if (Looks.hideElytra(entity == Minecraft.getInstance().player)) ci.cancel();
	}
	//#endif
}
