package pl.mibclient.mod.fabric.test;

import com.mojang.blaze3d.platform.InputConstants;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import net.fabricmc.fabric.api.client.gametest.v1.FabricClientGameTest;
import net.fabricmc.fabric.api.client.gametest.v1.TestInput;
import net.fabricmc.fabric.api.client.gametest.v1.context.ClientGameTestContext;
import net.fabricmc.fabric.api.client.gametest.v1.context.TestSingleplayerContext;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.PauseScreen;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.LivingEntity;
import pl.mibclient.mod.core.HudEditorModel;
import pl.mibclient.mod.core.HudPos;
import pl.mibclient.mod.core.Lang;
import pl.mibclient.mod.core.MenuView;
import pl.mibclient.mod.core.ModuleDef;
import pl.mibclient.mod.core.ModuleManager;
import pl.mibclient.mod.fabric.HudEditorScreen;
import pl.mibclient.mod.fabric.Input;
import pl.mibclient.mod.fabric.MenuScreen;
import pl.mibclient.mod.fabric.MibClient;

/** Automatyczny test w prawdziwym kliencie: menu, wyszukiwarka, ustawienia, edytor HUD, HUD, zoom, celownik + zrzuty. */
public class MibClientGameTest implements FabricClientGameTest {
	/** Peleryna 64×32 do testu (fioletowa z białym kwadratem). */
	private static final String CAPE_PNG = "iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAYAAACinX6EAAAAcklEQVR42u3UMQ2AMBBG4b9NBZBQAyADE3hAB2N11AMmkAEGIMEBrAwMLAxc37ddctPL5dzY7ac+kOba6QeCJDXxeLW8bpWs8Spc8QHCfRim9nEp9wsXQAACEMD+E7T87LgAAhCAAAQgAAEAAAAAAIB0ATapC/N+AwboAAAAAElFTkSuQmCC";

	private final List<String> errors = new ArrayList<>();

