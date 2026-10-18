package pl.mibclient.mod.fabric.mixin;

import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import pl.mibclient.mod.fabric.Looks;
import net.minecraft.client.Camera;
//#if MC >= 26.1
import net.minecraft.client.renderer.fog.FogData;
import net.minecraft.client.renderer.fog.FogRenderer;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;
//#elif MC >= 1.21.6
import com.llamalad7.mixinextras.sugar.Local;
import net.minecraft.client.renderer.fog.FogRenderer;
import org.spongepowered.asm.mixin.injection.ModifyArgs;
import org.spongepowered.asm.mixin.injection.invoke.arg.Args;
//#elif MC >= 1.21.2
import net.minecraft.client.renderer.FogParameters;
import net.minecraft.client.renderer.FogRenderer;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;
//#else
import com.mojang.blaze3d.systems.RenderSystem;
import net.minecraft.client.renderer.FogRenderer;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
//#endif

/** Custom fog: bez mgły na odległość i (osobno) pod wodą i w lawie. */
@Mixin(FogRenderer.class)
public abstract class FogRendererMixin {
	private static final float FAR = 1.0e6f;

	//#if MC >= 26.1
	@Inject(method = "setupFog", at = @At("RETURN"))
	private void mib$fog(Camera camera, int renderDistance, net.minecraft.client.DeltaTracker delta, float darken,
			net.minecraft.client.multiplayer.ClientLevel level, CallbackInfoReturnable<FogData> cir) {
		FogData f = cir.getReturnValue();
		if (f == null || !Looks.noFog(camera.getFluidInCamera())) return;
		f.environmentalStart = f.renderDistanceStart = FAR;
		f.environmentalEnd = f.renderDistanceEnd = FAR + 1;
	}
	//#elif MC >= 1.21.6
	@ModifyArgs(method = "setupFog", at = @At(value = "INVOKE",
			target = "Lnet/minecraft/client/renderer/fog/FogRenderer;updateBuffer(Ljava/nio/ByteBuffer;ILorg/joml/Vector4f;FFFFFF)V"))
	private void mib$fog(Args args, @Local(argsOnly = true) Camera camera) {
		if (!Looks.noFog(camera.getFluidInCamera())) return;
		args.set(3, FAR);
		args.set(4, FAR + 1);
		args.set(5, FAR);
		args.set(6, FAR + 1);
	}
	//#elif MC >= 1.21.2
	@Inject(method = "setupFog", at = @At("RETURN"), cancellable = true)
	private static void mib$fog(Camera camera, FogRenderer.FogMode mode, org.joml.Vector4f color, float renderDistance, boolean thick, float partialTick,
			CallbackInfoReturnable<FogParameters> cir) {
		if (Looks.noFog(camera.getFluidInCamera())) cir.setReturnValue(FogParameters.NO_FOG);
	}
	//#else
	@Inject(method = "setupFog", at = @At("TAIL"))
	private static void mib$fog(Camera camera, FogRenderer.FogMode mode, float renderDistance, boolean thick, float partialTick, CallbackInfo ci) {
		if (Looks.noFog(camera.getFluidInCamera())) RenderSystem.setShaderFogStart(Float.MAX_VALUE);
	}
	//#endif
}
