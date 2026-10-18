package pl.mibclient.mod.fabric.mixin;

import com.mojang.blaze3d.platform.Window;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.ModifyVariable;
import pl.mibclient.mod.fabric.Extras;

/** UI scaling: własna skala interfejsu (do 1.21.5 z ułamkiem, od 1.21.6 gra przyjmuje tylko pełne liczby). */
@Mixin(Window.class)
public abstract class WindowMixin {
	@Shadow
	public abstract int calculateScale(int guiScale, boolean forceUnicode);

	//#if MC >= 1.21.6
	@ModifyVariable(method = "setGuiScale", at = @At("HEAD"), argsOnly = true)
	private int mib$scale(int scale) {
		double s = Extras.uiScale();
		if (s <= 0) return scale;
		return Math.max(1, Math.min(calculateScale(0, false), (int) Math.round(s)));
	}
	//#else
	@ModifyVariable(method = "setGuiScale", at = @At("HEAD"), argsOnly = true)
	private double mib$scale(double scale) {
		double s = Extras.uiScale();
		if (s <= 0) return scale;
		return Math.max(1.0, Math.min(calculateScale(0, false), s));
	}
	//#endif
}
