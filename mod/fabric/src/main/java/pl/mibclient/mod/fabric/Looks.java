package pl.mibclient.mod.fabric;

import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.math.Axis;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import net.fabricmc.fabric.api.client.screen.v1.ScreenEvents;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.MibGraphics;
import net.minecraft.client.gui.screens.inventory.AbstractContainerScreen;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.resources.MibId;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.HumanoidArm;
import net.minecraft.world.entity.item.ItemEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.BlockItem;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.material.FogType;
import pl.mibclient.mod.core.Setting;

/**
 * Wygląd świata i ekranów: Dark mode, Tooltips (rozmiar), Item physic, UHC overlay, Loot beams, Block overlay, Hitbox,
 * Custom fog, Animations (1.7), Elytras, Color saturation i Motion blur (efekty pełnoekranowe gry). Wołane z wstawek w grę.
 */
public final class Looks {
	/** Leżący przedmiot rysowany w tej chwili: {skala, fizyka (1/0), płasko (1/0), kolor promienia}. */
	public static final float[] NO_ITEM = {1f, 0f, 0f, 0f};
	public static float[] item = NO_ITEM;

	private static boolean darkActive, tooltipPushed;
	/** Motion blur potrzebuje obrazu z poprzedniej klatki — efekty gry 1.21.2–1.21.5 go nie przechowują. */
	//#if MC >= 1.21.6
	static final boolean BLUR = true;
	//#elif MC >= 1.21.2
	static final boolean BLUR = false;
	//#else
	static final boolean BLUR = true;
	//#endif
	private static final Set<String> UHC = new HashSet<>(Arrays.asList("gold_ingot", "gold_nugget", "raw_gold", "gold_block", "apple", "golden_apple",
			"enchanted_golden_apple", "golden_carrot", "player_head"));

	private Looks() {
	}

	private static MibClient mib() {
		return MibClient.get();
	}

	private static boolean on(String id) {
		MibClient m = mib();
		return m != null && m.modules != null && m.modules.isOn(id);
	}

	static void register() {
		ScreenEvents.AFTER_INIT.register((client, screen, width, height) -> {
			if (!(screen instanceof AbstractContainerScreen)) return;
			//#if MC >= 26.1
			ScreenEvents.beforeExtract(screen).register((s, g, mx, my, d) -> darkActive = on("dark_mode"));
			ScreenEvents.afterExtract(screen).register((s, g, mx, my, d) -> darkActive = false);
			//#else
			ScreenEvents.beforeRender(screen).register((s, g, mx, my, d) -> darkActive = on("dark_mode"));
			ScreenEvents.afterRender(screen).register((s, g, mx, my, d) -> darkActive = false);
			//#endif
		});
	}

	// ===== Dark mode =====

	/** Kolor tekstury okna z przedmiotami: przyciemniony z fioletem (Dark mode) albo bez zmian. */
	public static int darken(int argb) {
		if (!darkActive) return argb;
		MibClient.hooks.add("dark_mode");
		int r = (argb >> 16) & 0xFF, g = (argb >> 8) & 0xFF, b = argb & 0xFF;
		return (argb & 0xFF000000) | (r * 30 / 100) << 16 | (g * 27 / 100) << 8 | (b * 36 / 100);
	}

	/** Napisy w oknie (tytuł, „Ekwipunek”): jasne na ciemnym tle. */
	public static int label(int color) {
		if (!darkActive) return color;
		return (color & 0xFF000000) | 0xE6DDF0;
	}

	// ===== Tooltips =====

	public static void tooltipStart(MibGraphics g, int x, int y) {
		tooltipPushed = false;
		if (!on("tooltips")) return;
		int s = mib().intOpt("tooltips", "scale");
		if (s == 100) return;
		MibClient.hooks.add("tooltips");
		FabricCanvas.pushTransform(g, s / 100f, x, y, 0, 0);
		tooltipPushed = true;
	}

	public static void tooltipEnd(MibGraphics g) {
		if (tooltipPushed) FabricCanvas.popTransform(g);
		tooltipPushed = false;
	}

	// ===== Leżące przedmioty: Item physic, UHC overlay, Loot beams =====

	/** Dane rysowania przedmiotu liczone z jego ItemEntity. */
	public static float[] itemInfo(ItemEntity e) {
		if (e == null) return NO_ITEM;
		ItemStack s = e.getItem();
		String id = BuiltInRegistries.ITEM.getKey(s.getItem()).getPath();
		float scale = on("uhc_overlay") && UHC.contains(id) ? mib().intOpt("uhc_overlay", "scale") / 100f : 1f;
		boolean physic = on("item_physic");
		int beam = 0;
		if (on("loot_beams")) {
			String r = s.getRarity().name();
			int c = "UNCOMMON".equals(r) ? 0xFFFF55 : "RARE".equals(r) ? 0x55FFFF : "EPIC".equals(r) ? 0xFF55FF : 0xFFFFFF;
			if (!"COMMON".equals(r) || mib().boolOpt("loot_beams", "common")) beam = 0xFF000000 | c;
		}
		if (scale == 1f && !physic && beam == 0) return NO_ITEM;
		return new float[] {scale, physic ? 1f : 0f, physic && !(s.getItem() instanceof BlockItem) ? 1f : 0f, Float.intBitsToFloat(beam)};
	}

