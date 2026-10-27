package pl.mibclient.mod.core;

import java.time.LocalDate;

/**
 * Motywy świąteczne w grze (od 0.25.0). Motyw wybiera launcher (themes.js, daty z panelu admina) i podaje go grze jako
 * -Dmib.theme; bez niego (stary launcher) liczą go wbudowane daty — te same co DEFAULT_THEMES w lib/profile.js, Wielkanoc
 * liczona co roku. Dekoracje świąt poza Halloween (Halloween.java): ozdoby przy brzegach ekranu (girlanda, choinka,
 * flaga…) i cząsteczki (płatki śniegu, serca, fajerwerki…) liczone z samego czasu, bez stanu. Rysowane pikselami przez
 * Canvas, jak reszta menu, tylko przy brzegach i półprzezroczyste, żeby nie zasłaniać przycisków.
 */
public final class Holidays {
	/** Id, początek i koniec: MM-DD albo E±n (dni od Wielkanocy); koniec przed początkiem = przez Nowy Rok. */
	static final String[][] DATES = {{"niepodleglosc", "11-08", "11-12"}, {"boze", "12-01", "01-06"}, {"sylwester", "12-31", "01-01"},
			{"walentynki", "02-10", "02-15"}, {"wielkanoc", "E-7", "E+2"}, {"primaaprilis", "04-01", "04-01"}, {"urodzinymc", "05-17", "05-17"},
			{"dziendziecka", "06-01", "06-01"}, {"wakacje", "06-25", "08-31"}, {"urodzinymib", "10-10", "10-14"}, {"halloween", "10-15", "11-05"}};

	private Holidays() {
	}

	public static boolean valid(String id) {
		for (String[] d : DATES) if (d[0].equals(id)) return true;
		return false;
	}

	/** Motyw z ustawienia launchera (-Dmib.theme: id albo „none”), a bez niego według wbudowanych dat; "" = zwykły. */
	public static String pick(String property, LocalDate d) {
		if ("none".equals(property)) return "";
		if (property != null && valid(property)) return property;
		return today(d);
	}

	/** Wielkanoc w roku y (algorytm Meeusa/Jonesa/Butchera, jak easter w lib/profile.js). */
	public static LocalDate easter(int y) {
		int a = y % 19, b = y / 100, c = y % 100, d = b / 4, e = b % 4, f = (b + 8) / 25, g = (b - f + 1) / 3;
		int h = (19 * a + b - d - g + 15) % 30, i = c / 4, k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = (a + 11 * h + 22 * l) / 451;
		return LocalDate.of(y, (h + l - 7 * m + 114) / 31, (h + l - 7 * m + 114) % 31 + 1);
	}

	static LocalDate date(String spec, int y) {
		if (spec.charAt(0) == 'E') return easter(y).plusDays(Integer.parseInt(spec.substring(1)));
		return LocalDate.of(y, Integer.parseInt(spec.substring(0, 2)), 1).plusDays(Integer.parseInt(spec.substring(3, 5)) - 1);
	}

	/** Okres motywu, który trwa w dniu d albo zaczyna się najbliższy po nim: {od, do}. */
	static LocalDate[] span(String starts, String ends, LocalDate d) {
		for (int y = d.getYear() - 1; y <= d.getYear() + 1; y++) {
			LocalDate from = date(starts, y), to = date(ends, y);
			if (to.isBefore(from)) to = date(ends, y + 1);
			if (!to.isBefore(d)) return new LocalDate[] {from, to};
		}
		return null;
	}

	/** Motyw w dniu d według wbudowanych dat: z trwających ten najkrótszy (Sylwester na wierzchu Bożego Narodzenia); "" = zwykły. */
	public static String today(LocalDate d) {
		String best = "";
		long len = Long.MAX_VALUE;
		for (String[] t : DATES) {
			LocalDate[] sp = span(t[1], t[2], d);
			if (sp == null || d.isBefore(sp[0])) continue;
			long n = sp[1].toEpochDay() - sp[0].toEpochDay();
			if (n < len) {
				best = t[0];
				len = n;
			}
		}
		return best;
	}

