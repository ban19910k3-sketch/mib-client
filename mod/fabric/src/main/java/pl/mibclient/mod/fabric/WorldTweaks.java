package pl.mibclient.mod.fabric;

import java.io.File;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.Map;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.minecraft.client.Minecraft;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.chat.Component;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.Mob;
import net.minecraft.world.entity.item.ItemEntity;
import net.minecraft.world.entity.item.PrimedTnt;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.storage.LevelResource;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.core.Filter;
import org.apache.logging.log4j.core.LogEvent;
import org.apache.logging.log4j.core.filter.AbstractFilter;
import pl.mibclient.mod.core.Setting;
import pl.mibclient.mod.core.modules.Backups;
import pl.mibclient.mod.core.modules.DropGuard;
import pl.mibclient.mod.core.modules.Labels;
import pl.mibclient.mod.core.modules.LogCull;

/**
 * Moduły świata: napisy nad istotami (TNT timer, Item despawn, Mob overlay — EntityMixin podaje je grze jako nazwę
 * istoty, więc rysuje je zwykły napis nad głową), Time changer, Drop prevention, Backups i Cull logs.
 */
public final class WorldTweaks {
	/** Napisy z ostatniego ticku: istota -> nazwa do pokazania (tylko istoty świata gracza). */
	private static Map<Entity, Component> labels = Collections.emptyMap();
	private static volatile boolean cullOn;

	private final MibClient mib;
	private final File backupsDir;
	private final LogCull cull = new LogCull();

	WorldTweaks(MibClient mib, File baseDir) {
		this.mib = mib;
		this.backupsDir = new File(baseDir, "backups");
	}

	void register() {
		ServerLifecycleEvents.SERVER_STOPPED.register(server -> {
			if (!mib.modules.isOn("backups") || server.isDedicatedServer()) return;
			File world = server.getWorldPath(LevelResource.ROOT).toAbsolutePath().normalize().toFile();
			int keep = mib.intOpt("backups", "keep");
			Thread t = new Thread(() -> {
				try {
					File out = Backups.backup(world, backupsDir, keep, System.currentTimeMillis());
					MibClient.LOG.info("MiB: kopia świata {}", out);
				} catch (Exception e) {
					MibClient.LOG.warn("MiB: nie udała się kopia świata {}: {}", world, e.toString());
				}
			}, "MiB backup");
			t.setDaemon(false);
			t.start();
		});
		org.apache.logging.log4j.core.Logger root = (org.apache.logging.log4j.core.Logger) LogManager.getRootLogger();
		root.addFilter(new AbstractFilter(Filter.Result.NEUTRAL, Filter.Result.NEUTRAL) {
			@Override
			public Filter.Result filter(LogEvent event) {
				if (!cullOn || event.getMessage() == null) return Filter.Result.NEUTRAL;
				return cull.allow(event.getLoggerName() + "|" + event.getMessage().getFormattedMessage(), System.currentTimeMillis())
						? Filter.Result.NEUTRAL : Filter.Result.DENY;
			}
		});
	}

