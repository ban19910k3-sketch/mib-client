package pl.mibclient.mod.fabric.mixin;

import com.llamalad7.mixinextras.injector.wrapoperation.Operation;
import com.llamalad7.mixinextras.injector.wrapoperation.WrapOperation;
import com.llamalad7.mixinextras.sugar.Local;
import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.entity.LivingEntityRenderer;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.LivingEntity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import pl.mibclient.mod.fabric.MibClient;
//#if MC >= 1.21.2
import net.minecraft.client.renderer.entity.state.LivingEntityRenderState;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import pl.mibclient.mod.fabric.MibSelfState;
//#endif

/**
 * Własny nick nad głową w kamerze 360° (Perspective) i w trzeciej osobie (Nametags), tak jak widzą go inni
 * (z logo MiB). Gra chowa nick postaci, z której patrzy kamera. Od 1.21.2 zaznacza też w stanie rysowania, czy to
 * własna postać (emotki, ukrywanie elytry).
 */
@Mixin(LivingEntityRenderer.class)
public abstract class LivingEntityRendererMixin {
	@WrapOperation(method = "shouldShowName", at = @At(value = "INVOKE", target = "Lnet/minecraft/client/Minecraft;getCameraEntity()Lnet/minecraft/world/entity/Entity;"))
	private Entity mib$ownName(Minecraft mc, Operation<Entity> original, @Local(argsOnly = true) LivingEntity entity) {
		Entity camera = original.call(mc);
		MibClient m = MibClient.get();
		if (m != null && entity == camera && entity == mc.player && m.showOwnName()) {
			MibClient.hooks.add("own-name");
			return null;
		}
		return camera;
	}

	//#if MC >= 1.21.2
	@Inject(method = "extractRenderState(Lnet/minecraft/world/entity/LivingEntity;Lnet/minecraft/client/renderer/entity/state/LivingEntityRenderState;F)V",
			at = @At("TAIL"))
	private void mib$self(LivingEntity entity, LivingEntityRenderState state, float partialTick, CallbackInfo ci) {
		if (!(state instanceof MibSelfState s)) return;
		s.mib$self(entity == Minecraft.getInstance().player);
		MibClient m = MibClient.get();
		boolean player = m != null && entity instanceof net.minecraft.client.player.AbstractClientPlayer;
		s.mib$wings(player && m.cosmeticFor((net.minecraft.client.player.AbstractClientPlayer) entity, "wings") != null);
		s.mib$hat(player ? m.cosmeticFor((net.minecraft.client.player.AbstractClientPlayer) entity, "hat") : null);
	}
	//#endif
}
