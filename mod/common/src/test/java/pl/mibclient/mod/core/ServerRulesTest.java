package pl.mibclient.mod.core;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;

class ServerRulesTest {
	@Test
	void builtInBlocksFreelookOnHypixel() {
		ServerRules r = ServerRules.builtIn();
		assertTrue(r.blockedFor("Mc.Hypixel.NET:25565").contains("perspective"));
		assertTrue(r.blockedFor("hypixel.net.").contains("snaplook"));
		assertTrue(r.blockedFor("hypixel.net").contains("perspective"));
		assertTrue(r.blockedFor("nothypixel.net").isEmpty());
		assertTrue(r.blockedFor(null).isEmpty());
		assertTrue(r.blockedFor("127.0.0.1").isEmpty());
		assertTrue(r.blockedFor("[::1]:25565").isEmpty());
		assertTrue(r.blockedFor("").isEmpty());
	}

	@Test
	void customRulesAndBadJson() {
		ServerRules r = ServerRules.load("{\"servers\":[{\"hosts\":[\"Pvp.Example.PL\"],\"block\":[\"zoom\"]},{\"hosts\":5},{\"hosts\":[\"x.pl\"],\"block\":\"zoom\"}]}");
		assertTrue(r.blockedFor("eu.pvp.example.pl:25570").contains("zoom"));
		assertTrue(r.blockedFor("x.pl").isEmpty());
		assertTrue(ServerRules.load("nie json").blockedFor("hypixel.net").isEmpty());
		assertTrue(ServerRules.load("[]").blockedFor("hypixel.net").isEmpty());
	}
}
