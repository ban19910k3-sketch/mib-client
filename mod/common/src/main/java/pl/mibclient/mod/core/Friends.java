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

	/** Znajomy: status "game" (w grze, server może być null), "launcher" albo "offline". */
	public static final class Friend {
		public final String id, nick, status, server;
		public final int unread;

		public Friend(String id, String nick, String status, String server, int unread) {
			this.id = id;
			this.nick = nick;
			this.status = "game".equals(status) || "launcher".equals(status) ? status : "offline";
			this.server = server;
			this.unread = Math.max(0, unread);
		}

		/** Opis pod nickiem: „W grze · serwer”, „W launcherze” albo „Offline”. */
		public String statusText() {
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
			out.add(new Friend((String) x.get("id"), (String) x.get("nick"), str(x.get("status")), str(x.get("server")), num(x.get("unread"))));
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
