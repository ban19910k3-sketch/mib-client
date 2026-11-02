package pl.mibclient.mod.fabric.test;

import com.mojang.blaze3d.platform.InputConstants;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import net.fabricmc.fabric.api.client.gametest.v1.FabricClientGameTest;
import net.fabricmc.fabric.api.client.gametest.v1.TestInput;
import net.fabricmc.fabric.api.client.gametest.v1.context.ClientGameTestContext;
import net.fabricmc.fabric.api.client.gametest.v1.context.TestSingleplayerContext;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.PauseScreen;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.LivingEntity;
import pl.mibclient.mod.core.HudEditorModel;
import pl.mibclient.mod.core.HudPos;
import pl.mibclient.mod.core.Lang;
import pl.mibclient.mod.core.MenuView;
import pl.mibclient.mod.core.ModuleDef;
import pl.mibclient.mod.core.ModuleManager;
import pl.mibclient.mod.fabric.HudEditorScreen;
import pl.mibclient.mod.fabric.Input;
import pl.mibclient.mod.fabric.MenuScreen;
import pl.mibclient.mod.fabric.MibClient;

/** Automatyczny test w prawdziwym kliencie: menu, wyszukiwarka, ustawienia, edytor HUD, HUD, zoom, celownik + zrzuty. */
public class MibClientGameTest implements FabricClientGameTest {
	/** Peleryna 64×32 do testu (fioletowa z białym kwadratem). */
	/** Animowana peleryna: 2 klatki 64×32 jedna pod drugą (fiolet, złoto). */
	private static final String CAPE_ANIM_PNG = "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAbElEQVR42u3aMRGAMBAAwX+s0COEAhPRFRMUCEmPlqAiM2GyK+Hqy3q9PQYo957xA1ssTgABBBBAAAEEEEAAAQQQQAABAAAAgBVkb+eQPyCPxx8ggAACCCCAAAIIIIAAAggggAACAAAAAHP4AFL9CEMyiPRnAAAAAElFTkSuQmCC";
	/** Kościane skrzydła i aura „Czarna magia” z kosmetyków na Halloween (supabase/schema.sql). */
	private static final String FAIRY_PNG = "iVBORw0KGgoAAAANSUhEUgAAAIAAAABACAYAAADS1n9/AAAC8klEQVR4nO2aSY4TQRBF4wbsetVrFlyBDUfhZCxYcR2ExHUaWSJbQSimLKedLvyeZJVk15AVP/JHDhYBuAe/f/18m/nsbi806Qr64/u3qQ+JspnVwn5++fr+iZ6pzyFR7sRKYT+9fHl7/fDxn+PlGZdjJf5A32tca++5MlHuEeOHphLWnuMJYsX2fp9NgCPPuBx1W/X9ove8fYQfHGvNXmCtI3SE0MfxnJk2RW3JksL2+Kwt3YT87+kEeARUHzOxPcuebZdXUrx7H2mjTZ6nprJYG1TtCN71kf3PtisrAzYpdI+3iVCVj/URPRlVgKNeNZKhU6dn7dYbVGZt1W2xCYADFFQ27vV8HXgpkuhorc1mFlo8T3ztBFX5WB/RE9JxAJsMlROM+14z0BplIGqj15YhescBVsbwtFQ2njlApxzcygG8Z0YOIIlL3SKmp2KmvmZie9+LEnK2Xfq6bsJ126rfeX1ET0ZnhO3NCuz50ffXlgBPZDu6j77vzFRWxvKUVIMkK+pYPvUC6iWBTC4CDbzFoEj80ZNtza/GJzhAYwAoExYsf0XQv68aAwzxozZHJYiBYEE2145svbJWfd2KWUDW86NSFV3nvfNTUzmAJ3a21CrO7OHoQlB3NO9N+cSsEOIAAXbJVZTYkcg6MaLA6uuv2Qvo7EBmDqGvF5PIbAYV26/a/sWIXW0I6W3Yow5gr60SzWtrNF5hN1Bhk0DU9mok8gisKGF0UO3/CWYTwO7nizMwHM/O5vve9jXiB1gn8KZ00QAxC6oWtEOWMNHsILJ5+w4In6CdQJQQ0ZKs7l2dwHaSoHOOXiGMXEqXEVH7EiRAwQjS6OGepdvetSOoepagS5ctGcMhEH8S2xN1ULUD7AzqENjau20T//07QBQ0OyLflQRWfEnKEAlwgCxodqFmZwJ0ajsJcCNmR/er2V2Cnh4SALYlAeI/ELsS4N7PBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADYwR/D3V6h8BlThQAAAABJRU5ErkJggg==";
	private static final String AURA_PNG = "iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAYAAACinX6EAAAAQUlEQVR4nO3SsREAEBAEQE3qUUOKUIHwjUQoZIbd9JL7n0sJlpJ73O5wzTy+1YjdE2Z+ttVhXy8AAAAAAAAA3jYAkQETRZ57KnUAAAAASUVORK5CYII=";
	/** Czapka z modelem 3D w PNG (kawałek „mib-model”, od 0.33.0): czapeczka ze śmigłem, które się kręci. */
	private static final String MODEL_HAT_PNG = "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";
	/** Model na tułowiu: kotylion na piersi. */
	private static final String MODEL_BODY_PNG = "iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAYAAACinX6EAAABTXRFWHRtaWItbW9kZWwAeyJwYXJ0cyI6W3siYm9uZSI6ImJvZHkiLCJwaXZvdCI6WzIsNCwwXSwicm90IjpbMCwwLDBdLCJib3hlcyI6W1swLDAsLTMuNSwtMy41LC0zLjI1LDcsNywxXSxbMTYsMCwtMi41LC0yLjUsLTMuNSw1LDUsMV0sWzI4LDAsLTEsLTEsLTMuNzUsMiwyLDFdXX0seyJib25lIjoiYm9keSIsInBpdm90IjpbMi45LDYuNiwwXSwicm90IjpbMCwwLC0xNl0sImJveGVzIjpbWzM0LDAsLTEsMCwtMywyLDQsMSwtMC4xXV19LHsiYm9uZSI6ImJvZHkiLCJwaXZvdCI6WzEuMSw2LjYsMF0sInJvdCI6WzAsMCwxNl0sImJveGVzIjpbWzQwLDAsLTEsMCwtMywyLDQsMSwtMC4xXV19XX0y8csgAAADOklEQVR42u3UzW8bRRjH8e/sm73OxjZ2HSdVaHEISShEQgoVfwSIUy/0v+PCDcGVK7c2VZQopKR5aV7q4DRughPver273nk4tLWKipAQORQxn9Mzs6NZ/Z4ZjeKV8/OuuK5LlmVorbFtm1rthgLIskSiKMKyLNI0pVgsEgRlxRt2WssSao2nFJ8e/qIAtlvLYgEjEe68mgPodDriui5aa0SEZrOpANbX10RrwfNc4jjm7t0vFMDq6kPxvJfrtRZWVj7/07//Det1Ua831PMXl2TaJk5lHB7AdQuqWq2pMB6hrQJn51dvbXQwjGknMdtxNJ5bOthUO3HEznDAD82WAGitpVKpUK/XqVar1Ot1hsOhbG1tiu/7XHx9H9/38X2fn99fkv39XfH9IpdffYPv+1QqZX6aXZDraoBzddWTcrmq9g+fyXSjSjzM0BY8PWrL3O1ZpfVILMtRR+2OTDeqDOIU8iJ7B8cy37qldlvLshVH9PSIm26R0yzh+2ZLFv0JHscROXDTLdDJEn6cnpO9vT3yPOfyakB50sfzPEQEEWE4HAIQRQPyfEQqQhRFjEb5uPZ9n2tLDzhaa05Ou9K8UaFz2qVUKhFMFJmcdHl61JY8z9k/bEslKNAPY8IwZGa6gVKKzcdPhC/voUVYKZUBaLouj6I+AFqEll8CFHN2ic1ByMLCwl9e342NdRERUhGyLEVrTSg572UZWgt9nRNkGUmSMpLra4ETBAHtziGVoMBUo0aSJDiOQ6Hg0e/3GQwmENEEQUCSJMxMN+j1LvFcC6UUI4FUhIfRFVOux8Uo43VCVymexAPKjks3S9F/c3ZxPCCOh8SiCcMQ23aItYzrocirN+jlmuuikiSWg+MOpaJHpTzB+cUlhUIB11GcdF5wa7bJafd3GvUayAjBxnEcXEfx7Lcunyx9pAC+nbotIhBYFveeH4xP+bupDyRHsFHcPztUvGNUr3ch1WpN/bqzLxYax7GplAPOexGL863x99W1DZlpNrBtm8nA5/jkjDuL8+9coH/cgDcHDx6tieO4lEolPl748K1wW9u7IiIkScLKZ8v/+fCGYRiGYRiGYRiGYRiGYRiGYfy//AEAiaoin9fhUgAAAABJRU5ErkJggg==";
	/** Pet, ogon i plecak z modelem 3D (od 0.34.0): kotek, koci ogon, plecak MiB. */
	private static final String PET_PNG = "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";
	private static final String TAIL_PNG = "iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAYAAACinX6EAAABIXRFWHRtaWItbW9kZWwAeyJwYXJ0cyI6W3siYm9uZSI6ImJvZHkiLCJwaXZvdCI6WzAsMTAuNSwyLjI1XSwicm90IjpbMjAsMCwwXSwiYm94ZXMiOltbMCwwLC0wLjUsLTAuNSwwLDEsMSwzXSxbOCwwLC0wLjUsLTEuNSwzLDEsMSwyXSxbMTQsMCwtMC41LC0zLjAsNC41LDEsMSwyXSxbMjAsMCwtMC41LC01LjAsNS41LDEsMiwxXSxbMjQsMCwtMC41LC03LjAsNS41LDEsMiwxXSxbMjgsMCwtMC41LC04LjUsNC44LDEsMiwxXSxbMzIsMCwtMC41LC05LjMsNC4yLDEsMSwxXV0sIndhdmUiOls2LDE4LDAsMC44LDBdfV19zlxoYwAAARFJREFUeNrt0rFuwjAQBuD/Ll1CQuiYIOhCHKkQ3v9JuqEOqURWSqiy1P47UFFS6NbS5b7JvrPku7OBM1W1ZlkuiSsWi0eW5eoiV5ZLOlcP4s6tWFVfMedqVtWaP90TxwnjOL1671+T802ez6iq2G4b+X5wOn0gCbTtMFcUcwJA277IsbmaIgoRgYjAew9VPa2PcUUI7xBRNM0zAJ7K6fuD3HIAd4NpiCCEgOFr1uy6HcbjCbz3KIo503QCEcHhsMdolEBEkOczZtk99vsdAIDkZ2MCgFCNQBIhBERRdMrfuuGLH+Dcil33ClVFmmbw3qPv30ASSZJhs3n61wKNMcYYY4wxxhhjjDHGGGOMMeY3fACZFme5x8ObmAAAAABJRU5ErkJggg==";
	private static final String BACK_PNG = "iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAYAAACinX6EAAABHHRFWHRtaWItbW9kZWwAeyJwYXJ0cyI6W3siYm9uZSI6ImJvZHkiLCJwaXZvdCI6WzAsMCwwXSwicm90IjpbMCwwLDBdLCJib3hlcyI6W1swLDAsLTMuNSwxLDIuMjUsNyw4LDRdLFsyMiwwLC0zLDUsNi4yNSw2LDMsMV0sWzM2LDAsLTMuNSwwLjUsMi4yNSw3LDEsNF0sWzU4LDAsLTEsMCw0LDIsMSwxXSxbMCwxMiwyLjAsLTAuMywtMi40LDEsMSw1XSxbMTIsMTIsMi4wLDAuNSwtMi40NSwxLDYsMF0sWzE0LDEyLC0zLjAsLTAuMywtMi40LDEsMSw1XSxbMjYsMTIsLTMuMCwwLjUsLTIuNDUsMSw2LDBdXX1dfZ4fthcAAAToSURBVHja7ZjPi2TVFcc/59z3XlV197QOiN3O+BNBxGHUcRfQMODGZTZBJCgDkSiomwTFRUgIjOBCs8lCMKCbJJBFQPIXZMjAoEbiD+KPhagx0jXML/tHvar37r3nZPFqhHRVg8yqm9QHavPOq3PP+95zzznvCbt4+sQ5FwRBSd4Qc41IwD0DUIYB5kapfRwjW0JEeP39h2S3r8fu+Yu7G62N6IUV3J3sDeYZQRERkrUU2kcl8OdPHp3xcd/aKVcpcRz3BAgqBY4DjrujEnAMdydohVnL++ffmPH1p5fucDOnVynjxnjiV19KsfsmQbhx6RhBSyZpkyqsEK3myvgLkjesLx8n2phsERGlH1YZjj7c7YafHPurBykRESR3QRdhQJtHuCdUK178wwOA88rjH/PCH4/zm2Lodx9bl90RLZU3YJ4pdED2FkWp0yUAVqp1srcIAiJka5n4lZl43nr1Th+NDVXBHA4tBd569U6fEWCSNpnkb+lzPSKBaDXJGkQUNyNZi0pJVawQbTy9ZzyzYB0vIqLctHwfUh2hyduUOmAcLxG0IlvLHbffws9PnuV3Zx7h+YfP8eOXw4wfkYBIoJQejhOkxDzhnnA3ALLHTgDvBOt+/8uPfvH57EWgmL0kXKw/o9AB0WoK7ROkos07iASGow9QKRAU8zTNgutmvKgEskeGo4/I3naBWvNdCpsn/nbmDMPRv/j7WeNC/Tnu98yLkbq90O2yBNytW38qzFb7H1QKwBEUd8Mxvi/yzAP/cEF5e/gmDx59lmwNrdX0wypt3iFo1e00Qr84zDhd4Z2NN/jBkac4t/F7glQIgpFRurNonnhv4zXhGjix/jMX6XbRPZE9olIC3p19dxzr1vTcHTECKop5xjwStEe2TjDzhCB8cP7N+RkgErhhcBf94jDJJiSbcHTlBCIF2dtpmjnDnQ8Zp8usLR3jUO9mkk344dHnONQ7wnJ5Pe4gAu7w9fa7vLfx2rU8P/8cvn5Nwl0r2qQtHMc8Mk6XiTYCFBUlW0OpS7gbIoEgFVVYxt2owvK0oGXquMUoXiIbbLfnCdLjoFCIKCoBEEodAEK0EXWsKcISySaIBJKNcZxRvAg42VqyR3phdVooW7babwhSkuYUxX0rAAgx111P94igtLmmCsvEPMIkEq0maEWyhmg1bd5hkjdxd1qrKaSiX3T11Lt8OjgCZGtINgF3JmkTlYKgFeN0BXdjUA7oySrZviBIhXkmaA8QghY0aYsogSosM0lbgFPHywdHACcjEsh+dSIriHlEoT1UCrabDVQCTd4GYLV3hGwt5gmdzglXO4GTKaRPFZYOUgZEvto8y067QZO3EeDSOHUFbtp6imlbqcIKF+pPGcUhQUravMO3k39/l/gxj3CgCsscaO5ff9KP3/i4z7M9eOsv/eRtp+fa7l075fev/XSu7eRtp/2hW3/t+7AIznJ1wptHkJLkkz1sFexRAJM3mMV9t9k6/0EKhDD3D9HG6HzdyN7s5RKlG10PhADJWvYaxwTds88H6e1pSzamG3EPgACF9tjrsHbzQrtHBrTTYWqOcKL78gjIvWunHHdUCwQhWdO1NVHASdZQ6ACmg9JKdRPZWtq8M/0g0rVP8Ol7eZi+nTEVyqcj9CEA3v7mt/svDRYsWLBgwYIFCxYsWLBgwf8Z/wUYc5xckVigmwAAAABJRU5ErkJggg==";
	private static final String CAPE_PNG = "iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAYAAACinX6EAAAAcklEQVR42u3UMQ2AMBBG4b9NBZBQAyADE3hAB2N11AMmkAEGIMEBrAwMLAxc37ddctPL5dzY7ac+kOba6QeCJDXxeLW8bpWs8Spc8QHCfRim9nEp9wsXQAACEMD+E7T87LgAAhCAAAQgAAEAAAAAAIB0ATapC/N+AwboAAAAAElFTkSuQmCC";

