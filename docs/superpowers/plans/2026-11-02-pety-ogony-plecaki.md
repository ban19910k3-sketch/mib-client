# Pety, ogony i plecaki — plan wdrożenia (0.34.0)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trzy nowe rodzaje kosmetyków (pet, ogon, plecak) z modelem 3D w teksturze, w launcherze, w bazie i w grze, plus 114 przedmiotów.

**Architecture:** Rozszerzamy format `mib-model` z 0.33.0 (nowa kość `pet`, ruch części `wave`/`step`/`sit`/`state`).
Pozy liczy bezstanowa funkcja czasu i stanu gracza — taka sama w `lib/profile.js` i w `mod/common`. Rysuje skinview3d w launcherze i warstwy postaci w modzie.
Ustawienia peta (tryb, strona, imię) są w `profiles.pet` i idą do innych graczy przez `mib_who` → `players.json`.

**Tech Stack:** Electron (czysty JS, skinview3d), Supabase/Postgres (plpgsql), Fabric 1.21–26.3 (Java 8 w common, preprocesor `//#if`), Python+PIL (generator tekstur, poza repo).

**Spec:** `docs/superpowers/specs/2026-11-02-pety-ogony-plecaki-design.md`

## Global Constraints

- Rodzaje: `pet`, `tail`, `back`; po jednym założonym na rodzaj; wszystko można nosić naraz.
- Tryby peta `fly` | `shoulder` | `walk`, strona `left` | `right`, imię 0–16 znaków; domyślnie `fly`, `left`, bez imienia.
- Kotwice: fly `(s·11, −3 + 1,2·sin(2π·0,5·t), 1)` skala 0,8 (sen: bez bujania, y +1); shoulder `(s·6, 0, 0)` na tułowiu, skala 0,6; walk `(s·14, 24, 3)`, skala 1; `s` = +1 lewa, −1 prawa.
- Bieg: `wave` hz ×1,8 i wychylenie ×1,4; sen: wychylenie ×0,3; sen po 30 s bez ruchu.
- Ceny: pet 1500, plecak 1000, ogon 800; świąteczne tylko w czasie święta (`themes.items`); adwentowe bez ceny w dniach 8, 12, 16, 18.
- Id ≤ 32 znaki `[a-z0-9_]` (`CAPE_RE` w `lib/mibmod.js`); całoroczne `pet_*`/`tail_*`/`back_*`, świąteczne `<motyw>_pet_*` itd., adwentowe `adwent_pet_*`/`adwent_tail_*`/`adwent_back_*`.
- Każdy nowy napis w UI → słownik `EN` w `ui.js`; panel admina tylko po polsku; mod: klucze w `Lang`.
- Token Minecrafta tylko do Mojanga; klucze serwisowe tylko w Supabase; bez nowych plików w launcherze poza koniecznymi (dopisz do `build.files`).

## Review Focus

1. Imię peta z wulgaryzmem, emoji, znakami sterującymi albo dłuższe niż 16 → baza odrzuca (sterujące, >16), inni widzą je po `cleanText`, gdy mają włączony filtr.
2. Stary launcher z nowym modem (brak pól `pet`/`tail`/`back`/`petMode` w `players.json` i `cosmetics.json`) → mod nic nie rysuje, nie wywraca się; brak ustawień = domyślne.
3. „Pokazuj pety innych graczy” wyłączone → własny pet dalej widoczny.
4. Pet/ogon/plecak z teksturą bez modelu (admin wgrał zwykły PNG) → nic się nie rysuje, miniatura zastępcza, bez wyjątku.
5. Gracz niewidzialny albo obserwator, a także kucanie w trybie lotu → brak peta albo poprawna poza, bez skoków.

---

### Task 1: Format modelu i pozy (launcher + common)

**Files:** Modify `lib/profile.js`, `mod/common/src/main/java/pl/mibclient/mod/core/CosmeticModel.java`; Create `mod/common/src/main/java/pl/mibclient/mod/core/Pets.java`; Test `test/profile.test.js`, `mod/common/src/test/java/pl/mibclient/mod/core/CosmeticModelTest.java`.

