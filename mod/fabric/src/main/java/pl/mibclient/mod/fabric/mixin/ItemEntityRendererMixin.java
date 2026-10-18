package pl.mibclient.mod.fabric.mixin;

import com.llamalad7.mixinextras.injector.ModifyExpressionValue;
import com.llamalad7.mixinextras.injector.wrapoperation.Operation;
import com.llamalad7.mixinextras.injector.wrapoperation.WrapOperation;
import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.math.Axis;
import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.blockentity.BeaconRenderer;
import net.minecraft.client.renderer.entity.ItemEntityRenderer;
import net.minecraft.world.entity.item.ItemEntity;
import org.joml.Quaternionf;
import org.joml.Quaternionfc;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import pl.mibclient.mod.fabric.Looks;
//#if MC >= 1.21.9
import net.minecraft.client.renderer.SubmitNodeCollector;
import net.minecraft.client.renderer.entity.state.ItemEntityRenderState;
import pl.mibclient.mod.fabric.MibItemState;
//#if MC >= 26.1
import net.minecraft.client.renderer.state.level.CameraRenderState;
//#else
import net.minecraft.client.renderer.state.CameraRenderState;
//#endif
//#elif MC >= 1.21.2
import net.minecraft.client.renderer.MultiBufferSource;
import net.minecraft.client.renderer.entity.state.ItemEntityRenderState;
import pl.mibclient.mod.fabric.MibItemState;
//#else
import net.minecraft.client.renderer.MultiBufferSource;
//#endif

/**
 * Leżące przedmioty: Item physic (bez podskakiwania i wirowania, płasko na ziemi), UHC overlay (powiększenie złota,
 * jabłek i głów) i Loot beams (promień w kolorze rzadkości). Wszystkie wersje rysują przedmiot tak samo: pushPose,
 * translate z sinusem (podskok), obrót wokół Y, przedmioty, popPose.
 */
@Mixin(ItemEntityRenderer.class)
public abstract class ItemEntityRendererMixin {
	//#if MC >= 26.1
	private static final String SUBMIT = "submit(Lnet/minecraft/client/renderer/entity/state/ItemEntityRenderState;Lcom/mojang/blaze3d/vertex/PoseStack;Lnet/minecraft/client/renderer/SubmitNodeCollector;Lnet/minecraft/client/renderer/state/level/CameraRenderState;)V";
	//#elif MC >= 1.21.9
	private static final String SUBMIT = "submit(Lnet/minecraft/client/renderer/entity/state/ItemEntityRenderState;Lcom/mojang/blaze3d/vertex/PoseStack;Lnet/minecraft/client/renderer/SubmitNodeCollector;Lnet/minecraft/client/renderer/state/CameraRenderState;)V";
	//#endif
	//#if MC >= 1.21.2
	@Inject(method = "extractRenderState(Lnet/minecraft/world/entity/item/ItemEntity;Lnet/minecraft/client/renderer/entity/state/ItemEntityRenderState;F)V",
			at = @At("TAIL"))
	private void mib$extract(ItemEntity entity, ItemEntityRenderState state, float partialTick, CallbackInfo ci) {
		((MibItemState) state).mib$item(Looks.itemInfo(entity));
	}
	//#endif

	//#if MC >= 1.21.9
	@Inject(method = SUBMIT, at = @At("HEAD"))
	private void mib$start(ItemEntityRenderState state, PoseStack pose, SubmitNodeCollector out, CameraRenderState camera, CallbackInfo ci) {
		float[] info = ((MibItemState) state).mib$item();
		Looks.item = info == null ? Looks.NO_ITEM : info;
		int beam = Looks.beamColor();
		if (beam == 0) return;
		Minecraft c = Minecraft.getInstance();
		float t = c.level == null ? 0 : Math.floorMod(c.level.getGameTime(), 40) + c.getDeltaTracker().getGameTimeDeltaPartialTick(false);
		pose.pushPose();
		pose.translate(-0.5f, 0f, -0.5f);
		BeaconRenderer.submitBeaconBeam(pose, out, BeaconRenderer.BEAM_LOCATION, 1f, t, 0, Looks.beamHeight(), beam, 0.04f, 0.07f);
		pose.popPose();
	}

