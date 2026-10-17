package pl.mibclient.mod.core;

import static org.junit.jupiter.api.Assertions.*;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class SearchTest {
	@AfterEach
	void reset() {
		Lang.setGame("pl_pl");
	}

	private List<String> find(String q) {
		List<String> r = new ArrayList<String>();
		for (ModuleDef m : ModuleCatalog.STAGE1) if (Search.matches(m, q)) r.add(m.id);
		return r;
	}

	@Test
	void polishWithoutDiacritics() {
		Lang.setGame("pl_pl");
		assertTrue(find("zbroj").contains("armor_status"));
		assertTrue(find("POZYCJA").contains("coordinates"));
		assertTrue(find("przyblizenie").contains("zoom"));
		assertTrue(find("przybliżenie").contains("zoom"));
		assertTrue(find("xyz qqq").isEmpty());
		assertEquals(17, find("  ").size());
	}

	@Test
	void englishAndNames() {
		Lang.setGame("en_us");
		assertTrue(find("armor").contains("armor_status"));
		assertTrue(find("frames").contains("fps"));
		assertTrue(find("cps").contains("cps"));
	}
}
