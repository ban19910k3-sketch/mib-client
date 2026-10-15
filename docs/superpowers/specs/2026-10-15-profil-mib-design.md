# Profil MiB i animacje launchera — projekt

Data: 2026-10-15 · Wersja docelowa launchera: 0.8.0

## Po co

Właściciel chce, żeby każdy gracz MiB Client mógł założyć **profil MiB** z własnym, niepowtarzalnym ID. Profil jest podstawą pod przyszły sklep z kosmetykami (peleryny i inne przedmioty): wszystko, co gracz kupi lub dostanie, ma być przypisane do jego profilu. Profil zapisuje też ustawienia launchera, żeby wracały po zalogowaniu na innym komputerze. Przy okazji launcher dostaje kilka animacji.

Sklepu i płatności w tej wersji nie ma. Profil ma powstać teraz, żeby gracze mogli zakładać konta, zanim sklep ruszy.

## Cele

1. Rejestracja i logowanie do profilu MiB w launcherze: e-mail, hasło, nick MiB.
2. Niepowtarzalne ID profilu.
3. Lista posiadanych kosmetyków przypisana do profilu (na razie zwykle pusta).
4. Synchronizacja ustawień launchera z profilem.
5. Odznaka „Założyciel” dla pierwszych 1000 profili.
6. Kody prezentowe dające kosmetyk na profil.
7. Kopia listy modów na profilu i przywracanie jej na innym komputerze.
8. Statystyki gry na profilu.
9. Sześć animacji opisanych niżej.

## Poza zakresem (na później)

- Sklep, płatności, ceny.
- Wyświetlanie peleryn w grze (wymaga moda po stronie gry).
- Znajomi i status „gra w…”.
- Logowanie do profilu kontem Microsoft.

## Anty-cele (porażka, nawet jeśli „działa”)

- Launcher nie może wymagać profilu do grania. Bez profilu i bez internetu wszystko działa jak dziś.
- Hasło gracza nigdy nie jest zapisywane na dysku. Na dysku może leżeć tylko sesja, zaszyfrowana tak jak dziś sesje Microsoft (`safeStorage`).
- W launcherze nie może być żadnego tajnego klucza (`service_role`/`secret`). Gracz nie może sam dopisać sobie kosmetyku ani podmienić cudzego profilu, nawet jeśli wyciągnie klucz z launchera i będzie wołał API ręcznie.
- Nie wolno zepsuć automatycznych aktualizacji ani obecnych funkcji (konta Microsoft, mody, uruchamianie gry).
- Wygląd nie może wrócić do „szablonu AI”: obowiązuje obecny system (czerń, ametyst `#a855f7`, pikselowe ramki `--px`, Pixelify tylko w nagłówkach z `font-weight:400`).

## Decyzje właściciela

- Profil zakładany przez **e-mail i hasło**.
- Dane profili w **Supabase** (projekt `https://pijyremkmhmnyvjusrhu.supabase.co`, klucz publiczny `sb_publishable_-Gfr_STF_qinPsxzdYFaDg_eXg4j1Al`). Kod i aktualizacje zostają na GitHubie.
- Wszystkie propozycje dodatków 1–4 (Założyciel, kody, kopia modów, statystyki) i wszystkie 6 animacji.

## Ograniczenia

- Supabase w planie darmowym: wbudowana poczta wysyła tylko kilka maili na godzinę. Dlatego potwierdzanie e-maila przy rejestracji jest **wyłączone** (ustawienie w panelu Supabase). Mail idzie tylko przy resecie hasła.
- Launcher to Electron bez bundlera; interfejs ma `contextIsolation` i rozmawia z procesem głównym przez `window.mib.call(kanał, dane)`.
- Wszystkie nowe napisy w UI muszą trafić też do słownika `EN` w `ui.js`.
- Właściciel nie programuje. Wszystko, co trzeba zrobić w panelu Supabase, musi być opisane krok po kroku, a SQL ma się dać wkleić w SQL Editor jednym ruchem.
- Ten kontener może nie mieć dostępu sieciowego do `supabase.co`, więc testy z prawdziwą bazą mogą być możliwe dopiero u właściciela.

