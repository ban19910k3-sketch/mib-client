package pl.mibclient.mod.fabric.mixin;

import net.minecraft.network.chat.Component;
import net.minecraft.world.entity.Entity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;
import pl.mibclient.mod.fabric.WorldTweaks;

/** TNT timer, Item despawn i Mob overlay: napis MiB jako widoczna nazwa istoty (gra rysuje go nad nią jak zwykłą nazwę). */
@Mixin(Entity.class)
public abstract class EntityMixin {
	@Inject(method = "getCustomName", at = @At("HEAD"), cancellable = true)
	private void mib$label(CallbackInfoReturnable<Component> cir) {
		Component l = WorldTweaks.label((Entity) (Object) this);
		if (l != null) cir.setReturnValue(l);
	}

	@Inject(method = "hasCustomName", at = @At("HEAD"), cancellable = true, require = 0)
	private void mib$hasLabel(CallbackInfoReturnable<Boolean> cir) {
		if (WorldTweaks.label((Entity) (Object) this) != null) cir.setReturnValue(true);
	}

	@Inject(method = "isCustomNameVisible", at = @At("HEAD"), cancellable = true)
	private void mib$labelVisible(CallbackInfoReturnable<Boolean> cir) {
		if (WorldTweaks.label((Entity) (Object) this) != null) cir.setReturnValue(true);
	}
}
