package pl.mibclient.mod.core.modules;

import java.util.ArrayDeque;

/** Kliknięcia z ostatniej sekundy. */
public final class CpsCounter {
	private final ArrayDeque<Long> clicks = new ArrayDeque<Long>();

	public synchronized void click(long nowMs) {
		clicks.addLast(nowMs);
		trim(nowMs);
	}

	public synchronized int cps(long nowMs) {
		trim(nowMs);
		return clicks.size();
	}

	private void trim(long nowMs) {
		while (!clicks.isEmpty() && clicks.peekFirst() <= nowMs - 1000) clicks.removeFirst();
		while (clicks.size() > 200) clicks.removeFirst();
	}
}
