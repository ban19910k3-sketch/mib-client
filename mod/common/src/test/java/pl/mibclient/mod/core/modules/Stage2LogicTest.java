package pl.mibclient.mod.core.modules;

import static org.junit.jupiter.api.Assertions.*;

import java.util.Arrays;
import org.junit.jupiter.api.Test;

class Stage2LogicTest {
	@Test
	void comboCountsHitsUntilWeGetHitOrTimeout() {
		CombatTracker t = new CombatTracker();
		assertFalse(t.onTargetHurt(7, 2, 1000), "bez uderzenia nie ma trafienia");
		t.onAttack(7, 2.91, 1000);
		assertFalse(t.onTargetHurt(8, 2, 1100), "obrażenia innej istoty");
		assertTrue(t.onTargetHurt(7, 2, 1100));
		assertFalse(t.onTargetHurt(7, 2, 1150), "jedno uderzenie = jedno trafienie");
		assertEquals(1, t.combo(1200));
		assertEquals(2.91, t.reach(), 1e-9);
		assertTrue(t.hitMarker(1200));
		assertFalse(t.hitMarker(1500));
		t.onAttack(7, 3.0, 2000);
		assertTrue(t.onTargetHurt(7, 3, 2050));
		assertEquals(2, t.combo(2100));
		assertEquals(0, t.combo(2050 + CombatTracker.COMBO_MS + 1), "po 3 s bez trafienia combo znika");
		t.onAttack(7, 3.0, 3000);
		assertFalse(t.onTargetHurt(7, 3, 3000 + CombatTracker.HIT_WINDOW_MS + 1), "obrażenia za późno po uderzeniu");
		t.onAttack(7, 3.0, 4000);
		t.onTargetHurt(7, -1, 4010);
		t.onSelfHurt(100, 4020);
		assertEquals(0, t.combo(4030), "cios w nas kończy combo");
	}

	@Test
	void damageFromHealthDropAfterHit() {
		CombatTracker t = new CombatTracker();
		t.onAttack(3, 2.5, 0);
		t.onTargetHurt(3, -1, 50);
		assertEquals(-1, t.lastDamage(3, 60), 1e-6);
		t.onTargetHealthDrop(3, 3.5f, 100);
		assertEquals(3.5f, t.lastDamage(3, 150), 1e-6);
		assertEquals(-1, t.lastDamage(4, 150), 1e-6, "obrażenia innej istoty nie są pokazywane");
		t.onAttack(4, 2.5, 200);
		t.onTargetHealthDrop(4, 9f, 210);
		assertEquals(3.5f, t.lastDamage(3, 300), 1e-6, "spadek zdrowia innej istoty bez trafienia nie zmienia obrażeń");
		assertEquals(-1, t.lastDamage(3, 6000), 1e-6);
	}

	@Test
	void jumpResetTiming() {
		CombatTracker t = new CombatTracker();
		t.onSelfHurt(100, 5000);
		assertFalse(t.jumpShown(5000));
		t.onJump(101, 5050);
		assertTrue(t.jumpShown(5100));
		assertEquals(Integer.valueOf(1), t.jumpDelta());
		t.onSelfHurt(200, 10000);
		t.onJump(205, 10250);
		assertEquals(Integer.valueOf(5), t.jumpDelta(), "za późno o 5 ticków");
		t.onJump(299, 14900);
		t.onSelfHurt(300, 15000);
		assertEquals(Integer.valueOf(-1), t.jumpDelta(), "skok tick przed ciosem");
		t.onSelfHurt(400, 20000);
		t.tick(411, 20550);
		assertTrue(t.jumpShown(20600));
		assertNull(t.jumpDelta(), "bez skoku");
	}

	@Test
	void totemPops() {
		CombatTracker t = new CombatTracker();
		t.onTotemPop("Steve", 0);
		t.onTotemPop("Steve", 10);
		assertEquals(2, t.pops("Steve"));
		assertEquals("Steve", t.lastPop(5000));
		assertNull(t.lastPop(20000));
		t.reset();
		assertEquals(0, t.pops("Steve"));
	}

	@Test
	void tpsFromTimePackets() {
		Meters.Tps t = new Meters.Tps();
		assertEquals(-1, t.tps(), 1e-9);
		t.onTime(1000, 0);
		t.onTime(1020, 1000);
		assertEquals(20, t.tps(), 1e-9);
		t.onTime(1030, 2000);
		assertEquals(15, t.tps(), 1e-9);
		t.onTime(1050, 2500);
		assertEquals((20 + 10 + 20) / 3.0, t.tps(), 1e-9, "najwyżej 20");
		t.reset();
		assertEquals(-1, t.tps(), 1e-9);
		t.onTime(0, 0);
		t.onTime(20, 30_000);
		assertEquals(-1, t.tps(), 1e-9, "po pauzie tylko nowy punkt odniesienia");
		t.onTime(40, 31_000);
		assertEquals(20, t.tps(), 1e-9);
	}

	@Test
	void speedAndStopwatchAndMouse() {
		Meters.Speed s = new Meters.Speed();
		for (int i = 0; i <= 10; i++) s.tick(i * 0.2, 64 + i, 0, false);
		assertEquals(4.0, s.bps(), 1e-9, "0,2 bloku na tick = 4 bloki/s");
		s.tick(500, 64, 0, false);
		assertTrue(s.bps() < 4.0, "teleport nie liczy się jako ruch");

		Meters.Stopwatch w = new Meters.Stopwatch();
		assertFalse(w.started());
		w.press(1000);
		assertEquals(500, w.elapsed(1500));
		w.press(2500);
		assertFalse(w.running());
		assertEquals(1500, w.elapsed(9000));
		w.press(10000);
		assertEquals(0, w.elapsed(10000), "nowy start od zera");

		Meters.MouseTrail m = new Meters.MouseTrail();
		m.move(1000, -1000, 5, 0);
		assertArrayEquals(new double[] {1, -1}, m.pos(0), 1e-9);
		assertTrue(m.pos(600)[0] < 0.01, "kropka wraca do środka");
	}

	@Test
	void formats() {
		assertEquals("18.5", Formats.hp(18.49f));
		assertEquals("20", Formats.hp(20f));
		assertEquals("01:23.4", Formats.stopwatch(83_450));
		assertEquals("1:00:00.0", Formats.stopwatch(3_600_000));
		assertEquals(0xFF5DEAF2, Formats.armorColor("minecraft:diamond_boots"));
		int[] p = Formats.armorPoints(Arrays.asList("minecraft:iron_helmet", "minecraft:diamond_chestplate"), 10);
		assertEquals(0xFFE8E8E8, p[0]);
		assertEquals(0xFFE8E8E8, p[1]);
		assertEquals(0xFF5DEAF2, p[2]);
		assertEquals(0xFF5DEAF2, p[9]);
		assertEquals(0, p[10], "ponad punkty pancerza puste");
		int[] q = Formats.armorPoints(Arrays.asList("minecraft:leather_boots", "minecraft:elytra"), 3);
		assertEquals(0xFFB0703F, q[2], "punkty spoza tabeli w kolorze ostatniej części");
		assertEquals(Formats.tpsColor(19.9), pl.mibclient.mod.core.Theme.GOOD);
	}
}
