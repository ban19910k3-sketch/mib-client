# Mod MiB: menu pod prawym Shiftem i 87 modułów (projekt)

Data: 2026-10-16. Status: zatwierdzony przez właściciela 2026-10-16.

## Po co

Właściciel chce, żeby MiB Client był pełnym klientem PvP jak Dawn Client: w grze, pod prawym Shiftem, otwiera się menu z modułami (HUD, PvP, wygląd, świat, czat). Gracz niczego nie instaluje sam, bo launcher dokłada mod przy kliknięciu GRAJ. Wzorem są funkcje i układ Dawn Client, ale wygląd ma być MiB: czerń, ametystowy fiolet, pikselowe ramki.

## Cele

- Wszystkie 87 modułów z listy właściciela (tabela na końcu), na wersjach **1.8.9, 1.12.2 i 1.21+**, wszędzie tam, gdzie dana wersja gry ma to, czego moduł dotyczy.
- Menu wyglądające jak **makieta A** (kategorie z boku, siatka kart), wybrana przez właściciela.
- Edytor HUD: przesuwanie elementów myszką.
- Launcher sam instaluje mod i loader dla obsługiwanych wersji.
- Jedne ustawienia modułów dla wszystkich wersji gry.

## Nie-cele (na razie)

- Inne wersje niż 1.8.9, 1.12.2 i 1.21+ (np. 1.16.5, 1.20.x).
- Funkcje spoza listy: minimapa, czat głosowy.
- Emotki widoczne dla innych graczy. W tym projekcie emotki widzi tylko sam gracz (np. w widoku z trzeciej osoby). Widoczność dla innych to osobny projekt z serwerem MiB.
- Synchronizacja ustawień moda z profilem MiB i peleryny MiB w grze: osobny projekt po tym.

## Anty-cele (porażka, nawet jeśli działa)

- **Cheaty.** Moduły tylko pokazują informacje albo zmieniają wygląd i wygodę, tak jak w Lunar, Badlion i Dawn. Nie robimy: x-raya, pokazywania graczy przez ściany, autoclickera, automatycznego jump resetu, zmiany zasięgu ani odrzutu, automatycznego celowania, niczego, co klika lub rusza się za gracza w walce.
- **Ban gracza** za moduł, którego serwer zabrania (patrz „Ochrona przed banem”).
- **Spadek FPS.** Wyłączony moduł nic nie kosztuje, a HUD rysuje się tanio.
- **Kopiowanie Dawn Client**: kodu, grafik, nazwy, logo. Inspiracja funkcjami i układem jest w porządku, ich plików nie używamy.
- **Popsucie launchera albo gry** na wersjach, na których moda nie ma.

## Wersje i kolejność

Wersje wybrał właściciel. Kolejność to decyzja Claude'a.

| Etap wersji | Wersja | Loader | Kiedy |
|---|---|---|---|
| 1 | 1.21.11 | Fabric (+ Fabric API) | najpierw, cały fundament i etap modułów 1 |
| 2 | 1.8.9 | Forge | fundament i etap modułów 1, zaraz po 1.21.11 |
| 3 | 1.12.2 | Forge | fundament i etap modułów 1 |
| 4 | pozostałe 1.21.x i 26.x | Fabric | po etapie modułów 2. Sąsiednie wersje z tym samym kodem gry obsługuje jedna kopia moda. |

Od etapu modułów 2 każdy kolejny etap trafia od razu na wszystkie obsługiwane wersje.

Każda wersja gry potrzebuje osobnej kopii moda. Wspólna część (lista modułów, opisy, ustawienia, zapis, układ HUD, ochrona serwerowa) jest pisana raz i współdzielona. Musi więc działać na Javie 8, bo tego wymaga 1.8.9. Kopie dla wersji zawierają tylko podłączenie do gry: rysowanie, klawisze, zdarzenia i wstawki (mixiny).

## Jak gracz tego używa

1. W launcherze wybiera wersję i klika GRAJ.
2. Dla obsługiwanej wersji launcher:
   - ustawia loader (Fabric dla 1.21+, Forge dla 1.8.9 i 1.12.2), jeśli ta instalacja nie ma jeszcze żadnego;
   - dla Fabric pobiera Fabric API z Modrinth, jeśli go brakuje;
   - kopiuje mod MiB do `instances/<wersja>/mods`. Plik moda jest dołączony do instalatora launchera, więc wersja moda zawsze pasuje do wersji launchera;
   - podaje grze, gdzie leży wspólny plik ustawień (np. jako parametr JVM).
