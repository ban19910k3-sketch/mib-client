package pl.mibclient.mod.fabric.mixin;

import com.mojang.blaze3d.vertex.PoseStack;
import net.minecraft.client.renderer.entity.layers.CapeLayer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Unique;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import pl.mibclient.mod.fabric.MibClient;
//#if MC >= 1.21.9
import net.minecraft.client.renderer.SubmitNodeCollector;
import net.minecraft.client.renderer.entity.state.AvatarRenderState;
import pl.mibclient.mod.fabric.MibSelfState;
//#elif MC >= 1.21.2
import net.minecraft.client.renderer.MultiBufferSource;
import net.minecraft.client.renderer.entity.state.PlayerRenderState;
import pl.mibclient.mod.fabric.MibSelfState;
//#else
import net.minecraft.client.player.AbstractClientPlayer;
import net.minecraft.client.renderer.MultiBufferSource;
//#endif

/**
 * Peleryna przy plecaku MiB (od 0.34.0) wisi 4 piksele dalej od pleców, za plecakiem (tak samo w launcherze: dress). Poza na czas
 * rysowania peleryny — odłożona przed, przywrócona po.
 */
@Mixin(CapeLayer.class)
public abstract class CapeLayerMixin {
	@Unique
	private boolean mib$pushed;

	@Unique
	private void mib$push(PoseStack pose, boolean backpack) {
		mib$pushed = backpack;
		if (!backpack) return;
		pose.pushPose();
		pose.translate(0f, 0f, 0.25f);
		MibClient.hooks.add("cape_pushed");
	}

	@Unique
	private void mib$pop(PoseStack pose) {
		if (mib$pushed) pose.popPose();
		mib$pushed = false;
	}

	//#if MC >= 1.21.9
	@Inject(method = "submit(Lcom/mojang/blaze3d/vertex/PoseStack;Lnet/minecraft/client/renderer/SubmitNodeCollector;ILnet/minecraft/client/renderer/entity/state/AvatarRenderState;FF)V",
			at = @At("HEAD"), require = 0)
	private void mib$before(PoseStack pose, SubmitNodeCollector out, int light, AvatarRenderState s, float a, float b, CallbackInfo ci) {
		mib$push(pose, ((MibSelfState) s).mib$back() != null);
	}

	@Inject(method = "submit(Lcom/mojang/blaze3d/vertex/PoseStack;Lnet/minecraft/client/renderer/SubmitNodeCollector;ILnet/minecraft/client/renderer/entity/state/AvatarRenderState;FF)V",
			at = @At("RETURN"), require = 0)
	private void mib$after(PoseStack pose, SubmitNodeCollector out, int light, AvatarRenderState s, float a, float b, CallbackInfo ci) {
		mib$pop(pose);
	}
	//#elif MC >= 1.21.2
	@Inject(method = "render(Lcom/mojang/blaze3d/vertex/PoseStack;Lnet/minecraft/client/renderer/MultiBufferSource;ILnet/minecraft/client/renderer/entity/state/PlayerRenderState;FF)V",
			at = @At("HEAD"), require = 0)
	private void mib$before(PoseStack pose, MultiBufferSource out, int light, PlayerRenderState s, float a, float b, CallbackInfo ci) {
		mib$push(pose, ((MibSelfState) s).mib$back() != null);
	}

	@Inject(method = "render(Lcom/mojang/blaze3d/vertex/PoseStack;Lnet/minecraft/client/renderer/MultiBufferSource;ILnet/minecraft/client/renderer/entity/state/PlayerRenderState;FF)V",
			at = @At("RETURN"), require = 0)
	private void mib$after(PoseStack pose, MultiBufferSource out, int light, PlayerRenderState s, float a, float b, CallbackInfo ci) {
		mib$pop(pose);
	}
	//#else
	@Inject(method = "render(Lcom/mojang/blaze3d/vertex/PoseStack;Lnet/minecraft/client/renderer/MultiBufferSource;ILnet/minecraft/client/player/AbstractClientPlayer;FFFFFF)V",
			at = @At("HEAD"), require = 0)
	private void mib$before(PoseStack pose, MultiBufferSource out, int light, AbstractClientPlayer p, float a, float b, float c, float d, float e, float f, CallbackInfo ci) {
		MibClient m = MibClient.get();
		mib$push(pose, m != null && m.cosmeticFor(p, "back") != null);
	}

	@Inject(method = "render(Lcom/mojang/blaze3d/vertex/PoseStack;Lnet/minecraft/client/renderer/MultiBufferSource;ILnet/minecraft/client/player/AbstractClientPlayer;FFFFFF)V",
			at = @At("RETURN"), require = 0)
	private void mib$after(PoseStack pose, MultiBufferSource out, int light, AbstractClientPlayer p, float a, float b, float c, float d, float e, float f, CallbackInfo ci) {
		mib$pop(pose);
	}
	//#endif
}
