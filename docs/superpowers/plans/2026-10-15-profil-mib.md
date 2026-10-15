# Profil MiB i animacje — plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Profil MiB (e-mail + hasło, unikalne ID, kosmetyki, kody prezentowe, Założyciel, synchronizacja ustawień, kopia modów, statystyki, kod odzyskiwania) w Supabase oraz 6 animacji, jako wersja 0.8.0.

**Architecture:** Launcher rozmawia z Supabase wyłącznie z procesu głównego przez cienki klient REST na `fetch` (`lib/supa.js`) — bez `@supabase/supabase-js`, bo jego aktualne wersje wymagają Node ≥ 22, a Electron 31 ma Node 20. Logika bez sieci (walidacja, formaty, łączenie ustawień, decyzje kopii modów) siedzi w `lib/profile.js`, ładowanym i przez `require`, i przez `<script>`. Bezpieczeństwo zapewnia baza: RLS, uprawnienia kolumnowe i funkcje `security definer` w `supabase/schema.sql`.

**Tech Stack:** Electron 31 (Node 20), czysty HTML/JS, `node --test` (bez nowych zależności), Supabase (PostgREST + GoTrue + pgcrypto), Postgres lokalnie tylko do testu SQL, Playwright (`_electron`) do zrzutów.

**Spec:** `docs/superpowers/specs/2026-10-15-profil-mib-design.md`

## Global Constraints

- Supabase: `https://pijyremkmhmnyvjusrhu.supabase.co`, klucz publiczny `sb_publishable_-Gfr_STF_qinPsxzdYFaDg_eXg4j1Al`; w kodzie żadnego klucza `service_role`/`secret`. Adres nadpisywalny zmienną `MIB_SUPA_URL` (tylko do testów).
- Launcher działa w pełni bez profilu i bez internetu; żaden błąd Supabase nie blokuje GRAJ ani startu.
- Hasło nigdy nie trafia na dysk; na dysku tylko refresh token zaszyfrowany `safeStorage` (bez szyfrowania — nie zapisujemy).
- Nick: 3–16 znaków `[A-Za-z0-9_]`, unikalny bez względu na wielkość liter. Hasło: min. 8 znaków.
- ID: `MIB-` + numer dopełniony zerami do 6 cyfr (dłuższy, gdy trzeba). Założyciel: numer ≤ 1000.
- Kod odzyskiwania: 16 znaków alfabetu Crockford base32 (`0123456789ABCDEFGHJKMNPQRSTVWXYZ`) w 4 grupach po 4 z `-`; w bazie tylko bcrypt; blokada 15 min po 5 błędach dla e-maila.
- Sesja gry przycinana do 1440 minut.
- Każdy nowy napis UI po polsku + wpis w słowniku `EN` w `ui.js`. Wygląd: tokeny i `--px` z `style.css`, Pixelify tylko w nagłówkach/GRAJ, `font-weight:400`.
- Animacje ≤ ~400 ms (poza splashem), wyłączane przez `prefers-reduced-motion` i ustawienie „Animacja startowa: Wyłączona”.
- Wersja wydania: `0.8.0`.

## Review Focus

1. **Brak internetu / Supabase nie odpowiada przy starcie** — launcher startuje, GRAJ działa, strona Profil pokazuje „Brak połączenia z serwerem MiB” zamiast się wieszać; lokalne ustawienia nietknięte. Test: Task 4 `prof:state offline`.
2. **Unieważniony refresh token** (np. reset hasła na innym komputerze) — launcher czyści sesję z dysku i pokazuje stan „niezalogowany”, bez pętli błędów. Test: Task 4 `refresh 400 clears session`.
3. **Zły nick lub zajęty e-mail/nick** — polskie litery, spacja, 17 znaków, `Gracz` vs `gracz`, e-mail już w bazie → konkretny komunikat przed/po wysłaniu, nie „Database error”. Testy: Task 1 `validateNick`, Task 2 SQL duplikaty, Task 3 mapowanie błędów.
4. **Gra zamknięta bez internetu** — sesja trafia do kolejki i jest wysłana później dokładnie raz. Test: Task 4 `stats queue flush once`.
5. **Przywracanie modów przy istniejącym pliku albo zerwanym połączeniu z Modrinth** — nic nie jest usuwane, wynik mówi ile pobrano/pominięto. Test: Task 5 `restore keeps existing and reports failures`.

