package pl.mibclient.mod.core;

import java.util.Collections;
import java.util.List;

/** Kosmetyki z profilu MiB (z launchera): czy gracz ma profil i jego przedmioty. */
public final class Cosmetics {
	public static final Cosmetics LOGGED_OUT = new Cosmetics(false, Collections.<Item>emptyList());

	public final boolean loggedIn;
	public final List<Item> items;

	public Cosmetics(boolean loggedIn, List<Item> items) {
		this.loggedIn = loggedIn;
		this.items = Collections.unmodifiableList(items);
	}

	/** Przedmiot: id, nazwa, typ (cape, hat, wings), czy założony i tekstura PNG (base64, tylko peleryny). */
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
		for (Item i : items) if ("cape".equals(i.type) && i.equipped) return i;
		return null;
	}
}
