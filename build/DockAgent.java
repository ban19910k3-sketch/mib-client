// Ikona Minecrafta w Docku na Macu (od 0.47.0) dla wersji gry z GLFW (1.13+): -Xdock:icon działa tylko w grach na AWT
// (LWJGL 2, do 1.12), a Minecraft sam ustawia ikonę dopiero od 1.19. Launcher dokłada ten agent na Macu:
// -javaagent:mib-dock.jar=<minecraft.icns> (tylko 1.13–1.18). Po utworzeniu okna gry agent robi to samo co gra od 1.19
// (NSApplication setApplicationIconImage przez java-objc-bridge, który gra ma na Macu od 1.12.2) na wątku głównym.
// Budowanie (Java 8): build/dock-agent.sh, manifest „Premain-Class: pl.mibclient.dock.DockAgent”. Własny pakiet, bo stare
// wersje gry mają podpisane klasy w pakiecie domyślnym — niepodpisana klasa tam blokuje start gry (SecurityException).
package pl.mibclient.dock;

import java.lang.instrument.Instrumentation;
import java.lang.reflect.Method;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.Base64;

public final class DockAgent {
  private DockAgent() {}

  public static void premain(String icns, Instrumentation inst) {
    Thread t = new Thread(() -> run(icns, inst), "MiB Dock");
    t.setDaemon(true);
    t.start();
  }

  private static boolean loaded(Instrumentation inst, String name) {
    for (Class<?> c : inst.getAllLoadedClasses()) if (c.getName().equals(name)) return true;
    return false;
  }

  private static void run(String icns, Instrumentation inst) {
    try {
      // okno gry gotowe: gra ustawia wtedy ikonę okna (GLFWImage) — na Macu bez skutku; najpóźniej po 20 s
      long end = System.currentTimeMillis() + 20000;
      while (System.currentTimeMillis() < end && !loaded(inst, "org.lwjgl.glfw.GLFWImage")) Thread.sleep(500);
      if (!loaded(inst, "org.lwjgl.glfw.GLFW")) { System.out.println("[MIB-DOCK] gra bez GLFW — ikona z -Xdock:icon"); return; }
      Thread.sleep(1500);
      String b64 = Base64.getEncoder().encodeToString(Files.readAllBytes(Paths.get(icns)));
      ClassLoader cl = ClassLoader.getSystemClassLoader();
      Class<?> client = Class.forName("ca.weblite.objc.Client", true, cl);
      Object c = client.getMethod("getInstance").invoke(null);
      Method proxy = client.getMethod("sendProxy", String.class, String.class, Object[].class);
      Object data0 = proxy.invoke(c, "NSData", "alloc", new Object[0]);
      Method send = data0.getClass().getMethod("send", String.class, Object[].class);
      Object data = send.invoke(data0, "initWithBase64Encoding:", new Object[] { b64 });
      Object image = send.invoke(proxy.invoke(c, "NSImage", "alloc", new Object[0]), "initWithData:", new Object[] { data });
      Object app = proxy.invoke(c, "NSApplication", "sharedApplication", new Object[0]);
      Object sel = Class.forName("ca.weblite.objc.RuntimeUtils", true, cl).getMethod("sel", String.class).invoke(null, "setApplicationIconImage:");
      // AppKit tylko na wątku głównym (gra obsługuje jego zdarzenia co klatkę); ten wątek czeka, aż ikona zostanie ustawiona
      System.out.println("[MIB-DOCK] ustawiam ikonę");
      send.invoke(app, "performSelectorOnMainThread:withObject:waitUntilDone:", new Object[] { sel, image, 1 });
      System.out.println("[MIB-DOCK] ok");
    } catch (Throwable e) {
      System.out.println("[MIB-DOCK] błąd: " + e);
    }
  }
}