---

### Task 1: Logika profilu bez sieci + uruchamianie testów

**Files:**
- Create: `lib/profile.js`
- Create: `test/profile.test.js`
- Modify: `package.json` (skrypt `test`, `lib/**` w `build.files`)

**Interfaces:**
- Produces (`lib/profile.js`, eksport CommonJS i `window.MibProfile` — wzorzec UMD):
  - `validateNick(nick: string): null | 'nick_length' | 'nick_chars'`
  - `formatMibId(num: number): string`
  - `newRecoveryCode(randomBytes: (n:number)=>Uint8Array): string`
  - `normalizeRecoveryCode(input: string): string` — wielkie litery, bez spacji i `-`, `O→0`, `I/L→1`
  - `SYNCED_KEYS: string[]` = `['ram','width','height','jvm','priority','hideUpdates','lang','bg','anim','fx']`
  - `pickSynced(obj: object): object` — tylko `SYNCED_KEYS`; `bg:'custom'` pomijane
  - `mergeSettings(localAt: number|null, remote: {settings:object, updatedAt:number}|null): 'apply'|'push'|'none'`
  - `clampSessionMinutes(ms: number): number` — zaokrąglenie do minut, 0…1440
  - `favouriteVersion(versionStats: {[gv:string]:{min:number,runs:number}}): string|null`
  - `formatPlaytime(min: number): string` — `"0 min"`, `"45 min"`, `"3 h 05 min"`
  - `backupDecision(s: {hasRemote:boolean, reviewed:boolean}): 'push'|'hold'`

- [ ] **Step 1: Napisz testy** (`test/profile.test.js`, `node:test` + `node:assert/strict`):
  - `validateNick`: `'ab'`→`'nick_length'`, `'a'.repeat(17)`→`'nick_length'`, `'Łukasz'`→`'nick_chars'`, `'gra cz'`→`'nick_chars'`, `'Gracz_01'`→`null`.
  - `formatMibId(127)`→`'MIB-000127'`, `formatMibId(1234567)`→`'MIB-1234567'`.
  - `newRecoveryCode(() => new Uint8Array(16))` pasuje do `/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/`; dwa wywołania z `crypto.randomBytes` są różne.
  - `normalizeRecoveryCode(' k7qm-2xpa 9tfd-w4hn ')`→`'K7QM2XPA9TFDW4HN'`, `normalizeRecoveryCode('OIL0')`→`'0110'`.
  - `pickSynced({ram:4096,root:'C:/x',bg:'custom',lang:'en'})` → `{ram:4096,lang:'en'}`.
  - `mergeSettings(null,{settings:{},updatedAt:5})`→`'apply'`; `mergeSettings(10,{…updatedAt:5})`→`'push'`; `mergeSettings(5,{…updatedAt:10})`→`'apply'`; `mergeSettings(5,null)`→`'push'`; `mergeSettings(null,null)`→`'push'`; równe znaczniki →`'none'`.
  - `clampSessionMinutes(-5)`→`0`, `(90_000)`→`2`, `(3*86400000)`→`1440`.
  - `favouriteVersion({'1.8.9':{min:30,runs:5},'1.21.1':{min:90,runs:1}})`→`'1.21.1'`; `{}`→`null`.
  - `formatPlaytime(0)`→`'0 min'`, `(185)`→`'3 h 05 min'`.
  - `backupDecision({hasRemote:true,reviewed:false})`→`'hold'`; pozostałe kombinacje →`'push'`.
- [ ] **Step 2:** `npm test` → FAIL (brak modułu).
- [ ] **Step 3:** Zaimplementuj `lib/profile.js`; `newRecoveryCode` bierze `randomBytes(16)` i mapuje każdy bajt `& 31` na alfabet. Dodaj do `package.json` `"test": "node --test test/"` i `"lib/**"` do `build.files`.
- [ ] **Step 4:** `npm test` → wszystkie PASS.
- [ ] **Step 5:** Commit `Profil: logika bez sieci i testy`.

### Task 2: Schemat bazy Supabase + test SQL na lokalnym Postgresie

