package pl.mibclient.mod.fabric;

import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.blaze3d.vertex.VertexConsumer;
import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.entity.RenderLayerParent;
import net.minecraft.client.renderer.entity.layers.RenderLayer;
import net.minecraft.resources.MibId;
import org.joml.Matrix4f;
import org.joml.Quaternionf;
import org.joml.Vector3f;
import pl.mibclient.mod.core.Auras;
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
 * Aura MiB (od 0.22.0): cząsteczki z Auras (te same co w podglądzie w launcherze) jako małe obrazki zwrócone do kamery,
 * z pełnym światłem. Pozycje liczone od stóp postaci w osiach świata, więc aura nie obraca się z postacią. W ekwipunku
 * i w menu (postać w powiększeniu) aury nie ma.
 */
@SuppressWarnings({"rawtypes", "unchecked"})
//#if MC >= 1.21.9
public final class AuraLayer extends RenderLayer<AvatarRenderState, PlayerModel> {
//#elif MC >= 1.21.2
public final class AuraLayer extends RenderLayer<PlayerRenderState, PlayerModel> {
//#else
public final class AuraLayer extends RenderLayer<AbstractClientPlayer, PlayerModel<AbstractClientPlayer>> {
//#endif
	/** Pełne światło i brak nakładki obrażeń (LightTexture.FULL_BRIGHT, OverlayTexture.NO_OVERLAY). */
	private static final int FULL_BRIGHT = 0xF000F0, NO_OVERLAY = 10 << 16;
	/** Liczby na wierzchołek: x, y, z (względem kamery), u, v, krycie. */
	private static final int V = 6;

	public AuraLayer(RenderLayerParent parent) {
		super(parent);
	}

	//#if MC >= 1.21.9
	@Override
	public void submit(PoseStack pose, SubmitNodeCollector out, int light, AvatarRenderState s, float yRot, float xRot) {
		MibSelfState m = (MibSelfState) s;
		float[] v = m.mib$aura() == null || s.isInvisible ? null : quads(pose, m.mib$auraStyle(), m.mib$auraSeed());
		if (v == null) return;
		//#if MC >= 1.21.11
		out.submitCustomGeometry(pose, RenderTypes.entityTranslucent(m.mib$aura()), (p, vc) -> emit(vc, v));
		//#else
		out.submitCustomGeometry(pose, RenderType.entityTranslucent(m.mib$aura()), (p, vc) -> emit(vc, v));
		//#endif
	}
	//#elif MC >= 1.21.2
	@Override
	public void render(PoseStack pose, MultiBufferSource buffers, int light, PlayerRenderState s, float yRot, float xRot) {
		MibSelfState m = (MibSelfState) s;
		float[] v = m.mib$aura() == null || s.isInvisible ? null : quads(pose, m.mib$auraStyle(), m.mib$auraSeed());
		if (v != null) emit(buffers.getBuffer(RenderType.entityTranslucent(m.mib$aura())), v);
	}
	//#else
	@Override
	public void render(PoseStack pose, MultiBufferSource buffers, int light, AbstractClientPlayer p, float limbSwing, float limbSwingAmount, float partialTick,
			float age, float headYaw, float headPitch) {
		MibClient m = MibClient.get();
		MibId tex = m == null || p.isInvisible() ? null : m.cosmeticFor(p, "aura");
		float[] v = tex == null ? null : quads(pose, m.auraStyleFor(p), p.getUUID().hashCode());
		if (v != null) emit(buffers.getBuffer(RenderType.entityTranslucent(tex)), v);
	}
	//#endif

	/**
	 * Wierzchołki obrazków cząsteczek względem kamery albo null (bez aury, postać w ekwipunku). Stopy postaci to punkt
	 * (0; 1,501; 0) w układzie modelu (gra przesuwa model o -1,501 w pionie).
	 */
	private static float[] quads(PoseStack pose, int style, int seed) {
		Matrix4f m = pose.last().pose();
		if (style == Auras.NONE || new Vector3f(m.m00(), m.m01(), m.m02()).length() > 2f) return null;
		Vector3f feet = m.transformPosition(0f, 1.501f, 0f, new Vector3f());
		Quaternionf q = cameraRotation();
		Vector3f right = q.transform(new Vector3f(1f, 0f, 0f)), up = q.transform(new Vector3f(0f, 1f, 0f));
		float[] p = new float[Auras.MAX * Auras.STRIDE];
		int n = Auras.particles(style, Auras.time(System.currentTimeMillis()), seed, p);
		if (n == 0) return null;
		float[] out = new float[n * 4 * V];
		for (int i = 0; i < n; i++) {
			int o = i * Auras.STRIDE, cell = (int) p[o + 3];
			float cx = feet.x + p[o] / 16f, cy = feet.y + p[o + 1] / 16f, cz = feet.z + p[o + 2] / 16f, half = p[o + 4] * 8f / 16f / 2f;
			float u0 = cell * 8f / 64f, u1 = (cell + 1) * 8f / 64f, v1 = 8f / 32f;
			// przeciwnie do wskazówek zegara, patrząc z kamery (jak cząsteczki gry): widać je też przy pomijaniu tylnych ścian
			int w = i * 4 * V;
			w = corner(out, w, cx, cy, cz, right, up, half, -half, u1, v1, p[o + 5]);
			w = corner(out, w, cx, cy, cz, right, up, half, half, u1, 0f, p[o + 5]);
			w = corner(out, w, cx, cy, cz, right, up, -half, half, u0, 0f, p[o + 5]);
			corner(out, w, cx, cy, cz, right, up, -half, -half, u0, v1, p[o + 5]);
		}
		MibClient.hooks.add("aura_drawn");
		return out;
	}

	private static int corner(float[] out, int w, float cx, float cy, float cz, Vector3f right, Vector3f up, float dx, float dy, float u, float v, float alpha) {
		out[w] = cx + right.x * dx + up.x * dy;
		out[w + 1] = cy + right.y * dx + up.y * dy;
		out[w + 2] = cz + right.z * dx + up.z * dy;
		out[w + 3] = u;
		out[w + 4] = v;
		out[w + 5] = alpha;
		return w + V;
	}

	private static void emit(VertexConsumer vc, float[] v) {
		for (int i = 0; i < v.length; i += V) {
			vc.addVertex(v[i], v[i + 1], v[i + 2]).setColor(1f, 1f, 1f, v[i + 5]).setUv(v[i + 3], v[i + 4]).setOverlay(NO_OVERLAY).setLight(FULL_BRIGHT).setNormal(0f, 1f, 0f);
		}
	}

	private static Quaternionf cameraRotation() {
		//#if MC >= 26.2
		return Minecraft.getInstance().gameRenderer.mainCamera().rotation();
		//#else
		return Minecraft.getInstance().gameRenderer.getMainCamera().rotation();
		//#endif
	}
}