	// ===== Obrazki: wiersze znaków i paleta „znak=RRGGBB” (jak ozdoby launchera w themes.js) =====

	static final class Sprite {
		final String[][] frames;
		final int[] pal = new int[128];

		Sprite(String pal, String[]... frames) {
			this.frames = frames;
			for (String p : pal.split(" ")) this.pal[p.charAt(0)] = 0xFF000000 | Integer.parseInt(p.substring(2), 16);
		}

		int w() {
			return frames[0][0].length();
		}

		int h() {
			return frames[0].length;
		}
	}

	private static Sprite sp(String pal, String... rows) {
		return new Sprite(pal, rows);
	}

	static final Sprite FLAKE = sp("W=FFFFFF i=BFDBFE", "W.W.W", ".WiW.", "WiWiW", ".WiW.", "W.W.W");
	static final Sprite HEART = sp("R=F43F5E E=FDA4AF", ".RR.RR.", "REERRRR", "RERRRRR", "RRRRRRR", ".RRRRR.", "..RRR..", "...R...");
	static final Sprite HEART2 = sp("R=EC4899 E=FBCFE8", ".RR.RR.", "REERRRR", "RERRRRR", "RRRRRRR", ".RRRRR.", "..RRR..", "...R...");
	static final Sprite BUTTERFLY = new Sprite("V=C4B5FD k=3B1660", new String[] {"V...V", "VV.VV", ".VkV.", "VV.VV", "V...V"},
			new String[] {".....", ".V.V.", "VVkVV", ".V.V.", "....."});
	static final Sprite BUTTERFLY2 = new Sprite("V=FDE68A k=78350F", BUTTERFLY.frames);
	static final Sprite GRASS = sp("A=6ABE30 a=4B8A22 D=8B5A2B d=5E3A1A", "AAAAA", "AaAAa", "DDdDD", "DdDDD", "DDDDd");
	static final Sprite[] BALLOONS = balloons();
	static final Sprite BUBBLE = sp("b=A5F3FC", ".b.", "b.b", ".b.");

	private static Sprite[] balloons() {
		String[] colors = {"EF4444", "FACC15", "38BDF8", "A855F7", "22C55E"};
		Sprite[] out = new Sprite[colors.length];
		for (int i = 0; i < colors.length; i++)
			out[i] = sp("B=" + colors[i] + " W=FFFFFF s=E5E7EB", ".BBB.", "BBBBB", "BWBBB", "BBBBB", ".BBB.", "..B..", "..s..", "..s..", "..s..");
		return out;
	}

