package pl.mibclient.mod.fabric.test;

import java.util.ArrayList;
import java.util.List;
import net.fabricmc.fabric.api.client.gametest.v1.FabricClientGameTest;
import net.fabricmc.fabric.api.client.gametest.v1.TestInput;
import net.fabricmc.fabric.api.client.gametest.v1.context.ClientGameTestContext;
import net.fabricmc.fabric.api.client.gametest.v1.context.TestSingleplayerContext;
import org.lwjgl.glfw.GLFW;
import pl.mibclient.mod.core.HudEditorModel;
import pl.mibclient.mod.core.HudPos;
import pl.mibclient.mod.core.MenuView;
import pl.mibclient.mod.core.ModuleDef;
import pl.mibclient.mod.core.ModuleManager;
import pl.mibclient.mod.fabric.HudEditorScreen;
import pl.mibclient.mod.fabric.MenuScreen;
import pl.mibclient.mod.fabric.MibClient;

/** Automatyczny test w prawdziwym kliencie: menu, wyszukiwarka, ustawienia, edytor HUD, HUD, zoom, celownik + zrzuty. */
public class MibClientGameTest implements FabricClientGameTest {
	private final List<String> errors = new ArrayList<>();

	@Override
	public void runTest(ClientGameTestContext context) {
		TestInput input = context.getInput();
		// świat wczytuje się w małym oknie (renderowanie programowe na CI jest wolne), zrzuty robimy w 1280×720
		try (TestSingleplayerContext sp = context.worldBuilder().create()) {
			sp.getClientWorld().waitForChunksRender();
			input.resizeWindow(1280, 720);
			context.waitTicks(20);
			context.takeScreenshot("00-game");

			input.pressKey(GLFW.GLFW_KEY_RIGHT_SHIFT);
			context.waitTicks(5);
			check(context.computeOnClient(c -> c.currentScreen instanceof MenuScreen), "prawy Shift nie otworzył menu");
			context.takeScreenshot("01-menu");

			click(context, "pill:cps");
			check(!context.computeOnClient(c -> MibClient.get().modules.isOn("cps")), "klik w pigułkę nie wyłączył CPS");
			context.takeScreenshot("02-menu-cps-off");

			input.typeChars("zoom");
			context.waitTicks(3);
			check("zoom".equals(context.computeOnClient(c -> view(c) == null ? null : view(c).query())), "wyszukiwarka nie przyjęła tekstu");
			context.takeScreenshot("03-search");

			click(context, "gear:zoom");
			check(context.computeOnClient(c -> view(c) != null && view(c).page() == MenuView.Page.SETTINGS), "zębatka nie otworzyła ustawień");
			context.takeScreenshot("04-settings");

			click(context, "back");
			context.runOnClient(c -> {
				if (view(c) != null) view(c).clearQuery();
			});
			context.waitTicks(3);
			click(context, "edit_hud");
			check(context.computeOnClient(c -> c.currentScreen instanceof HudEditorScreen), "„Edytuj HUD” nie otworzył edytora");
			context.takeScreenshot("05-hud-editor");
			dragFps(context, input);

			context.setScreen(() -> null);
			context.runOnClient(c -> {
				ModuleManager m = MibClient.get().modules;
				for (ModuleDef d : m.all()) if (d.hud && !m.isOn(d.id)) m.toggle(d.id);
			});
			context.waitTicks(20);
			context.takeScreenshot("06-hud-all");

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
		}
		if (!errors.isEmpty()) throw new AssertionError(String.join("; ", errors));
	}

	private void check(boolean ok, String message) {
		if (!ok) errors.add(message);
	}

	private static MenuView view(net.minecraft.client.MinecraftClient c) {
		return c.currentScreen instanceof MenuScreen ? ((MenuScreen) c.currentScreen).view() : null;
	}

	/** Klik w środek elementu menu (jednostki menu × piksele okna na jednostkę). */
	private void click(ClientGameTestContext context, String name) {
		double[] p = context.computeOnClient(c -> {
			if (!(c.currentScreen instanceof MenuScreen)) return null;
			MenuScreen s = (MenuScreen) c.currentScreen;
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
		context.getInput().pressMouse(GLFW.GLFW_MOUSE_BUTTON_LEFT);
		context.waitTicks(3);
	}

	/** Przeciąga FPS o 100 px w prawo i sprawdza, że nowe położenie trafiło do ustawień. */
	private void dragFps(ClientGameTestContext context, TestInput input) {
		double[] p = context.computeOnClient(c -> {
			double gs = c.getWindow().getScaleFactor();
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
		input.holdMouse(GLFW.GLFW_MOUSE_BUTTON_LEFT);
		context.waitTicks(2);
		for (int i = 0; i < 5; i++) {
			input.moveCursor(20, 0);
			context.waitTick();
		}
		input.releaseMouse(GLFW.GLFW_MOUSE_BUTTON_LEFT);
		context.waitTicks(3);
		HudPos after = fpsPos(context);
		check(!before.equals(after), "przeciągnięcie FPS nie zmieniło położenia (" + before + ")");
		context.takeScreenshot("05b-hud-editor-dragged");
	}

	private static HudPos fpsPos(ClientGameTestContext context) {
		return context.computeOnClient(c -> MibClient.get().modules.state("fps").hud(MibClient.get().modules.def("fps").defaultHud));
	}
}
