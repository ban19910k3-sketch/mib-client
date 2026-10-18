package pl.mibclient.mod.fabric.mixin;

import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import pl.mibclient.mod.fabric.Looks;
//#if MC >= 1.21.11
import net.minecraft.client.renderer.debug.EntityHitboxDebugRenderer;
import org.spongepowered.asm.mixin.injection.ModifyArg;
import net.minecraft.world.entity.Entity;
//#elif MC >= 1.21.9
import net.minecraft.client.renderer.feature.HitboxFeatureRenderer;
import net.minecraft.client.renderer.entity.state.HitboxRenderState;
import org.spongepowered.asm.mixin.injection.ModifyVariable;
//#elif MC >= 1.21.5
import net.minecraft.client.renderer.entity.EntityRenderDispatcher;
import net.minecraft.client.renderer.entity.state.EntityRenderState;
import net.minecraft.client.renderer.entity.state.HitboxRenderState;
import org.spongepowered.asm.mixin.injection.ModifyVariable;
//#else
import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.blaze3d.vertex.VertexConsumer;
import net.minecraft.client.renderer.entity.EntityRenderDispatcher;
import net.minecraft.world.entity.Entity;
import org.spongepowered.asm.mixin.injection.ModifyVariable;
//#endif

/** Hitbox: własny kolor ramek hitboxów (F3+B) i tylko gracze. */
//#if MC >= 1.21.11
@Mixin(EntityHitboxDebugRenderer.class)
//#elif MC >= 1.21.9
@Mixin(HitboxFeatureRenderer.class)
//#else
@Mixin(EntityRenderDispatcher.class)
//#endif
public abstract class HitboxMixin {
	//#if MC >= 1.21.11
	@Inject(method = "showHitboxes", at = @At("HEAD"), cancellable = true)
	private static void mib$players(Entity entity, float partialTick, boolean server, CallbackInfo ci) {
		if (Looks.hideHitbox(entity)) ci.cancel();
	}

	@ModifyArg(method = "showHitboxes", at = @At(value = "INVOKE", target = "Lnet/minecraft/gizmos/GizmoStyle;stroke(I)Lnet/minecraft/gizmos/GizmoStyle;"),
			index = 0, require = 0)
	private int mib$color(int argb) {
		return Looks.hitboxColor(argb);
	}
	//#elif MC >= 1.21.9
	@ModifyVariable(method = "renderHitbox", at = @At("HEAD"), argsOnly = true, require = 0)
	private static HitboxRenderState mib$color(HitboxRenderState s) {
		return recolor(s);
	}
	//#elif MC >= 1.21.5
	@Inject(method = "renderHitboxes", at = @At("HEAD"), cancellable = true)
	private void mib$players(com.mojang.blaze3d.vertex.PoseStack pose, EntityRenderState state,
			net.minecraft.client.renderer.entity.state.HitboxesRenderState boxes, net.minecraft.client.renderer.MultiBufferSource buffers, CallbackInfo ci) {
		if (Looks.hideHitboxState(state)) ci.cancel();
	}

	@ModifyVariable(method = "renderHitbox", at = @At("HEAD"), argsOnly = true)
	private static HitboxRenderState mib$color(HitboxRenderState s) {
		return recolor(s);
	}
	//#else
	@Inject(method = "renderHitbox", at = @At("HEAD"), cancellable = true)
	private static void mib$players(PoseStack pose, VertexConsumer out, Entity entity, float partialTick, float r, float g, float b, CallbackInfo ci) {
		if (Looks.hideHitbox(entity)) ci.cancel();
	}

	@ModifyVariable(method = "renderHitbox", at = @At("HEAD"), argsOnly = true, ordinal = 1)
	private static float mib$red(float r) {
		return Looks.hitboxChannel(r, 16);
	}

	@ModifyVariable(method = "renderHitbox", at = @At("HEAD"), argsOnly = true, ordinal = 2)
	private static float mib$green(float g) {
		return Looks.hitboxChannel(g, 8);
	}

	@ModifyVariable(method = "renderHitbox", at = @At("HEAD"), argsOnly = true, ordinal = 3)
	private static float mib$blue(float b) {
		return Looks.hitboxChannel(b, 0);
	}
	//#endif

	//#if MC >= 1.21.5 && MC < 1.21.11
	/** Biała ramka gry dostaje kolor z ustawień (kolorowe ramki części i serwera zostają). */
	private static HitboxRenderState recolor(HitboxRenderState s) {
		if (s.red() < 0.99f || s.green() < 0.99f || s.blue() < 0.99f) return s;
		int c = Looks.hitboxColor(0xFFFFFFFF);
		if (c == 0xFFFFFFFF) return s;
		return new HitboxRenderState(s.x0(), s.y0(), s.z0(), s.x1(), s.y1(), s.z1(), s.offsetX(), s.offsetY(), s.offsetZ(), ((c >> 16) & 0xFF) / 255f,
				((c >> 8) & 0xFF) / 255f, (c & 0xFF) / 255f);
	}
	//#endif
}
