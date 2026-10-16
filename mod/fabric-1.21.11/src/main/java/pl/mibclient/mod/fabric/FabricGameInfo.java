package pl.mibclient.mod.fabric;

import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.ClientPlayerEntity;
import net.minecraft.client.network.PlayerListEntry;
import net.minecraft.client.network.ServerInfo;
import net.minecraft.client.option.GameOptions;
import net.minecraft.entity.EquipmentSlot;
import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.item.ItemStack;
import net.minecraft.text.Text;
import pl.mibclient.mod.core.GameInfo;
import pl.mibclient.mod.core.modules.CpsCounter;

/** Dane gry 1.21.11 dla HUD części wspólnej. */
public final class FabricGameInfo implements GameInfo {
	private static final EquipmentSlot[] ARMOR = {EquipmentSlot.HEAD, EquipmentSlot.CHEST, EquipmentSlot.LEGS, EquipmentSlot.FEET};

	private final MibClient mib;
	private final long sessionStart;

	public FabricGameInfo(MibClient mib, long sessionStart) {
		this.mib = mib;
		this.sessionStart = sessionStart;
	}

	private static MinecraftClient mc() {
		return MinecraftClient.getInstance();
	}

	private static ClientPlayerEntity player() {
		return mc().player;
	}

	@Override
	public int fps() {
		return mc().getCurrentFps();
	}

	@Override
	public int ping() {
		MinecraftClient c = mc();
		if (c.getCurrentServerEntry() == null || c.getNetworkHandler() == null || c.player == null) return -1;
		PlayerListEntry e = c.getNetworkHandler().getPlayerListEntry(c.player.getUuid());
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
		return player() == null ? 0 : player().getYaw();
	}

	@Override
	public String biome() {
		MinecraftClient c = mc();
		if (c.world == null || c.player == null) return null;
		String id = c.world.getBiome(c.player.getBlockPos()).getIdAsString();
		return Text.translatable("biome." + id.replace(':', '.')).getString();
	}

	@Override
	public String serverAddress() {
		ServerInfo s = mc().getCurrentServerEntry();
		return s == null ? null : s.address;
	}

	@Override
	public List<Effect> effects() {
		List<Effect> out = new ArrayList<>();
		if (player() == null) return out;
		for (StatusEffectInstance e : player().getStatusEffects()) {
			if (!e.shouldShowIcon()) continue;
			out.add(new Effect(Text.translatable(e.getTranslationKey()).getString(), e.getAmplifier(), e.getDuration(), e.isInfinite(), e.getEffectType()));
		}
		return out;
	}

	@Override
	public List<Gear> gear() {
		List<Gear> out = new ArrayList<>();
		ClientPlayerEntity p = player();
		if (p == null) return out;
		for (EquipmentSlot slot : ARMOR) add(out, p.getEquippedStack(slot), false);
		add(out, p.getMainHandStack(), true);
		return out;
	}

	private static void add(List<Gear> out, ItemStack s, boolean held) {
		if (s == null || s.isEmpty()) return;
		out.add(new Gear(s, s.isDamageable() ? s.getMaxDamage() : 0, s.isDamageable() ? s.getDamage() : 0, held));
	}

	@Override
	public boolean key(Key k) {
		GameOptions o = mc().options;
		switch (k) {
			case FORWARD: return o.forwardKey.isPressed();
			case BACK: return o.backKey.isPressed();
			case LEFT: return o.leftKey.isPressed();
			case RIGHT: return o.rightKey.isPressed();
			case JUMP: return o.jumpKey.isPressed();
			case ATTACK: return o.attackKey.isPressed();
			case USE: return o.useKey.isPressed();
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
		return mc().options.getSprintToggled().getValue();
	}

	@Override
	public boolean sneakToggled() {
		return mc().options.getSneakToggled().getValue();
	}

	@Override
	public boolean sprinting() {
		return player() != null && player().isSprinting();
	}

	@Override
	public boolean sneaking() {
		return player() != null && player().isSneaking();
	}

	@Override
	public boolean hideHud() {
		return mc().options.hudHidden;
	}
}
