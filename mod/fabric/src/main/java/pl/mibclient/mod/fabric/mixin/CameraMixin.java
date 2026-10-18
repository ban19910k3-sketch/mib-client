package pl.mibclient.mod.fabric.mixin;

import com.llamalad7.mixinextras.injector.wrapoperation.Operation;
import com.llamalad7.mixinextras.injector.wrapoperation.WrapOperation;
import net.minecraft.client.Camera;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.ModifyVariable;
import pl.mibclient.mod.fabric.MibClient;

/**
 * Perspective: kamera obraca się według własnych kątów, a postać patrzy dalej tam, gdzie patrzyła.
 * Camera: odległość kamery w trzeciej osobie (gra sama skraca ją przy ścianach).
 */
@Mixin(Camera.class)
public abstract class CameraMixin {
	//#if MC >= 26.1
	@WrapOperation(method = "alignWithEntity", at = @At(value = "INVOKE", target = "Lnet/minecraft/client/Camera;setRotation(FF)V"))
	//#else
	@WrapOperation(method = "setup", at = @At(value = "INVOKE", target = "Lnet/minecraft/client/Camera;setRotation(FF)V"))
	//#endif
	private void mib$freelook(Camera camera, float yRot, float xRot, Operation<Void> original) {
		MibClient m = MibClient.get();
		if (m.freelook()) original.call(camera, m.freeYaw(), m.freePitch());
		else original.call(camera, yRot, xRot);
	}

	@ModifyVariable(method = "getMaxZoom", at = @At("HEAD"), argsOnly = true)
	private float mib$distance(float distance) {
		MibClient m = MibClient.get();
		return m == null ? distance : m.cameraDistance(distance);
	}
}
