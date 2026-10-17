package pl.mibclient.mod.fabric;

import com.mojang.blaze3d.platform.InputConstants;
import java.io.File;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayConnectionEvents;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.Options;
import net.minecraft.client.gui.MibGraphics;
import net.minecraft.client.multiplayer.ServerData;
import net.minecraft.resources.MibId;
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
//#if MC >= 26.1
import net.fabricmc.fabric.api.client.keymapping.v1.KeyMappingHelper;
//#else
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
//#endif
//#if MC >= 1.21.6
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
//#else
import net.fabricmc.fabric.api.client.rendering.v1.HudRenderCallback;
//#endif

/** Mod MiB: menu pod prawym Shiftem, HUD, edytor HUD i moduły etapu 1 (jedno źródło dla 1.21–26.x). */
public final class MibClient implements ClientModInitializer, MenuActions {
	private static MibClient instance;

	public static MibClient get() {
		return instance;
	}

	/** Wstawki w grę, które zadziałały w tej sesji (sprawdza je automatyczny test gry). */
	public static final Set<String> hooks = ConcurrentHashMap.newKeySet();

	public Config config;
	public ModuleManager modules;
	public HudView hud;
	public HudEditorModel editor;
	public FabricGameInfo info;
	public LauncherBridge bridge;
	public final CpsCounter left = new CpsCounter(), right = new CpsCounter();
	public final ZoomState zoom = new ZoomState();
	public KeyMapping menuKey, zoomKey;

	private final long sessionStart = System.currentTimeMillis();
	private boolean optionsApplied;
	private Boolean cinematicBefore;
	private long lastFrameNanos;
	private List<Account> accountsCache = Collections.emptyList();
	private long accountsReadAt, switchAt, failureCheckedAt;
	private String switchMessage;
	private final SmokeTest smoke = System.getProperty("mib.smoketest") != null ? new SmokeTest() : null;

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

		//#if MC >= 1.21.9
		KeyMapping.Category cat = KeyMapping.Category.register(MibId.fromNamespaceAndPath("mibclient", "main"));
		//#else
		String cat = "key.category.mibclient.main";
		//#endif
		menuKey = register(new KeyMapping("key.mibclient.menu", InputConstants.KEY_RSHIFT, cat));
		zoomKey = register(new KeyMapping("key.mibclient.zoom", InputConstants.KEY_C, cat));

