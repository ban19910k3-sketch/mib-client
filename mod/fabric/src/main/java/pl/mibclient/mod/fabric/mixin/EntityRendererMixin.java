package pl.mibclient.mod.fabric.mixin;

import net.minecraft.client.renderer.entity.EntityRenderer;
import org.spongepowered.asm.mixin.Mixin;
//#if MC >= 1.21.9 && MC < 1.21.11
import net.minecraft.client.renderer.entity.state.EntityRenderState;
import net.minecraft.world.entity.Entity;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import pl.mibclient.mod.fabric.Looks;
//#endif

/** Hitbox „tylko gracze” w 1.21.9–1.21.10: ramki innych postaci nie trafiają do stanu rysowania. W innych wersjach pusto. */
@Mixin(EntityRenderer.class)
public abstract class EntityRendererMixin {
	//#if MC >= 1.21.9 && MC < 1.21.11
	@Inject(method = "extractHitboxes(Lnet/minecraft/world/entity/Entity;Lnet/minecraft/client/renderer/entity/state/EntityRenderState;F)V",
			at = @At("HEAD"), cancellable = true)
	private void mib$players(Entity entity, EntityRenderState state, float partialTick, CallbackInfo ci) {
		if (!Looks.hideHitbox(entity)) return;
		state.hitboxesRenderState = null;
		state.serverHitboxesRenderState = null;
		ci.cancel();
	}
	//#endif
}