	private final List<String> errors = new ArrayList<>();

	@Override
	public void runTest(ClientGameTestContext context) {
		TestInput input = context.getInput();
		context.takeScreenshot("00-title");
		long t0 = System.nanoTime();
		// świat wczytuje się w małym oknie (renderowanie programowe na CI jest wolne), zrzuty robimy w 1280×720
		try (TestSingleplayerContext sp = context.worldBuilder().create()) {
			System.out.println("[MIB-TEST] świat wczytany po " + (System.nanoTime() - t0) / 1_000_000 + " ms");
			// z Sodium i jednym wątkiem budowania na CI teren może nie zdążyć w minutę — test sprawdza mod, nie teren
			try {
				//#if MC >= 26.2
				sp.getConnection().waitForChunksRender();
				//#elif MC >= 26.1
				sp.getClientLevel().waitForChunksRender();
				//#else
				sp.getClientWorld().waitForChunksRender();
				//#endif
			} catch (AssertionError e) {
				System.out.println("[MIB-TEST] teren nie wczytał się do końca, test idzie dalej");
			}
			input.resizeWindow(1280, 720);
			context.waitTicks(20);
			context.takeScreenshot("00-game");

			input.pressKey(InputConstants.KEY_RSHIFT);
			context.waitTicks(5);
			check(context.computeOnClient(c -> Input.screen(c) instanceof MenuScreen), "prawy Shift nie otworzył menu");
			//#if MC >= 26.1
			check(context.computeOnClient(MibClientGameTest::textInputOn), "menu nie włączyło wpisywania tekstu (wyszukiwarka nie dostanie liter)");
			//#endif
			context.takeScreenshot("01-menu");

			input.typeChars("cps");
			context.waitTicks(3);
			click(context, "pill:cps");
			check(!context.computeOnClient(c -> MibClient.get().modules.isOn("cps")), "klik w pigułkę nie wyłączył CPS");
			context.takeScreenshot("02-menu-cps-off");
			context.runOnClient(c -> {
				if (view(c) != null) view(c).clearQuery();
			});

			input.typeChars("zoom");
			context.waitTicks(3);
			check("zoom".equals(context.computeOnClient(c -> view(c) == null ? null : view(c).query())), "wyszukiwarka nie przyjęła tekstu");
			context.takeScreenshot("03-search");

			click(context, "lang");
			check("pl".equals(Lang.chosen()), "przycisk języka nie zmienił języka menu");
			click(context, "lang");
			click(context, "lang");
			check("auto".equals(Lang.chosen()), "przycisk języka nie wrócił do języka gry");
			click(context, "gear:zoom");
			check(context.computeOnClient(c -> view(c) != null && view(c).page() == MenuView.Page.SETTINGS), "zębatka nie otworzyła ustawień");
			context.takeScreenshot("04-settings");

			click(context, "modules");
			context.runOnClient(c -> {
				if (view(c) != null) view(c).clearQuery();
			});
			context.waitTicks(3);
			click(context, "edit_hud");
			check(context.computeOnClient(c -> Input.screen(c) instanceof HudEditorScreen), "„Edytuj HUD” nie otworzył edytora");
			context.takeScreenshot("05-hud-editor");
			dragFps(context, input);

			context.setScreen(() -> null);
			context.runOnClient(c -> {
				ModuleManager m = MibClient.get().modules;
				for (ModuleDef d : m.all()) if (d.hud && !m.isOn(d.id)) m.toggle(d.id);
				if (!m.isOn("brightness")) m.toggle("brightness");
			});
			context.waitTicks(20);
			context.takeScreenshot("06-hud-all");
			// moduły etapów 3 i 4 w grze: nasycenie (tryb przetrwania), tabela wyników, pasek bossa, czat, pogoda, kamera, ręka
			context.runOnClient(c -> {
				ModuleManager m = MibClient.get().modules;
				for (String id : new String[] {"saturation", "scoreboard", "boss_bar", "custom_chat", "weather_changer", "camera", "viewmodel"}) {
					if (!m.isOn(id)) m.toggle(id);
				}
				m.state("scoreboard").setOption("hide", false);
				m.state("scoreboard").setOption("scale", 80);
				m.state("boss_bar").setOption("hide", false);
				m.state("weather_changer").setOption("weather", "rain");
			});
			sp.getServer().runCommand("gamemode survival @a");
			sp.getServer().runCommand("scoreboard objectives add mib dummy \"MiB\"");
			sp.getServer().runCommand("scoreboard objectives setdisplay sidebar mib");
			sp.getServer().runCommand("scoreboard players set Gracz mib 7");
			sp.getServer().runCommand("bossbar add mib:test \"MiB\"");
			sp.getServer().runCommand("bossbar set mib:test players @a");
			sp.getServer().runCommand("say MiB");
			// własna wiadomość na czacie z logo MiB przed nickiem
			context.runOnClient(c -> c.getConnection().sendChat("hej"));
			context.waitTicks(20);
			context.takeScreenshot("06d-stage3");
			sp.getServer().runCommand("gamemode creative @a");

			// edytor HUD ze wszystkimi modułami: przykładowa treść także tych bez danych (combo, zasięg, stoper…)
			context.runOnClient(c -> MibClient.get().openHudEditor(null));
			context.waitTicks(5);
			context.takeScreenshot("06b-hud-editor-all");
			context.setScreen(() -> null);
			context.waitTicks(2);

			// walka: uderzenie świni w miejscu gracza liczy trafienie, zasięg i combo (zombie płonie w dzień, a wtedy
			// chwilowa nietykalność po obrażeniach od ognia gubi uderzenie; obok gracza istota mogłaby utknąć w bloku)
			sp.getServer().runCommand("execute as @p at @p run summon minecraft:pig ~ ~ ~ {NoAI:1b,Silent:1b,Tags:[\"mib\"]}");
			context.waitTicks(10);
			context.runOnClient(c -> {
				if (!MibClient.get().modules.isOn("hit_indicator")) MibClient.get().modules.toggle("hit_indicator");
				// najbliższa istota (świnia w miejscu gracza)
				Entity target = null;
				for (Entity e : c.level.getEntities(c.player, c.player.getBoundingBox().inflate(6))) {
					if (e instanceof LivingEntity && (target == null || e.distanceTo(c.player) < target.distanceTo(c.player))) target = e;
				}
				if (target != null) c.gameMode.attack(c.player, target);
			});
			context.waitTicks(10);
			check(MibClient.hooks.contains("attack"), "uderzenie nie dotarło do modułów PvP");
			check(context.computeOnClient(c -> MibClient.get().pvp.combat.reach() >= 0), "trafienie nie zostało policzone (zasięg)");
			context.takeScreenshot("06c-pvp");
			check(context.computeOnClient(c -> MibClient.get().pvp.meters.tps.tps() > 0), "brak pomiaru TPS");
			// Totem: świnia z totemem w ręce dostaje śmiertelne obrażenia i zużywa totem
			sp.getServer().runCommand("item replace entity @e[tag=mib,limit=1] weapon.mainhand with minecraft:totem_of_undying");
			sp.getServer().runCommand("damage @e[tag=mib,limit=1] 100");
			context.waitTicks(10);
			check(MibClient.hooks.contains("totem"), "zużyty totem nie został policzony");
			// logo MiB przed nickiem (własna postać zawsze gra w MiB)
			check(context.computeOnClient(c -> c.player.getDisplayName().getString().startsWith("\uE000")), "brak logo MiB przed nickiem");

			// moduły świata: zdrowie nad świnią, odliczanie TNT, tytuł, ping liczbami w Tab, pora dnia, ekwipunek, blokada wyrzucania
			context.runOnClient(c -> {
				ModuleManager m = MibClient.get().modules;
				for (String id : new String[] {"player_overlay", "tnt_timer", "title_tweaker", "time_changer", "inventory", "drop_prevention"}) {
					if (!m.isOn(id)) m.toggle(id);
				}
				m.state("player_overlay").setOption("mobs", true);
				m.state("time_changer").setOption("time", "sunset");
			});
			check(context.computeOnClient(c -> c.player.getDisplayName().getString().contains("\u2764")), "Player overlay nie dopisał zdrowia do nicku");
			sp.getServer().runCommand("execute at @p run summon minecraft:tnt ~3 ~ ~ {fuse:400}");
			sp.getServer().runCommand("scoreboard objectives setdisplay list mib");
			sp.getServer().runCommand("title @a title \"MiB\"");
			sp.getServer().runCommand("clear @a");
			sp.getServer().runCommand("give @a minecraft:diamond_sword");
			context.waitTicks(10);
			input.holdKey(o -> o.keyPlayerList);
			context.waitTicks(5);
			context.takeScreenshot("06e-world");
			input.releaseKey(o -> o.keyPlayerList);
			context.runOnClient(c -> {
				//#if MC >= 26.3
				c.gameMode.dropItem(c.player, false);
				//#else
				c.player.drop(false);
				//#endif
			});
			context.waitTicks(5);
			check(context.computeOnClient(c -> !c.player.getMainHandItem().isEmpty()), "Drop prevention nie zatrzymał wyrzucenia miecza");
			context.runOnClient(c -> {
				if (!MibClient.get().modules.isOn("dark_mode")) MibClient.get().modules.toggle("dark_mode");
			});
			context.setScreen(() -> new net.minecraft.client.gui.screens.inventory.InventoryScreen(Minecraft.getInstance().player));
			context.waitTicks(5);
			context.takeScreenshot("06f-inventory");
			context.setScreen(() -> null);
			context.waitTicks(2);

			// reszta listy: wygląd świata, przedmioty na ziemi, punkty, światło, emotki, animacje, efekty, klawisze, skala
			context.runOnClient(c -> {
				ModuleManager m = MibClient.get().modules;
				for (String id : new String[] {"color_saturation", "motion_blur", "custom_fog", "block_overlay", "item_physic", "uhc_overlay", "loot_beams", "light_level",
						"waypoints", "animations", "emotes", "hitbox", "keybind_search", "custom_f3", "tooltips"}) {
					if (!m.isOn(id)) m.toggle(id);
				}
				m.state("hitbox").setOption("always", true);
				m.state("emotes").setOption("camera", false);
			});
			sp.getServer().runCommand("time set noon");
			sp.getServer().runCommand("tp @p ~ ~ ~ 0 35");
			context.waitTicks(5);
			sp.getServer().runCommand("execute at @p anchored eyes run summon item ^ ^ ^3 {Item:{id:\"minecraft:golden_apple\",count:1},PickupDelay:32767}");
			sp.getServer().runCommand("execute at @p anchored eyes run summon item ^1 ^ ^3 {Item:{id:\"minecraft:diamond\",count:3},PickupDelay:32767}");
			context.runOnClient(c -> {
				net.minecraft.core.BlockPos p = c.player.blockPosition().relative(c.player.getDirection(), 6);
				pl.mibclient.mod.core.modules.Waypoints.add(MibClient.get().modules.state("waypoints"), pl.mibclient.mod.fabric.Extras.worldKey(c),
						pl.mibclient.mod.fabric.Extras.dimension(c), p.getX(), p.getY(), p.getZ(), "Test");
			});
			context.waitTicks(30);
			input.holdKey(o -> o.keyUse);
			context.waitTicks(5);
			context.takeScreenshot("06g-world2");
			input.releaseKey(o -> o.keyUse);
			// Hitbox „tylko gracze”: ramki leżących przedmiotów znikają
			context.runOnClient(c -> MibClient.get().modules.state("hitbox").setOption("players", true));
			context.waitTicks(5);
			context.runOnClient(c -> MibClient.get().modules.state("hitbox").setOption("players", false));
			context.runOnClient(c -> {
				MibClient.get().extras.startEmoteForTest("wave");
				c.options.setCameraType(net.minecraft.client.CameraType.THIRD_PERSON_FRONT);
			});
			context.waitTicks(5);
			context.takeScreenshot("06h-emote");
			// nowe emotki całego ciała (głowa, tułów, nogi)
			for (String id : new String[] {"dab", "take_l", "floss", "facepalm", "zombie"}) {
				context.runOnClient(c -> MibClient.get().extras.startEmoteForTest(id));
				context.waitTicks(4);
				context.takeScreenshot("06h-emote-" + id);
			}
			context.runOnClient(c -> c.options.setCameraType(net.minecraft.client.CameraType.FIRST_PERSON));
			// koło emotek (przytrzymanie B): klik w „Dab” włącza emotkę i zamyka koło
			context.runOnClient(c -> MibClient.get().extras.startEmoteForTest("wave"));
			context.setScreen(() -> new pl.mibclient.mod.fabric.EmoteWheelScreen(MibClient.get().extras));
			context.waitTicks(3);
			double[] dab = context.computeOnClient(c -> {
				pl.mibclient.mod.fabric.EmoteWheelScreen s = (pl.mibclient.mod.fabric.EmoteWheelScreen) Input.screen(c);
				int[] r = s.wheel().slot(5, s.width, s.height);
				// odwrotnie niż Input.guiX/guiY: kursor w pikselach okna (od 26.3 skala GUI nie dzieli rozmiaru okna)
				com.mojang.blaze3d.platform.Window w = c.getWindow();
				return new double[] {(r[0] + r[2] / 2.0) * w.getScreenWidth() / w.getGuiScaledWidth(), (r[1] + r[3] / 2.0) * w.getScreenHeight() / w.getGuiScaledHeight()};
			});
			input.setCursorPos(dab[0], dab[1]);
			// wskazana emotka: postać w środku koła ją pokazuje (podgląd z pozą emotki)
			for (int t = 0; t < 100 && !MibClient.hooks.contains("emote_preview"); t++) context.waitTick();
			context.takeScreenshot("06m-emote-wheel");
			check(MibClient.hooks.contains("emote_preview"), "postać w kole emotek nie pokazuje wskazanej emotki");
			input.pressMouse(InputConstants.MOUSE_BUTTON_LEFT);
			// na 26.3 w CI gra rysuje bardzo wolno: kilka ticków mija w jednej klatce, zanim gra obsłuży kliknięcie
			for (int t = 0; t < 100 && context.computeOnClient(c -> Input.screen(c) != null); t++) context.waitTick();
			String wheel = context.computeOnClient(c -> "dab".equals(MibClient.get().extras.currentEmote()) && Input.screen(c) == null ? null
					: "emotka " + MibClient.get().extras.currentEmote() + ", ekran " + (Input.screen(c) == null ? "brak" : Input.screen(c).getClass().getSimpleName())
					+ ", wybór " + MibClient.hooks.contains("emote_wheel_pick") + ", mysz " + Math.round(dab[0]) + "," + Math.round(dab[1]));
			check(wheel == null, "klik w „Dab” w kole emotek nie zadziałał: " + wheel);
			context.runOnClient(c -> c.options.setCameraType(net.minecraft.client.CameraType.FIRST_PERSON));
			// powiadomienie od launchera: znajomy zaprasza do gry (okienko w prawym górnym rogu)
			context.runOnClient(c -> MibClient.get().showNotice(new pl.mibclient.mod.core.Notice("test", "invite", "Ala", "1.21.11", "play.mib.pl", System.currentTimeMillis())));
			context.waitTicks(20);
			context.takeScreenshot("06j-notice");
			// Kosmetyki w menu: obracająca się postać stoi w ramce podglądu (menu jest przeskalowane, a od 1.21.6
			// gra rysuje postać osobno, bez skali menu)
			context.runOnClient(c -> {
				MibClient.testCosmetics = new pl.mibclient.mod.core.Cosmetics(true, java.util.Arrays.asList(
						new pl.mibclient.mod.core.Cosmetics.Item("test_cape", "Peleryna testowa", "cape", false, null)));
				pl.mibclient.mod.fabric.FabricCanvas.lastPlayerBox = null;
			});
			context.setScreen(() -> new MenuScreen(MibClient.get(), null));
			context.waitTicks(3);
			click(context, "cosmetics");
			context.waitTicks(10);
			context.takeScreenshot("06k-cos-preview");
			String box = context.computeOnClient(c -> {
				if (!(Input.screen(c) instanceof MenuScreen)) return "menu kosmetyków się zamknęło";
				MenuScreen s = (MenuScreen) Input.screen(c);
				int[] ct = s.view().layout().content, b = pl.mibclient.mod.fabric.FabricCanvas.lastPlayerBox;
				if (b == null) return "postać w podglądzie kosmetyków się nie narysowała";
				float f = s.menuScale() / (float) c.getWindow().getGuiScale();
				// nad podglądem wiersz „Pety innych graczy” (od 0.34.0, 26 pikseli menu)
				int[] want = {Math.round((ct[0] + 2) * f), Math.round((ct[1] + 42 + 26) * f), Math.round((ct[0] + 82) * f)};
				if (Math.abs(b[0] - want[0]) > 2 || Math.abs(b[1] - want[1]) > 2 || Math.abs(b[2] - want[2]) > 2)
					return "postać poza ramką podglądu: " + java.util.Arrays.toString(b) + " zamiast " + java.util.Arrays.toString(want);
				return null;
			});
			check(box == null, box);
			context.setScreen(() -> null);
			context.runOnClient(c -> MibClient.testCosmetics = null);
			// Znajomi w menu: lista, rozmowa i pisanie wiadomości
			context.runOnClient(c -> {
				MibClient.testFriends = new pl.mibclient.mod.core.Friends(true, java.util.Arrays.asList(
						new pl.mibclient.mod.core.Friends.Friend("a", "Kolega", "game", "play.mib.pl", 1),
						new pl.mibclient.mod.core.Friends.Friend("b", "Ziomek", "offline", null, 0)));
				MibClient.testChat = new pl.mibclient.mod.core.Friends.Chat("a", 1, java.util.Arrays.asList(
						new pl.mibclient.mod.core.Friends.Message(1, false, "Siema, wchodzisz?", true, false),
						new pl.mibclient.mod.core.Friends.Message(2, true, "Jasne", true, false)));
			});
			context.setScreen(() -> new MenuScreen(MibClient.get(), null));
			context.waitTicks(3);
			click(context, "friends");
			click(context, "friend:a");
			input.typeChars("Hej MiB");
			context.waitTicks(3);
			check("Hej MiB".equals(context.computeOnClient(c -> view(c) != null ? view(c).draft() : null)), "pisanie w rozmowie nie trafiło do pola wiadomości");
			context.takeScreenshot("06l-chat");
			context.setScreen(() -> null);
			context.runOnClient(c -> {
				MibClient.testFriends = null;
				MibClient.testChat = null;
			});
			context.setScreen(() -> new net.minecraft.client.gui.screens.options.controls.KeyBindsScreen(null, Minecraft.getInstance().options));
			context.waitTicks(5);
			context.takeScreenshot("06i-keybinds");
			context.setScreen(() -> null);
			context.runOnClient(c -> {
				ModuleManager m = MibClient.get().modules;
				if (!m.isOn("ui_scaling")) m.toggle("ui_scaling");
			});
			context.waitTicks(3);
			context.runOnClient(c -> {
				ModuleManager m = MibClient.get().modules;
				m.toggle("ui_scaling");
				for (String id : new String[] {"color_saturation", "motion_blur", "dark_mode"}) if (m.isOn(id)) m.toggle(id);
			});
			context.waitTicks(3);

			// Auto sprint: idąc do przodu postać biegnie bez klawisza biegu
			context.runOnClient(c -> {
				if (!MibClient.get().modules.isOn("auto_sprint")) MibClient.get().modules.toggle("auto_sprint");
			});
			input.holdKey(o -> o.keyUp);
			context.waitTicks(8);
			check(context.computeOnClient(c -> c.options.keySprint.isDown() && c.player.isSprinting()), "Auto sprint: postać nie biegnie");
			input.releaseKey(o -> o.keyUp);
			context.runOnClient(c -> MibClient.get().modules.toggle("auto_sprint"));
			context.waitTicks(3);
			check(context.computeOnClient(c -> !c.options.keySprint.isDown()), "Auto sprint po wyłączeniu dalej trzyma klawisz biegu");

			input.holdKey(MibClient.get().zoomKey);
			context.waitTicks(10);
			check(context.computeOnClient(c -> MibClient.get().zoom.active()), "zoom nie działa po przytrzymaniu C");
			context.takeScreenshot("07-zoom");
			input.releaseKey(MibClient.get().zoomKey);
			context.waitTicks(10);

			context.runOnClient(c -> {
				if (!MibClient.get().modules.isOn("custom_crosshair")) MibClient.get().modules.toggle("custom_crosshair");
			});
			context.waitTicks(3);
			context.takeScreenshot("08-crosshair");

			// prawy Shift: pisanie z nim wielkich liter nie zamyka menu, samo naciśnięcie zamyka
			input.pressKey(InputConstants.KEY_RSHIFT);
			context.waitTicks(5);
			check(context.computeOnClient(c -> Input.screen(c) instanceof MenuScreen), "prawy Shift nie otworzył menu drugi raz");
			input.holdKey(InputConstants.KEY_RSHIFT);
			input.typeChars("CPS");
			input.releaseKey(InputConstants.KEY_RSHIFT);
			context.waitTicks(3);
			check(context.computeOnClient(c -> view(c) != null && "cps".equalsIgnoreCase(view(c).query())), "pisanie z prawym Shiftem zamknęło menu albo zgubiło tekst");
			input.pressKey(InputConstants.KEY_RSHIFT);
			context.waitTicks(3);
			check(context.computeOnClient(c -> Input.screen(c) == null), "prawy Shift nie zamknął menu");

			// peleryna MiB (jak po założeniu w menu Kosmetyki) — widać ją na zrzucie z kamery 360°
			context.runOnClient(c -> {
				MibClient.get().applyCape("test:cape", Base64.getDecoder().decode(CAPE_ANIM_PNG));
				// skrzydła MiB bez elytry: gra rysuje je jak elytrę z teksturą skrzydeł
				MibClient.get().applyCosmetic("wings", "test:wings", Base64.getDecoder().decode(CAPE_PNG));
				MibClient.get().applyCosmetic("hat", "test:hat", Base64.getDecoder().decode(CAPE_PNG));
			});

			// Perspective: kamera 360° pod lewym Altem, po puszczeniu wraca widok z oczu
			context.runOnClient(c -> {
				if (!MibClient.get().modules.isOn("perspective")) MibClient.get().modules.toggle("perspective");
			});
			input.holdKey(MibClient.get().perspectiveKey);
			context.waitTicks(3);
			input.moveCursor(200, 0);
			context.waitTicks(3);
			check(context.computeOnClient(c -> MibClient.get().freelook() && !c.options.getCameraType().isFirstPerson()), "Perspective nie włączył kamery 360°");
			context.takeScreenshot("10-perspective");
			input.releaseKey(MibClient.get().perspectiveKey);
			context.waitTicks(3);
			check(context.computeOnClient(c -> c.options.getCameraType().isFirstPerson()), "po puszczeniu klawisza Perspective widok nie wrócił");

			// skrzydła jak u wróżki (tekstura szeroka na 128) i aura z ruchem z id — zrzut z kamery 360° zza pleców
			context.runOnClient(c -> {
				MibClient.get().applyCosmetic("wings", "test:fairy", Base64.getDecoder().decode(FAIRY_PNG));
				MibClient.get().applyCosmetic("aura", "test:halloween_aura_magic:1", Base64.getDecoder().decode(AURA_PNG));
				// maska pod czapką i wysoka czapka (tekstura szeroka na 128: druga kostka nad głową), od 0.25.0
				MibClient.get().applyCosmetic("mask", "test:mask", Base64.getDecoder().decode(CAPE_PNG));
				MibClient.get().applyCosmetic("hat", "test:tall", Base64.getDecoder().decode(FAIRY_PNG));
			});
			check(context.computeOnClient(c -> MibClient.get().fairyWingsFor(c.player) != null && MibClient.get().elytraWingsFor(c.player) == null),
					"skrzydła szerokie na 128 pikseli nie są skrzydłami wróżki");
			check(context.computeOnClient(c -> MibClient.get().auraStyleFor(c.player) == pl.mibclient.mod.core.Auras.MAGIC), "aura bez ruchu z id");
			input.holdKey(MibClient.get().perspectiveKey);
			context.waitTicks(3);
			input.moveCursor(-260, 0);
			context.waitTicks(10);
			context.takeScreenshot("11-halloween");
			input.releaseKey(MibClient.get().perspectiveKey);
			context.waitTicks(3);

			// czapka z modelem 3D (śmigło się kręci) i model na tułowiu (kotylion na piersi), od 0.33.0 — zrzut z kamery 360° z przodu
			context.runOnClient(c -> {
				MibClient.get().applyCosmetic("hat", "test:smiglo", Base64.getDecoder().decode(MODEL_HAT_PNG));
				MibClient.get().applyCosmetic("mask", "test:kotylion", Base64.getDecoder().decode(MODEL_BODY_PNG));
			});
			input.holdKey(MibClient.get().perspectiveKey);
			context.waitTicks(3);
			input.moveCursor(200, 0);
			context.waitTicks(10);
			context.takeScreenshot("12-czapka-3d");
			input.releaseKey(MibClient.get().perspectiveKey);
			context.waitTicks(3);

			// pet (lata obok głowy), ogon i plecak (od 0.34.0); peleryna przy plecaku odsunięta — zrzut z kamery 360° z boku
			context.runOnClient(c -> {
				MibClient.get().applyCosmetic("pet", "test:pet", Base64.getDecoder().decode(PET_PNG));
				MibClient.get().applyCosmetic("tail", "test:tail", Base64.getDecoder().decode(TAIL_PNG));
				MibClient.get().applyCosmetic("back", "test:back", Base64.getDecoder().decode(BACK_PNG));
			});
			input.holdKey(MibClient.get().perspectiveKey);
			context.waitTicks(3);
			input.moveCursor(420, 0);
			context.waitTicks(10);
			context.takeScreenshot("13-pet");
			input.releaseKey(MibClient.get().perspectiveKey);
			context.waitTicks(3);

			// menu pauzy z logo MiB
			context.setScreen(() -> new PauseScreen(true));
			context.waitTicks(3);
			context.takeScreenshot("09-pause");
			context.setScreen(() -> null);
			context.waitTicks(2);

			// wszystkie wstawki w grę zadziałały (pole widzenia, jasność, kliknięcia, celownik, logo i ekran tytułowy)
			for (String h : new String[] {"fov", "gamma", "click", "crosshair", "logo", "title-logo", "version", "freelook", "cape", "attack", "hit", "badge", "totem", "loading",
					"saturation", "scoreboard", "boss_bar", "chat", "weather", "camera", "viewmodel", "own-name", "labels", "title", "tablist", "inventory", "drop",
					"post_effect", "custom_fog", "block_overlay", "item_physic", "uhc_overlay", "light_level", "waypoints", "dark_mode", "anim_block", "anim_dip",
					"emote", "keybind_search", "ui_scale", "post_ok", "chat_badge", "auto_sprint", "wings_drawn", "hat_drawn", "mask_drawn", "tall_hat_drawn", "model_hat_drawn", "pet_drawn", "tail_drawn", "back_drawn", "cape_pushed", "fairy_drawn", "aura_drawn", "time", "hitbox", "hitbox_players", "world_marks", "cos_anim", "notice", "emote_wheel"
					//#if MC >= 1.21.2 && MC < 1.21.6
					, "blur_previous"
					//#endif
					}) {
				check(MibClient.hooks.contains(h), "wstawka w grę nie zadziałała: " + h);
			}
			// motyw Halloween: dekoracje na ekranie ładowania, tytułowym i w menu pauzy
			if (pl.mibclient.mod.core.Theme.HALLOWEEN) for (String h : new String[] {"halloween_loading", "halloween_title", "halloween_pause", "halloween_dusk"}) {
				check(MibClient.hooks.contains(h), "wstawka w grę nie zadziałała: " + h);
			}
			// inne święta (od 0.25.0, motyw z -PmibTheme): ozdoby na tych samych ekranach
			else if (!pl.mibclient.mod.core.Theme.ID.isEmpty()) for (String h : new String[] {"holiday_loading", "holiday_title", "holiday_pause"}) {
				check(MibClient.hooks.contains(h), "wstawka w grę nie zadziałała: " + h + " (" + pl.mibclient.mod.core.Theme.ID + ")");
			}
			if ("primaaprilis".equals(pl.mibclient.mod.core.Theme.ID)) check(MibClient.hooks.contains("logo_upside_down"), "na Prima Aprilis logo nie jest do góry nogami");
			// przyciski w kolorach dyni (Halloween) albo ze śniegiem (Boże Narodzenie) z wbudowanej paczki moda tylko w te święta
			// (paczka leży nad zasobami gry)
			int buttons = context.computeOnClient(c -> c.getResourceManager().getResourceStack(
					net.minecraft.resources.MibId.fromNamespaceAndPath("minecraft", "textures/gui/sprites/widget/button.png")).size());
			boolean pack = pl.mibclient.mod.core.Theme.HALLOWEEN || "boze".equals(pl.mibclient.mod.core.Theme.ID);
			check(pack ? buttons >= 2 : buttons == 1, "paczka przycisków święta (" + pl.mibclient.mod.core.Theme.ID + "): plików button.png " + buttons);
		}
		if (!errors.isEmpty()) throw new AssertionError(String.join("; ", errors));
	}

