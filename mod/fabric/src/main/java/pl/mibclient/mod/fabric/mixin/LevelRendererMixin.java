package pl.mibclient.mod.fabric.mixin;

import net.minecraft.client.renderer.LevelRenderer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import pl.mibclient.mod.fabric.Looks;
//#if MC >= 1.21.2
import org.spongepowered.asm.mixin.injection.ModifyVariable;
//#else
import com.llamalad7.mixinextras.injector.wrapoperation.Operation;
import com.llamalad7.mixinextras.injector.wrapoperation.WrapOperation;
import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.blaze3d.vertex.VertexConsumer;
import net.minecraft.world.phys.shapes.VoxelShape;
//#endif
//#if MC >= 1.21.9 && MC < 1.21.10
import com.mojang.blaze3d.vertex.PoseStack;
import net.minecraft.client.renderer.SubmitNodeCollector;
import net.minecraft.client.renderer.state.LevelRenderState;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import pl.mibclient.mod.fabric.MibClient;
//#endif

/**
 * Block overlay: kolor (i od 1.21.11 grubość) obwódki wskazanego bloku. W 1.21.9 (Fabric API bez zdarzeń rysowania
 * świata) także znaczniki Light level overlay i Waypoints, dokładane po postaciach.
 */
@Mixin(LevelRenderer.class)
public abstract class LevelRendererMixin {
	//#if MC >= 26.2
	@ModifyVariable(method = "submitHitOutline", at = @At("HEAD"), argsOnly = true, ordinal = 0)
	private int mib$color(int color) {
		return Looks.outlineColor(color);
	}

	@ModifyVariable(method = "submitHitOutline", at = @At("HEAD"), argsOnly = true, ordinal = 0)
	private float mib$width(float width) {
		return Looks.outlineWidth(width);
	}
	//#elif MC >= 1.21.11
	@ModifyVariable(method = "renderHitOutline", at = @At("HEAD"), argsOnly = true, ordinal = 0)
	private int mib$color(int color) {
		return Looks.outlineColor(color);
	}

	@ModifyVariable(method = "renderHitOutline", at = @At("HEAD"), argsOnly = true, ordinal = 0)
	private float mib$width(float width) {
		return Looks.outlineWidth(width);
	}
	//#elif MC >= 1.21.2
	@ModifyVariable(method = "renderHitOutline", at = @At("HEAD"), argsOnly = true, ordinal = 0)
	private int mib$color(int color) {
		return Looks.outlineColor(color);
	}
	//#else
	@WrapOperation(method = "renderHitOutline", at = @At(value = "INVOKE",
			target = "Lnet/minecraft/client/renderer/LevelRenderer;renderShape(Lcom/mojang/blaze3d/vertex/PoseStack;Lcom/mojang/blaze3d/vertex/VertexConsumer;Lnet/minecraft/world/phys/shapes/VoxelShape;DDDFFFF)V"))
	private void mib$color(PoseStack pose, VertexConsumer out, VoxelShape shape, double x, double y, double z, float r, float g, float b, float a,
			Operation<Void> original) {
		int c = Looks.outlineColor(0);
		if (c == 0) original.call(pose, out, shape, x, y, z, r, g, b, a);
		else original.call(pose, out, shape, x, y, z, ((c >> 16) & 0xFF) / 255f, ((c >> 8) & 0xFF) / 255f, (c & 0xFF) / 255f, 1f);
	}
	//#endif

	//#if MC >= 1.21.9 && MC < 1.21.10
	@Inject(method = "submitEntities", at = @At("TAIL"))
	private void mib$marks(PoseStack pose, LevelRenderState state, SubmitNodeCollector out, CallbackInfo ci) {
		MibClient m = MibClient.get();
		if (m != null) m.extras.submitWorld(pose, out);
	}
	//#endif
}