3. Jeśli instalacja tej wersji ma już inny loader (np. gracz wgrał tam mody Forge na 1.21.11), launcher nie dokłada moda MiB i pokazuje jasny komunikat.
4. W Ustawieniach launchera jest przełącznik „Mod MiB w grze” (domyślnie włączony), na wypadek gdyby coś nie działało.
5. Na liście „Moje mody” plik moda MiB jest oznaczony jako część launchera, a gracz nie może go usunąć ani wyłączyć z listy (do tego służy przełącznik z punktu 4).
6. W grze prawy Shift otwiera menu, a Esc albo prawy Shift je zamyka. Klawisz można zmienić w sterowaniu Minecrafta.

## Menu (makieta A)

Wzór: [`2026-10-16-mib-mod-menu-A.png`](2026-10-16-mib-mod-menu-A.png), wybrany przez właściciela. Ta sama kompozycja w grze:

- **Panel na środku ekranu**, gra za nim przyciemniona.
- **Lewa kolumna:**
  - logo MiB i napis „MiB Client”;
  - kategorie z liczbą modułów: Wszystkie, HUD, PvP, Wygląd, Świat, Czat i serwer, Inne;
  - na dole przyciski „Edytuj HUD” i „Zmień konto”.
- **Góra:** wyszukiwarka (szuka po nazwie i opisie) i licznik „Włączone: X z Y”.
- **Siatka kart, 4 kolumny.** Karta ma pikselową ikonę, nazwę, krótki opis, zębatkę (ustawienia) i duży przycisk WŁĄCZONY/WYŁĄCZONY. Włączona karta ma fioletową ramkę. Przy mniejszym oknie gry kolumn jest mniej, a siatka się przewija.
- **Ustawienia modułu** otwierają się w miejscu siatki, ze strzałką „wstecz”. Zawierają:
  - nazwę z przełącznikiem i opis;
  - podgląd dla modułów HUD;
  - opcje: przełączniki, suwaki, wybór koloru, wybór klawisza;
  - przycisk „Ustaw na ekranie”, który otwiera edytor HUD.
- **Ograniczenia wersji i serwera:**
  - moduły niedostępne na danej wersji gry nie pokazują się (liczniki liczą tylko dostępne);
  - moduły zablokowane na aktualnym serwerze są wyszarzone, z kłódką i napisem „Zablokowane na tym serwerze”.
- **Nazwy i teksty:**
  - nazwy modułów po angielsku, tak jak na liście właściciela i w Dawn;
  - opisy i reszta napisów po polsku, gdy gra jest po polsku, a w innym języku gry po angielsku.
