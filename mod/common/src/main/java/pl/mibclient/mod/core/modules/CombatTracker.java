package pl.mibclient.mod.core.modules;

import java.util.HashMap;
import java.util.Map;

/**
 * Walka dla modułów PvP: combo, zasięg uderzenia, znacznik trafienia, zadane obrażenia i totemy.
 * Adapter gry woła on*(): uderzenie (attack), trafienie celu (cel dostał obrażenia), własne obrażenia, totem. Czas w ms.
 */
public final class CombatTracker {
	/** Po tylu ms bez trafienia combo się kończy. */
	public static final long COMBO_MS = 3000;
	/** Znacznik trafienia przy celowniku jest widoczny tyle ms. */
	public static final long MARKER_MS = 300;
	/** Trafienie liczy się tylko wtedy, gdy cel dostał obrażenia do tylu ms po naszym uderzeniu. */
	static final long HIT_WINDOW_MS = 600;

	/** „Dawno temu” bez przepełnienia przy odejmowaniu. */
	private static final long NEVER = Long.MIN_VALUE / 4;

	private int targetId = Integer.MIN_VALUE;
	private long attackAt = NEVER, hitAt = NEVER, comboAt = NEVER;
	private double attackReach = -1, reach = -1;
	private int combo;
	private float damage = -1;
	private int damageTarget = Integer.MIN_VALUE;

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
		damageTarget = entityId;
		return true;
	}

	/** Zdrowie celu spadło już po trafieniu (dane o zdrowiu przychodzą chwilę później niż obrażenia). */
	public void onTargetHealthDrop(int entityId, float lost, long now) {
		if (entityId == damageTarget && now - hitAt <= 1000 && lost > 0) damage = Math.max(damage, 0) + lost;
	}

	/** My dostaliśmy obrażenia: koniec combo. */
	public void onSelfHurt() {
		combo = 0;
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
		damageTarget = Integer.MIN_VALUE;
		targetId = Integer.MIN_VALUE;
	}

	public int combo(long now) {
		return now - comboAt <= COMBO_MS ? combo : 0;
	}

	/** Zasięg ostatniego trafienia w blokach albo -1. */
	public double reach() {
		return reach;
	}

	/** Obrażenia z ostatniego trafienia w tę istotę albo -1 (inna istota, dawno albo nieznane). */
	public float lastDamage(int entityId, long now) {
		return entityId == damageTarget && now - hitAt <= 5000 ? damage : -1;
	}

	public boolean hitMarker(long now) {
		return now - hitAt <= MARKER_MS;
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
