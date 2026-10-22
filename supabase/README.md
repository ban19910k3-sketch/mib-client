# Profil MiB — ustawienie Supabase

> Argumenty JVM celowo **nie** są synchronizowane z profilem: z profilu nie mogą przyjść flagi, które uruchomiłyby kod na komputerze gracza.

Instrukcja dla właściciela projektu Supabase `mib-client` (`https://pijyremkmhmnyvjusrhu.supabase.co`).
Zrób kroki 1–3 **przed** opublikowaniem wersji z profilem (0.8.x) na GitHubie. Bez nich profil w launcherze nie zadziała (granie działa normalnie).

## 1. Wklej bazę danych

1. Otwórz https://supabase.com/dashboard i wejdź w projekt `mib-client`.
2. Po lewej kliknij **SQL Editor**, potem **New query**.
3. Otwórz plik [`schema.sql`](schema.sql), skopiuj **całą** zawartość i wklej w okno zapytania.
4. Kliknij **Run**. Na dole powinno pojawić się „Success. No rows returned”.

Ten krok **powtarzaj przy każdej aktualizacji launchera, która zmienia ten plik** (np. 0.8.2 dodała dokańczanie profilu, 0.10.0 pomysły graczy, 0.13.0 zakładanie peleryn, 0.14.0 logo MiB przed nickiem graczy MiB, 0.15.0 znajomi i czapki/skrzydła w grze, 0.16.0 zaproszenia do gry i „Teraz gra” w statystykach, 0.17.0 wiadomości do znajomych, 0.19.0 prezenty od MiB i odpowiedzi na pomysły, 0.20.0 blokowanie, zgłoszenia, ostrzeżenia i bany, osiągnięcia, wykres graczy, ważne aktualności w oknie, 0.21.0 głosowanie na pomysły). Nie usuwa danych graczy.

Od 0.14.0 plik włącza rozszerzenie `http` (baza pyta Mojanga, czy konto Minecrafta należy do gracza). Supabase może przy **Run** pokazać ostrzeżenie — kliknij **Run this query**.

## 2. Wyłącz potwierdzanie e-maila

Darmowa poczta Supabase nie wysyła maili do graczy, więc rejestracja nie może czekać na potwierdzenie.

1. Po lewej **Authentication** → **Sign In / Providers**.
2. W części **Email** wyłącz **Confirm email**.
3. Upewnij się, że **Allow new users to sign up** jest włączone.
4. Jeśli jest pole **Minimum password length**, ustaw `8`.
5. Zapisz (**Save**).

Jeśli panel wygląda inaczej, szukaj w **Authentication** przełącznika „Confirm email”.

## 3. Sprawdź, czy działa

1. Uruchom najnowszy launcher 0.8.x (szkic wydania na GitHubie) i wejdź w **Profil MiB**.
2. Załóż profil testowy. Powinno pokazać się okno „Konto założone!” z Twoim ID i kodem odzyskiwania. Zapisz kod, zaznacz potwierdzenie i kliknij **Dalej**.
3. Kliknij **Wyloguj**, potem **Zaloguj się** → **Nie pamiętam hasła**, wpisz e-mail, kod i nowe hasło. Launcher powinien Cię zalogować i pokazać nowy kod.
4. Na drugim komputerze (albo po ponownym uruchomieniu launchera, jeśli przed resetem była tam zalogowana sesja) profil powinien poprosić o ponowne zalogowanie — to znaczy, że reset wylogowuje stare sesje.
5. Na stronie profilu kliknij **Usuń profil** i potwierdź nickiem. W **Authentication → Users** konto powinno zniknąć.
6. W Supabase: **Table Editor** → `profiles` — przed usunięciem był tam Twój profil z `num = 1`.

## Panel admina

Panel admina widzi w launcherze tylko konto **MIB-000002**. Uprawnienia sprawdza baza, więc przerobiony launcher też nic nie zdziała.

