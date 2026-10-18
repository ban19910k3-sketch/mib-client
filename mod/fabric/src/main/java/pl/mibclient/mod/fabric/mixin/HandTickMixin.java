package pl.mibclient.mod.fabric.mixin;

import com.llamalad7.mixinextras.injector.ModifyExpressionValue;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import pl.mibclient.mod.fabric.Looks;
//#if MC >= 26.3
import net.minecraft.client.player.FirstPersonHandsAndItems;
//#else
import net.minecraft.client.renderer.ItemInHandRenderer;
//#endif

/** Animations: bez opadania przedmiotu po uderzeniu (gra obniża go według ładowania ataku). */
//#if MC >= 26.3
@Mixin(FirstPersonHandsAndItems.class)
//#else
@Mixin(ItemInHandRenderer.class)
//#endif
public abstract class HandTickMixin {
	@ModifyExpressionValue(method = "tick", at = @At(value = "INVOKE", target = "Lnet/minecraft/client/player/LocalPlayer;getAttackStrengthScale(F)F"),
			require = 0)
	private float mib$attack(float scale) {
		return Looks.noDip() ? 1f : scale;
	}

	@ModifyExpressionValue(method = "tick", at = @At(value = "INVOKE", target = "Lnet/minecraft/client/player/LocalPlayer;getItemSwapScale(F)F"),
			require = 0)
	private float mib$swap(float scale) {
		return Looks.noDip() ? 1f : scale;
	}
}
