package pl.mibclient.mod.fabric.mixin;

import com.llamalad7.mixinextras.sugar.Local;
import java.util.List;
import net.minecraft.client.gui.components.DebugScreenOverlay;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.ModifyVariable;
import pl.mibclient.mod.fabric.Extras;

/** Custom F3: krótsza lewa kolumna ekranu F3 i chowanie prawej. */
@Mixin(DebugScreenOverlay.class)
public abstract class DebugScreenOverlayMixin {
	//#if MC >= 26.1
	@ModifyVariable(method = "extractLines", at = @At("HEAD"), argsOnly = true)
	//#else
	@ModifyVariable(method = "renderLines", at = @At("HEAD"), argsOnly = true)
	//#endif
	private List<String> mib$lines(List<String> lines, @Local(argsOnly = true) boolean left) {
		return Extras.debugLines(lines, left);
	}
}
