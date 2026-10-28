package pl.mibclient.mod.fabric;

import java.util.List;
import net.fabricmc.fabric.api.client.screen.v1.ScreenEvents;
import net.fabricmc.fabric.api.client.screen.v1.Screens;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.MibGraphics;
import net.minecraft.client.gui.components.AbstractWidget;
import net.minecraft.client.gui.components.StringWidget;
import net.minecraft.client.gui.screens.PauseScreen;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.TitleScreen;
import net.minecraft.resources.MibId;
import pl.mibclient.mod.core.Halloween;
import pl.mibclient.mod.core.Holidays;
import pl.mibclient.mod.core.Theme;

/**
 * Logo MiB Client: na ekranie tytułowym zamiast logo Minecrafta (TitleScreenMixin) i w menu pauzy (Esc) zamiast
 * napisu „Menu gry”. Rozmiar dobierany do miejsca nad przyciskami. W motywie Halloween (Theme.HALLOWEEN) logo w kolorach
 * dyni; w każdym motywie świątecznym (Theme.ID, od 0.25.0) na ekranie tytułowym, w menu pauzy i na ekranie ładowania
 * dekoracje z Holidays.java (Halloween: Halloween.java).
 */
public final class Logo {
	private static final MibId TEXTURE = MibId.fromNamespaceAndPath("mibclient", Theme.HALLOWEEN ? "textures/gui/logo_halloween.png" : "textures/gui/logo.png");
	/** Proporcje obrazka logo (1126×157). */
	private static final float RATIO = 1126f / 157f;
	/** Górna krawędź przycisków ekranu tytułowego (ustawiana po jego otwarciu). */
	private static int titleTop = -1;

	private Logo() {
	}

