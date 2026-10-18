package pl.mibclient.mod.fabric;

import com.mojang.blaze3d.platform.InputConstants;
import com.mojang.blaze3d.vertex.PoseStack;
import java.io.File;
import java.time.LocalTime;
import java.util.Collections;
import java.util.Base64;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.item.v1.ItemTooltipCallback;
import net.fabricmc.fabric.api.client.screen.v1.ScreenEvents;
import net.fabricmc.fabric.api.client.screen.v1.Screens;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayConnectionEvents;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.ChatFormatting;
import net.minecraft.client.CameraType;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.Options;
import net.minecraft.client.gui.MibGraphics;
import com.mojang.blaze3d.platform.NativeImage;
import net.minecraft.client.gui.components.AbstractWidget;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.ConnectScreen;
import net.minecraft.client.gui.screens.DisconnectedScreen;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.TitleScreen;
import net.minecraft.client.gui.screens.multiplayer.JoinMultiplayerScreen;
import net.minecraft.client.multiplayer.ServerData;
import net.minecraft.client.multiplayer.resolver.ServerAddress;
import net.minecraft.network.chat.Component;
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
	public static final org.slf4j.Logger LOG = org.slf4j.LoggerFactory.getLogger("MiB Client");

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
	public WorldTweaks world;
	public Extras extras;
	public KeyMapping menuKey, zoomKey, perspectiveKey, stopwatchKey, snaplookKey;

	private final long sessionStart = System.currentTimeMillis();
	private boolean optionsApplied, autoSprint;
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
	/** Snaplook i Auto perspective: widok sprzed włączenia (null = nie działa). */
	private CameraType snapBefore, autoBefore;
	/** Ostatnia śmierć {x, y, z, czas}, poprzedni stan „martwy” i ostatni serwer (Reconnect). */
	private double[] lastDeath;
	private boolean wasDead;
	private ServerData lastServer;
	private Button reconnectButton;
	private long reconnectAt;
	private final SmokeTest smoke = System.getProperty("mib.smoketest") != null ? new SmokeTest() : null;

	@Override
	public void onInitializeClient() {
		instance = this;
		String dir = System.getProperty("mib.dir");
		File base = dir != null ? new File(dir) : FabricLoader.getInstance().getGameDir().resolve("mib").toFile();
		config = Config.load(new File(base, Config.FILE_NAME));
		Lang.choose(config.language());
		modules = new ModuleManager(config, ModuleCatalog.ALL);
		hud = new HudView(modules);
		editor = new HudEditorModel(modules);
		info = new FabricGameInfo(this, sessionStart);
		bridge = dir != null ? new LauncherBridge(base) : null;
		players = new Players(this);
		pvp = new Pvp(this);
		world = new WorldTweaks(this, base);
		world.register();
		extras = new Extras(this);
		Extras.register();
		Looks.register();

		//#if MC >= 1.21.9
		KeyMapping.Category cat = KeyMapping.Category.register(MibId.fromNamespaceAndPath("mibclient", "main"));
		//#else
		String cat = "key.category.mibclient.main";
		//#endif
		menuKey = register(new KeyMapping("key.mibclient.menu", InputConstants.KEY_RSHIFT, cat));
		zoomKey = register(new KeyMapping("key.mibclient.zoom", InputConstants.KEY_C, cat));
		perspectiveKey = register(new KeyMapping("key.mibclient.perspective", InputConstants.KEY_LALT, cat));
		stopwatchKey = register(new KeyMapping("key.mibclient.stopwatch", InputConstants.KEY_J, cat));
		snaplookKey = register(new KeyMapping("key.mibclient.snaplook", InputConstants.KEY_Z, cat));
		for (int i = 0; i < extras.autoText.length; i++) {
			extras.autoText[i] = register(new KeyMapping("key.mibclient.autotext" + (i + 1), InputConstants.UNKNOWN.getValue(), cat));
		}
		extras.emoteKey = register(new KeyMapping("key.mibclient.emote", InputConstants.KEY_B, cat));
		extras.waypointKey = register(new KeyMapping("key.mibclient.waypoint", InputConstants.KEY_N, cat));

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
			lastServer = s;
		});
		ScreenEvents.AFTER_INIT.register((client, screen, width, height) -> {
			if (screen instanceof DisconnectedScreen) addReconnect(client, screen, width);
		});
		ItemTooltipCallback.EVENT.register((stack, context, type, lines) -> {
			// Tooltips: głód i nasycenie jedzenia
			net.minecraft.world.food.FoodProperties food = modules.isOn("tooltips") && boolOpt("tooltips", "food")
					? stack.get(net.minecraft.core.component.DataComponents.FOOD) : null;
			if (food != null) {
				hooks.add("food_info");
				lines.add(Component.literal(Lang.t("food.info", food.nutrition(), String.format(java.util.Locale.ROOT, "%.1f", food.saturation())))
						.withStyle(ChatFormatting.GOLD));
			}
		});
		ItemTooltipCallback.EVENT.register((stack, context, type, lines) -> {
			if (!modules.isOn("item_info") || !stack.isDamageableItem() || type.isAdvanced()) return;
			hooks.add("item_info");
			int max = stack.getMaxDamage();
			lines.add(Component.literal(Lang.t("item.durability", max - stack.getDamageValue(), max)).withStyle(ChatFormatting.GRAY));
		});
		ClientPlayConnectionEvents.DISCONNECT.register((handler, client) -> {
			modules.setBlocked(Collections.<String>emptySet());
			players.reset();
		});
		modules.addListener((id, on) -> {
			if ("toggle_sprint".equals(id)) applySprint();
			if ("camera".equals(id)) applyCamera();
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
			applyCamera();
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
		tickAutoSprint(c);
		pvp.tick(c);
		players.tick(c);
		world.tick(c);
		extras.tick(c);
		SoundFilters.tick(c, this);
		Looks.tickPost(c);
		Looks.tickHitboxes(c);
		tickCameraModes(c);
		tickDeath(c);
		tickReconnect(c);
		if (smoke != null) smoke.tick(c);
	}

	private void renderHud(MibGraphics g) {
		Minecraft c = Minecraft.getInstance();
		Screen screen = Input.screen(c);
		if (screen instanceof HudEditorScreen) return;
		// Autohide HUD: bez HUD MiB pod ekwipunkiem i innymi menu (czat tylko z opcją)
		if (screen != null && modules.isOn("autohide_hud")
				&& (!(screen instanceof net.minecraft.client.gui.screens.ChatScreen) || boolOpt("autohide_hud", "chat"))) {
			hooks.add("autohide");
			return;
		}
		FabricCanvas canvas = new FabricCanvas(g, c.font);
		extras.render(g, canvas, c);
		hud.render(canvas, info, g.guiWidth(), g.guiHeight(), null, false);
		hud.overlay(canvas, info, g.guiWidth(), g.guiHeight());
	}

	/** Napis nad paskiem przedmiotów (jak komunikaty gry). */
	public void actionBar(Component text) {
		Minecraft c = Minecraft.getInstance();
		if (c.player == null) return;
		//#if MC >= 26.1
		c.player.sendOverlayMessage(text);
		//#else
		c.player.displayClientMessage(text, true);
		//#endif
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

	/**
	 * Auto sprint: klawisz biegu stale „wciśnięty” (gra sama sprawdza, czy idziesz do przodu i czy możesz biec).
	 * Przy przełączanym biegu wciśnięcie zmienia stan, więc tylko gdy bieg jest wyłączony.
	 */
	private void tickAutoSprint(Minecraft c) {
		if (modules.isOn("auto_sprint") && c.player != null) {
			if (!c.options.keySprint.isDown()) c.options.keySprint.setDown(true);
			if (c.player.isSprinting()) hooks.add("auto_sprint");
			autoSprint = true;
		} else if (autoSprint) {
			// po wyłączeniu bieg stop; przy przełączanym biegu „wciśnięcie” przełącza go z powrotem na wyłączony
			autoSprint = false;
			if (c.options.keySprint.isDown()) c.options.keySprint.setDown(c.options.toggleSprint().get());
		}
	}

	/** Camera „bez bujania” korzysta z opcji gry; po wyłączeniu przywraca poprzednie ustawienie gracza. */
	private void applyCamera() {
		Minecraft c = Minecraft.getInstance();
		if (c == null || c.options == null) return;
		ModuleState st = modules.state("camera");
		boolean want = modules.isOn("camera") && boolOpt("camera", "no_bob");
		if (want) {
			if (!(st.option("prev_bob") instanceof Boolean)) {
				st.setOption("prev_bob", c.options.bobView().get());
				config.save();
			}
			c.options.bobView().set(false);
		} else if (st.option("prev_bob") instanceof Boolean) {
			c.options.bobView().set((Boolean) st.option("prev_bob"));
			st.setOption("prev_bob", null);
			config.save();
		}
	}

	/** Odległość kamery w trzeciej osobie (gra podaje 4 bloki razy skala postaci). */
	public float cameraDistance(float distance) {
		if (!modules.isOn("camera")) return distance;
		hooks.add("camera");
		return distance * intOpt("camera", "distance") / 4f;
	}

	/** Własny nick nad głową (z logo MiB): zawsze w kamerze 360° i w trzeciej osobie. */
	public boolean showOwnName() {
		return freeOn || !Minecraft.getInstance().options.getCameraType().isFirstPerson();
	}

	/** Snaplook (klawisz: widok z przodu) i Auto perspective (elytra, jazda): trzecia osoba tylko na ten czas. */
	private void tickCameraModes(Minecraft c) {
		boolean snap = modules.isOn("snaplook") && c.player != null && Input.screen(c) == null && Input.held(c, snaplookKey);
		if (snap && snapBefore == null) {
			snapBefore = c.options.getCameraType();
			c.options.setCameraType(CameraType.THIRD_PERSON_FRONT);
			hooks.add("snaplook");
		} else if (!snap && snapBefore != null) {
			c.options.setCameraType(snapBefore);
			snapBefore = null;
		}
		boolean auto = modules.isOn("auto_perspective") && c.player != null && !freeOn && snapBefore == null
				&& ((boolOpt("auto_perspective", "elytra") && c.player.isFallFlying()) || (boolOpt("auto_perspective", "riding") && c.player.isPassenger()));
		if (auto && autoBefore == null) {
			autoBefore = c.options.getCameraType();
			c.options.setCameraType(CameraType.THIRD_PERSON_BACK);
		} else if (!auto && autoBefore != null) {
			c.options.setCameraType(autoBefore);
			autoBefore = null;
		}
	}

	/** Death info: miejsce śmierci zapamiętane w chwili śmierci. */
	private void tickDeath(Minecraft c) {
		boolean dead = c.player != null && c.player.isDeadOrDying();
		if (dead && !wasDead) lastDeath = new double[] {c.player.getX(), c.player.getY(), c.player.getZ(), System.currentTimeMillis()};
		wasDead = dead;
	}

	public double[] lastDeath() {
		return lastDeath;
	}

	/** Reconnect: przycisk pod przyciskami ekranu rozłączenia. */
	private void addReconnect(Minecraft c, Screen screen, int width) {
		reconnectButton = null;
		if (!modules.isOn("reconnect") || lastServer == null) return;
		//#if MC >= 26.1
		List<AbstractWidget> widgets = Screens.getWidgets(screen);
		//#else
		List<AbstractWidget> widgets = Screens.getButtons(screen);
		//#endif
		int bottom = 0;
		for (AbstractWidget w : widgets) bottom = Math.max(bottom, w.getY() + w.getHeight());
		ServerData target = lastServer;
		reconnectButton = Button.builder(Component.literal(Lang.t("reconnect")), b -> reconnect(c, target)).bounds(width / 2 - 100, bottom + 4, 200, 20).build();
		widgets.add(reconnectButton);
		reconnectAt = boolOpt("reconnect", "auto") ? System.currentTimeMillis() + intOpt("reconnect", "delay") * 1000L : 0;
		hooks.add("reconnect");
	}

	private void tickReconnect(Minecraft c) {
		if (reconnectButton == null || reconnectAt <= 0) return;
		if (!(Input.screen(c) instanceof DisconnectedScreen)) {
			reconnectAt = 0;
			return;
		}
		long left = reconnectAt - System.currentTimeMillis();
		if (left <= 0) {
			reconnectAt = 0;
			reconnect(c, lastServer);
		} else reconnectButton.setMessage(Component.literal(Lang.t("reconnect.in", (int) Math.ceil(left / 1000.0))));
	}

	private static void reconnect(Minecraft c, ServerData server) {
		if (server == null) return;
		ConnectScreen.startConnecting(new JoinMultiplayerScreen(new TitleScreen()), c, ServerAddress.parseString(server.ip), server, false, null);
	}

	/** Custom chat: godzina przed wiadomością. */
	public Component chatMessage(Component message) {
		if (!modules.isOn("custom_chat") || !boolOpt("custom_chat", "time")) return message;
		hooks.add("chat");
		LocalTime t = LocalTime.now();
		String time = boolOpt("custom_chat", "seconds") ? String.format("[%02d:%02d:%02d] ", t.getHour(), t.getMinute(), t.getSecond())
				: String.format("[%02d:%02d] ", t.getHour(), t.getMinute());
		return Component.empty().append(Component.literal(time).withStyle(ChatFormatting.DARK_GRAY)).append(message);
	}

	public int chatHistory(int max) {
		return modules.isOn("custom_chat") && boolOpt("custom_chat", "long_history") ? Math.max(max, 500) : max;
	}

	/** Viewmodel: przesunięcie (po 0,02 bloku) i rozmiar ręki; lewa ręka w lustrzanym odbiciu. */
	public void viewmodel(PoseStack pose, boolean mainHand) {
		if (!modules.isOn("viewmodel")) return;
		hooks.add("viewmodel");
		pose.translate(intOpt("viewmodel", "x") * 0.02f * (mainHand ? 1 : -1), intOpt("viewmodel", "y") * 0.02f, intOpt("viewmodel", "z") * -0.02f);
		float sc = intOpt("viewmodel", "scale") / 100f;
		pose.scale(sc, sc, sc);
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
			// read(byte[]) do 1.21.3 kopiuje plik na stos LWJGL (64 KB) — większe obrazki (ekran ładowania) go przepełniają
			NativeImage img = NativeImage.read(new java.io.ByteArrayInputStream(png));
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
	public void languageChosen(String code) {
		config.setLanguage(code);
		config.save();
	}

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
	public String worldKey() {
		return Extras.worldKey(Minecraft.getInstance());
	}

	@Override
	public String dimension() {
		return Extras.dimension(Minecraft.getInstance());
	}

	@Override
	public int[] playerBlockPos() {
		Minecraft c = Minecraft.getInstance();
		if (c.player == null) return null;
		net.minecraft.core.BlockPos p = c.player.blockPosition();
		return new int[] {p.getX(), p.getY(), p.getZ()};
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
