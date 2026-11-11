// Ikona Minecrafta w Docku na Macu (od 0.47.0) dla wersji gry z GLFW (1.13+): -Xdock:icon działa tylko w grach na AWT
// (LWJGL 2, do 1.12), a Minecraft sam ustawia ikonę dopiero od 1.19. Launcher dokłada ten agent na Macu:
// -javaagent:mib-dock.jar=<minecraft.icns>. Po utworzeniu okna gry agent robi to samo co gra od 1.19
// (NSApplication setApplicationIconImage przez java-objc-bridge, który gra ma na Macu od 1.12.2) na wątku głównym.
// Budowanie (Java 8): javac --release 8 -d out build/DockAgent.java, manifest „Premain-Class: DockAgent”.
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
      // okno gry gotowe: gra ustawia wtedy ikonę okna (GLFWImage) — na Macu bez skutku; najpóźniej po 60 s
      long end = System.currentTimeMillis() + 60000;
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
      // AppKit tylko na wątku głównym (gra obsługuje jego zdarzenia co klatkę)
      send.invoke(app, "performSelectorOnMainThread:withObject:waitUntilDone:", new Object[] { sel, image, 0 });
      for (int i = 0; i < 20; i++) {
        Thread.sleep(500);
        Object cur = send.invoke(app, "applicationIconImage", new Object[0]);
        Method peer = image.getClass().getMethod("getPeer");
        if (cur != null && peer.invoke(image).equals(cur.getClass().getMethod("getPeer").invoke(cur))) { System.out.println("[MIB-DOCK] ok"); return; }
      }
      System.out.println("[MIB-DOCK] ikona nie została ustawiona");
    } catch (Throwable e) {
      System.out.println("[MIB-DOCK] błąd: " + e);
    }
  }
}
