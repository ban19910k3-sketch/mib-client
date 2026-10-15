# Profil MiB — ustawienie Supabase

> Argumenty JVM celowo **nie** są synchronizowane z profilem: z profilu nie mogą przyjść flagi, które uruchomiłyby kod na komputerze gracza.

Instrukcja dla właściciela projektu Supabase `mib-client` (`https://pijyremkmhmnyvjusrhu.supabase.co`).
Zrób kroki 1–3 **przed** opublikowaniem wersji z profilem (0.8.x) na GitHubie. Bez nich profil w launcherze nie zadziała (granie działa normalnie).

## 1. Wklej bazę danych

1. Otwórz https://supabase.com/dashboard i wejdź w projekt `mib-client`.
2. Po lewej kliknij **SQL Editor**, potem **New query**.
3. Otwórz plik [`schema.sql`](schema.sql), skopiuj **całą** zawartość i wklej w okno zapytania.
4. Kliknij **Run**. Na dole powinno pojawić się „Success. No rows returned”.

Ten krok możesz powtarzać przy kolejnych aktualizacjach. Nie usuwa danych graczy.

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

## Gdy nie da się założyć profilu albo zalogować

Launcher pokazuje wtedy, co jest nie tak. Najczęstsze sytuacje:

| Komunikat w launcherze | Co zrobić |
|---|---|
| „Serwer MiB wymaga potwierdzenia e-maila…” | Wyłącz **Confirm email** (krok 2). Konta założone, gdy było włączone, są „niepotwierdzone” i nie da się na nie zalogować: usuń je w **Authentication → Users** i załóż profil jeszcze raz. |
| „Konto istnieje, ale w bazie nie ma profilu…” | Nie uruchomiono `schema.sql` (krok 1). Uruchom go, usuń to konto w **Authentication → Users** i załóż profil jeszcze raz. |
| „Na ten e-mail jest już założony profil…” | Konto z tym e-mailem już istnieje (np. z wcześniejszej próby). Zaloguj się albo usuń je w **Authentication → Users**. |
| „Ten nick jest już zajęty albo niedozwolony…” | Nick zajęty, ma złe znaki albo nie uruchomiono `schema.sql`. |
| „Coś poszło nie tak… (kod: treść)” | Zrób zrzut ekranu — w nawiasie jest odpowiedź serwera. |

## Dodawanie kosmetyków

**Table Editor** → tabela `cosmetics` → **Insert** → **Insert row**:

| Pole | Przykład | Znaczenie |
|---|---|---|
| `id` | `cape_start` | stały identyfikator, bez spacji |
| `name` | `Peleryna Start` | nazwa widoczna w launcherze |
| `type` | `cape` | rodzaj: `cape`, `hat`, `wings` |
| `image_url` | puste albo link do obrazka | obrazek przedmiotu |

Albo w **SQL Editor**:

```sql
insert into public.cosmetics (id, name, type) values ('cape_start', 'Peleryna Start', 'cape');
```

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