		//#if MC >= 1.21.6
		HudElementRegistry.addLast(MibId.fromNamespaceAndPath("mibclient", "hud"), (g, tick) -> renderHud(g));
		//#else
		HudRenderCallback.EVENT.register((g, tick) -> renderHud(g));
		//#endif
		ClientTickEvents.END_CLIENT_TICK.register(this::tick);
		Logo.register();
		ClientPlayConnectionEvents.JOIN.register((handler, sender, client) -> {
			ServerData s = client.getCurrentServer();
			modules.setBlocked(ServerRules.builtIn().blockedFor(s == null ? null : s.ip));
		});
		ClientPlayConnectionEvents.DISCONNECT.register((handler, client) -> modules.setBlocked(Collections.<String>emptySet()));
		modules.addListener((id, on) -> {
			if ("toggle_sprint".equals(id)) applySprint();
		});
	}

	private static KeyMapping register(KeyMapping k) {
		//#if MC >= 26.1
		return KeyMappingHelper.registerKeyMapping(k);
		//#else
		return KeyBindingHelper.registerKeyBinding(k);
		//#endif
	}

	/** Klawisz przypisany w ustawieniach sterowania. */
	public static InputConstants.Key boundKeyOf(KeyMapping k) {
		//#if MC >= 26.1
		return KeyMappingHelper.getBoundKeyOf(k);
		//#else
		return KeyBindingHelper.getBoundKeyOf(k);
		//#endif
	}

	public static int boundKey(KeyMapping k) {
		return boundKeyOf(k).getValue();
	}

	private void tick(Minecraft c) {
		Lang.setGame(c.getLanguageManager().getSelected());
		if (!optionsApplied && c.options != null) {
			optionsApplied = true;
			applySprint();
		}
		while (menuKey.consumeClick()) {
			if (Input.screen(c) == null) Input.open(c, new MenuScreen(this, null));
		}
		zoom.setBase(intOpt("zoom", "factor"));
		boolean zooming = modules.isOn("zoom") && Input.screen(c) == null && Input.held(c, zoomKey);
		zoom.setHeld(zooming);
		if (zooming && boolOpt("zoom", "cinematic") && cinematicBefore == null) {
			cinematicBefore = c.options.smoothCamera;
			c.options.smoothCamera = true;
		} else if (!zooming && cinematicBefore != null) {
			c.options.smoothCamera = cinematicBefore;
			cinematicBefore = null;
		}
		if (smoke != null) smoke.tick(c);
	}

	private void renderHud(MibGraphics g) {
		Minecraft c = Minecraft.getInstance();
		if (Input.screen(c) instanceof HudEditorScreen) return;
		hud.render(new FabricCanvas(g, c.font), info, g.guiWidth(), g.guiHeight(), null, false);
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
		hooks.add("fov");
		Minecraft c = Minecraft.getInstance();
		float out = fov;
		if (modules.isOn("fov_changer")) out = out * intOpt("fov_changer", "fov") / Math.max(1, c.options.fov().get());
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
		hooks.add("gamma");
		return modules.isOn("brightness") ? intOpt("brightness", "level") / 100.0 * 15.0 : null;
	}

	public void onMouseButton(int button, int action) {
		hooks.add("click");
		Minecraft c = Minecraft.getInstance();
		if (action != InputConstants.PRESS || Input.screen(c) != null || c.player == null) return;
		long now = System.currentTimeMillis();
		if (button == InputConstants.MOUSE_BUTTON_LEFT) left.click(now);
		else if (button == InputConstants.MOUSE_BUTTON_RIGHT) right.click(now);
	}

	/** Kółko podczas zoomu zmienia przybliżenie zamiast slotu; true = zdarzenie zużyte. */
	public boolean onScroll(double vertical) {
		Minecraft c = Minecraft.getInstance();
		if (Input.screen(c) != null || !zoom.active() || !boolOpt("zoom", "scroll") || vertical == 0) return false;
		zoom.scroll(Math.signum(vertical));
		return true;
	}

	/** Celownik z Custom crosshair zamiast obrazka z gry (wołane z GuiMixin); false = rysuje gra. */
	public boolean drawCrosshair(MibGraphics g) {
		if (!modules.isOn("custom_crosshair")) return false;
		hooks.add("crosshair");
		ModuleDef d = modules.def("custom_crosshair");
		ModuleState st = modules.state("custom_crosshair");
		String shape = ((Setting.ChoiceSetting) d.setting("shape")).get(st);
		int color = ((Setting.ColorSetting) d.setting("color")).get(st);
		int cx = g.guiWidth() / 2, cy = g.guiHeight() / 2;
		for (int[] r : CrosshairShape.rects(shape, intOpt("custom_crosshair", "size"), intOpt("custom_crosshair", "thickness"),
				intOpt("custom_crosshair", "gap"), boolOpt("custom_crosshair", "dot"), boolOpt("custom_crosshair", "outline"))) {
			g.fill(cx + r[0], cy + r[1], cx + r[2], cy + r[3], r[4] == 1 ? 0xFF000000 : color);
		}
		return true;
	}

	/** Toggle sprint korzysta z przełączania w opcjach Minecrafta; po wyłączeniu przywraca poprzednie ustawienie gracza. */
	private void applySprint() {
		Minecraft c = Minecraft.getInstance();
		if (c == null || c.options == null) return;
		Options o = c.options;
		ModuleState st = modules.state("toggle_sprint");
		if (modules.isOn("toggle_sprint")) {
			if (!(st.option("prev_sprint") instanceof Boolean)) {
				st.setOption("prev_sprint", o.toggleSprint().get());
				st.setOption("prev_sneak", o.toggleCrouch().get());
				config.save();
			}
			o.toggleSprint().set(boolOpt("toggle_sprint", "sprint"));
			o.toggleCrouch().set(boolOpt("toggle_sprint", "sneak"));
		} else if (st.option("prev_sprint") instanceof Boolean) {
			o.toggleSprint().set((Boolean) st.option("prev_sprint"));
			o.toggleCrouch().set(Boolean.TRUE.equals(st.option("prev_sneak")));
			st.setOption("prev_sprint", null);
			st.setOption("prev_sneak", null);
			config.save();
		}
	}

	// ===== MenuActions =====

	@Override
	public void openHudEditor(String moduleId) {
		Input.open(Minecraft.getInstance(), new HudEditorScreen(this));
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

	/**
	 * Test uruchomienia dla wersji bez testu klienta Fabric (-Dmib.smoketest): po wczytaniu gry otwiera menu
	 * i edytor HUD, wczytuje klasy z wstawkami (błąd wstawki = awaria), wypisuje [MIB-SMOKE] ok i zamyka grę.
	 */
	private final class SmokeTest {
		private int ticks, step;

		void tick(Minecraft c) {
			//#if MC >= 26.2
			boolean loading = false;
			//#else
			boolean loading = c.getOverlay() != null;
			//#endif
			if (step == 0 && (loading || Input.screen(c) == null)) return;
			if (++ticks < 40) return;
			ticks = 0;
			switch (step++) {
				case 0:
					try {
						Class.forName("net.minecraft.client.player.AbstractClientPlayer");
					} catch (ClassNotFoundException e) {
						throw new IllegalStateException(e);
					}
					Input.open(c, new MenuScreen(MibClient.this, null));
					break;
				case 1:
					System.out.println("[MIB-SMOKE] menu " + (Input.screen(c) instanceof MenuScreen m && m.frames() > 0));
					openHudEditor(null);
					break;
				case 2:
					System.out.println("[MIB-SMOKE] hud " + (Input.screen(c) instanceof HudEditorScreen h && h.frames() > 0));
					System.out.println("[MIB-SMOKE] ok");
					c.stop();
					break;
				default:
					break;
			}
		}
	}
}
