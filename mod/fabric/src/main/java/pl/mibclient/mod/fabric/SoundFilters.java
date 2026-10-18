package pl.mibclient.mod.fabric;

import net.minecraft.client.Minecraft;
import net.minecraft.core.BlockPos;
import net.minecraft.world.level.LightLayer;
import org.lwjgl.openal.AL10;
import org.lwjgl.openal.ALC10;
import org.lwjgl.openal.EXTEfx;

/**
 * Sound filters: pogłos w jaskiniach i wytłumione dźwięki pod wodą przez rozszerzenie OpenAL EFX (OpenAL Soft w grze je ma).
 * Filtry dostaje każdy nowo grany dźwięk (ChannelMixin, wątek dźwięku); stan otoczenia liczy tick gry.
 */
public final class SoundFilters {
	private static volatile boolean water, cave;
	private static long context;
	private static boolean ok;
	private static int lowpass, slot, reverb;

	private SoundFilters() {
	}

	static void tick(Minecraft c, MibClient mib) {
		if (!mib.modules.isOn("sound_filters") || c.player == null || c.level == null) {
			water = cave = false;
			return;
		}
		water = mib.boolOpt("sound_filters", "water") && c.player.isUnderWater();
		BlockPos eye = BlockPos.containing(c.player.getEyePosition());
		cave = mib.boolOpt("sound_filters", "caves") && !water && !c.level.canSeeSky(eye) && c.level.getBrightness(LightLayer.SKY, eye) < 6;
	}

	/** Ustawia filtry źródła dźwięku tuż przed jego zagraniem. */
	public static synchronized void apply(int source) {
		boolean w = water, cv = cave;
		if (!w && !cv && !ok) return;
		try {
			long ctx = ALC10.alcGetCurrentContext();
			if (ctx != context) setup(ctx);
			if (!ok) return;
			AL10.alSourcei(source, EXTEfx.AL_DIRECT_FILTER, w ? lowpass : EXTEfx.AL_FILTER_NULL);
			org.lwjgl.openal.AL11.alSource3i(source, EXTEfx.AL_AUXILIARY_SEND_FILTER, cv ? slot : EXTEfx.AL_EFFECTSLOT_NULL, 0, EXTEfx.AL_FILTER_NULL);
			if (w || cv) MibClient.hooks.add("sound_filters");
		} catch (Throwable t) {
			ok = false;
		}
	}

	/** Efekty tworzone dla bieżącego kontekstu OpenAL (zmiana urządzenia dźwięku tworzy nowy). */
	private static void setup(long ctx) {
		context = ctx;
		ok = false;
		if (ctx == 0) return;
		long dev = ALC10.alcGetContextsDevice(ctx);
		if (!ALC10.alcIsExtensionPresent(dev, "ALC_EXT_EFX")) return;
		AL10.alGetError();
		reverb = EXTEfx.alGenEffects();
		EXTEfx.alEffecti(reverb, EXTEfx.AL_EFFECT_TYPE, EXTEfx.AL_EFFECT_REVERB);
		EXTEfx.alEffectf(reverb, EXTEfx.AL_REVERB_DECAY_TIME, 2.6f);
		EXTEfx.alEffectf(reverb, EXTEfx.AL_REVERB_GAIN, 0.28f);
		EXTEfx.alEffectf(reverb, EXTEfx.AL_REVERB_DENSITY, 0.9f);
		slot = EXTEfx.alGenAuxiliaryEffectSlots();
		EXTEfx.alAuxiliaryEffectSloti(slot, EXTEfx.AL_EFFECTSLOT_EFFECT, reverb);
		lowpass = EXTEfx.alGenFilters();
		EXTEfx.alFilteri(lowpass, EXTEfx.AL_FILTER_TYPE, EXTEfx.AL_FILTER_LOWPASS);
		EXTEfx.alFilterf(lowpass, EXTEfx.AL_LOWPASS_GAIN, 0.85f);
		EXTEfx.alFilterf(lowpass, EXTEfx.AL_LOWPASS_GAINHF, 0.12f);
		ok = AL10.alGetError() == AL10.AL_NO_ERROR;
	}
}
