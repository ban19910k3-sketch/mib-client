package pl.mibclient.mod.fabric.mixin;

import com.mojang.blaze3d.audio.Channel;
import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import pl.mibclient.mod.fabric.SoundFilters;

/** Sound filters: pogłos i wytłumienie dla każdego granego dźwięku. */
@Mixin(Channel.class)
public abstract class ChannelMixin {
	@Shadow
	@Final
	private int source;

	@Inject(method = "play", at = @At("HEAD"))
	private void mib$filters(CallbackInfo ci) {
		SoundFilters.apply(source);
	}
}