	@Override
	public void runTest(ClientGameTestContext context) {
		TestInput input = context.getInput();
		context.takeScreenshot("00-title");
		long t0 = System.nanoTime();
		// świat wczytuje się w małym oknie (renderowanie programowe na CI jest wolne), zrzuty robimy w 1280×720
		try (TestSingleplayerContext sp = context.worldBuilder().create()) {
			System.out.println("[MIB-TEST] świat wczytany po " + (System.nanoTime() - t0) / 1_000_000 + " ms");
			//#if MC >= 26.2
			sp.getConnection().waitForChunksRender();
			//#elif MC >= 26.1
			sp.getClientLevel().waitForChunksRender();
			//#else
			sp.getClientWorld().waitForChunksRender();
			//#endif
			input.resizeWindow(1280, 720);
			context.waitTicks(20);
			context.takeScreenshot("00-game");

			input.pressKey(InputConstants.KEY_RSHIFT);
			context.waitTicks(5);
			check(context.computeOnClient(c -> Input.screen(c) instanceof MenuScreen), "prawy Shift nie otworzył menu");
			context.takeScreenshot("01-menu");

			input.typeChars("cps");
			context.waitTicks(3);
			click(context, "pill:cps");
			check(!context.computeOnClient(c -> MibClient.get().modules.isOn("cps")), "klik w pigułkę nie wyłączył CPS");
			context.takeScreenshot("02-menu-cps-off");
			context.runOnClient(c -> {
				if (view(c) != null) view(c).clearQuery();
			});

			input.typeChars("zoom");
			context.waitTicks(3);
			check("zoom".equals(context.computeOnClient(c -> view(c) == null ? null : view(c).query())), "wyszukiwarka nie przyjęła tekstu");
			context.takeScreenshot("03-search");

			click(context, "lang");
			check("pl".equals(Lang.chosen()), "przycisk języka nie zmienił języka menu");
			click(context, "lang");
			click(context, "lang");
			check("auto".equals(Lang.chosen()), "przycisk języka nie wrócił do języka gry");
			click(context, "gear:zoom");
			check(context.computeOnClient(c -> view(c) != null && view(c).page() == MenuView.Page.SETTINGS), "zębatka nie otworzyła ustawień");
			context.takeScreenshot("04-settings");

			click(context, "back");
			context.runOnClient(c -> {
				if (view(c) != null) view(c).clearQuery();
			});
			context.waitTicks(3);
			click(context, "edit_hud");
			check(context.computeOnClient(c -> Input.screen(c) instanceof HudEditorScreen), "„Edytuj HUD” nie otworzył edytora");
			context.takeScreenshot("05-hud-editor");
			dragFps(context, input);

			context.setScreen(() -> null);
			context.runOnClient(c -> {
				ModuleManager m = MibClient.get().modules;
				for (ModuleDef d : m.all()) if (d.hud && !m.isOn(d.id)) m.toggle(d.id);
				if (!m.isOn("brightness")) m.toggle("brightness");
			});
			context.waitTicks(20);
			context.takeScreenshot("06-hud-all");
			// moduły etapów 3 i 4 w grze: nasycenie (tryb przetrwania), tabela wyników, pasek bossa, czat, pogoda, kamera, ręka
			context.runOnClient(c -> {
				ModuleManager m = MibClient.get().modules;
				for (String id : new String[] {"saturation", "scoreboard", "boss_bar", "custom_chat", "weather_changer", "camera", "viewmodel", "nametags"}) {
					if (!m.isOn(id)) m.toggle(id);
				}
				m.state("scoreboard").setOption("hide", false);
				m.state("scoreboard").setOption("scale", 80);
				m.state("boss_bar").setOption("hide", false);
				m.state("weather_changer").setOption("weather", "rain");
			});
			sp.getServer().runCommand("gamemode survival @a");
			sp.getServer().runCommand("scoreboard objectives add mib dummy \"MiB\"");
			sp.getServer().runCommand("scoreboard objectives setdisplay sidebar mib");
			sp.getServer().runCommand("scoreboard players set Gracz mib 7");
			sp.getServer().runCommand("bossbar add mib:test \"MiB\"");
			sp.getServer().runCommand("bossbar set mib:test players @a");
			sp.getServer().runCommand("say MiB");
			context.waitTicks(20);
			context.takeScreenshot("06d-stage3");
			sp.getServer().runCommand("gamemode creative @a");

			// edytor HUD ze wszystkimi modułami: przykładowa treść także tych bez danych (combo, zasięg, stoper…)
			context.runOnClient(c -> MibClient.get().openHudEditor(null));
			context.waitTicks(5);
			context.takeScreenshot("06b-hud-editor-all");
			context.setScreen(() -> null);
			context.waitTicks(2);

			// walka: uderzenie świni w miejscu gracza liczy trafienie, zasięg i combo (zombie płonie w dzień, a wtedy
			// chwilowa nietykalność po obrażeniach od ognia gubi uderzenie; obok gracza istota mogłaby utknąć w bloku)
			sp.getServer().runCommand("execute as @p at @p run summon minecraft:pig ~ ~ ~ {NoAI:1b,Silent:1b,Tags:[\"mib\"]}");
			context.waitTicks(10);
			context.runOnClient(c -> {
				if (!MibClient.get().modules.isOn("hit_indicator")) MibClient.get().modules.toggle("hit_indicator");
				// najbliższa istota (świnia w miejscu gracza)
				Entity target = null;
				for (Entity e : c.level.getEntities(c.player, c.player.getBoundingBox().inflate(6))) {
					if (e instanceof LivingEntity && (target == null || e.distanceTo(c.player) < target.distanceTo(c.player))) target = e;
				}
				if (target != null) c.gameMode.attack(c.player, target);
			});
			context.waitTicks(10);
			check(MibClient.hooks.contains("attack"), "uderzenie nie dotarło do modułów PvP");
			check(context.computeOnClient(c -> MibClient.get().pvp.combat.reach() >= 0), "trafienie nie zostało policzone (zasięg)");
			context.takeScreenshot("06c-pvp");
			check(context.computeOnClient(c -> MibClient.get().pvp.meters.tps.tps() > 0), "brak pomiaru TPS");
			// Totem: świnia z totemem w ręce dostaje śmiertelne obrażenia i zużywa totem
			sp.getServer().runCommand("item replace entity @e[tag=mib,limit=1] weapon.mainhand with minecraft:totem_of_undying");
			sp.getServer().runCommand("damage @e[tag=mib,limit=1] 100");
			context.waitTicks(10);
			check(MibClient.hooks.contains("totem"), "zużyty totem nie został policzony");
			// logo MiB przed nickiem (własna postać zawsze gra w MiB)
			check(context.computeOnClient(c -> c.player.getDisplayName().getString().startsWith("\uE000")), "brak logo MiB przed nickiem");

			input.holdKey(MibClient.get().zoomKey);
			context.waitTicks(10);
			check(context.computeOnClient(c -> MibClient.get().zoom.active()), "zoom nie działa po przytrzymaniu C");
			context.takeScreenshot("07-zoom");
			input.releaseKey(MibClient.get().zoomKey);
			context.waitTicks(10);

			context.runOnClient(c -> {
				if (!MibClient.get().modules.isOn("custom_crosshair")) MibClient.get().modules.toggle("custom_crosshair");
			});
			context.waitTicks(3);
			context.takeScreenshot("08-crosshair");

			// prawy Shift: pisanie z nim wielkich liter nie zamyka menu, samo naciśnięcie zamyka
			input.pressKey(InputConstants.KEY_RSHIFT);
			context.waitTicks(5);
			check(context.computeOnClient(c -> Input.screen(c) instanceof MenuScreen), "prawy Shift nie otworzył menu drugi raz");
			input.holdKey(InputConstants.KEY_RSHIFT);
			input.typeChars("CPS");
			input.releaseKey(InputConstants.KEY_RSHIFT);
			context.waitTicks(3);
			check(context.computeOnClient(c -> view(c) != null && "cps".equalsIgnoreCase(view(c).query())), "pisanie z prawym Shiftem zamknęło menu albo zgubiło tekst");
			input.pressKey(InputConstants.KEY_RSHIFT);
			context.waitTicks(3);
			check(context.computeOnClient(c -> Input.screen(c) == null), "prawy Shift nie zamknął menu");

			// peleryna MiB (jak po założeniu w menu Kosmetyki) — widać ją na zrzucie z kamery 360°
			context.runOnClient(c -> MibClient.get().applyCape("test:cape", Base64.getDecoder().decode(CAPE_PNG)));

			// Perspective: kamera 360° pod lewym Altem, po puszczeniu wraca widok z oczu
			context.runOnClient(c -> {
				if (!MibClient.get().modules.isOn("perspective")) MibClient.get().modules.toggle("perspective");
			});
			input.holdKey(MibClient.get().perspectiveKey);
			context.waitTicks(3);
			input.moveCursor(200, 0);
			context.waitTicks(3);
			check(context.computeOnClient(c -> MibClient.get().freelook() && !c.options.getCameraType().isFirstPerson()), "Perspective nie włączył kamery 360°");
			context.takeScreenshot("10-perspective");
			input.releaseKey(MibClient.get().perspectiveKey);
			context.waitTicks(3);
			check(context.computeOnClient(c -> c.options.getCameraType().isFirstPerson()), "po puszczeniu klawisza Perspective widok nie wrócił");

			// menu pauzy z logo MiB
			context.setScreen(() -> new PauseScreen(true));
			context.waitTicks(3);
			context.takeScreenshot("09-pause");
			context.setScreen(() -> null);
			context.waitTicks(2);

			// wszystkie wstawki w grę zadziałały (pole widzenia, jasność, kliknięcia, celownik, logo i ekran tytułowy)
			for (String h : new String[] {"fov", "gamma", "click", "crosshair", "logo", "title-logo", "version", "freelook", "cape", "attack", "hit", "badge", "totem", "loading",
					"saturation", "scoreboard", "boss_bar", "chat", "weather", "camera", "viewmodel", "own-name"}) {
				check(MibClient.hooks.contains(h), "wstawka w grę nie zadziałała: " + h);
			}
		}
		if (!errors.isEmpty()) throw new AssertionError(String.join("; ", errors));
	}

