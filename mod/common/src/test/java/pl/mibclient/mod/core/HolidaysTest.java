package pl.mibclient.mod.core;

import static org.junit.jupiter.api.Assertions.*;

import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class HolidaysTest {
	/** Każda zmiana motywu w latach 2026–2028 (dzień przed i pierwszy dzień) według themeNow z lib/profile.js launchera. */
	private static final String[][] SAME_AS_LAUNCHER = {
			{"2026-01-01", "sylwester"}, {"2026-01-02", "boze"}, {"2026-01-01", "sylwester"}, {"2026-01-07", ""}, {"2026-01-06", "boze"}, {"2026-02-10", "walentynki"},
			{"2026-02-09", ""}, {"2026-02-16", ""}, {"2026-02-15", "walentynki"}, {"2026-03-29", "wielkanoc"}, {"2026-03-28", ""}, {"2026-04-01", "primaaprilis"},
			{"2026-03-31", "wielkanoc"}, {"2026-04-02", "wielkanoc"}, {"2026-04-01", "primaaprilis"}, {"2026-04-08", ""}, {"2026-04-07", "wielkanoc"}, {"2026-05-17", "urodzinymc"},
			{"2026-05-16", ""}, {"2026-05-18", ""}, {"2026-05-17", "urodzinymc"}, {"2026-06-01", "dziendziecka"}, {"2026-05-31", ""}, {"2026-06-02", ""},
			{"2026-06-01", "dziendziecka"}, {"2026-06-25", "wakacje"}, {"2026-06-24", ""}, {"2026-09-01", ""}, {"2026-08-31", "wakacje"}, {"2026-10-10", "urodzinymib"},
			{"2026-10-09", ""}, {"2026-10-15", "halloween"}, {"2026-10-14", "urodzinymib"}, {"2026-11-06", ""}, {"2026-11-05", "halloween"}, {"2026-11-08", "niepodleglosc"},
			{"2026-11-07", ""}, {"2026-11-13", ""}, {"2026-11-12", "niepodleglosc"}, {"2026-12-01", "boze"}, {"2026-11-30", ""}, {"2026-12-31", "sylwester"},
			{"2026-12-30", "boze"}, {"2027-01-02", "boze"}, {"2027-01-01", "sylwester"}, {"2027-01-07", ""}, {"2027-01-06", "boze"}, {"2027-02-10", "walentynki"},
			{"2027-02-09", ""}, {"2027-02-16", ""}, {"2027-02-15", "walentynki"}, {"2027-03-21", "wielkanoc"}, {"2027-03-20", ""}, {"2027-03-31", ""},
			{"2027-03-30", "wielkanoc"}, {"2027-04-01", "primaaprilis"}, {"2027-03-31", ""}, {"2027-04-02", ""}, {"2027-04-01", "primaaprilis"}, {"2027-05-17", "urodzinymc"},
			{"2027-05-16", ""}, {"2027-05-18", ""}, {"2027-05-17", "urodzinymc"}, {"2027-06-01", "dziendziecka"}, {"2027-05-31", ""}, {"2027-06-02", ""},
			{"2027-06-01", "dziendziecka"}, {"2027-06-25", "wakacje"}, {"2027-06-24", ""}, {"2027-09-01", ""}, {"2027-08-31", "wakacje"}, {"2027-10-10", "urodzinymib"},
			{"2027-10-09", ""}, {"2027-10-15", "halloween"}, {"2027-10-14", "urodzinymib"}, {"2027-11-06", ""}, {"2027-11-05", "halloween"}, {"2027-11-08", "niepodleglosc"},
			{"2027-11-07", ""}, {"2027-11-13", ""}, {"2027-11-12", "niepodleglosc"}, {"2027-12-01", "boze"}, {"2027-11-30", ""}, {"2027-12-31", "sylwester"},
			{"2027-12-30", "boze"}, {"2028-01-02", "boze"}, {"2028-01-01", "sylwester"}, {"2028-01-07", ""}, {"2028-01-06", "boze"}, {"2028-02-10", "walentynki"},
			{"2028-02-09", ""}, {"2028-02-16", ""}, {"2028-02-15", "walentynki"}, {"2028-04-01", "primaaprilis"}, {"2028-03-31", ""}, {"2028-04-02", ""},
			{"2028-04-01", "primaaprilis"}, {"2028-04-09", "wielkanoc"}, {"2028-04-08", ""}, {"2028-04-19", ""}, {"2028-04-18", "wielkanoc"}, {"2028-05-17", "urodzinymc"},
			{"2028-05-16", ""}, {"2028-05-18", ""}, {"2028-05-17", "urodzinymc"}, {"2028-06-01", "dziendziecka"}, {"2028-05-31", ""}, {"2028-06-02", ""},
			{"2028-06-01", "dziendziecka"}, {"2028-06-25", "wakacje"}, {"2028-06-24", ""}, {"2028-09-01", ""}, {"2028-08-31", "wakacje"}, {"2028-10-10", "urodzinymib"},
			{"2028-10-09", ""}, {"2028-10-15", "halloween"}, {"2028-10-14", "urodzinymib"}, {"2028-11-06", ""}, {"2028-11-05", "halloween"}, {"2028-11-08", "niepodleglosc"},
			{"2028-11-07", ""}, {"2028-11-13", ""}, {"2028-11-12", "niepodleglosc"}, {"2028-12-01", "boze"}, {"2028-11-30", ""},
	};

	@Test
	void datesLikeLauncher() {
		for (String[] r : SAME_AS_LAUNCHER) assertEquals(r[1], Holidays.today(LocalDate.parse(r[0])), r[0]);
	}

	@Test
	void easterLikeLauncher() {
		assertEquals(LocalDate.of(2025, 4, 20), Holidays.easter(2025));
		assertEquals(LocalDate.of(2026, 4, 5), Holidays.easter(2026));
		assertEquals(LocalDate.of(2027, 3, 28), Holidays.easter(2027));
		assertEquals(LocalDate.of(2028, 4, 16), Holidays.easter(2028));
		assertEquals(LocalDate.of(2030, 4, 21), Holidays.easter(2030));
	}

	/** Motyw od launchera (-Dmib.theme) ma pierwszeństwo przed datą; „none” = zwykły, nieznane id = według daty. */
	@Test
	void launcherPicks() {
		LocalDate halloween = LocalDate.of(2026, 10, 27);
		assertEquals("boze", Holidays.pick("boze", halloween));
		assertEquals("", Holidays.pick("none", halloween));
		assertEquals("halloween", Holidays.pick(null, halloween));
		assertEquals("halloween", Holidays.pick("../zle", halloween));
	}

	/** Kolory świąt: nieprzezroczyste tło i tekst, przyciemnienie półprzezroczyste; zwykły motyw bez zmian. */
	@Test
	void palettes() {
		for (String[] d : Holidays.DATES) {
			int[] p = Theme.palette(d[0]);
			assertEquals(20, p.length, d[0]);
			for (int i = 0; i < 11; i++) assertEquals(0xFF, p[i] >>> 24, d[0] + " kolor " + i);
			assertEquals(0xA0, p[11] >>> 24, d[0]);
			assertEquals(0x8C, p[19] >>> 24, d[0]);
		}
		assertEquals(0xFFA855F7, Theme.palette("")[5]);
		assertEquals(0xFFF97316, Theme.palette("halloween")[5]);
		assertEquals(0xFFEF4444, Theme.palette("boze")[5]);
	}

	/** Dekoracje każdego święta: rysują się dla prawdziwych czasów (także dużych) i różnych rozmiarów ekranu. */
	@Test
	void drawsEveryHoliday() {
		long[] times = {0L, 1234L, System.currentTimeMillis(), Long.MAX_VALUE / 2};
		for (String[] d : Holidays.DATES) {
			for (long t : times) {
				for (int[] size : new int[][] {{640, 360}, {427, 240}, {1920, 1080}}) {
					RecordingCanvas c = new RecordingCanvas();
					Holidays.screen(d[0], c, size[0], size[1], t, true);
					Holidays.screen(d[0], c, size[0], size[1], t, false);
					Holidays.menu(d[0], c, size[0], size[1], t);
					Holidays.loading(d[0], c, size[0], size[1], 0.5f);
					Holidays.badge(d[0], c, 10, 10);
				}
			}
		}
		RecordingCanvas none = new RecordingCanvas();
		Holidays.screen("", none, 640, 360, 0, true);
		Holidays.menu("", none, 640, 360, 0);
		assertEquals(0, none.fills.size(), "zwykły motyw bez ozdób");
	}
}