## Jak to działa

### Architektura

- Cała komunikacja z Supabase odbywa się w **procesie głównym** (`main.js`) przez `@supabase/supabase-js`. Interfejs dostaje tylko wyniki przez IPC. Adres i klucz publiczny są stałymi w `main.js`.
- Sesja Supabase (access/refresh token) jest trzymana zaszyfrowana `safeStorage` w katalogu danych launchera i odświeżana automatycznie. Przy braku szyfrowania systemowego sesja nie jest zapisywana (gracz loguje się po każdym starcie).
- Uprawnienia pilnuje baza: RLS na wszystkich tabelach. Rzeczy „wartościowe” (kosmetyki, ID, odznaka, liczniki) zmieniają tylko funkcje bazy (`security definer`), nigdy bezpośredni zapis z launchera.
- Schemat bazy dostarczamy jako `supabase/schema.sql` (idempotentny, do wklejenia w SQL Editor) plus instrukcję `supabase/README.md` po polsku: wklejenie SQL, wyłączenie potwierdzania e-maila, szablon maila z kodem resetu, dodawanie kosmetyków i kodów prezentowych.

### Profil

- **Rejestracja:** e-mail, hasło (min. 8 znaków), nick MiB (3–16 znaków, litery, cyfry, `_`; unikalny bez względu na wielkość liter). Po rejestracji gracz jest od razu zalogowany.
- **ID:** nadawane przez bazę przy tworzeniu profilu, kolejne liczby, wyświetlane jako `MIB-000127` (6 cyfr, więcej gdy zabraknie). Nigdy się nie zmienia i nie jest używane ponownie.
- **Założyciel:** profil o numerze ≤ 1000 ma odznakę „Założyciel”, ustawianą przez bazę przy tworzeniu.
- **Logowanie / wylogowanie:** e-mail + hasło. Wylogowanie usuwa sesję z dysku.
- **Reset hasła:** „Nie pamiętam hasła” → Supabase wysyła maila z 6-cyfrowym kodem → gracz wpisuje kod i nowe hasło w launcherze. Wymaga szablonu maila z `{{ .Token }}` (instrukcja w README).
- **Zmiana nicku:** poza zakresem tej wersji.
- Profil jest **niezależny od kont Microsoft**. Gracz może mieć kilka kont Minecraft w launcherze i jeden profil MiB.

### Kosmetyki i kody prezentowe

- Katalog kosmetyków (id, nazwa, typ np. `cape`, opcjonalny obrazek) czytelny dla wszystkich. Właściciel dodaje pozycje w panelu Supabase.
- Posiadane kosmetyki: wpis gracz–kosmetyk ze źródłem (`code`, później `purchase`) i datą. Gracz widzi tylko swoje. Nie może ich dopisywać ani usuwać.
- Kod prezentowy: kod, kosmetyk, limit użyć, licznik, opcjonalna data ważności. Funkcja bazy `redeem_code(kod)` sprawdza ważność i limit, pozwala jednemu profilowi użyć danego kodu raz, dodaje kosmetyk i zwraca jego nazwę albo czytelny błąd. Kody są niewidoczne z launchera.
- Strona **Kosmetyki** pokazuje posiadane przedmioty (albo pusty stan z zachętą) i pole „Wpisz kod”. Bez profilu pokazuje zachętę do założenia profilu.

### Synchronizacja ustawień

- Synchronizowane: RAM, rozdzielczość, argumenty JVM, priorytet procesu, ukrywanie powiadomień o aktualizacjach, język, tło (bez własnego obrazka), animacja startowa, efekty cząsteczek.
- Niesynchronizowane: katalog gry, ścieżka Javy, ścieżka własnego tła (zależą od komputera).
- Zasada: wygrywa nowsza wersja (znacznik czasu zapisu). Po zalogowaniu launcher pobiera ustawienia z profilu i, jeśli są nowsze niż lokalne, stosuje je. Po kliknięciu „Zapisz” wysyła je na profil. Bez internetu zapis lokalny działa jak dziś, a wysłanie ponawia się przy następnej okazji.

