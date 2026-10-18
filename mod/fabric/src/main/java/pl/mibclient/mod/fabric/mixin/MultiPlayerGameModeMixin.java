package pl.mibclient.mod.fabric.mixin;

import net.minecraft.client.multiplayer.MultiPlayerGameMode;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.inventory.AbstractContainerMenu;
import net.minecraft.world.item.ItemStack;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import pl.mibclient.mod.fabric.MibClient;
import pl.mibclient.mod.fabric.WorldTweaks;
//#if MC >= 26.1
import net.minecraft.world.inventory.ContainerInput;
//#else
import net.minecraft.world.inventory.ClickType;
//#endif

/** Uderzenie gracza (Combo, Reach, Hit i Damage indicator) i Drop prevention w ekwipunku i skrzyniach. */
@Mixin(MultiPlayerGameMode.class)
public abstract class MultiPlayerGameModeMixin {
	@Inject(method = "attack", at = @At("HEAD"))
	private void mib$attack(Player player, Entity target, CallbackInfo ci) {
		MibClient m = MibClient.get();
		if (m != null && m.pvp != null) m.pvp.onAttack(player, target);
	}

	// wyrzucenie z ekwipunku: Q nad przedmiotem albo kliknięcie poza oknem z przedmiotem na kursorze
	//#if MC >= 26.1
	@Inject(method = "handleContainerInput", at = @At("HEAD"), cancellable = true)
	private void mib$throw(int containerId, int slot, int button, ContainerInput type, Player player, CallbackInfo ci) {
		boolean thrown = type == ContainerInput.THROW, outside = type == ContainerInput.PICKUP && slot == AbstractContainerMenu.SLOT_CLICKED_OUTSIDE;
	//#else
	@Inject(method = "handleInventoryMouseClick", at = @At("HEAD"), cancellable = true)
	private void mib$throw(int containerId, int slot, int button, ClickType type, Player player, CallbackInfo ci) {
		boolean thrown = type == ClickType.THROW, outside = type == ClickType.PICKUP && slot == AbstractContainerMenu.SLOT_CLICKED_OUTSIDE;
	//#endif
		AbstractContainerMenu menu = player.containerMenu;
		ItemStack s = thrown && slot >= 0 && slot < menu.slots.size() ? menu.getSlot(slot).getItem() : outside ? menu.getCarried() : null;
		if (s != null && WorldTweaks.keep(s)) ci.cancel();
	}
}
