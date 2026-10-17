package pl.mibclient.mod.core.modules;

import java.util.HashMap;
import java.util.Map;

/**
 * Walka dla modułów PvP: combo, zasięg uderzenia, znacznik trafienia, zadane obrażenia, jump reset i totemy.
 * Adapter gry woła on*(): uderzenie (attack), trafienie celu (cel dostał obrażenia), własne obrażenia, skok, totem.
 * Czas w ms, tick = numer ticku gry (20 na sekundę).
 */
public final class CombatTracker {
	/** Po tylu ms bez trafienia combo się kończy. */
	public static final long COMBO_MS = 3000;
	/** Znacznik trafienia przy celowniku jest widoczny tyle ms. */
	public static final long MARKER_MS = 300;
	/** Trafienie liczy się tylko wtedy, gdy cel dostał obrażenia do tylu ms po naszym uderzeniu. */
	static final long HIT_WINDOW_MS = 600;
	/** Wynik jump resetu widać tyle ms. */
	public static final long JUMP_SHOW_MS = 3000;

	/** „Dawno temu” bez przepełnienia przy odejmowaniu. */
	private static final long NEVER = Long.MIN_VALUE / 4;

	private int targetId = Integer.MIN_VALUE;
	private long attackAt = NEVER, hitAt = NEVER, comboAt = NEVER;
	private double attackReach = -1, reach = -1;
	private int combo;
	private float damage = -1;

	private long hurtTick = NEVER, jumpTick = NEVER, jumpShownAt = NEVER;
	private Integer jumpDelta;
	private boolean waitingJump;

	private final Map<String, Integer> pops = new HashMap<String, Integer>();
	private String lastPop;
	private long lastPopAt = NEVER;

	/** Uderzyliśmy istotę targetId z odległości distance (od oczu do najbliższego punktu jej ramki). */
	public void onAttack(int targetId, double distance, long now) {
		this.targetId = targetId;
		this.attackAt = now;
		this.attackReach = distance;
	}

	/** Id ostatnio uderzonej istoty, dopóki trafienie może się jeszcze zaliczyć (inaczej MIN_VALUE). */
	public int pendingTarget(long now) {
		return now - attackAt <= HIT_WINDOW_MS ? targetId : Integer.MIN_VALUE;
	}

	/** Ostatnio uderzona istota (do 5 s po uderzeniu) albo MIN_VALUE. */
	public int lastTarget(long now) {
		return now - attackAt <= 5000 ? targetId : Integer.MIN_VALUE;
	}

	/**
	 * Istota entityId dostała obrażenia (healthLost &gt;= 0 albo -1, gdy nie wiadomo ile).
	 * Zwraca true, gdy to trafienie z naszego uderzenia (liczy się do combo i zasięgu).
	 */
	public boolean onTargetHurt(int entityId, float healthLost, long now) {
		if (entityId != targetId || now - attackAt > HIT_WINDOW_MS || hitAt >= attackAt) return false;
		hitAt = now;
		reach = attackReach;
		combo = now - comboAt <= COMBO_MS ? combo + 1 : 1;
		comboAt = now;
		damage = healthLost;
		return true;
	}

	/** Zdrowie celu spadło już po trafieniu (dane o zdrowiu przychodzą chwilę później niż obrażenia). */
	public void onTargetHealthDrop(int entityId, float lost, long now) {
		if (entityId == targetId && now - hitAt <= 1000 && lost > 0) damage = Math.max(damage, 0) + lost;
	}

	/** My dostaliśmy obrażenia: koniec combo, zaczyna się okno jump resetu. */
	public void onSelfHurt(long tick, long now) {
		combo = 0;
		hurtTick = tick;
		// skok tuż przed ciosem (do 2 ticków) też liczy się jako jump reset
		if (tick - jumpTick <= 2) showJump((int) (jumpTick - tick), now);
		else waitingJump = true;
	}

	/** Postać wyskoczyła z ziemi. */
	public void onJump(long tick, long now) {
		jumpTick = tick;
		if (waitingJump && tick - hurtTick <= 10) showJump((int) (tick - hurtTick), now);
		waitingJump = false;
	}

	/** Co tick: brak skoku do 10 ticków po ciosie. */
	public void tick(long tick, long now) {
		if (waitingJump && tick - hurtTick > 10) {
			waitingJump = false;
			jumpDelta = null;
			jumpShownAt = now;
		}
	}

	private void showJump(int delta, long now) {
		waitingJump = false;
		jumpDelta = delta;
		jumpShownAt = now;
	}

	/** Istota zużyła totem nieśmiertelności. */
	public void onTotemPop(String name, long now) {
		Integer n = pops.get(name);
		pops.put(name, n == null ? 1 : n + 1);
		lastPop = name;
		lastPopAt = now;
	}

	/** Nowy świat albo serwer: liczniki od zera. */
	public void reset() {
		pops.clear();
		lastPop = null;
		combo = 0;
		reach = -1;
		damage = -1;
		targetId = Integer.MIN_VALUE;
		jumpDelta = null;
		jumpShownAt = NEVER;
		waitingJump = false;
	}

	public int combo(long now) {
		return now - comboAt <= COMBO_MS ? combo : 0;
	}

	/** Zasięg ostatniego trafienia w blokach albo -1. */
	public double reach() {
		return reach;
	}

	/** Obrażenia z ostatniego trafienia albo -1, gdy nieznane. */
	public float lastDamage(long now) {
		return now - hitAt <= 5000 ? damage : -1;
	}

	public boolean hitMarker(long now) {
		return now - hitAt <= MARKER_MS;
	}

	/** Czy pokazać wynik jump resetu (do 3 s po ciosie). */
	public boolean jumpShown(long now) {
		return now - jumpShownAt <= JUMP_SHOW_MS;
	}

	/** Ticki między ciosem a skokiem (ujemne: skok przed ciosem) albo null, gdy nie było skoku. */
	public Integer jumpDelta() {
		return jumpDelta;
	}

	public int pops(String name) {
		Integer n = pops.get(name);
		return n == null ? 0 : n;
	}

	/** Ostatni gracz, który zużył totem (do 10 s temu) albo null. */
	public String lastPop(long now) {
		return now - lastPopAt <= 10000 ? lastPop : null;
	}
}
