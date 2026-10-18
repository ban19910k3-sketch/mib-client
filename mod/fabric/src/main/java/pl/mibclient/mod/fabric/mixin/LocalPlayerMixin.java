package pl.mibclient.mod.fabric.mixin;

import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import pl.mibclient.mod.fabric.WorldTweaks;
//#if MC >= 26.3
import net.minecraft.client.multiplayer.MultiPlayerGameMode;
import net.minecraft.client.player.LocalPlayer;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
//#else
import net.minecraft.client.player.LocalPlayer;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;
//#endif

/** Drop prevention: klawisz wyrzucania (Q) nie wyrzuca cennego przedmiotu z ręki. */
//#if MC >= 26.3
@Mixin(MultiPlayerGameMode.class)
//#else
@Mixin(LocalPlayer.class)
//#endif
public abstract class LocalPlayerMixin {
	//#if MC >= 26.3
	@Inject(method = "dropItem", at = @At("HEAD"), cancellable = true)
	private void mib$drop(LocalPlayer player, boolean all, CallbackInfo ci) {
		if (WorldTweaks.keep(player.getMainHandItem())) ci.cancel();
	}
	//#else
	@Inject(method = "drop", at = @At("HEAD"), cancellable = true)
	private void mib$drop(boolean all, CallbackInfoReturnable<Boolean> cir) {
		if (WorldTweaks.keep(((LocalPlayer) (Object) this).getMainHandItem())) cir.setReturnValue(false);
	}
	//#endif
}
