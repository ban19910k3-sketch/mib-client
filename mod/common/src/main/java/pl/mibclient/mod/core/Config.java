package pl.mibclient.mod.core;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Plik ustawień moda wspólny dla wszystkich wersji gry. Trzyma całe drzewo z pliku i zmienia tylko swoje pola,
 * więc opcje i moduły nieznane tej wersji zostają w pliku. Zepsuty plik jest odkładany obok jako .bad-<ms>.
 */
public final class Config {
	public static final String FILE_NAME = "mod-config.json";

	private final File file;
	private final Map<String, Object> root;

	private Config(File file, Map<String, Object> root) {
		this.file = file;
		this.root = root;
	}

	public static Config load(File file) {
		if (!file.isFile()) return new Config(file, new LinkedHashMap<String, Object>());
		try {
			Object v = Json.parse(new String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8));
			if (v instanceof Map) return new Config(file, cast(v));
		} catch (IOException | RuntimeException e) {
			// zły plik: niżej odkładamy go obok
		}
		File bad = new File(file.getParentFile(), file.getName() + ".bad-" + System.currentTimeMillis());
		if (!file.renameTo(bad)) {
			try {
				Files.copy(file.toPath(), bad.toPath(), StandardCopyOption.REPLACE_EXISTING);
			} catch (IOException ignored) {
				// nie da się zachować kopii: i tak startujemy z domyślnymi
			}
		}
		return new Config(file, new LinkedHashMap<String, Object>());
	}

	public File file() {
		return file;
	}

	/** Język menu wybrany przez gracza: "pl", "en" albo "auto". */
	public String language() {
		Object v = root.get("lang");
		return "pl".equals(v) || "en".equals(v) ? (String) v : "auto";
	}

	public void setLanguage(String code) {
		root.put("lang", "pl".equals(code) || "en".equals(code) ? code : "auto");
	}

	public ModuleState module(String id) {
		return new ModuleState(this, id);
	}

	/** Zapis przez plik tymczasowy, żeby przerwany zapis nie zostawił połowy pliku. */
	public synchronized void save() {
		root.put("version", 1);
		File dir = file.getAbsoluteFile().getParentFile();
		File tmp = new File(dir, file.getName() + ".tmp");
		try {
			Files.createDirectories(dir.toPath());
			Files.write(tmp.toPath(), Json.write(root).getBytes(StandardCharsets.UTF_8));
			try {
				Files.move(tmp.toPath(), file.toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
			} catch (AtomicMoveNotSupportedException e) {
				Files.move(tmp.toPath(), file.toPath(), StandardCopyOption.REPLACE_EXISTING);
			}
		} catch (IOException e) {
			tmp.delete();
		}
	}

	Map<String, Object> modules(boolean create) {
		return child(root, "modules", create);
	}

	/** Podmapa pod kluczem; przy create zastępuje wartość złego typu pustą mapą. */
	static Map<String, Object> child(Map<String, Object> parent, String key, boolean create) {
		if (parent == null) return null;
		Object v = parent.get(key);
		if (v instanceof Map) return cast(v);
		if (!create) return null;
		Map<String, Object> m = new LinkedHashMap<String, Object>();
		parent.put(key, m);
		return m;
	}

	@SuppressWarnings("unchecked")
	private static Map<String, Object> cast(Object v) {
		return (Map<String, Object>) v;
	}
}
