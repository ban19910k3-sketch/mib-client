package pl.mibclient.mod.fabric.mixin;

import net.minecraft.client.gui.screens.inventory.tooltip.ClientTooltipComponent;
import net.minecraft.world.inventory.tooltip.TooltipComponent;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;
import pl.mibclient.mod.fabric.ShulkerPreview;

/** Obrazek podglądu shulkera (ShulkerPreview) rysuje własny komponent dymka. */
@Mixin(ClientTooltipComponent.class)
public interface ClientTooltipComponentMixin {
	@Inject(method = "create(Lnet/minecraft/world/inventory/tooltip/TooltipComponent;)Lnet/minecraft/client/gui/screens/inventory/tooltip/ClientTooltipComponent;",
			at = @At("HEAD"), cancellable = true)
	private static void mib$shulker(TooltipComponent data, CallbackInfoReturnable<ClientTooltipComponent> cir) {
		if (data instanceof ShulkerPreview p) cir.setReturnValue(new ShulkerPreview.Client(p));
	}
}
