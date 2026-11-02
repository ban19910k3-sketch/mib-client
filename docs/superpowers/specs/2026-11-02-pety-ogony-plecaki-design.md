# Pety, ogony i plecaki — projekt (0.34.0)

## Po co

Właściciel chce nowych kosmetyków, które „po prostu ładnie wyglądają”: pety (zwierzaki), ogony i plecaki — całoroczne
w Sklepie i po kilka na każde z 11 świąt MiB. Gracz ma je widzieć w launcherze (podgląd 3D, Sklep, filtr kategorii) i w grze
(siebie i innych graczy MiB). Pet ma być „żywy”: gracz wybiera, jak się zachowuje, i reaguje na to, co robi gracz.

## Cele

- Trzy nowe rodzaje (`type`): `pet`, `tail`, `back` (plecak). Każdy ma własne miejsce — można nosić wszystko naraz
  (peleryna, czapka, maska, skrzydła, aura, pet, ogon, plecak).
- Wygląd z modelu 3D w teksturze (kawałek `mib-model` z 0.33.0) — bez nowych plików poza teksturą, ten sam model w launcherze
  i w grze.
- Pet: tryb **lata** (obok głowy, buja się), **ramię** (siedzi na barku jak papuga), **chodzi** (przy nodze, łapki ruszają się,
  gdy gracz idzie; bez omijania bloków — trzyma się gracza); **strona** lewa/prawa; **imię** (do 16 znaków, nad petem w grze,
  filtr wulgaryzmów). Ustawia gracz w launcherze (Kosmetyki) — tryb i stronę także w menu Kosmetyki w grze; inni widzą to samo.
- Pet reaguje: siada/kuca przy kucaniu gracza, zasypia (zamknięte oczy) po ~30 s bez ruchu, przy bieganiu szybciej macha.
  Bez dźwięków.
- Ogon macha spokojnie, przy bieganiu mocniej i szybciej.
- Plecak: peleryna przy plecaku wisi dalej od pleców (za plecakiem).
- W menu moda przełącznik „Pokazuj pety innych graczy” (np. na PvP).
- Kosmetyki: filtr Wszystko / Peleryny / Czapki / Maski / Skrzydła / Aury / Pety / Ogony / Plecaki, nowe miejsca w „Założone”.
- 114 nowych kosmetyków: 11 całorocznych w Sklepie, po 3 pety + 3 ogony + 3 plecaki na każde z 11 świąt (99, w kolekcji
  świątecznej — do kupienia tylko w czasie święta), 4 tylko z kalendarza adwentowego (okienka 8, 12, 16, 18 — jedyne darmowe).
- Ceny: pet 1500, plecak 1000, ogon 800 MiB Coins (admin zmienia w panelu); adwentowe bez ceny.

## Poza zakresem

- Pet nie jest osobnym stworzeniem w świecie (bez szukania drogi, kolizji, serwera); jest rysowany przy graczu.
- Dźwięki petów, karmienie, poziomy, kolorowanie przez gracza.
- Edytor modeli w panelu admina (admin może wgrać PNG z modelem — panel nie zmienia pliku).
- Elytra/skrzydła MiB przy plecaku nie są przesuwane (mogą nachodzić).

## Ustalenia (od właściciela)

Wszystkie punkty z „Cele” poza tymi oznaczonymi niżej jako decyzje Claude'a; propozycje rzeczy świątecznych (lista niżej)
właściciel może wymienić na stronie z podglądem przed narysowaniem i wrzuceniem do launchera.

## Jak (decyzje Claude'a)

### Format modelu (rozszerzenie `mib-model`)

- `bone`: `head`, `body` (jak dotąd) i nowy `pet` — współrzędne względem „kotwicy” peta: środek pod łapkami (y = 0 to ziemia,
  wyżej ujemne), przód peta w stronę −z jak u gracza.
- Ruch części (stopnie, dodawane do `rot`):
  - `wave: [ax, ay, az, hz, faza]` — kołysanie `a·sin(2π(hz·t + faza))`; przy bieganiu częstotliwość ×1,8 i wychylenie ×1,4,
    podczas snu ×0,3.
  - `step: a` — łapka: obrót wokół x `a·sin(krok)·siła kroku` (w grze krok i siła z chodu gracza, w launcherze w trybie
    „chodzi” udawany marsz); ujemne `a` = przeciwna faza.
  - `sit: [ax, ay, az, dy]` — przy kucaniu dodatkowy obrót i przesunięcie części w dół o `dy`.
  - `state: "awake" | "sleep"` — część widać tylko na jawie albo tylko we śnie (oczy otwarte/zamknięte).
- Te same reguły i liczby w `lib/profile.js` i `CosmeticModel.java` (wspólne przypadki w testach), animacja to funkcja czasu
  i stanu bez pamięci (jak aury): `petPose`/`partAngles` w JS i `PetPose` w Javie liczą to samo.

### Gdzie rysowany jest pet (piksele modelu gracza, y w dół, x+ = lewa strona gracza, `s` = +1 lewa, −1 prawa)

- lata: kotwica `(s·11, −3 + bujanie 1,2·sin(2π·0,5·t), 1)` przy tułowiu gracza (obrót ciała, nie głowy), skala 0,8;
  we śnie bez bujania, niżej o 1.
