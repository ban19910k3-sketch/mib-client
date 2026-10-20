package pl.mibclient.mod.fabric.mixin;

import net.minecraft.client.model.HumanoidModel;
import net.minecraft.client.model.geom.ModelPart;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import pl.mibclient.mod.core.modules.Emotes;
import pl.mibclient.mod.fabric.Looks;
//#if MC >= 1.21.2
import net.minecraft.client.renderer.entity.state.HumanoidRenderState;
import pl.mibclient.mod.fabric.MibSelfState;
//#else
import net.minecraft.client.Minecraft;
import net.minecraft.world.entity.LivingEntity;
//#endif

/** Emotes: głowa, tułów, ręce i nogi własnej postaci w trakcie emotki (po ułożeniu modelu przez grę). */
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
		float[] p = Looks.emote();
		if (p == null) return;
		HumanoidModel<?> m = (HumanoidModel<?>) (Object) this;
		pose(m.head, p, Emotes.HEAD);
		pose(m.body, p, Emotes.BODY);
		pose(m.rightArm, p, Emotes.RIGHT_ARM);
		pose(m.leftArm, p, Emotes.LEFT_ARM);
		pose(m.rightLeg, p, Emotes.RIGHT_LEG);
		pose(m.leftLeg, p, Emotes.LEFT_LEG);
		//#if MC < 1.21.2
		// przed 1.21.2 warstwa głowy nie jest częścią głowy: gra kopiuje ją wcześniej, więc tu jeszcze raz
		if (!Float.isNaN(p[Emotes.HEAD]) || !Float.isNaN(p[Emotes.HEAD + 1]) || !Float.isNaN(p[Emotes.HEAD + 2])) m.hat.copyFrom(m.head);
		//#endif
	}

	/** Kąty części ciała z pozy (NaN = zostaje ruch z gry). */
	private static void pose(ModelPart part, float[] p, int i) {
		if (!Float.isNaN(p[i])) part.xRot = p[i];
		if (!Float.isNaN(p[i + 1])) part.yRot = p[i + 1];
		if (!Float.isNaN(p[i + 2])) part.zRot = p[i + 2];
	}
}
