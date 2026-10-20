package pl.mibclient.mod.core;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Rozmowa z launcherem przez pliki w katalogu mib (tylko na tym komputerze):
 * accounts.json (launcher -> mod: konta bez tokenów), switch-request.json (mod -> launcher),
 * switch-result.json (launcher -> mod, tylko gdy zmiana konta się nie udała), kosmetyki (cosmetics.json,
 * cosmetic-request.json, cosmetic-result.json) i gracze MiB na serwerze (players-request.json od moda,
 * players.json i capes/ID.png od launchera), status.json (serwer dla znajomych) i notice.json (powiadomienie o znajomym).
 */
public final class LauncherBridge {
	private final File dir;

	public LauncherBridge(File dir) {
		this.dir = dir;
	}

	public List<Account> accounts() {
		Object v = read("accounts.json");
		if (!(v instanceof List)) return Collections.emptyList();
		List<Account> out = new ArrayList<Account>();
		for (Object o : (List<?>) v) {
			if (!(o instanceof Map)) continue;
			Map<?, ?> m = (Map<?, ?>) o;
			if (!(m.get("id") instanceof String) || !(m.get("name") instanceof String)) continue;
			out.add(new Account((String) m.get("id"), (String) m.get("name"), Boolean.TRUE.equals(m.get("active"))));
		}
		return out;
	}

	public void requestSwitch(String id) {
		Map<String, Object> m = new LinkedHashMap<String, Object>();
		m.put("id", id);
		m.put("at", System.currentTimeMillis());
		write("switch-request.json", m);
	}

	private void write(String name, Map<String, Object> m) {
		File f = new File(dir, name), tmp = new File(dir, name + ".tmp");
		try {
			Files.createDirectories(dir.toPath());
			Files.write(tmp.toPath(), Json.write(m).getBytes(StandardCharsets.UTF_8));
			Files.move(tmp.toPath(), f.toPath(), StandardCopyOption.REPLACE_EXISTING);
		} catch (IOException e) {
			tmp.delete();
		}
	}

	private byte[] cosBytes;
	private Cosmetics cosParsed;

	/** Kosmetyki z cosmetics.json albo null, gdy launcher jeszcze ich nie zapisał (plik parsowany tylko po zmianie). */
	public Cosmetics cosmetics() {
		byte[] b;
		try {
			File f = new File(dir, "cosmetics.json");
			b = f.isFile() ? Files.readAllBytes(f.toPath()) : null;
		} catch (IOException e) {
			b = null;
		}
		if (java.util.Arrays.equals(b, cosBytes)) return cosParsed;
		cosBytes = b;
		cosParsed = b == null ? null : parseCosmetics(b);
		return cosParsed;
	}

	private static Cosmetics parseCosmetics(byte[] bytes) {
		Object v;
		try {
			v = Json.parse(new String(bytes, StandardCharsets.UTF_8));
		} catch (RuntimeException e) {
			return null;
		}
		if (!(v instanceof Map)) return null;
		Map<?, ?> m = (Map<?, ?>) v;
		if (!Boolean.TRUE.equals(m.get("loggedIn"))) return Cosmetics.LOGGED_OUT;
		List<Cosmetics.Item> out = new ArrayList<Cosmetics.Item>();
		if (m.get("items") instanceof List) for (Object o : (List<?>) m.get("items")) {
			if (!(o instanceof Map)) continue;
			Map<?, ?> x = (Map<?, ?>) o;
			if (!(x.get("id") instanceof String) || !(x.get("name") instanceof String) || !(x.get("type") instanceof String)) continue;
			out.add(new Cosmetics.Item((String) x.get("id"), (String) x.get("name"), (String) x.get("type"), Boolean.TRUE.equals(x.get("equipped")),
					x.get("png") instanceof String ? (String) x.get("png") : null));
		}
		return new Cosmetics(true, out);
	}

	private String playersAsked;
	private byte[] playersBytes;
	private MibPlayers playersParsed = MibPlayers.NONE;

