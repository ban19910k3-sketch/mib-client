package pl.mibclient.mod.fabric;

import java.io.File;
import java.io.InputStream;
import java.nio.file.FileSystems;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardWatchEventKinds;
import java.nio.file.WatchEvent;
import java.nio.file.WatchKey;
import java.nio.file.WatchService;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import net.fabricmc.fabric.api.client.screen.v1.ScreenEvents;
import net.fabricmc.fabric.api.client.screen.v1.Screens;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.ChatFormatting;
import net.minecraft.client.gui.components.AbstractWidget;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.gui.components.events.GuiEventListener;
import net.minecraft.client.gui.screens.options.controls.KeyBindsList;
import net.minecraft.client.gui.screens.options.controls.KeyBindsScreen;
import net.minecraft.client.Camera;
import net.minecraft.client.CameraType;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.MibGraphics;
import net.minecraft.client.multiplayer.ClientPacketListener;
import net.minecraft.client.multiplayer.ServerData;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.MibId;
import net.minecraft.world.level.LightLayer;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.storage.LevelResource;
import net.minecraft.world.phys.Vec3;
import pl.mibclient.mod.core.Lang;
import pl.mibclient.mod.core.ModuleState;
import pl.mibclient.mod.core.Setting;
import pl.mibclient.mod.core.Theme;
import pl.mibclient.mod.core.modules.Waypoints;
import pl.mibclient.mod.core.modules.WorldOverlay;

/**
 * Moduły bez rysowania w świecie: Auto text, Emotes, Waypoints i Light level overlay (znaczniki rzutowane na HUD),
 * Screenshot (nowy plik w screenshots: podgląd w rogu i kopia do schowka przez launcher), UI scaling, Custom F3, Keybind search.
 */
public final class Extras {
	/** Pole widzenia świata z ostatniej klatki (GameRendererMixin), do rzutowania punktów na ekran. */
	public static volatile double fov = 70;

	private final MibClient mib;
	final KeyMapping[] autoText = new KeyMapping[3];
	KeyMapping emoteKey, waypointKey;

	private String emote;
	private long emoteStart, emoteEnd;
	private CameraType emoteCameraBefore;

	/** Znaczniki światła: x, y, z, kolor (po 4 liczby). */
	private int[] light = new int[0];
	private int ticks;

	private WatchService watch;
	private Path shots;
	private final Map<Path, Long> pending = new LinkedHashMap<>();
	private MibId preview;
	private int previewW, previewH;
	private long previewUntil;

	private double uiScaleApplied = -2;

	Extras(MibClient mib) {
		this.mib = mib;
	}

	private boolean on(String id) {
		return mib.modules.isOn(id);
	}

	private String choice(String id, String key) {
		return ((Setting.ChoiceSetting) mib.modules.def(id).setting(key)).get(mib.modules.state(id));
	}

	void tick(Minecraft c) {
		ticks++;
		tickAutoText(c);
		tickEmote(c);
		while (waypointKey.consumeClick()) addWaypoint(c);
		if (on("light_level") && c.level != null && c.player != null) {
			if (ticks % 10 == 0) scanLight(c);
		} else light = new int[0];
		tickScreenshots(c);
		double s = uiScale();
		if (s != uiScaleApplied) {
			boolean first = uiScaleApplied == -2;
			uiScaleApplied = s;
			if (!first || s > 0) c.resizeDisplay();
		}
	}

	// ===== Auto text =====

	private void tickAutoText(Minecraft c) {
		for (int i = 0; i < autoText.length; i++) {
			while (autoText[i].consumeClick()) {
				if (!on("auto_text") || c.player == null || Input.screen(c) != null) continue;
				String t = ((Setting.TextSetting) mib.modules.def("auto_text").setting("text" + (i + 1))).get(mib.modules.state("auto_text")).trim();
				ClientPacketListener conn = c.getConnection();
				if (t.isEmpty() || conn == null) continue;
				MibClient.hooks.add("auto_text");
				if (t.startsWith("/")) conn.sendCommand(t.substring(1));
				else conn.sendChat(t);
			}
		}
	}

	// ===== Emotes =====

