package pl.mibclient.mod.fabric;

import com.mojang.blaze3d.platform.InputConstants;
import java.io.File;
import java.util.Collections;
import java.util.Base64;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayConnectionEvents;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.CameraType;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.Options;
import net.minecraft.client.gui.MibGraphics;
import com.mojang.blaze3d.platform.NativeImage;
import net.minecraft.client.multiplayer.ServerData;
import net.minecraft.client.player.AbstractClientPlayer;
import net.minecraft.client.renderer.texture.DynamicTexture;
import net.minecraft.resources.MibId;
import pl.mibclient.mod.core.Account;
import pl.mibclient.mod.core.Config;
import pl.mibclient.mod.core.Cosmetics;
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

/** Mod MiB: menu pod prawym Shiftem, HUD, edytor HUD, moduły etapów 1 i 2, gracze MiB (jedno źródło dla 1.21–26.x). */
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
	public Players players;
	public Pvp pvp;
	public KeyMapping menuKey, zoomKey, perspectiveKey, stopwatchKey;

	private final long sessionStart = System.currentTimeMillis();
	private boolean optionsApplied;
	private Boolean cinematicBefore;
	/** Perspective: kąty kamery niezależne od postaci i widok sprzed włączenia. */
	private boolean freeOn, freeToggled;
	private float freeYaw, freePitch;
	private CameraType cameraBefore;
	private long lastFrameNanos;
	private List<Account> accountsCache = Collections.emptyList();
	private long accountsReadAt, switchAt, failureCheckedAt;
	private String switchMessage;
	/** Kosmetyki z launchera (czytane najwyżej co 2 s) i zarejestrowana tekstura założonej peleryny. */
	private Cosmetics cosCache;
	private long cosReadAt, equipAt, cosFailCheckedAt;
	private String cosMessage, capeKey;
	private MibId capeTexture;
	private final SmokeTest smoke = System.getProperty("mib.smoketest") != null ? new SmokeTest() : null;

	@Override
	public void onInitializeClient() {
		instance = this;
		String dir = System.getProperty("mib.dir");
		File base = dir != null ? new File(dir) : FabricLoader.getInstance().getGameDir().resolve("mib").toFile();
		config = Config.load(new File(base, Config.FILE_NAME));
		modules = new ModuleManager(config, ModuleCatalog.ALL);
		hud = new HudView(modules);
		editor = new HudEditorModel(modules);
		info = new FabricGameInfo(this, sessionStart);
		bridge = dir != null ? new LauncherBridge(base) : null;
		players = new Players(this);
		pvp = new Pvp(this);

		//#if MC >= 1.21.9
		KeyMapping.Category cat = KeyMapping.Category.register(MibId.fromNamespaceAndPath("mibclient", "main"));
		//#else
		String cat = "key.category.mibclient.main";
		//#endif
		menuKey = register(new KeyMapping("key.mibclient.menu", InputConstants.KEY_RSHIFT, cat));
		zoomKey = register(new KeyMapping("key.mibclient.zoom", InputConstants.KEY_C, cat));
		perspectiveKey = register(new KeyMapping("key.mibclient.perspective", InputConstants.KEY_LALT, cat));
		stopwatchKey = register(new KeyMapping("key.mibclient.stopwatch", InputConstants.KEY_J, cat));

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
			pvp.reset();
		});
		ClientPlayConnectionEvents.DISCONNECT.register((handler, client) -> {
			modules.setBlocked(Collections.<String>emptySet());
			players.reset();
		});
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
		tickFreelook(c);
		tickCape(c);
		while (stopwatchKey.consumeClick()) {
			if (modules.isOn("stopwatch") && Input.screen(c) == null) pvp.meters.stopwatch.press(System.currentTimeMillis());
		}
		pvp.tick(c);
		players.tick(c);
		if (smoke != null) smoke.tick(c);
	}

	private void renderHud(MibGraphics g) {
		Minecraft c = Minecraft.getInstance();
		if (Input.screen(c) instanceof HudEditorScreen) return;
		FabricCanvas canvas = new FabricCanvas(g, c.font);
		hud.render(canvas, info, g.guiWidth(), g.guiHeight(), null, false);
		hud.overlay(canvas, info, g.guiWidth(), g.guiHeight());
	}

	/** Perspective: przy wejściu kamera z tyłu (trzecia osoba) zaczyna tam, gdzie patrzy postać; przy wyjściu wraca poprzedni widok. */
	private void tickFreelook(Minecraft c) {
		boolean hold = boolOpt("perspective", "hold");
		while (perspectiveKey.consumeClick()) if (!hold) freeToggled = !freeToggled;
		boolean want = modules.isOn("perspective") && c.player != null && Input.screen(c) == null
				&& (hold ? Input.held(c, perspectiveKey) : freeToggled);
		if (!modules.isOn("perspective") || c.player == null) freeToggled = false;
		if (want && !freeOn) {
			freeOn = true;
			freeYaw = c.player.getYRot();
			freePitch = c.player.getXRot();
			cameraBefore = c.options.getCameraType();
			c.options.setCameraType(CameraType.THIRD_PERSON_BACK);
		} else if (!want && freeOn) {
			freeOn = false;
			if (cameraBefore != null) c.options.setCameraType(cameraBefore);
		}
	}

	public boolean freelook() {
		if (freeOn) hooks.add("freelook");
		return freeOn;
	}

	public float freeYaw() {
		return freeYaw;
	}

	public float freePitch() {
		return freePitch;
	}

	/** Ruch myszy przy Perspective obraca kamerę (jak Entity.turn: 0,15° na jednostkę); true = postać się nie obraca. */
	public boolean turnCamera(double yRot, double xRot) {
		if (modules.isOn("mousestrokes")) pvp.meters.mouse.move(yRot, xRot, intOpt("mousestrokes", "sensitivity"), System.currentTimeMillis());
		if (!freeOn) return false;
		freeYaw += (float) yRot * 0.15f;
		freePitch = Math.max(-90f, Math.min(90f, freePitch + (float) xRot * 0.15f));
		return true;
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

	// ===== Kosmetyki =====

	/** Założona peleryna z launchera trafia do tekstury gry (tylko gdy się zmieni). */
	private void tickCape(Minecraft c) {
		Cosmetics cs = cosmetics();
		Cosmetics.Item cape = cs == null ? null : cs.equippedCape();
		if (cape == null || cape.png == null) {
			if (capeKey != null && !capeKey.startsWith("test:")) applyCape(null, null);
			return;
		}
		String key = cape.id + ":" + cape.png.hashCode();
		if (key.equals(capeKey)) return;
		try {
			applyCape(key, Base64.getDecoder().decode(cape.png));
		} catch (IllegalArgumentException e) {
			applyCape(null, null);
		}
	}

	/** Rejestruje teksturę peleryny (PNG 64×32) albo ją zdejmuje (png = null). Publiczne dla testu gry. */
	public void applyCape(String key, byte[] png) {
		if (Objects.equals(key, capeKey)) return;
		capeKey = key;
		releaseTexture(capeTexture);
		capeTexture = png == null ? null : registerTexture("cape/" + Integer.toHexString(key.hashCode()), png);
	}

	/** Tekstura z PNG pod mibclient:path albo null, gdy obrazek jest zły. */
	static MibId registerTexture(String path, byte[] png) {
		try {
			NativeImage img = NativeImage.read(png);
			MibId id = MibId.fromNamespaceAndPath("mibclient", path);
			//#if MC >= 1.21.5
			Minecraft.getInstance().getTextureManager().register(id, new DynamicTexture(() -> "mibclient " + path, img));
			//#else
			Minecraft.getInstance().getTextureManager().register(id, new DynamicTexture(img));
			//#endif
			return id;
		} catch (Exception e) {
			return null;
		}
	}

	static void releaseTexture(MibId id) {
		if (id != null) Minecraft.getInstance().getTextureManager().release(id);
	}

	/** Peleryna MiB dla tego gracza: własna założona albo innego gracza MiB (z launchera); null = peleryna ze skórki. */
	public MibId capeFor(AbstractClientPlayer player) {
		MibId t = player == Minecraft.getInstance().player ? capeTexture : players.capeOf(player.getUUID(), player.getScoreboardName());
		if (t != null) hooks.add("cape");
		return t;
	}

	@Override
	public Cosmetics cosmetics() {
		if (bridge == null) return null;
		long now = System.currentTimeMillis();
		if (now - cosReadAt > 2000) {
			Cosmetics c = bridge.cosmetics();
			if (c != null) cosCache = c;
			else if (cosCache == null) cosCache = Cosmetics.LOGGED_OUT;
			cosReadAt = now;
		}
		return cosCache;
	}

	@Override
	public void equip(String type, String id) {
		if (bridge == null) return;
		equipAt = System.currentTimeMillis();
		bridge.requestEquip(type, id);
		cosMessage = Lang.t("cos.working");
		cosReadAt = 0;
	}

	@Override
	public String cosmeticMessage() {
		long now = System.currentTimeMillis();
		if (bridge != null && equipAt > 0 && now - cosFailCheckedAt > 500) {
			cosFailCheckedAt = now;
			String f = bridge.cosmeticFailure(equipAt - 1);
			if (f != null) cosMessage = Lang.t("cos.failed", f);
			else if (now - equipAt > 4000 && Lang.t("cos.working").equals(cosMessage)) cosMessage = null;
		}
		return cosMessage;
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