- ramię: kotwica `(s·6, 0, 0)` na tułowiu (pochyla się przy kucaniu), skala 0,6.
- chodzi: kotwica `(s·14, 24, 3)` przy nogach, skala 1.
- Imię nad petem: tekst gry o połowę mniejszy niż nick, nad najwyższym punktem modelu.

### Dane i baza

- `cosmetics.type` dopuszcza `pet`, `tail`, `back`; `equip_cosmetic` i `profiles.equipped` — po jednym na rodzaj (jak dotąd).
- `profiles.pet jsonb` `{mode: fly|shoulder|walk, side: left|right, name}` (domyślnie lata po lewej, bez imienia), funkcja
  `set_pet(p_mode, p_side, p_name)` (imię 0–16 znaków, bez znaków sterujących); `mib_who` zwraca `pet`, `tail`, `back`
  i ustawienia peta (zbanowani bez kosmetyków jak dotąd).
- Most: `cosmetics.json` (założone + `pet` z ustawieniami), `players.json` (pola `pet`, `tail`, `back`, `petMode`,
  `petSide`, `petName` — imię po `cleanText`, gdy włączony filtr), `cosmetic-request.json` z polem `pet` (tryb/strona z gry).
- Kolekcje świąteczne: nowe id dopisane raz do `themes.items` (migracja `pety-0.34`), adwentowe w `private.advent_days`
  8, 12, 16, 18 (tylko gdy w tych dniach nie ma kosmetyku). Id: całoroczne `pet_*`, `tail_*`, `back_*`; świąteczne
  `<motyw>_pet_*` itd.; adwentowe `adwent_pet_*` …

### Launcher

- `profile-ui.js`: `putModel` rozszerzony o pety (grupa przy postaci, tryb i strona z ustawień, animacja w `animate`),
  ogony i plecaki na tułowiu, peleryna odsunięta przy plecaku; miniatury z `modelThumb`; filtr i miejsca w „Założone”;
  przy założonym pecie panel: tryb (3 przyciski), strona, imię.
- Panel admina: nowe rodzaje w formularzu kosmetyku i w wyborze przedmiotu.

### Mod

- Warstwy: `HatLayer` rysuje modele głowy/tułowia (czapka, maska, ogon, plecak), nowa `PetLayer` — pet z kotwicą, stanem
  (kucanie, sen po 30 s bez ruchu liczony per gracz po pozycji, bieg) i imieniem; mixin peleryny: przesunięcie przy plecaku.
- Ustawienie „Pokazuj pety innych graczy” w menu (Kosmetyki), w menu Kosmetyki w grze przełączanie trybu i strony peta.
- Test gry: pet, ogon i plecak na zrzucie, haki `pet_drawn`, `tail_drawn`, `back_drawn`.

### Praca partiami

1. Format + rysowanie w launcherze → 11 całorocznych → strona z podglądem dla właściciela.
2. Rzeczy świąteczne partiami (kilka świąt naraz) → podgląd → poprawki.
3. Baza, most, mod, panel admina, testy, dokumentacja, 0.34.0.

## Propozycje rzeczy (do wymiany przez właściciela)

| Motyw | Pety | Ogony | Plecaki |
|---|---|---|---|
| cały rok | smoczek MiB, kotek, pszczółka, aksolotl | koci, smoczy MiB, diabelski | plecak MiB, skrzynia, odrzutowy, miś |
| Niepodległość | orzełek z koroną, żubr, bocian | biało-czerwony, orli, z kotylionem | z orłem, z flagą, harcerski |
| Boże Narodzenie | pingwinek w czapce, renifer, bałwanek | laska cukrowa, z lampkami, lis polarny | worek Mikołaja, choinka, domek z piernika |
| (kalendarz adwentowy) | pierniczek, sowa śnieżna | z sopli | z prezentami |
| Sylwester | sówka w czapeczce, kotek z muszką, iskierka | złoty z gwiazdką, z serpentyn, zimne ognie | z racami, zegar o północy, z konfetti |
| Walentynki | latające serduszko, miś z serduszkiem, gołąbek | z serduszkiem, różowy koci, z róż | serce, z balonami-sercami, list |
| Wielkanoc | kurczaczek, zajączek, baranek | zajęczy pompon, ze wstążkami, pastelowy lisi | koszyczek z pisankami, pisanka, z marchewkami |
| Prima Aprilis | gumowa kaczuszka, rybka w powietrzu, kotek do góry nogami | tęczowa sprężyna, banan, skarpeta | pudełko z niespodzianką, tost, arbuz |
| Urodziny Minecrafta | mini creeper, mini slime, allay | z kostek trawy, lisa z Minecrafta, z diamentów | TNT, stół rzemieślniczy, shulker |
| Dzień Dziecka | piesek z balonika, miś, dinozaurek | tęczowy, dinozaura, jednorożca | z balonami, dinozaur, z wiatraczkiem |
| Wakacje | krabik, papużka, delfinek | syreni, rekina, małpki | deska surfingowa, koło ratunkowe, ananas |
| Urodziny MiB | gwiazdka MiB, tort-stworek, ametystowy kryształek | z konfetti, ametystowy, z balonów MiB | prezent z kokardą, tort, „1 rok MiB” |
| Halloween | nietoperz, dyniek, duszek | z kości, wilkołaka, mumii | dynia, trumna, kocioł czarownicy |

## Zostawione budowniczemu

Dokładny wygląd i liczba klocków każdego modelu, kolory, prędkości ruchu (w granicach opisu), nazwy i opisy w Sklepie,
rozmieszczenie panelu ustawień peta.