	// ozdoby przy brzegach ekranu
	static final Sprite FLAG = new Sprite("W=F8FAFC R=DC143C p=A8A29E",
			new String[] {"p.........", "pWWWWWWWW.", "pWWWWWWWWW", "pWWWWWWWWW", "pRRRRRRRRR", "pRRRRRRRRR", "pRRRRRRRR.", "p.........", "p.........", "p.........", "p.........", "p........."},
			new String[] {"p.........", "pWWWWWWWWW", "pWWWWWWWWW", "pWWWWWWWW.", "pRRRRRRRRR", "pRRRRRRRR.", "pRRRRRRRRR", "p.........", "p.........", "p.........", "p.........", "p........."});
	static final Sprite BUNTING_PL = sp("W=F8FAFC R=DC143C", "WWW.RRR.", ".W...R..");
	static final Sprite LIGHTS = new Sprite("k=1F3A27 R=EF4444 Y=FACC15 G=22C55E B=38BDF8",
			new String[] {"kkk.......kkk.", "...kkk.kkk....", "......R.......", ".....RRR......", "......R......."},
			new String[] {"kkk.......kkk.", "...kkk.kkk....", "......Y.......", ".....YYY......", "......Y......."});
	static final Sprite TREE = new Sprite("G=15803D Y=FACC15 y=FEF3C7 R=EF4444 B=38BDF8 b=78350F",
			new String[] {"......Y......", ".....YYY.....", "......G......", ".....GGG.....", "....GGRGG....", "...GGGGGGG...", "....GGGGG....", "...GGYGGGG...", "..GGGGGGRGG..",
					".GGGGGGGGGGG.", "...GGGGGGG...", "..GGBGGGGGG..", ".GGGGGGGYGGG.", "GGGGGGGGGGGGG", ".....bbb.....", ".....bbb....."},
			new String[] {"......y......", ".....yyy.....", "......G......", ".....GGG.....", "....GGYGG....", "...GGGGGGG...", "....GGGGG....", "...GGRGGGG...", "..GGGGGGBGG..",
					".GGGGGGGGGGG.", "...GGGGGGG...", "..GGYGGGGGG..", ".GGGGGGGRGGG.", "GGGGGGGGGGGGG", ".....bbb.....", ".....bbb....."});
	static final Sprite GIFTS = sp("R=DC2626 g=16A34A Y=FACC15", "..Y.....Y..", ".RYR...gYg.", "RRYRR.ggYgg", "YYYYY.YYYYY", "RRYRR.ggYgg", "RRYRR.ggYgg");
	static final Sprite STARS = sp("Y=FACC15", "..........", "....Y.....", "...YYY....", "....Y.....", "..........");
	static final Sprite BOTTLE = sp("g=14532D Y=FACC15 K=0B0610", "...gg...", "...YY...", "...gg...", "..gggg..", ".gggggg.", ".gYYYYg.", ".gYKKYg.", ".gYYYYg.", ".gggggg.", ".gggggg.",
			".gggggg.", ".gggggg.");
	static final Sprite CLOCK = sp("k=FACC15 W=F8FAFC", "..kkkkk..", ".kWWkWWk.", "kWWWkWWWk", "kWWWkWWWk", "kkWWkWWkk", "kWWWWWWWk", "kWWWWWWWk", ".kWWkWWk.", "..kkkkk..");
	static final Sprite HEARTS_ROW = sp("R=F43F5E", "............", "..RR.RR.....", ".RRRRRRR....", "..RRRRR.....", "...RRR......", "....R.......");
	static final Sprite BIG_HEART = new Sprite("R=E11D48 E=FDA4AF",
			new String[] {".RR...RR.", "REER.RRRR", "RERRRRRRR", "RRRRRRRRR", ".RRRRRRR.", "..RRRRR..", "...RRR...", "....R...."},
			new String[] {".........", ".RR...RR.", "REERRRRRR", "RERRRRRRR", ".RRRRRRR.", "..RRRRR..", "...RRR...", "....R...."});
	static final Sprite BASKET = sp("M=EC4899 Y=FACC15 q=38BDF8 W=FFFFFF R=EF4444 X=C9A24A x=92702C", "..M..Y..q..", ".MMMYYYqqq.", ".MWMYRYqWq.", "xXxXxXxXxXx",
			"XxXxXxXxXxX", ".xXxXxXxXx.", "..XxXxXxX..");
	static final Sprite BUNNY = sp("W=F8FAFC S=F9A8D4 k=1C1424", ".W.W..", ".WSWS.", ".W.W..", "WWWW..", "WkWWW.", "WWWWW.", ".WWWWW", ".WWWWW", "WW.WW.");
	static final Sprite JESTER = sp("R=EF4444 Q=22D3EE Y=FACC15", "Y.....Y", "RR...QQ", "RRR.QQQ", ".RRQQQ.", "YYYYYYY");
	static final Sprite BLOCKS = sp("A=6ABE30 a=4B8A22 D=8B5A2B d=5E3A1A", "AAAAAAAAAAAAAAAAAAAAAAAA", "AaAAaAAaAAAaAAaAAaAAaAAa", "DDaDDDDDaDDDDDaDDDDaDDDD",
			"DdDDDdDDDDdDDDdDDDDdDDDd", "DDDdDDDDdDDDdDDDDdDDDdDD", "DdDDDDdDDDDDDdDDDdDDDDDD");
	static final Sprite BALLOON_BUNCH = sp("R=EF4444 Y=FACC15 Q=38BDF8 W=FFFFFF s=E5E7EB", ".RR..YY..QQ.", "RRRRYYYYQQQQ", "RWRRYWYYQWQQ", "RRRRYYYYQQQQ", ".RR..YY..QQ.",
			"..s...s...s.", "...s..s..s..", "....s.s.s...", ".....sss....", "......s.....", "......s.....");
	static final Sprite SUN = new Sprite("u=FDE047 Y=FB923C",
			new String[] {"..Y..Y..Y..", "...........", "Y..uuuuu..Y", "..uuuuuuu..", "..uuuuuuu..", "Y.uuuuuuu.Y", "..uuuuuuu..", "..uuuuuuu..", "Y..uuuuu..Y", "...........",
					"..Y..Y..Y.."},
			new String[] {"...........", ".Y...Y...Y.", "...uuuuu...", "Y.uuuuuuu.Y", "..uuuuuuu..", "..uuuuuuu..", "..uuuuuuu..", "Y.uuuuuuu.Y", "...uuuuu...", ".Y...Y...Y.",
					"..........."});
	static final Sprite PALM = sp("g=15803D b=7C4A21 X=F2D78A", ".gg.gg.", "gggggg.", ".ggbgg.", "g..b..g", "...b...", "...b...", "...b...", "..bb...", "..b....", "XXXXXXX");
	static final Sprite BUNTING = sp("P=A855F7 Y=FACC15 S=F472B6 C=22D3EE", "PPP.YYY.SSS.CCC.", ".P...Y...S...C..");
	static final Sprite CAKE = new Sprite("O=F97316 u=FDE047 v=A855F7 S=FBCFE8 s=F472B6 B=8B5A2B L=FEF3C7",
			new String[] {"....O....", "....v....", "....v....", "SSSSSSSSS", "SsSSsSSsS", "BBBBBBBBB", "LLLLLLLLL", "BBBBBBBBB"},
			new String[] {"....u....", "....v....", "....v....", "SSSSSSSSS", "SsSSsSSsS", "BBBBBBBBB", "LLLLLLLLL", "BBBBBBBBB"});
	static final Sprite MINI_FLAG = sp("W=F8FAFC R=DC143C", "WWWWW", "WWWWW", "RRRRR", "RRRRR");
	static final Sprite MINI_TREE = sp("G=15803D Y=FACC15 b=78350F", "..Y..", "..G..", ".GGG.", "GGGGG", "..b..");
	static final Sprite MINI_STAR = sp("Y=FACC15", "..Y..", ".YYY.", "YYYYY", ".YYY.", ".Y.Y.");
	static final Sprite EGG = sp("M=F9A8D4 W=FFFFFF Y=FDE68A", ".MM.", "MWWM", "YYYY", "MMMM", ".MM.");
	static final Sprite SMILE = sp("Q=22D3EE k=0B0610", ".QQQ.", "QkQkQ", "QQQQQ", "QkkkQ", ".QQQ.");
	static final Sprite MINI_HEART = sp("R=F43F5E", "RR.RR", "RRRRR", "RRRRR", ".RRR.", "..R..");
	static final Sprite MINI_BALLOON = sp("B=EF4444 W=FFFFFF s=E5E7EB", ".BBB.", "BWBBB", "BBBBB", ".BBB.", "..s..", "..s..");
	static final Sprite MINI_SUN = sp("u=FDE047 Y=FB923C", "Y.Y.Y", ".uuu.", "YuuuY", ".uuu.", "Y.Y.Y");
	static final Sprite MINI_CAKE = sp("O=F97316 S=FBCFE8 B=8B5A2B", "..O..", "SSSSS", "BBBBB", "SSSSS", "BBBBB");