	static void register() {
		ScreenEvents.AFTER_INIT.register((client, screen, width, height) -> {
			if (screen instanceof TitleScreen) {
				titleTop = top(screen, false);
				//#if MC >= 26.1
				if (!Theme.ID.isEmpty()) ScreenEvents.afterExtract(screen).register((s, g, mouseX, mouseY, delta) -> holiday(g, s.width, s.height, true));
				//#else
				if (!Theme.ID.isEmpty()) ScreenEvents.afterRender(screen).register((s, g, mouseX, mouseY, delta) -> holiday(g, s.width, s.height, true));
				//#endif
				return;
			}
			if (!(screen instanceof PauseScreen)) return;
			int top = top(screen, true);
			if (top == Integer.MAX_VALUE) return; // menu bez przycisków (F3+Esc)
			int[] box = fit(width, 4, top - 6, 44);
			//#if MC >= 26.1
			ScreenEvents.afterExtract(screen).register((s, g, mouseX, mouseY, delta) -> {
			//#else
			ScreenEvents.afterRender(screen).register((s, g, mouseX, mouseY, delta) -> {
			//#endif
				if (!Theme.ID.isEmpty()) holiday(g, s.width, s.height, false);
				draw(g, box, 1f);
			});
		});
	}

	/**
	 * Górna krawędź przycisków menu (bez małych ikon, np. znajomych w rogu); hideTitle chowa napis z tytułem ekranu
	 * (w menu pauzy jego miejsce zajmuje logo).
	 */
	private static int top(Screen screen, boolean hideTitle) {
		//#if MC >= 26.1
		List<AbstractWidget> widgets = Screens.getWidgets(screen);
		//#else
		List<AbstractWidget> widgets = Screens.getButtons(screen);
		//#endif
		int top = Integer.MAX_VALUE;
		AbstractWidget title = null;
		for (AbstractWidget w : widgets) {
			if (w instanceof StringWidget && w.getMessage().equals(screen.getTitle())) title = w;
			else if (w.visible && w.getWidth() >= 90) top = Math.min(top, w.getY());
		}
		// bez przycisków (pauza przez F3+Esc) napis zostaje — nie ma miejsca na logo
		if (hideTitle && title != null && top != Integer.MAX_VALUE) title.visible = false;
		return top;
	}

	/** Logo między y0 a y1 (wyśrodkowane), najwyżej maxH wysokości i z marginesem 8 po bokach: {x, y, w, h}. */
	static int[] fit(int screenWidth, int y0, int y1, int maxH) {
		int h = Math.max(8, Math.min(maxH, y1 - y0));
		int w = Math.round(h * RATIO);
		if (w > screenWidth - 16) {
			w = Math.max(16, screenWidth - 16);
			h = Math.round(w / RATIO);
		}
		return new int[] {(screenWidth - w) / 2, y0 + Math.max(0, (y1 - y0 - h) / 2), w, h};
	}

	/** Ekran tytułowy: zamiast logo Minecrafta, nad przyciskami. */
	public static void drawTitle(MibGraphics g, int screenWidth, float alpha) {
		MibClient.hooks.add("title-logo");
		int top = Input.screen(Minecraft.getInstance()) instanceof TitleScreen && titleTop > 0 && titleTop != Integer.MAX_VALUE
				? titleTop : Minecraft.getInstance().getWindow().getGuiScaledHeight() / 4 + 48;
		draw(g, fit(screenWidth, 10, top - 8, 56), alpha);
	}

	static void draw(MibGraphics g, int[] box, float alpha) {
		MibClient.hooks.add("logo");
		if ("primaaprilis".equals(Theme.ID)) {
			// Prima Aprilis (od 0.25.0): logo do góry nogami, jak mob z imieniem Dinnerbone — rysowane wierszami od dołu obrazka
			MibClient.hooks.add("logo_upside_down");
			for (int r = 0; r < box[3]; r++) FabricCanvas.blit(g, TEXTURE, box[0], box[1] + r, 0, box[3] - 1 - r, box[2], 1, box[2], box[3], argb(alpha, 0xFFFFFF));
			return;
		}
		FabricCanvas.blit(g, TEXTURE, box[0], box[1], 0, 0, box[2], box[3], box[2], box[3], argb(alpha, 0xFFFFFF));
	}

	/** Motyw Halloween: zmrok i księżyc na panoramie menu (zaraz po niej, pod przyciskami). */
	public static void dusk(MibGraphics g) {
		if (!Theme.HALLOWEEN) return;
		MibClient.hooks.add("halloween_dusk");
		Halloween.dusk(new FabricCanvas(g, Minecraft.getInstance().font), g.guiWidth(), g.guiHeight());
	}

	/** Dekoracje motywu świątecznego na brzegach ekranu tytułowego (title) albo menu pauzy. */
	private static void holiday(MibGraphics g, int w, int h, boolean title) {
		MibClient.hooks.add((Theme.HALLOWEEN ? "halloween" : "holiday") + (title ? "_title" : "_pause"));
		Holidays.screen(Theme.ID, new FabricCanvas(g, Minecraft.getInstance().font), w, h, System.currentTimeMillis(), title);
	}

	static int argb(float alpha, int rgb) {
		return (Math.round(Math.max(0f, Math.min(1f, alpha)) * 255) << 24) | (rgb & 0xFFFFFF);
	}

	// ===== Ekran ładowania (start gry i wczytywanie paczek zasobów) =====

	/** Tło ekranu ładowania zamiast czerwieni Mojang Studios. */
	public static final int LOADING_BACKGROUND = Theme.ID.isEmpty() ? 0x0B0412 : Theme.VOID & 0xFFFFFF;
	private static final float LOADING_RATIO = 1126f / 175f;
	private static MibId loadingTexture;
	private static boolean loadingFailed;

	/**
	 * Logo i napis MiB Client (obrazek loading.png, bez numeru wersji), lekko „oddychające”. Tekstura z pliku moda wczytywana przy pierwszym rysowaniu
	 * (zasoby gry mogą być wtedy jeszcze w trakcie wczytywania). alpha &lt; 0: przezroczystość ustawiła już gra (1.21–1.21.1).
	 */
	public static void drawLoading(MibGraphics g, float alpha) {
		MibClient.hooks.add("loading");
		if (loadingTexture == null && !loadingFailed) {
			try (java.io.InputStream in = Logo.class.getResourceAsStream(Theme.HALLOWEEN ? "/assets/mibclient/textures/gui/loading_halloween.png" : "/assets/mibclient/textures/gui/loading.png")) {
				loadingTexture = in == null ? null : MibClient.registerTexture("loading", in.readAllBytes());
			} catch (java.io.IOException e) {
				loadingTexture = null;
			}
			loadingFailed = loadingTexture == null;
		}
		if (loadingTexture == null) return;
		int sw = g.guiWidth(), sh = g.guiHeight();
		double t = (System.currentTimeMillis() % 2400L) / 2400.0;
		float pulse = 1f + 0.025f * (float) Math.sin(t * 2 * Math.PI);
		int w = Math.round(Math.min(sw * 0.62f, 330f) * pulse), h = Math.round(w / LOADING_RATIO);
		int x = (sw - w) / 2, y = Math.round(sh * 0.46f) - h / 2;
		//#if MC >= 1.21.2
		FabricCanvas.blit(g, loadingTexture, x, y, 0, 0, w, h, w, h, argb(alpha, 0xFFFFFF));
		//#else
		if (alpha >= 0) FabricCanvas.blit(g, loadingTexture, x, y, 0, 0, w, h, w, h, argb(alpha, 0xFFFFFF));
		else g.blit(loadingTexture, x, y, 0, 0, w, h, w, h);
		//#endif
		if (!Theme.ID.isEmpty()) {
			MibClient.hooks.add(Theme.HALLOWEEN ? "halloween_loading" : "holiday_loading");
			Holidays.loading(Theme.ID, new FabricCanvas(g, Minecraft.getInstance().font), sw, sh, alpha < 0 ? 1f : alpha);
		}
	}

	/** Pasek postępu w kolorach MiB (zamiast białego). */
	public static void drawLoadingBar(MibGraphics g, int x1, int y1, int x2, int y2, float progress, float alpha) {
		int a = Math.round(Math.max(0f, Math.min(1f, alpha)) * 255) << 24;
		int fill = Math.round((x2 - x1 - 4) * Math.max(0f, Math.min(1f, progress)));
		g.fill(x1, y1, x2, y2, a | (Theme.EDGE & 0xFFFFFF));
		g.fill(x1 + 1, y1 + 1, x2 - 1, y2 - 1, a | (Theme.SLAB & 0xFFFFFF));
		if (fill > 0) {
			g.fill(x1 + 2, y1 + 2, x1 + 2 + fill, y2 - 2, a | (Theme.AM & 0xFFFFFF));
			g.fill(x1 + 2, y1 + 2, x1 + 2 + fill, y1 + 3, a | (Theme.AM_HI & 0xFFFFFF));
		}
	}
}
