package pl.mibclient.mod.fabric;

import com.mojang.blaze3d.vertex.PoseStack;
import net.minecraft.client.model.HumanoidModel;
import net.minecraft.client.model.geom.ModelPart;
import net.minecraft.client.model.geom.PartPose;
import net.minecraft.client.model.geom.builders.CubeDeformation;
import net.minecraft.client.model.geom.builders.CubeListBuilder;
import net.minecraft.client.model.geom.builders.LayerDefinition;
import net.minecraft.client.model.geom.builders.MeshDefinition;
import net.minecraft.client.model.geom.builders.PartDefinition;
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
 * Skrzydła MiB jak u wróżki (od 0.22.0; tekstura szeroka na co najmniej 128 pikseli): dwie płaszczyzny 16×20 przy
 * łopatkach, odchylone do tyłu i machające, tak samo jak w podglądzie w launcherze. Z przodu płaszczyzny widać przód
 * skrzydła z tekstury (pole od 0,0), z tyłu jego lustro (od 16,0); drugie skrzydło ma tę samą teksturę w lustrze.
 */
@SuppressWarnings({"rawtypes", "unchecked"})
//#if MC >= 1.21.9
public final class FairyWingsLayer extends RenderLayer<AvatarRenderState, PlayerModel> {
//#elif MC >= 1.21.2
public final class FairyWingsLayer extends RenderLayer<PlayerRenderState, PlayerModel> {
//#else
public final class FairyWingsLayer extends RenderLayer<AbstractClientPlayer, PlayerModel<AbstractClientPlayer>> {
//#endif
	private final WingsModel model;

	public FairyWingsLayer(RenderLayerParent parent) {
		super(parent);
		model = new WingsModel(mesh().bakeRoot());
	}

	/** Model postaci z samym tułowiem bez kostki i dwoma skrzydłami na nim (skrzydła ruszają się z tułowiem, np. przy kucaniu). */
	private static LayerDefinition mesh() {
		MeshDefinition mesh = HumanoidModel.createMesh(CubeDeformation.NONE, 0f);
		PartDefinition body = mesh.getRoot().addOrReplaceChild("body", CubeListBuilder.create(), PartPose.ZERO);
		// pole tekstury 16×20, a skrzydło o 20% mniejsze (12,8×16): od zawiasu przy plecach do czubka
		CubeDeformation smaller = new CubeDeformation(-1.6f, -2f, 0f);
		body.addOrReplaceChild("mib_wing_right", CubeListBuilder.create().texOffs(0, 0).mirror().addBox(-14.4f, -4.4f, 0f, 16f, 20f, 0f, smaller), PartPose.offset(-0.8f, 0.8f, 3.1f));
		body.addOrReplaceChild("mib_wing_left", CubeListBuilder.create().texOffs(0, 0).addBox(-1.6f, -4.4f, 0f, 16f, 20f, 0f, smaller), PartPose.offset(0.8f, 0.8f, 3.1f));
		return LayerDefinition.create(mesh, 64, 32);
	}

	//#if MC >= 1.21.9
	static final class WingsModel extends HumanoidModel<AvatarRenderState> {
	//#elif MC >= 1.21.2
	static final class WingsModel extends HumanoidModel<PlayerRenderState> {
	//#else
	static final class WingsModel extends HumanoidModel<AbstractClientPlayer> {
	//#endif
		private final ModelPart right, left;

		WingsModel(ModelPart root) {
			super(root);
			right = body.getChild("mib_wing_right");
			left = body.getChild("mib_wing_left");
			head.visible = false;
			hat.visible = false;
			rightArm.visible = false;
			leftArm.visible = false;
			rightLeg.visible = false;
			leftLeg.visible = false;
		}

		/** Skrzydła odchylone do tyłu o 0,8 rad i machające (jak w launcherze: 4,2 rad na sekundę, ±0,22). */
		void flap(float ageInTicks) {
			float a = 0.8f + (float) Math.sin(ageInTicks / 20f * 4.2f) * 0.22f;
			right.yRot = a;
			left.yRot = -a;
		}

		//#if MC >= 1.21.9
		@Override
		public void setupAnim(AvatarRenderState s) {
			super.setupAnim(s);
			flap(s.ageInTicks);
		}
		//#elif MC >= 1.21.2
		@Override
		public void setupAnim(PlayerRenderState s) {
			super.setupAnim(s);
			flap(s.ageInTicks);
		}
		//#endif
	}

	//#if MC >= 1.21.9
	@Override
	public void submit(PoseStack pose, SubmitNodeCollector out, int light, AvatarRenderState s, float yRot, float xRot) {
		MibId tex = ((MibSelfState) s).mib$fairy();
		if (tex == null || s.isInvisible) return;
		MibClient.hooks.add("fairy_drawn");
		//#if MC >= 26.3
		out.submitModel(model, s, pose, RenderTypes.entityCutout(tex), light, LivingEntityRenderer.getOverlayCoords(s, 0f), s.outlineColor);
		//#elif MC >= 1.21.11
		out.submitModel(model, s, pose, RenderTypes.entityCutout(tex), light, LivingEntityRenderer.getOverlayCoords(s, 0f), s.outlineColor, null);
		//#else
		out.submitModel(model, s, pose, RenderType.entityCutout(tex), light, LivingEntityRenderer.getOverlayCoords(s, 0f), s.outlineColor, null);
		//#endif
	}
	//#elif MC >= 1.21.2
	@Override
	public void render(PoseStack pose, MultiBufferSource buffers, int light, PlayerRenderState s, float yRot, float xRot) {
		MibId tex = ((MibSelfState) s).mib$fairy();
		if (tex == null || s.isInvisible) return;
		MibClient.hooks.add("fairy_drawn");
		model.setupAnim(s);
		model.renderToBuffer(pose, buffers.getBuffer(RenderType.entityCutout(tex)), light, LivingEntityRenderer.getOverlayCoords(s, 0f));
	}
	//#else
	@Override
	public void render(PoseStack pose, MultiBufferSource buffers, int light, AbstractClientPlayer p, float limbSwing, float limbSwingAmount, float partialTick,
			float age, float headYaw, float headPitch) {
		MibClient m = MibClient.get();
		MibId tex = m == null || p.isInvisible() ? null : m.fairyWingsFor(p);
		if (tex == null) return;
		MibClient.hooks.add("fairy_drawn");
		getParentModel().copyPropertiesTo(model);
		model.flap(age);
		model.renderToBuffer(pose, buffers.getBuffer(RenderType.entityCutout(tex)), light, LivingEntityRenderer.getOverlayCoords(p, 0f));
	}
	//#endif
}
