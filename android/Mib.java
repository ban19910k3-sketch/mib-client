// MiB Client na Androida (od 0.43.0): dodatek do Amethyst (LGPL-3.0, https://github.com/AngelAuraMC/Amethyst-Android),
// wpinany przez android/mib.py. Ten plik jest na tej samej licencji (LGPL-3.0).
// - setup: profil „MiB Client” (Minecraft z Fabric, mod MiB i Fabric API z paczki aplikacji) w osobnym folderze gry,
//   przy pierwszym uruchomieniu wybrany; po aktualizacji aplikacji pliki moda się odświeżają.
// - aktualizacje jak na komputerze: przy starcie pyta GitHuba o najnowsze wydanie MiB; gdy jest nowsza wersja z plikiem
//   na Androida — okno „Jest nowa wersja”, „Aktualizuj” pobiera APK i otwiera instalator Androida.
// - od 0.44.0: własny ekran główny MiB (Mib.Home: android/ui.html w WebView, wygląd jak launcher na komputerze) zamiast
//   menu Amethyst; przyciski wołają funkcje silnika przez most „MiB” (Bridge).
// - od 0.44.0: tylko oryginalny Minecraft (konto Microsoft, bez kont offline) i nagroda za grę na telefonie: przed startem
//   gry konto potwierdza się u Mojanga (token gry idzie tylko do Mojanga), a baza MiB (mobile_hello) daje profilowi MiB
//   z tym kontem pelerynę „Zasięg” i peta „Telefonik”; przy następnym otwarciu launchera okno o nagrodzie.
package pl.mibclient.android;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.AssetManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.content.FileProvider;
import androidx.fragment.app.Fragment;

import com.kdt.mcgui.mcAccountSpinner;

import net.kdt.pojavlaunch.BuildConfig;
import net.kdt.pojavlaunch.CustomControlsActivity;
import net.kdt.pojavlaunch.PojavProfile;
import net.kdt.pojavlaunch.R;
import net.kdt.pojavlaunch.fragments.MainMenuFragment;
import net.kdt.pojavlaunch.Tools;
import net.kdt.pojavlaunch.extra.ExtraConstants;
import net.kdt.pojavlaunch.extra.ExtraCore;
import net.kdt.pojavlaunch.prefs.LauncherPreferences;
import net.kdt.pojavlaunch.value.MinecraftAccount;
import net.kdt.pojavlaunch.value.launcherprofiles.LauncherProfiles;
import net.kdt.pojavlaunch.value.launcherprofiles.MinecraftProfile;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Locale;

public final class Mib {
    private static final String TAG = "MiB";
    static final String REPO = "ban19910k3-sketch/mib-client";
    static final String APK = "MiB-Client-android.apk";
    /** Stały klucz profilu (Amethyst zamienia klucze, które nie są UUID). */
    static final String PROFILE_KEY = "6d694200-c11e-4e7a-8000-000000000001";
    static final String GAME_DIR = "./custom_instances/mib";
    static final String MOD = "mib-client-mod.jar";
    /** Baza MiB: adres i klucz publiczny (ten sam co w launcherze na komputerze; uprawnienia pilnuje baza). */
    static final String SUPA_URL = "https://pijyremkmhmnyvjusrhu.supabase.co", SUPA_KEY = "sb_publishable_-Gfr_STF_qinPsxzdYFaDg_eXg4j1Al";
    static final String REWARD_FILE = "mib-reward.json";
    private static boolean checked;

    private Mib() {}

    /** Z LauncherActivity.onCreate (przed listą profili): profil MiB od razu, aktualizacja w tle. */
    public static void start(Activity a) {
        try { setup(a); } catch (Throwable t) { Log.e(TAG, "setup", t); }
        try { rewardDialog(a); } catch (Throwable t) { Log.w(TAG, "reward", t); }
        if (checked) return;
        checked = true;
        new Thread(() -> {
            try { checkUpdate(a); } catch (Throwable t) { Log.w(TAG, "update", t); }
        }, "MiB-update").start();
    }

    // ---------- profil MiB ----------