**Interfaces — Produces:**
- `checkModel` przyjmuje `bone: 'pet'` i pola części `wave: [ax, ay, az, hz, faza]` (|a| ≤ 180, 0 < hz ≤ 10, 0 ≤ faza ≤ 1), `step: a` (|a| ≤ 90), `sit: [ax, ay, az, dy]` (|a| ≤ 180, |dy| ≤ 16), `state: 'awake' | 'sleep'`. Normalizacja: `wave: null|[5]`, `step: 0`, `sit: null|[4]`, `state: null|'awake'|'sleep'`.
- JS `partPose(part, ctx) → { rot: [x, y, z], dy, visible }`, gdzie `ctx = { t, run, sleep, crouch, walk, phase }` (t w sekundach, walk 0..1, phase w radianach). `petAnchor(mode, side, t, sleep) → { bone: 'root'|'body', pos: [x, y, z], scale }`.
- Java `CosmeticModel.Part`: pola `wave` (`float[]` albo null), `step`, `sit` (`float[]` albo null), `state` (0 = zawsze, 1 = awake, 2 = sleep), `boolean pet()` na modelu. `Pets.pose(Part p, float t, boolean run, boolean sleep, boolean crouch, float walk, float phase, float[] rotOut) → float dy` (NaN = część niewidoczna); `Pets.anchor(int mode, int side, float t, boolean sleep, float[] posOut) → float scale`; stałe `Pets.FLY = 0, SHOULDER = 1, WALK = 2`, `Pets.sleeping(long stillMs)` (≥ 30000).

- [ ] Test (JS i Java, te same liczby): `partPose` dla `wave [20,0,0,1,0.25]`, t = 0 → rot x = rot0 + 20; run → hz 1,8, a 28 przy t = 0,25/1,8·…; sleep → a ×0,3; `step 30`, walk 1, phase π/2 → +30 wokół x, `step −30` → −30; crouch z `sit [0,0,10,2]` → z +10, dy 2; `state 'sleep'` niewidoczna na jawie. `petAnchor('walk','right',0,false)` → `pos [-14,24,3]`, scale 1; fly t = 0,5 → y = −3 + 1,2·sin(π/2). Złe wartości (`wave` z 4 liczbami, hz 0, `state 'x'`, `bone 'arm'`) → cały model null.
- [ ] Uruchom `npm test` i `cd mod && ./gradlew -PcommonOnly :common:test --offline -q` — testy padają.
- [ ] Zaimplementuj w obu miejscach.
- [ ] Testy przechodzą; commit „pety: format modelu i pozy”.

### Task 2: Rysowanie w launcherze

**Files:** Modify `profile-ui.js` (`dress`, `putModel`, `animate`, `modelThumb`), `style.css` (jeśli potrzeba). Test: `test/e2e/profile.e2e.js` (Task 7) i podgląd w `scratchpad/hats/view.js`.

**Interfaces — Consumes:** Task 1 `partPose`, `petAnchor`. **Produces:** `dress(viewer, { …, pet, tail, back, petMode, petSide })` zwraca też `pet: mode|''`, `tail: bool`, `back: bool`; peleryna przy plecaku przesunięta o 4 piksele do tyłu (`viewer.playerObject.cape.position.z`).

- [ ] Ogon i plecak: `putModel(..., slot)` na tułowiu (jak kotylion); pet: grupa przy `playerObject.skin` (tryby fly/walk) albo `skin.body` (shoulder), pozycja i skala z `petAnchor`, części z pivotem i obrotem jak dotąd; w `animate` dla wszystkich części z `wave`/`step`/`sit`/`state` — `partPose` z `ctx` (w podglądzie: run = false, sleep = false, crouch = false; tryb walk: walk = 1, phase = t·2π·1,4).
- [ ] Kamera: przy pecie w trybie walk `viewer.zoom` ×0,9; miniatura `modelThumb` dla `pet`/`tail`/`back` (bez zmian w funkcji).
- [ ] Sprawdź w `view.js` z próbnym petem (kotek), ogonem i plecakiem: wszystkie 3 tryby, obie strony, peleryna z plecakiem; zero błędów strony.
- [ ] Commit „pety: launcher rysuje pety, ogony i plecaki”.