**Files:**
- Create: `supabase/schema.sql`
- Create: `test/sql/stub-auth.sql` (atrapa `auth.users`, `auth.sessions`, `auth.uid()`, ról `anon`/`authenticated`, schematu `extensions` z `pgcrypto`)
- Create: `test/sql/schema.test.sql`, `test/sql/run.sh`

**Interfaces:**
- Produces (PostgREST, schemat `public`):
  - tabela `profiles(id uuid pk → auth.users on delete cascade, num bigint identity unique, nick text, founder bool, created_at timestamptz, settings jsonb, settings_updated_at bigint, playtime_min int default 0, launches int default 0, version_stats jsonb default '{}')`; unikalny indeks `lower(nick)`. RLS: `select` własnego wiersza; `update` tylko kolumn `settings, settings_updated_at` (uprawnienia kolumnowe dla `authenticated`).
  - `cosmetics(id text pk, name text, type text, image_url text)` — `select` dla `anon, authenticated`.
  - `owned_cosmetics(user_id, cosmetic_id, source text, acquired_at, pk(user_id,cosmetic_id))` — `select` własnych; brak insert/update/delete.
  - `mod_backups(user_id, game_version text, loader text, mods jsonb, skipped int, updated_at, pk(user_id,game_version))` — pełny CRUD własnych.
  - schemat `private` (niewystawiony): `recovery(user_id pk, hash)`, `reset_attempts(email pk, fails, locked_until)`, `gift_codes(code pk, cosmetic_id, max_uses default 1, used_count default 0, expires_at)`, `redemptions(code, user_id, pk(code,user_id))`.
  - trigger na `auth.users` insert: tworzy profil z `raw_user_meta_data->>'nick'`, `founder = num <= 1000`; zły/zajęty nick → `raise exception` (rejestracja się nie udaje).
  - RPC (wszystkie `security definer`, `set search_path = ''`):
    - `nick_available(p_nick text) returns boolean` — `anon, authenticated`
    - `redeem_code(p_code text) returns json {cosmetic_id, name}` — błędy `code_invalid|code_expired|code_used_up|code_already_used|already_owned` (jako `message` wyjątku)
    - `set_recovery_code(p_code text) returns void` — zapisuje `extensions.crypt(normalized, gen_salt('bf'))`
    - `reset_password_with_code(p_email text, p_code text, p_new_password text) returns boolean` — `anon`; błąd zawsze `reset_failed` lub `reset_locked`; sukces: nowy hash w `auth.users.encrypted_password`, usunięte `auth.sessions` gracza, usunięty wiersz `private.recovery`, wyzerowane próby
    - `add_play_session(p_version text, p_minutes int) returns void` — minuty przycięte 0…1440, `launches+1`, `version_stats[p_version].min/runs`
    - `delete_my_profile() returns void` — `delete from auth.users where id = auth.uid()`
  - Plik idempotentny (`create … if not exists`, `create or replace`), gotowy do wklejenia w SQL Editor.

- [ ] **Step 1:** Zainstaluj Postgres (`apt-get install -y postgresql`) i napisz `test/sql/run.sh`: tworzy bazę tymczasową, ładuje `stub-auth.sql`, dwa razy `schema.sql` (idempotencja), potem `schema.test.sql` z `ON_ERROR_STOP=1`.
- [ ] **Step 2:** Napisz `schema.test.sql` (bloki `DO $$ … $$` z `assert`/`raise`, `set role` + `set request.jwt.claim.sub` dla `auth.uid()`):
  - insert do `auth.users` z nickiem `Gracz_1` → profil `num=1`, `founder=true`;
  - `GRACZ_1` drugi raz → wyjątek; nick `Łukasz` → wyjątek; `nick_available('gracz_1')` = false;
  - jako `authenticated`: `update profiles set num=5` → błąd uprawnień; `update … set settings` → OK; select cudzego profilu → 0 wierszy;
  - kod `TEST` (max_uses 1): pierwszy `redeem_code` → zwraca kosmetyk, drugi gracz → `code_used_up`; ten sam gracz z kodem na 5 użyć drugi raz → `code_already_used`; kod z `expires_at` w przeszłości → `code_expired`;
  - `set_recovery_code('K7QM-2XPA-9TFD-W4HN')`, potem jako `anon` `reset_password_with_code(email,'k7qm2xpa9tfdw4hn','nowehaslo1')` → true i hash w `auth.users` się zmienił, sesje gracza usunięte; ponowne użycie kodu → `reset_failed`; 5 złych prób → szósta `reset_locked`;
  - `add_play_session('1.8.9', 5000)` → `playtime_min` +1440, `launches` +1;
  - `delete_my_profile()` → brak wiersza w `auth.users` i `profiles`.
