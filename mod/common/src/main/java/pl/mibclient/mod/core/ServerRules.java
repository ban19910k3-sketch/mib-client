package pl.mibclient.mod.core;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Moduły zakazane na konkretnych serwerach (ochrona przed banem). Lista jest w zasobie mibclient/server-rules.json
 * i aktualizuje się razem z launcherem. Dopasowanie: host albo jego subdomena, bez wielkości liter i portu.
 */
public final class ServerRules {
	private static final class Rule {
		final List<String> hosts;
		final List<String> block;

		Rule(List<String> hosts, List<String> block) {
			this.hosts = hosts;
			this.block = block;
		}
	}

	private final List<Rule> rules;

	private ServerRules(List<Rule> rules) {
		this.rules = rules;
	}

	public static ServerRules load(String json) {
		List<Rule> out = new ArrayList<Rule>();
		try {
			Object root = Json.parse(json);
			Object servers = root instanceof Map ? ((Map<?, ?>) root).get("servers") : null;
			if (servers instanceof List) {
				for (Object s : (List<?>) servers) {
					if (!(s instanceof Map)) continue;
					List<String> hosts = strings(((Map<?, ?>) s).get("hosts")), block = strings(((Map<?, ?>) s).get("block"));
					if (hosts.isEmpty() || block.isEmpty()) continue;
					List<String> norm = new ArrayList<String>();
					for (String h : hosts) norm.add(host(h));
					out.add(new Rule(norm, block));
				}
			}
		} catch (RuntimeException e) {
			// zły plik reguł: nic nie blokujemy
		}
		return new ServerRules(out);
	}

	public static ServerRules builtIn() {
		InputStream in = ServerRules.class.getResourceAsStream("/mibclient/server-rules.json");
		if (in == null) return new ServerRules(Collections.<Rule>emptyList());
		try {
			ByteArrayOutputStream buf = new ByteArrayOutputStream();
			byte[] b = new byte[4096];
			for (int n; (n = in.read(b)) > 0;) buf.write(b, 0, n);
			return load(new String(buf.toByteArray(), StandardCharsets.UTF_8));
		} catch (Exception e) {
			return new ServerRules(Collections.<Rule>emptyList());
		} finally {
			try {
				in.close();
			} catch (Exception ignored) {
				// nic
			}
		}
	}

	public Set<String> blockedFor(String address) {
		if (address == null) return Collections.emptySet();
		String h = host(address);
		if (h.isEmpty()) return Collections.emptySet();
		Set<String> out = new HashSet<String>();
		for (Rule r : rules) {
			for (String x : r.hosts) {
				if (h.equals(x) || h.endsWith("." + x)) {
					out.addAll(r.block);
					break;
				}
			}
		}
		return out;
	}

	/** Sama nazwa hosta: małe litery, bez portu i kropki na końcu ("[::1]:25565" -> "::1"). */
	static String host(String address) {
		String a = address.trim().toLowerCase(Locale.ROOT);
		if (a.startsWith("[")) {
			int end = a.indexOf(']');
			a = end > 0 ? a.substring(1, end) : a.substring(1);
		} else if (a.indexOf(':') >= 0 && a.indexOf(':') == a.lastIndexOf(':')) a = a.substring(0, a.indexOf(':'));
		while (a.endsWith(".")) a = a.substring(0, a.length() - 1);
		return a;
	}

	private static List<String> strings(Object v) {
		List<String> out = new ArrayList<String>();
		if (v instanceof List) for (Object o : (List<?>) v) if (o instanceof String && !((String) o).isEmpty()) out.add((String) o);
		return out;
	}
}
