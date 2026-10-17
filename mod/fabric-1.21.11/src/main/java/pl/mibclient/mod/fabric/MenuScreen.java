package pl.mibclient.mod.fabric;

import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.minecraft.client.gui.Click;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.input.CharInput;
import net.minecraft.client.input.KeyInput;
import net.minecraft.client.util.Window;
import net.minecraft.text.Text;
import pl.mibclient.mod.core.MenuLayout;
import pl.mibclient.mod.core.MenuView;

/** Menu pod prawym Shiftem: rysuje MenuView w jednostkach menu (całkowita liczba pikseli okna na jednostkę). */
public final class MenuScreen extends Screen {
	private final MibClient mib;
	private final MenuView view;
	/** Klawisz menu wciśnięty w tym ekranie; zamyka menu dopiero po puszczeniu, jeśli w międzyczasie nic nie wpisano (prawy Shift to też Shift do wielkich liter). */
	private boolean menuKeyDown, typedWhileHeld;

	public MenuScreen(MibClient mib, String settingsFor) {
		super(Text.literal("MiB Client"));
		this.mib = mib;
		this.view = new MenuView(mib.modules, mib);
		if (settingsFor != null) view.openSettings(settingsFor);
	}

	public MenuView view() {
		return view;
	}

	/** Piksele okna na jednostkę menu. */
	public int menuScale() {
		Window w = client.getWindow();
		return MenuLayout.scale(w.getWidth(), w.getHeight());
	}

	/** Jednostki GUI na jednostkę menu. */
	private float factor() {
		return menuScale() / (float) client.getWindow().getScaleFactor();
	}

	private double mouseX() {
		return client.mouse.getScaledX(client.getWindow()) / factor();
	}

	private double mouseY() {
		return client.mouse.getScaledY(client.getWindow()) / factor();
	}

	@Override
	public void render(DrawContext ctx, int mouseX, int mouseY, float delta) {
		super.render(ctx, mouseX, mouseY, delta);
		float f = factor();
		FabricCanvas c = new FabricCanvas(ctx, textRenderer);
		c.push(f, 0, 0);
		view.render(c, (int) (width / f), (int) (height / f), (int) (mouseX / f), (int) (mouseY / f));
		c.pop();
	}

	@Override
	public boolean mouseClicked(Click click, boolean doubled) {
		return view.mouseClicked(mouseX(), mouseY(), click.button()) || super.mouseClicked(click, doubled);
	}

	@Override
	public boolean mouseScrolled(double mouseX, double mouseY, double horizontal, double vertical) {
		return view.mouseScrolled(vertical) || super.mouseScrolled(mouseX, mouseY, horizontal, vertical);
	}

	@Override
	public boolean keyPressed(KeyInput input) {
		int key = input.getKeycode();
		if (isMenuKey(key)) {
			menuKeyDown = true;
			typedWhileHeld = false;
			return true;
		}
		if (view.keyPressed(key)) return true;
		return super.keyPressed(input);
	}

	@Override
	public boolean keyReleased(KeyInput input) {
		if (isMenuKey(input.getKeycode()) && menuKeyDown) {
			menuKeyDown = false;
			if (!typedWhileHeld) close();
			return true;
		}
		return super.keyReleased(input);
	}

	private boolean isMenuKey(int key) {
		return key == KeyBindingHelper.getBoundKeyOf(mib.menuKey).getCode();
	}

	@Override
	public boolean charTyped(CharInput input) {
		if (!input.isValidChar()) return false;
		if (menuKeyDown) typedWhileHeld = true;
		boolean used = false;
		for (char ch : input.asString().toCharArray()) used |= view.charTyped(ch);
		return used || super.charTyped(input);
	}

	@Override
	public boolean shouldPause() {
		return false;
	}
}
