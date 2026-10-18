package pl.mibclient.mod.core;

/**
 * Opcja modułu. Odczyt zawsze daje poprawną wartość: zły typ albo wartość spoza zakresu daje domyślną.
 */
public abstract class Setting<T> {
	public final String key;
	public final T def;
	private final String pl, en;

	Setting(String key, String pl, String en, T def) {
		this.key = key;
		this.pl = pl;
		this.en = en;
		this.def = def;
	}

	public String label() {
		return Lang.pl() ? pl : en;
	}

	public abstract T get(ModuleState s);

	public void set(ModuleState s, T v) {
		s.setOption(key, v);
	}

	public static final class BoolSetting extends Setting<Boolean> {
		public BoolSetting(String key, String pl, String en, boolean def) {
			super(key, pl, en, def);
		}

		@Override
		public Boolean get(ModuleState s) {
			Object v = s.option(key);
			return v instanceof Boolean ? (Boolean) v : def;
		}

		public void toggle(ModuleState s) {
			set(s, !get(s));
		}
	}

	public static final class IntSetting extends Setting<Integer> {
		public final int min, max, step;

		public IntSetting(String key, String pl, String en, int def, int min, int max, int step) {
			super(key, pl, en, def);
			this.min = min;
			this.max = max;
			this.step = step;
		}

		@Override
		public Integer get(ModuleState s) {
			Object v = s.option(key);
			if (!(v instanceof Number)) return def;
			double d = ((Number) v).doubleValue();
			return d >= min && d <= max ? (int) Math.round(d) : def;
		}

		@Override
		public void set(ModuleState s, Integer v) {
			int c = Math.max(min, Math.min(max, v));
			c = min + Math.round((c - min) / (float) step) * step;
			super.set(s, Math.min(max, c));
		}
	}

	public static final class ChoiceSetting extends Setting<String> {
		public final String[] values;
		private final String[] labelsPl, labelsEn;

		public ChoiceSetting(String key, String pl, String en, String def, String[] values, String[] labelsPl, String[] labelsEn) {
			super(key, pl, en, def);
			this.values = values;
			this.labelsPl = labelsPl;
			this.labelsEn = labelsEn;
		}

		@Override
		public String get(ModuleState s) {
			Object v = s.option(key);
			for (String x : values) if (x.equals(v)) return x;
			return def;
		}

		public void next(ModuleState s) {
			String cur = get(s);
			for (int i = 0; i < values.length; i++) {
				if (values[i].equals(cur)) {
					set(s, values[(i + 1) % values.length]);
					return;
				}
			}
		}

		public String valueLabel(String value) {
			for (int i = 0; i < values.length; i++) if (values[i].equals(value)) return (Lang.pl() ? labelsPl : labelsEn)[i];
			return value;
		}
	}

	/** Tekst wpisywany w menu (np. wiadomość z Auto text); dłuższy niż maxLength jest przycinany. */
	public static final class TextSetting extends Setting<String> {
		public final int maxLength;

		public TextSetting(String key, String pl, String en, String def, int maxLength) {
			super(key, pl, en, def);
			this.maxLength = maxLength;
		}

		@Override
		public String get(ModuleState s) {
			Object v = s.option(key);
			return v instanceof String ? clip((String) v) : def;
		}

		@Override
		public void set(ModuleState s, String v) {
			super.set(s, clip(v == null ? "" : v));
		}

		private String clip(String v) {
			return v.length() > maxLength ? v.substring(0, maxLength) : v;
		}
	}

	public static final class ColorSetting extends Setting<Integer> {
		/** Paleta kolorów do wyboru w menu (jak w launcherze). */
		public static final int[] PALETTE = {0xFFD6B0FF, 0xFFFFFFFF, 0xFF4ADE80, 0xFFF87171, 0xFF60A5FA, 0xFFFACC15};

		public ColorSetting(String key, String pl, String en, int def) {
			super(key, pl, en, def);
		}

		@Override
		public Integer get(ModuleState s) {
			Object v = s.option(key);
			return v instanceof Number ? (int) ((Number) v).longValue() : def;
		}

		@Override
		public void set(ModuleState s, Integer v) {
			s.setOption(key, v & 0xFFFFFFFFL);
		}
	}
}