	void tick(Minecraft c) {
		cullOn = mib.modules.isOn("cull_logs");
		labels = Collections.emptyMap(); // przy liczeniu nowych getCustomName() zwraca prawdziwe nazwy
		if (c.level == null || c.player == null) return;
		boolean tnt = mib.modules.isOn("tnt_timer"), items = mib.modules.isOn("item_despawn");
		boolean mobs = mib.modules.isOn("player_overlay") && mib.boolOpt("player_overlay", "mobs");
		if (!tnt && !items && !mobs) return;
		int itemR = mib.intOpt("item_despawn", "radius"), mobR = mib.intOpt("player_overlay", "radius");
		int range = Math.max(tnt ? 64 : 0, Math.max(items ? itemR : 0, mobs ? mobR : 0));
		Map<Entity, Component> out = new IdentityHashMap<>();
		for (Entity e : c.level.getEntities(c.player, c.player.getBoundingBox().inflate(range), x -> true)) {
			double d = e.distanceToSqr(c.player);
			if (tnt && e instanceof PrimedTnt t) {
				out.put(e, Component.literal(Labels.fuse(t.getFuse())).withColor(Labels.fuseColor(t.getFuse())));
			} else if (items && e instanceof ItemEntity it && d <= itemR * itemR) {
				String left = Labels.despawn(it.getAge());
				if (left == null) continue;
				ItemStack s = it.getItem();
				Component name = s.getCount() > 1 ? Component.empty().append(s.getHoverName()).append(" ×" + s.getCount()) : s.getHoverName();
				out.put(e, Component.empty().append(name).append(Component.literal("  " + left).withColor(Labels.despawnColor(it.getAge()))));
			} else if (mobs && e instanceof Mob m && d <= mobR * mobR && !m.isInvisible()) {
				float hp = m.getHealth();
				out.put(e, Component.empty().append(m.getName())
						.append(Component.literal(" ❤ " + Labels.health(hp)).withColor(Labels.healthColor(hp, m.getMaxHealth()))));
			}
		}
		if (!out.isEmpty()) MibClient.hooks.add("labels");
		labels = out;
	}

	/** Player overlay: zdrowie gracza (i złote serca absorpcji) za jego nickiem nad głową albo null (PlayerMixin). */
	public static Component playerHealth(Player p) {
		MibClient m = MibClient.get();
		Minecraft c = Minecraft.getInstance();
		if (m == null || c.player == null || !m.modules.isOn("player_overlay") || p.isInvisible()) return null;
		int r = m.intOpt("player_overlay", "radius");
		if (p != c.player && p.distanceToSqr(c.player) > (double) r * r) return null;
		MibClient.hooks.add("player_overlay");
		float hp = p.getHealth(), abs = p.getAbsorptionAmount();
		Component out = Component.literal(" ❤ " + Labels.health(hp)).withColor(Labels.healthColor(hp, p.getMaxHealth()));
		return abs > 0 ? Component.empty().append(out).append(Component.literal(" +" + Labels.health(abs)).withColor(0xFFFFAA00)) : out;
	}

	/** Napis zamiast nazwy istoty albo null (EntityMixin). */
	public static Component label(Entity e) {
		Map<Entity, Component> l = labels;
		return l.isEmpty() ? null : l.get(e);
	}

	/** Time changer: pora dnia zamiast tej z serwera (dzień zostaje ten sam, żeby faza księżyca się zgadzała); -1 = bez zmian. */
	public static long dayTime(long real) {
		MibClient m = MibClient.get();
		if (m == null || !m.modules.isOn("time_changer")) return -1;
		MibClient.hooks.add("time");
		String key = ((Setting.ChoiceSetting) m.modules.def("time_changer").setting("time")).get(m.modules.state("time_changer"));
		return Math.floorDiv(real, 24000L) * 24000L + Labels.timeOfDay(key);
	}

	/** Drop prevention: czy zatrzymać wyrzucenie tego przedmiotu (i pokazać o tym napis nad paskiem). */
	public static boolean keep(ItemStack s) {
		MibClient m = MibClient.get();
		if (m == null || s == null || s.isEmpty() || !m.modules.isOn("drop_prevention")) return false;
		String id = BuiltInRegistries.ITEM.getKey(s.getItem()).toString();
		boolean keep = DropGuard.valuable(id, s.isEnchanted(), m.boolOpt("drop_prevention", "gear"), m.boolOpt("drop_prevention", "enchanted"),
				m.boolOpt("drop_prevention", "totem"), m.boolOpt("drop_prevention", "shulker"));
		if (keep) {
			MibClient.hooks.add("drop");
			m.actionBar(Component.literal(pl.mibclient.mod.core.Lang.t("drop.blocked", s.getHoverName().getString())));
		}
		return keep;
	}
}