- Adminem zostaje profil, który ma numer `MIB-000002` **w chwili pierwszego uruchomienia** `schema.sql` z panelem (od wersji 0.9.0). Konto jest zapisywane na stałe — późniejsze wyzerowanie numeracji nie da panelu nikomu innemu.
- Jeśli plik został uruchomiony, zanim istniał profil `MIB-000002`, załóż ten profil i uruchom `schema.sql` jeszcze raz.
- Sprawdzenie, kto jest adminem (SQL Editor):

```sql
select p.nick, p.num from private.admins a join public.profiles p on p.id = a.user_id;
```

W panelu: ogłoszenia, pomysły graczy, kosmetyki (z teksturą peleryny PNG 64×32), kody prezentowe, wyszukiwanie graczy (nadawanie i zabieranie przedmiotów, usuwanie kont) i statystyki.
- **Pomysły** (od 0.10.0): gracze z profilem MiB wysyłają je z zakładki **Pomysły** (najwyżej 5 na dobę). Liczba nowych pomysłów świeci się przy „Panel admina”. Ustaw status (Przeczytany, W planach, Zrobione, Odrzucony), a gracz zobaczy go przy swoim pomyśle. Po usunięciu konta pomysł zostaje, ale bez nicku.
- Konta admina nie da się usunąć z launchera (ani własnym „Usuń profil”, ani z panelu) — tylko ręcznie w **Authentication → Users**, żeby nie stracić panelu przez przypadek.
- Po uruchomieniu `schema.sql` sprawdź zapytaniem wyżej, czy adminem jest Twoje konto. Jeśli pod `MIB-000002` jest ktoś inny, napisz do Claude, zanim wydasz launcher.

## Status na Discordzie

Żeby pod nickiem graczy na Discordzie pojawiało się „Gra w MiB Client”, potrzebna jest aplikacja Discorda (raz, za darmo):

1. Wejdź na https://discord.com/developers/applications i zaloguj się.
2. **New Application**, nazwa: `MiB Client` (tak będzie widoczna na Discordzie), zaakceptuj regulamin, **Create**.
3. Skopiuj **Application ID** (długa liczba) i wyślij ją Claude — trafi do `DISCORD_CLIENT_ID` w `main.js`.
4. Po lewej **Rich Presence → Art Assets → Add Image(s)**: wgraj logo MiB (kwadrat, najlepiej 512×512) i nazwij je dokładnie `mib`. **Save Changes**.

Dopóki numer aplikacji nie jest wpisany, status na Discordzie jest wyłączony. Gracz może go też wyłączyć w Ustawieniach.

## Gdy nie da się założyć profilu albo zalogować

Launcher pokazuje wtedy, co jest nie tak. Najczęstsze sytuacje:

| Komunikat w launcherze | Co zrobić |
|---|---|
| „Serwer MiB wymaga potwierdzenia e-maila…” | Wyłącz **Confirm email** (krok 2). Konta założone, gdy było włączone, są „niepotwierdzone” i nie da się na nie zalogować: usuń je w **Authentication → Users** i załóż profil jeszcze raz. |
| „Dokończ profil MiB” zamiast profilu | Konto powstało, zanim uruchomiono `schema.sql`. Gracz wybiera nick i profil się tworzy — nic nie trzeba robić. |
| „Baza serwera MiB jest nieaktualna…” | Uruchom ponownie najnowszy `schema.sql` (krok 1). |
| „Na ten e-mail jest już założony profil…” | Konto z tym e-mailem już istnieje (np. z wcześniejszej próby). Zaloguj się albo usuń je w **Authentication → Users**. |
| „Ten nick jest już zajęty albo niedozwolony…” | Nick zajęty, ma złe znaki albo nie uruchomiono `schema.sql`. |
| „Coś poszło nie tak… (kod: treść)” | Zrób zrzut ekranu — w nawiasie jest odpowiedź serwera. |

## Dodawanie kosmetyków

**Table Editor** → tabela `cosmetics` → **Insert** → **Insert row**:

