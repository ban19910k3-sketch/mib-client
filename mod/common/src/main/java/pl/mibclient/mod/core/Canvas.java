package pl.mibclient.mod.core;

/**
 * Rysowanie niezależne od wersji gry. Każda kopia moda (1.21.11, 1.8.9, 1.12.2) daje własną implementację,
 * a menu, edytor HUD i HUD modułów rysują się tylko przez ten interfejs.
 */
public interface Canvas {
	/** Prostokąt [x1, x2) × [y1, y2). */
	void fill(int x1, int y1, int x2, int y2, int argb);

	void text(String s, int x, int y, int argb, boolean shadow);

	int textWidth(String s);

	/** Wysokość linii tekstu (font Minecrafta: 9). */
	int lineHeight();

	/** Skalowanie wokół punktu (ox, oy): wszystko do pop() rysuje się powiększone. */
	void push(float scale, int ox, int oy);

	void pop();

	void scissor(int x1, int y1, int x2, int y2);

	void unscissor();

	/** Przedmiot z gry (ItemStack danej wersji) w polu 16×16. */
	void item(Object stack, int x, int y);

	/** Ikona efektu mikstury 18×18 (uchwyt z GameInfo.Effect). */
	void effectIcon(Object handle, int x, int y);

	/** Postać gracza w prostokącie [x1, x2) × [y1, y2), patrząca przed siebie (Player model); size = skala modelu. */
	default void player(int x1, int y1, int x2, int y2, int size) {
	}

	/** Postać gracza obrócona o yaw stopni (0 = przodem, 180 = tyłem), np. podgląd kosmetyków w menu. */
	default void playerTurned(int x1, int y1, int x2, int y2, int size, float yaw) {
		player(x1, y1, x2, y2, size);
	}
}
