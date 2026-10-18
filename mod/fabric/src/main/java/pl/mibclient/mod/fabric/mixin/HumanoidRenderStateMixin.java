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

/** Dane MiB w stanie rysowania postaci: własna postać, skrzydła i czapka (od 1.21.2; wcześniej warstwy widzą samą postać i ta wstawka jest pusta). */
//#if MC >= 1.21.2
@Mixin(HumanoidRenderState.class)
public abstract class HumanoidRenderStateMixin implements MibSelfState {
	@Unique
	private boolean mib$isSelf, mib$hasWings;
	@Unique
	private MibId mib$hatTexture;

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
}
//#else
@Mixin(HumanoidModel.class)
public abstract class HumanoidRenderStateMixin {
}
//#endif