	private void tickEmote(Minecraft c) {
		long now = System.currentTimeMillis();
		while (emoteKey.consumeClick()) {
			if (!on("emotes") || c.player == null || Input.screen(c) != null) continue;
			emote = choice("emotes", "emote");
			emoteStart = now;
			emoteEnd = now + mib.intOpt("emotes", "seconds") * 1000L;
			if (mib.boolOpt("emotes", "camera") && emoteCameraBefore == null) {
				emoteCameraBefore = c.options.getCameraType();
				c.options.setCameraType(CameraType.THIRD_PERSON_FRONT);
			}
		}
		if (emote != null && (now > emoteEnd || !on("emotes") || c.player == null)) {
			emote = null;
			if (emoteCameraBefore != null && c.options.getCameraType() == CameraType.THIRD_PERSON_FRONT) c.options.setCameraType(emoteCameraBefore);
			emoteCameraBefore = null;
		}
	}

	/** Kąty rąk własnej postaci w trakcie emotki ({prawa X, prawa Z, lewa X, lewa Z}) albo null. */
	public float[] emoteArms() {
		String e = emote;
		if (e == null) return null;
		MibClient.hooks.add("emote");
		return WorldOverlay.emote(e, (System.currentTimeMillis() - emoteStart) / 1000.0);
	}

	public void startEmoteForTest(String id) {
		emote = id;
		emoteStart = System.currentTimeMillis();
		emoteEnd = emoteStart + 5000;
	}

	// ===== Waypoints =====

	/** Świat gracza: zapis gry albo adres serwera; null poza światem. */
	public static String worldKey(Minecraft c) {
		if (c.level == null) return null;
		if (c.getSingleplayerServer() != null) {
			Path p = c.getSingleplayerServer().getWorldPath(LevelResource.ROOT).toAbsolutePath().normalize();
			return "sp:" + (p.getFileName() == null ? "world" : p.getFileName().toString());
		}
		ServerData s = c.getCurrentServer();
		return s == null ? "mp:?" : "mp:" + s.ip.toLowerCase(java.util.Locale.ROOT);
	}

	public static String dimension(Minecraft c) {
		return c.level == null ? null : c.level.dimension().toString();
	}

	private void addWaypoint(Minecraft c) {
		if (!on("waypoints") || c.player == null) return;
		String w = worldKey(c);
		if (w == null) return;
		BlockPos p = c.player.blockPosition();
		ModuleState st = mib.modules.state("waypoints");
		if (Waypoints.add(st, w, dimension(c), p.getX(), p.getY(), p.getZ(), Lang.t("wp.name"))) {
			mib.modules.touched("waypoints");
			List<Waypoints.Point> l = Waypoints.in(st, w, dimension(c));
			mib.actionBar(Component.literal(Lang.t("wp.added", l.get(l.size() - 1).name)));
		} else mib.actionBar(Component.literal(Lang.t("wp.full")));
	}

	// ===== Light level overlay =====

	private void scanLight(Minecraft c) {
		int r = mib.intOpt("light_level", "radius");
		BlockPos center = c.player.blockPosition();
		List<int[]> out = new ArrayList<>();
		BlockPos.MutableBlockPos pos = new BlockPos.MutableBlockPos(), below = new BlockPos.MutableBlockPos();
		for (int dx = -r; dx <= r; dx++) {
			for (int dz = -r; dz <= r; dz++) {
				if (dx * dx + dz * dz > r * r) continue;
				for (int dy = -4; dy <= 3; dy++) {
					pos.set(center.getX() + dx, center.getY() + dy, center.getZ() + dz);
					BlockState s = c.level.getBlockState(pos);
					if (!s.getCollisionShape(c.level, pos).isEmpty() || !s.getFluidState().isEmpty()) continue;
					below.set(pos.getX(), pos.getY() - 1, pos.getZ());
					BlockState b = c.level.getBlockState(below);
					if (!b.isFaceSturdy(c.level, below, Direction.UP)) continue;
					int color = WorldOverlay.lightColor(c.level.getBrightness(LightLayer.BLOCK, pos), c.level.getBrightness(LightLayer.SKY, pos));
					if (color != WorldOverlay.NONE) out.add(new int[] {pos.getX(), pos.getY(), pos.getZ(), color});
				}
			}
		}
		int[] a = new int[out.size() * 4];
		for (int i = 0; i < out.size(); i++) System.arraycopy(out.get(i), 0, a, i * 4, 4);
		light = a;
		if (a.length > 0) MibClient.hooks.add("light_level");
	}

	// ===== Rysowanie na HUD =====