### Task 3: 11 całorocznych modeli → podgląd dla właściciela

**Files:** generator `scratchpad/hats/pets.py` (poza repo, wzór `gen.py`), wyjście `scratchpad/hats/out/*.png`; strona podglądu (HTML z skinview3d, `lib/profile.js` i kodem rysowania z Task 2) wysłana właścicielowi.

- [ ] Modele: smoczek MiB (`pet_smok`), kotek (`pet_kotek`), pszczółka (`pet_pszczola`), aksolotl (`pet_aksolotl`); ogony koci (`tail_koci`), smoczy MiB (`tail_smok`), diabelski (`tail_diabel`); plecaki MiB (`back_mib`), skrzynia (`back_skrzynia`), odrzutowy (`back_jetpack`, płomienie jako klatki), miś (`back_mis`). Każdy pet ma oczy `awake` i `sleep`, łapki ze `step`, skrzydła/ogonek z `wave`, `sit` dla nóg/ogona.
- [ ] Zrzuty (przód, bok, 3 tryby peta) i strona → właściciel akceptuje albo prosi o poprawki. **Bramka: dalej dopiero po akceptacji.**

### Task 4: 99 świątecznych + 4 adwentowe → podgląd partiami

- [ ] Partie po 3–4 święta według tabeli w specyfikacji (id: `<motyw>_pet_*`, `<motyw>_tail_*`, `<motyw>_back_*`, adwentowe `adwent_*`), te same zasady co w Task 3.
- [ ] Po każdej partii podgląd dla właściciela; wymiany pomysłów wpisuj do tabeli w specyfikacji.

### Task 5: Baza

**Files:** Modify `supabase/schema.sql`, `test/sql/schema.test.sql`, `test/sql/run.sh` (scenariusz bazy sprzed 0.34.0), `supabase/README.md` (jeśli opisuje rodzaje).

**Interfaces — Produces:**
- `equip_cosmetic` i `admin_save_cosmetic` przyjmują `pet`, `tail`, `back`.
- `profiles.pet jsonb not null default '{"mode":"fly","side":"left","name":""}'`; `set_pet(p_mode text, p_side text, p_name text) returns jsonb` (błędy `pet_mode_invalid`, `pet_side_invalid`, `pet_name_invalid`: > 16 znaków albo `[[:cntrl:]]`); profil (`profile_card`/własny odczyt) zwraca `pet`.
- `mib_who` (`drop function` + nowa) zwraca dodatkowo `pet`, `tail`, `back`, `pet_mode`, `pet_side`, `pet_name`; uprawnienia jak wcześniej.
- 114 wierszy w `cosmetics` (między `-- [pety]` … `-- [/pety]`) z cenami; migracja `pety-0.34` dopisuje świąteczne id do `themes.items` raz (bez duplikatów) i ustawia `advent_days` 8, 12, 16, 18, gdzie `cosmetic_id is null`.

- [ ] Testy SQL: założenie peta/ogona/plecaka razem; `set_pet` dobre i złe dane; `mib_who` z polami peta, zbanowany bez nich; po migracji święta mają po 9 nowych id, kalendarz 4 adwentowe; drugie uruchomienie schematu nic nie dubluje; adwentowe nie są na sprzedaż.
- [ ] `service postgresql start; su postgres -c "bash test/sql/run.sh"` → `ALL SQL TESTS PASSED`; commit.

### Task 6: Most launcher ↔ gra

