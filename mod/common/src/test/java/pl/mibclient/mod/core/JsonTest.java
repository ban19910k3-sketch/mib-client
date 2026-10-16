package pl.mibclient.mod.core;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class JsonTest {
	@Test
	void roundTripKeepsTypesAndPolishLetters() {
		String s = "{\"a\":1,\"b\":[true,null,\"zażółć\"],\"c\":1.5}";
		Object v = Json.parse(s);
		Map<?, ?> m = (Map<?, ?>) v;
		assertEquals(1.0, ((Number) m.get("a")).doubleValue());
		assertEquals(Boolean.TRUE, ((List<?>) m.get("b")).get(0));
		assertNull(((List<?>) m.get("b")).get(1));
		assertEquals("zażółć", ((List<?>) m.get("b")).get(2));
		assertEquals(s, Json.write(v));
	}

	@Test
	void escapesQuotesAndControlCharacters() {
		String w = Json.write("a\"b\\c\n\u0001");
		assertEquals("\"a\\\"b\\\\c\\n\\u0001\"", w);
		assertEquals("a\"b\\c\n\u0001", Json.parse(w));
	}

	@Test
	void parsesWhitespaceExponentsAndUnicodeEscapes() {
		Map<?, ?> m = (Map<?, ?>) Json.parse(" { \"x\" : -2.5e2 , \"y\" : \"\\u0142\" } ");
		assertEquals(-250.0, ((Number) m.get("x")).doubleValue());
		assertEquals("ł", m.get("y"));
	}

	@Test
	void badSyntaxThrows() {
		assertThrows(Json.JsonException.class, () -> Json.parse("{\"a\":"));
		assertThrows(Json.JsonException.class, () -> Json.parse("nie json"));
		assertThrows(Json.JsonException.class, () -> Json.parse("{} x"));
	}
}
