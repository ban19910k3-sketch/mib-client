package pl.mibclient.mod.fabric.mixin;

import net.minecraft.client.MouseHandler;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import pl.mibclient.mod.fabric.MibClient;
//#if MC >= 1.21.9
import net.minecraft.client.input.MouseButtonInfo;
//#endif

/** CPS liczy kliknięcia; kółko podczas zoomu zmienia przybliżenie. */
@Mixin(MouseHandler.class)
public abstract class MouseHandlerMixin {
	//#if MC >= 1.21.9
	@Inject(method = "onButton", at = @At("HEAD"))
	private void mib$click(long window, MouseButtonInfo input, int action, CallbackInfo ci) {
		MibClient.get().onMouseButton(input.button(), action);
	}
	//#else
	@Inject(method = "onPress", at = @At("HEAD"))
	private void mib$click(long window, int button, int action, int mods, CallbackInfo ci) {
		MibClient.get().onMouseButton(button, action);
	}
	//#endif

	@Inject(method = "onScroll", at = @At("HEAD"), cancellable = true)
	private void mib$scroll(long window, double horizontal, double vertical, CallbackInfo ci) {
		if (MibClient.get().onScroll(vertical)) ci.cancel();
	}
}
