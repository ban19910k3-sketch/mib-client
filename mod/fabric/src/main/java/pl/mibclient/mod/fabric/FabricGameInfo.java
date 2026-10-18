package pl.mibclient.mod.fabric;

import java.lang.management.ManagementFactory;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import net.minecraft.ChatFormatting;
import net.minecraft.client.Minecraft;
import net.minecraft.client.Options;
import net.minecraft.client.multiplayer.PlayerInfo;
import net.minecraft.client.multiplayer.ServerData;
import net.minecraft.client.player.LocalPlayer;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.chat.Component;
import net.minecraft.server.packs.repository.Pack;
import net.minecraft.world.effect.MobEffectInstance;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.EquipmentSlot;
import net.minecraft.world.entity.ai.attributes.Attributes;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.phys.BlockHitResult;
import net.minecraft.world.phys.HitResult;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.item.ItemStack;
import pl.mibclient.mod.core.GameInfo;
import pl.mibclient.mod.core.modules.CombatTracker;
import pl.mibclient.mod.core.modules.CpsCounter;
import pl.mibclient.mod.core.modules.Meters;

/** Dane gry dla HUD części wspólnej. */
public final class FabricGameInfo implements GameInfo {
	private static final EquipmentSlot[] ARMOR = {EquipmentSlot.HEAD, EquipmentSlot.CHEST, EquipmentSlot.LEGS, EquipmentSlot.FEET};

	private final MibClient mib;
	private final long sessionStart;
	private double cpu = -1;
	private long cpuAt;

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
		out.add(new Gear(s, s.isDamageableItem() ? s.getMaxDamage() : 0, s.isDamageableItem() ? s.getDamageValue() : 0, held, id(s)));
	}

	private static String id(ItemStack s) {
		return BuiltInRegistries.ITEM.getKey(s.getItem()).toString();
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
		return Input.hudHidden(mc());
	}

	// ===== Etap 2 =====

	@Override
	public float health() {
		return player() == null ? 20 : player().getHealth();
	}

	@Override
	public float maxHealth() {
		return player() == null ? 20 : player().getMaxHealth();
	}

	@Override
	public float absorption() {
		return player() == null ? 0 : player().getAbsorptionAmount();
	}

	@Override
	public int armorValue() {
		return player() == null ? 0 : player().getArmorValue();
	}

	@Override
	public int food() {
		return player() == null ? 20 : player().getFoodData().getFoodLevel();
	}

	@Override
	public float saturation() {
		return player() == null ? 5 : player().getFoodData().getSaturationLevel();
	}

	@Override
	public float attackStrength() {
		return player() == null ? 1 : player().getAttackStrengthScale(0f);
	}

	@Override
	public List<Stack> inventory() {
		LocalPlayer p = player();
		if (p == null) return Collections.emptyList();
		Inventory inv = p.getInventory();
		Map<String, Stack> sum = new LinkedHashMap<>();
		for (int i = 0; i < inv.getContainerSize(); i++) {
			ItemStack s = inv.getItem(i);
			if (s.isEmpty()) continue;
			String id = id(s);
			Stack old = sum.get(id);
			sum.put(id, new Stack(id, (old == null ? 0 : old.count) + s.getCount(), old == null ? s : old.stack));
		}
		return new ArrayList<>(sum.values());
	}

	@Override
	public Target target() {
		LivingEntity t = mc().crosshairPickEntity instanceof LivingEntity le ? le : mib.pvp.lastTarget();
		if (t == null || !t.isAlive()) return null;
		return new Target(t.getId(), t.getName().getString(), t.getHealth(), t.getMaxHealth());
	}

	@Override
	public List<String> resourcePacks() {
		List<String> out = new ArrayList<>();
		for (Pack p : mc().getResourcePackRepository().getSelectedPacks()) {
			String id = p.getId();
			if (id.equals("vanilla") || id.startsWith("fabric") || id.equals("mod_resources")) continue;
			String name = ChatFormatting.stripFormatting(p.getTitle().getString());
			if (name != null && !name.isEmpty()) out.add(0, name); // najwyższa paczka pierwsza
		}
		return out;
	}

	@Override
	public double cpuLoad() {
		long now = System.currentTimeMillis();
		if (now - cpuAt > 1000) {
			cpuAt = now;
			try {
				cpu = ((com.sun.management.OperatingSystemMXBean) ManagementFactory.getOperatingSystemMXBean()).getProcessCpuLoad();
			} catch (RuntimeException | LinkageError e) {
				cpu = -1;
			}
		}
		return cpu;
	}

	@Override
	public CombatTracker combat() {
		return mib.pvp.combat;
	}

	@Override
	public Meters meters() {
		return mib.pvp.meters;
	}

	// ===== Etapy 3 i 4 =====

	@Override
	public Looked lookedBlock() {
		Minecraft c = mc();
		if (c.level == null || !(c.hitResult instanceof BlockHitResult b) || c.hitResult.getType() != HitResult.Type.BLOCK) return null;
		BlockState state = c.level.getBlockState(b.getBlockPos());
		ItemStack icon = new ItemStack(state.getBlock());
		return new Looked(state.getBlock().getName().getString(), icon.isEmpty() ? null : icon);
	}

	@Override
	public double[] lastDeath() {
		return mib.lastDeath();
	}

	/** Zwierzę z siłą skoku pod graczem (koń, osioł, muł…): prędkość w m/s i wysokość skoku w blokach. */
	@Override
	public double[] horse() {
		LocalPlayer p = player();
		Entity v = p == null ? null : p.getVehicle();
		if (!(v instanceof LivingEntity h) || !h.getAttributes().hasAttribute(Attributes.JUMP_STRENGTH)) return null;
		double js = h.getAttributeValue(Attributes.JUMP_STRENGTH);
		double jump = -0.1817584952 * js * js * js + 3.689713992 * js * js + 2.128599134 * js - 0.343930367;
		return new double[] {h.getAttributeValue(Attributes.MOVEMENT_SPEED) * 42.16, jump, h.getHealth(), h.getMaxHealth()};
	}
}
