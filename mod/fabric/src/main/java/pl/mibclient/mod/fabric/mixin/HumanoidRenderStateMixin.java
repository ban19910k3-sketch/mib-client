package pl.mibclient.mod.fabric.mixin;

import org.spongepowered.asm.mixin.Mixin;
//#if MC >= 1.21.2
import net.minecraft.client.renderer.entity.state.HumanoidRenderState;
import org.spongepowered.asm.mixin.Unique;
import pl.mibclient.mod.fabric.MibSelfState;
import net.minecraft.resources.MibId;
//#else
import net.minecraft.client.model.HumanoidModel;
//#endif

/** Dane MiB w stanie rysowania postaci: własna postać, skrzydła, czapka, maska i aura (od 1.21.2; wcześniej warstwy widzą samą postać i ta wstawka jest pusta). */
//#if MC >= 1.21.2
@Mixin(HumanoidRenderState.class)
public abstract class HumanoidRenderStateMixin implements MibSelfState {
	@Unique
	private boolean mib$isSelf, mib$hasWings;
	@Unique
	private MibId mib$hatTexture, mib$maskTexture, mib$fairyTexture, mib$auraTexture;
	@Unique
	private int mib$auraKind, mib$auraNumber;

	@Override
	public boolean mib$self() {
		return mib$isSelf;
	}

	@Override
	public void mib$self(boolean self) {
		mib$isSelf = self;
	}

	@Override
	public boolean mib$wings() {
		return mib$hasWings;
	}

	@Override
	public void mib$wings(boolean wings) {
		mib$hasWings = wings;
	}

	@Override
	public MibId mib$hat() {
		return mib$hatTexture;
	}

	@Override
	public void mib$hat(MibId hat) {
		mib$hatTexture = hat;
	}

	@Override
	public MibId mib$mask() {
		return mib$maskTexture;
	}

	@Override
	public void mib$mask(MibId mask) {
		mib$maskTexture = mask;
	}

	@Override
	public MibId mib$fairy() {
		return mib$fairyTexture;
	}

	@Override
	public void mib$fairy(MibId fairy) {
		mib$fairyTexture = fairy;
	}

	@Override
	public MibId mib$aura() {
		return mib$auraTexture;
	}

	@Override
	public int mib$auraStyle() {
		return mib$auraKind;
	}

	@Override
	public int mib$auraSeed() {
		return mib$auraNumber;
	}

	@Override
	public void mib$aura(MibId aura, int style, int seed) {
		mib$auraTexture = aura;
		mib$auraKind = style;
		mib$auraNumber = seed;
	}
}
//#else
@Mixin(HumanoidModel.class)
public abstract class HumanoidRenderStateMixin {
}
//#endif
