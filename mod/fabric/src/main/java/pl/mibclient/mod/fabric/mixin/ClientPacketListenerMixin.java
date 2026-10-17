package pl.mibclient.mod.fabric.mixin;

import net.minecraft.client.multiplayer.ClientPacketListener;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import pl.mibclient.mod.fabric.MibClient;

/** TPS: czas świata od serwera (koniec metody, czyli już w wątku gry). */
@Mixin(ClientPacketListener.class)
public abstract class ClientPacketListenerMixin {
	@Inject(method = "handleSetTime", at = @At("TAIL"))
	private void mib$time(CallbackInfo ci) {
		MibClient m = MibClient.get();
		if (m != null && m.pvp != null) m.pvp.onTime();
	}
}
