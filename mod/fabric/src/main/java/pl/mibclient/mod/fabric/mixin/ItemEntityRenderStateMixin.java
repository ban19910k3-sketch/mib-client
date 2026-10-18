package pl.mibclient.mod.fabric.mixin;

import org.spongepowered.asm.mixin.Mixin;
//#if MC >= 1.21.2
import net.minecraft.client.renderer.entity.state.ItemEntityRenderState;
import org.spongepowered.asm.mixin.Unique;
import pl.mibclient.mod.fabric.MibItemState;
//#else
import net.minecraft.client.renderer.entity.ItemEntityRenderer;
//#endif

/** Dane MiB w stanie rysowania leżącego przedmiotu (od 1.21.2; wcześniej rysowanie widzi sam przedmiot i ta wstawka jest pusta). */
//#if MC >= 1.21.2
@Mixin(ItemEntityRenderState.class)
public abstract class ItemEntityRenderStateMixin implements MibItemState {
	@Unique
	private float[] mib$info;

	@Override
	public float[] mib$item() {
		return mib$info;
	}

	@Override
	public void mib$item(float[] v) {
		mib$info = v;
	}
}
//#else
@Mixin(ItemEntityRenderer.class)
public abstract class ItemEntityRenderStateMixin {
}
//#endif