	private void check(boolean ok, String message) {
		if (!ok) errors.add(message);
	}

	private static MenuView view(Minecraft c) {
		return Input.screen(c) instanceof MenuScreen ? ((MenuScreen) Input.screen(c)).view() : null;
	}

	/** Klik w środek elementu menu (jednostki menu × piksele okna na jednostkę). */
	private void click(ClientGameTestContext context, String name) {
		double[] p = context.computeOnClient(c -> {
			if (!(Input.screen(c) instanceof MenuScreen)) return null;
			MenuScreen s = (MenuScreen) Input.screen(c);
			int[] r = s.view().hitRect(name);
			if (r == null) return null;
			int k = s.menuScale();
			return new double[] {(r[0] + r[2] / 2.0) * k, (r[1] + r[3] / 2.0) * k};
		});
		if (p == null) {
			errors.add("brak elementu menu " + name);
			return;
		}
		context.getInput().setCursorPos(p[0], p[1]);
		context.waitTick();
		context.getInput().pressMouse(InputConstants.MOUSE_BUTTON_LEFT);
		context.waitTicks(3);
	}

	/** Przeciąga FPS o 100 px w prawo i sprawdza, że nowe położenie trafiło do ustawień. */
	private void dragFps(ClientGameTestContext context, TestInput input) {
		double[] p = context.computeOnClient(c -> {
			double gs = c.getWindow().getGuiScale();
			for (HudEditorModel.Box b : MibClient.get().editor.boxes()) {
				if (b.id.equals("fps")) return new double[] {(b.x + b.w / 2.0) * gs, (b.y + b.h / 2.0) * gs};
			}
			return null;
		});
		if (p == null) {
			errors.add("edytor HUD nie pokazał FPS");
			return;
		}
		HudPos before = fpsPos(context);
		input.setCursorPos(p[0], p[1]);
		context.waitTick();
		input.holdMouse(InputConstants.MOUSE_BUTTON_LEFT);
		context.waitTicks(2);
		for (int i = 0; i < 5; i++) {
			input.moveCursor(20, 0);
			context.waitTick();
		}
		input.releaseMouse(InputConstants.MOUSE_BUTTON_LEFT);
		context.waitTicks(3);
		HudPos after = fpsPos(context);
		check(!before.equals(after), "przeciągnięcie FPS nie zmieniło położenia (" + before + ")");
		context.takeScreenshot("05b-hud-editor-dragged");
	}

	private static HudPos fpsPos(ClientGameTestContext context) {
		return context.computeOnClient(c -> MibClient.get().modules.state("fps").hud(MibClient.get().modules.def("fps").defaultHud));
	}
}
