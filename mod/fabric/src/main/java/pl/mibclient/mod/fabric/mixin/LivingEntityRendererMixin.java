package pl.mibclient.mod.fabric.mixin;

import com.llamalad7.mixinextras.injector.wrapoperation.Operation;
import com.llamalad7.mixinextras.injector.wrapoperation.WrapOperation;
import com.llamalad7.mixinextras.sugar.Local;
import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.entity.LivingEntityRenderer;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.LivingEntity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import pl.mibclient.mod.fabric.MibClient;

/**
 * Własny nick nad głową w kamerze 360° (Perspective) i w trzeciej osobie (Nametags), tak jak widzą go inni
 * (z logo MiB). Gra chowa nick postaci, z której patrzy kamera.
 */
@Mixin(LivingEntityRenderer.class)
public abstract class LivingEntityRendererMixin {
	@WrapOperation(method = "shouldShowName", at = @At(value = "INVOKE", target = "Lnet/minecraft/client/Minecraft;getCameraEntity()Lnet/minecraft/world/entity/Entity;"))
	private Entity mib$ownName(Minecraft mc, Operation<Entity> original, @Local(argsOnly = true) LivingEntity entity) {
		Entity camera = original.call(mc);
		MibClient m = MibClient.get();
		if (m != null && entity == camera && entity == mc.player && m.showOwnName()) {
			MibClient.hooks.add("own-name");
			return null;
		}
		return camera;
	}
}