	private static double[] camera(Minecraft c) {
		Camera cam = c.gameRenderer.getMainCamera();
		//#if MC >= 26.1
		Vec3 p = cam.position();
		return new double[] {p.x, p.y, p.z, cam.yRot(), cam.xRot()};
		//#else
		Vec3 p = cam.getPosition();
		return new double[] {p.x, p.y, p.z, cam.getYRot(), cam.getXRot()};
		//#endif
	}

	void render(MibGraphics g, FabricCanvas canvas, Minecraft c) {
		int w = g.guiWidth(), h = g.guiHeight();
		if (c.level != null && c.player != null && (on("waypoints") || light.length > 0)) {
			double[] cam = camera(c);
			if (light.length > 0) {
				int[] l = light;
				for (int i = 0; i < l.length; i += 4) {
					double[] p = Waypoints.project(l[i] + 0.5, l[i + 1] + 0.05, l[i + 2] + 0.5, cam[0], cam[1], cam[2], (float) cam[3], (float) cam[4], fov, w, h);
					if (p == null || p[0] < 0 || p[1] < 0 || p[0] > w || p[1] > h) continue;
					int s = p[2] < 6 ? 2 : 1, x = (int) p[0], y = (int) p[1];
					canvas.fill(x - s, y - s, x + s + 1, y + s + 1, l[i + 3]);
				}
			}
			if (on("waypoints")) drawWaypoints(canvas, c, cam, w, h);
		}
		if (preview != null && System.currentTimeMillis() < previewUntil) {
			int pw = Math.max(60, w / 5), ph = pw * previewH / Math.max(1, previewW), x = w - pw - 6, y = 6;
			canvas.fill(x - 2, y - 2, x + pw + 2, y + ph + 12, 0xC0100618);
			FabricCanvas.blit(g, preview, x, y, 0, 0, pw, ph, pw, ph, 0xFFFFFFFF);
			String t = Lang.t(mib.bridge != null && mib.boolOpt("screenshot", "copy") ? "shot.copied" : "shot.saved");
			canvas.text(t, x + (pw - canvas.textWidth(t)) / 2, y + ph + 2, Theme.AM_HI, true);
		}
	}

	private void drawWaypoints(FabricCanvas canvas, Minecraft c, double[] cam, int w, int h) {
		String world = worldKey(c);
		if (world == null) return;
		int max = mib.intOpt("waypoints", "max_distance");
		for (Waypoints.Point pt : Waypoints.in(mib.modules.state("waypoints"), world, dimension(c))) {
			double[] p = Waypoints.project(pt.x + 0.5, pt.y + 1.0, pt.z + 0.5, cam[0], cam[1], cam[2], (float) cam[3], (float) cam[4], fov, w, h);
			if (p == null || (max > 0 && p[2] > max)) continue;
			int x = (int) Math.max(4, Math.min(w - 4, p[0])), y = (int) Math.max(12, Math.min(h - 14, p[1]));
			MibClient.hooks.add("waypoints");
			canvas.fill(x - 3, y - 3, x + 4, y + 4, 0xFF000000);
			canvas.fill(x - 2, y - 2, x + 3, y + 3, pt.color);
			String d = Math.round(p[2]) + " m";
			canvas.text(pt.name, x - canvas.textWidth(pt.name) / 2, y - 13, pt.color, true);
			canvas.text(d, x - canvas.textWidth(d) / 2, y + 6, 0xFFE0E0E0, true);
		}
	}

	// ===== Screenshot =====

	private void tickScreenshots(Minecraft c) {
		if (!on("screenshot")) return;
		try {
			if (watch == null) {
				shots = FabricLoader.getInstance().getGameDir().resolve("screenshots");
				Files.createDirectories(shots);
				watch = FileSystems.getDefault().newWatchService();
				shots.register(watch, StandardWatchEventKinds.ENTRY_CREATE);
			}
			WatchKey k = watch.poll();
			if (k != null) {
				for (WatchEvent<?> e : k.pollEvents()) {
					if (e.context() instanceof Path p && p.toString().toLowerCase(java.util.Locale.ROOT).endsWith(".png")) pending.put(shots.resolve(p), -1L);
				}
				k.reset();
			}
		} catch (Exception e) {
			return;
		}
		if (pending.isEmpty() || ticks % 5 != 0) return;
		for (Map.Entry<Path, Long> en : new ArrayList<>(pending.entrySet())) {
			File f = en.getKey().toFile();
			long size = f.length();
			if (size <= 0 || size != en.getValue()) {
				pending.put(en.getKey(), size); // jeszcze się zapisuje
				continue;
			}
			pending.remove(en.getKey());
			shot(f);
		}
	}