	// ===== Dekoracje =====

	private static int size(int w, int h) {
		return Math.max(28, Math.min(64, Math.min(w, h) / 6));
	}

	/**
	 * Ekran tytułowy (title = true) i menu pauzy w motywie id: ozdoby przy brzegach i cząsteczki (w pauzie mniej, żeby
	 * nie przeszkadzały). Halloween rysuje Halloween.screen, zwykły motyw nic.
	 */
	public static void screen(String id, Canvas c, int w, int h, long timeMs, boolean title) {
		if ("halloween".equals(id)) {
			Halloween.screen(c, w, h, timeMs, title);
			return;
		}
		if (!valid(id)) return;
		particles(id, c, w, h, timeMs, title ? 1f : 0.5f);
		edges(id, c, w, h, timeMs);
	}

	/** Menu pod prawym Shiftem (po przyciemnieniu gry, przed panelem). */
	public static void menu(String id, Canvas c, int w, int h, long timeMs) {
		if ("halloween".equals(id)) {
			Halloween.menu(c, w, h, timeMs);
			return;
		}
		if (!valid(id)) return;
		particles(id, c, w, h, timeMs, 0.8f);
		edges(id, c, w, h, timeMs);
	}

	/** Ekran ładowania gry: same ozdoby przy brzegach (alpha: gra ściemnia ekran ładowania na końcu). */
	public static void loading(String id, Canvas c, int w, int h, float alpha) {
		if ("halloween".equals(id)) {
			Halloween.loading(c, w, h, alpha);
			return;
		}
		if (!valid(id)) return;
		edges(id, Halloween.faded(c, alpha), w, h, 0);
	}