    static void setup(Context c) throws Exception {
        AssetManager am = c.getAssets();
        String bundled = read(am.open("mib/version.txt")).trim();
        SharedPreferences p = c.getSharedPreferences("mib", Context.MODE_PRIVATE);
        String fabricJson = read(am.open("mib/fabric-profile.json"));
        String id = new JSONObject(fabricJson).getString("id");
        File game = new File(Tools.DIR_GAME_HOME, GAME_DIR), mods = new File(game, "mods");
        File versionJson = new File(Tools.DIR_HOME_VERSION, id + "/" + id + ".json");
        String api = read(am.open("mib/fabric-api.txt")).trim();
        if (!bundled.equals(p.getString("installed", "")) || !versionJson.isFile() || !new File(mods, MOD).isFile() || !new File(mods, api).isFile()) {
            if (!versionJson.getParentFile().isDirectory() && !versionJson.getParentFile().mkdirs()) throw new IOException("nie da się utworzyć " + versionJson.getParent());
            Tools.write(versionJson.getAbsolutePath(), fabricJson);
            if (!mods.isDirectory() && !mods.mkdirs()) throw new IOException("nie da się utworzyć " + mods);
            File[] old = mods.listFiles();
            if (old != null) for (File f : old) {
                String n = f.getName().toLowerCase(Locale.ROOT);
                if (n.startsWith("mib-client-mod") || n.startsWith("fabric-api-")) f.delete();
            }
            copy(am.open("mib/" + MOD), new File(mods, MOD));
            copy(am.open("mib/" + api), new File(mods, api));
        }
        LauncherProfiles.load();
        MinecraftProfile mp = LauncherProfiles.mainProfileJson.profiles.get(PROFILE_KEY);
        boolean created = mp == null;
        if (created) {
            mp = new MinecraftProfile();
            LauncherProfiles.mainProfileJson.profiles.put(PROFILE_KEY, mp);
        }
        mp.name = "MiB Client";
        mp.lastVersionId = id;
        mp.gameDir = GAME_DIR;
        mp.icon = "data:image/png;base64," + read(am.open("mib/icon.b64")).trim();
        LauncherProfiles.write();
        if (created) LauncherPreferences.DEFAULT_PREF.edit().putString(LauncherPreferences.PREF_KEY_CURRENT_PROFILE, PROFILE_KEY).apply();
        p.edit().putString("installed", bundled).apply();
        Log.i(TAG, "profil MiB gotowy: " + id + " (MiB " + bundled + ")");
    }

    // ---------- ekran główny MiB ----------

    /** Ekran główny (zamiast menu Amethyst) — dla LauncherActivity tak samo jak MainMenuFragment. */
    public static boolean isHome(Fragment f) {
        return f instanceof Home || f instanceof MainMenuFragment;
    }

    /** Górny pasek Amethyst (lista kont, przycisk ustawień) chowa się: konta i ustawienia są na ekranie MiB. */
    public static void hideTopBar(Activity a) {
        View acc = a.findViewById(R.id.account_spinner), set = a.findViewById(R.id.setting_button);
        if (acc != null) acc.setVisibility(View.GONE);
        if (set != null) set.setVisibility(View.GONE);
    }

    public static class Home extends Fragment {
        private WebView web;

        @Override
        public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup parent, @Nullable Bundle state) {
            web = new WebView(requireContext());
            web.setBackgroundColor(0xFF07020C);
            WebSettings ws = web.getSettings();
            ws.setJavaScriptEnabled(true);
            ws.setDomStorageEnabled(true);
            ws.setAllowFileAccess(true);
            ws.setAllowContentAccess(false);
            web.addJavascriptInterface(new Bridge(this), "MiB");
            web.setWebViewClient(new WebViewClient() {
                @Override
                @SuppressWarnings("deprecation")
                public boolean shouldOverrideUrlLoading(WebView v, String url) {
                    // ekran MiB to tylko plik z paczki; linki otwiera przeglądarka
                    if (url.startsWith("https://") && getActivity() != null) Tools.openURL(getActivity(), url);
                    return !url.startsWith("file:///android_asset/mib/ui/");
                }
            });
            web.loadUrl("file:///android_asset/mib/ui/index.html");
            Log.i(TAG, "ekran MiB");
            return web;
        }

        @Override
        public void onResume() {
            super.onResume();
            if (getActivity() != null) hideTopBar(getActivity());
            if (web != null) web.evaluateJavascript("window.mibRefresh&&mibRefresh()", null);
        }