	@Inject(method = SUBMIT, at = @At("RETURN"))
	private void mib$end(CallbackInfo ci) {
		Looks.item = Looks.NO_ITEM;
	}
	//#elif MC >= 1.21.2
	@Inject(method = "render(Lnet/minecraft/client/renderer/entity/state/ItemEntityRenderState;Lcom/mojang/blaze3d/vertex/PoseStack;Lnet/minecraft/client/renderer/MultiBufferSource;I)V",
			at = @At("HEAD"))
	private void mib$start(ItemEntityRenderState state, PoseStack pose, MultiBufferSource buffers, int light, CallbackInfo ci) {
		float[] info = ((MibItemState) state).mib$item();
		Looks.item = info == null ? Looks.NO_ITEM : info;
		beam(pose, buffers, Minecraft.getInstance().getDeltaTracker().getGameTimeDeltaPartialTick(false));
	}

	@Inject(method = "render(Lnet/minecraft/client/renderer/entity/state/ItemEntityRenderState;Lcom/mojang/blaze3d/vertex/PoseStack;Lnet/minecraft/client/renderer/MultiBufferSource;I)V",
			at = @At("RETURN"))
	private void mib$end(CallbackInfo ci) {
		Looks.item = Looks.NO_ITEM;
	}
	//#else
	@Inject(method = "render(Lnet/minecraft/world/entity/item/ItemEntity;FFLcom/mojang/blaze3d/vertex/PoseStack;Lnet/minecraft/client/renderer/MultiBufferSource;I)V",
			at = @At("HEAD"))
	private void mib$start(ItemEntity entity, float yaw, float partialTick, PoseStack pose, MultiBufferSource buffers, int light, CallbackInfo ci) {
		Looks.item = Looks.itemInfo(entity);
		beam(pose, buffers, partialTick);
	}

	@Inject(method = "render(Lnet/minecraft/world/entity/item/ItemEntity;FFLcom/mojang/blaze3d/vertex/PoseStack;Lnet/minecraft/client/renderer/MultiBufferSource;I)V",
			at = @At("RETURN"))
	private void mib$end(CallbackInfo ci) {
		Looks.item = Looks.NO_ITEM;
	}
	//#endif

	//#if MC < 1.21.9
	private static void beam(PoseStack pose, MultiBufferSource buffers, float partialTick) {
		int beam = Looks.beamColor();
		if (beam == 0) return;
		Minecraft c = Minecraft.getInstance();
		long time = c.level == null ? 0 : c.level.getGameTime();
		pose.pushPose();
		pose.translate(-0.5f, 0f, -0.5f);
		BeaconRenderer.renderBeaconBeam(pose, buffers, BeaconRenderer.BEAM_LOCATION, partialTick, 1f, time, 0, Looks.beamHeight(), beam, 0.04f, 0.07f);
		pose.popPose();
	}
	//#endif

	// UHC overlay: powiększenie zaraz po pushPose
	//#if MC >= 1.21.9
	@WrapOperation(method = "submit", at = @At(value = "INVOKE", target = "Lcom/mojang/blaze3d/vertex/PoseStack;pushPose()V", ordinal = 0))
	//#elif MC >= 1.21.2
	@WrapOperation(method = "render", at = @At(value = "INVOKE", target = "Lcom/mojang/blaze3d/vertex/PoseStack;pushPose()V", ordinal = 0))
	//#else
	@WrapOperation(method = "render", at = @At(value = "INVOKE", target = "Lcom/mojang/blaze3d/vertex/PoseStack;pushPose()V", ordinal = 0))
	//#endif
	private void mib$scale(PoseStack pose, Operation<Void> original) {
		original.call(pose);
		Looks.itemScale(pose);
	}

