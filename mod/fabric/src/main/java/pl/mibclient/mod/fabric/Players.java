package pl.mibclient.mod.fabric;

import com.mojang.authlib.GameProfile;
import java.io.File;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import net.minecraft.ChatFormatting;
import net.minecraft.client.Minecraft;
import net.minecraft.client.multiplayer.PlayerInfo;
import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.MutableComponent;
import net.minecraft.network.chat.Style;
import net.minecraft.resources.MibId;
import pl.mibclient.mod.core.ChatSender;
import pl.mibclient.mod.core.Lang;
import pl.mibclient.mod.core.MibPlayers;
//#if MC >= 1.21.9
import net.minecraft.network.chat.FontDescription;
//#endif

/**
 * Gracze MiB: logo MiB przed nickiem (nad głową, w Tab i na czacie) i peleryny innych graczy MiB.
 * Co 5 s lista graczy z Tab trafia do launchera (players-request.json), launcher pyta serwer MiB i zapisuje
 * players.json oraz tekstury peleryn w mib/capes. Własna postać zawsze ma logo (gra w MiB).
 */
public final class Players {
	private static final MibId FONT = MibId.fromNamespaceAndPath("mibclient", "badge");
	/** Znak z czcionki mibclient:badge (assets/mibclient/font/badge.json) z logo MiB. */
	private static final Component BADGE = badge();

	private final MibClient mib;
	private MibPlayers list = MibPlayers.NONE;
	/** Tekstury peleryn innych graczy: id peleryny -> tekstura (null = pliku nie da się wczytać) i data pliku. */
	private final Map<String, MibId> capes = new HashMap<>();
	private final Map<String, Long> capeStamps = new HashMap<>();
	/** Kiedy ostatnio sprawdzono brakujący plik peleryny (getSkin woła się co klatkę). */
	private final Map<String, Long> capeMissingAt = new HashMap<>();
	private final TierCache tiers = new TierCache();
	private int ticks;

	Players(MibClient mib) {
		this.mib = mib;
	}

	private static Component badge() {
		//#if MC >= 1.21.9
		Style s = Style.EMPTY.withFont(new FontDescription.Resource(FONT)).withColor(ChatFormatting.WHITE);
		//#else
		Style s = Style.EMPTY.withFont(FONT).withColor(ChatFormatting.WHITE);
		//#endif
		return Component.literal("").withStyle(s);
	}

	public static UUID id(GameProfile p) {
		//#if MC >= 1.21.9
		return p.id();
		//#else
		return p.getId();
		//#endif
	}

	public static String name(GameProfile p) {
		//#if MC >= 1.21.9
		return p.name();
		//#else
		return p.getName();
		//#endif
	}

	void tick(Minecraft c) {
		if (mib.bridge == null || c.getConnection() == null) {
			list = MibPlayers.NONE;
			return;
		}
		ticks++;
		if (ticks % 40 == 0) list = mib.bridge.players();
		if (ticks % 100 == 1) {
			List<MibPlayers.Seen> seen = new ArrayList<>();
			UUID self = c.player == null ? null : c.player.getUUID();
			for (PlayerInfo p : c.getConnection().getOnlinePlayers()) {
				UUID id = id(p.getProfile());
				if (!id.equals(self)) seen.add(new MibPlayers.Seen(id, name(p.getProfile())));
			}
			mib.bridge.requestPlayers(MibPlayers.request(seen));
		}
		// peleryna zmieniona w panelu admina: launcher podmienia plik, tekstura wczytuje się od nowa
		if (ticks % 200 == 0) {
			for (String id : new ArrayList<>(capes.keySet())) {
				File f = mib.bridge.capeFile(id);
				if (f == null || f.lastModified() != capeStamps.getOrDefault(id, 0L)) {
					MibClient.releaseTexture(capes.remove(id));
					capeStamps.remove(id);
				}
			}
		}
	}

