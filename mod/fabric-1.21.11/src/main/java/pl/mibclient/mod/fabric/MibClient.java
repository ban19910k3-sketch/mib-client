package pl.mibclient.mod.fabric;

import java.io.File;
import java.util.Collections;
import java.util.List;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayConnectionEvents;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.network.ServerInfo;
import net.minecraft.client.option.GameOptions;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import net.minecraft.util.Identifier;
import org.lwjgl.glfw.GLFW;
import pl.mibclient.mod.core.Account;
import pl.mibclient.mod.core.Config;
import pl.mibclient.mod.core.HudEditorModel;
import pl.mibclient.mod.core.HudView;
import pl.mibclient.mod.core.Lang;
import pl.mibclient.mod.core.LauncherBridge;
import pl.mibclient.mod.core.MenuActions;
import pl.mibclient.mod.core.ModuleCatalog;
import pl.mibclient.mod.core.ModuleDef;
import pl.mibclient.mod.core.ModuleManager;
import pl.mibclient.mod.core.ModuleState;
import pl.mibclient.mod.core.ServerRules;
import pl.mibclient.mod.core.Setting;
import pl.mibclient.mod.core.modules.CpsCounter;
import pl.mibclient.mod.core.modules.CrosshairShape;
import pl.mibclient.mod.core.modules.ZoomState;

/** Mod MiB dla 1.21.11: menu pod prawym Shiftem, HUD, edytor HUD i moduły etapu 1. */
public final class MibClient implements ClientModInitializer, MenuActions {
	private static MibClient instance;

	public static MibClient get() {
		return instance;
	}

	public Config config;
	public ModuleManager modules;
	public HudView hud;
	public HudEditorModel editor;
	public FabricGameInfo info;
	public LauncherBridge bridge;
	public final CpsCounter left = new CpsCounter(), right = new CpsCounter();
	public final ZoomState zoom = new ZoomState();
	public KeyBinding menuKey, zoomKey;

	private final long sessionStart = System.currentTimeMillis();
	private boolean optionsApplied;
	private Boolean cinematicBefore;
	private long lastFrameNanos;
	private List<Account> accountsCache = Collections.emptyList();
	private long accountsReadAt, switchAt, failureCheckedAt;
	private String switchMessage;

	@Override
	public void onInitializeClient() {
		instance = this;
		String dir = System.getProperty("mib.dir");
		File base = dir != null ? new File(dir) : FabricLoader.getInstance().getGameDir().resolve("mib").toFile();
		config = Config.load(new File(base, Config.FILE_NAME));
		modules = new ModuleManager(config, ModuleCatalog.STAGE1);
		hud = new HudView(modules);
		editor = new HudEditorModel(modules);
		info = new FabricGameInfo(this, sessionStart);
		bridge = dir != null ? new LauncherBridge(base) : null;

		KeyBinding.Category cat = KeyBinding.Category.create(Identifier.of("mibclient", "main"));
		menuKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.mibclient.menu", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_RIGHT_SHIFT, cat));
		zoomKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.mibclient.zoom", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_C, cat));

		HudElementRegistry.addLast(Identifier.of("mibclient", "hud"), (ctx, tick) -> renderHud(ctx));
		ClientTickEvents.END_CLIENT_TICK.register(this::tick);
		ClientPlayConnectionEvents.JOIN.register((handler, sender, client) -> {
			ServerInfo s = client.getCurrentServerEntry();
			modules.setBlocked(ServerRules.builtIn().blockedFor(s == null ? null : s.address));
		});
		ClientPlayConnectionEvents.DISCONNECT.register((handler, client) -> modules.setBlocked(Collections.<String>emptySet()));
		modules.addListener((id, on) -> {
			if ("toggle_sprint".equals(id)) applySprint();
		});
	}

	private void tick(MinecraftClient c) {
		Lang.setGame(c.getLanguageManager().getLanguage());
		if (!optionsApplied && c.options != null) {
			optionsApplied = true;
			applySprint();
		}
		while (menuKey.wasPressed()) {
			if (c.currentScreen == null) c.setScreen(new MenuScreen(this, null));
		}
		zoom.setBase(intOpt("zoom", "factor"));
		boolean zooming = modules.isOn("zoom") && zoomKey.isPressed() && c.currentScreen == null;
		zoom.setHeld(zooming);
		if (zooming && boolOpt("zoom", "cinematic") && cinematicBefore == null) {
			cinematicBefore = c.options.smoothCameraEnabled;
			c.options.smoothCameraEnabled = true;
		} else if (!zooming && cinematicBefore != null) {
			c.options.smoothCameraEnabled = cinematicBefore;
			cinematicBefore = null;
		}
	}

	private void renderHud(DrawContext ctx) {
		MinecraftClient c = MinecraftClient.getInstance();
		if (c.currentScreen instanceof HudEditorScreen) return;
		hud.render(new FabricCanvas(ctx, c.textRenderer), info, ctx.getScaledWindowWidth(), ctx.getScaledWindowHeight(), null, false);
	}

	// ===== Moduły z wstawkami w grę =====

	public int intOpt(String id, String key) {
		ModuleDef d = modules.def(id);
		return ((Setting.IntSetting) d.setting(key)).get(modules.state(id));
	}

	public boolean boolOpt(String id, String key) {
		ModuleDef d = modules.def(id);
		return ((Setting.BoolSetting) d.setting(key)).get(modules.state(id));
	}

