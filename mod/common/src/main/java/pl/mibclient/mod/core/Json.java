package pl.mibclient.mod.core;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Minimalny JSON bez zależności (Gson ma inne API na każdej wersji Minecrafta).
 * Obiekty to LinkedHashMap, tablice ArrayList, liczby Double.
 */
public final class Json {
	private Json() {
	}

	public static final class JsonException extends RuntimeException {
		JsonException(String message, int pos) {
			super(message + " (pozycja " + pos + ")");
		}
	}

	public static Object parse(String text) {
		Parser p = new Parser(text);
		p.ws();
		Object v = p.value();
		p.ws();
		if (p.i != text.length()) throw new JsonException("nadmiarowe znaki", p.i);
		return v;
	}

	public static String write(Object value) {
		StringBuilder sb = new StringBuilder();
		write(sb, value);
		return sb.toString();
	}

	private static void write(StringBuilder sb, Object v) {
		if (v == null) sb.append("null");
		else if (v instanceof Boolean) sb.append(v.toString());
		else if (v instanceof Number) number(sb, (Number) v);
		else if (v instanceof String) string(sb, (String) v);
		else if (v instanceof Map) {
			sb.append('{');
			Iterator<? extends Map.Entry<?, ?>> it = ((Map<?, ?>) v).entrySet().iterator();
			while (it.hasNext()) {
				Map.Entry<?, ?> e = it.next();
				string(sb, String.valueOf(e.getKey()));
				sb.append(':');
				write(sb, e.getValue());
				if (it.hasNext()) sb.append(',');
			}
			sb.append('}');
		} else if (v instanceof Collection) {
			sb.append('[');
			Iterator<?> it = ((Collection<?>) v).iterator();
			while (it.hasNext()) {
				write(sb, it.next());
				if (it.hasNext()) sb.append(',');
			}
			sb.append(']');
		} else string(sb, v.toString());
	}

	private static void number(StringBuilder sb, Number n) {
		if (n instanceof Integer || n instanceof Long || n instanceof Short || n instanceof Byte) {
			sb.append(n.longValue());
			return;
		}
		double d = n.doubleValue();
		if (Double.isNaN(d) || Double.isInfinite(d)) sb.append("null");
		else if (d == Math.rint(d) && Math.abs(d) < 1e15) sb.append((long) d);
		else sb.append(Double.toString(d));
	}

	private static void string(StringBuilder sb, String s) {
		sb.append('"');
		for (int i = 0; i < s.length(); i++) {
			char c = s.charAt(i);
			switch (c) {
				case '"': sb.append("\\\""); break;
				case '\\': sb.append("\\\\"); break;
				case '\n': sb.append("\\n"); break;
				case '\r': sb.append("\\r"); break;
				case '\t': sb.append("\\t"); break;
				case '\b': sb.append("\\b"); break;
				case '\f': sb.append("\\f"); break;
				default:
					if (c < 0x20) sb.append(String.format("\\u%04x", (int) c));
					else sb.append(c);
			}
		}
		sb.append('"');
	}

	private static final class Parser {
		final String s;
		int i;

		Parser(String s) {
			this.s = s;
		}

		void ws() {
			while (i < s.length() && Character.isWhitespace(s.charAt(i))) i++;
		}

		char peek() {
			if (i >= s.length()) throw new JsonException("nieoczekiwany koniec", i);
			return s.charAt(i);
		}

		Object value() {
			char c = peek();
			if (c == '{') return object();
			if (c == '[') return array();
			if (c == '"') return str();
			if (c == 't') return word("true", Boolean.TRUE);
			if (c == 'f') return word("false", Boolean.FALSE);
			if (c == 'n') return word("null", null);
			if (c == '-' || (c >= '0' && c <= '9')) return num();
			throw new JsonException("nieoczekiwany znak '" + c + "'", i);
		}

		Object word(String w, Object v) {
			if (!s.startsWith(w, i)) throw new JsonException("oczekiwano " + w, i);
			i += w.length();
			return v;
		}

		Map<String, Object> object() {
			Map<String, Object> m = new LinkedHashMap<String, Object>();
			i++;
			ws();
			if (peek() == '}') {
				i++;
				return m;
			}
			while (true) {
				ws();
				if (peek() != '"') throw new JsonException("oczekiwano klucza", i);
				String k = str();
				ws();
				if (peek() != ':') throw new JsonException("oczekiwano ':'", i);
				i++;
				ws();
				m.put(k, value());
				ws();
				char c = peek();
				i++;
				if (c == '}') return m;
				if (c != ',') throw new JsonException("oczekiwano ',' lub '}'", i - 1);
			}
		}

		List<Object> array() {
			List<Object> l = new ArrayList<Object>();
			i++;
			ws();
			if (peek() == ']') {
				i++;
				return l;
			}
			while (true) {
				ws();
				l.add(value());
				ws();
				char c = peek();
				i++;
				if (c == ']') return l;
				if (c != ',') throw new JsonException("oczekiwano ',' lub ']'", i - 1);
			}
		}

		String str() {
			StringBuilder sb = new StringBuilder();
			i++;
			while (true) {
				char c = peek();
				i++;
				if (c == '"') return sb.toString();
				if (c != '\\') {
					sb.append(c);
					continue;
				}
				char e = peek();
				i++;
				switch (e) {
					case '"': sb.append('"'); break;
					case '\\': sb.append('\\'); break;
					case '/': sb.append('/'); break;
					case 'b': sb.append('\b'); break;
					case 'f': sb.append('\f'); break;
					case 'n': sb.append('\n'); break;
					case 'r': sb.append('\r'); break;
					case 't': sb.append('\t'); break;
					case 'u':
						if (i + 4 > s.length()) throw new JsonException("ucięte \\u", i);
						try {
							sb.append((char) Integer.parseInt(s.substring(i, i + 4), 16));
						} catch (NumberFormatException ex) {
							throw new JsonException("złe \\u", i);
						}
						i += 4;
						break;
					default:
						throw new JsonException("złe escape", i - 1);
				}
			}
		}

		Double num() {
			int start = i;
			if (peek() == '-') i++;
			while (i < s.length() && "0123456789.eE+-".indexOf(s.charAt(i)) >= 0) i++;
			try {
				return Double.valueOf(s.substring(start, i));
			} catch (NumberFormatException ex) {
				throw new JsonException("zła liczba", start);
			}
		}
	}
}
