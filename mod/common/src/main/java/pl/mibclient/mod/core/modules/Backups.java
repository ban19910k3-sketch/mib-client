package pl.mibclient.mod.core.modules;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/** Backups: świat jednoosobowy spakowany do <folder>/<świat>_<data>.zip; najstarsze kopie ponad limit są usuwane. */
public final class Backups {
	private Backups() {
	}

	public static File backup(File world, File dir, int keep, long now) throws IOException {
		if (!world.isDirectory()) throw new IOException("brak folderu świata " + world);
		if (!dir.isDirectory() && !dir.mkdirs()) throw new IOException("nie da się utworzyć " + dir);
		String name = world.getName() + "_" + new SimpleDateFormat("yyyy-MM-dd_HH-mm-ss").format(new Date(now));
		File out = new File(dir, name + ".zip"), tmp = new File(dir, name + ".zip.part");
		ZipOutputStream zip = new ZipOutputStream(new FileOutputStream(tmp));
		try {
			add(zip, world, world.getName() + "/");
		} finally {
			zip.close();
		}
		if (!tmp.renameTo(out)) throw new IOException("nie da się zapisać " + out);
		prune(dir, world.getName(), keep);
		return out;
	}

	private static void add(ZipOutputStream zip, File f, String path) throws IOException {
		File[] files = f.listFiles();
		if (files == null) return;
		for (File c : files) {
			if (c.isDirectory()) {
				add(zip, c, path + c.getName() + "/");
				continue;
			}
			if (c.getName().equals("session.lock")) continue; // zablokowany przez grę, w kopii niepotrzebny
			zip.putNextEntry(new ZipEntry(path + c.getName()));
			InputStream in = new FileInputStream(c);
			try {
				byte[] buf = new byte[65536];
				for (int n; (n = in.read(buf)) > 0;) zip.write(buf, 0, n);
			} finally {
				in.close();
			}
			zip.closeEntry();
		}
	}

	/** Zostawia keep najnowszych kopii tego świata (nazwy z datą sortują się po czasie). */
	static void prune(File dir, String world, int keep) {
		File[] files = dir.listFiles();
		if (files == null) return;
		List<String> mine = new ArrayList<String>();
		for (File f : files) {
			String n = f.getName();
			if (n.startsWith(world + "_") && n.endsWith(".zip") && n.length() == world.length() + 1 + 19 + 4) mine.add(n);
		}
		Collections.sort(mine);
		for (int i = 0; i < mine.size() - Math.max(1, keep); i++) new File(dir, mine.get(i)).delete();
	}
}
