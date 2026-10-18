package pl.mibclient.mod.fabric;

import java.lang.ref.WeakReference;
import net.minecraft.client.Minecraft;
import net.minecraft.client.player.LocalPlayer;
import net.minecraft.client.resources.sounds.SimpleSoundInstance;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.Vec3;
import pl.mibclient.mod.core.modules.CombatTracker;
import pl.mibclient.mod.core.modules.Meters;

/**
 * Moduły PvP i liczniki etapu 2 po stronie gry: uderzenia (MultiPlayerGameModeMixin), trafienia i obrażenia celu,
 * własne obrażenia (co tick), totemy i TPS (ClientPacketListenerMixin), prędkość.
 */
public final class Pvp {
	public final CombatTracker combat = new CombatTracker();
	public final Meters meters = new Meters();

	private final MibClient mib;
	private int prevHurt;
	private WeakReference<LivingEntity> target = new WeakReference<>(null);
	private int targetPrevHurt;
	private float targetPrevHealth = -1;

	Pvp(MibClient mib) {
		this.mib = mib;
	}

	/** Uderzenie: zasięg od oczu do najbliższego punktu ramki celu. */
	public void onAttack(Player player, Entity e) {
		MibClient.hooks.add("attack");
		Vec3 eye = player.getEyePosition();
		AABB b = e.getBoundingBox();
		double dx = Math.max(0, Math.max(b.minX - eye.x(), eye.x() - b.maxX));
		double dy = Math.max(0, Math.max(b.minY - eye.y(), eye.y() - b.maxY));
		double dz = Math.max(0, Math.max(b.minZ - eye.z(), eye.z() - b.maxZ));
		combat.onAttack(e.getId(), Math.sqrt(dx * dx + dy * dy + dz * dz), System.currentTimeMillis());
		if (e instanceof LivingEntity le) {
			target = new WeakReference<>(le);
			targetPrevHurt = le.hurtTime;
			targetPrevHealth = le.getHealth();
		}
	}

	/** Istota zużyła totem nieśmiertelności (zdarzenie 35 od serwera). */
	public void onTotem(LivingEntity e) {
		MibClient.hooks.add("totem");
		combat.onTotemPop(e.getName().getString(), System.currentTimeMillis());
	}

	/** Serwer przysłał czas świata (co 20 ticków serwera). */
	public void onTime() {
		Minecraft c = Minecraft.getInstance();
		if (c.level != null) meters.tps.onTime(c.level.getGameTime(), System.currentTimeMillis());
	}

	/** Ostatnio uderzona istota (do 5 s) albo null. */
	LivingEntity lastTarget() {
		LivingEntity t = target.get();
		return t != null && combat.lastTarget(System.currentTimeMillis()) == t.getId() ? t : null;
	}

	void tick(Minecraft c) {
		long now = System.currentTimeMillis();
		LocalPlayer p = c.player;
		if (p == null) return;
		meters.speed.tick(p.getX(), p.getY(), p.getZ(), mib.boolOpt("speed_meter", "vertical"));
		// gra ustawia hurtTime na 10 przy otrzymaniu obrażeń i odlicza do zera
		if (p.hurtTime > prevHurt) combat.onSelfHurt();
		prevHurt = p.hurtTime;

		LivingEntity t = target.get();
		if (t != null) {
			float hp = t.getHealth();
			if (t.hurtTime > targetPrevHurt) {
				float lost = targetPrevHealth >= 0 ? targetPrevHealth - hp : -1;
				if (combat.onTargetHurt(t.getId(), lost > 0 ? lost : -1, now)) hit(c);
			} else if (targetPrevHealth >= 0 && hp < targetPrevHealth) combat.onTargetHealthDrop(t.getId(), targetPrevHealth - hp, now);
			targetPrevHurt = t.hurtTime;
			targetPrevHealth = hp;
		}
	}

	/** Trafienie: dźwięk z Hit indicator (znacznik rysuje HudView.overlay). */
	private void hit(Minecraft c) {
		MibClient.hooks.add("hit");
		if (mib.modules.isOn("hit_indicator") && mib.boolOpt("hit_indicator", "sound")) {
			c.getSoundManager().play(SimpleSoundInstance.forUI(SoundEvents.ARROW_HIT_PLAYER, 1.0f));
		}
	}

	/** Nowy świat albo serwer. */
	void reset() {
		combat.reset();
		meters.tps.reset();
		meters.speed.reset();
		target = new WeakReference<>(null);
		prevHurt = 0;
	}
}
