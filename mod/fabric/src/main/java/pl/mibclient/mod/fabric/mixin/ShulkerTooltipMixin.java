package pl.mibclient.mod.fabric.mixin;

import java.util.Optional;
import net.minecraft.world.inventory.tooltip.TooltipComponent;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;
import pl.mibclient.mod.fabric.ShulkerPreview;

/** Shulker tooltips: shulker z przedmiotami ma w opisie obrazek z zawartością. */
@Mixin(Item.class)
public abstract class ShulkerTooltipMixin {
	@Inject(method = "getTooltipImage", at = @At("RETURN"), cancellable = true)
	private void mib$shulker(ItemStack stack, CallbackInfoReturnable<Optional<TooltipComponent>> cir) {
		if (cir.getReturnValue().isPresent()) return;
		ShulkerPreview p = ShulkerPreview.of(stack);
		if (p != null) cir.setReturnValue(Optional.of(p));
	}
}
