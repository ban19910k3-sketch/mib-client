package pl.mibclient.mod.fabric;

import net.minecraft.client.gui.Click;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.text.Text;
import pl.mibclient.mod.core.HudEditorView;

/** Edytor HUD: gra widoczna pod spodem, elementy przesuwane myszką (jednostki GUI). */
public final class HudEditorScreen extends Screen {
	private final MibClient mib;
	private final HudEditorView chrome = new HudEditorView();

	public HudEditorScreen(MibClient mib) {
		super(Text.literal("MiB HUD"));
		this.mib = mib;
	}

	private double mx() {
		return client.mouse.getScaledX(client.getWindow());
	}

	private double my() {
		return client.mouse.getScaledY(client.getWindow());
	}

	@Override
	public void renderBackground(DrawContext ctx, int mouseX, int mouseY, float delta) {
		// bez rozmycia i przyciemnienia: HUD ma być widoczny na tle gry
	}

	@Override
	public void render(DrawContext ctx, int mouseX, int mouseY, float delta) {
		super.render(ctx, mouseX, mouseY, delta);
		FabricCanvas c = new FabricCanvas(ctx, textRenderer);
		mib.hud.render(c, mib.info, width, height, mib.editor, true);
		chrome.render(c, width, height, mouseX, mouseY);
	}

	@Override
	public boolean mouseClicked(Click click, boolean doubled) {
		String b = chrome.click(mx(), my());
		if (HudEditorView.RESET.equals(b)) {
			mib.editor.resetAll();
			return true;
		}
		if (HudEditorView.DONE.equals(b)) {
			close();
			return true;
		}
		if (mib.editor.mouseDown(mx(), my(), click.button())) {
			String id = mib.editor.settingsRequest();
			if (id != null) client.setScreen(new MenuScreen(mib, id));
			return true;
		}
		return super.mouseClicked(click, doubled);
	}

	@Override
	public boolean mouseDragged(Click click, double offsetX, double offsetY) {
		mib.editor.mouseDrag(mx(), my());
		return true;
	}

	@Override
	public boolean mouseReleased(Click click) {
		mib.editor.mouseUp();
		return super.mouseReleased(click);
	}

	@Override
	public boolean mouseScrolled(double mouseX, double mouseY, double horizontal, double vertical) {
		return mib.editor.scroll(mx(), my(), vertical) || super.mouseScrolled(mouseX, mouseY, horizontal, vertical);
	}

	/** Esc i „Gotowe” wracają do menu, nie do gry. */
	@Override
	public void close() {
		mib.editor.mouseUp();
		client.setScreen(new MenuScreen(mib, null));
	}

	@Override
	public boolean shouldPause() {
		return false;
	}
}