**Files:** Modify `lib/mibmod.js` (`readEquip`, nowe `readPet`, `playersPayload`), `lib/presence.js` (tekstury nowych rodzajów do `capes/`), `main.js` (`cosmetics.json` z `pet`, obsługa `cosmetic-request.json` z polem `pet`, `cleanText` imienia przy filtrze), `profile-main.js` (`setPet`, ustawienia w stanie profilu). Test: `test/mibmod.test.js`, `test/presence.test.js`, `test/profile-main.test.js`.

**Interfaces — Produces:** `players.json` wpis `{…, pet, tail, back, petMode, petSide, petName}`; `cosmetics.json` `{ loggedIn, items, gifts, pet: { mode, side, name } }`; `readPet(text) → { mode, side } | null` (tylko znane wartości); kanał `prof:setPet({ mode, side, name })`.

- [ ] Testy: `playersPayload` przepuszcza nowe pola i odrzuca złe tryby; `readEquip` przyjmuje nowe rodzaje; `readPet` odrzuca śmieci; imię z wulgaryzmem po `cleanText`.
- [ ] `npm test` przechodzi; commit.

### Task 7: Interfejs launchera i panel admina

**Files:** Modify `profile-ui.js` (`KINDS`, `GLYPH`, `KIND`, sloty w `cosLeft`, `outfit`, panel peta pod postacią: 3 przyciski trybu, przełącznik strony, pole imienia z zapisem), `admin-ui.js` (`TYPES`), `ui.js` (`EN`), `test/fake-supabase.js` (`set_pet`, nowe pola), `test/e2e/profile.e2e.js`.

- [ ] E2E: filtr Pety/Ogony/Plecaki, założenie wszystkich trzech naraz (`dataset.pet`, `tail`, `back`), zmiana trybu i strony (wywołanie `set_pet` w atrapie), imię z wulgaryzmem odrzucone/oczyszczone, panel admina ma nowe rodzaje.
- [ ] `xvfb-run -a node test/e2e/profile.e2e.js <dir>` i `anim.e2e.js` przechodzą; commit.

### Task 8: Mod w grze

**Files:** common: `Cosmetics.java` (rodzaje, `pet` z `cosmetics.json`), `MibPlayers.java` (nowe pola), `Lang.java` (`cos.pet`, `cos.tail`, `cos.back`, tryby, strona, „Pokazuj pety innych graczy”), `Config`/`MenuView.java` (przełącznik i wybór trybu/strony na stronie Kosmetyki; żądanie `cosmetic-request.json` z `pet`), `LauncherBridge.java`. fabric: `MibClient.java` (`tickCosmetics` z nowymi rodzajami, ustawienia peta, licznik bezruchu per gracz), `MibSelfState` + `LivingEntityRendererMixin` (tail, back, pet, tryb, strona, imię, bieg, kucanie, sen), `HatLayer.java` (ogon i plecak jako modele na tułowiu), nowa `PetLayer.java` (kotwica, pozy z `Pets`, imię), mixin peleryny (przesunięcie 4 px przy plecaku, push/pop wokół rysowania), rejestracja warstw. Test: common testy jednostkowe, `MibClientGameTest` (zrzut `13-pet`, haki `pet_drawn`, `tail_drawn`, `back_drawn`, `cape_pushed`).

- [ ] Testy common (parsowanie nowych pól, menu: przełącznik i tryby), `./gradlew -PcommonOnly :common:test mibPpCheck --offline -q`.
- [ ] Wypchnij na gałąź roboczą, CI „Mod MiB” zielone na 17 wersjach; commit poprawek.

### Task 9: Dokumentacja i wydanie

- [ ] `CLAUDE.md` (nowe rodzaje, format, pety, baza, most, mod), `package.json` i `mod/gradle.properties` 0.34.0, `build/release-notes.md` (Dodane: pety, ogony, plecaki, tryby peta, imię, kategorie; Zmienione: kopiowanie MiB ID działa).
- [ ] Wszystkie testy (npm, SQL, e2e, common, CI) zielone; commit i push na gałąź roboczą; wydanie dopiero po „wydaj”; właściciel wkleja `schema.sql` po publikacji.
