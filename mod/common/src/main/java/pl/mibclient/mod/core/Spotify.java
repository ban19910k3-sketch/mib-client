package pl.mibclient.mod.core;

import java.util.Map;

/**
 * Spotify z komputera (od 0.40.0): stan od launchera z spotify.json — utwór z aplikacji Spotify na Windows (sesje
 * multimediów), pozycja w chwili at i plik okładki z mib/spotify. Menu pod prawym Shiftem pokazuje odtwarzacz albo okno
 * „Zaloguj się w Spotify”; polecenia (toggle, next, prev, open) idą do launchera w spotify-request.json.
 */
public final class Spotify {
	/** Spotify nie gra (zamknięte, niezalogowane albo nic jeszcze nie włączono). */
	public static final Spotify OFF = new Spotify("off", null, null, null, 0, 0, 0, null);
	/** Plik starszy niż tyle ms (launcher zamknięty) liczy się jak OFF. */
	public static final long STALE_MS = 15000;

	public final String state, title, artist, album, cover;
	public final long position, duration, at;

	public Spotify(String state, String title, String artist, String album, long position, long duration, long at, String cover) {
		this.state = "playing".equals(state) || "paused".equals(state) || "unsupported".equals(state) ? state : "off";
		this.title = title;
		this.artist = artist;
		this.album = album;
		this.position = Math.max(0, position);
		this.duration = Math.max(0, duration);
		this.at = at;
		this.cover = cover;
	}

	/** Gra albo jest pauza: jest utwór i przyciski. */
	public boolean ready() {
		return "playing".equals(state) || "paused".equals(state);
	}

	public boolean playing() {
		return "playing".equals(state);
	}

	/** Spotify z komputera działa tylko na Windows (launcher na innym systemie zgłasza „unsupported”). */
	public boolean unsupported() {
		return "unsupported".equals(state);
	}

	/** Pozycja utworu teraz (przy odtwarzaniu dolicza czas od zapisu pliku, nie dalej niż koniec). */
	public long positionAt(long now) {
		long p = playing() ? position + Math.max(0, now - at) : position;
		return duration > 0 ? Math.min(p, duration) : p;
	}

	/** Czas jak w odtwarzaczach: m:ss (albo h:mm:ss). */
	public static String time(long ms) {
		long s = Math.max(0, ms) / 1000, h = s / 3600, m = s / 60 % 60, sec = s % 60;
		return (h > 0 ? h + ":" + (m < 10 ? "0" : "") : "") + m + ":" + (sec < 10 ? "0" : "") + sec;
	}

	/** Stan z spotify.json albo null (zły plik); plik sprzed STALE_MS to OFF. */
	public static Spotify parse(String json, long now) {
		Object v;
		try {
			v = Json.parse(json);
		} catch (RuntimeException e) {
			return null;
		}
		if (!(v instanceof Map)) return null;
		Map<?, ?> m = (Map<?, ?>) v;
		long at = m.get("at") instanceof Number ? ((Number) m.get("at")).longValue() : 0;
		if (Math.abs(now - at) > STALE_MS) return OFF;
		String cover = m.get("cover") instanceof String && LauncherBridge.validImageName((String) m.get("cover")) ? (String) m.get("cover") : null;
		return new Spotify(str(m.get("state")), str(m.get("title")), str(m.get("artist")), str(m.get("album")), num(m.get("position")), num(m.get("duration")), at, cover);
	}

	private static String str(Object o) {
		return o instanceof String && !((String) o).trim().isEmpty() ? ((String) o).replaceAll("§.?", "").trim() : null;
	}

	private static long num(Object o) {
		return o instanceof Number ? ((Number) o).longValue() : 0;
	}
}
