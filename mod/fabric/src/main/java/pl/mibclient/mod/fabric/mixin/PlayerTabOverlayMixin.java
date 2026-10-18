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

/** Lista graczy (Tab): logo MiB przed nickiem graczy MiB i ping liczbami (Tablist). */
@Mixin(PlayerTabOverlay.class)
public abstract class PlayerTabOverlayMixin {
	@Inject(method = "getNameForDisplay", at = @At("RETURN"), cancellable = true)
	private void mib$badge(PlayerInfo info, CallbackInfoReturnable<Component> cir) {
		MibClient m = MibClient.get();
		if (m == null || m.players == null) return;
		GameProfile p = info.getProfile();
		cir.setReturnValue(m.players.decorate(Players.id(p), Players.name(p), cir.getReturnValue()));
	}

	// Tablist: ping liczbą zamiast kresek, kolumna o 10 px szersza (liczba jest szersza niż kreski)
	//#if MC >= 26.1
	@Inject(method = "extractPingIcon", at = @At("HEAD"), cancellable = true)
	//#else
	@Inject(method = "renderPingIcon", at = @At("HEAD"), cancellable = true)
	//#endif
	private void mib$ping(MibGraphics g, int width, int x, int y, PlayerInfo info, CallbackInfo ci) {
		if (VanillaHud.ping(g, width, x, y, info.getLatency())) ci.cancel();
	}

	//#if MC >= 26.1
	@ModifyConstant(method = "extractRenderState", constant = @Constant(intValue = 13), require = 0)
	//#else
	@ModifyConstant(method = "render", constant = @Constant(intValue = 13), require = 0)
	//#endif
	private int mib$pingColumn(int original) {
		MibClient m = MibClient.get();
		return m != null && m.modules.isOn("tablist") ? original + 10 : original;
	}
}
