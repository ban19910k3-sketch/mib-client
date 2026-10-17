package pl.mibclient.mod.fabric.mixin;

import net.minecraft.world.entity.LivingEntity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import pl.mibclient.mod.fabric.MibClient;

/** Totem: serwer wysyła zdarzenie 35, gdy istota zużywa totem nieśmiertelności (tylko po stronie gracza). */
@Mixin(LivingEntity.class)
public abstract class LivingEntityMixin {
	@Inject(method = "handleEntityEvent", at = @At("HEAD"))
	private void mib$totem(byte id, CallbackInfo ci) {
		MibClient m = MibClient.get();
		if (id == 35 && m != null && m.pvp != null) m.pvp.onTotem((LivingEntity) (Object) this);
	}
}
