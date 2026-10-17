package pl.mibclient.mod.fabric;

import com.mojang.blaze3d.platform.InputConstants;
import com.mojang.blaze3d.platform.Window;
import net.minecraft.client.Minecraft;
import pl.mibclient.mod.core.MenuView;

/** Wejście z gry w jednostkach części wspólnej (klawisze i przyciski jak w GLFW: 0 = lewy, 1 = prawy). */
final class Input {
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
}
