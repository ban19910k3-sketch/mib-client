package pl.mibclient.mod.fabric;

import com.mojang.blaze3d.vertex.PoseStack;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.WeakHashMap;
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
import pl.mibclient.mod.core.CosmeticModel;
import pl.mibclient.mod.core.Pets;
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
 * kostka z lewej połowy tekstury, druga 10 pikseli wyżej z prawej — tak samo jak putHead w launcherze. Od 0.33.0 tekstura
 * z modelem 3D (CosmeticModel, kawałek „mib-model” w PNG) rysuje się jako ten model: części na głowie albo tułowiu (np. kotylion
 * na piersi), z kręceniem (śmigło) — tak samo jak putModel w launcherze.
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
	/** Modele zbudowane z CosmeticModel (klucz to ten sam obiekt, który MibClient trzyma przy teksturze). */
	private final Map<CosmeticModel, ModelHat> models = new WeakHashMap<CosmeticModel, ModelHat>();

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

	/**
	 * Model postaci bez kostek (głowa i tułów puste, reszta schowana) z częściami modelu kosmetyku jako dziećmi głowy albo
	 * tułowia; pet (od 0.34.0) ma wszystkie części w osobnej części „mib_pet” przy postaci, przestawianej co klatkę (tryb, strona).
	 */
	static LayerDefinition mesh(CosmeticModel cm, boolean pet) {
		MeshDefinition mesh = HumanoidModel.createMesh(CubeDeformation.NONE, 0f);
		PartDefinition root = mesh.getRoot();
		PartDefinition head = root.addOrReplaceChild("head", CubeListBuilder.create(), PartPose.ZERO);
		//#if MC >= 1.21.2
		head.addOrReplaceChild("hat", CubeListBuilder.create(), PartPose.ZERO);
		//#else
		root.addOrReplaceChild("hat", CubeListBuilder.create(), PartPose.ZERO);
		//#endif
		PartDefinition body = root.addOrReplaceChild("body", CubeListBuilder.create(), PartPose.ZERO);
		PartDefinition petRoot = pet ? root.addOrReplaceChild("mib_pet", CubeListBuilder.create(), PartPose.ZERO) : null;
		int i = 0;
		for (CosmeticModel.Part p : cm.parts) {
			CubeListBuilder b = CubeListBuilder.create();
			for (float[] c : p.boxes) b.texOffs((int) c[0], (int) c[1]).addBox(c[2], c[3], c[4], c[5], c[6], c[7], new CubeDeformation(c[8]));
			(pet ? petRoot : p.body ? body : head).addOrReplaceChild("mib_" + i++, b,
					PartPose.offsetAndRotation(p.pivot[0], p.pivot[1], p.pivot[2], rad(p.rot[0]), rad(p.rot[1]), rad(p.rot[2])));
		}
		return LayerDefinition.create(mesh, cm.width, cm.height);
	}

	static float rad(float deg) {
		return deg * (float) Math.PI / 180f;
	}

	/** Model z tekstury (zbudowany raz na model) albo plain, gdy tekstura nie ma modelu. */
	static HumanoidModel modelOf(Map<CosmeticModel, ModelHat> cache, MibId tex, HumanoidModel plain, boolean pet) {
		CosmeticModel cm = MibClient.model(tex);
		if (cm == null) return plain;
		ModelHat m = cache.get(cm);
		if (m == null) cache.put(cm, m = new ModelHat(mesh(cm, pet).bakeRoot(), cm, pet));
		return m;
	}

	private HumanoidModel modelOf(MibId tex, HumanoidModel plain) {
		return modelOf(models, tex, plain, false);
	}

	/**
	 * Model kosmetyku: części z ruchem (kręcenie, kołysanie, łapki przy chodzie, kucanie, oczy we śnie) ustawia Pets.pose — tak
	 * samo jak animate w launcherze. Pet stoi w miejscu z Pets.anchor (tryb i strona gracza), na ramieniu pochyla się z tułowiem.
	 */
	//#if MC >= 1.21.9
	static final class ModelHat extends HumanoidModel<AvatarRenderState> {
	//#elif MC >= 1.21.2
	static final class ModelHat extends HumanoidModel<PlayerRenderState> {
	//#else
	static final class ModelHat extends HumanoidModel<AbstractClientPlayer> {
	//#endif
		private final List<ModelPart> movers = new ArrayList<ModelPart>();
		private final List<CosmeticModel.Part> moverParts = new ArrayList<CosmeticModel.Part>();
		private final ModelPart petRoot;
		private final float[] rot = new float[3], pos = new float[3];

		ModelHat(ModelPart root, CosmeticModel cm, boolean pet) {
			super(root);
			hat.visible = false;
			rightArm.visible = false;
			leftArm.visible = false;
			rightLeg.visible = false;
			leftLeg.visible = false;
			petRoot = pet ? root.getChild("mib_pet") : null;
			int i = 0;
			for (CosmeticModel.Part p : cm.parts) {
				ModelPart mp = (pet ? petRoot : p.body ? body : head).getChild("mib_" + i++);
				if (p.moves()) {
					movers.add(mp);
					moverParts.add(p);
				}
			}
		}

		/** Pozy części i miejsce peta w chwili t (sekundy); walk/phase z chodu gracza. */
		void pose(float t, boolean run, boolean sleep, boolean crouch, float walk, float phase, int mode, int side) {
			for (int i = 0; i < movers.size(); i++) {
				CosmeticModel.Part p = moverParts.get(i);
				ModelPart mp = movers.get(i);
				float dy = Pets.pose(p, t, run, sleep, crouch, walk, phase, rot);
				mp.visible = !Float.isNaN(dy);
				mp.xRot = rad(rot[0]);
				mp.yRot = rad(rot[1]);
				mp.zRot = rad(rot[2]);
				mp.y = p.pivot[1] + (Float.isNaN(dy) ? 0 : dy);
			}
			if (petRoot == null) return;
			float scale = Pets.anchor(mode, side, t, sleep, pos);
			boolean onBody = Pets.onBody(mode);
			petRoot.x = pos[0];
			petRoot.y = pos[1] + (onBody ? body.y : 0);
			petRoot.z = pos[2] + (onBody ? body.z : 0);
			petRoot.xRot = onBody ? body.xRot : 0;
			petRoot.yRot = 0;
			petRoot.zRot = 0;
			petRoot.xScale = scale;
			petRoot.yScale = scale;
			petRoot.zScale = scale;
		}

		//#if MC >= 1.21.9
		@Override
		public void setupAnim(AvatarRenderState s) {
			super.setupAnim(s);
			MibSelfState ms = (MibSelfState) s;
			pose(s.ageInTicks / 20f, ms.mib$run(), ms.mib$petSleep(), s.isCrouching, Math.min(1f, s.walkAnimationSpeed), s.walkAnimationPos * 0.6662f, ms.mib$petMode(), ms.mib$petSide());
		}
		//#elif MC >= 1.21.2
		@Override
		public void setupAnim(PlayerRenderState s) {
			super.setupAnim(s);
			MibSelfState ms = (MibSelfState) s;
			pose(s.ageInTicks / 20f, ms.mib$run(), ms.mib$petSleep(), s.isCrouching, Math.min(1f, s.walkAnimationSpeed), s.walkAnimationPos * 0.6662f, ms.mib$petMode(), ms.mib$petSide());
		}
		//#endif
	}

	//#if MC >= 1.21.9
	@Override
	public void submit(PoseStack pose, SubmitNodeCollector out, int light, AvatarRenderState s, float yRot, float xRot) {
		if (s.isInvisible) return;
		MibSelfState ms = (MibSelfState) s;
		draw(pose, out, light, s, modelOf(ms.mib$mask(), mask), ms.mib$mask());
		// ogon i plecak (od 0.34.0): tylko z modelem w teksturze
		if (MibClient.model(ms.mib$tail()) != null) {
			MibClient.hooks.add("tail_drawn");
			draw(pose, out, light, s, modelOf(ms.mib$tail(), null), ms.mib$tail());
		}
		if (MibClient.model(ms.mib$back()) != null) {
			MibClient.hooks.add("back_drawn");
			draw(pose, out, light, s, modelOf(ms.mib$back(), null), ms.mib$back());
		}
		MibId tex = ms.mib$hat();
		if (MibClient.model(tex) != null) draw(pose, out, light, s, modelOf(tex, hat), tex);
		else if (MibClient.wide(tex)) {
			draw(pose, out, light, s, tallLower, tex);
			draw(pose, out, light, s, tallUpper, tex);
		} else draw(pose, out, light, s, hat, tex);
	}

	private void draw(PoseStack pose, SubmitNodeCollector out, int light, AvatarRenderState s, HumanoidModel model, MibId tex) {
		if (tex == null) return;
		MibClient.hooks.add(hook(model));
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
		draw(pose, buffers, light, s, modelOf(ms.mib$mask(), mask), ms.mib$mask());
		if (MibClient.model(ms.mib$tail()) != null) {
			MibClient.hooks.add("tail_drawn");
			draw(pose, buffers, light, s, modelOf(ms.mib$tail(), null), ms.mib$tail());
		}
		if (MibClient.model(ms.mib$back()) != null) {
			MibClient.hooks.add("back_drawn");
			draw(pose, buffers, light, s, modelOf(ms.mib$back(), null), ms.mib$back());
		}
		MibId tex = ms.mib$hat();
		if (MibClient.model(tex) != null) draw(pose, buffers, light, s, modelOf(tex, hat), tex);
		else if (MibClient.wide(tex)) {
			draw(pose, buffers, light, s, tallLower, tex);
			draw(pose, buffers, light, s, tallUpper, tex);
		} else draw(pose, buffers, light, s, hat, tex);
	}

	private void draw(PoseStack pose, MultiBufferSource buffers, int light, PlayerRenderState s, HumanoidModel model, MibId tex) {
		if (tex == null) return;
		MibClient.hooks.add(hook(model));
		model.setupAnim(s);
		model.renderToBuffer(pose, buffers.getBuffer(RenderType.armorCutoutNoCull(tex)), light, LivingEntityRenderer.getOverlayCoords(s, 0f));
	}
	//#else
	@Override
	public void render(PoseStack pose, MultiBufferSource buffers, int light, AbstractClientPlayer p, float limbSwing, float limbSwingAmount, float partialTick,
			float age, float headYaw, float headPitch) {
		MibClient m = MibClient.get();
		if (m == null || p.isInvisible()) return;
		MibId maskTex = m.cosmeticFor(p, "mask");
		walk = limbSwingAmount;
		phase = limbSwing * 0.6662f;
		draw(pose, buffers, light, p, modelOf(maskTex, mask), maskTex, age);
		for (String type : new String[] {"tail", "back"}) {
			MibId t = m.cosmeticFor(p, type);
			if (MibClient.model(t) == null) continue;
			MibClient.hooks.add(type + "_drawn");
			draw(pose, buffers, light, p, modelOf(t, null), t, age);
		}
		MibId tex = m.cosmeticFor(p, "hat");
		if (MibClient.model(tex) != null) draw(pose, buffers, light, p, modelOf(tex, hat), tex, age);
		else if (MibClient.wide(tex)) {
			draw(pose, buffers, light, p, tallLower, tex, age);
			draw(pose, buffers, light, p, tallUpper, tex, age);
		} else draw(pose, buffers, light, p, hat, tex, age);
	}

	private void draw(PoseStack pose, MultiBufferSource buffers, int light, AbstractClientPlayer p, HumanoidModel model, MibId tex, float age) {
		if (tex == null) return;
		MibClient.hooks.add(hook(model));
		getParentModel().copyPropertiesTo(model);
		if (model instanceof ModelHat) ((ModelHat) model).pose(age / 20f, p.isSprinting(), false, p.isCrouching(), Math.min(1f, walk), phase, 0, 1);
		model.renderToBuffer(pose, buffers.getBuffer(RenderType.armorCutoutNoCull(tex)), light, LivingEntityRenderer.getOverlayCoords(p, 0f));
	}
	//#endif

	//#if MC < 1.21.2
	private float walk, phase;
	//#endif

	private String hook(HumanoidModel model) {
		return model instanceof ModelHat ? "model_hat_drawn" : model == mask ? "mask_drawn" : model == tallUpper ? "tall_hat_drawn" : "hat_drawn";
	}
}