	/** Czy ten gracz gra w MiB (własna postać zawsze). */
	boolean isMib(UUID id, String name) {
		Minecraft c = Minecraft.getInstance();
		if (c.player != null && c.player.getUUID().equals(id)) return true;
		return list.find(id, name) != null;
	}

	/** Nick z logo MiB przed nim (gracze MiB) i tierem MCTiers za nim (Tier tagger); Nick hider zamienia własny nick na „Ty”. */
	public Component decorate(UUID id, String name, Component original) {
		if (original == null || id == null) return original;
		Component out = original;
		if (isMib(id, name)) {
			MibClient.hooks.add("badge");
			Minecraft c = Minecraft.getInstance();
			if (c.player != null && c.player.getUUID().equals(id) && mib.modules.isOn("nick_hider")) {
				out = Component.literal(Lang.pl() ? "Ty" : "You");
			}
			out = Component.empty().append(BADGE).append(" ").append(out);
		}
		if (mib.modules.isOn("tier_tagger")) {
			String mode = ((pl.mibclient.mod.core.Setting.ChoiceSetting) mib.modules.def("tier_tagger").setting("mode")).get(mib.modules.state("tier_tagger"));
			String t = tiers.tier(id, mode);
			if (t != null) {
				MibClient.hooks.add("tier");
				out = Component.empty().append(out).append(Component.literal(" " + t).withColor(pl.mibclient.mod.core.modules.Tiers.color(t)));
			}
		}
		return out;
	}

	/** Czat: logo MiB przed nickiem nadawcy, gdy pisze gracz MiB (także Ty); inne wiadomości bez zmian. */
	public Component chat(Component message) {
		Minecraft c = Minecraft.getInstance();
		if (message == null || c.player == null) return message;
		List<String> names = new ArrayList<>();
		names.add(c.player.getScoreboardName());
		if (c.getConnection() != null && list.size() > 0) {
			for (PlayerInfo p : c.getConnection().getOnlinePlayers()) {
				if (list.find(id(p.getProfile()), name(p.getProfile())) != null) names.add(name(p.getProfile()));
			}
		}
		int at = ChatSender.badgeAt(message.getString(), names);
		if (at < 0) return message;
		MibClient.hooks.add("chat_badge");
		MutableComponent out = Component.empty();
		int[] pos = {0};
		message.visit((style, text) -> {
			int start = pos[0];
			pos[0] += text.length();
			if (at >= start && at < pos[0]) {
				if (at > start) out.append(Component.literal(text.substring(0, at - start)).setStyle(style));
				out.append(BADGE).append(Component.literal(" ").setStyle(style)).append(Component.literal(text.substring(at - start)).setStyle(style));
			} else out.append(Component.literal(text).setStyle(style));
			return Optional.empty();
		}, Style.EMPTY);
		return out;
	}

	/** Peleryna innego gracza MiB (tekstura z pliku od launchera) albo null. */
	MibId capeOf(UUID id, String name) {
		if (mib.bridge == null) return null;
		MibPlayers.Entry e = list.find(id, name);
		if (e == null || e.cape == null) return null;
		if (capes.containsKey(e.cape)) return capes.get(e.cape);
		long now = System.currentTimeMillis();
		if (now - capeMissingAt.getOrDefault(e.cape, 0L) < 2000) return null;
		File f = mib.bridge.capeFile(e.cape);
		if (f == null) { // launcher jeszcze nie pobrał
			capeMissingAt.put(e.cape, now);
			return null;
		}
		capeMissingAt.remove(e.cape);
		MibId t = null;
		try {
			t = MibClient.registerTexture("cape/p_" + e.cape, Files.readAllBytes(f.toPath()));
		} catch (Exception ex) {
			t = null;
		}
		capes.put(e.cape, t);
		capeStamps.put(e.cape, f.lastModified());
		return t;
	}

	/** Rozłączenie: lista graczy od nowa na następnym serwerze. */
	void reset() {
		list = MibPlayers.NONE;
		ticks = 0;
	}
}
