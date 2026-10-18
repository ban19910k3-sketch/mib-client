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

/** Block overlay: kolor (i od 1.21.11 grubość) obwódki wskazanego bloku. */
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
}