	/** Pole widzenia z FOV changer i Zoom (wołane z GameRendererMixin dla widoku świata). */
	public float modifyFov(float fov) {
		MinecraftClient c = MinecraftClient.getInstance();
		float out = fov;
		if (modules.isOn("fov_changer")) out = out * intOpt("fov_changer", "fov") / Math.max(1, c.options.getFov().getValue());
		long now = System.nanoTime();
		float dt = lastFrameNanos == 0 ? 0 : Math.min(0.25f, (now - lastFrameNanos) / 1e9f);
		lastFrameNanos = now;
		return out * zoom.fovMultiplier(dt, boolOpt("zoom", "smooth"));
	}

	/** FOV changer z „bez zmian przy biegu i miksturach”: stały mnożnik 1. */
	public boolean fixedFovMultiplier() {
		return modules.isOn("fov_changer") && boolOpt("fov_changer", "no_effects");
	}

	/** Jasność z Brightness albo null, gdy moduł wyłączony (gamma Minecrafta to 0..1, 15 = pełna jasność). */
	public Double gammaOverride() {
		return modules.isOn("brightness") ? intOpt("brightness", "level") / 100.0 * 15.0 : null;
	}

	public void onMouseButton(int button, int action) {
		MinecraftClient c = MinecraftClient.getInstance();
		if (action != GLFW.GLFW_PRESS || c.currentScreen != null || c.player == null) return;
		long now = System.currentTimeMillis();
		if (button == GLFW.GLFW_MOUSE_BUTTON_LEFT) left.click(now);
		else if (button == GLFW.GLFW_MOUSE_BUTTON_RIGHT) right.click(now);
	}

	/** Kółko podczas zoomu zmienia przybliżenie zamiast slotu; true = zdarzenie zużyte. */
	public boolean onScroll(double vertical) {
		MinecraftClient c = MinecraftClient.getInstance();
		if (c.currentScreen != null || !zoom.active() || !boolOpt("zoom", "scroll") || vertical == 0) return false;
		zoom.scroll(Math.signum(vertical));
		return true;
	}

	/** Celownik z Custom crosshair zamiast obrazka z gry (wołane z InGameHudMixin); false = rysuje gra. */
	public boolean drawCrosshair(DrawContext ctx) {
		if (!modules.isOn("custom_crosshair")) return false;
		ModuleDef d = modules.def("custom_crosshair");
		ModuleState st = modules.state("custom_crosshair");
		String shape = ((Setting.ChoiceSetting) d.setting("shape")).get(st);
		int color = ((Setting.ColorSetting) d.setting("color")).get(st);
		int cx = ctx.getScaledWindowWidth() / 2, cy = ctx.getScaledWindowHeight() / 2;
		for (int[] r : CrosshairShape.rects(shape, intOpt("custom_crosshair", "size"), intOpt("custom_crosshair", "thickness"),
				intOpt("custom_crosshair", "gap"), boolOpt("custom_crosshair", "dot"), boolOpt("custom_crosshair", "outline"))) {
			ctx.fill(cx + r[0], cy + r[1], cx + r[2], cy + r[3], r[4] == 1 ? 0xFF000000 : color);
		}
		return true;
	}

	/** Toggle sprint korzysta z przełączania w opcjach Minecrafta; po wyłączeniu przywraca poprzednie ustawienie gracza. */
	private void applySprint() {
		MinecraftClient c = MinecraftClient.getInstance();
		if (c == null || c.options == null) return;
		GameOptions o = c.options;
		ModuleState st = modules.state("toggle_sprint");
		if (modules.isOn("toggle_sprint")) {
			if (!(st.option("prev_sprint") instanceof Boolean)) {
				st.setOption("prev_sprint", o.getSprintToggled().getValue());
				st.setOption("prev_sneak", o.getSneakToggled().getValue());
				config.save();
			}
			o.getSprintToggled().setValue(boolOpt("toggle_sprint", "sprint"));
			o.getSneakToggled().setValue(boolOpt("toggle_sprint", "sneak"));
		} else if (st.option("prev_sprint") instanceof Boolean) {
			o.getSprintToggled().setValue((Boolean) st.option("prev_sprint"));
			o.getSneakToggled().setValue(Boolean.TRUE.equals(st.option("prev_sneak")));
			st.setOption("prev_sprint", null);
			st.setOption("prev_sneak", null);
			config.save();
		}
	}

	// ===== MenuActions =====

	@Override
	public void openHudEditor(String moduleId) {
		MinecraftClient.getInstance().setScreen(new HudEditorScreen(this));
	}

	/** Konta z launchera; plik czytany najwyżej co 2 s, bo menu pyta o nie w każdej klatce. */
	@Override
	public List<Account> accounts() {
		if (bridge == null) return Collections.emptyList();
		long now = System.currentTimeMillis();
		if (now - accountsReadAt > 2000) {
			accountsCache = bridge.accounts();
			accountsReadAt = now;
		}
		return accountsCache;
	}

	@Override
	public void switchAccount(String id) {
		if (bridge == null) return;
		switchAt = System.currentTimeMillis();
		bridge.requestSwitch(id);
		switchMessage = Lang.t("acc.working");
	}

	@Override
	public String switchMessage() {
		long now = System.currentTimeMillis();
		if (bridge != null && switchAt > 0 && now - failureCheckedAt > 500) {
			failureCheckedAt = now;
			String f = bridge.failure(switchAt - 1);
			if (f != null) switchMessage = Lang.t("acc.failed", f);
		}
		return switchMessage;
	}
}
