package pl.mibclient.mod.fabric.mixin;

import net.minecraft.client.multiplayer.MultiPlayerGameMode;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.player.Player;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import pl.mibclient.mod.fabric.MibClient;

/** Uderzenie gracza (Combo, Reach, Hit i Damage indicator). */
@Mixin(MultiPlayerGameMode.class)
public abstract class MultiPlayerGameModeMixin {
	@Inject(method = "attack", at = @At("HEAD"))
	private void mib$attack(Player player, Entity target, CallbackInfo ci) {
		MibClient m = MibClient.get();
		if (m != null && m.pvp != null) m.pvp.onAttack(player, target);
	}
}
