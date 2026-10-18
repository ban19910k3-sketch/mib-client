package pl.mibclient.mod.fabric.mixin;

import net.minecraft.client.renderer.GameRenderer;
import net.minecraft.resources.MibId;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Invoker;

/** Color saturation i Motion blur: włączenie efektu pełnoekranowego gry (ten sam mechanizm co widok moba w trybie widza). */
@Mixin(GameRenderer.class)
public interface GameRendererAccessor {
	//#if MC >= 26.3
	@Invoker("setSpectatedEntityPostEffect")
	//#elif MC >= 1.21.2
	@Invoker("setPostEffect")
	//#else
	@Invoker("loadEffect")
	//#endif
	void mib$setPostEffect(MibId id);
}
