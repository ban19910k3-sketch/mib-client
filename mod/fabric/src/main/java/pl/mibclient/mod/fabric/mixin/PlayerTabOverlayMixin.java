package pl.mibclient.mod.fabric.mixin;

import com.mojang.authlib.GameProfile;
import net.minecraft.client.gui.components.PlayerTabOverlay;
import net.minecraft.client.multiplayer.PlayerInfo;
import net.minecraft.client.gui.MibGraphics;
import net.minecraft.network.chat.Component;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Constant;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.ModifyConstant;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;
import pl.mibclient.mod.fabric.MibClient;
import pl.mibclient.mod.fabric.Players;
import pl.mibclient.mod.fabric.VanillaHud;

/** Lista graczy (Tab): logo MiB przed nickiem graczy MiB i ping liczbą przed kreskami (zawsze). */
@Mixin(PlayerTabOverlay.class)
public abstract class PlayerTabOverlayMixin {
	@Inject(method = "getNameForDisplay", at = @At("RETURN"), cancellable = true)
	private void mib$badge(PlayerInfo info, CallbackInfoReturnable<Component> cir) {
		MibClient m = MibClient.get();
		if (m == null || m.players == null) return;
		GameProfile p = info.getProfile();
		cir.setReturnValue(m.players.decorate(Players.id(p), Players.name(p), cir.getReturnValue()));
	}

	// Ping w Tab (zawsze): liczba przed kreskami gry, kolumna kresek szersza o miejsce na liczbę
	//#if MC >= 26.1
	@Inject(method = "extractPingIcon", at = @At("HEAD"))
	//#else
	@Inject(method = "renderPingIcon", at = @At("HEAD"))
	//#endif
	private void mib$ping(MibGraphics g, int width, int x, int y, PlayerInfo info, CallbackInfo ci) {
		VanillaHud.ping(g, width, x, y, info.getLatency());
	}

	//#if MC >= 26.1
	@ModifyConstant(method = "extractRenderState", constant = @Constant(intValue = 13), require = 0)
	//#else
	@ModifyConstant(method = "render", constant = @Constant(intValue = 13), require = 0)
	//#endif
	private int mib$pingColumn(int original) {
		return original + VanillaHud.PING_W;
	}
}