	/** Lista graczy z Tab do sprawdzenia przez launcher (zapis tylko po zmianie). */
	public void requestPlayers(String requestJson) {
		if (requestJson.equals(playersAsked)) return;
		File f = new File(dir, "players-request.json"), tmp = new File(dir, "players-request.json.tmp");
		try {
			Files.createDirectories(dir.toPath());
			Files.write(tmp.toPath(), requestJson.getBytes(StandardCharsets.UTF_8));
			Files.move(tmp.toPath(), f.toPath(), StandardCopyOption.REPLACE_EXISTING);
			playersAsked = requestJson;
		} catch (IOException e) {
			tmp.delete();
		}
	}

	/** Gracze MiB z players.json (plik parsowany tylko po zmianie). */
	public MibPlayers players() {
		byte[] b;
		try {
			File f = new File(dir, "players.json");
			b = f.isFile() ? Files.readAllBytes(f.toPath()) : null;
		} catch (IOException e) {
			b = null;
		}
		if (java.util.Arrays.equals(b, playersBytes)) return playersParsed;
		playersBytes = b;
		playersParsed = b == null ? MibPlayers.NONE : MibPlayers.parse(new String(b, StandardCharsets.UTF_8));
		return playersParsed;
	}

	/** Tekstura peleryny innego gracza MiB (PNG pobrany przez launcher) albo null. */
	public File capeFile(String id) {
		if (!MibPlayers.validCapeId(id)) return null;
		File f = new File(new File(dir, "capes"), id + ".png");
		return f.isFile() ? f : null;
	}

	/** Prośba do launchera: załóż (id) albo zdejmij (id = null) kosmetyk danego typu. */
	public void requestEquip(String type, String id) {
		Map<String, Object> m = new LinkedHashMap<String, Object>();
		m.put("type", type);
		m.put("id", id);
		m.put("at", System.currentTimeMillis());
		write("cosmetic-request.json", m);
	}

	/** Znajomi: serwer, na którym gracz właśnie gra (null = świat jednoosobowy); co kilka sekund, póki gracz jest w świecie. */
	public void writeStatus(String server, long now) {
		Map<String, Object> m = new LinkedHashMap<String, Object>();
		m.put("server", server);
		m.put("at", now);
		write("status.json", m);
	}

	/** Prośba do launchera: skopiuj ten zrzut ekranu do schowka (moduł Screenshot). */
	public void requestScreenshotCopy(String path) {
		Map<String, Object> m = new LinkedHashMap<String, Object>();
		m.put("path", path);
		m.put("at", System.currentTimeMillis());
		write("screenshot-request.json", m);
	}

	private byte[] noticeBytes;
	private Notice noticeParsed;

	/** Powiadomienie o znajomym z notice.json albo null (plik parsowany tylko po zmianie). */
	public Notice notice() {
		byte[] b;
		try {
			File f = new File(dir, "notice.json");
			b = f.isFile() ? Files.readAllBytes(f.toPath()) : null;
		} catch (IOException e) {
			b = null;
		}
		if (java.util.Arrays.equals(b, noticeBytes)) return noticeParsed;
		noticeBytes = b;
		noticeParsed = b == null ? null : Notice.parse(new String(b, StandardCharsets.UTF_8));
		return noticeParsed;
	}

	/** Komunikat o nieudanej zmianie kosmetyku zapisany później niż sinceMs albo null. */
	public String cosmeticFailure(long sinceMs) {
		return failureIn("cosmetic-result.json", sinceMs);
	}

	/** Komunikat o nieudanej zmianie konta zapisany później niż sinceMs albo null. */
	public String failure(long sinceMs) {
		return failureIn("switch-result.json", sinceMs);
	}

	private String failureIn(String file, long sinceMs) {
		Object v = read(file);
		if (!(v instanceof Map)) return null;
		Map<?, ?> m = (Map<?, ?>) v;
		Object at = m.get("at"), msg = m.get("message");
		if (Boolean.TRUE.equals(m.get("ok")) || !(at instanceof Number) || ((Number) at).longValue() <= sinceMs) return null;
		return msg instanceof String ? (String) msg : "";
	}

	private Object read(String name) {
		File f = new File(dir, name);
		if (!f.isFile()) return null;
		try {
			return Json.parse(new String(Files.readAllBytes(f.toPath()), StandardCharsets.UTF_8));
		} catch (IOException | RuntimeException e) {
			return null;
		}
	}
}
