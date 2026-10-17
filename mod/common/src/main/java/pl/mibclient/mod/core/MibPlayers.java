package pl.mibclient.mod.core;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeSet;
import java.util.UUID;

/**
 * Gracze MiB na serwerze (z players.json od launchera): logo MiB przed nickiem i ich peleryny.
 * Na serwerach z kontami Microsoft gracz ma prawdziwy UUID (wersja 4) i szukamy po nim; na serwerach bez kont
 * (UUID z nicku) zostaje tylko nick.
 */
public final class MibPlayers {
	public static final MibPlayers NONE = new MibPlayers(Collections.<Entry>emptyList());

	/** Gracz MiB: UUID konta, nick i założona peleryna (id albo null). */
	public static final class Entry {
		public final String uuid, name, cape;

		public Entry(String uuid, String name, String cape) {
			this.uuid = uuid;
			this.name = name;
			this.cape = cape;
		}
	}

	private final Map<String, Entry> byUuid = new HashMap<String, Entry>(), byName = new HashMap<String, Entry>();

	public MibPlayers(List<Entry> entries) {
		for (Entry e : entries) {
			byUuid.put(e.uuid.toLowerCase(Locale.ROOT), e);
			byName.put(e.name.toLowerCase(Locale.ROOT), e);
		}
	}

	public int size() {
		return byUuid.size();
	}

	/** Gracz MiB o tym UUID z gry i nicku albo null. */
	public Entry find(UUID uuid, String name) {
		if (uuid != null && uuid.version() == 4) return byUuid.get(uuid.toString());
		return name == null ? null : byName.get(name.toLowerCase(Locale.ROOT));
	}

	/** players.json: {"players":[{"uuid","name","cape"}]}; zły plik = brak graczy. */
	public static MibPlayers parse(String json) {
		Object v;
		try {
			v = Json.parse(json);
		} catch (RuntimeException e) {
			return NONE;
		}
		if (!(v instanceof Map) || !(((Map<?, ?>) v).get("players") instanceof List)) return NONE;
		List<Entry> out = new ArrayList<Entry>();
		for (Object o : (List<?>) ((Map<?, ?>) v).get("players")) {
			if (!(o instanceof Map)) continue;
			Map<?, ?> m = (Map<?, ?>) o;
			if (!(m.get("uuid") instanceof String) || !(m.get("name") instanceof String)) continue;
			Object cape = m.get("cape");
			out.add(new Entry((String) m.get("uuid"), (String) m.get("name"), cape instanceof String && validCapeId((String) cape) ? (String) cape : null));
		}
		return new MibPlayers(out);
	}

	/** Id peleryny bezpieczne jako nazwa pliku (jak w bazie: a-z, 0-9, _). */
	public static boolean validCapeId(String id) {
		return id != null && id.matches("[a-z0-9_]{2,32}");
	}

	/** Gracz z listy Tab: UUID z gry i nick. */
	public static final class Seen {
		public final UUID uuid;
		public final String name;

		public Seen(UUID uuid, String name) {
			this.uuid = uuid;
			this.name = name;
		}
	}

	/**
	 * Treść players-request.json dla launchera: UUID graczy z prawdziwymi kontami i nicki pozostałych,
	 * posortowane (ta sama lista = ten sam tekst), najwyżej po 200.
	 */
	public static String request(Collection<Seen> players) {
		TreeSet<String> ids = new TreeSet<String>(), names = new TreeSet<String>();
		for (Seen p : players) {
			if (p.uuid != null && p.uuid.version() == 4) ids.add(p.uuid.toString());
			else if (p.name != null && p.name.matches("[A-Za-z0-9_]{1,16}")) names.add(p.name);
		}
		Map<String, Object> m = new LinkedHashMap<String, Object>();
		m.put("ids", new ArrayList<String>(ids).subList(0, Math.min(200, ids.size())));
		m.put("names", new ArrayList<String>(names).subList(0, Math.min(200, names.size())));
		return Json.write(m);
	}
}
