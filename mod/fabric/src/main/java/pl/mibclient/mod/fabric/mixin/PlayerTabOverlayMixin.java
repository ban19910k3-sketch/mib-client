package pl.mibclient.mod.fabric.mixin;

import com.mojang.authlib.GameProfile;
import net.minecraft.client.gui.components.PlayerTabOverlay;
import net.minecraft.client.multiplayer.PlayerInfo;
import net.minecraft.network.chat.Component;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;
import pl.mibclient.mod.fabric.MibClient;
import pl.mibclient.mod.fabric.Players;

/** Lista graczy (Tab): logo MiB przed nickiem graczy MiB. */
@Mixin(PlayerTabOverlay.class)
public abstract class PlayerTabOverlayMixin {
	@Inject(method = "getNameForDisplay", at = @At("RETURN"), cancellable = true)
	private void mib$badge(PlayerInfo info, CallbackInfoReturnable<Component> cir) {
		MibClient m = MibClient.get();
		if (m == null || m.players == null) return;
		GameProfile p = info.getProfile();
		cir.setReturnValue(m.players.decorate(Players.id(p), Players.name(p), cir.getReturnValue()));
	}
}