	//#if MC >= 26.1
	/** Czy gra przyjmuje teraz wpisywany tekst (TextInputManager.textInputEnabled). */
	private static boolean textInputOn(Minecraft c) {
		try {
			java.lang.reflect.Field f = Minecraft.class.getDeclaredField("textInputManager");
			f.setAccessible(true);
			Object t = f.get(c);
			java.lang.reflect.Field e = t.getClass().getDeclaredField("textInputEnabled");
			e.setAccessible(true);
			return e.getBoolean(t);
		} catch (ReflectiveOperationException ex) {
			return false;
		}
	}
	//#endif

	private void check(boolean ok, String message) {
		if (!ok) errors.add(message);
	}

	private static MenuView view(Minecraft c) {
		return Input.screen(c) instanceof MenuScreen ? ((MenuScreen) Input.screen(c)).view() : null;
	}

	/** Klik w środek elementu menu (jednostki menu × piksele okna na jednostkę). */
	private void click(ClientGameTestContext context, String name) {
		double[] p = context.computeOnClient(c -> {
			if (!(Input.screen(c) instanceof MenuScreen)) return null;
			MenuScreen s = (MenuScreen) Input.screen(c);
			int[] r = s.view().hitRect(name);
			if (r == null) return null;
			int k = s.menuScale();
			return new double[] {(r[0] + r[2] / 2.0) * k, (r[1] + r[3] / 2.0) * k};
		});
		if (p == null) {
			errors.add("brak elementu menu " + name);
			return;
		}
		context.getInput().setCursorPos(p[0], p[1]);
		context.waitTick();
		context.getInput().pressMouse(InputConstants.MOUSE_BUTTON_LEFT);
		context.waitTicks(3);
	}

