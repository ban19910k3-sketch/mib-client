package pl.mibclient.mod.fabric.mixin;

import net.minecraft.client.model.HumanoidModel;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import pl.mibclient.mod.fabric.Looks;
//#if MC >= 1.21.2
import net.minecraft.client.renderer.entity.state.HumanoidRenderState;
import pl.mibclient.mod.fabric.MibSelfState;
//#else
import net.minecraft.client.Minecraft;
import net.minecraft.world.entity.LivingEntity;
//#endif

/** Emotes: ręce własnej postaci w trakcie emotki (po ułożeniu modelu przez grę). */
@Mixin(HumanoidModel.class)
public abstract class HumanoidModelMixin {
	//#if MC >= 1.21.2
	@Inject(method = "setupAnim(Lnet/minecraft/client/renderer/entity/state/HumanoidRenderState;)V", at = @At("TAIL"))
	private void mib$emote(HumanoidRenderState state, CallbackInfo ci) {
		if (((MibSelfState) state).mib$self()) apply();
	}
	//#else
	@Inject(method = "setupAnim(Lnet/minecraft/world/entity/LivingEntity;FFFFF)V", at = @At("TAIL"))
	private void mib$emote(LivingEntity entity, float a, float b, float c, float d, float e, CallbackInfo ci) {
		if (entity == Minecraft.getInstance().player) apply();
	}
	//#endif

	private void apply() {
		float[] a = Looks.emote();
		if (a == null) return;
		HumanoidModel<?> m = (HumanoidModel<?>) (Object) this;
		m.rightArm.xRot = a[0];
		m.rightArm.yRot = 0;
		m.rightArm.zRot = a[1];
		m.leftArm.xRot = a[2];
		m.leftArm.yRot = 0;
		m.leftArm.zRot = a[3];
	}
}
