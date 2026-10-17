import org.gradle.api.GradleException

/**
 * Preprocesor adaptera moda: jedno źródło (mod/fabric/src) dla wszystkich wersji gry.
 * Bloki: //#if MC >= 1.21.9 (warunki łączone &&), //#elif ..., //#else, //#endif.
 * Wycięte linie zostają puste, więc numery linii w błędach kompilacji zgadzają się ze źródłem.
 * Słowa z mapy names (np. MibGraphics) są zamieniane na nazwy klas tej wersji.
 */
class MibPp {
	static int[] parse(String v) {
		List<Integer> p = v.tokenize('.').collect { it as int }
		while (p.size() < 3) p << 0
		return p as int[]
	}

	static int cmp(String a, String b) {
		int[] x = parse(a), y = parse(b)
		for (int i = 0; i < 3; i++) if (x[i] != y[i]) return x[i] <=> y[i]
		return 0
	}

	static boolean test(String expr, String mc, String where) {
		return expr.split('&&').every { String t ->
			def m = (t.trim() =~ /^MC\s*(>=|<=|>|<|==|!=)\s*([0-9.]+)$/)
			if (!m.matches()) throw new GradleException("$where: zły warunek '$t'")
			int c = cmp(mc, m.group(2))
			switch (m.group(1)) {
				case '>=': return c >= 0
				case '<=': return c <= 0
				case '>': return c > 0
				case '<': return c < 0
				case '==': return c == 0
				default: return c != 0
			}
		}
	}

	/** Nazwy klas, które różnią się między wersjami, a nie zmieniają kodu wokół (słowo w całości). */
	static Map<String, String> names(String mc) {
		return [
			MibGraphics: cmp(mc, '26.1') >= 0 ? 'GuiGraphicsExtractor' : 'GuiGraphics',
			MibId      : cmp(mc, '1.21.11') >= 0 ? 'Identifier' : 'ResourceLocation',
			MibHud     : cmp(mc, '26.2') >= 0 ? 'Hud' : 'Gui',
		]
	}

	static String run(String text, String mc, String where) {
		Map<String, String> nm = names(mc)
		def word = ~/\b(${nm.keySet().join('|')})\b/
		StringBuilder out = new StringBuilder()
		List<boolean[]> stack = []   // [aktywny zewnętrzny blok, któraś gałąź już wzięta]
		boolean active = true
		String[] lines = text.split('\n', -1)
		for (int i = 0; i < lines.length; i++) {
			String line = lines[i]
			def d = (line =~ /^\s*\/\/#(if|elif|else|endif)\b\s*(.*?)\s*$/)
			String at = "$where:${i + 1}"
			if (d.matches()) {
				String kind = d.group(1), expr = d.group(2)
				if (kind == 'if') {
					boolean cond = active && test(expr, mc, at)
					stack << ([active, cond] as boolean[])
					active = cond
				} else {
					if (stack.isEmpty()) throw new GradleException("$at: //#$kind bez //#if")
					boolean[] top = stack[-1]
					if (kind == 'elif') {
						boolean cond = top[0] && !top[1] && test(expr, mc, at)
						if (cond) top[1] = true
						active = cond
					} else if (kind == 'else') {
						active = top[0] && !top[1]
						top[1] = true
					} else {
						stack.remove(stack.size() - 1)
						active = top[0]
					}
				}
				line = ''
			} else if (!active) {
				line = ''
			} else {
				line = line.replaceAll(word) { all, name -> nm[name] }
			}
			out.append(line)
			if (i < lines.length - 1) out.append('\n')
		}
		if (!stack.isEmpty()) throw new GradleException("$where: brak //#endif")
		return out.toString()
	}

	/** Przetwarza cały katalog: pliki .java i .json przez preprocesor, reszta kopiowana bez zmian. */
	static void tree(File src, File out, String mc) {
		out.deleteDir()
		src.eachFileRecurse(groovy.io.FileType.FILES) { File f ->
			String rel = src.toPath().relativize(f.toPath()).toString()
			File t = new File(out, rel)
			t.parentFile.mkdirs()
			if (f.name.endsWith('.java') || f.name.endsWith('.json')) t.setText(run(f.getText('UTF-8'), mc, rel), 'UTF-8')
			else t.bytes = f.bytes
		}
	}
}
