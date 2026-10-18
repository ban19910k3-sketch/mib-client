package pl.mibclient.mod.fabric;

import com.mojang.blaze3d.platform.Window;
import net.minecraft.client.gui.MibGraphics;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;
import pl.mibclient.mod.core.MenuLayout;
import pl.mibclient.mod.core.MenuView;
//#if MC >= 1.21.9
import net.minecraft.client.input.CharacterEvent;
import net.minecraft.client.input.KeyEvent;
import net.minecraft.client.input.MouseButtonEvent;
//#endif

/** Menu pod prawym Shiftem: rysuje MenuView w jednostkach menu (całkowita liczba pikseli okna na jednostkę). */
public final class MenuScreen extends Screen {
	private final MibClient mib;
	private final MenuView view;
	/** Klawisz menu wciśnięty w tym ekranie; zamyka menu dopiero po puszczeniu, jeśli w międzyczasie nic nie wpisano (prawy Shift to też Shift do wielkich liter). */
	private boolean menuKeyDown, typedWhileHeld;
	private int frames;

	public MenuScreen(MibClient mib, String settingsFor) {
		super(Component.literal("MiB Client"));
		this.mib = mib;
		this.view = new MenuView(mib.modules, mib);
		if (settingsFor != null) view.openSettings(settingsFor);
	}

	public MenuView view() {
		return view;
	}

	int frames() {
		return frames;
	}

	/** Piksele okna na jednostkę menu. */
	public int menuScale() {
		Window w = minecraft.getWindow();
		return MenuLayout.scale(w.getWidth(), w.getHeight());
	}

	/** Jednostki GUI na jednostkę menu. */
	private float factor() {
		return menuScale() / (float) minecraft.getWindow().getGuiScale();
	}

	//#if MC >= 26.1
	// Od 26.1 gra włącza wpisywanie tekstu (litery, IME) tylko dla aktywnego pola tekstowego; menu ma wyszukiwarkę, więc cały czas
	@Override
	protected void init() {
		super.init();
		minecraft.onTextInputFocusChange(this, true);
	}

	@Override
	public void removed() {
		minecraft.onTextInputFocusChange(this, false);
		super.removed();
	}

	@Override
	public void extractRenderState(MibGraphics g, int mouseX, int mouseY, float delta) {
		super.extractRenderState(g, mouseX, mouseY, delta);
		draw(g, mouseX, mouseY);
	}
	//#else
	@Override
	public void render(MibGraphics g, int mouseX, int mouseY, float delta) {
		super.render(g, mouseX, mouseY, delta);
		draw(g, mouseX, mouseY);
	}
	//#endif

	private void draw(MibGraphics g, int mouseX, int mouseY) {
		frames++;
		float f = factor();
		FabricCanvas c = new FabricCanvas(g, font);
		c.push(f, 0, 0);
		view.render(c, (int) (width / f), (int) (height / f), (int) (mouseX / f), (int) (mouseY / f));
		c.pop();
	}

	private boolean click(int button) {
		float f = factor();
		return view.mouseClicked(Input.guiX(minecraft) / f, Input.guiY(minecraft) / f, Input.button(button));
	}

	private boolean key(int key) {
		if (key == MibClient.boundKey(mib.menuKey)) {
			menuKeyDown = true;
			typedWhileHeld = false;
			return true;
		}
		int k = Input.menuKey(key);
		return k != -1 && view.keyPressed(k);
	}

	private boolean keyUp(int key) {
		if (key != MibClient.boundKey(mib.menuKey) || !menuKeyDown) return false;
		menuKeyDown = false;
		if (!typedWhileHeld) onClose();
		return true;
	}

	private boolean chars(String s) {
		if (menuKeyDown) typedWhileHeld = true;
		boolean used = false;
		for (char ch : s.toCharArray()) used |= view.charTyped(ch);
		return used;
	}

	//#if MC >= 1.21.9
	@Override
	public boolean mouseClicked(MouseButtonEvent e, boolean doubled) {
		return click(e.button()) || super.mouseClicked(e, doubled);
	}

	@Override
	public boolean keyPressed(KeyEvent e) {
		return key(e.key()) || super.keyPressed(e);
	}

	@Override
	public boolean keyReleased(KeyEvent e) {
		return keyUp(e.key()) || super.keyReleased(e);
	}

	@Override
	public boolean charTyped(CharacterEvent e) {
		if (!e.isAllowedChatCharacter()) return false;
		return chars(e.codepointAsString()) || super.charTyped(e);
	}
	//#else
	@Override
	public boolean mouseClicked(double x, double y, int button) {
		return click(button) || super.mouseClicked(x, y, button);
	}

	@Override
	public boolean keyPressed(int key, int scan, int mods) {
		return key(key) || super.keyPressed(key, scan, mods);
	}

	@Override
	public boolean keyReleased(int key, int scan, int mods) {
		return keyUp(key) || super.keyReleased(key, scan, mods);
	}

	@Override
	public boolean charTyped(char ch, int mods) {
		return chars(String.valueOf(ch)) || super.charTyped(ch, mods);
	}
	//#endif

	@Override
	public boolean mouseScrolled(double mouseX, double mouseY, double horizontal, double vertical) {
		return view.mouseScrolled(vertical) || super.mouseScrolled(mouseX, mouseY, horizontal, vertical);
	}

	@Override
	public boolean isPauseScreen() {
		return false;
	}
}
