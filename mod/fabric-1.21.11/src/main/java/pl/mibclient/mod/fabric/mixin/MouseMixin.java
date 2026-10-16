package pl.mibclient.mod.fabric.mixin;

import net.minecraft.client.Mouse;
import net.minecraft.client.input.MouseInput;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import pl.mibclient.mod.fabric.MibClient;

/** CPS liczy kliknięcia; kółko podczas zoomu zmienia przybliżenie. */
@Mixin(Mouse.class)
public abstract class MouseMixin {
	@Inject(method = "onMouseButton", at = @At("HEAD"))
	private void mib$click(long window, MouseInput input, int action, CallbackInfo ci) {
		MibClient.get().onMouseButton(input.button(), action);
	}

	@Inject(method = "onMouseScroll", at = @At("HEAD"), cancellable = true)
	private void mib$scroll(long window, double horizontal, double vertical, CallbackInfo ci) {
		if (MibClient.get().onScroll(vertical)) ci.cancel();
	}
}
