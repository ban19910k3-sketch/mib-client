# MiB Client

Darmowy launcher Minecraft PvP w Electronie (czysty HTML/JS, bez frameworka). Rozmawiaj z właścicielem po polsku.

- `main.js` — proces główny (logowanie msmc, uruchamianie gry, mody z Modrinth, aktualizacje).
- `index.html` + `style.css` + `ui.js` — interfejs. Teksty są po polsku; tłumaczenia angielskie są w słowniku `EN` w `ui.js` (klucz = polski tekst), więc każdy nowy napis w UI dopisz też do `EN`.
- Wygląd: czerń i ametystowy fiolet, pikselowe ramki (`clip-path: var(--px)`), font Pixelify tylko w nagłówkach i na przycisku GRAJ, zawsze `font-weight:400` (pogrubiony Pixelify psuje literę C). Reszta tekstu: Geist z `fonts/`. Ikony menu: pixelarticons wklejone w `index.html`, zawsze 24 px (w innym rozmiarze się rozmywają). Licencje: `fonts/LICENSES.txt`.

## Profil MiB (od 0.8.0)

- Dane profili w Supabase (`supabase/schema.sql`, instrukcja dla właściciela: `supabase/README.md`). Uprawnienia pilnuje baza (RLS + funkcje `security definer`); w launcherze tylko klucz publiczny.
- `lib/supa.js` — klient REST na `fetch` (bez `@supabase/supabase-js`: wymaga Node 22, Electron 31 ma Node 20).
- `lib/profile.js` — logika bez sieci, ładowana i przez `require`, i przez `<script>` (`window.MibProfile`).
- `profile-main.js` — profil w procesie głównym, kanały IPC `prof:*`; `profile-ui.js` — ekrany Profil MiB i Kosmetyki.
- Panel admina: `admin-ui.js` (tylko po polsku — widzi go wyłącznie właściciel, więc bez wpisów w `EN`), funkcje `admin_*` w `schema.sql`; zakładka Aktualności dodaje i zmienia wpisy z tabeli `announcements` (3 najnowsze jako karty w panelu Aktualności na stronie głównej, wszystkie na stronie Aktualności); admin to konto zapisane w `private.admins`, każda funkcja sama sprawdza uprawnienia. Kanał `prof:admin` przepuszcza tylko nazwy z `ADMIN_FNS` w `profile-main.js`.
- Pomysły graczy (od 0.10.0): tabela `ideas` i funkcja `submit_idea` w `schema.sql`, strona Pomysły w `profile-ui.js`, zakładka Pomysły i licznik nowych w `admin-ui.js`.
- `lib/crash.js` — przyczyny awarii gry; `lib/discord.js` — status na Discordzie przez lokalne IPC (numer aplikacji: `DISCORD_CLIENT_ID` w `main.js`).
- `lib/servers.js` — lista serwerów (`servers.dat`) wspólna dla wszystkich wersji gry, z kopią w folderze launchera (przed startem gry do instancji, po zamknięciu z powrotem).
- Kosmetyki (od 0.13.0): kolumna `profiles.equipped` i funkcja `equip_cosmetic` w `schema.sql`; Załóż/Zdejmij w launcherze i w menu w grze.
- Gracze MiB w grze (od 0.14.0): `lib/presence.js` zgłasza konto przed startem gry (Mojang `join` w launcherze, `hasJoined` w bazie przez rozszerzenie `http` — token Minecrafta idzie tylko do Mojanga), co 4 min odświeża obecność i pyta `mib_who` o graczy z Tab; tabela `private.mib_players`, funkcje `mib_hello`, `mib_ping`, `mib_who` w `schema.sql`.
- Testy: `npm test` (logika), `bash test/sql/run.sh` jako użytkownik `postgres` (schemat na lokalnym Postgresie z atrapą Supabase), `xvfb-run -a node test/e2e/profile.e2e.js` i `test/e2e/anim.e2e.js` (Electron + atrapa `test/fake-supabase.js`). `MIB_SUPA_URL` podmienia adres Supabase.

## Mod MiB w grze (od 0.12.0)

