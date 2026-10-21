package pl.mibclient.mod.core;

import java.util.Collections;
import java.util.List;

/** Kosmetyki z profilu MiB (z launchera): czy gracz ma profil, jego przedmioty i prezenty od MiB do odebrania. */
public final class Cosmetics {
	public static final Cosmetics LOGGED_OUT = new Cosmetics(false, Collections.<Item>emptyList());

	public final boolean loggedIn;
	public final List<Item> items;
	public final List<Gift> gifts;

	public Cosmetics(boolean loggedIn, List<Item> items) {
		this(loggedIn, items, Collections.<Gift>emptyList());
	}

	public Cosmetics(boolean loggedIn, List<Item> items, List<Gift> gifts) {
		this.loggedIn = loggedIn;
		this.items = Collections.unmodifiableList(items);
		this.gifts = Collections.unmodifiableList(gifts);
	}

	/** Prezent od MiB: kosmetyk, który trafi na profil po „Odbierz” (w launcherze albo w menu gry), z wiadomością twórcy. */
	public static final class Gift {
		public final long id;
		public final String name, type, message;

		public Gift(long id, String name, String type, String message) {
			this.id = id;
			this.name = name;
			this.type = type;
			this.message = message;
		}
	}

	/** Animowana tekstura: klatka co tyle ms (tak samo w launcherze: CAPE_FRAME_MS w lib/profile.js). */
	public static final int FRAME_MS = 100, MAX_FRAMES = 32;

	/** Liczba klatek tekstury w×h (klatki 2:1 jedna pod drugą, szerokość 64–512) albo 0, gdy rozmiar jest zły. */
	public static int frames(int w, int h) {
		if (w % 64 != 0 || w < 64 || w > 512 || h <= 0 || h % (w / 2) != 0) return 0;
		int n = h / (w / 2);
		return n <= MAX_FRAMES ? n : 0;
	}

	/** Skrzydła z tekstury szerokiej na co najmniej 128 pikseli są jak u wróżki (od 0.22.0), węższe jak elytra (tak samo w launcherze). */
	public static boolean fairyWings(int width) {
		return width >= 128;
	}

	/** Klatka do pokazania w chwili timeMs dla tekstury o n klatkach. */
	public static int frame(int n, long timeMs) {
		return n <= 1 ? 0 : (int) ((timeMs / FRAME_MS) % n);
	}

	/** Przedmiot: id, nazwa, typ (cape, hat, wings, aura), czy założony i tekstura PNG (base64; do przymiarki także niezałożone). */
	public static final class Item {
		public final String id, name, type, png;
		public final boolean equipped;

		public Item(String id, String name, String type, boolean equipped, String png) {
			this.id = id;
			this.name = name;
			this.type = type;
			this.equipped = equipped;
			this.png = png;
		}
	}

	/** Założona peleryna albo null. */
	public Item equippedCape() {
		return equipped("cape");
	}

	/** Założony przedmiot danego typu (cape, hat, wings, aura) albo null. */
	public Item equipped(String type) {
		for (Item i : items) if (type.equals(i.type) && i.equipped) return i;
		return null;
	}
}
