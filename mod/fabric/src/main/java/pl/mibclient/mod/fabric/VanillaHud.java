package pl.mibclient.mod.fabric;

import net.minecraft.client.gui.MibGraphics;
import net.minecraft.client.gui.components.toasts.AdvancementToast;
import net.minecraft.client.gui.components.toasts.RecipeToast;
import net.minecraft.client.gui.components.toasts.SystemToast;
import net.minecraft.client.gui.components.toasts.Toast;
import net.minecraft.client.gui.components.toasts.TutorialToast;
import net.minecraft.client.multiplayer.ClientLevel;
import net.minecraft.resources.MibId;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.level.Level;
import pl.mibclient.mod.core.Setting;

/**
 * Zmiany w elementach gry (nie w HUD MiB): nasycenie na ikonach jedzenia, Boss bar, Scoreboard, powiadomienia
 * (Toast control) i pogoda (Weather changer). Wołane z wstawek w grę.
 */
public final class VanillaHud {
	private static final MibId SATURATION = MibId.fromNamespaceAndPath("mibclient", "textures/gui/saturation.png");
	private static boolean scorePushed, bossPushed;

	private VanillaHud() {
	}

	private static MibClient mib() {
		return MibClient.get();
	}

	private static boolean on(String id) {
		return mib() != null && mib().modules.isOn(id);
	}

	/**
	 * Saturation: każda ikona jedzenia to 2 punkty nasycenia; pełne punkty dostają lekko pomarańczowy środek,
	 * a ostatnia ikona tylko tyle, ile zostało (maleje razem z nasyceniem). Ikony liczone od prawej, jak w grze.
	 */
	public static void saturation(MibGraphics g, Player player, int top, int right) {
		if (!on("saturation") || player == null) return;
		MibClient.hooks.add("saturation");
		float sat = player.getFoodData().getSaturationLevel();
		int color = ((Setting.ColorSetting) mib().modules.def("saturation").setting("color")).get(mib().modules.state("saturation"));
		for (int i = 0; i < 10; i++) {
			float f = Math.min(1f, sat / 2f - i);
			if (f <= 0) break;
			int w = Math.max(1, Math.round(9 * f));
			FabricCanvas.blit(g, SATURATION, right - i * 8 - 9, top, 0, 0, w, 9, 9, 9, color);
		}
	}

	/** Scoreboard: false = schowany; skala i przesunięcie wokół prawej krawędzi ekranu. */
	public static boolean scoreboardStart(MibGraphics g) {
		scorePushed = false;
		if (!on("scoreboard")) return true;
		MibClient.hooks.add("scoreboard");
		if (mib().boolOpt("scoreboard", "hide")) return false;
		float scale = mib().intOpt("scoreboard", "scale") / 100f;
		int dy = mib().intOpt("scoreboard", "offset_y");
		if (scale != 1f || dy != 0) {
			FabricCanvas.pushTransform(g, scale, g.guiWidth(), g.guiHeight() / 2, 0, dy);
			scorePushed = true;
		}
		return true;
	}

	public static void scoreboardEnd(MibGraphics g) {
		if (scorePushed) FabricCanvas.popTransform(g);
		scorePushed = false;
	}

	/** Boss bar: false = schowany; skala i przesunięcie wokół środka górnej krawędzi. */
	public static boolean bossStart(MibGraphics g) {
		bossPushed = false;
		if (!on("boss_bar")) return true;
		MibClient.hooks.add("boss_bar");
		if (mib().boolOpt("boss_bar", "hide")) return false;
		float scale = mib().intOpt("boss_bar", "scale") / 100f;
		int dy = mib().intOpt("boss_bar", "offset_y");
		if (scale != 1f || dy != 0) {
			FabricCanvas.pushTransform(g, scale, g.guiWidth() / 2, 0, 0, dy);
			bossPushed = true;
		}
		return true;
	}

	public static void bossEnd(MibGraphics g) {
		if (bossPushed) FabricCanvas.popTransform(g);
		bossPushed = false;
	}

	/** Toast control: czy schować to powiadomienie. */
	public static boolean hideToast(Toast t) {
		if (!on("toast_control")) return false;
		MibClient m = mib();
		if (t instanceof RecipeToast) return m.boolOpt("toast_control", "recipes");
		if (t instanceof AdvancementToast) return m.boolOpt("toast_control", "advancements");
		if (t instanceof TutorialToast) return m.boolOpt("toast_control", "tutorial");
		if (t instanceof SystemToast) return m.boolOpt("toast_control", "system");
		return false;
	}

	/** Weather changer: deszcz (thunder = false) albo burza dla świata gracza; null = jak na serwerze. */
	public static Float weather(Level level, boolean thunder) {
		if (!(level instanceof ClientLevel) || !on("weather_changer")) return null;
		MibClient.hooks.add("weather");
		String w = ((Setting.ChoiceSetting) mib().modules.def("weather_changer").setting("weather")).get(mib().modules.state("weather_changer"));
		if ("thunder".equals(w)) return 1f;
		if ("rain".equals(w)) return thunder ? 0f : 1f;
		return 0f;
	}
}
