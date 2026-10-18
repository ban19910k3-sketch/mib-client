package pl.mibclient.mod.fabric;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import pl.mibclient.mod.core.modules.Tiers;

/**
 * Tier tagger: rankingi graczy z publicznego API MCTiers, pobierane w tle (najwyżej 3 naraz, każdy gracz raz na 30 minut,
 * po błędzie po 5 minutach). Tylko konta Microsoft (UUID w wersji 4) — serwery bez logowania mają inne UUID.
 */
final class TierCache {
	private static final long TTL = 30 * 60_000L, RETRY = 5 * 60_000L;

	private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(6)).build();
	/** Odpowiedź API (JSON rankingów; "{}" = gracz bez tieru). */
	private final Map<UUID, String> json = new ConcurrentHashMap<>();
	private final Map<UUID, Long> askedAt = new ConcurrentHashMap<>();
	/** Policzony tier: uuid -> {tryb, tier} (null tier = brak). */
	private final Map<UUID, String[]> parsed = new ConcurrentHashMap<>();
	private final AtomicInteger inFlight = new AtomicInteger();

	/** Tier gracza w danym trybie albo null (jeszcze nie wiadomo / brak). */
	String tier(UUID id, String mode) {
		if (id == null || id.version() != 4) return null;
		String j = json.get(id);
		long now = System.currentTimeMillis();
		Long at = askedAt.get(id);
		if (at == null || now - at > (j == null ? RETRY : TTL)) fetch(id, now);
		if (j == null) return null;
		String[] p = parsed.get(id);
		if (p == null || !p[0].equals(mode)) {
			p = new String[] {mode, Tiers.tier(j, mode)};
			parsed.put(id, p);
		}
		return p[1];
	}

	private void fetch(UUID id, long now) {
		if (inFlight.get() >= 3) return;
		askedAt.put(id, now);
		inFlight.incrementAndGet();
		HttpRequest req = HttpRequest.newBuilder(URI.create(Tiers.API + id + "/rankings")).timeout(Duration.ofSeconds(10))
				.header("User-Agent", "MiB-Client").GET().build();
		http.sendAsync(req, HttpResponse.BodyHandlers.ofString()).whenComplete((r, e) -> {
			inFlight.decrementAndGet();
			if (r == null) return;
			if (r.statusCode() == 200) json.put(id, r.body());
			else if (r.statusCode() == 404) json.put(id, "{}");
			parsed.remove(id);
		});
	}
}
