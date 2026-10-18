package pl.mibclient.mod.fabric.mixin;

import net.minecraft.world.level.Level;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;
import pl.mibclient.mod.fabric.VanillaHud;

/** Weather changer: własna pogoda tylko u gracza (świat po stronie gry, serwer bez zmian). */
@Mixin(Level.class)
public abstract class LevelMixin {
	@Inject(method = "getRainLevel", at = @At("RETURN"), cancellable = true)
	private void mib$rain(float delta, CallbackInfoReturnable<Float> cir) {
		Float v = VanillaHud.weather((Level) (Object) this, false);
		if (v != null) cir.setReturnValue(v);
	}

	@Inject(method = "getThunderLevel", at = @At("RETURN"), cancellable = true)
	private void mib$thunder(float delta, CallbackInfoReturnable<Float> cir) {
		Float v = VanillaHud.weather((Level) (Object) this, true);
		if (v != null) cir.setReturnValue(v);
	}
}