| Pole | Przykład | Znaczenie |
|---|---|---|
| `id` | `cape_start` | stały identyfikator, bez spacji |
| `name` | `Peleryna Start` | nazwa widoczna w launcherze |
| `type` | `cape` | rodzaj: `cape`, `hat`, `wings`, `aura` |
| `image_url` | puste albo link do obrazka | obrazek przedmiotu |

Albo w **SQL Editor**:

```sql
insert into public.cosmetics (id, name, type) values ('cape_start', 'Peleryna Start', 'cape');
```

Najprościej dodać je w panelu admina (zakładka Kosmetyki), razem z teksturą i podglądem na postaci.

- **Skrzydła**: tekstura szeroka na 128 pikseli (klatka 128×64) to skrzydła jak u wróżki, węższa (64×32) rysuje się jak elytra.
- **Aura** (od 0.22.0): id kończy się ruchem cząsteczek — `_souls`, `_pumpkins`, `_ghosts` albo `_magic` (w panelu admina wybierasz go z listy).

`schema.sql` od 0.22.0 sam dodaje 14 kosmetyków na Halloween (3 peleryny, 5 czapek, 2 skrzydła, 4 aury; id zaczynają się od `halloween_`).
Graczom dajesz je jak inne przedmioty: kodami, prezentem albo prezentem dla wszystkich.

## MiB Coins i sklep (od 0.23.0)

- Saldo gracza jest w `profiles.coins`. Gracz może je tylko zobaczyć, zmienia je admin: panel admina → Gracze → wybierz gracza → **MiB Coins** (liczba z minusem zabiera coinsy). Każda zmiana zapisuje się w `private.coin_log`.
- Link do sklepu ustawiasz w panelu admina → Kosmetyki → **Sklep MiB Coins** (tylko `https://`). Przycisk „Kup MiB Coins” w launcherze otwiera go z numerem gracza na końcu, np. `https://sklep.mib.pl/coins?mib=MIB-000123`. Pusty link ukrywa przycisk.

## Kody prezentowe

Kody są w ukrytej tabeli `private.gift_codes` (gracze jej nie widzą). Tworzysz je w **SQL Editor**:

```sql
-- kod na 1 użycie (dla jednego zwycięzcy)
insert into private.gift_codes (code, cosmetic_id) values ('KONKURS-ABC123', 'cape_start');

-- kod na 50 użyć, ważny 7 dni
insert into private.gift_codes (code, cosmetic_id, max_uses, expires_at)
values ('START2026', 'cape_start', 50, now() + interval '7 days');

-- ile razy kod użyto
select code, used_count, max_uses, expires_at from private.gift_codes;
```

Kody zapisuj **wielkimi literami** (baza nie przyjmie małych) — launcher sam zamienia to, co wpisze gracz, na wielkie litery.
Kod na wiele użyć rób długi i losowy (np. `MIB-7KQ2-XW9P`), żeby nikt go nie zgadł.

## Przed startem dla graczy

Jeśli w bazie są profile testowe, usuń je, żeby gracze dostali numery od `MIB-000001` i miejsca Założyciela:

1. **Authentication** → **Users** → zaznacz testowe konta → **Delete users** (profile znikną razem z nimi).
2. **SQL Editor**:

```sql
-- numeracja zacznie się od najmniejszego wolnego numeru (od 1, jeśli w bazie nie ma żadnego profilu)
select setval(pg_get_serial_sequence('public.profiles', 'num'), coalesce(max(num), 0) + 1, false) from public.profiles;
```

## Dobrze wiedzieć

- Klucz `sb_publishable_…` w launcherze jest publiczny i to jest w porządku. **Nigdy** nie wklejaj do launchera ani nikomu nie wysyłaj klucza `service_role` / `secret` ani hasła do bazy.
- Gracz, który zgubi i hasło, i kod odzyskiwania, nie odzyska profilu sam. Możesz wtedy usunąć jego konto w **Authentication → Users**, żeby mógł założyć nowe.
- Darmowy plan Supabase usypia projekt po tygodniu bez żadnego ruchu. Wtedy w panelu kliknij **Restore project**.
