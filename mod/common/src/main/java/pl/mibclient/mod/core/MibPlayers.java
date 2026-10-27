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

	/** Gracz MiB: UUID konta, nick i założone kosmetyki (id albo null): peleryna, czapka, skrzydła, aura, maska. */
	public static final class Entry {
		public final String uuid, name, cape, hat, wings, aura, mask;

		public Entry(String uuid, String name, String cape) {
			this(uuid, name, cape, null, null, null, null);
		}

		public Entry(String uuid, String name, String cape, String hat, String wings, String aura) {
			this(uuid, name, cape, hat, wings, aura, null);
		}

		public Entry(String uuid, String name, String cape, String hat, String wings, String aura, String mask) {
			this.uuid = uuid;
			this.name = name;
			this.cape = cape;
			this.hat = hat;
			this.wings = wings;
			this.aura = aura;
			this.mask = mask;
		}

		/** Id założonego kosmetyku danego typu (cape, hat, mask, wings, aura) albo null. */
		public String cosmetic(String type) {
			return "cape".equals(type) ? cape : "hat".equals(type) ? hat : "wings".equals(type) ? wings : "aura".equals(type) ? aura : "mask".equals(type) ? mask : null;
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

	/** players.json: {"players":[{"uuid","name","cape","hat","mask","wings","aura"}]}; zły plik = brak graczy. */
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
			out.add(new Entry((String) m.get("uuid"), (String) m.get("name"), id(m.get("cape")), id(m.get("hat")), id(m.get("wings")), id(m.get("aura")), id(m.get("mask"))));
		}
		return new MibPlayers(out);
	}

	private static String id(Object v) {
		return v instanceof String && validCapeId((String) v) ? (String) v : null;
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
