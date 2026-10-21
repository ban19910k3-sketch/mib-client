package pl.mibclient.mod.core;

/** Kolory ARGB jak tokeny launchera (style.css). */
public final class Theme {
	private Theme() {
	}

	/**
	 * Motyw Halloween (od 0.22.0, jak w launcherze): kolory dyni zamiast ametystu i dekoracje w menu (Halloween.java).
	 * false = zwykły motyw (druga wartość w każdym kolorze niżej).
	 */
	public static final boolean HALLOWEEN = true;

	public static final int VOID = HALLOWEEN ? 0xFF0A0507 : 0xFF07020C;
	public static final int SLAB = HALLOWEEN ? 0xFF140A0C : 0xFF100618;
	public static final int SLAB2 = HALLOWEEN ? 0xFF1F1013 : 0xFF190C25;
	public static final int EDGE = HALLOWEEN ? 0xFF33191B : 0xFF24133A;
	public static final int EDGE2 = HALLOWEEN ? 0xFF4C2822 : 0xFF3A2256;
	public static final int AM = HALLOWEEN ? 0xFFF97316 : 0xFFA855F7;
	public static final int AM_HI = HALLOWEEN ? 0xFFFDBA74 : 0xFFD6B0FF;
	public static final int AM_LO = HALLOWEEN ? 0xFFC2410C : 0xFF6D28D9;
	public static final int TEXT = HALLOWEEN ? 0xFFF7EDE6 : 0xFFEEE6F8;
	public static final int MUTED = HALLOWEEN ? 0xFFAD968A : 0xFF9A88AD;
	/** Najsłabszy tekst (liczniki, podpowiedzi). */
	public static final int FAINT = HALLOWEEN ? 0xFF7D665C : 0xFF6F5F82;
	public static final int BAD = 0xFFF0526B;
	/** Przyciemnienie gry pod menu. */
	public static final int DIM = HALLOWEEN ? 0xA00A0305 : 0xA0050010;
	/** Przełącznik i pigułka w stanie wyłączonym. */
	public static final int OFF = HALLOWEEN ? 0xFF2E1A16 : 0xFF2A1A3D;
	/** Jaśniejsza górna i ciemniejsza dolna linia przycisku (jak .b w launcherze) i przycisk pod kursorem. */
	public static final int BTN_HI = HALLOWEEN ? 0xFFFB923C : 0xFF8F52EC;
	public static final int BTN_LO = HALLOWEEN ? 0xFF7C2D12 : 0xFF4C1694;
	public static final int BTN_HOVER = HALLOWEEN ? 0xFFEA580C : 0xFF7C3AED;
	/** Tło włączonej karty modułu i linia nad jej przełącznikiem; linia między wierszami list. */
	public static final int CARD_ON = HALLOWEEN ? 0xFF1E0F0C : 0xFF160A24;
	public static final int CARD_ON_LINE = HALLOWEEN ? 0xFF5A2A14 : 0xFF3B1F5E;
	public static final int ROW_LINE = HALLOWEEN ? 0xFF1C0F0E : 0xFF150B20;
	/** Półprzezroczyste tło elementów HUD. */
	public static final int HUD_BG = HALLOWEEN ? 0x8C140A0C : 0x8C100618;
	public static final int GOOD = 0xFF4ADE80;
	public static final int WARN = 0xFFFACC15;
	public static final int RED = 0xFFF87171;
}
