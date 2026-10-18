package pl.mibclient.mod.fabric;

import com.mojang.blaze3d.vertex.PoseStack;
import net.minecraft.client.model.HumanoidModel;
import net.minecraft.client.model.geom.builders.CubeDeformation;
import net.minecraft.client.model.geom.builders.LayerDefinition;
import net.minecraft.client.renderer.entity.LivingEntityRenderer;
import net.minecraft.client.renderer.entity.RenderLayerParent;
import net.minecraft.client.renderer.entity.layers.RenderLayer;
import net.minecraft.resources.MibId;
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
 * Czapka MiB: model głowy jak hełm (tekstura 64×32 w układzie hełmu, jak w paczkach zasobów), z teksturą czapki
 * gracza MiB z panelu admina. Rysowana razem z postacią, więc chowa się za ścianami i rusza z głową.
 */
@SuppressWarnings({"rawtypes", "unchecked"})
//#if MC >= 1.21.9
public final class HatLayer extends RenderLayer<AvatarRenderState, PlayerModel> {
//#elif MC >= 1.21.2
public final class HatLayer extends RenderLayer<PlayerRenderState, PlayerModel> {
//#else
public final class HatLayer extends RenderLayer<AbstractClientPlayer, PlayerModel<AbstractClientPlayer>> {
//#endif
	private final HumanoidModel model;

	public HatLayer(RenderLayerParent parent) {
		super(parent);
		model = new HumanoidModel(LayerDefinition.create(HumanoidModel.createMesh(new CubeDeformation(1.0f), 0f), 64, 32).bakeRoot());
		model.body.visible = false;
		model.rightArm.visible = false;
		model.leftArm.visible = false;
		model.rightLeg.visible = false;
		model.leftLeg.visible = false;
	}

	//#if MC >= 1.21.9
	@Override
	public void submit(PoseStack pose, SubmitNodeCollector out, int light, AvatarRenderState s, float yRot, float xRot) {
		MibId tex = ((MibSelfState) s).mib$hat();
		if (tex == null || s.isInvisible) return;
		MibClient.hooks.add("hat_drawn");
		//#if MC >= 26.3
		out.submitModel(model, s, pose, RenderTypes.armorCutoutNoCull(tex), light, LivingEntityRenderer.getOverlayCoords(s, 0f), s.outlineColor);
		//#elif MC >= 1.21.11
		out.submitModel(model, s, pose, RenderTypes.armorCutoutNoCull(tex), light, LivingEntityRenderer.getOverlayCoords(s, 0f), s.outlineColor, null);
		//#else
		out.submitModel(model, s, pose, RenderType.armorCutoutNoCull(tex), light, LivingEntityRenderer.getOverlayCoords(s, 0f), s.outlineColor, null);
		//#endif
	}
	//#elif MC >= 1.21.2
	@Override
	public void render(PoseStack pose, MultiBufferSource buffers, int light, PlayerRenderState s, float yRot, float xRot) {
		MibId tex = ((MibSelfState) s).mib$hat();
		if (tex == null || s.isInvisible) return;
		MibClient.hooks.add("hat_drawn");
		model.setupAnim(s);
		model.renderToBuffer(pose, buffers.getBuffer(RenderType.armorCutoutNoCull(tex)), light, LivingEntityRenderer.getOverlayCoords(s, 0f));
	}
	//#else
	@Override
	public void render(PoseStack pose, MultiBufferSource buffers, int light, AbstractClientPlayer p, float limbSwing, float limbSwingAmount, float partialTick,
			float age, float headYaw, float headPitch) {
		MibClient m = MibClient.get();
		MibId tex = m == null || p.isInvisible() ? null : m.cosmeticFor(p, "hat");
		if (tex == null) return;
		MibClient.hooks.add("hat_drawn");
		getParentModel().copyPropertiesTo(model);
		model.renderToBuffer(pose, buffers.getBuffer(RenderType.armorCutoutNoCull(tex)), light, LivingEntityRenderer.getOverlayCoords(p, 0f));
	}
	//#endif
}
