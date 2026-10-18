package pl.mibclient.mod.core.modules;

import java.util.LinkedHashMap;
import java.util.Map;

/** Cull logs: ten sam komunikat trafia do logu najwyżej LIMIT razy na 10 s (reszta jest pomijana). */
public final class LogCull {
	public static final int LIMIT = 3;
	public static final long WINDOW_MS = 10000;
	private static final int MAX_KEYS = 256;

	private final Map<String, long[]> seen = new LinkedHashMap<String, long[]>(64, 0.75f, true) {
		@Override
		protected boolean removeEldestEntry(Map.Entry<String, long[]> e) {
			return size() > MAX_KEYS;
		}
	};

	/** Czy zapisać ten komunikat (logi piszą różne wątki). */
	public synchronized boolean allow(String message, long now) {
		if (message == null) return true;
		long[] s = seen.get(message);
		if (s == null || now - s[0] > WINDOW_MS) {
			seen.put(message, new long[] {now, 1});
			return true;
		}
		return ++s[1] <= LIMIT;
	}
}
