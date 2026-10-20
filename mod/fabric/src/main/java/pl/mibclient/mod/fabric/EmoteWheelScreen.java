package pl.mibclient.mod.fabric;

import net.minecraft.client.gui.MibGraphics;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;
import pl.mibclient.mod.core.EmoteWheel;
//#if MC >= 1.21.9
import net.minecraft.client.input.KeyEvent;
import net.minecraft.client.input.MouseButtonEvent;
//#endif

/**
 * Koło emotek: otwiera się po przytrzymaniu klawisza emotek (domyślnie B). Puszczenie klawisza albo kliknięcie
 * włącza emotkę wskazaną myszą; Esc albo puszczenie w środku koła zamyka bez emotki.
 */
public final class EmoteWheelScreen extends Screen {
	private final Extras extras;
	private final EmoteWheel wheel = new EmoteWheel();

	public EmoteWheelScreen(Extras extras) {
		super(Component.literal("MiB Emotes"));
		this.extras = extras;
	}

	public EmoteWheel wheel() {
		return wheel;
	}

	//#if MC >= 26.1
	@Override
	public void extractBackground(MibGraphics g, int mouseX, int mouseY, float delta) {
		// bez rozmycia: postać i świat widać przez koło
	}

	@Override
	public void extractRenderState(MibGraphics g, int mouseX, int mouseY, float delta) {
		super.extractRenderState(g, mouseX, mouseY, delta);
		draw(g, mouseX, mouseY);
	}
	//#else
	@Override
	public void renderBackground(MibGraphics g, int mouseX, int mouseY, float delta) {
		// bez rozmycia: postać i świat widać przez koło
	}

	@Override
	public void render(MibGraphics g, int mouseX, int mouseY, float delta) {
		super.render(g, mouseX, mouseY, delta);
		draw(g, mouseX, mouseY);
	}
	//#endif

	private void draw(MibGraphics g, int mouseX, int mouseY) {
		MibClient.hooks.add("emote_wheel");
		wheel.render(new FabricCanvas(g, font), width, height, Input.guiX(minecraft), Input.guiY(minecraft));
	}

	/** Emotka wskazana teraz myszą (-1 = żadna) i jej włączenie. */
	private void choose() {
		MibClient.hooks.add("emote_wheel_pick");
		int i = wheel.pick(width, height, Input.guiX(minecraft), Input.guiY(minecraft));
		onClose();
		if (i >= 0) extras.playEmote(wheel.id(i));
	}

	private boolean keyUp(int key) {
		if (key != MibClient.boundKey(extras.emoteKey)) return false;
		choose();
		return true;
	}

	//#if MC >= 1.21.9
	@Override
	public boolean mouseClicked(MouseButtonEvent e, boolean doubled) {
		if (e.button() != 0) return super.mouseClicked(e, doubled);
		choose();
		return true;
	}

	@Override
	public boolean keyReleased(KeyEvent e) {
		return keyUp(e.key()) || super.keyReleased(e);
	}
	//#else
	@Override
	public boolean mouseClicked(double x, double y, int button) {
		if (button != 0) return super.mouseClicked(x, y, button);
		choose();
		return true;
	}

	@Override
	public boolean keyReleased(int key, int scan, int mods) {
		return keyUp(key) || super.keyReleased(key, scan, mods);
	}
	//#endif

	@Override
	public boolean isPauseScreen() {
		return false;
	}
}
