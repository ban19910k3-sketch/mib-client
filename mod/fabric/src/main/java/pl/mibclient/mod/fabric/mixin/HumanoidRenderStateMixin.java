package pl.mibclient.mod.fabric.mixin;

import org.spongepowered.asm.mixin.Mixin;
//#if MC >= 1.21.2
import net.minecraft.client.renderer.entity.state.HumanoidRenderState;
import org.spongepowered.asm.mixin.Unique;
import pl.mibclient.mod.fabric.MibSelfState;
//#else
import net.minecraft.client.model.HumanoidModel;
//#endif

/** Znacznik własnej postaci w stanie rysowania (od 1.21.2; wcześniej model widzi samą postać i ta wstawka jest pusta). */
//#if MC >= 1.21.2
@Mixin(HumanoidRenderState.class)
public abstract class HumanoidRenderStateMixin implements MibSelfState {
	@Unique
	private boolean mib$isSelf;

	@Override
	public boolean mib$self() {
		return mib$isSelf;
	}

	@Override
	public void mib$self(boolean self) {
		mib$isSelf = self;
	}
}
//#else
@Mixin(HumanoidModel.class)
public abstract class HumanoidRenderStateMixin {
}
//#endif
