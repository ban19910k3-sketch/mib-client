# Profil MiB — ustawienie Supabase

Instrukcja dla właściciela projektu Supabase `mib-client` (`https://pijyremkmhmnyvjusrhu.supabase.co`).
Zrób kroki 1–3 **przed** opublikowaniem wersji 0.8.0 na GitHubie. Bez nich profil w launcherze nie zadziała (granie działa normalnie).

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

1. Uruchom launcher 0.8.0 (szkic wydania na GitHubie albo z kodu) i wejdź w **Profil MiB**.
2. Załóż profil testowy, zapisz kod odzyskiwania, kliknij **Gotowe**.
3. Kliknij **Wyloguj**, potem **Zaloguj się** → **Nie pamiętam hasła**, wpisz e-mail, kod i nowe hasło. Launcher powinien Cię zalogować i pokazać nowy kod.
4. W Supabase: **Table Editor** → `profiles` — powinien być Twój profil z `num = 1`.

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

Kody wpisuj **wielkimi literami** — launcher sam zamienia to, co wpisze gracz, na wielkie litery.

## Przed startem dla graczy

Jeśli w bazie są profile testowe, usuń je, żeby gracze dostali numery od `MIB-000001` i miejsca Założyciela:

1. **Authentication** → **Users** → zaznacz testowe konta → **Delete users** (profile znikną razem z nimi).
2. **SQL Editor**:

```sql
alter table public.profiles alter column num restart with 1;
```

## Dobrze wiedzieć

- Klucz `sb_publishable_…` w launcherze jest publiczny i to jest w porządku. **Nigdy** nie wklejaj do launchera ani nikomu nie wysyłaj klucza `service_role` / `secret` ani hasła do bazy.
- Gracz, który zgubi i hasło, i kod odzyskiwania, nie odzyska profilu sam. Możesz wtedy usunąć jego konto w **Authentication → Users**, żeby mógł założyć nowe.
- Darmowy plan Supabase usypia projekt po tygodniu bez żadnego ruchu. Wtedy w panelu kliknij **Restore project**.