- [ ] **Step 3:** `bash test/sql/run.sh` → FAIL (brak `schema.sql`).
- [ ] **Step 4:** Napisz `supabase/schema.sql`.
- [ ] **Step 5:** `bash test/sql/run.sh` → kończy się `ALL SQL TESTS PASSED`.
- [ ] **Step 6:** Commit `Profil: schemat bazy Supabase z testami`.

### Task 3: Cienki klient Supabase

**Files:**
- Create: `lib/supa.js`, `test/supa.test.js`

**Interfaces:**
- Produces: `createSupa({url, key, fetch}) → { signUp(email, password, nick), signIn(email, password), refresh(refreshToken), signOut(accessToken), rpc(name, args, accessToken?), select(table, query, accessToken), upsert(table, row, accessToken) }`
  - `signUp/signIn/refresh` → `{ accessToken, refreshToken, expiresAt /*ms*/, userId }`
  - Błędy: rzuca `SupaError {status, code, message}`; `code` znormalizowane: GoTrue `user_already_exists`/`email_exists`→`email_taken`, `invalid_credentials`/`invalid_grant`→`bad_login`, `weak_password`→`weak_password`, wyjątek z triggera przy rejestracji→`nick_rejected`, wyjątek RPC → jego `message` (np. `code_used_up`), brak sieci→`offline`.
  - Nagłówki: `apikey: key` zawsze; `Authorization: Bearer <accessToken>` gdy podany. Endpointy: `/auth/v1/signup` (body `{email,password,data:{nick}}`), `/auth/v1/token?grant_type=password|refresh_token`, `/auth/v1/logout`, `/rest/v1/rpc/<name>`, `/rest/v1/<table>?<query>`, upsert z `Prefer: resolution=merge-duplicates`.

- [ ] **Step 1:** Testy z atrapą `fetch` (zapisuje żądania, zwraca zaprogramowane odpowiedzi): poprawny URL/metoda/nagłówki dla każdej metody; `signIn` mapuje odpowiedź na `{accessToken, refreshToken, expiresAt, userId}`; 422 `{error_code:'user_already_exists'}` → `email_taken`; 400 `{error_code:'invalid_credentials'}` → `bad_login`; 500 `Database error saving new user` przy signup → `nick_rejected`; RPC 400 `{message:'code_used_up'}` → `code==='code_used_up'`; `fetch` rzuca `TypeError` → `offline`.
- [ ] **Step 2:** `npm test` → FAIL. **Step 3:** Implementacja. **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `Profil: klient REST Supabase`.

### Task 4: Profil w procesie głównym (sesja, konto, kosmetyki, ustawienia, statystyki)

**Files:**
- Create: `profile-main.js`, `test/profile-main.test.js`
- Modify: `main.js` (require + `register`, haki w `doLaunch` na `spawned`/`close`), `package.json` (`profile-main.js` w `build.files`)

**Interfaces:**
- Consumes: `createSupa` (Task 3), `normalizeRecoveryCode`, `newRecoveryCode`, `clampSessionMinutes`, `formatMibId` (Task 1).
- Produces:
  - `createProfile({supa, store, safeStorage, randomBytes, now}) → api` — testowalne bez Electrona; `store` = `{read(file, def), write(file, val), remove(file)}`.
  - `register(ipcMain, api)` w `profile-main.js` rejestruje kanały IPC (wszystkie zwracają obiekt, nigdy nie rzucają; błąd = `{error: code}`):
    - `prof:state` → `{loggedIn:false} | {loggedIn:true, nick, mibId, founder, createdAt, playtimeMin, launches, versionStats} | {offline:true}`
    - `prof:signup {email,password,nick}` → stan + `recoveryCode`
    - `prof:login {email,password}`, `prof:logout`, `prof:newCode` → `{recoveryCode}`, `prof:reset {email,code,password}` → stan + nowy `recoveryCode`, `prof:delete`
    - `prof:nickFree {nick}` → `{free:boolean}`
    - `prof:cosmetics` → `[{id,name,type,imageUrl,acquiredAt,source}]`, `prof:redeem {code}` → `{id,name,type,imageUrl}`
    - `prof:pullSettings` → `{settings, updatedAt} | null`, `prof:pushSettings {settings, updatedAt}`
  - `api.gameStarted(version)`, `api.gameClosed()` — wołane z `doLaunch`.
  - Pliki w `userData`: `mib-session.json` (`{t: base64 safeStorage(refreshToken)}`), `mib-stats-queue.json` (`[{v, min, id}]`).
  - Token: odświeżanie, gdy do `expiresAt` zostało < 60 s; 400/401 z refresh → usuń `mib-session.json`, stan niezalogowany.

