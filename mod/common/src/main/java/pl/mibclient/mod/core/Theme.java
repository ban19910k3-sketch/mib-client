package pl.mibclient.mod.core;

/** Kolory ARGB jak tokeny launchera (style.css). */
public final class Theme {
	private Theme() {
	}

	/**
	 * Motyw świąteczny (od 0.25.0, jak w launcherze): id z ustawienia launchera (-Dmib.theme), a bez niego według dat
	 * (Holidays); "" = zwykły motyw (czerń i ametyst). Ustalany raz przy starcie gry. Kolory niżej: zwykłe, Halloween
	 * (od 0.22.0, dynia) albo kolory święta jak w style.css launchera; ozdoby rysuje Holidays.
	 */
	public static final String ID = Holidays.pick(System.getProperty("mib.theme"), java.time.LocalDate.now());
	public static final boolean HALLOWEEN = "halloween".equals(ID);

	/** Czy w tym dniu jest motyw Halloween (według wbudowanych dat). */
	public static boolean halloween(java.time.LocalDate d) {
		return "halloween".equals(Holidays.today(d));
	}

	/** Kolejność: VOID, SLAB, SLAB2, EDGE, EDGE2, AM, AM_HI, AM_LO, TEXT, MUTED, FAINT, DIM, OFF, BTN_HI, BTN_LO, BTN_HOVER, CARD_ON, CARD_ON_LINE, ROW_LINE, HUD_BG. */
	private static final int[] NORMAL = {0xFF07020C, 0xFF100618, 0xFF190C25, 0xFF24133A, 0xFF3A2256, 0xFFA855F7, 0xFFD6B0FF, 0xFF6D28D9, 0xFFEEE6F8, 0xFF9A88AD,
			0xFF6F5F82, 0xA0050010, 0xFF2A1A3D, 0xFF8F52EC, 0xFF4C1694, 0xFF7C3AED, 0xFF160A24, 0xFF3B1F5E, 0xFF150B20, 0x8C100618};
	private static final int[] PUMPKIN = {0xFF0A0507, 0xFF140A0C, 0xFF1F1013, 0xFF33191B, 0xFF4C2822, 0xFFF97316, 0xFFFDBA74, 0xFFC2410C, 0xFFF7EDE6, 0xFFAD968A,
			0xFF7D665C, 0xA00A0305, 0xFF2E1A16, 0xFFFB923C, 0xFF7C2D12, 0xFFEA580C, 0xFF1E0F0C, 0xFF5A2A14, 0xFF1C0F0E, 0x8C140A0C};