	public static int beamColor() {
		return Float.floatToRawIntBits(item[3]);
	}

	public static int beamHeight() {
		return mib().intOpt("loot_beams", "height");
	}

	/** UHC overlay: powiększenie tuż po pushPose rysowania przedmiotu. */
	public static void itemScale(PoseStack pose) {
		float s = item[0];
		if (s == 1f) return;
		MibClient.hooks.add("uhc_overlay");
		pose.scale(s, s, s);
	}

	/** Item physic: bez podskakiwania (sinus = -1, czyli najniżej). */
	public static boolean physic() {
		if (item[1] == 0f) return false;
		MibClient.hooks.add("item_physic");
		return true;
	}

	public static boolean flat() {
		return item[2] != 0f;
	}

	// ===== Block overlay =====

	public static int outlineColor(int color) {
		if (!on("block_overlay")) return color;
		MibClient.hooks.add("block_overlay");
		return ((Setting.ColorSetting) mib().modules.def("block_overlay").setting("color")).get(mib().modules.state("block_overlay"));
	}

	public static float outlineWidth(float w) {
		if (!on("block_overlay")) return w;
		return w * mib().intOpt("block_overlay", "thickness") / 2f;
	}

	// ===== Hitbox =====

	public static boolean hideHitbox(Entity e) {
		return on("hitbox") && mib().boolOpt("hitbox", "players") && !(e instanceof Player);
	}

	public static boolean hideHitboxState(Object state) {
		if (!on("hitbox") || !mib().boolOpt("hitbox", "players")) return false;
		//#if MC >= 1.21.9
		return !(state instanceof net.minecraft.client.renderer.entity.state.AvatarRenderState);
		//#elif MC >= 1.21.2
		return !(state instanceof net.minecraft.client.renderer.entity.state.PlayerRenderState);
		//#else
		return false;
		//#endif
	}

	/** Kolor ramki hitboxu (ARGB); białe ramki gry dostają kolor z ustawień. */
	public static int hitboxColor(int argb) {
		if (!on("hitbox") || (argb & 0xFFFFFF) != 0xFFFFFF) return argb;
		MibClient.hooks.add("hitbox");
		return ((Setting.ColorSetting) mib().modules.def("hitbox").setting("color")).get(mib().modules.state("hitbox"));
	}

	public static float hitboxChannel(float v, int shift) {
		if (!on("hitbox")) return v;
		MibClient.hooks.add("hitbox");
		int c = ((Setting.ColorSetting) mib().modules.def("hitbox").setting("color")).get(mib().modules.state("hitbox"));
		return ((c >> shift) & 0xFF) / 255f;
	}

	static void tickHitboxes(Minecraft c) {
		//#if MC < 1.21.9
		if (on("hitbox") && mib().boolOpt("hitbox", "always")) c.getEntityRenderDispatcher().setRenderHitBoxes(true);
		//#endif
	}

	// ===== Custom fog =====

	public static boolean noFog(FogType type) {
		if (!on("custom_fog")) return false;
		boolean fluid = type == FogType.WATER || type == FogType.LAVA;
		boolean r = fluid ? mib().boolOpt("custom_fog", "fluids") : type == FogType.NONE && mib().boolOpt("custom_fog", "terrain");
		if (r) MibClient.hooks.add("custom_fog");
		return r;
	}

	// ===== Animations (1.7) =====

	public static boolean noDip() {
		if (!on("animations") || !mib().boolOpt("animations", "no_dip")) return false;
		MibClient.hooks.add("anim_dip");
		return true;
	}

	/** Blok mieczem: miecz w głównej ręce, przytrzymany prawy przycisk i postać nic nie używa (jak w 1.8). */
	public static void swordBlock(PoseStack pose, HumanoidArm arm) {
		Minecraft c = Minecraft.getInstance();
		if (!on("animations") || !mib().boolOpt("animations", "block") || c.player == null || arm != c.player.getMainArm()) return;
		if (!c.options.keyUse.isDown() || c.player.isUsingItem() || Input.screen(c) != null) return;
		if (!BuiltInRegistries.ITEM.getKey(c.player.getMainHandItem().getItem()).getPath().endsWith("_sword")) return;
		MibClient.hooks.add("anim_block");
		int i = arm == HumanoidArm.RIGHT ? 1 : -1;
		pose.translate(i * -0.14142136f, 0.08f, 0.14142136f);
		//#if MC >= 26.3
		pose.rotate(Axis.XP, (float) Math.toRadians(-102.25));
		pose.rotate(Axis.YP, (float) Math.toRadians(i * 13.365));
		pose.rotate(Axis.ZP, (float) Math.toRadians(i * 78.05));
		//#else
		pose.mulPose(Axis.XP.rotationDegrees(-102.25f));
		pose.mulPose(Axis.YP.rotationDegrees(i * 13.365f));
		pose.mulPose(Axis.ZP.rotationDegrees(i * 78.05f));
		//#endif
	}

