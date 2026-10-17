package pl.mibclient.mod.fabric.mixin;

import net.minecraft.client.Minecraft;
import net.minecraft.client.multiplayer.ClientPacketListener;
import net.minecraft.network.protocol.game.ClientboundEntityEventPacket;
import net.minecraft.world.entity.LivingEntity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import pl.mibclient.mod.fabric.MibClient;

/** Pakiety serwera na końcu obsługi (już w wątku gry): czas świata (TPS) i zużyte totemy (zdarzenie 35). */
@Mixin(ClientPacketListener.class)
public abstract class ClientPacketListenerMixin {
	@Inject(method = "handleSetTime", at = @At("TAIL"))
	private void mib$time(CallbackInfo ci) {
		MibClient m = MibClient.get();
		if (m != null && m.pvp != null) m.pvp.onTime();
	}

	// gra obsługuje totem w całości tutaj (cząsteczki, dźwięk), bez LivingEntity.handleEntityEvent
	@Inject(method = "handleEntityEvent", at = @At("TAIL"))
	private void mib$totem(ClientboundEntityEventPacket packet, CallbackInfo ci) {
		MibClient m = MibClient.get();
		Minecraft c = Minecraft.getInstance();
		if (packet.getEventId() != 35 || m == null || m.pvp == null || c.level == null) return;
		if (packet.getEntity(c.level) instanceof LivingEntity e) m.pvp.onTotem(e);
	}
}
