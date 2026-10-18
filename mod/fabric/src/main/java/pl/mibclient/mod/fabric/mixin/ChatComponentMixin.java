package pl.mibclient.mod.fabric.mixin;

import net.minecraft.client.gui.components.ChatComponent;
import net.minecraft.network.chat.Component;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Constant;
import org.spongepowered.asm.mixin.injection.ModifyConstant;
import org.spongepowered.asm.mixin.injection.ModifyVariable;
import pl.mibclient.mod.fabric.MibClient;

/** Custom chat: godzina przed wiadomością i dłuższa historia czatu. */
@Mixin(ChatComponent.class)
public abstract class ChatComponentMixin {
	//#if MC >= 26.1
	@ModifyVariable(method = "addMessage(Lnet/minecraft/network/chat/Component;Lnet/minecraft/network/chat/MessageSignature;Lnet/minecraft/client/multiplayer/chat/GuiMessageSource;Lnet/minecraft/client/multiplayer/chat/GuiMessageTag;)V",
			at = @At("HEAD"), argsOnly = true, ordinal = 0)
	//#else
	@ModifyVariable(method = "addMessage(Lnet/minecraft/network/chat/Component;Lnet/minecraft/network/chat/MessageSignature;Lnet/minecraft/client/GuiMessageTag;)V",
			at = @At("HEAD"), argsOnly = true, ordinal = 0)
	//#endif
	private Component mib$time(Component message) {
		MibClient m = MibClient.get();
		return m == null ? message : m.chatMessage(message);
	}

	// gra trzyma 100 wiadomości; z Custom chat więcej (stała może zniknąć w nowszej wersji — wtedy bez zmian)
	@ModifyConstant(method = {"addMessageToQueue", "addMessageToDisplayQueue"}, constant = @Constant(intValue = 100), require = 0)
	private int mib$history(int max) {
		MibClient m = MibClient.get();
		return m == null ? max : m.chatHistory(max);
	}
}