	// ===== Elytras, Emotes =====

	public static boolean hideElytra(boolean self) {
		if (!self || !on("elytras") || !mib().boolOpt("elytras", "hide")) return false;
		MibClient.hooks.add("elytra");
		return true;
	}

	public static boolean capeOnElytra() {
		return on("elytras") && mib().boolOpt("elytras", "cape");
	}

	public static float[] emote() {
		MibClient m = mib();
		return m == null || m.extras == null ? null : m.extras.emoteArms();
	}

	// ===== Color saturation, Motion blur =====

	private static String postTried, postVerified;
	private static int postAttempts;

	/** Co tick: włącza efekt MiB (gdy kamera jest w graczu, a nie np. w mobie w trybie widza) albo go wyłącza. */
	static void tickPost(Minecraft c) {
		String want = postEffect();
		if (want == null) postTried = postVerified = null;
		boolean self = c.player != null && c.getCameraEntity() == c.player;
		net.minecraft.client.renderer.GameRenderer gr = c.gameRenderer;
		//#if MC >= 26.3
		MibId cur = gr.spectatedEntityPostEffect();
		String now = cur == null ? null : cur.toString();
		//#elif MC >= 1.21.2
		MibId cur = gr.currentPostEffect();
		String now = cur == null ? null : cur.toString();
		//#else
		net.minecraft.client.renderer.PostChain chain = gr.currentEffect();
		String now = chain == null ? null : chain.getName();
		//#endif
		if (want != null && self) {
			//#if MC >= 1.21.2
			String id = "mibclient:" + want;
			//#else
			String id = "mibclient:shaders/post/" + want + ".json";
			//#endif
			MibClient.hooks.add("post_effect");
			if (id.equals(now)) {
				if (!id.equals(postVerified)) {
					postVerified = id;
					if (postLoads(c, id)) MibClient.hooks.add("post_ok");
					else {
						MibClient.LOG.warn("MiB: efekt {} nie wczytał się", id);
						postAttempts = 99;
						clearPost(gr);
					}
				}
				return;
			}
			if (!id.equals(postTried)) {
				postTried = id;
				postAttempts = 0;
			}
			if (postAttempts++ < 3) ((pl.mibclient.mod.fabric.mixin.GameRendererAccessor) gr).mib$setPostEffect(MibId.parse(id));
		} else if (now != null && now.startsWith("mibclient:")) clearPost(gr);
	}

	private static void clearPost(net.minecraft.client.renderer.GameRenderer gr) {
		//#if MC >= 26.3
		gr.clearSpectatedEntityPostEffect();
		//#elif MC >= 1.21.2
		gr.clearPostEffect();
		//#else
		gr.shutdownEffect();
		//#endif
	}

	/** Czy łańcuch efektu da się wczytać (shadery skompilowane); do 1.21.1 gra wczytuje go od razu przy włączaniu. */
	private static boolean postLoads(Minecraft c, String id) {
		//#if MC >= 1.21.2
		try {
			return c.getShaderManager().getPostChain(MibId.parse(id), net.minecraft.client.renderer.LevelTargetBundle.MAIN_TARGETS) != null;
		} catch (Exception e) {
			return false;
		}
		//#else
		return true;
		//#endif
	}

	/** Efekt pełnoekranowy MiB do włączenia: mib_s&lt;nasycenie&gt;_b&lt;rozmycie&gt; albo null. */
	static String postEffect() {
		int s = 0, b = 0;
		if (on("color_saturation")) {
			String l = ((Setting.ChoiceSetting) mib().modules.def("color_saturation").setting("level")).get(mib().modules.state("color_saturation"));
			s = "gray".equals(l) ? 1 : "low".equals(l) ? 2 : "max".equals(l) ? 4 : 3;
		}
		if (BLUR && on("motion_blur")) {
			String l = ((Setting.ChoiceSetting) mib().modules.def("motion_blur").setting("strength")).get(mib().modules.state("motion_blur"));
			b = "low".equals(l) ? 1 : "high".equals(l) ? 3 : 2;
		}
		return s == 0 && b == 0 ? null : "mib_s" + s + "_b" + b;
	}
}