- [ ] **Step 1:** Testy (atrapy: `supa`, `store` w pamięci, `safeStorage` z `encryptString = s => Buffer.from('x'+s)`):
  - `signup` zapisuje zaszyfrowany refresh token, woła `set_recovery_code` z kodem zwróconym w wyniku; hasło nie występuje w żadnym zapisie `store` (sprawdź `JSON.stringify` wszystkich zapisów).
  - **offline:** `supa.refresh` rzuca `offline` → `prof:state` zwraca `{offline:true}` i nie usuwa sesji.
  - **refresh 400 clears session:** `refresh` rzuca `bad_login` → `prof:state` = `{loggedIn:false}`, `store.remove('mib-session.json')` wywołane.
  - **stats queue flush once:** `gameStarted('1.8.9')`, `now` +30 min, `gameClosed()` przy `rpc` rzucającym `offline` → kolejka ma 1 wpis; kolejne `prof:state` z działającym `rpc` → `add_play_session('1.8.9',30)` wywołane dokładnie raz i kolejka pusta; drugie `prof:state` nie woła ponownie.
  - `safeStorage.isEncryptionAvailable()` false → po `login` nic nie zapisane na dysk.
  - `prof:redeem {code:' start '}` woła `rpc('redeem_code', {p_code:'START'})` i mapuje wynik `{cosmetic_id, name}` + wiersz z `cosmetics` na `{id, name, type, imageUrl}`.
- [ ] **Step 2:** `npm test` → FAIL. **Step 3:** Implementacja + podpięcie w `main.js` (`gameStarted` przy `m.t==='spawned'`, `gameClosed` przy `m.t==='close'`). **Step 4:** `npm test` → PASS; `node --check main.js profile-main.js`.
- [ ] **Step 5:** Commit `Profil: konto, kosmetyki, ustawienia i statystyki w procesie głównym`.

### Task 5: Kopia modów na profilu

**Files:**
- Modify: `profile-main.js`, `main.js` (wywołanie `api.modsChanged(gv)` po `hub:install`, `mods:toggle`, `mods:delete`, `mods:update`), `test/profile-main.test.js`

**Interfaces:**
- Consumes: `backupDecision` (Task 1), `select/upsert` (Task 3), z `main.js`: `modsDir(gv)`, `instGet/instSet`, `getFile(v, dest, done)`, `mr(path)` przekazane do `createProfile` jako `mods: {dir, instGet, instSet, getFile, mr, identify}`; `identify(hashes:string[]) → {[sha1]: {project_id, id}}` (POST `https://api.modrinth.com/v2/version_files`, `algorithm:'sha1'`).
- Produces:
  - `api.modsChanged(gv)` — gdy zalogowany i `backupDecision` = `'push'`: upsert `mod_backups` `{game_version, loader, mods:[{project, version, file, on}], skipped}`.
  - IPC `prof:modInfo {gv}` → `null | {count, skipped, reviewed}`; `prof:modRestore {gv}` → `{added, skipped, failed, error?}`; `prof:modReplace {gv}` → `{ok:true}`.
  - Stan „przejrzane” w `mib-mod-review.json` (`{[gv]: true}`).

