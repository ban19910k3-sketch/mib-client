package pl.mibclient.mod.fabric.mixin;

import net.minecraft.client.renderer.PostChain;
import org.spongepowered.asm.mixin.Mixin;
//#if MC >= 1.21.2 && MC < 1.21.6
import com.llamalad7.mixinextras.injector.wrapmethod.WrapMethod;
import com.llamalad7.mixinextras.injector.wrapoperation.Operation;
import com.mojang.blaze3d.framegraph.FrameGraphBuilder;
import java.util.Set;
import net.minecraft.resources.MibId;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.ModifyVariable;
import pl.mibclient.mod.fabric.Looks;
//#endif
//#if MC >= 1.21.5 && MC < 1.21.6
import com.mojang.blaze3d.systems.RenderPass;
import java.util.function.Consumer;
//#endif

/**
 * Motion blur w 1.21.2–1.21.5: efekty gry nie trzymają obrazu między klatkami, więc poprzednią klatkę trzyma mod
 * i podaje ją efektom MiB jako cel z zewnątrz „mibclient:previous” (Looks.PREVIOUS). W innych wersjach pusto.
 */
@Mixin(PostChain.class)
public abstract class PostChainMixin {
	//#if MC >= 1.21.2 && MC < 1.21.6
	@ModifyVariable(method = "load", at = @At("HEAD"), argsOnly = true)
	private static Set<MibId> mib$allow(Set<MibId> allowed) {
		return Looks.allowPrevious(allowed);
	}
	//#endif

	//#if MC >= 1.21.5 && MC < 1.21.6
	@WrapMethod(method = "addToFrame")
	private void mib$previous(FrameGraphBuilder builder, int w, int h, PostChain.TargetBundle targets, Consumer<RenderPass> setup, Operation<Void> original) {
		original.call(builder, w, h, Looks.withPrevious(builder, w, h, targets), setup);
	}
	//#elif MC >= 1.21.2
	@WrapMethod(method = "addToFrame")
	private void mib$previous(FrameGraphBuilder builder, int w, int h, PostChain.TargetBundle targets, Operation<Void> original) {
		original.call(builder, w, h, Looks.withPrevious(builder, w, h, targets));
	}
	//#endif
}
