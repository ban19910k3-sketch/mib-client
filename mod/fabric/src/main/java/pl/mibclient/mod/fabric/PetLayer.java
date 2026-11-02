package pl.mibclient.mod.fabric;

import com.mojang.blaze3d.vertex.PoseStack;
import java.util.Map;
import java.util.WeakHashMap;
import net.minecraft.client.renderer.entity.LivingEntityRenderer;
import net.minecraft.client.renderer.entity.RenderLayerParent;
import net.minecraft.client.renderer.entity.layers.RenderLayer;
import net.minecraft.resources.MibId;
import pl.mibclient.mod.core.CosmeticModel;
//#if MC >= 1.21.11
import net.minecraft.client.model.player.PlayerModel;
//#else
import net.minecraft.client.model.PlayerModel;
//#endif
//#if MC >= 1.21.11
import net.minecraft.client.renderer.rendertype.RenderTypes;
//#else
import net.minecraft.client.renderer.RenderType;
//#endif
//#if MC >= 1.21.9
import net.minecraft.client.renderer.SubmitNodeCollector;
import net.minecraft.client.renderer.entity.state.AvatarRenderState;
//#elif MC >= 1.21.2
import net.minecraft.client.renderer.MultiBufferSource;
import net.minecraft.client.renderer.entity.state.PlayerRenderState;
//#else
import net.minecraft.client.player.AbstractClientPlayer;
import net.minecraft.client.renderer.MultiBufferSource;
//#endif

/**
 * Pet MiB (od 0.34.0): model z tekstury (kość „pet”) obok gracza — lata przy głowie, siedzi na ramieniu albo chodzi przy nodze
 * (tryb i strona z ustawień gracza), z ruchem części i snem po 30 s bez ruchu (HatLayer.ModelHat.pose, Pets). Pety innych graczy
 * tylko przy włączonym „Pety innych graczy” (MibClient.petFor). Tak samo jak putModel z petem w launcherze.
 */
@SuppressWarnings({"rawtypes", "unchecked"})
//#if MC >= 1.21.9
public final class PetLayer extends RenderLayer<AvatarRenderState, PlayerModel> {
//#elif MC >= 1.21.2
public final class PetLayer extends RenderLayer<PlayerRenderState, PlayerModel> {
//#else
public final class PetLayer extends RenderLayer<AbstractClientPlayer, PlayerModel<AbstractClientPlayer>> {
//#endif
	private final Map<CosmeticModel, HatLayer.ModelHat> models = new WeakHashMap<CosmeticModel, HatLayer.ModelHat>();

	public PetLayer(RenderLayerParent parent) {
		super(parent);
	}

	private HatLayer.ModelHat model(MibId tex) {
		return (HatLayer.ModelHat) HatLayer.modelOf(models, tex, null, true);
	}

	//#if MC >= 1.21.9
	@Override
	public void submit(PoseStack pose, SubmitNodeCollector out, int light, AvatarRenderState s, float yRot, float xRot) {
		MibId tex = ((MibSelfState) s).mib$pet();
		if (tex == null || s.isInvisible || MibClient.model(tex) == null) return;
		MibClient.hooks.add("pet_drawn");
		//#if MC >= 26.3
		out.submitModel(model(tex), s, pose, RenderTypes.armorCutoutNoCull(tex), light, LivingEntityRenderer.getOverlayCoords(s, 0f), s.outlineColor);
		//#elif MC >= 1.21.11
		out.submitModel(model(tex), s, pose, RenderTypes.armorCutoutNoCull(tex), light, LivingEntityRenderer.getOverlayCoords(s, 0f), s.outlineColor, null);
		//#else
		out.submitModel(model(tex), s, pose, RenderType.armorCutoutNoCull(tex), light, LivingEntityRenderer.getOverlayCoords(s, 0f), s.outlineColor, null);
		//#endif
	}
	//#elif MC >= 1.21.2
	@Override
	public void render(PoseStack pose, MultiBufferSource buffers, int light, PlayerRenderState s, float yRot, float xRot) {
		MibId tex = ((MibSelfState) s).mib$pet();
		if (tex == null || s.isInvisible || MibClient.model(tex) == null) return;
		MibClient.hooks.add("pet_drawn");
		HatLayer.ModelHat m = model(tex);
		m.setupAnim(s);
		m.renderToBuffer(pose, buffers.getBuffer(RenderType.armorCutoutNoCull(tex)), light, LivingEntityRenderer.getOverlayCoords(s, 0f));
	}
	//#else
	@Override
	public void render(PoseStack pose, MultiBufferSource buffers, int light, AbstractClientPlayer p, float limbSwing, float limbSwingAmount, float partialTick,
			float age, float headYaw, float headPitch) {
		MibClient mc = MibClient.get();
		MibId tex = mc == null || p.isInvisible() ? null : mc.petFor(p);
		if (tex == null || MibClient.model(tex) == null) return;
		MibClient.hooks.add("pet_drawn");
		HatLayer.ModelHat m = model(tex);
		getParentModel().copyPropertiesTo(m);
		int[] set = mc.petSettings(p);
		m.pose(age / 20f, p.isSprinting(), mc.petSleeping(p), p.isCrouching(), Math.min(1f, limbSwingAmount), limbSwing * 0.6662f, set[0], set[1]);
		m.renderToBuffer(pose, buffers.getBuffer(RenderType.armorCutoutNoCull(tex)), light, LivingEntityRenderer.getOverlayCoords(p, 0f));
	}
	//#endif
}