	/** Przeciąga FPS o 100 px w prawo i sprawdza, że nowe położenie trafiło do ustawień. */
	private void dragFps(ClientGameTestContext context, TestInput input) {
		double[] p = context.computeOnClient(c -> {
			double gs = c.getWindow().getGuiScale();
			for (HudEditorModel.Box b : MibClient.get().editor.boxes()) {
				if (b.id.equals("fps")) return new double[] {(b.x + b.w / 2.0) * gs, (b.y + b.h / 2.0) * gs};
			}
			return null;
		});
		if (p == null) {
			errors.add("edytor HUD nie pokazał FPS");
			return;
		}
		HudPos before = fpsPos(context);
		input.setCursorPos(p[0], p[1]);
		context.waitTick();
		input.holdMouse(InputConstants.MOUSE_BUTTON_LEFT);
		context.waitTicks(2);
		for (int i = 0; i < 5; i++) {
			input.moveCursor(20, 0);
			context.waitTick();
		}
		input.releaseMouse(InputConstants.MOUSE_BUTTON_LEFT);
		context.waitTicks(3);
		HudPos after = fpsPos(context);
		check(!before.equals(after), "przeciągnięcie FPS nie zmieniło położenia (" + before + ")");
		context.takeScreenshot("05b-hud-editor-dragged");
	}

	private static HudPos fpsPos(ClientGameTestContext context) {
		return context.computeOnClient(c -> MibClient.get().modules.state("fps").hud(MibClient.get().modules.def("fps").defaultHud));
	}
}
