package pl.mibclient.mod.fabric;

import com.mojang.blaze3d.platform.InputConstants;
import com.mojang.blaze3d.platform.Window;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.Screen;
import pl.mibclient.mod.core.MenuView;

/**
 * Wejście i ekrany gry w jednostkach części wspólnej (przyciski jak w GLFW: 0 = lewy, 1 = prawy).
 * Od 26.2 ekranami zarządza minecraft.gui, wcześniej sam Minecraft.
 */
public final class Input {
	private Input() {
	}

	/** Położenie myszy w jednostkach GUI. */
	static double guiX(Minecraft c) {
		Window w = c.getWindow();
		return c.mouseHandler.xpos() * w.getGuiScaledWidth() / w.getScreenWidth();
	}

	static double guiY(Minecraft c) {
		Window w = c.getWindow();
		return c.mouseHandler.ypos() * w.getGuiScaledHeight() / w.getScreenHeight();
	}

	static int button(int b) {
		if (b == InputConstants.MOUSE_BUTTON_LEFT) return 0;
		if (b == InputConstants.MOUSE_BUTTON_RIGHT) return 1;
		return b + 100;
	}

	/** Klawisz dla MenuView albo -1, jeśli menu go nie obsługuje. */
	static int menuKey(int key) {
		if (key == InputConstants.KEY_ESCAPE) return MenuView.KEY_ESCAPE;
		if (key == InputConstants.KEY_BACKSPACE) return MenuView.KEY_BACKSPACE;
		return -1;
	}

	public static Screen screen(Minecraft c) {
		//#if MC >= 26.2
		return c.gui.screen();
		//#else
		return c.screen;
		//#endif
	}

	public static void open(Minecraft c, Screen s) {
		//#if MC >= 26.2
		c.gui.setScreen(s);
		//#else
		c.setScreen(s);
		//#endif
	}

	static boolean hudHidden(Minecraft c) {
		//#if MC >= 26.2
		return c.gui.hud.isHidden();
		//#else
		return c.options.hideGui;
		//#endif
	}

	/** Klawisz skrótu wciśnięty fizycznie — działa też, gdy inny skrót gry ma ten sam klawisz (np. C do pasków narzędzi przed 1.21.9). */
	static boolean held(Minecraft c, KeyMapping k) {
		if (k.isDown()) return true;
		InputConstants.Key key = MibClient.boundKeyOf(k);
		if (key.getType() == InputConstants.Type.MOUSE || key.getValue() < 0) return false;
		//#if MC >= 26.3
		return InputConstants.isKeyDown(key.getValue());
		//#elif MC >= 1.21.9
		return InputConstants.isKeyDown(c.getWindow(), key.getValue());
		//#else
		return InputConstants.isKeyDown(c.getWindow().getWindow(), key.getValue());
		//#endif
	}
}
