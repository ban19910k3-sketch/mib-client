package pl.mibclient.mod.core;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * Znajomi z profilu MiB (z launchera, friends.json) i rozmowa z jednym z nich (chat.json): menu pod prawym Shiftem
 * pokazuje listę i pozwala pisać. Wiadomości wysyła i pobiera launcher.
 */
public final class Friends {
	public static final Friends LOGGED_OUT = new Friends(false, Collections.<Friend>emptyList());
	/** Najdłuższa wiadomość (tak samo w bazie: message_send). */
	public static final int MAX_MESSAGE = 500;
	/** Najdłuższa wiadomość na czacie party (w bazie: party_send). */
	public static final int MAX_PARTY_MESSAGE = 300;

	public final boolean loggedIn;
	public final List<Friend> list;

	public Friends(boolean loggedIn, List<Friend> list) {
		this.loggedIn = loggedIn;
		this.list = Collections.unmodifiableList(list);
	}

	/** Suma nieprzeczytanych wiadomości (licznik przy przycisku „Znajomi”). */
	public int unread() {
		int n = 0;
		for (Friend f : list) n += f.unread;
		return n;
	}

	public Friend get(String id) {
		for (Friend f : list) if (f.id.equals(id)) return f;
		return null;
	}

	/** Id wpisu party na liście (od 0.38.0): rozmowa z nim to czat party. */
	public static final String PARTY = "party";

	/**
	 * Znajomy: status "game" (w grze, server może być null), "launcher" albo "offline". Party (od 0.38.0) to wpis
	 * z id "party": status i serwer lidera, members = członkowie w jednej linii (lider pierwszy, z gwiazdką).
	 */
	public static final class Friend {
		public final String id, nick, status, server, members;
		public final int unread;
		public final boolean party;
		/** Nazwa konta Minecraft (od 0.40.0): główka skina przy nicku z mib/heads/&lt;mc&gt;.png; null = bez konta Minecraft. */
		public String mc;

		/** Plik główki od launchera (małe litery) albo null. */
		public String headFile() {
			return mc == null ? null : mc.toLowerCase(java.util.Locale.ROOT) + ".png";
		}

		public Friend(String id, String nick, String status, String server, int unread) {
			this(id, nick, status, server, unread, false, null);
		}

		public Friend(String id, String nick, String status, String server, int unread, boolean party, String members) {
			this.id = id;
			this.nick = nick;
			this.status = "game".equals(status) || "launcher".equals(status) ? status : "offline";
			this.server = server;
			this.unread = Math.max(0, unread);
			this.party = party && PARTY.equals(id);
			this.members = this.party ? members : null;
		}

		/** Opis pod nickiem: „W grze · serwer”, „W launcherze” albo „Offline”; przy party członkowie (i serwer lidera). */
		public String statusText() {
			if (party) return (members != null ? members : "") + (server != null ? " · " + server : "");
			if ("game".equals(status)) return Lang.t("friends.game") + (server != null ? " · " + server : "");
			return Lang.t("launcher".equals(status) ? "friends.launcher" : "friends.offline");
		}
	}

	/** Wiadomość: moja albo od znajomego; pending = wysłana z gry, launcher jeszcze jej nie potwierdził. */
	public static final class Message {
		public final long id;
		public final boolean mine, read, pending;
		public final String body;

		public Message(long id, boolean mine, String body, boolean read, boolean pending) {
			this.id = id;
			this.mine = mine;
			this.body = body;
			this.read = read;
			this.pending = pending;
		}
	}

	/** Rozmowa z jednym znajomym (with = jego id) zapisana przez launcher w chwili at. */
	public static final class Chat {
		public final String with;
		public final long at;
		public final List<Message> messages;

		public Chat(String with, long at, List<Message> messages) {
			this.with = with;
			this.at = at;
			this.messages = Collections.unmodifiableList(messages);
		}

		/** Ta sama rozmowa z dopisanymi wiadomościami, których launcher jeszcze nie potwierdził. */
		public Chat withPending(List<String> bodies) {
			if (bodies.isEmpty()) return this;
			List<Message> l = new ArrayList<Message>(messages);
			for (String b : bodies) l.add(new Message(-1, true, b, false, true));
			return new Chat(with, at, l);
		}
	}

	/** Lista znajomych z friends.json albo null, gdy plik jest zepsuty. */
	public static Friends parse(String json) {
		Map<?, ?> m = map(json);
		if (m == null) return null;
		if (!Boolean.TRUE.equals(m.get("loggedIn"))) return LOGGED_OUT;
		List<Friend> out = new ArrayList<Friend>();
		if (m.get("list") instanceof List) for (Object o : (List<?>) m.get("list")) {
			if (!(o instanceof Map)) continue;
			Map<?, ?> x = (Map<?, ?>) o;
			if (!(x.get("id") instanceof String) || !(x.get("nick") instanceof String)) continue;
			Friend f = new Friend((String) x.get("id"), (String) x.get("nick"), str(x.get("status")), str(x.get("server")), num(x.get("unread")),
					Boolean.TRUE.equals(x.get("party")), str(x.get("members")));
			if (x.get("mc") instanceof String && ((String) x.get("mc")).matches("[A-Za-z0-9_]{1,16}")) f.mc = (String) x.get("mc");
			out.add(f);
		}
		return new Friends(true, out);
	}

	/** Rozmowa z chat.json albo null, gdy plik jest zepsuty. */
	public static Chat parseChat(String json) {
		Map<?, ?> m = map(json);
		if (m == null || !(m.get("with") instanceof String)) return null;
		List<Message> out = new ArrayList<Message>();
		if (m.get("messages") instanceof List) for (Object o : (List<?>) m.get("messages")) {
			if (!(o instanceof Map)) continue;
			Map<?, ?> x = (Map<?, ?>) o;
			if (!(x.get("body") instanceof String) || !(x.get("id") instanceof Number)) continue;
			out.add(new Message(((Number) x.get("id")).longValue(), Boolean.TRUE.equals(x.get("mine")), (String) x.get("body"),
					Boolean.TRUE.equals(x.get("read")), false));
		}
		return new Chat((String) m.get("with"), m.get("at") instanceof Number ? ((Number) m.get("at")).longValue() : 0, out);
	}

	private static Map<?, ?> map(String json) {
		Object v;
		try {
			v = Json.parse(json);
		} catch (RuntimeException e) {
			return null;
		}
		return v instanceof Map ? (Map<?, ?>) v : null;
	}

	private static String str(Object o) {
		return o instanceof String && !((String) o).isEmpty() ? (String) o : null;
	}

	private static int num(Object o) {
		return o instanceof Number ? ((Number) o).intValue() : 0;
	}
}
