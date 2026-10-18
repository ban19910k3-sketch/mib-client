package pl.mibclient.mod.fabric.mixin;

import net.minecraft.client.player.AbstractClientPlayer;
import net.minecraft.network.chat.Component;
import net.minecraft.world.entity.player.Player;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;
import pl.mibclient.mod.fabric.MibClient;
import pl.mibclient.mod.fabric.WorldTweaks;

/** Nick nad głową: logo MiB przed nickiem graczy MiB i zdrowie z Player overlay (tylko postacie po stronie gracza, nie na serwerze świata). */
@Mixin(Player.class)
public abstract class PlayerMixin {
	@Inject(method = "getDisplayName", at = @At("RETURN"), cancellable = true)
	private void mib$badge(CallbackInfoReturnable<Component> cir) {
		MibClient m = MibClient.get();
		if (m == null || m.players == null || !((Object) this instanceof AbstractClientPlayer p)) return;
		Component name = m.players.decorate(p.getUUID(), p.getScoreboardName(), cir.getReturnValue());
		Component hp = WorldTweaks.playerHealth(p);
		cir.setReturnValue(hp == null ? name : Component.empty().append(name).append(hp));
	}
}
