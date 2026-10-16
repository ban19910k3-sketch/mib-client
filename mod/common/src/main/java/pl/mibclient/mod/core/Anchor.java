package pl.mibclient.mod.core;

/** Róg, krawędź albo środek ekranu, od którego liczy się pozycja elementu HUD. */
public enum Anchor {
	TOP_LEFT(0, 0), TOP(1, 0), TOP_RIGHT(2, 0),
	LEFT(0, 1), CENTER(1, 1), RIGHT(2, 1),
	BOTTOM_LEFT(0, 2), BOTTOM(1, 2), BOTTOM_RIGHT(2, 2);

	/** 0 = lewo/góra, 1 = środek, 2 = prawo/dół. */
	public final int col, row;

	Anchor(int col, int row) {
		this.col = col;
		this.row = row;
	}

	public static Anchor of(int col, int row) {
		for (Anchor a : values()) if (a.col == col && a.row == row) return a;
		throw new IllegalArgumentException(col + "," + row);
	}

	/** Nazwa z pliku albo null, gdy nieznana. */
	public static Anchor parse(Object name) {
		if (!(name instanceof String)) return null;
		for (Anchor a : values()) if (a.name().equals(name)) return a;
		return null;
	}
}