	/** Mały obrazek za napisem „MiB Client” w menu (jak dynia w Halloween); (x, y) to lewy górny róg. */
	public static void badge(String id, Canvas c, int x, int y) {
		if ("halloween".equals(id)) {
			Halloween.pumpkin(c, x, y, 1);
			return;
		}
		Sprite s = "niepodleglosc".equals(id) ? MINI_FLAG : "boze".equals(id) ? MINI_TREE : "sylwester".equals(id) ? MINI_STAR : "walentynki".equals(id) ? MINI_HEART
				: "wielkanoc".equals(id) ? EGG : "primaaprilis".equals(id) ? SMILE : "urodzinymc".equals(id) ? GRASS : "dziendziecka".equals(id) ? MINI_BALLOON
				: "wakacje".equals(id) ? MINI_SUN : "urodzinymib".equals(id) ? MINI_CAKE : null;
		if (s != null) draw(c, s, 0, x, y + Math.max(0, 6 - s.h()), 1, 1f);
	}

	/** Ozdoby przy brzegach: pas u góry (girlanda, lampki…) i obrazki w lewym dolnym rogu. */
	static void edges(String id, Canvas c, int w, int h, long timeMs) {
		int k = Math.max(2, size(w, h) / 16), kt = Math.max(1, k * 2 / 3), f = (int) ((timeMs / 600) % 2);
		int x = 6;
		if ("niepodleglosc".equals(id)) {
			row(c, BUNTING_PL, w, kt);
			draw(c, FLAG, f, x, h - FLAG.h() * k - 4, k, 1f);
		} else if ("boze".equals(id)) {
			row(c, LIGHTS, f, w, kt);
			x = bottom(c, TREE, f, x, h, k);
			bottom(c, GIFTS, 0, x, h, k);
		} else if ("sylwester".equals(id)) {
			row(c, STARS, w, kt);
			x = bottom(c, BOTTLE, 0, x, h, k);
			bottom(c, CLOCK, 0, x, h, k);
		} else if ("walentynki".equals(id)) {
			row(c, HEARTS_ROW, w, kt);
			bottom(c, BIG_HEART, f, x, h, k);
		} else if ("wielkanoc".equals(id)) {
			x = bottom(c, BASKET, 0, x, h, k);
			bottom(c, BUNNY, 0, x, h, k);
		} else if ("primaaprilis".equals(id)) {
			bottom(c, JESTER, 0, x, h, k);
		} else if ("urodzinymc".equals(id)) {
			bottom(c, BLOCKS, 0, x, h, k);
		} else if ("dziendziecka".equals(id)) {
			bottom(c, BALLOON_BUNCH, 0, x, h, k);
		} else if ("wakacje".equals(id)) {
			draw(c, SUN, f, 6, 6, k, 1f);
			bottom(c, PALM, 0, x, h, k);
		} else if ("urodzinymib".equals(id)) {
			row(c, BUNTING, w, kt);
			bottom(c, CAKE, f, x, h, k);
		}
	}

