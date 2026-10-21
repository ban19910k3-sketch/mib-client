package pl.mibclient.mod.fabric.mixin;

import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import pl.mibclient.mod.fabric.Looks;
//#if MC >= 1.21.2
import net.minecraft.client.renderer.entity.layers.WingsLayer;
import net.minecraft.client.renderer.entity.state.HumanoidRenderState;
import net.minecraft.core.component.DataComponents;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import org.spongepowered.asm.mixin.Unique;
import pl.mibclient.mod.fabric.MibClient;
import pl.mibclient.mod.fabric.MibSelfState;
//#else
import com.llamalad7.mixinextras.injector.ModifyExpressionValue;
import net.minecraft.client.Minecraft;
import net.minecraft.client.player.AbstractClientPlayer;
import net.minecraft.client.renderer.entity.layers.ElytraLayer;
import net.minecraft.world.entity.LivingEntity;
import pl.mibclient.mod.fabric.MibClient;
//#endif

/**
 * Elytras: ukrycie elytry własnej postaci. Skrzydła MiB: gracz bez elytry dostaje ją tylko na czas rysowania tej
 * warstwy, a gra rysuje ją z teksturą skrzydeł ze skórki (AbstractClientPlayerMixin) — z animacją jak elytra.
 */
//#if MC >= 1.21.2
@Mixin(WingsLayer.class)
//#else
@Mixin(ElytraLayer.class)
//#endif
public abstract class WingsLayerMixin {
	//#if MC >= 1.21.2
	/** Elytra na czas rysowania; tworzona przy pierwszym użyciu (w 26.x przedmiotu nie wolno tworzyć przy wczytywaniu gry). */
	@Unique
	private static ItemStack mib$wingsItem;
	@Unique
	private ItemStack mib$chest;

	@Unique
	private boolean mib$start(HumanoidRenderState state) {
		if (Looks.hideElytra(((MibSelfState) state).mib$self())) return true;
		mib$chest = null;
		//#if MC >= 1.21.4
		ItemStack chest = state.chestEquipment;
		//#else
		ItemStack chest = state.chestItem;
		//#endif
		if (!((MibSelfState) state).mib$wings() || chest.has(DataComponents.GLIDER)) return false;
		mib$chest = chest;
		if (mib$wingsItem == null) mib$wingsItem = new ItemStack(Items.ELYTRA);
		//#if MC >= 1.21.4
		state.chestEquipment = mib$wingsItem;
		//#else
		state.chestItem = mib$wingsItem;
		//#endif
		MibClient.hooks.add("wings_drawn");
		return false;
	}

	@Unique
	private void mib$end(HumanoidRenderState state) {
		if (mib$chest == null) return;
		//#if MC >= 1.21.4
		state.chestEquipment = mib$chest;
		//#else
		state.chestItem = mib$chest;
		//#endif
		mib$chest = null;
	}
	//#endif

	//#if MC >= 1.21.9
	@Inject(method = "submit(Lcom/mojang/blaze3d/vertex/PoseStack;Lnet/minecraft/client/renderer/SubmitNodeCollector;ILnet/minecraft/client/renderer/entity/state/HumanoidRenderState;FF)V",
			at = @At("HEAD"), cancellable = true)
	private void mib$hide(com.mojang.blaze3d.vertex.PoseStack pose, net.minecraft.client.renderer.SubmitNodeCollector out, int light, HumanoidRenderState state,
			float a, float b, CallbackInfo ci) {
		if (mib$start(state)) ci.cancel();
	}

	@Inject(method = "submit(Lcom/mojang/blaze3d/vertex/PoseStack;Lnet/minecraft/client/renderer/SubmitNodeCollector;ILnet/minecraft/client/renderer/entity/state/HumanoidRenderState;FF)V",
			at = @At("RETURN"))
	private void mib$restore(com.mojang.blaze3d.vertex.PoseStack pose, net.minecraft.client.renderer.SubmitNodeCollector out, int light, HumanoidRenderState state,
			float a, float b, CallbackInfo ci) {
		mib$end(state);
	}
	//#elif MC >= 1.21.2
	@Inject(method = "render(Lcom/mojang/blaze3d/vertex/PoseStack;Lnet/minecraft/client/renderer/MultiBufferSource;ILnet/minecraft/client/renderer/entity/state/HumanoidRenderState;FF)V",
			at = @At("HEAD"), cancellable = true)
	private void mib$hide(com.mojang.blaze3d.vertex.PoseStack pose, net.minecraft.client.renderer.MultiBufferSource out, int light, HumanoidRenderState state,
			float a, float b, CallbackInfo ci) {
		if (mib$start(state)) ci.cancel();
	}

	@Inject(method = "render(Lcom/mojang/blaze3d/vertex/PoseStack;Lnet/minecraft/client/renderer/MultiBufferSource;ILnet/minecraft/client/renderer/entity/state/HumanoidRenderState;FF)V",
			at = @At("RETURN"))
	private void mib$restore(com.mojang.blaze3d.vertex.PoseStack pose, net.minecraft.client.renderer.MultiBufferSource out, int light, HumanoidRenderState state,
			float a, float b, CallbackInfo ci) {
		mib$end(state);
	}
	//#else
	@Inject(method = "render(Lcom/mojang/blaze3d/vertex/PoseStack;Lnet/minecraft/client/renderer/MultiBufferSource;ILnet/minecraft/world/entity/LivingEntity;FFFFFF)V",
			at = @At("HEAD"), cancellable = true)
	private void mib$hide(com.mojang.blaze3d.vertex.PoseStack pose, net.minecraft.client.renderer.MultiBufferSource out, int light, LivingEntity entity,
			float a, float b, float c, float d, float e, float f, CallbackInfo ci) {
		if (Looks.hideElytra(entity == Minecraft.getInstance().player)) ci.cancel();
	}

	// „czy na piersi jest elytra”: dla gracza ze skrzydłami MiB tak
	@ModifyExpressionValue(method = "render(Lcom/mojang/blaze3d/vertex/PoseStack;Lnet/minecraft/client/renderer/MultiBufferSource;ILnet/minecraft/world/entity/LivingEntity;FFFFFF)V",
			at = @At(value = "INVOKE", target = "Lnet/minecraft/world/item/ItemStack;is(Lnet/minecraft/world/item/Item;)Z"), require = 0)
	private boolean mib$wings(boolean elytra, com.mojang.blaze3d.vertex.PoseStack pose, net.minecraft.client.renderer.MultiBufferSource out, int light, LivingEntity entity) {
		if (elytra || !(entity instanceof AbstractClientPlayer p) || MibClient.get() == null || MibClient.get().elytraWingsFor(p) == null) return elytra;
		MibClient.hooks.add("wings_drawn");
		return true;
	}
	//#endif
}