	// Item physic: bez podskakiwania (sinus z czasu = -1, czyli najniżej)
	//#if MC >= 1.21.11
	@ModifyExpressionValue(method = "submit", at = @At(value = "INVOKE", target = "Lnet/minecraft/util/Mth;sin(D)F"))
	//#elif MC >= 1.21.9
	@ModifyExpressionValue(method = "submit", at = @At(value = "INVOKE", target = "Lnet/minecraft/util/Mth;sin(F)F"))
	//#elif MC >= 1.21.2
	@ModifyExpressionValue(method = "render", at = @At(value = "INVOKE", target = "Lnet/minecraft/util/Mth;sin(F)F"))
	//#else
	@ModifyExpressionValue(method = "render", at = @At(value = "INVOKE", target = "Lnet/minecraft/util/Mth;sin(F)F"))
	//#endif
	private float mib$bob(float sin) {
		return Looks.physic() ? -1f : sin;
	}

	// Item physic: płaskie przedmioty leżą na ziemi (zamiast unosić się nad nią)
	//#if MC >= 1.21.9
	@WrapOperation(method = "submit", at = @At(value = "INVOKE", target = "Lcom/mojang/blaze3d/vertex/PoseStack;translate(FFF)V", ordinal = 0))
	//#elif MC >= 1.21.2
	@WrapOperation(method = "render", at = @At(value = "INVOKE", target = "Lcom/mojang/blaze3d/vertex/PoseStack;translate(FFF)V", ordinal = 0))
	//#else
	@WrapOperation(method = "render", at = @At(value = "INVOKE", target = "Lcom/mojang/blaze3d/vertex/PoseStack;translate(FFF)V", ordinal = 0))
	//#endif
	private void mib$lift(PoseStack pose, float x, float y, float z, Operation<Void> original) {
		original.call(pose, x, Looks.physic() && Looks.flat() ? 0.03f : y, z);
	}

	// Item physic: bez wirowania; płaskie przedmioty obrócone tak, by leżały
	//#if MC >= 26.3
	@WrapOperation(method = "submit", at = @At(value = "INVOKE", target = "Lcom/mojang/blaze3d/vertex/PoseStack;rotate(Lcom/mojang/math/Axis;F)V", ordinal = 0))
	private void mib$spin(PoseStack pose, Axis axis, float angle, Operation<Void> original) {
		if (!Looks.physic()) original.call(pose, axis, angle);
		else if (Looks.flat()) original.call(pose, Axis.XP, (float) (Math.PI / 2));
	}
	//#elif MC >= 1.21.9
	@WrapOperation(method = "submit", at = @At(value = "INVOKE", target = "Lcom/mojang/blaze3d/vertex/PoseStack;mulPose(Lorg/joml/Quaternionfc;)V", ordinal = 0))
	private void mib$spin(PoseStack pose, Quaternionfc rotation, Operation<Void> original) {
		if (!Looks.physic()) original.call(pose, rotation);
		else if (Looks.flat()) original.call(pose, Axis.XP.rotationDegrees(90f));
	}
	//#elif MC >= 1.21.5
	@WrapOperation(method = "render", at = @At(value = "INVOKE", target = "Lcom/mojang/blaze3d/vertex/PoseStack;mulPose(Lorg/joml/Quaternionfc;)V", ordinal = 0))
	private void mib$spin(PoseStack pose, Quaternionfc rotation, Operation<Void> original) {
		if (!Looks.physic()) original.call(pose, rotation);
		else if (Looks.flat()) original.call(pose, Axis.XP.rotationDegrees(90f));
	}
	//#else
	@WrapOperation(method = "render", at = @At(value = "INVOKE", target = "Lcom/mojang/blaze3d/vertex/PoseStack;mulPose(Lorg/joml/Quaternionf;)V", ordinal = 0))
	private void mib$spin(PoseStack pose, Quaternionf rotation, Operation<Void> original) {
		if (!Looks.physic()) original.call(pose, rotation);
		else if (Looks.flat()) original.call(pose, Axis.XP.rotationDegrees(90f));
	}
	//#endif
}
