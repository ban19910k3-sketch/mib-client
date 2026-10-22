package pl.mibclient.mod.core;

import java.util.Map;

/**
 * Powiadomienie od launchera (notice.json): znajomy z MiB zaczął grać, zaprasza na swój serwer albo napisał wiadomość,
 * albo czeka prezent od MiB do odebrania w launcherze, albo twórca dodał ważną aktualność.
 * Board pokazuje je w prawym górnym rogu przez SHOW_MS (wsuwa się z boku); nowe zastępuje poprzednie.
 */
public final class Notice {
	public static final long SHOW_MS = 7000, MAX_AGE_MS = 60000, SLIDE_MS = 250;
	private static final int W = 190, PAD = 5, ICON = 12, GAP = 6, MARGIN = 4;

	public final String id, type, nick, version, server, text;
	public final long at;

	public Notice(String id, String type, String nick, String version, String server, long at) {
		this(id, type, nick, version, server, null, at);
	}

	/** type: "started", "invite" (z serwerem i wersją), "message" (text = treść), "gift" (text = nazwa kosmetyku) albo "news" (text = tytuł). */
	public Notice(String id, String type, String nick, String version, String server, String text, long at) {
		this.id = id;
		this.type = "invite".equals(type) || "message".equals(type) || "gift".equals(type) || "news".equals(type) ? type : "started";
		this.nick = nick;
		this.version = version;
		this.server = server;
		this.text = text;
		this.at = at;
	}

	/** Powiadomienie z pliku albo null, gdy plik jest zepsuty. */
	public static Notice parse(String json) {
		Object v;
		try {
			v = Json.parse(json);
		} catch (RuntimeException e) {
			return null;
		}
		if (!(v instanceof Map)) return null;
		Map<?, ?> m = (Map<?, ?>) v;
		if (!(m.get("id") instanceof String) || !(m.get("nick") instanceof String) || !(m.get("at") instanceof Number)) return null;
		String nick = ((String) m.get("nick")).trim();
		if (nick.isEmpty()) return null;
		Object type = m.get("type");
		String server = str(m.get("server")), version = str(m.get("version")), text = str(m.get("text"));
		if ("invite".equals(type) && server == null || ("message".equals(type) || "gift".equals(type) || "news".equals(type)) && text == null) return null;
		return new Notice((String) m.get("id"), type instanceof String ? (String) type : "started", nick, version, server, text,
				((Number) m.get("at")).longValue());
	}

	private static String str(Object o) {
		return o instanceof String && !((String) o).trim().isEmpty() ? ((String) o).trim() : null;
	}

	public boolean invite() {
		return "invite".equals(type);
	}

	public boolean message() {
		return "message".equals(type);
	}

	public boolean gift() {
		return "gift".equals(type);
	}

	public boolean news() {
		return "news".equals(type);
	}

	public String title() {
		if (news()) return Lang.t("notice.news");
		// prezent kupiony przez znajomego (od 0.24.0): z jego nickiem
		if (gift()) return "MiB".equals(nick) ? Lang.t("notice.gift") : Lang.t("notice.gift.from", nick);
		if (message()) return Lang.t("notice.message", nick);
		return Lang.t(invite() ? "notice.invite" : "notice.started");
	}

	public String body() {
		if (news()) return text;
		if (gift()) return Lang.t("notice.gift.body", text);
		if (message()) return text + " " + Lang.t("notice.message.reply");
		if (invite()) return Lang.t("notice.invite.body", nick, server, version == null ? "?" : version);
		String s = Lang.t("notice.started.body", nick);
		if (version != null) s += " " + version;
		if (server != null) s += " " + Lang.t("notice.on", server);
		return s + ".";
	}

	/** Jedno powiadomienie naraz; każde (po id) pokazuje się tylko raz, stare (sprzed minuty) wcale. */
	public static final class Board {
		private String lastId;
		private Notice cur;
		private long since;

		public void offer(Notice n, long now) {
			if (n == null || n.id.equals(lastId)) return;
			lastId = n.id;
			if (Math.abs(now - n.at) > MAX_AGE_MS) return;
			cur = n;
			since = now;
		}

		public Notice current(long now) {
			if (cur != null && now - since >= SHOW_MS) cur = null;
			return cur;
		}

		public void render(Canvas c, int sw, long now) {
			Notice n = current(now);
			if (n == null) return;
			long t = now - since;
			int w = Math.min(W, sw - 2 * MARGIN), tx = PAD + ICON + GAP, lh = c.lineHeight();
			if (w <= tx + PAD) return;
			String[] lines = Shapes.wrap(c, n.body(), w - tx - PAD, 4);
			int h = PAD + lh + 3 + lines.length * lh + PAD - 1;
			// wsuwa się z prawej i tak samo wysuwa na końcu
			double p = Math.min(1, Math.min(t, SHOW_MS - t) / (double) SLIDE_MS);
			p = 1 - (1 - p) * (1 - p);
			int x = sw - MARGIN - w + (int) Math.round((1 - p) * (w + MARGIN)), y = MARGIN;
			Shapes.panel(c, x, y, w, h, Theme.SLAB, Theme.AM);
			c.fill(x + 1, y + 2, x + 3, y + h - 2, Theme.AM);
			Shapes.icon(c, n.invite() ? "server" : n.message() ? "message" : n.gift() ? "archive" : n.news() ? "info-box" : "user", x + PAD + 1, y + PAD - 1, Theme.AM_HI);
			c.text(Shapes.ellipsize(c, n.title(), w - tx - PAD, false), x + tx, y + PAD, Theme.AM_HI, false);
			for (int i = 0; i < lines.length; i++) c.text(lines[i], x + tx, y + PAD + lh + 3 + i * lh, Theme.TEXT, false);
		}
	}
}
