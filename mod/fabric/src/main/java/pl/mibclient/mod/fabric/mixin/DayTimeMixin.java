package pl.mibclient.mod.fabric.mixin;

import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;
import pl.mibclient.mod.fabric.WorldTweaks;
//#if MC >= 26.1
import net.minecraft.client.ClientClockManager;
import net.minecraft.core.Holder;
import net.minecraft.world.clock.WorldClock;
//#else
import net.minecraft.client.multiplayer.ClientLevel;
//#endif

/** Time changer: pora dnia świata gracza (zegar po stronie gry; serwer bez zmian). W 26.3 zegar działa inaczej (jeszcze bez). */
//#if MC >= 26.1
@Mixin(ClientClockManager.class)
//#else
@Mixin(ClientLevel.ClientLevelData.class)
//#endif
public abstract class DayTimeMixin {
	//#if MC >= 26.1
	@Inject(method = "getTotalTicks", at = @At("RETURN"), cancellable = true, require = 0)
	private void mib$time(Holder<WorldClock> clock, CallbackInfoReturnable<Long> cir) {
	//#else
	@Inject(method = "getDayTime", at = @At("RETURN"), cancellable = true)
	private void mib$time(CallbackInfoReturnable<Long> cir) {
	//#endif
		long t = WorldTweaks.dayTime(cir.getReturnValueJ());
		if (t >= 0) cir.setReturnValue(t);
	}
}
