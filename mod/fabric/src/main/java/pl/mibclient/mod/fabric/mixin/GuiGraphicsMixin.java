package pl.mibclient.mod.fabric.mixin;

import com.llamalad7.mixinextras.sugar.Local;
import net.minecraft.client.gui.MibGraphics;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import pl.mibclient.mod.fabric.Looks;
//#if MC >= 1.21.2
import org.spongepowered.asm.mixin.injection.ModifyVariable;
//#else
import net.minecraft.resources.MibId;
import org.spongepowered.asm.mixin.Shadow;
//#endif

/** Rysowanie GUI: Dark mode (ciemniejsze tekstury okien z przedmiotami) i Tooltips (rozmiar dymków z opisem). */
@Mixin(MibGraphics.class)
public abstract class GuiGraphicsMixin {
	//#if MC >= 1.21.2
	@ModifyVariable(method = "innerBlit", at = @At("HEAD"), argsOnly = true, ordinal = 4)
	private int mib$dark(int color) {
		return Looks.darken(color);
	}
	//#else
	@Shadow
	abstract void innerBlit(MibId texture, int x1, int x2, int y1, int y2, int z, float u0, float u1, float v0, float v1, float r, float g, float b,
			float a);

	@Inject(method = "innerBlit(Lnet/minecraft/resources/MibId;IIIIIFFFF)V", at = @At("HEAD"), cancellable = true)
	private void mib$dark(MibId texture, int x1, int x2, int y1, int y2, int z, float u0, float u1, float v0, float v1, CallbackInfo ci) {
		int c = Looks.darken(0xFFFFFFFF);
		if (c == 0xFFFFFFFF) return;
		innerBlit(texture, x1, x2, y1, y2, z, u0, u1, v0, v1, ((c >> 16) & 0xFF) / 255f, ((c >> 8) & 0xFF) / 255f, (c & 0xFF) / 255f, 1f);
		ci.cancel();
	}
	//#endif

	//#if MC >= 26.1
	@Inject(method = "tooltip", at = @At("HEAD"))
	//#elif MC >= 1.21.6
	@Inject(method = "renderTooltip(Lnet/minecraft/client/gui/Font;Ljava/util/List;IILnet/minecraft/client/gui/screens/inventory/tooltip/ClientTooltipPositioner;Lnet/minecraft/resources/MibId;)V", at = @At("HEAD"))
	//#else
	@Inject(method = "renderTooltipInternal", at = @At("HEAD"))
	//#endif
	private void mib$tooltipStart(CallbackInfo ci, @Local(argsOnly = true, ordinal = 0) int x, @Local(argsOnly = true, ordinal = 1) int y) {
		Looks.tooltipStart((MibGraphics) (Object) this, x, y);
	}

	//#if MC >= 26.1
	@Inject(method = "tooltip", at = @At("RETURN"))
	//#elif MC >= 1.21.6
	@Inject(method = "renderTooltip(Lnet/minecraft/client/gui/Font;Ljava/util/List;IILnet/minecraft/client/gui/screens/inventory/tooltip/ClientTooltipPositioner;Lnet/minecraft/resources/MibId;)V", at = @At("RETURN"))
	//#else
	@Inject(method = "renderTooltipInternal", at = @At("RETURN"))
	//#endif
	private void mib$tooltipEnd(CallbackInfo ci) {
		Looks.tooltipEnd((MibGraphics) (Object) this);
	}
}
