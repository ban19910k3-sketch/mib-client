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
- Panel admina: `admin-ui.js` (tylko po polsku — widzi go wyłącznie właściciel, więc bez wpisów w `EN`), funkcje `admin_*` w `schema.sql`; admin to konto zapisane w `private.admins`, każda funkcja sama sprawdza uprawnienia. Kanał `prof:admin` przepuszcza tylko nazwy z `ADMIN_FNS` w `profile-main.js`.
- Pomysły graczy (od 0.10.0): tabela `ideas` i funkcja `submit_idea` w `schema.sql`, strona Pomysły w `profile-ui.js`, zakładka Pomysły i licznik nowych w `admin-ui.js`.
- `lib/crash.js` — przyczyny awarii gry; `lib/discord.js` — status na Discordzie przez lokalne IPC (numer aplikacji: `DISCORD_CLIENT_ID` w `main.js`).
- Testy: `npm test` (logika), `bash test/sql/run.sh` jako użytkownik `postgres` (schemat na lokalnym Postgresie z atrapą Supabase), `xvfb-run -a node test/e2e/profile.e2e.js` i `test/e2e/anim.e2e.js` (Electron + atrapa `test/fake-supabase.js`). `MIB_SUPA_URL` podmienia adres Supabase.

## Mod MiB w grze (od 0.12.0)

- `mod/common` — cała logika i rysowanie (menu pod prawym Shiftem, HUD, edytor HUD, moduły), Java 8 bez klas Minecrafta.
- `mod/fabric/src` — jeden adapter (Canvas, GameInfo, ekrany, mixiny) na nazwach Mojanga dla wszystkich wersji 1.21–26.3. Różnice między wersjami w blokach `//#if MC >= 1.21.9` … `//#else` … `//#endif`; słowa `MibGraphics`, `MibId`, `MibHud` zamieniają się na klasy danej wersji (`mod/buildSrc/.../MibPp.groovy`). Wersje gry: katalogi `mod/versions/<wersja>/gradle.properties` (Minecraft + Fabric API); nowa wersja = nowy katalog + wpis w `VERSIONS` w `lib/mibmod.js`.
- Testy: `cd mod && ./gradlew -PcommonOnly :common:test mibPpCheck` (serwery Fabric są zablokowane w kontenerze, pełne budowanie tylko na GitHubie). CI `.github/workflows/mod.yml`: każda wersja osobno — budowanie i test w prawdziwym kliencie (od 1.21.4 test Fabric ze zrzutami, starsze `-Psmoke`); błędy trafiają do adnotacji przebiegu.
- Launcher: `lib/mibmod.js` (instalacja `mib-client-mod.jar`, Fabric API, Sodium, most kont), pliki moda w instalatorze w `resources/mod` (budowane w `release.yml`), lokalnie w `mod-dist/`. Ustawienie `mibMod`.
- Most z launcherem: pliki we wspólnym `<folder gry z ustawień>/mib` (`accounts.json` bez tokenów, `switch-request.json`, `switch-result.json`), tam też `mod-config.json` — jedne ustawienia moda dla wszystkich wersji. Co MiB dodał do instancji (Sodium, Fabric API, loader), zapisuje w `mib-instance.json` i cofa po wyłączeniu przełącznika.

## Wydawanie aktualizacji

1. Podbij `version` w `package.json`.
2. Wypchnij na `main`. Workflow `.github/workflows/release.yml` zbuduje instalator na Windows i utworzy szkic wydania `v<wersja>` z `.exe` i `latest.yml`.
3. Właściciel sam klika „Publish release” — dopiero wtedy launchery graczy pobiorą aktualizację.