- `mod/common` — cała logika i rysowanie (menu pod prawym Shiftem z wyborem języka, HUD, edytor HUD, 85 modułów z listy w `docs/superpowers/specs/2026-10-16-mib-mod-design.md`: bez Jump reset, Mob overlay to Player overlay, dodany Auto sprint; Nametags i Screenshot działają zawsze, poza menu), Java 8 bez klas Minecrafta. Wyszukiwarka w menu szuka we wszystkich kategoriach.
- Zmiany w elementach gry: `VanillaHud.java` (nasycenie, Boss bar, Scoreboard, tytuły, napisy, ping w Tab, tło ekwipunku), `WorldTweaks.java` (napisy nad TNT/przedmiotami/mobami przez `EntityMixin`, pora dnia, blokada wyrzucania, kopie światów w `mib/backups`, filtr logów), ekran ładowania z logo i napisem MiB Client, bez numeru wersji (`LoadingOverlayMixin`, `textures/gui/loading.png`).
- Reszta modułów: `Looks.java` (przedmioty na ziemi, obwódka bloku, hitboxy, mgła, Dark mode, elytra, emotki, animacje 1.7, efekty pełnoekranowe), `Extras.java` (Auto text, Emotes, Waypoints i Light level rzutowane na HUD, Screenshot, UI scaling, Custom F3, Keybind search), `SoundFilters.java` (OpenAL EFX), `TierCache.java` (API MCTiers), `ShulkerPreview.java`. Efekty Color saturation/Motion blur mają inny format w każdej rodzinie wersji: generuje je `mod/tools/shaders.py` do `mod/fabric/shaders/<f1–f6>`, a `fabric.gradle` dokłada tylko katalog budowanej wersji (Motion blur nie działa na 1.21.2–1.21.5 — tam gra nie trzyma obrazu poprzedniej klatki).
- `mod/fabric/src` — jeden adapter (Canvas, GameInfo, ekrany, mixiny) na nazwach Mojanga dla wszystkich wersji 1.21–26.3. Od 26.1 gra przyjmuje litery tylko przy aktywnym polu tekstowym: ekran z pisaniem woła `minecraft.onTextInputFocusChange(this, true)` (`MenuScreen`). Różnice między wersjami w blokach `//#if MC >= 1.21.9` … `//#else` … `//#endif`; słowa `MibGraphics`, `MibId`, `MibHud` zamieniają się na klasy danej wersji (`mod/buildSrc/.../MibPp.groovy`). Wersje gry: katalogi `mod/versions/<wersja>/gradle.properties` (Minecraft + Fabric API); nowa wersja = nowy katalog + wpis w `VERSIONS` w `lib/mibmod.js`.
- Logo MiB: ekran tytułowy przez `TitleScreenMixin` (duże logo, bez żółtego napisu i napisu z wersją), menu pauzy przez `Logo.java` (zamiast napisu „Menu gry”).
- Logo przed nickiem: znak `\uE000` z czcionki `mibclient:badge` (`Players.java`, wstawki `PlayerMixin` i `PlayerTabOverlayMixin`); na czacie przed nickiem nadawcy, gdy pisze gracz MiB (`ChatSender.java` szuka nadawcy przed separatorem „: ”, „> ”, „» ”; `ChatComponentMixin`); peleryny innych graczy MiB z `mib/capes/<id>.png`. Player overlay dopisuje zdrowie za nickiem w `PlayerMixin`.
- Nowe API gry 26.x bez źródeł: dopisz zapytania do `.github/probe.txt` (workflow „Podgląd klas gry” wypisuje sygnatury z jara Minecrafta w adnotacjach).
- Testy: `cd mod && ./gradlew -PcommonOnly :common:test mibPpCheck` (serwery Fabric są zablokowane w kontenerze, pełne budowanie tylko na GitHubie). CI `.github/workflows/mod.yml`: każda wersja osobno — budowanie i test w prawdziwym kliencie (od 1.21.4 test Fabric ze zrzutami, starsze `-Psmoke`); błędy trafiają do adnotacji przebiegu.
- Launcher: `lib/mibmod.js` (instalacja `mib-client-mod.jar`, Fabric API, Sodium, most kont), pliki moda w instalatorze w `resources/mod` (budowane w `release.yml`), lokalnie w `mod-dist/`. Ustawienie `mibMod`.
- Most z launcherem: pliki we wspólnym `<folder gry z ustawień>/mib` (`accounts.json` bez tokenów, `switch-request.json`, `switch-result.json`; `screenshot-request.json` — zrzut ekranu do schowka; `cosmetics.json` z teksturami peleryn, `cosmetic-request.json`, `cosmetic-result.json`; `players-request.json` z graczami z Tab, `players.json` z graczami MiB, `capes/`), tam też `mod-config.json` — jedne ustawienia moda dla wszystkich wersji. Co MiB dodał do instancji (Sodium, Fabric API, loader), zapisuje w `mib-instance.json` i cofa po wyłączeniu przełącznika.

## Wydawanie aktualizacji

1. Podbij `version` w `package.json` (i `mod_version` w `mod/gradle.properties`).
2. Napisz `build/release-notes.md` — to gracze widzą w oknie aktualizacji. Pierwsza linia `<!-- <wersja> -->`, potem sekcje „Dodane”, „Zmienione”, „Usunięte” z krótkimi punktami (tylko to, co się zmieniło dla gracza). Bez linków, podpisów Co-Authored-By i nazw plików — workflow odrzuci plik z linkami albo z inną wersją.
3. Wypchnij na `main`. Workflow `.github/workflows/release.yml` zbuduje instalator na Windows i utworzy szkic wydania `v<wersja>` z `.exe` i `latest.yml`.
4. Właściciel sam klika „Publish release” — dopiero wtedy launchery graczy pobiorą aktualizację.