        @Override
        public void onDestroyView() {
            if (web != null) { web.removeJavascriptInterface("MiB"); web.destroy(); web = null; }
            super.onDestroyView();
        }
    }

    /** Most JS → silnik: stan kont i wersji, GRAJ, konta Microsoft, ustawienia, przyciski, folder, logi, linki. */
    static class Bridge {
        private final Home home;

        Bridge(Home home) { this.home = home; }

        private void ui(Runnable r) {
            Activity a = home.getActivity();
            if (a != null) a.runOnUiThread(() -> { try { r.run(); } catch (Throwable t) { Log.e(TAG, "ekran MiB", t); } });
        }

        private mcAccountSpinner spinner() {
            Activity a = home.getActivity();
            return a == null ? null : (mcAccountSpinner) a.findViewById(R.id.account_spinner);
        }

        @JavascriptInterface
        public String state() {
            JSONObject o = new JSONObject();
            try {
                Activity a = home.getActivity();
                o.put("version", BuildConfig.VERSION_NAME).put("supa", SUPA_URL).put("key", SUPA_KEY);
                String mc = "?";
                if (a != null) try { mc = new JSONObject(read(a.getAssets().open("mib/fabric-profile.json"))).optString("inheritsFrom", "?"); } catch (Exception ignored) {}
                o.put("mc", mc);
                String cur = a == null ? "" : PojavProfile.getCurrentProfileName(a);
                JSONArray list = new JSONArray();
                for (String name : PojavProfile.getAllProfilesList()) {
                    MinecraftAccount acc = MinecraftAccount.load(name);
                    if (acc == null) continue;
                    list.put(new JSONObject().put("name", acc.username).put("file", name).put("ms", original(acc)).put("selected", name.equals(cur)));
                }
                o.put("accounts", list);
                mcAccountSpinner sp = spinner();
                o.put("login", sp == null || sp.isLoginDone());
            } catch (Exception e) {
                Log.w(TAG, "stan", e);
            }
            return o.toString();
        }

        @JavascriptInterface
        public void play() {
            ui(() -> {
                Activity a = home.getActivity();
                mcAccountSpinner sp = spinner();
                if (sp == null || sp.getSelectedAccount() == null) { ExtraCore.setValue(ExtraConstants.SELECT_AUTH_METHOD, true); return; }
                if (!original(sp.getSelectedAccount())) { needMicrosoft(a); return; }
                // ekran MiB zawsze gra profilem MiB (Minecraft z modem MiB)
                LauncherPreferences.DEFAULT_PREF.edit().putString(LauncherPreferences.PREF_KEY_CURRENT_PROFILE, PROFILE_KEY).apply();
                ExtraCore.setValue(ExtraConstants.LAUNCH_GAME, true);
            });
        }

        @JavascriptInterface
        public void addAccount() { ui(() -> ExtraCore.setValue(ExtraConstants.SELECT_AUTH_METHOD, true)); }

        private int indexOf(mcAccountSpinner sp, String file) {
            for (int i = 1; i < sp.getCount(); i++) if (file.equals(String.valueOf(sp.getItemAtPosition(i)))) return i;
            return -1;
        }

        @JavascriptInterface
        public void selectAccount(String file) {
            ui(() -> { mcAccountSpinner sp = spinner(); int i = sp == null ? -1 : indexOf(sp, file); if (i > 0) sp.setSelection(i); });
        }

        @JavascriptInterface
        public void removeAccount(String file) {
            ui(() -> {
                Activity a = home.getActivity();
                mcAccountSpinner sp = spinner();
                int i = sp == null ? -1 : indexOf(sp, file);
                if (a == null || i <= 0) return;
                new AlertDialog.Builder(a).setTitle(t("Usunąć konto " + file + "?", "Remove account " + file + "?"))
                        .setPositiveButton(t("Usuń", "Remove"), (d, w) -> { sp.setSelection(i); sp.removeCurrentAccount(); })
                        .setNegativeButton(t("Anuluj", "Cancel"), null).show();
            });
        }

        @JavascriptInterface
        public void settings() { ui(() -> { Activity a = home.getActivity(); if (a != null) a.findViewById(R.id.setting_button).performClick(); }); }

        @JavascriptInterface
        public void controls() { ui(() -> { Activity a = home.getActivity(); if (a != null) a.startActivity(new Intent(a, CustomControlsActivity.class)); }); }

        @JavascriptInterface
        public void discord() { ui(() -> { Activity a = home.getActivity(); if (a != null) Tools.openURL(a, a.getString(R.string.discord_invite)); }); }

        @JavascriptInterface
        public void open(String url) {
            if (url != null && url.startsWith("https://")) ui(() -> { Activity a = home.getActivity(); if (a != null) Tools.openURL(a, url); });
        }

        @JavascriptInterface
        public void logs() { ui(() -> { Activity a = home.getActivity(); if (a != null) Tools.shareLog(a); }); }

        @JavascriptInterface
        public void folder() {
            ui(() -> {
                Activity a = home.getActivity();
                if (a == null) return;
                LauncherProfiles.load();
                MinecraftProfile mp = LauncherProfiles.mainProfileJson.profiles.get(PROFILE_KEY);
                Tools.openPath(a, mp != null ? Tools.getGameDirPath(mp) : new File(Tools.DIR_GAME_NEW), false);
            });
        }
    }

    // ---------- tylko oryginalny Minecraft ----------

    /** Czy konto to oryginalny Minecraft (konto Microsoft, nie konto offline). */
    public static boolean original(MinecraftAccount acc) {
        return acc != null && acc.isMicrosoft && !acc.isLocal();
    }

    /** Okno przy próbie gry bez konta Microsoft: „Dodaj konto” otwiera logowanie Microsoft. */
    public static void needMicrosoft(Activity a) {
        new AlertDialog.Builder(a)
                .setTitle(t("Zaloguj się kontem Microsoft", "Sign in with Microsoft"))
                .setMessage(t("MiB Client działa tylko z oryginalnym Minecraftem. Dodaj konto Microsoft, na którym masz kupionego Minecrafta (Java Edition).",
                        "MiB Client works only with the original Minecraft. Add the Microsoft account that owns Minecraft (Java Edition)."))
                .setPositiveButton(t("Dodaj konto", "Add account"), (d, w) -> ExtraCore.setValue(ExtraConstants.SELECT_AUTH_METHOD, true))
                .setNegativeButton(t("Anuluj", "Cancel"), null)
                .show();
    }

    // ---------- nagroda za grę na telefonie ----------

    /** Z MainActivity tuż przed startem gry: zgłoszenie gry do MiB (najwyżej raz na 20 godzin na konto), w tle. */
    public static void played(Context c, MinecraftAccount acc) {
        if (!original(acc) || acc.profileId == null || acc.username == null) return;
        String uuid = acc.profileId.replace("-", "");
        if (!uuid.matches("[0-9a-fA-F]{32}") || !acc.username.matches("[A-Za-z0-9_]{1,16}")) return;
        File stamp = new File(c.getFilesDir(), "mib-mobile-" + uuid);
        if (stamp.isFile() && System.currentTimeMillis() - stamp.lastModified() < 20 * 3600 * 1000L) return;
        final Context app = c.getApplicationContext();
        final String token = acc.accessToken, name = acc.username;
        new Thread(() -> {
            try {
                byte[] rnd = new byte[16];
                new SecureRandom().nextBytes(rnd);
                StringBuilder sid = new StringBuilder();
                for (byte b : rnd) sid.append(String.format(Locale.ROOT, "%02x", b));
                // 1) Mojang: potwierdzenie konta (token gry tylko tutaj)
                JSONObject join = new JSONObject().put("accessToken", token).put("selectedProfile", uuid).put("serverId", sid.toString());
                HttpURLConnection j = post("https://sessionserver.mojang.com/session/minecraft/join", join.toString(), null);
                if (j.getResponseCode() != 204 && j.getResponseCode() != 200) throw new IOException("Mojang " + j.getResponseCode());
                // 2) MiB: nick i serverId (bez tokenu); baza sama pyta Mojanga, czy to konto naprawdę dołączyło
                JSONObject body = new JSONObject().put("p_name", name).put("p_server_id", sid.toString());
                HttpURLConnection m = post(SUPA_URL + "/rest/v1/rpc/mobile_hello", body.toString(), SUPA_KEY);
                if (m.getResponseCode() != 200) throw new IOException("MiB " + m.getResponseCode());
                JSONObject r = new JSONObject(read(m.getInputStream()));
                if (r.has("error")) throw new IOException("MiB: " + r.optString("error"));
                if (!stamp.createNewFile()) stamp.setLastModified(System.currentTimeMillis());
                if (r.optBoolean("gift") || !r.optBoolean("profile")) {
                    r.put("name", name);
                    Tools.write(new File(app.getFilesDir(), REWARD_FILE).getAbsolutePath(), r.toString());
                }
                Log.i(TAG, "gra na telefonie zgłoszona: " + r);
            } catch (Exception e) {
                Log.w(TAG, "nagroda za telefon", e);
            }
        }, "MiB-mobile").start();
    }

    /** Okno o nagrodzie po powrocie do launchera (raz). */
    static void rewardDialog(Activity a) throws Exception {
        File f = new File(a.getFilesDir(), REWARD_FILE);
        if (!f.isFile()) return;
        JSONObject r = new JSONObject(read(new java.io.FileInputStream(f)));
        if (!f.delete()) return;
        boolean gift = r.optBoolean("gift");
        if (!gift && r.optBoolean("profile")) return;
        new AlertDialog.Builder(a)
                .setTitle(t("Nagroda za grę na telefonie!", "Reward for playing on your phone!"))
                .setMessage(gift
                        ? t("Peleryna „Zasięg” i pet „Telefonik” czekają na Ciebie w MiB Client na komputerze: otwórz launcher i odbierz prezent.",
                            "The “Signal” cape and the “Phoney” pet are waiting in MiB Client on your computer: open the launcher and claim the gift.")
                        : t("Peleryna „Zasięg” i pet „Telefonik” czekają na Ciebie. Zaloguj się w MiB Client na komputerze kontem " + r.optString("name") + ", a dostaniesz je w prezencie.",
                            "The “Signal” cape and the “Phoney” pet are waiting for you. Sign in to MiB Client on a computer with the account " + r.optString("name") + " to get them as a gift."))
                .setPositiveButton("OK", null)
                .show();
    }

    // ---------- aktualizacje ----------

    /** Czy wersja a jest nowsza od b (liczby oddzielone kropkami). */
    static boolean newer(String a, String b) {
        String[] x = a.split("\\."), y = b.split("\\.");
        for (int i = 0; i < Math.max(x.length, y.length); i++) {
            int d = num(x, i) - num(y, i);
            if (d != 0) return d > 0;
        }
        return false;
    }

    private static int num(String[] s, int i) {
        try { return i < s.length ? Integer.parseInt(s[i].replaceAll("[^0-9].*$", "")) : 0; } catch (NumberFormatException e) { return 0; }
    }

    static void checkUpdate(Activity a) throws Exception {
        HttpURLConnection con = open("https://api.github.com/repos/" + REPO + "/releases/latest");
        con.setRequestProperty("Accept", "application/vnd.github+json");
        if (con.getResponseCode() != 200) throw new IOException("kod " + con.getResponseCode());
        JSONObject rel = new JSONObject(read(con.getInputStream()));
        String version = rel.optString("tag_name", "").replaceFirst("^v", "");
        if (!version.matches("\\d+\\.\\d+\\.\\d+") || !newer(version, BuildConfig.VERSION_NAME)) return;
        JSONArray assets = rel.optJSONArray("assets");
        String url = null;
        for (int i = 0; assets != null && i < assets.length(); i++) {
            JSONObject as = assets.getJSONObject(i);
            if (APK.equals(as.optString("name"))) url = as.optString("browser_download_url");
        }
        if (url == null || !url.startsWith("https://github.com/" + REPO + "/releases/download/")) return;
        final String apkUrl = url, notes = notes(rel.optString("body", ""));
        a.runOnUiThread(() -> {
            if (a.isFinishing()) return;
            new AlertDialog.Builder(a)
                    .setTitle(t("Jest nowa wersja MiB Client " + version, "New MiB Client version " + version))
                    .setMessage(t("Masz " + BuildConfig.VERSION_NAME + ".", "You have " + BuildConfig.VERSION_NAME + ".") + (notes.isEmpty() ? "" : "\n\n" + notes))
                    .setPositiveButton(t("Aktualizuj", "Update"), (d, w) -> download(a, apkUrl))
                    .setNegativeButton(t("Później", "Later"), null)
                    .show();
        });
    }

    private static void download(Activity a, String url) {
        ProgressBar bar = new ProgressBar(a, null, android.R.attr.progressBarStyleHorizontal);
        bar.setMax(100);
        bar.setPadding(48, 24, 48, 24);
        AlertDialog dlg = new AlertDialog.Builder(a).setTitle(t("Pobieranie aktualizacji…", "Downloading update…")).setView(bar).setCancelable(false).show();
        new Thread(() -> {
            try {
                File dir = new File(a.getCacheDir(), "mib-update");
                if (!dir.isDirectory() && !dir.mkdirs()) throw new IOException("nie da się utworzyć " + dir);
                File apk = new File(dir, APK);
                HttpURLConnection con = open(url);
                if (con.getResponseCode() != 200) throw new IOException("kod " + con.getResponseCode());
                long total = con.getContentLength(), got = 0;
                try (InputStream in = con.getInputStream(); OutputStream out = new FileOutputStream(apk)) {
                    byte[] buf = new byte[1 << 16];
                    for (int n; (n = in.read(buf)) > 0; ) {
                        out.write(buf, 0, n);
                        got += n;
                        if (total > 0) { final int pct = (int) (got * 100 / total); a.runOnUiThread(() -> bar.setProgress(pct)); }
                    }
                }
                if (total > 0 && got != total) throw new IOException(t("pobieranie przerwane", "download interrupted"));
                Uri uri = FileProvider.getUriForFile(a, a.getPackageName() + ".mibupdate", apk);
                Intent i = new Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive")
                        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                a.runOnUiThread(() -> { dlg.dismiss(); a.startActivity(i); });
            } catch (Exception e) {
                Log.e(TAG, "download", e);
                a.runOnUiThread(() -> {
                    dlg.dismiss();
                    new AlertDialog.Builder(a).setTitle(t("Błąd aktualizacji", "Update error")).setMessage(String.valueOf(e.getMessage()))
                            .setPositiveButton("OK", null).show();
                });
            }
        }, "MiB-download").start();
    }

    /** Opis zmian z GitHuba (Markdown) jako zwykły tekst. */
    static String notes(String md) {
        return md.replace("\r", "").replaceAll("(?m)^<!--.*-->\\s*$", "").replaceAll("(?m)^#{1,6}\\s*", "")
                .replaceAll("(?m)^\\s*[-*]\\s+", "• ").replace("**", "").replace("`", "").replaceAll("\n{3,}", "\n\n").trim();
    }

    // ---------- pomocnicze ----------

    private static String t(String pl, String en) {
        return "pl".equals(Locale.getDefault().getLanguage()) ? pl : en;
    }

    private static HttpURLConnection open(String url) throws IOException {
        HttpURLConnection con = (HttpURLConnection) new URL(url).openConnection();
        con.setRequestProperty("User-Agent", "MiB-Client-Android");
        con.setConnectTimeout(15000);
        con.setReadTimeout(30000);
        con.setInstanceFollowRedirects(true);
        return con;
    }

    private static HttpURLConnection post(String url, String json, String apiKey) throws IOException {
        HttpURLConnection con = open(url);
        con.setRequestMethod("POST");
        con.setDoOutput(true);
        con.setRequestProperty("Content-Type", "application/json");
        if (apiKey != null) { con.setRequestProperty("apikey", apiKey); con.setRequestProperty("Authorization", "Bearer " + apiKey); }
        try (OutputStream o = con.getOutputStream()) { o.write(json.getBytes(StandardCharsets.UTF_8)); }
        return con;
    }

    static String read(InputStream in) throws IOException {
        try (InputStream i = in) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            for (int n; (n = i.read(buf)) > 0; ) out.write(buf, 0, n);
            return new String(out.toByteArray(), StandardCharsets.UTF_8);
        }
    }

    private static void copy(InputStream in, File to) throws IOException {
        File tmp = new File(to.getPath() + ".tmp");
        try (InputStream i = in; OutputStream out = new FileOutputStream(tmp)) {
            byte[] buf = new byte[1 << 16];
            for (int n; (n = i.read(buf)) > 0; ) out.write(buf, 0, n);
        }
        if (!tmp.renameTo(to)) throw new IOException("nie da się zapisać " + to);
    }
}
