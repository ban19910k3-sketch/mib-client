package pl.mibclient.mod.fabric.mixin;

import net.minecraft.client.KeyMapping;
import net.minecraft.client.gui.screens.options.controls.KeyBindsList;
import net.minecraft.network.chat.Component;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Accessor;

/** Keybind search: nazwa i klawisz wiersza listy klawiszy. */
@Mixin(KeyBindsList.KeyEntry.class)
public interface KeyEntryAccessor {
	@Accessor("name")
	Component mib$name();

	@Accessor("key")
	KeyMapping mib$key();
}
