package pl.mibclient.mod.fabric.mixin;

import java.util.ArrayList;
import java.util.List;
import net.minecraft.ChatFormatting;
import net.minecraft.advancements.AdvancementProgress;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.advancements.AdvancementWidget;
import net.minecraft.network.chat.Component;
import net.minecraft.util.FormattedCharSequence;
import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Mutable;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.Unique;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import pl.mibclient.mod.fabric.MibClient;
import pl.mibclient.mod.core.Lang;

/** Custom advancement requirements: w opisie osiągnięcia (po najechaniu) lista tego, czego jeszcze brakuje. */
@Mixin(AdvancementWidget.class)
public abstract class AdvancementWidgetMixin {
	@Shadow
	@Final
	@Mutable
	private List<FormattedCharSequence> description;

	@Shadow
	private AdvancementProgress progress;

	@Shadow
	@Final
	private int width;

	@Unique
	private List<FormattedCharSequence> mib$original;

	//#if MC >= 26.1
	@Inject(method = "extractHover", at = @At("HEAD"))
	//#else
	@Inject(method = "drawHover", at = @At("HEAD"))
	//#endif
	private void mib$missing(CallbackInfo ci) {
		mib$original = null;
		MibClient m = MibClient.get();
		if (m == null || !m.modules.isOn("advancement_info") || progress == null || progress.isDone()) return;
		List<String> names = new ArrayList<>();
		for (String c : progress.getRemainingCriteria()) names.add(c.substring(c.indexOf(':') + 1).replace('_', ' '));
		if (names.isEmpty()) return;
		int max = m.intOpt("advancement_info", "max");
		String text = String.join(", ", names.subList(0, Math.min(max, names.size())));
		if (names.size() > max) text += " " + Lang.t("adv.more", names.size() - max);
		MibClient.hooks.add("advancement");
		List<FormattedCharSequence> l = new ArrayList<>(description);
		l.addAll(Minecraft.getInstance().font.split(Component.literal(Lang.t("adv.missing") + " " + text).withStyle(ChatFormatting.GRAY), Math.max(60, width - 10)));
		mib$original = description;
		description = l;
	}

	//#if MC >= 26.1
	@Inject(method = "extractHover", at = @At("RETURN"))
	//#else
	@Inject(method = "drawHover", at = @At("RETURN"))
	//#endif
	private void mib$restore(CallbackInfo ci) {
		if (mib$original != null) description = mib$original;
		mib$original = null;
	}
}
