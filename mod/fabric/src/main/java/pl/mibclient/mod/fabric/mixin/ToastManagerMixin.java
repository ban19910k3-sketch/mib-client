package pl.mibclient.mod.fabric.mixin;

import net.minecraft.client.gui.components.toasts.Toast;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import pl.mibclient.mod.fabric.VanillaHud;
//#if MC >= 1.21.2
import net.minecraft.client.gui.components.toasts.ToastManager;
//#else
import net.minecraft.client.gui.components.toasts.ToastComponent;
//#endif

/** Toast control: wybrane wyskakujące powiadomienia (przepisy, osiągnięcia…) nie pojawiają się wcale. */
//#if MC >= 1.21.2
@Mixin(ToastManager.class)
//#else
@Mixin(ToastComponent.class)
//#endif
public abstract class ToastManagerMixin {
	@Inject(method = "addToast", at = @At("HEAD"), cancellable = true)
	private void mib$toast(Toast toast, CallbackInfo ci) {
		if (VanillaHud.hideToast(toast)) ci.cancel();
	}
}