	/** Obrazek przy dolnej krawędzi od x; zwraca x następnego (z odstępem). */
	private static int bottom(Canvas c, Sprite s, int frame, int x, int h, int k) {
		draw(c, s, frame, x, h - s.h() * k - 4, k, 1f);
		return x + (s.w() + 2) * k;
	}

	private static void row(Canvas c, Sprite s, int w, int k) {
		row(c, s, 0, w, k);
	}

	/** Pas obrazków przez całą szerokość u góry ekranu. */
	private static void row(Canvas c, Sprite s, int frame, int w, int k) {
		for (int x = 0; x < w; x += s.w() * k) draw(c, s, frame, x, 0, k, 0.85f);
	}

	/**
	 * Cząsteczki motywu: każda liczona z czasu i swojego numeru (bez stanu), więc nie trzeba ich nigdzie trzymać.
	 * amount: część pełnej liczby (w pauzie mniej).
	 */
	static void particles(String id, Canvas c, int w, int h, long timeMs, float amount) {
		double t = (timeMs % 3_600_000L) / 1000.0;
		int n = Math.round(Math.max(8, Math.min(48, w * h / 7000)) * amount);
		if ("sylwester".equals(id)) {
			fireworks(c, w, h, t);
			return;
		}
		Sprite[] set;
		boolean rise = false;
		float a = 0.8f;
		if ("boze".equals(id)) set = new Sprite[] {FLAKE};
		else if ("walentynki".equals(id)) {
			set = new Sprite[] {HEART, HEART2};
			rise = true;
			n = n / 2;
		} else if ("wielkanoc".equals(id)) {
			set = new Sprite[] {BUTTERFLY, BUTTERFLY2};
			n = n / 3;
		} else if ("urodzinymc".equals(id)) {
			set = new Sprite[] {GRASS};
			n = n / 2;
		} else if ("dziendziecka".equals(id)) {
			set = BALLOONS;
			rise = true;
			n = n / 3;
			a = 0.9f;
		} else if ("wakacje".equals(id)) {
			set = new Sprite[] {BUBBLE};
			rise = true;
			a = 0.6f;
		} else {
			// Niepodległość, Prima Aprilis, urodziny MiB: konfetti
			confetti(c, w, h, t, n, id);
			return;
		}
		for (int i = 0; i < n; i++) {
			double v = 8 + 14 * rnd(i, 2), travel = h + 24, pos = (t * v + rnd(i, 1) * travel) % travel;
			Sprite s = set[i % set.length];
			int x = (int) Math.round(rnd(i, 3) * (w - s.w()) + Math.sin(t * 0.8 + i) * 6);
			int y = (int) Math.round(rise ? h + 12 - pos : pos - 12);
			draw(c, s, (int) ((long) (t * 3 + i) % s.frames.length), x, y, 1, a);
		}
	}

	private static final int[][] CONFETTI = {{0xFFFFFFFF, 0xFFDC143C, 0xFFF43F5E, 0xFFFECDD3}, {0xFF22D3EE, 0xFFF472B6, 0xFFFACC15, 0xFFA3E635},
			{0xFFA855F7, 0xFFFACC15, 0xFFF472B6, 0xFF22D3EE}};

