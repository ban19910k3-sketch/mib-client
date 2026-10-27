package pl.mibclient.mod.fabric;

import com.mojang.blaze3d.vertex.PoseStack;
import net.minecraft.client.model.HumanoidModel;
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
 * Czapka i maska MiB: model głowy jak hełm (tekstura 64×32 w układzie hełmu, jak w paczkach zasobów), z teksturą gracza
 * MiB z panelu admina. Rysowane razem z postacią, więc chowają się za ścianami i ruszają z głową. Od 0.25.0 maska (trochę
 * mniejsza, pod czapką: kostki 9,2 i 10,2 piksela) i wysoka czapka (tekstura szeroka na 128, Cosmetics.tallHat): dolna
 * kostka z lewej połowy tekstury, druga 10 pikseli wyżej z prawej — tak samo jak putHead w launcherze.
 */
@SuppressWarnings({"rawtypes", "unchecked"})
//#if MC >= 1.21.9
public final class HatLayer extends RenderLayer<AvatarRenderState, PlayerModel> {
//#elif MC >= 1.21.2
public final class HatLayer extends RenderLayer<PlayerRenderState, PlayerModel> {
//#else
public final class HatLayer extends RenderLayer<AbstractClientPlayer, PlayerModel<AbstractClientPlayer>> {
//#endif
	private final HumanoidModel hat, tallLower, tallUpper, mask;

	public HatLayer(RenderLayerParent parent) {
		super(parent);
		hat = head(LayerDefinition.create(HumanoidModel.createMesh(new CubeDeformation(1.0f), 0f), 64, 32));
		tallLower = head(LayerDefinition.create(HumanoidModel.createMesh(new CubeDeformation(1.0f), 0f), 128, 64));
		tallUpper = head(upper());
		mask = head(LayerDefinition.create(HumanoidModel.createMesh(new CubeDeformation(0.6f), 0f), 64, 32));
	}

	/** Model postaci z samą głową. */
	private static HumanoidModel head(LayerDefinition def) {
		HumanoidModel m = new HumanoidModel(def.bakeRoot());
		m.body.visible = false;
		m.rightArm.visible = false;
		m.leftArm.visible = false;
		m.rightLeg.visible = false;
		m.leftLeg.visible = false;
		return m;
	}

	/** Górna kostka wysokiej czapki: głowa i nakładka z prawej połowy tekstury 128×64 (od x = 64), 10 pikseli nad dolną. */
	private static LayerDefinition upper() {
		MeshDefinition mesh = HumanoidModel.createMesh(new CubeDeformation(1.0f), 0f);
		PartDefinition root = mesh.getRoot();
		PartDefinition head = root.addOrReplaceChild("head", CubeListBuilder.create().texOffs(64, 0).addBox(-4f, -18f, -4f, 8f, 8f, 8f, new CubeDeformation(1.0f)), PartPose.ZERO);
		CubeListBuilder top = CubeListBuilder.create().texOffs(96, 0).addBox(-4f, -18f, -4f, 8f, 8f, 8f, new CubeDeformation(1.5f));
		//#if MC >= 1.21.2
		head.addOrReplaceChild("hat", top, PartPose.ZERO);
		//#else
		root.addOrReplaceChild("hat", top, PartPose.ZERO);
		//#endif
		return LayerDefinition.create(mesh, 128, 64);
	}

	//#if MC >= 1.21.9
	@Override
	public void submit(PoseStack pose, SubmitNodeCollector out, int light, AvatarRenderState s, float yRot, float xRot) {
		if (s.isInvisible) return;
		MibSelfState ms = (MibSelfState) s;
		draw(pose, out, light, s, mask, ms.mib$mask());
		MibId tex = ms.mib$hat();
		if (MibClient.wide(tex)) {
			draw(pose, out, light, s, tallLower, tex);
			draw(pose, out, light, s, tallUpper, tex);
		} else draw(pose, out, light, s, hat, tex);
	}

	private void draw(PoseStack pose, SubmitNodeCollector out, int light, AvatarRenderState s, HumanoidModel model, MibId tex) {
		if (tex == null) return;
		MibClient.hooks.add(model == mask ? "mask_drawn" : model == tallUpper ? "tall_hat_drawn" : "hat_drawn");
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
		if (s.isInvisible) return;
		MibSelfState ms = (MibSelfState) s;
		draw(pose, buffers, light, s, mask, ms.mib$mask());
		MibId tex = ms.mib$hat();
		if (MibClient.wide(tex)) {
			draw(pose, buffers, light, s, tallLower, tex);
			draw(pose, buffers, light, s, tallUpper, tex);
		} else draw(pose, buffers, light, s, hat, tex);
	}

	private void draw(PoseStack pose, MultiBufferSource buffers, int light, PlayerRenderState s, HumanoidModel model, MibId tex) {
		if (tex == null) return;
		MibClient.hooks.add(model == mask ? "mask_drawn" : model == tallUpper ? "tall_hat_drawn" : "hat_drawn");
		model.setupAnim(s);
		model.renderToBuffer(pose, buffers.getBuffer(RenderType.armorCutoutNoCull(tex)), light, LivingEntityRenderer.getOverlayCoords(s, 0f));
	}
	//#else
	@Override
	public void render(PoseStack pose, MultiBufferSource buffers, int light, AbstractClientPlayer p, float limbSwing, float limbSwingAmount, float partialTick,
			float age, float headYaw, float headPitch) {
		MibClient m = MibClient.get();
		if (m == null || p.isInvisible()) return;
		draw(pose, buffers, light, p, mask, m.cosmeticFor(p, "mask"));
		MibId tex = m.cosmeticFor(p, "hat");
		if (MibClient.wide(tex)) {
			draw(pose, buffers, light, p, tallLower, tex);
			draw(pose, buffers, light, p, tallUpper, tex);
		} else draw(pose, buffers, light, p, hat, tex);
	}

	private void draw(PoseStack pose, MultiBufferSource buffers, int light, AbstractClientPlayer p, HumanoidModel model, MibId tex) {
		if (tex == null) return;
		MibClient.hooks.add(model == mask ? "mask_drawn" : model == tallUpper ? "tall_hat_drawn" : "hat_drawn");
		getParentModel().copyPropertiesTo(model);
		model.renderToBuffer(pose, buffers.getBuffer(RenderType.armorCutoutNoCull(tex)), light, LivingEntityRenderer.getOverlayCoords(p, 0f));
	}
	//#endif
}
