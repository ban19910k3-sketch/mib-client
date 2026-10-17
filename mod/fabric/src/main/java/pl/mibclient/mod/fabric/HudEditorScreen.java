package pl.mibclient.mod.fabric;

import net.minecraft.client.gui.MibGraphics;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;
import pl.mibclient.mod.core.HudEditorView;
//#if MC >= 1.21.9
import net.minecraft.client.input.MouseButtonEvent;
//#endif

/** Edytor HUD: gra widoczna pod spodem, elementy przesuwane myszką (jednostki GUI). */
public final class HudEditorScreen extends Screen {
	private final MibClient mib;
	private final HudEditorView chrome = new HudEditorView();
	private int frames;

	public HudEditorScreen(MibClient mib) {
		super(Component.literal("MiB HUD"));
		this.mib = mib;
	}

	int frames() {
		return frames;
	}

	//#if MC >= 26.1
	@Override
	public void extractBackground(MibGraphics g, int mouseX, int mouseY, float delta) {
		// bez rozmycia i przyciemnienia: HUD ma być widoczny na tle gry
	}

	@Override
	public void extractRenderState(MibGraphics g, int mouseX, int mouseY, float delta) {
		super.extractRenderState(g, mouseX, mouseY, delta);
		draw(g, mouseX, mouseY);
	}
	//#else
	@Override
	public void renderBackground(MibGraphics g, int mouseX, int mouseY, float delta) {
		// bez rozmycia i przyciemnienia: HUD ma być widoczny na tle gry
	}

	@Override
	public void render(MibGraphics g, int mouseX, int mouseY, float delta) {
		super.render(g, mouseX, mouseY, delta);
		draw(g, mouseX, mouseY);
	}
	//#endif

	private void draw(MibGraphics g, int mouseX, int mouseY) {
		frames++;
		FabricCanvas c = new FabricCanvas(g, font);
		mib.hud.render(c, mib.info, width, height, mib.editor, true);
		chrome.render(c, width, height, mouseX, mouseY);
	}

	private boolean click(int button) {
		double x = Input.guiX(minecraft), y = Input.guiY(minecraft);
		String b = chrome.click(x, y);
		if (HudEditorView.RESET.equals(b)) {
			mib.editor.resetAll();
			return true;
		}
		if (HudEditorView.DONE.equals(b)) {
			onClose();
			return true;
		}
		if (mib.editor.mouseDown(x, y, Input.button(button))) {
			String id = mib.editor.settingsRequest();
			if (id != null) minecraft.setScreen(new MenuScreen(mib, id));
			return true;
		}
		return false;
	}

	private void drag() {
		mib.editor.mouseDrag(Input.guiX(minecraft), Input.guiY(minecraft));
	}

	//#if MC >= 1.21.9
	@Override
	public boolean mouseClicked(MouseButtonEvent e, boolean doubled) {
		return click(e.button()) || super.mouseClicked(e, doubled);
	}

	@Override
	public boolean mouseDragged(MouseButtonEvent e, double offsetX, double offsetY) {
		drag();
		return true;
	}

	@Override
	public boolean mouseReleased(MouseButtonEvent e) {
		mib.editor.mouseUp();
		return super.mouseReleased(e);
	}
	//#else
	@Override
	public boolean mouseClicked(double x, double y, int button) {
		return click(button) || super.mouseClicked(x, y, button);
	}

	@Override
	public boolean mouseDragged(double x, double y, int button, double offsetX, double offsetY) {
		drag();
		return true;
	}

	@Override
	public boolean mouseReleased(double x, double y, int button) {
		mib.editor.mouseUp();
		return super.mouseReleased(x, y, button);
	}
	//#endif

	@Override
	public boolean mouseScrolled(double mouseX, double mouseY, double horizontal, double vertical) {
		return mib.editor.scroll(Input.guiX(minecraft), Input.guiY(minecraft), vertical) || super.mouseScrolled(mouseX, mouseY, horizontal, vertical);
	}

	/** Esc i „Gotowe” wracają do menu, nie do gry. */
	@Override
	public void onClose() {
		mib.editor.mouseUp();
		minecraft.setScreen(new MenuScreen(mib, null));
	}

	@Override
	public boolean isPauseScreen() {
		return false;
	}
}
