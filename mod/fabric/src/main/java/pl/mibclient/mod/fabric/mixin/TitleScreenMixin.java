package pl.mibclient.mod.fabric.mixin;

import com.llamalad7.mixinextras.injector.wrapoperation.Operation;
import com.llamalad7.mixinextras.injector.wrapoperation.WrapOperation;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.MibGraphics;
import net.minecraft.client.gui.components.LogoRenderer;
import net.minecraft.client.gui.components.SplashRenderer;
import net.minecraft.client.gui.screens.TitleScreen;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import pl.mibclient.mod.fabric.Logo;
import pl.mibclient.mod.fabric.MibClient;

/**
 * Ekran tytułowy MiB: duże logo MiB Client zamiast logo Minecrafta, bez żółtego napisu (splash)
 * i bez napisu z wersją w lewym dolnym rogu („Minecraft 1.21.11/Fabric (Modded)”).
 */
@Mixin(TitleScreen.class)
public abstract class TitleScreenMixin {
	//#if MC >= 26.1
	@WrapOperation(method = "extractRenderState", at = @At(value = "INVOKE",
			target = "Lnet/minecraft/client/gui/components/LogoRenderer;extractRenderState(Lnet/minecraft/client/gui/MibGraphics;IF)V"))
	//#else
	@WrapOperation(method = "render", at = @At(value = "INVOKE",
			target = "Lnet/minecraft/client/gui/components/LogoRenderer;renderLogo(Lnet/minecraft/client/gui/MibGraphics;IF)V"))
	//#endif
	private void mib$logo(LogoRenderer logo, MibGraphics g, int screenWidth, float alpha, Operation<Void> original) {
		Logo.drawTitle(g, screenWidth, alpha);
	}

	//#if MC >= 26.1
	@WrapOperation(method = "extractRenderState", at = @At(value = "INVOKE",
			target = "Lnet/minecraft/client/gui/components/SplashRenderer;extractRenderState(Lnet/minecraft/client/gui/MibGraphics;ILnet/minecraft/client/gui/Font;F)V"))
	private void mib$splash(SplashRenderer splash, MibGraphics g, int screenWidth, Font font, float alpha, Operation<Void> original) {
		MibClient.hooks.add("splash");
	}
	//#elif MC >= 1.21.6
	@WrapOperation(method = "render", at = @At(value = "INVOKE",
			target = "Lnet/minecraft/client/gui/components/SplashRenderer;render(Lnet/minecraft/client/gui/MibGraphics;ILnet/minecraft/client/gui/Font;F)V"))
	private void mib$splash(SplashRenderer splash, MibGraphics g, int screenWidth, Font font, float alpha, Operation<Void> original) {
		MibClient.hooks.add("splash");
	}
	//#else
	@WrapOperation(method = "render", at = @At(value = "INVOKE",
			target = "Lnet/minecraft/client/gui/components/SplashRenderer;render(Lnet/minecraft/client/gui/MibGraphics;ILnet/minecraft/client/gui/Font;I)V"))
	private void mib$splash(SplashRenderer splash, MibGraphics g, int screenWidth, Font font, int color, Operation<Void> original) {
		MibClient.hooks.add("splash");
	}
	//#endif

	// Napis z wersją gry: jedyny tekst rysowany bezpośrednio przez ekran tytułowy (reszta to przyciski)
	//#if MC >= 26.1
	@WrapOperation(method = "extractRenderState", at = @At(value = "INVOKE",
			target = "Lnet/minecraft/client/gui/MibGraphics;text(Lnet/minecraft/client/gui/Font;Ljava/lang/String;III)V"))
	private void mib$version(MibGraphics g, Font font, String text, int x, int y, int color, Operation<Void> original) {
		if (!hideVersion(text)) original.call(g, font, text, x, y, color);
	}
	//#elif MC >= 1.21.6
	@WrapOperation(method = "render", at = @At(value = "INVOKE",
			target = "Lnet/minecraft/client/gui/MibGraphics;drawString(Lnet/minecraft/client/gui/Font;Ljava/lang/String;III)V"))
	private void mib$version(MibGraphics g, Font font, String text, int x, int y, int color, Operation<Void> original) {
		if (!hideVersion(text)) original.call(g, font, text, x, y, color);
	}
	//#else
	@WrapOperation(method = "render", at = @At(value = "INVOKE",
			target = "Lnet/minecraft/client/gui/MibGraphics;drawString(Lnet/minecraft/client/gui/Font;Ljava/lang/String;III)I"))
	private int mib$version(MibGraphics g, Font font, String text, int x, int y, int color, Operation<Integer> original) {
		return hideVersion(text) ? 0 : original.call(g, font, text, x, y, color);
	}
	//#endif

	private static boolean hideVersion(String text) {
		if (text == null || !text.startsWith("Minecraft")) return false;
		MibClient.hooks.add("version");
		return true;
	}
}