	/**
	 * Kolory świąt (te same co .t-&lt;id&gt; w style.css): VOID, SLAB, SLAB2, EDGE, EDGE2, AM, AM_HI, AM_LO, TEXT, MUTED i przycisk
	 * (--go-hi, --go-lo, --go); reszta wyliczona z nich.
	 */
	static int[] palette(String id) {
		if ("halloween".equals(id)) return PUMPKIN;
		int[] b;
		switch (id) {
			case "niepodleglosc": b = new int[] {0x0B0608, 0x150A0C, 0x200F12, 0x361619, 0x4F2026, 0xDC143C, 0xFECDD3, 0x9F1239, 0xFBF1F2, 0xB39598, 0xFB7185, 0x881337, 0xDC143C}; break;
			case "boze": b = new int[] {0x040D08, 0x08160E, 0x0D2116, 0x15331F, 0x204A2D, 0xEF4444, 0xFECACA, 0xB91C1C, 0xF1F8F3, 0x93AB9B, 0xF87171, 0x7F1D1D, 0xDC2626}; break;
			case "sylwester": b = new int[] {0x05040A, 0x0E0C15, 0x171420, 0x2A2434, 0x3D3449, 0xEAB308, 0xFDE68A, 0xA16207, 0xF8F5EA, 0xA69F8C, 0xFDE047, 0x854D0E, 0xCA8A04}; break;
			case "walentynki": b = new int[] {0x0C0509, 0x170A12, 0x22101B, 0x3A1729, 0x55203C, 0xF43F5E, 0xFDA4AF, 0xBE123C, 0xFDF0F4, 0xB8949F, 0xFB7185, 0x881337, 0xE11D48}; break;
			case "wielkanoc": b = new int[] {0x070A09, 0x0E1512, 0x15201B, 0x22352B, 0x30493C, 0x4ADE80, 0xBBF7D0, 0x15803D, 0xF2FAF5, 0x9DB3A6, 0x4ADE80, 0x14532D, 0x16A34A}; break;
			case "primaaprilis": b = new int[] {0x07020C, 0x100618, 0x190C25, 0x24133A, 0x3A2256, 0x22D3EE, 0xA5F3FC, 0x0E7490, 0xEEE6F8, 0x9A88AD, 0x22D3EE, 0x164E63, 0x0891B2}; break;
			case "urodzinymc": b = new int[] {0x070A05, 0x0F140B, 0x172012, 0x26331C, 0x3A4D2A, 0x6ABE30, 0xC5EC9F, 0x3F7A1A, 0xF2F8EC, 0x9FAE92, 0x86D14A, 0x2F5C14, 0x5A9E2A}; break;
			case "dziendziecka": b = new int[] {0x050812, 0x0B1120, 0x111A2E, 0x1C2A47, 0x283B63, 0x38BDF8, 0xBAE6FD, 0x0369A1, 0xEFF6FF, 0x93A4BD, 0x7DD3FC, 0x075985, 0x0284C7}; break;
			case "wakacje": b = new int[] {0x03090C, 0x071419, 0x0C1F26, 0x123440, 0x1B4A59, 0x06B6D4, 0xA5F3FC, 0x0E7490, 0xECFBFF, 0x8FB0BA, 0x22D3EE, 0x164E63, 0x0891B2}; break;
			default: return NORMAL; // zwykły motyw, urodziny MiB (ametyst MiB, inne są tylko ozdoby)
		}
		int[] p = new int[20];
		for (int i = 0; i < 10; i++) p[i] = 0xFF000000 | b[i];
		p[10] = mix(p[9], p[0], 0.35);
		p[11] = 0xA0000000 | (mix(p[0], 0xFF000000, 0.3) & 0xFFFFFF);
		p[12] = mix(p[3], p[4], 0.35);
		p[13] = 0xFF000000 | b[10];
		p[14] = 0xFF000000 | b[11];
		p[15] = 0xFF000000 | b[12];
		p[16] = mix(p[1], p[5], 0.06);
		p[17] = mix(p[4], p[5], 0.25);
		p[18] = mix(p[1], p[3], 0.4);
		p[19] = 0x8C000000 | (p[1] & 0xFFFFFF);
		return p;
	}

	static int mix(int a, int b, double t) {
		int out = 0;
		for (int sh = 0; sh < 32; sh += 8) {
			int x = (a >>> sh) & 0xFF, y = (b >>> sh) & 0xFF;
			out |= ((int) Math.round(x + (y - x) * t) & 0xFF) << sh;
		}
		return out;
	}

	private static final int[] P = palette(ID);

	public static final int VOID = P[0];
	public static final int SLAB = P[1];
	public static final int SLAB2 = P[2];
	public static final int EDGE = P[3];
	public static final int EDGE2 = P[4];
	public static final int AM = P[5];
	public static final int AM_HI = P[6];
	public static final int AM_LO = P[7];
	public static final int TEXT = P[8];
	public static final int MUTED = P[9];
	/** Najsłabszy tekst (liczniki, podpowiedzi). */
	public static final int FAINT = P[10];
	public static final int BAD = 0xFFF0526B;
	/** Przyciemnienie gry pod menu. */
	public static final int DIM = P[11];
	/** Przełącznik i pigułka w stanie wyłączonym. */
	public static final int OFF = P[12];
	/** Jaśniejsza górna i ciemniejsza dolna linia przycisku (jak .b w launcherze) i przycisk pod kursorem. */
	public static final int BTN_HI = P[13];
	public static final int BTN_LO = P[14];
	public static final int BTN_HOVER = P[15];
	/** Tło włączonej karty modułu i linia nad jej przełącznikiem; linia między wierszami list. */
	public static final int CARD_ON = P[16];
	public static final int CARD_ON_LINE = P[17];
	public static final int ROW_LINE = P[18];
	/** Półprzezroczyste tło elementów HUD. */
	public static final int HUD_BG = P[19];
	public static final int GOOD = 0xFF4ADE80;
	public static final int WARN = 0xFFFACC15;
	public static final int RED = 0xFFF87171;
}