- [ ] **Step 1:** Testy: `modsChanged` przy zdalnej kopii i `reviewed=false` nie woła `upsert`; po `prof:modReplace` woła; pliki nierozpoznane przez `identify` liczone w `skipped`; **restore keeps existing and reports failures:** kopia z 3 modami, jeden plik już jest w katalogu, `getFile` dla drugiego rzuca → wynik `{added:1, skipped:1, failed:1}`, żaden plik nie został usunięty, mod z `on:false` zapisany jako `.jar.disabled`; loader z kopii różny od `instGet(gv).loader` → `{error:'loader_mismatch'}` i brak pobierania.
- [ ] **Step 2:** FAIL. **Step 3:** Implementacja. **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `Profil: kopia modów`.

### Task 6: Interfejs profilu, kosmetyków, synchronizacji i prywatności

**Files:**
- Create: `profile-ui.js`, `test/fake-supabase.js` (serwer HTTP w pamięci z endpointami z Task 3), `test/e2e/profile.e2e.js` (Playwright `_electron`, `MIB_SUPA_URL` → atrapa)
- Modify: `index.html` (strona `#p-prof`, nav `data-p="prof"`, dolny blok paska, okno `#rc` z kodem odzyskiwania, strona `#p-cos`, przyciski kopii modów na `#p-mods`, `<script src="lib/profile.js">` i `profile-ui.js`), `style.css`, `ui.js` (synchronizacja ustawień, `LEGAL` PL/EN, słownik `EN`), `package.json` (`profile-ui.js` w `build.files`)

**Interfaces:**
- Consumes: kanały IPC z Task 4–5, `MibProfile.*` z Task 1.
- Produces: `window.mibSync = { push(), pull() }` w `ui.js` — `push` buduje `pickSynced({...S, lang, bg, anim, fx})`, zapisuje `localStorage.mibSetAt = Date.now()` i woła `prof:pushSettings`; wołane po „Zapisz” i po zmianie języka/tła/animacji/cząsteczek. `pull` po zalogowaniu i przy starcie: `mergeSettings(+localStorage.mibSetAt||null, remote)` → `'apply'` zapisuje do `settings:set` i `localStorage`, potem `setLang`, `applyBg`, `fill()`; `'push'` → `push()`.
- Kopia na stronie: tekst `LEGAL[3]` (PL) zastąpić: „<b>Bez profilu MiB</b> launcher nie wysyła Twoich danych na własny serwer i nie zbiera statystyk. Raport błędu tworzysz sam; tokeny i hasła są z niego usuwane.” i dodać `LEGAL[4]`: „<b>Profil MiB</b> jest dobrowolny. Po jego założeniu na serwerze MiB (Supabase, UE – Frankfurt) zapisujemy: e-mail, nick, ID, kosmetyki, ustawienia launchera, listę modów z Modrinth i czas gry. Hasło jest przechowywane wyłącznie w postaci zaszyfrowanej. Profil możesz w każdej chwili usunąć razem z danymi (Profil → Usuń profil).” plus odpowiedniki EN.

- [ ] **Step 1:** Napisz `test/fake-supabase.js` i scenariusz e2e: (a) start bez profilu → dolny blok „Załóż profil MiB”, zrzut `prof-out.png`; (b) rejestracja `Tester_1` → okno kodu odzyskiwania, przycisk „Zamknij” nieaktywny do zaznaczenia „Zapisałem kod”, zrzut `prof-code.png`; (c) strona Profil pokazuje `MIB-000001` i „Założyciel”, zrzut `prof-in.png`; (d) Kosmetyki: kod `START` → efekt odblokowania i przedmiot na liście, zrzut `cos.png`; (e) atrapa wyłączona → strona Profil „Brak połączenia z serwerem MiB”, GRAJ dalej aktywny; (f) nick `Łukasz` → komunikat o dozwolonych znakach bez wysyłania żądania (atrapa nie dostała `signup`).
- [ ] **Step 2:** `node test/e2e/profile.e2e.js` → FAIL. **Step 3:** Implementacja UI (frontend-design: istniejące tokeny, `.sec/.sr/.ck`, `.card`, `.tag` dla Założyciela; teksty i błędy po polsku, konkretne). **Step 4:** e2e PASS + obejrzyj zrzuty (bez nachodzących elementów, polskie znaki, pikselowe ramki); `npm test` PASS.
- [ ] **Step 5:** Commit `Profil: interfejs, kosmetyki, synchronizacja ustawień, prywatność`.

### Task 7: Animacje

