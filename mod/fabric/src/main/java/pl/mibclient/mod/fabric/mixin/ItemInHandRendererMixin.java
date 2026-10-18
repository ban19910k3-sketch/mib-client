package pl.mibclient.mod.fabric.mixin;

import com.llamalad7.mixinextras.injector.wrapoperation.Operation;
import com.llamalad7.mixinextras.injector.wrapoperation.WrapOperation;
import com.llamalad7.mixinextras.sugar.Local;
import com.mojang.blaze3d.vertex.PoseStack;
import net.minecraft.world.InteractionHand;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import net.minecraft.world.entity.HumanoidArm;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import pl.mibclient.mod.fabric.Looks;
import pl.mibclient.mod.fabric.MibClient;
//#if MC >= 26.3
import net.minecraft.client.renderer.FirstPersonHandsAndItemsRenderer;
//#else
import net.minecraft.client.renderer.ItemInHandRenderer;
//#endif

/**
 * Viewmodel: położenie i rozmiar ręki i przedmiotu w pierwszej osobie (wewnątrz własnego push/pop gry).
 * Animations: blok mieczem pod prawym przyciskiem jak w 1.8 (po ustawieniu ręki przez grę).
 */
//#if MC >= 26.3
@Mixin(FirstPersonHandsAndItemsRenderer.class)
//#else
@Mixin(ItemInHandRenderer.class)
//#endif
public abstract class ItemInHandRendererMixin {
	//#if MC >= 26.2
	@WrapOperation(method = "submitArmWithItem", at = @At(value = "INVOKE", target = "Lcom/mojang/blaze3d/vertex/PoseStack;pushPose()V", ordinal = 0))
	//#else
	@WrapOperation(method = "renderArmWithItem", at = @At(value = "INVOKE", target = "Lcom/mojang/blaze3d/vertex/PoseStack;pushPose()V", ordinal = 0))
	//#endif
	private void mib$viewmodel(PoseStack pose, Operation<Void> original, @Local(argsOnly = true) InteractionHand hand) {
		original.call(pose);
		MibClient m = MibClient.get();
		if (m != null) m.viewmodel(pose, hand == InteractionHand.MAIN_HAND);
	}

	@Inject(method = "applyItemArmTransform", at = @At("TAIL"))
	private void mib$swordBlock(PoseStack pose, HumanoidArm arm, float equip, CallbackInfo ci) {
		Looks.swordBlock(pose, arm);
	}
}
