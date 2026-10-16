package pl.mibclient.mod.core;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;

class HudEditorViewTest {
	@Test
	void buttonsAreClickableAfterRender() {
		Lang.setGame("pl_pl");
		HudEditorView v = new HudEditorView();
		RecordingCanvas c = new RecordingCanvas();
		v.render(c, 480, 270, -1, -1);
		assertTrue(c.hasText("Przywróć domyślne"));
		assertTrue(c.hasText("Gotowe"));
		RecordingCanvas.Text reset = c.text("Przywróć domyślne"), done = c.text("Gotowe");
		assertEquals(HudEditorView.RESET, v.click(reset.x + 1, reset.y + 1));
		assertEquals(HudEditorView.DONE, v.click(done.x + 1, done.y + 1));
		assertNull(v.click(5, 100));
		assertTrue(reset.y > 200, "przyciski na dole ekranu");
	}
}