	private void shot(File f) {
		MibClient.hooks.add("screenshot");
		if (mib.boolOpt("screenshot", "copy") && mib.bridge != null) mib.bridge.requestScreenshotCopy(f.getAbsolutePath());
		if (!mib.boolOpt("screenshot", "preview")) return;
		try (InputStream in = Files.newInputStream(f.toPath())) {
			byte[] png = in.readAllBytes();
			int[] size = pngSize(png);
			MibClient.releaseTexture(preview);
			preview = MibClient.registerTexture("screenshot", png);
			previewW = size[0];
			previewH = size[1];
			previewUntil = System.currentTimeMillis() + 3500;
		} catch (Exception e) {
			preview = null;
		}
	}

	/** Wymiary obrazka PNG z nagłówka IHDR. */
	static int[] pngSize(byte[] png) {
		if (png.length < 24) return new int[] {16, 9};
		int w = ((png[16] & 0xFF) << 24) | ((png[17] & 0xFF) << 16) | ((png[18] & 0xFF) << 8) | (png[19] & 0xFF);
		int h = ((png[20] & 0xFF) << 24) | ((png[21] & 0xFF) << 16) | ((png[22] & 0xFF) << 8) | (png[23] & 0xFF);
		return new int[] {Math.max(1, w), Math.max(1, h)};
	}

	// ===== Keybind search =====

	static void register() {
		ScreenEvents.AFTER_INIT.register((client, screen, width, height) -> {
			MibClient m = MibClient.get();
			if (!(screen instanceof KeyBindsScreen) || m == null || !m.modules.isOn("keybind_search")) return;
			KeyBindsList list = null;
			for (GuiEventListener l : screen.children()) if (l instanceof KeyBindsList k) list = k;
			if (list == null) return;
			KeyBindsList keys = list;
			List<KeyBindsList.Entry> all = new ArrayList<>(list.children());
			EditBox box = new EditBox(client.font, width - 128, 7, 120, 16, Component.literal(Lang.t("keys.search")));
			box.setHint(Component.literal(Lang.t("keys.search")).withStyle(ChatFormatting.DARK_GRAY));
			box.setResponder(q -> filterKeys(keys, all, q));
			//#if MC >= 26.1
			List<AbstractWidget> widgets = Screens.getWidgets(screen);
			//#else
			List<AbstractWidget> widgets = Screens.getButtons(screen);
			//#endif
			widgets.add(box);
			MibClient.hooks.add("keybind_search");
		});
	}

	/** Wiersze z klawiszami, których nazwa albo przypisany klawisz zawiera szukany tekst (nagłówki kategorii tylko bez szukania). */
	static void filterKeys(KeyBindsList list, List<KeyBindsList.Entry> all, String query) {
		String q = query.trim().toLowerCase(java.util.Locale.ROOT);
		List<KeyBindsList.Entry> shown = new ArrayList<>();
		for (KeyBindsList.Entry e : all) {
			if (q.isEmpty()) shown.add(e);
			else if (e instanceof KeyBindsList.KeyEntry k) {
				pl.mibclient.mod.fabric.mixin.KeyEntryAccessor a = (pl.mibclient.mod.fabric.mixin.KeyEntryAccessor) k;
				String text = (a.mib$name().getString() + " " + a.mib$key().getTranslatedKeyMessage().getString()).toLowerCase(java.util.Locale.ROOT);
				if (text.contains(q)) shown.add(e);
			}
		}
		((pl.mibclient.mod.fabric.mixin.AbstractSelectionListAccessor) list).mib$replaceEntries(shown);
		list.setScrollAmount(0);
	}

	// ===== UI scaling, Custom F3 =====

	/** Skala interfejsu z UI scaling albo -1 (bez zmian). */
	public static double uiScale() {
		MibClient m = MibClient.get();
		if (m == null || m.modules == null || !m.modules.isOn("ui_scaling")) return -1;
		MibClient.hooks.add("ui_scale");
		return m.intOpt("ui_scaling", "scale") / 100.0;
	}

	public static List<String> debugLines(List<String> lines, boolean left) {
		MibClient m = MibClient.get();
		if (m == null || !m.modules.isOn("custom_f3") || lines == null) return lines;
		MibClient.hooks.add("custom_f3");
		return WorldOverlay.debugLines(lines, left, m.boolOpt("custom_f3", "short"), m.boolOpt("custom_f3", "hide_right"));
	}
}
