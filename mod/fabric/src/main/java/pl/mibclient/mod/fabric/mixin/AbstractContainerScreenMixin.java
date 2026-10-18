package pl.mibclient.mod.fabric.mixin;

import net.minecraft.client.gui.screens.inventory.AbstractContainerScreen;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.Constant;
import org.spongepowered.asm.mixin.injection.ModifyConstant;
import pl.mibclient.mod.fabric.Looks;

/** Dark mode: jasne napisy w oknach z przedmiotami (ciemnoszare z gry byłyby niewidoczne na ciemnym tle). */
@Mixin(AbstractContainerScreen.class)
public abstract class AbstractContainerScreenMixin {
	//#if MC >= 26.1
	@ModifyConstant(method = "extractLabels", constant = {@Constant(intValue = 4210752), @Constant(intValue = -12566464)}, require = 0)
	//#else
	@ModifyConstant(method = "renderLabels", constant = {@Constant(intValue = 4210752), @Constant(intValue = -12566464)}, require = 0)
	//#endif
	private int mib$label(int color) {
		return Looks.label(color);
	}
}