**Files:**
- Modify: `index.html` (skrypt splasha), `style.css`, `ui.js`, `profile-ui.js`
- Test: `test/e2e/anim.e2e.js`

**Interfaces:**
- Produces: klasa `noanim` na `<html>`, gdy `localStorage.mibanim==='off'` albo `matchMedia('(prefers-reduced-motion: reduce)').matches`; CSS `.noanim *{animation:none!important;transition:none!important}`.
- Szczegóły:
  1. Splash → launcher: klon SVG logo z `.brand` startuje na środku splasha (szer. 200 px) i w 500 ms (`cubic-bezier(.2,.8,.2,1)`) przelatuje (FLIP, `getBoundingClientRect`) na pozycję `.brand svg`; potem znika, a `#app` się pojawia. Tryb „Krótka” = 250 ms.
  2. Menu: jeden element `#navind` (4 px, ametyst) przesuwany `transform: translateY` do aktywnego `.nav` (180 ms); `.nav.act::before` usunięte. `.page.on` animacja wejścia 160 ms (`opacity 0→1`, `translateY(6px)→0`).
  3. GRAJ: na zdarzenie `progress` przycisk `.go` dostaje `--fill: <p>%` (zaokrąglone w dół do 5%) i tło wypełniane od lewej; pod napisem „Pobieranie <p>%”; `#prog` ukryty. Po `closed`/`started` reset.
  4. Postać 3D: po `setAcc` i po zalogowaniu do profilu `viewer.animation = new skinview3d.WaveAnimation()` na 2,5 s, potem `IdleAnimation`; `mouseenter` na `#skincv` → `WalkingAnimation`, `mouseleave` → `IdleAnimation`.
  5. Okienka: `.ov.on .m, #upd.on .m` — `@keyframes` 240 ms `steps(4)` od `scale(.9)`/`opacity:0`.
  6. Odblokowanie: nakładka `#unlock` z błyskiem ametystu (pierścień skalowany 0→1,6 w 400 ms), ikoną i nazwą; znika po 2,2 s lub kliknięciu.

- [ ] **Step 1:** `anim.e2e.js`: po starcie `.brand svg` widoczne i klon logo usunięty z DOM; klik w „Ustawienia” → `#navind` ma `transform` z `translateY` równym `offsetTop` aktywnej pozycji (±2 px); wysłanie `progress 45` (przez `webContents.send` w `app.evaluate`) → `.go` ma `--fill: 45%` i tekst „Pobieranie 45%”; z `mibanim='off'` na `<html>` jest `noanim`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementacja. **Step 4:** PASS + klatki zrzutów splasha (co 100 ms) obejrzane. `npm test` PASS.
- [ ] **Step 5:** Commit `Animacje launchera`.

### Task 8: Instrukcja Supabase, wersja 0.8.0 i wydanie

**Files:**
- Create: `supabase/README.md` (po polsku, krok po kroku: SQL Editor → wklej `schema.sql` → Run; Authentication → Sign In / Providers → Email: wyłącz „Confirm email”, min. długość hasła 8; jak dodać kosmetyk w Table Editor; jak utworzyć kod prezentowy w `private.gift_codes` przez SQL; jak sprawdzić reset hasła na koncie testowym; „przed startem”: usunięcie testowych profili i `alter sequence … restart with 1`)
- Modify: `CLAUDE.md` (sekcja o profilu: gdzie co jest, `npm test`, `bash test/sql/run.sh`), `package.json` (`"version": "0.8.0"`)

- [ ] **Step 1:** Napisz README; każdy krok sprawdzony z tym, co robi `schema.sql` (nazwy tabel/funkcji zgodne).
- [ ] **Step 2:** `npm test` PASS, `bash test/sql/run.sh` PASS, oba e2e PASS, lokalny build `npx electron-builder --win nsis --x64 --publish never` kończy się bez błędu, a `app.asar` zawiera `lib/profile.js`, `lib/supa.js`, `profile-main.js`, `profile-ui.js`.
- [ ] **Step 3:** Recenzja całej gałęzi (superpowers:requesting-code-review), poprawki.
- [ ] **Step 4:** Commit `Wersja 0.8.0: profil MiB i animacje`, push na `main` → workflow tworzy szkic `v0.8.0`. Właściciel publikuje dopiero po wykonaniu `supabase/README.md`.