	/** Spadające konfetti: małe prostokąty, które „obracają się” (raz szersze, raz wyższe). */
	private static void confetti(Canvas c, int w, int h, double t, int n, String id) {
		int[] cols = CONFETTI["niepodleglosc".equals(id) ? 0 : "primaaprilis".equals(id) ? 1 : 2];
		for (int i = 0; i < n; i++) {
			double v = 10 + 16 * rnd(i, 2), travel = h + 10, pos = (t * v + rnd(i, 1) * travel) % travel;
			int x = (int) Math.round(rnd(i, 3) * w + Math.sin(t * 1.3 + i) * 5), y = (int) Math.round(pos - 5);
			boolean wide = ((long) (t * 4 + i)) % 2 == 0;
			c.fill(x, y, x + (wide ? 2 : 1), y + (wide ? 1 : 2), (0xCC << 24) | (cols[i % cols.length] & 0xFFFFFF));
		}
	}

	private static final int[] SPARK = {0xFFFACC15, 0xFF22D3EE, 0xFFF472B6, 0xFFFFFFFF};

	/** Fajerwerki: co 0,9 s wybuch w górnej części ekranu; 14 iskier rozlatuje się, opada i gaśnie w 1,4 s. */
	private static void fireworks(Canvas c, int w, int h, double t) {
		long slot = (long) Math.floor(t / 0.9);
		for (long s = slot - 1; s <= slot; s++) {
			double age = t - s * 0.9;
			if (age < 0 || age > 1.4) continue;
			int cx = (int) Math.round(w * (0.1 + 0.8 * rnd((int) s, 7))), cy = (int) Math.round(h * (0.08 + 0.32 * rnd((int) s, 8)));
			int col = SPARK[(int) (Math.abs(s) % SPARK.length)], alpha = (int) Math.round(255 * (1 - age / 1.4));
			double r = 6 + age * Math.min(w, h) / 9.0;
			for (int j = 0; j < 14; j++) {
				double ang = j * Math.PI * 2 / 14, fall = 10 * age * age;
				int x = (int) Math.round(cx + Math.cos(ang) * r), y = (int) Math.round(cy + Math.sin(ang) * r + fall);
				c.fill(x, y, x + 2, y + 2, (alpha << 24) | (col & 0xFFFFFF));
				// smuga za iskrą
				int tx = (int) Math.round(cx + Math.cos(ang) * r * 0.7), ty = (int) Math.round(cy + Math.sin(ang) * r * 0.7 + fall);
				c.fill(tx, ty, tx + 1, ty + 1, ((alpha / 2) << 24) | 0xFFFFFF);
			}
		}
	}

	/** Liczba 0–1 z numeru cząsteczki i soli (zawsze ta sama dla tych samych liczb). */
	static double rnd(int i, int salt) {
		int x = i * 0x9E3779B1 + salt * 0x85EBCA6B;
		x ^= x >>> 16;
		x *= 0x7FEB352D;
		x ^= x >>> 15;
		x *= 0x846CA68B;
		x ^= x >>> 16;
		return (x >>> 8) / (double) (1 << 24);
	}

	static void draw(Canvas c, Sprite s, int frame, int x, int y, int k, float alpha) {
		String[] rows = s.frames[Math.floorMod(frame, s.frames.length)];
		for (int j = 0; j < rows.length; j++) {
			String r = rows[j];
			for (int i = 0; i < r.length(); i++) {
				char ch = r.charAt(i);
				int col = ch < 128 ? s.pal[ch] : 0;
				if (col == 0) continue;
				if (alpha < 1f) col = (Math.round(255 * alpha) << 24) | (col & 0xFFFFFF);
				c.fill(x + i * k, y + j * k, x + (i + 1) * k, y + (j + 1) * k, col);
			}
		}
	}
}
