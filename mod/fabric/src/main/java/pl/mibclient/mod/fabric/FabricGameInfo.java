package pl.mibclient.mod.fabric;

import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import net.minecraft.client.Minecraft;
import net.minecraft.client.Options;
import net.minecraft.client.multiplayer.PlayerInfo;
import net.minecraft.client.multiplayer.ServerData;
import net.minecraft.client.player.LocalPlayer;
import net.minecraft.network.chat.Component;
import net.minecraft.world.effect.MobEffectInstance;
import net.minecraft.world.entity.EquipmentSlot;
import net.minecraft.world.item.ItemStack;
import pl.mibclient.mod.core.GameInfo;
import pl.mibclient.mod.core.modules.CpsCounter;

/** Dane gry dla HUD części wspólnej. */
public final class FabricGameInfo implements GameInfo {
	private static final EquipmentSlot[] ARMOR = {EquipmentSlot.HEAD, EquipmentSlot.CHEST, EquipmentSlot.LEGS, EquipmentSlot.FEET};

	private final MibClient mib;
	private final long sessionStart;

	public FabricGameInfo(MibClient mib, long sessionStart) {
		this.mib = mib;
		this.sessionStart = sessionStart;
	}

	private static Minecraft mc() {
		return Minecraft.getInstance();
	}

	private static LocalPlayer player() {
		return mc().player;
	}

	@Override
	public int fps() {
		return mc().getFps();
	}

	@Override
	public int ping() {
		Minecraft c = mc();
		if (c.getCurrentServer() == null || c.getConnection() == null || c.player == null) return -1;
		PlayerInfo e = c.getConnection().getPlayerInfo(c.player.getUUID());
		return e == null ? -1 : e.getLatency();
	}

	@Override
	public double x() {
		return player() == null ? 0 : player().getX();
	}

	@Override
	public double y() {
		return player() == null ? 0 : player().getY();
	}

	@Override
	public double z() {
		return player() == null ? 0 : player().getZ();
	}

	@Override
	public float yaw() {
		return player() == null ? 0 : player().getYRot();
	}

	@Override
	public String biome() {
		Minecraft c = mc();
		if (c.level == null || c.player == null) return null;
		String id = c.level.getBiome(c.player.blockPosition()).getRegisteredName();
		return Component.translatable("biome." + id.replace(':', '.')).getString();
	}

	@Override
	public String serverAddress() {
		ServerData s = mc().getCurrentServer();
		return s == null ? null : s.ip;
	}

	@Override
	public List<Effect> effects() {
		List<Effect> out = new ArrayList<>();
		if (player() == null) return out;
		for (MobEffectInstance e : player().getActiveEffects()) {
			if (!e.showIcon()) continue;
			out.add(new Effect(Component.translatable(e.getDescriptionId()).getString(), e.getAmplifier(), e.getDuration(), e.isInfiniteDuration(), e.getEffect()));
		}
		return out;
	}

	@Override
	public List<Gear> gear() {
		List<Gear> out = new ArrayList<>();
		LocalPlayer p = player();
		if (p == null) return out;
		for (EquipmentSlot slot : ARMOR) add(out, p.getItemBySlot(slot), false);
		add(out, p.getMainHandItem(), true);
		return out;
	}

	private static void add(List<Gear> out, ItemStack s, boolean held) {
		if (s == null || s.isEmpty()) return;
		out.add(new Gear(s, s.isDamageableItem() ? s.getMaxDamage() : 0, s.isDamageableItem() ? s.getDamageValue() : 0, held));
	}

	@Override
	public boolean key(Key k) {
		Options o = mc().options;
		switch (k) {
			case FORWARD: return o.keyUp.isDown();
			case BACK: return o.keyDown.isDown();
			case LEFT: return o.keyLeft.isDown();
			case RIGHT: return o.keyRight.isDown();
			case JUMP: return o.keyJump.isDown();
			case ATTACK: return o.keyAttack.isDown();
			case USE: return o.keyUse.isDown();
			default: return false;
		}
	}

	@Override
	public CpsCounter leftCps() {
		return mib.left;
	}

	@Override
	public CpsCounter rightCps() {
		return mib.right;
	}

	@Override
	public long nowMs() {
		return System.currentTimeMillis();
	}

	@Override
	public long sessionStartMs() {
		return sessionStart;
	}

	@Override
	public int[] localTime() {
		LocalTime t = LocalTime.now();
		return new int[] {t.getHour(), t.getMinute(), t.getSecond()};
	}

	@Override
	public boolean sprintToggled() {
		return mc().options.toggleSprint().get();
	}

	@Override
	public boolean sneakToggled() {
		return mc().options.toggleCrouch().get();
	}

	@Override
	public boolean sprinting() {
		return player() != null && player().isSprinting();
	}

	@Override
	public boolean sneaking() {
		return player() != null && player().isShiftKeyDown();
	}

	@Override
	public boolean hideHud() {
		return mc().options.hideGui;
	}
}
