package pl.mibclient.mod.fabric.mixin;

import com.llamalad7.mixinextras.injector.ModifyExpressionValue;
import net.minecraft.client.gui.screens.inventory.InventoryScreen;
import org.joml.Quaternionf;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import pl.mibclient.mod.fabric.FabricCanvas;
import pl.mibclient.mod.fabric.MibClient;

/** Podgląd kosmetyków w menu: postać gracza obrócona wokół pionowej osi (FabricCanvas.playerTurned), żeby było widać plecy. */
@Mixin(InventoryScreen.class)
public abstract class InventoryScreenMixin {
	//#if MC >= 26.1
	@ModifyExpressionValue(method = "extractEntityInInventoryFollowsMouse", at = @At(value = "INVOKE", target = "Lorg/joml/Quaternionf;rotateZ(F)Lorg/joml/Quaternionf;"))
	//#else
	@ModifyExpressionValue(method = "renderEntityInInventoryFollowsMouse", at = @At(value = "INVOKE", target = "Lorg/joml/Quaternionf;rotateZ(F)Lorg/joml/Quaternionf;"))
	//#endif
	private static Quaternionf mib$turn(Quaternionf q) {
		float yaw = FabricCanvas.previewYaw;
		if (Float.isNaN(yaw)) return q;
		MibClient.hooks.add("preview_turn");
		return q.rotateY((float) Math.toRadians(yaw));
	}
}