### Kopia modów

- Po każdej zmianie modów danej wersji (instalacja, usunięcie, włączenie/wyłączenie, aktualizacja) launcher, gdy gracz jest zalogowany, zapisuje na profilu listę modów tej wersji: wersja gry, loader, projekt i wersja z Modrinth, nazwa pliku, czy włączony. Mody rozpoznaje po sumie SHA-1 przez Modrinth (jak dziś robi to sprawdzanie aktualizacji).
- Pliki spoza Modrinth nie trafiają do kopii; launcher pokazuje, ile ich pominął.
- Na stronie **Moje mody**, gdy profil ma kopię dla wybranej wersji, jest przycisk „Przywróć mody z profilu (N)”. Pobiera brakujące mody (te same wersje, z kontrolą sum) i ustawia loader; nie usuwa niczego, co gracz już ma.

### Statystyki

- Launcher liczy czas od uruchomienia gry do jej zamknięcia i liczbę uruchomień, osobno dla każdej wersji gry. Po zamknięciu gry wysyła sesję funkcją bazy (sesja dłuższa niż 24 h jest przycinana). Bez internetu sesje czekają lokalnie w kolejce.
- Profil pokazuje: łączny czas gry, liczbę uruchomień, ulubioną wersję (najwięcej czasu), datę założenia.

### Interfejs

- Nowa strona **Profil** w menu bocznym. Dolny blok paska bocznego (dziś „Gracz / Konto Microsoft”) prowadzi do niej i pokazuje nick MiB oraz ID, a bez profilu napis „Załóż profil MiB”.
- Bez profilu strona ma dwie zakładki: „Załóż profil” i „Zaloguj się”.
- Z profilem strona pokazuje: nick, ID (z przyciskiem kopiowania), odznakę Założyciel, statystyki, posiadane kosmetyki w skrócie i przycisk „Wyloguj”.
- Wygląd zgodny z obecnym systemem w `style.css`.

## Animacje

Wszystkie zgodne z pikselowym stylem, krótkie (do ~400 ms poza splashem), wyłączane przez `prefers-reduced-motion` i przez ustawienie „Animacja startowa: Wyłączona”.

1. **Splash → launcher:** logo ze splasha przelatuje i zmniejsza się do pozycji logo w lewym górnym rogu paska bocznego, potem pojawia się reszta interfejsu.
2. **Menu:** fioletowy znacznik aktywnej zakładki przesuwa się do nowej pozycji; nowa strona krótko wsuwa się z lekkim przesunięciem.
3. **GRAJ:** postęp pobierania gry wypełnia sam przycisk GRAJ (pikselowo, skokami), zamiast cienkiej kreski na dole okna.
4. **Postać 3D:** macha raz po zalogowaniu na konto Microsoft lub profil; idzie, gdy kursor jest nad postacią; poza tym obecna animacja spoczynku. Gdy 3D jest niedostępne, nic się nie dzieje.
5. **Okienka:** otwierają się „skokowo” (`steps()`), jak w starych grach.
6. **Nowy kosmetyk:** po zrealizowaniu kodu krótki efekt odblokowania (błysk ametystu, ikonka przedmiotu, nazwa).

## Zostawione budowniczemu

- Nazwy tabel, kolumn i funkcji w bazie oraz podział kodu na pliki.
- Dokładne komunikaty błędów (po polsku, konkretne, z podpowiedzią co zrobić) i ich tłumaczenia.
- Szczegóły wizualne w ramach obecnego systemu.
- Testy: logika, którą da się sprawdzić bez sieci (walidacja nicku, format ID, łączenie ustawień, kolejka statystyk), ma testy; reszta jest sprawdzana zrzutami ekranu i ręcznie.
