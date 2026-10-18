package pl.mibclient.mod.fabric.mixin;

import java.util.Collection;
import net.minecraft.client.gui.components.AbstractSelectionList;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Invoker;

/** Keybind search: podmiana widocznych wierszy listy. */
@Mixin(AbstractSelectionList.class)
public interface AbstractSelectionListAccessor {
	@Invoker("replaceEntries")
	void mib$replaceEntries(Collection<?> entries);
}