- **Wygląd:** kolory i pikselowe ramki jak w launcherze, ikony w stylu pikselowym.
  - Tekst w menu: wbudowany font Minecrafta (decyzja Claude'a). Wygląda tak samo na każdej wersji i pasuje do gry, więc litery będą inne niż na makiecie.

## Edytor HUD

- Otwiera się z menu („Edytuj HUD”) albo z ustawień modułu.
- Pokazuje wszystkie włączone elementy HUD w ramkach na tle gry.
- **Obsługa myszką:**
  - przeciąganie przesuwa element;
  - element przyciąga się do krawędzi ekranu, środka ekranu i innych elementów;
  - kółko myszy zmienia rozmiar;
  - prawy przycisk otwiera ustawienia modułu.
- Przycisk „Przywróć domyślne” ustawia wszystkie elementy z powrotem.
- Pozycja zapisuje się względem najbliższego rogu albo krawędzi ekranu, więc po zmianie rozdzielczości albo skali GUI elementy zostają w swoich rogach.

## Ustawienia i zapis

- **Jeden plik ustawień dla wszystkich wersji** w katalogu gry launchera (np. `<katalog gry>/mib/mod-config.json`). Dla każdego modułu: włączony/wyłączony, opcje, pozycja i rozmiar na ekranie.
- Zmiana w grze zapisuje się od razu. Uszkodzony plik nie psuje gry: mod startuje z ustawieniami domyślnymi, a zepsuty plik odkłada obok.
- Opcja, której jakaś wersja nie ma, jest pomijana na tej wersji, ale nie jest kasowana z pliku.

## Wydajność i zgodność z innymi modami (decyzja Claude'a)

- **1.21+:**
  - mod działa razem z Sodium i Iris;
  - launcher sam dokłada Sodium z Modrinth przy instalacji moda MiB, bo prawie każdy gracz PvP go używa, a Dawn też daje „więcej FPS od razu”. Wyłącza się to tym samym przełącznikiem „Mod MiB w grze”.
- **1.8.9 i 1.12.2:**
  - mod działa z OptiFine i bez niego;
  - launcher nie dokłada OptiFine, bo licencja OptiFine zabrania jego rozpowszechniania. Gracz wgrywa go sam.
- **Zoom:** gdy jest OptiFine, Zoom MiB przejmuje klawisz C, a zoom OptiFine nie dubluje przybliżenia.
- **Moduły rysujące świat** (Brightness, Block overlay, Custom fog, Motion blur, Item physic, Hitbox, Zoom) są sprawdzane z Sodium/Iris na 1.21+ i z OptiFine na 1.8.9.

## Ochrona przed banem

- Mod ma wbudowaną listę serwerów i modułów, których te serwery zabraniają. Przykład: wolne rozglądanie się (Perspective, Snaplook) na serwerach, które go zakazują.
- Po wejściu na serwer z listy zablokowane moduły wyłączają się na czas gry na tym serwerze. W menu mają kłódkę. Po wyjściu z serwera wracają do ustawień gracza.
- Listę aktualizuje się razem z launcherem.
- Przed pierwszym wydaniem budujący sprawdza aktualne zasady dużych serwerów PvP (Hypixel i najpopularniejsze polskie serwery PvP), a w razie wątpliwości blokuje moduł.

## Zmiana konta (przejęte ze starej nakładki)

- Dziś prawy Shift w grze otwiera nakładkę launchera do zmiany konta. Na wersjach z modem MiB nakładka nie reaguje już na prawy Shift, bo ten klawisz należy do menu moda.
- W menu moda jest przycisk „Zmień konto”. Pokazuje konta z launchera, a po wyborze launcher przelogowuje i uruchamia grę ponownie, tak jak robi to dziś nakładka.
- Sposób, w jaki mod rozmawia z launcherem, wybiera budujący. Warunek: nic spoza tego komputera nie może tego wywołać.
- Na wersjach bez moda nakładka działa jak dotąd.

## Wydawanie i testy

- **Budowanie:**
  - źródła moda leżą w tym samym repozytorium (katalog `mod/`);
  - mody budują się na GitHubie w tym samym workflow co launcher, przed instalatorem;
  - gotowe pliki trafiają do instalatora.
- **Etapy:**
  - każdy etap modułów to nowa wersja launchera, którą właściciel publikuje sam („Publish release”);
  - w etapie 1 każda wersja gry wychodzi osobno (najpierw 1.21.11, potem 1.8.9, potem 1.12.2), żeby właściciel szybciej dostał coś do sprawdzenia (decyzja Claude'a);
  - na wersjach, na których moda jeszcze nie ma, działa stara nakładka.
- **Testy (Minecrafta nie da się uruchomić tam, gdzie pracuje Claude):**
  - logika wspólna (ustawienia, układ HUD, wyszukiwarka, ochrona serwerowa) ma testy uruchamiane przy każdym budowaniu;
  - tam, gdzie loader na to pozwala (Fabric 1.21.11), automatyczny test na GitHubie uruchamia grę, otwiera menu i edytor HUD i robi zrzuty ekranu. Claude ogląda je przed oddaniem etapu;
  - po każdym etapie właściciel sprawdza w grze i zgłasza, co nie działa.

## Moduły

Kolumna „Co robi” to interpretacja Claude'a, bo strona Dawn Client nie była dostępna. Opisy oznaczone (?) są najbardziej niepewne. Wszystkie są w etapie 4, więc do tego czasu właściciel może je poprawić. Przed rozpoczęciem etapu 4 Claude jeszcze raz pyta o moduły z (?). Kolumna „Wersje”: „wszystkie” to 1.8.9, 1.12.2 i 1.21+. Ograniczenia wynikają z tego, czego dana wersja gry nie ma.

Etapy:
- **Etap 1** to fundament (menu, edytor HUD, zapis, integracja z launcherem) i 16 prostych modułów.
- **Etap 2** to HUD i PvP.
- **Etap 3** to wygląd i kamera.
- **Etap 4** to świat, przedmioty, czat i narzędzia.

| # | Moduł | Co robi | Kategoria | Wersje | Etap |
|---|---|---|---|---|---|
| 1 | Animations | Stare animacje z 1.7 (blok mieczem, wędka, uderzanie podczas jedzenia), każda osobno do włączenia | Wygląd | wszystkie | 3 |
| 2 | Armor bar | Pasek pancerza nad zdrowiem w kolorach materiału zbroi | HUD | wszystkie | 2 |
| 3 | Armor status | Założona zbroja i trzymany przedmiot z wytrzymałością | HUD | wszystkie | 1 |
| 4 | Attack indicator | Własny wygląd i miejsce wskaźnika gotowości ataku | PvP | 1.12.2, 1.21+ | 2 |
| 5 | Autohide HUD | Chowa wybrane elementy HUD, gdy nie są potrzebne (np. w menu, przy braku zmian) | HUD | wszystkie | 3 |
| 6 | Auto perspective | Sam przełącza widok z trzeciej osoby, np. przy jeździe konnej lub lataniu elytrą | Wygląd | wszystkie | 3 |
| 7 | Auto text | Klawisze wysyłające zapisane wiadomości lub komendy (np. /gg) | Czat i serwer | wszystkie | 4 |
| 8 | Backups | Automatyczne kopie światów jednoosobowych | Inne | wszystkie | 4 |
| 9 | Block indicator | Nazwa i informacje o bloku, na który patrzysz | Świat | wszystkie | 4 |
| 10 | Block overlay | Własna obwódka i wypełnienie wskazanego bloku (kolor, grubość) | Wygląd | wszystkie | 3 |
| 11 | Boss bar | Przesuwanie, skalowanie lub ukrycie paska bossa | HUD | wszystkie | 3 |
| 12 | Brightness | Pełna jasność (fullbright) | Wygląd | wszystkie | 1 |
| 13 | Camera | Wyłączenie bujania kamery, płynna kamera, odległość kamery w F5 | Wygląd | wszystkie | 3 |
| 14 | Color saturation | Nasycenie kolorów świata (suwak) | Wygląd | wszystkie | 3 |
| 15 | Combo display | Licznik combo w walce | PvP | wszystkie | 2 |
| 16 | Coordinates | Pozycja X Y Z, kierunek i biom | HUD | wszystkie | 1 |
| 17 | CPS | Kliknięcia na sekundę (lewy i prawy) | HUD | wszystkie | 1 |
| 18 | Custom crosshair | Własny celownik: kształt, kolor, rozmiar, kropka | PvP | wszystkie | 1 |
| 19 | Cull logs (?) | Ukrywa powtarzające się komunikaty w logach i konsoli gry, żeby nie zwalniały gry | Inne | wszystkie | 4 |
| 20 | Custom advancement requirements | Pokazuje, czego brakuje do osiągnięcia | Inne | 1.12.2, 1.21+ | 4 |
| 21 | Custom chat | Godzina przy wiadomościach, łączenie powtórzeń, dłuższa historia, przezroczystość tła | Czat i serwer | wszystkie | 4 |
| 22 | Custom F3 | Wybór, co pokazuje ekran F3, wersja skrócona | HUD | wszystkie | 3 |
| 23 | Custom fog | Zmiana lub wyłączenie mgły i jej koloru | Wygląd | wszystkie | 3 |
| 24 | Damage indicator | Zdrowie celu i zadane obrażenia | PvP | wszystkie | 2 |
| 25 | Dark mode | Ciemny wygląd ekranów gry (ekwipunek, menu) | Wygląd | wszystkie | 3 |
| 26 | Death info | Miejsce i godzina ostatniej śmierci (wiadomość i punkt) | Świat | wszystkie | 4 |
| 27 | Direction | Kompas N/E/S/W u góry ekranu | HUD | wszystkie | 1 |
| 28 | Drop prevention | Blokuje wyrzucenie wybranych cennych przedmiotów | Inne | wszystkie | 4 |
| 29 | Elytras (?) | Ustawienia elytry: ukrywanie, peleryna na elytrze | Wygląd | 1.12.2, 1.21+ | 4 |
| 30 | Emotes | Emotki postaci (machanie, taniec) widoczne dla gracza | Inne | wszystkie | 4 |
| 31 | FOV changer | Własne pole widzenia, bez zmian przy biegu i miksturach szybkości | Wygląd | wszystkie | 1 |
| 32 | FPS | Klatki na sekundę | HUD | wszystkie | 1 |
| 33 | Hearts | Liczbowe zdrowie, wyraźniejsze serca absorpcji | HUD | wszystkie | 2 |
| 34 | Hitbox | Własne ramki hitboxów (kolor, tylko gracze) | PvP | wszystkie | 3 |
| 35 | Hit indicator | Znacznik i dźwięk przy trafieniu przeciwnika | PvP | wszystkie | 2 |
| 36 | Horses | Prędkość, skok i zdrowie konia | Świat | wszystkie | 4 |
| 37 | Inventory | Ekwipunek bez przyciemnienia tła, efekty mikstur obok | Wygląd | wszystkie | 4 |
| 38 | Item counter | Liczba wybranych przedmiotów (strzały, perły, mikstury) na HUD | HUD | wszystkie | 2 |
| 39 | Item despawn | Czas do zniknięcia leżących przedmiotów | Świat | wszystkie | 4 |
| 40 | Item info | Wytrzymałość liczbami i dodatkowe informacje o przedmiotach | Inne | wszystkie | 4 |
| 41 | Item physic | Wyrzucone przedmioty leżą płasko i turlają się | Wygląd | wszystkie | 3 |
| 42 | Jump reset | Wskaźnik, czy skok po otrzymaniu ciosu był w dobrym momencie (tylko podpowiedź, bez automatu) | PvP | wszystkie | 2 |
| 43 | Keystrokes | Wciśnięte WASD, spacja i przyciski myszy z CPS | HUD | wszystkie | 1 |
| 44 | Light level overlay | Poziom światła na blokach (gdzie mogą się pojawić moby) | Świat | wszystkie | 4 |
| 45 | Loot beams | Promienie światła nad leżącymi przedmiotami w kolorze rzadkości | Świat | wszystkie | 4 |
| 46 | Mob overlay (?) | Pasek zdrowia i nazwa nad mobami | Świat | wszystkie | 4 |
| 47 | Motion blur | Rozmycie ruchu (suwak siły) | Wygląd | wszystkie | 3 |
| 48 | Mousestrokes | Ruch myszy pokazany na HUD | HUD | wszystkie | 2 |
| 49 | Nametags | Własny nick w F5, przezroczystość tła, cień | Wygląd | wszystkie | 3 |
| 50 | Nick hider | Ukrywa lub podmienia własny nick (do nagrywania) | Inne | wszystkie | 3 |
| 51 | Pack display | Nazwa i ikona aktualnej paczki zasobów na HUD | HUD | wszystkie | 2 |
| 52 | Perspective | Wolne rozglądanie się pod klawiszem bez obracania postaci | Wygląd | wszystkie | 3 |
| 53 | Ping | Opóźnienie do serwera | HUD | wszystkie | 1 |
| 54 | Player model | Twoja postać na HUD | HUD | wszystkie | 2 |
| 55 | Playtime | Czas tej sesji gry | HUD | wszystkie | 1 |
| 56 | Potion effects | Aktywne mikstury z czasem | HUD | wszystkie | 1 |
| 57 | Reach display | Odległość ostatniego uderzenia | PvP | wszystkie | 2 |
| 58 | Reconnect | Przycisk „Połącz ponownie” i automatyczne łączenie po rozłączeniu | Czat i serwer | wszystkie | 4 |
| 59 | Saturation | Nasycenie głodu na pasku jedzenia | HUD | wszystkie | 2 |
| 60 | Scoreboard | Przesuwanie i skalowanie tabeli wyników, ukrycie czerwonych liczb | HUD | wszystkie | 3 |
| 61 | Screenshot | Kopiowanie zrzutu do schowka, podgląd, otwieranie folderu | Inne | wszystkie | 4 |
| 62 | Keybind search | Wyszukiwarka i oznaczanie konfliktów w ustawieniach klawiszy | Inne | wszystkie | 4 |
| 63 | Server address | Adres serwera na HUD | HUD | wszystkie | 1 |
| 64 | Shulker tooltips | Podgląd zawartości shulkera | Świat | 1.12.2, 1.21+ | 4 |
| 65 | Snaplook | Szybki podgląd za siebie / z przodu pod klawiszem | Wygląd | wszystkie | 3 |
| 66 | Sound filters | Pogłos w jaskiniach i wytłumienie pod wodą | Inne | 1.21+ (starsze, jeśli się da) | 4 |
| 67 | Speed meter | Prędkość ruchu w blokach na sekundę | HUD | wszystkie | 2 |
| 68 | Stopwatch | Stoper pod klawiszem | HUD | wszystkie | 2 |
| 69 | Subtitles | Położenie i rozmiar napisów do dźwięków | HUD | 1.12.2, 1.21+ | 3 |
| 70 | System resources | Użycie procesora i pamięci | HUD | wszystkie | 2 |
| 71 | Tablist | Ping liczbami, głowy graczy, przezroczystość listy graczy | Czat i serwer | wszystkie | 3 |
| 72 | Tier tagger | Tier gracza z MCTiers obok nicku (z publicznego API MCTiers) | PvP | 1.21+ | 4 |
| 73 | Time | Godzina z zegara komputera | HUD | wszystkie | 1 |
| 74 | Time changer | Własna pora dnia (tylko u Ciebie) | Wygląd | wszystkie | 3 |
| 75 | Title tweaker | Rozmiar i położenie tytułów na ekranie | HUD | wszystkie | 3 |
| 76 | TNT timer | Odliczanie nad zapalonym TNT | Świat | wszystkie | 4 |
| 77 | Toast control | Wyłączanie wyskakujących powiadomień (przepisy, osiągnięcia) | HUD | 1.12.2, 1.21+ | 3 |
| 78 | Toggle sprint | Bieg i skradanie bez trzymania klawisza | PvP | wszystkie | 1 |
| 79 | Tooltips | Rozmiar dymków przedmiotów, dodatkowe informacje | Inne | wszystkie | 3 |
| 80 | Totem | Licznik zużytych totemów przeciwnika i Twoich totemów | PvP | 1.12.2, 1.21+ | 2 |
| 81 | TPS | Szacowana wydajność serwera (TPS) | HUD | wszystkie | 2 |
| 82 | UHC overlay | Powiększone sztabki złota, jabłka i głowy na ziemi | Świat | wszystkie | 4 |
| 83 | UI scaling | Dokładniejsza skala interfejsu | Wygląd | wszystkie | 3 |
| 84 | Viewmodel | Położenie, rozmiar i obrót ręki i przedmiotu | Wygląd | wszystkie | 3 |
| 85 | Waypoints | Punkty w świecie z promieniem i listą | Świat | wszystkie | 4 |
| 86 | Weather changer | Własna pogoda (tylko u Ciebie) | Wygląd | wszystkie | 3 |
| 87 | Zoom | Przybliżenie pod klawiszem (domyślnie C), kółkiem bliżej i dalej | PvP | wszystkie | 1 |

Etap 1 (16): Armor status, Brightness, Coordinates, CPS, Custom crosshair, Direction, FOV changer, FPS, Keystrokes, Ping, Playtime, Potion effects, Server address, Time, Toggle sprint, Zoom.

## Zostawione budującemu

- Narzędzia budowania dla każdej wersji (Loom dla Fabric, odpowiednie narzędzie dla starego Forge 1.8.9 i 1.12.2) i podział kodu na część wspólną i kopie dla wersji.
- Sposób rozmowy moda z launcherem przy zmianie konta (bez dostępu z zewnątrz komputera).
- Format pliku ustawień i jego wersjonowanie.
- Ikony modułów w stylu pikselowym (np. pixelarticons, MIT), dobór opcji w ustawieniach każdego modułu i domyślne położenia elementów HUD.
- Grupowanie pozostałych wersji 1.21.x i 26.x w jak najmniej kopii moda.
