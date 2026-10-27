-- MiB Client — baza profili MiB dla Supabase.
-- Wklej całość w Supabase → SQL Editor → Run. Można uruchamiać wielokrotnie (nie kasuje danych).

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public;

-- ===== Profile =====
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  num bigint generated always as identity unique,
  nick text not null,
  founder boolean not null default false,
  created_at timestamptz not null default now(),
  settings jsonb check (settings is null or pg_column_size(settings) < 8192),
  settings_updated_at bigint,
  playtime_min integer not null default 0,
  launches integer not null default 0,
  version_stats jsonb not null default '{}'::jsonb
);
create unique index if not exists profiles_nick_lower on public.profiles (lower(nick));
alter table public.profiles add column if not exists last_played_at timestamptz;
-- Moderacja (od 0.20.0): ostrzeżenia od admina; czwarte (albo decyzja admina) to ban konta MiB
alter table public.profiles add column if not exists warnings integer not null default 0;
alter table public.profiles add column if not exists banned_at timestamptz;
alter table public.profiles add column if not exists ban_reason text;
-- MiB Coins (od 0.23.0): zmienia je tylko baza (admin_give_coins), gracz może je tylko odczytać
alter table public.profiles add column if not exists coins integer not null default 0;
do $$ begin
  alter table public.profiles add constraint profiles_coins_not_negative check (coins >= 0);
exception when duplicate_object then null;
end $$;
alter table public.profiles enable row level security;
revoke all on public.profiles from public, anon, authenticated;
revoke all on sequence public.profiles_num_seq from public, anon, authenticated;
grant select on public.profiles to authenticated;
grant update (settings, settings_updated_at) on public.profiles to authenticated;
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated using (id = (select auth.uid()));
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Tworzenie profilu: sprawdza nick, nadaje numer i odznakę Założyciela
create or replace function private.make_profile(p_uid uuid, p_nick text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_num bigint;
begin
  if p_nick is null or p_nick !~ '^[A-Za-z0-9_]{3,16}$' then
    raise exception 'nick_invalid';
  end if;
  if exists (select 1 from public.profiles where lower(nick) = lower(p_nick)) then
    raise exception 'nick_taken';
  end if;
  insert into public.profiles (id, nick) values (p_uid, p_nick) returning num into v_num;
  update public.profiles set founder = (v_num <= 1000) where id = p_uid;
end $$;

-- Profil powstaje razem z kontem; nick przychodzi w danych rejestracji
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.make_profile(new.id, new.raw_user_meta_data ->> 'nick');
  return new;
end $$;

-- Dla kont bez profilu (np. założonych, zanim uruchomiono ten plik): gracz sam dokańcza profil
create or replace function public.create_my_profile(p_nick text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_logged_in'; end if;
  if exists (select 1 from public.profiles where id = auth.uid()) then raise exception 'profile_exists'; end if;
  perform private.make_profile(auth.uid(), p_nick);
end $$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.nick_available(p_nick text) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.profiles where lower(nick) = lower(p_nick));
$$;

-- ===== Kosmetyki =====
create table if not exists public.cosmetics (
  id text primary key,
  name text not null,
  type text not null default 'cape',
  image_url text,
  created_at timestamptz not null default now()
);
alter table public.cosmetics add column if not exists texture text check (texture is null or (texture like 'data:image/png;base64,%' and length(texture) < 200000));
alter table public.cosmetics enable row level security;
revoke all on public.cosmetics from public, anon, authenticated;
grant select on public.cosmetics to anon, authenticated;
drop policy if exists cosmetics_read on public.cosmetics;
create policy cosmetics_read on public.cosmetics for select to anon, authenticated using (true);

create table if not exists public.owned_cosmetics (
  user_id uuid not null references public.profiles (id) on delete cascade,
  cosmetic_id text not null references public.cosmetics (id),
  source text not null default 'code',
  acquired_at timestamptz not null default now(),
  primary key (user_id, cosmetic_id)
);
alter table public.owned_cosmetics enable row level security;
revoke all on public.owned_cosmetics from public, anon, authenticated;
grant select on public.owned_cosmetics to authenticated;
drop policy if exists owned_read_own on public.owned_cosmetics;
create policy owned_read_own on public.owned_cosmetics for select to authenticated using (user_id = (select auth.uid()));

create table if not exists private.gift_codes (
  code text primary key check (code = upper(code)),
  cosmetic_id text not null references public.cosmetics (id),
  max_uses integer not null default 1,
  used_count integer not null default 0,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists private.redemptions (
  code text not null references private.gift_codes (code) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  primary key (code, user_id)
);

create or replace function public.redeem_code(p_code text) returns json
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  g private.gift_codes;
  c public.cosmetics;
begin
  if v_uid is null then raise exception 'not_logged_in'; end if;
  select * into g from private.gift_codes where code = upper(trim(p_code)) for update;
  if not found then raise exception 'code_invalid'; end if;
  if g.expires_at is not null and g.expires_at < now() then raise exception 'code_expired'; end if;
  if exists (select 1 from private.redemptions where code = g.code and user_id = v_uid) then raise exception 'code_already_used'; end if;
  if g.used_count >= g.max_uses then raise exception 'code_used_up'; end if;
  if exists (select 1 from public.owned_cosmetics where user_id = v_uid and cosmetic_id = g.cosmetic_id) then raise exception 'already_owned'; end if;
  insert into private.redemptions (code, user_id) values (g.code, v_uid);
  update private.gift_codes set used_count = used_count + 1 where code = g.code;
  insert into public.owned_cosmetics (user_id, cosmetic_id, source) values (v_uid, g.cosmetic_id, 'code');
  select * into c from public.cosmetics where id = g.cosmetic_id;
  return json_build_object('cosmetic_id', c.id, 'name', c.name, 'type', c.type, 'image_url', coalesce(c.texture, c.image_url));
end $$;

-- ===== Kod odzyskiwania i reset hasła =====
create table if not exists private.recovery (
  user_id uuid primary key references auth.users (id) on delete cascade,
  hash text not null,
  created_at timestamptz not null default now()
);
create table if not exists private.reset_attempts (
  email text primary key,
  fails integer not null default 0,
  locked_until timestamptz,
  last_at timestamptz not null default now()
);
alter table private.reset_attempts add column if not exists last_at timestamptz not null default now();

-- Ta sama normalizacja co normalizeRecoveryCode w lib/profile.js
create or replace function private.norm_code(p text) returns text
language sql immutable set search_path = '' as $$
  select translate(regexp_replace(upper(coalesce(p, '')), '[[:space:]-]', '', 'g'), 'OIL', '011');
$$;

create or replace function public.set_recovery_code(p_code text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_norm text := private.norm_code(p_code);
begin
  if v_uid is null then raise exception 'not_logged_in'; end if;
  if length(v_norm) <> 16 then raise exception 'code_format'; end if;
  insert into private.recovery (user_id, hash) values (v_uid, extensions.crypt(v_norm, extensions.gen_salt('bf', 10)))
    on conflict (user_id) do update set hash = excluded.hash, created_at = now();
end $$;

-- Zwraca true po zmianie hasła, false przy złym e-mailu lub kodzie (próba jest liczona).
-- Po 5 błędach dla e-maila blokada na 15 minut (wyjątek reset_locked).
create or replace function public.reset_password_with_code(p_email text, p_code text, p_new_password text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_uid uuid;
  v_hash text;
  v_fails integer;
begin
  if length(coalesce(p_new_password, '')) < 8 then raise exception 'weak_password'; end if;
  if length(v_email) > 320 then return false; end if;
  delete from private.reset_attempts where last_at < now() - interval '7 days';
  if exists (select 1 from private.reset_attempts where email = v_email and locked_until > now()) then
    raise exception 'reset_locked';
  end if;
  select u.id, r.hash into v_uid, v_hash
    from auth.users u join private.recovery r on r.user_id = u.id
    where lower(u.email) = v_email;
  if v_hash is null or extensions.crypt(private.norm_code(p_code), v_hash) <> v_hash then
    -- licznik zeruje się po blokadzie albo po dobie bez prób
    insert into private.reset_attempts as a (email, fails, last_at) values (v_email, 1, now())
      on conflict (email) do update set
        fails = case when a.locked_until is not null or a.last_at < now() - interval '1 day' then 1 else a.fails + 1 end,
        locked_until = null, last_at = now()
      returning fails into v_fails;
    if v_fails >= 5 then
      update private.reset_attempts set fails = 0, locked_until = now() + interval '15 minutes' where email = v_email;
    end if;
    return false;
  end if;
  update auth.users set encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf', 10)), updated_at = now() where id = v_uid;
  delete from auth.sessions where user_id = v_uid;
  delete from private.recovery where user_id = v_uid;
  delete from private.reset_attempts where email = v_email;
  return true;
end $$;

-- ===== Statystyki =====
create or replace function public.add_play_session(p_version text, p_minutes integer) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_min integer := least(1440, greatest(0, coalesce(p_minutes, 0)));
  v_ver text := left(coalesce(nullif(p_version, ''), '?'), 32);
begin
  if v_uid is null then raise exception 'not_logged_in'; end if;
  update public.profiles set
    playtime_min = playtime_min + v_min,
    launches = launches + 1,
    last_played_at = now(),
    version_stats = jsonb_set(version_stats, array[v_ver], jsonb_build_object(
      'min', coalesce((version_stats -> v_ver ->> 'min')::integer, 0) + v_min,
      'runs', coalesce((version_stats -> v_ver ->> 'runs')::integer, 0) + 1))
  where id = v_uid;
end $$;

-- ===== Kopia modów =====
create table if not exists public.mod_backups (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  game_version text not null check (game_version ~ '^[0-9][0-9.]{0,15}$'),
  loader text check (loader is null or loader in ('fabric', 'forge')),
  mods jsonb not null default '[]'::jsonb check (jsonb_typeof(mods) = 'array' and jsonb_array_length(mods) <= 500 and pg_column_size(mods) < 131072),
  skipped integer not null default 0 check (skipped between 0 and 10000),
  updated_at timestamptz not null default now(),
  primary key (user_id, game_version)
);
alter table public.mod_backups enable row level security;
revoke all on public.mod_backups from public, anon, authenticated;
grant select, insert, update, delete on public.mod_backups to authenticated;
drop policy if exists mod_backups_own on public.mod_backups;
create policy mod_backups_own on public.mod_backups for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Najwyżej 50 kopii (wersji gry) na profil
create or replace function public.limit_mod_backups() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.mod_backups where user_id = new.user_id) >= 50 then raise exception 'too_many_backups'; end if;
  return new;
end $$;
revoke all on function public.limit_mod_backups() from public, anon, authenticated;
drop trigger if exists mod_backups_limit on public.mod_backups;
create trigger mod_backups_limit before insert on public.mod_backups for each row execute function public.limit_mod_backups();

-- ===== Usunięcie profilu (RODO) =====
create or replace function public.delete_my_profile() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_logged_in'; end if;
  -- konto admina usuwa się tylko ręcznie w Supabase, żeby nie stracić panelu przez przypadek
  if exists (select 1 from private.admins where user_id = auth.uid()) then raise exception 'admin_cannot_delete'; end if;
  delete from private.reset_attempts where email = (select lower(email) from auth.users where id = auth.uid());
  delete from auth.users where id = auth.uid();
end $$;

-- ===== Ogłoszenia =====
create table if not exists public.announcements (
  id bigint generated always as identity primary key,
  title text not null check (length(title) between 1 and 80),
  body text not null default '' check (length(body) <= 1000),
  pinned boolean not null default false,
  visible_until timestamptz,
  created_at timestamptz not null default now()
);
alter table public.announcements enable row level security;
revoke all on public.announcements from public, anon, authenticated;
grant select on public.announcements to anon, authenticated;
drop policy if exists announcements_read on public.announcements;
create policy announcements_read on public.announcements for select to anon, authenticated
  using (visible_until is null or visible_until > now());

-- ===== Pomysły graczy =====
-- Po usunięciu konta pomysł zostaje, ale bez autora (user_id = null)
create table if not exists public.ideas (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  category text not null check (category in ('feature', 'cosmetic', 'bug', 'other')),
  body text not null check (length(body) between 10 and 1000),
  status text not null default 'new' check (status in ('new', 'seen', 'planned', 'done', 'rejected')),
  created_at timestamptz not null default now()
);
create index if not exists ideas_user_created on public.ideas (user_id, created_at);
alter table public.ideas enable row level security;
revoke all on public.ideas from public, anon, authenticated;
grant select on public.ideas to authenticated;
drop policy if exists ideas_read_own on public.ideas;
create policy ideas_read_own on public.ideas for select to authenticated using (user_id = (select auth.uid()));
-- Od 0.19.0: odpowiedź twórcy dla autora, kiedy zmienił się status albo odpowiedź (updated_at), kiedy autor to zobaczył
-- (seen_at) i czy pomysł został nagrodzony prezentem
alter table public.ideas add column if not exists reply text check (reply is null or length(reply) <= 500);
alter table public.ideas add column if not exists updated_at timestamptz;
alter table public.ideas add column if not exists seen_at timestamptz;
alter table public.ideas add column if not exists rewarded boolean not null default false;

-- Założone kosmetyki (od 0.13.0): {"cape": "<id>"}; zmienia je tylko equip_cosmetic, który sprawdza, czy gracz ma ten przedmiot.
-- Od 0.22.0 także aura (efekt wokół postaci)
alter table public.profiles add column if not exists equipped jsonb not null default '{}'::jsonb;
create or replace function public.equip_cosmetic(p_type text, p_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v jsonb;
begin
  if v_uid is null then raise exception 'not_logged_in'; end if;
  if p_type is null or p_type not in ('cape', 'hat', 'wings', 'aura', 'mask') then raise exception 'cosmetic_type_invalid'; end if;
  if p_id is not null and not exists (
    select 1 from public.owned_cosmetics o join public.cosmetics c on c.id = o.cosmetic_id
    where o.user_id = v_uid and o.cosmetic_id = p_id and c.type = p_type) then
    raise exception 'not_owned';
  end if;
  update public.profiles
    set equipped = case when p_id is null then equipped - p_type else jsonb_set(equipped, array[p_type], to_jsonb(p_id)) end
    where id = v_uid returning equipped into v;
  if v is null then raise exception 'no_profile'; end if;
  return v;
end $$;

-- Wysłać pomysł może tylko gracz z profilem, najwyżej 5 na dobę
create or replace function public.submit_idea(p_category text, p_body text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v bigint;
begin
  if v_uid is null then raise exception 'not_logged_in'; end if;
  -- blokada wiersza profilu: równoległe wysyłki tego samego gracza nie ominą limitu
  perform 1 from public.profiles where id = v_uid for update;
  if not found then raise exception 'no_profile'; end if;
  if private.is_banned(v_uid) then raise exception 'banned'; end if;
  if p_category is null or p_category not in ('feature', 'cosmetic', 'bug', 'other') then raise exception 'idea_category'; end if;
  if length(trim(coalesce(p_body, ''))) < 10 then raise exception 'idea_short'; end if;
  if length(trim(p_body)) > 1000 then raise exception 'idea_long'; end if;
  if (select count(*) from public.ideas where user_id = v_uid and created_at > now() - interval '1 day') >= 5 then raise exception 'idea_limit'; end if;
  insert into public.ideas (user_id, category, body) values (v_uid, p_category, trim(p_body)) returning id into v;
  return v;
end $$;

-- ===== Gracze MiB w grze (od 0.14.0): logo MiB przed nickiem i peleryny innych graczy =====
-- Launcher potwierdza konto Minecrafta tak jak serwer gry: zgłasza się w sesji Mojanga z losowym serverId,
-- a baza pyta Mojanga (hasJoined), czy to konto naprawdę to zrobiło. Token Minecrafta nie trafia do bazy.
-- Potem launcher co kilka minut odświeża obecność swoim tokenem obecności (w bazie tylko jego skrót).
do $$ begin
  create extension if not exists http with schema extensions;
exception when others then
  raise notice 'rozszerzenie http niedostępne: %', sqlerrm;
end $$;
create table if not exists private.mib_players (
  uuid uuid primary key,
  name text not null,
  user_id uuid references auth.users (id) on delete set null,
  token_hash text not null,
  seen_at timestamptz not null default now()
);
create index if not exists mib_players_name on private.mib_players (lower(name));
create table if not exists private.hello_log (at timestamptz not null default now());
alter table private.hello_log add column if not exists ip text not null default '';

-- Wynik: {uuid, name, token} albo {error}. Błędy po zapisie w hello_log są zwracane, nie rzucane — rzucony wyjątek
-- cofnąłby wpis i limit liczyłby tylko udane próby.
create or replace function public.mib_hello(p_name text, p_server_id text) returns json
language plpgsql security definer set search_path = '' as $$
declare
  v_status integer;
  v_body text;
  v_uuid uuid;
  v_name text;
  v_token text := encode(extensions.gen_random_bytes(24), 'hex');
  v_ip text := coalesce(trim(split_part(nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ',', 1)), '');
begin
  if p_name is null or p_name !~ '^[A-Za-z0-9_]{1,16}$' then raise exception 'name_invalid'; end if;
  -- dokładnie 32 znaki szesnastkowe, jak losowy serverId launchera (skrót z logowania na zwykły serwer prawie nigdy tak nie wygląda)
  if p_server_id is null or p_server_id !~ '^[0-9a-f]{32}$' then raise exception 'server_id_invalid'; end if;
  -- limity pytań do Mojanga: 120 na minutę dla wszystkich i 10 na minutę z jednego adresu
  delete from private.hello_log where at < now() - interval '1 minute';
  if (select count(*) from private.hello_log) >= 120 then raise exception 'busy'; end if;
  if v_ip <> '' and (select count(*) from private.hello_log where ip = v_ip) >= 10 then raise exception 'busy'; end if;
  insert into private.hello_log (ip) values (v_ip);
  begin
    perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '2500');
    select r.status, r.content into v_status, v_body
      from extensions.http_get('https://sessionserver.mojang.com/session/minecraft/hasJoined?username=' || p_name || '&serverId=' || p_server_id) r;
    if v_status = 200 then
      v_uuid := (v_body::json ->> 'id')::uuid;
      v_name := v_body::json ->> 'name';
    end if;
  exception when others then
    return json_build_object('error', 'mojang_unavailable');
  end;
  if v_uuid is null or v_name is null then return json_build_object('error', 'not_verified'); end if;
  delete from private.mib_players where seen_at < now() - interval '30 days';
  insert into private.mib_players (uuid, name, user_id, token_hash, seen_at)
    values (v_uuid, v_name, auth.uid(), encode(extensions.digest(v_token, 'sha256'), 'hex'), now())
    on conflict (uuid) do update set name = excluded.name, user_id = excluded.user_id, token_hash = excluded.token_hash, seen_at = now();
  return json_build_object('uuid', v_uuid, 'name', v_name, 'token', v_token);
end $$;

-- Gra dalej działa (p_online) albo została zamknięta; false = zły token (konto zgłoszone od nowa, np. z innego komputera)
create or replace function public.mib_ping(p_uuid uuid, p_token text, p_online boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update private.mib_players set seen_at = case when p_online then now() else now() - interval '1 hour' end
    where uuid = p_uuid and token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
  return found;
end $$;

-- Którzy z podanych graczy grają teraz w MiB (sygnał w ostatnich 10 minutach) i jakie kosmetyki mają założone
-- (tylko te, które naprawdę mają). Nicki są dla serwerów bez kont Microsoft (tam UUID gracza w grze jest inny niż prawdziwy).
-- Zbanowanych (od 0.20.0) nie ma na liście: bez logo MiB i kosmetyków w grze.
-- Od 0.15.0 także czapka i skrzydła, od 0.22.0 aura: inny wynik funkcji, więc najpierw stara wersja znika.
drop function if exists public.mib_who(uuid[], text[]);
create or replace function public.mib_who(p_ids uuid[], p_names text[]) returns table (uuid uuid, name text, cape text, hat text, wings text, aura text, mask text)
language sql stable security definer set search_path = '' as $$
  select m.uuid, m.name,
    (select o.cosmetic_id from public.owned_cosmetics o where o.user_id = m.user_id and o.cosmetic_id = (p.equipped ->> 'cape')),
    (select o.cosmetic_id from public.owned_cosmetics o where o.user_id = m.user_id and o.cosmetic_id = (p.equipped ->> 'hat')),
    (select o.cosmetic_id from public.owned_cosmetics o where o.user_id = m.user_id and o.cosmetic_id = (p.equipped ->> 'wings')),
    (select o.cosmetic_id from public.owned_cosmetics o where o.user_id = m.user_id and o.cosmetic_id = (p.equipped ->> 'aura')),
    (select o.cosmetic_id from public.owned_cosmetics o where o.user_id = m.user_id and o.cosmetic_id = (p.equipped ->> 'mask'))
  from private.mib_players m left join public.profiles p on p.id = m.user_id
  where m.seen_at > now() - interval '10 minutes' and p.banned_at is null
    and (m.uuid = any ((coalesce(p_ids, '{}'::uuid[]))[1:200])
      or lower(m.name) = any (select lower(x) from unnest((coalesce(p_names, '{}'::text[]))[1:200]) x));
$$;

-- ===== Znajomi (od 0.15.0) =====
-- Zaproszenie to wiersz (od, do); po przyjęciu accepted = true. Jedna para graczy ma najwyżej jeden wiersz.
-- Obecność (launcher, gra, wersja, serwer) widzą tylko przyjęci znajomi.
create table if not exists private.friends (
  from_id uuid not null references public.profiles (id) on delete cascade,
  to_id uuid not null references public.profiles (id) on delete cascade,
  accepted boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (from_id, to_id),
  check (from_id <> to_id)
);
create index if not exists friends_to on private.friends (to_id);
create unique index if not exists friends_pair on private.friends (least(from_id, to_id), greatest(from_id, to_id));
-- Launcher wysyła obecność co 2 minuty; starsza niż 5 minut znaczy offline
create table if not exists private.presence (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  seen_at timestamptz not null default now(),
  playing boolean not null default false,
  version text,
  server text
);

-- Profil po nicku albo numerze (MIB-000123, 123); nick ma pierwszeństwo
create or replace function private.friend_target(p_who text) returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.profiles
  where lower(nick) = lower(trim(p_who))
     or num = case when trim(p_who) ~* '^(mib-?)?[0-9]{1,12}$' then regexp_replace(trim(p_who), '[^0-9]', '', 'g')::bigint end
  order by lower(nick) = lower(trim(p_who)) desc
  limit 1;
$$;

-- Wynik: 'sent' (zaproszenie wysłane) albo 'accepted' (ta osoba już zaprosiła nas — teraz jesteście znajomymi)
create or replace function public.friend_request(p_who text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_to uuid;
begin
  if v_me is null then raise exception 'not_logged_in'; end if;
  if not exists (select 1 from public.profiles where id = v_me) then raise exception 'no_profile'; end if;
  if private.is_banned(v_me) then raise exception 'banned'; end if;
  if length(trim(coalesce(p_who, ''))) not between 1 and 20 then raise exception 'friend_not_found'; end if;
  v_to := private.friend_target(p_who);
  if v_to is null then raise exception 'friend_not_found'; end if;
  if v_to = v_me then raise exception 'friend_self'; end if;
  if private.is_blocked(v_me, v_to) then raise exception 'friend_blocked'; end if;
  update private.friends set accepted = true where from_id = v_to and to_id = v_me and not accepted;
  if found then return 'accepted'; end if;
  if exists (select 1 from private.friends where least(from_id, to_id) = least(v_me, v_to) and greatest(from_id, to_id) = greatest(v_me, v_to)) then
    raise exception 'friend_exists';
  end if;
  if (select count(*) from private.friends where from_id = v_me or to_id = v_me) >= 200
    or (select count(*) from private.friends where from_id = v_me and created_at > now() - interval '1 day') >= 30 then
    raise exception 'friend_limit';
  end if;
  insert into private.friends (from_id, to_id) values (v_me, v_to);
  return 'sent';
exception when unique_violation then
  raise exception 'friend_exists';
end $$;

-- Przyjęcie albo odrzucenie zaproszenia od p_from
create or replace function public.friend_answer(p_from uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'not_logged_in'; end if;
  if p_accept then
    if private.is_banned(v_me) then raise exception 'banned'; end if;
    update private.friends set accepted = true where from_id = p_from and to_id = v_me and not accepted;
  else
    delete from private.friends where from_id = p_from and to_id = v_me and not accepted;
  end if;
  if not found then raise exception 'friend_missing'; end if;
end $$;

-- Usunięcie znajomego albo anulowanie wysłanego zaproszenia
create or replace function public.friend_remove(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'not_logged_in'; end if;
  delete from private.friends where (from_id = v_me and to_id = p_user) or (from_id = p_user and to_id = v_me and accepted);
  -- bez znajomości nie ma rozmowy: wiadomości tej pary znikają
  delete from private.friend_messages where (from_id = v_me and to_id = p_user) or (from_id = p_user and to_id = v_me);
end $$;

-- Znajomi i zaproszenia; status: game (w grze), launcher, offline — tylko u przyjętych znajomych
create or replace function public.friends_list()
returns table (id uuid, nick text, num bigint, state text, status text, version text, server text, seen_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.nick, p.num,
    case when f.accepted then 'friend' when f.from_id = (select auth.uid()) then 'outgoing' else 'incoming' end,
    case when not f.accepted then null
         when pr.seen_at > now() - interval '5 minutes' then case when pr.playing then 'game' else 'launcher' end
         else 'offline' end,
    case when f.accepted and pr.playing and pr.seen_at > now() - interval '5 minutes' then pr.version end,
    case when f.accepted and pr.playing and pr.seen_at > now() - interval '5 minutes' then pr.server end,
    case when f.accepted then pr.seen_at end
  from private.friends f
  join public.profiles p on p.id = case when f.from_id = (select auth.uid()) then f.to_id else f.from_id end
  left join private.presence pr on pr.user_id = p.id
  where f.from_id = (select auth.uid()) or f.to_id = (select auth.uid())
  order by f.accepted, p.nick;
$$;

-- Obecność z launchera: gra działa (wersja, adres serwera albo null) albo sam launcher. Od 0.20.0 p_hidden (tryb
-- niewidoczny) i ban: znajomi widzą offline, jak po zamknięciu launchera. Każdy sygnał liczy się też do dziennej
-- aktywności (wykres w panelu admina; tylko liczby, bez nicków).
drop function if exists public.presence_ping(boolean, text, text);
create or replace function public.presence_ping(p_playing boolean, p_version text, p_server text, p_hidden boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'not_logged_in'; end if;
  if not exists (select 1 from public.profiles where id = v_me) then raise exception 'no_profile'; end if;
  insert into private.activity (day, user_id, played) values (private.today(), v_me, coalesce(p_playing, false))
    on conflict (day, user_id) do update set played = private.activity.played or excluded.played;
  if coalesce(p_hidden, false) or private.is_banned(v_me) then
    delete from private.presence where user_id = v_me;
    return;
  end if;
  insert into private.presence (user_id, seen_at, playing, version, server)
    values (v_me, now(), coalesce(p_playing, false),
      case when p_version ~ '^[0-9][0-9.]{0,15}$' then p_version end,
      case when coalesce(p_playing, false) and p_server ~ '^[A-Za-z0-9._:-]{1,100}$' then lower(p_server) end)
    on conflict (user_id) do update set seen_at = excluded.seen_at, playing = excluded.playing, version = excluded.version, server = excluded.server;
end $$;

-- Launcher zamknięty: od razu offline
create or replace function public.presence_leave() returns void
language sql security definer set search_path = '' as $$
  delete from private.presence where user_id = (select auth.uid());
$$;

-- Zaproszenie znajomego do gry (od 0.16.0): na serwer, na którym zapraszający gra teraz (z jego obecności, więc tylko
-- gdy pokazuje serwer znajomym). Jedno zaproszenie na parę; ponowne je odświeża. Zaproszenie widać przez 10 minut.
create table if not exists private.game_invites (
  from_id uuid not null references public.profiles (id) on delete cascade,
  to_id uuid not null references public.profiles (id) on delete cascade,
  server text not null,
  version text not null,
  created_at timestamptz not null default now(),
  primary key (from_id, to_id)
);
create index if not exists game_invites_to on private.game_invites (to_id, created_at);

create or replace function public.game_invite(p_user uuid) returns json
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_server text;
  v_version text;
begin
  if v_me is null then raise exception 'not_logged_in'; end if;
  if private.is_banned(v_me) then raise exception 'banned'; end if;
  if not exists (select 1 from private.friends where accepted
                 and ((from_id = v_me and to_id = p_user) or (from_id = p_user and to_id = v_me))) then
    raise exception 'invite_not_friend';
  end if;
  select server, version into v_server, v_version from private.presence
    where user_id = v_me and playing and seen_at > now() - interval '5 minutes';
  if v_server is null or v_version is null then raise exception 'invite_no_server'; end if;
  if (select count(*) from private.game_invites where from_id = v_me and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'invite_limit';
  end if;
  insert into private.game_invites (from_id, to_id, server, version) values (v_me, p_user, v_server, v_version)
    on conflict (from_id, to_id) do update set server = excluded.server, version = excluded.version, created_at = now();
  return json_build_object('server', v_server, 'version', v_version);
end $$;

-- Zaproszenia do mnie z ostatnich 10 minut (tylko od obecnych znajomych)
create or replace function public.game_invites_list()
returns table (from_id uuid, nick text, server text, version text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select i.from_id, p.nick, i.server, i.version, i.created_at
  from private.game_invites i join public.profiles p on p.id = i.from_id
  where i.to_id = (select auth.uid()) and i.created_at > now() - interval '10 minutes'
    and exists (select 1 from private.friends f where f.accepted
                and ((f.from_id = i.from_id and f.to_id = i.to_id) or (f.from_id = i.to_id and f.to_id = i.from_id)))
  order by i.created_at desc;
$$;

-- Zaproszenie przyjęte albo odrzucone: znika
create or replace function public.game_invite_dismiss(p_from uuid) returns void
language sql security definer set search_path = '' as $$
  delete from private.game_invites where to_id = (select auth.uid()) and from_id = p_from;
$$;

-- ===== Wiadomości do znajomych (od 0.17.0) =====
-- Rozmowa dwóch przyjętych znajomych (launcher i menu w grze). Wiadomość ma 1–500 znaków w jednej linii; po 30 dniach
-- znika, a usunięcie ze znajomych kasuje całą rozmowę. Czytać ją mogą tylko te dwie osoby (przez funkcje poniżej).
create table if not exists private.friend_messages (
  id bigint generated always as identity primary key,
  from_id uuid not null references public.profiles (id) on delete cascade,
  to_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (length(body) between 1 and 500),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (from_id <> to_id)
);
create index if not exists friend_messages_pair on private.friend_messages (least(from_id, to_id), greatest(from_id, to_id), id);
create index if not exists friend_messages_to on private.friend_messages (to_id, read_at);
create index if not exists friend_messages_from on private.friend_messages (from_id, created_at);

create or replace function private.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.friends where accepted and ((from_id = a and to_id = b) or (from_id = b and to_id = a)));
$$;

-- Wysłanie wiadomości: znaki sterujące i kody kolorów Minecrafta (§) znikają; najwyżej 20 na minutę i 1000 na dobę
create or replace function public.message_send(p_to uuid, p_body text) returns json
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_body text := btrim(regexp_replace(regexp_replace(coalesce(p_body, ''), '§.?', '', 'g'), '[[:cntrl:]]+', ' ', 'g'));
  v_id bigint;
  v_at timestamptz;
begin
  if v_me is null then raise exception 'not_logged_in'; end if;
  if private.is_banned(v_me) then raise exception 'banned'; end if;
  if p_to is null or not private.are_friends(v_me, p_to) then raise exception 'message_not_friend'; end if;
  if length(v_body) = 0 then raise exception 'message_empty'; end if;
  if length(v_body) > 500 then raise exception 'message_long'; end if;
  if (select count(*) from private.friend_messages where from_id = v_me and created_at > now() - interval '1 minute') >= 20
    or (select count(*) from private.friend_messages where from_id = v_me and created_at > now() - interval '1 day') >= 1000 then
    raise exception 'message_limit';
  end if;
  delete from private.friend_messages where created_at < now() - interval '30 days'
    and ((from_id = v_me and to_id = p_to) or (from_id = p_to and to_id = v_me));
  insert into private.friend_messages (from_id, to_id, body) values (v_me, p_to, v_body) returning id, created_at into v_id, v_at;
  return json_build_object('id', v_id, 'created_at', v_at);
end $$;

-- Rozmowa ze znajomym: ostatnie 50 wiadomości (albo 50 przed p_before), od najstarszej
create or replace function public.messages_with(p_user uuid, p_before bigint default null)
returns table (id bigint, mine boolean, body text, created_at timestamptz, read boolean)
language sql stable security definer set search_path = '' as $$
  select x.id, x.mine, x.body, x.created_at, x.read from (
    select m.id, m.from_id = (select auth.uid()) as mine, m.body, m.created_at, m.read_at is not null as read
    from private.friend_messages m
    where private.are_friends((select auth.uid()), p_user)
      and ((m.from_id = (select auth.uid()) and m.to_id = p_user) or (m.from_id = p_user and m.to_id = (select auth.uid())))
      and m.created_at > now() - interval '30 days'
      and (p_before is null or m.id < p_before)
    order by m.id desc limit 50) x
  order by x.id;
$$;

-- Rozmowa otwarta: wiadomości od tej osoby są przeczytane
create or replace function public.messages_read(p_user uuid) returns void
language sql security definer set search_path = '' as $$
  update private.friend_messages set read_at = now()
  where to_id = (select auth.uid()) and from_id = p_user and read_at is null;
$$;

-- Nieprzeczytane wiadomości od znajomych: ile od kogo i ostatnia (do licznika i powiadomień)
create or replace function public.messages_unread()
returns table (from_id uuid, nick text, unread bigint, last_id bigint, last_body text, last_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select m.from_id, p.nick, count(*), max(m.id), (array_agg(m.body order by m.id desc))[1], max(m.created_at)
  from private.friend_messages m join public.profiles p on p.id = m.from_id
  where m.to_id = (select auth.uid()) and m.read_at is null and m.created_at > now() - interval '30 days'
    and private.are_friends(m.to_id, m.from_id)
  group by m.from_id, p.nick
  order by max(m.id) desc;
$$;

-- ===== Prezenty od MiB (od 0.19.0) =====
-- Admin wysyła graczowi kosmetyk z wiadomością (np. nagroda za znaleziony błąd). Kosmetyk trafia na profil dopiero
-- po „Odbierz” w launcherze. Nagrodzone zgłoszenia błędów liczą się do odznaki Łowca błędów (profiles.bugs_found).
create table if not exists private.gifts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  cosmetic_id text not null references public.cosmetics (id) on delete cascade,
  message text check (message is null or length(message) <= 200),
  idea_id bigint,
  created_at timestamptz not null default now(),
  claimed_at timestamptz
);
create index if not exists gifts_user on private.gifts (user_id, claimed_at);
alter table public.profiles add column if not exists bugs_found integer not null default 0;
-- prezent kupiony przez znajomego za MiB Coins (od 0.24.0); null = prezent od MiB
alter table private.gifts add column if not exists from_user uuid references public.profiles (id) on delete set null;

-- Nieodebrane prezenty gracza (najstarszy pierwszy) z teksturą do podglądu; bug = nagroda za zgłoszony błąd;
-- from_nick = znajomy, który kupił prezent (od 0.24.0, stąd drop: zmienia się wynik)
drop function if exists public.my_gifts();
create or replace function public.my_gifts()
returns table (id bigint, cosmetic_id text, name text, type text, texture text, message text, bug boolean, created_at timestamptz, from_nick text)
language sql stable security definer set search_path = '' as $$
  select g.id, c.id, c.name, c.type, c.texture, g.message,
    exists (select 1 from public.ideas i where i.id = g.idea_id and i.category = 'bug'), g.created_at, f.nick
  from private.gifts g join public.cosmetics c on c.id = g.cosmetic_id
    left join public.profiles f on f.id = g.from_user
  where g.user_id = (select auth.uid()) and g.claimed_at is null
  order by g.id;
$$;

-- Odebranie prezentu: kosmetyk na profil (gdy gracz już go ma, zostaje jak był); wynik to id kosmetyku
create or replace function public.claim_gift(p_id bigint) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_cos text;
begin
  if v_me is null then raise exception 'not_logged_in'; end if;
  update private.gifts set claimed_at = now() where id = p_id and user_id = v_me and claimed_at is null returning cosmetic_id into v_cos;
  if v_cos is null then raise exception 'gift_missing'; end if;
  insert into public.owned_cosmetics (user_id, cosmetic_id, source) values (v_me, v_cos, 'gift') on conflict do nothing;
  return v_cos;
end $$;

-- Zmiany w moich pomysłach od ostatniego obejrzenia (status albo odpowiedź twórcy): powiadomienia i kropka przy Pomysły
create or replace function public.ideas_updates()
returns table (id bigint, body text, status text, reply text, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select i.id, i.body, i.status, i.reply, i.updated_at from public.ideas i
  where i.user_id = (select auth.uid()) and i.updated_at is not null and (i.seen_at is null or i.seen_at < i.updated_at)
  order by i.updated_at desc;
$$;

-- Gracz otworzył Pomysły: zmiany są obejrzane
create or replace function public.ideas_seen() returns void
language sql security definer set search_path = '' as $$
  update public.ideas set seen_at = now()
  where user_id = (select auth.uid()) and updated_at is not null and (seen_at is null or seen_at < updated_at);
$$;

-- ===== Bezpieczeństwo (od 0.20.0): blokowanie, zgłoszenia, ostrzeżenia i ban =====
-- Zablokowanie kończy znajomość, zaproszenia i rozmowę, a zablokowany nie zaprosi już do znajomych. Zgłoszenie
-- wiadomości zapisuje jej kopię z kilkoma poprzednimi (rozmowa może potem zniknąć). Admin daje ostrzeżenia; czwarte
-- to ban: bez wiadomości, znajomych, zaproszeń, pomysłów, obecności i logo MiB z kosmetykami w grze.
create table if not exists private.blocks (
  user_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, blocked_id),
  check (user_id <> blocked_id)
);
create index if not exists blocks_blocked on private.blocks (blocked_id);
create table if not exists private.reports (
  id bigint generated always as identity primary key,
  reporter_id uuid references public.profiles (id) on delete set null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  message_id bigint,
  reason text not null check (reason in ('insult', 'spam', 'scam', 'other')),
  note text check (note is null or length(note) <= 300),
  messages jsonb not null default '[]'::jsonb,
  status text not null default 'new' check (status in ('new', 'warned', 'banned', 'dismissed')),
  created_at timestamptz not null default now()
);
create index if not exists reports_status on private.reports (status, created_at);
create unique index if not exists reports_once on private.reports (reporter_id, message_id) where message_id is not null;
-- Ostrzeżenie widzi gracz w launcherze (num = które z kolei: 1–4)
create table if not exists private.warnings (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  num integer not null,
  reason text not null check (length(reason) between 1 and 300),
  created_at timestamptz not null default now(),
  seen_at timestamptz
);
create index if not exists warnings_user on private.warnings (user_id, seen_at);

create or replace function private.is_banned(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = p and banned_at is not null);
$$;
create or replace function private.is_blocked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.blocks where (user_id = a and blocked_id = b) or (user_id = b and blocked_id = a));
$$;

create or replace function public.block_user(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'not_logged_in'; end if;
  if p_user is null or p_user = v_me or not exists (select 1 from public.profiles where id = p_user) then raise exception 'player_missing'; end if;
  if (select count(*) from private.blocks where user_id = v_me) >= 500 then raise exception 'block_limit'; end if;
  insert into private.blocks (user_id, blocked_id) values (v_me, p_user) on conflict do nothing;
  delete from private.friends where (from_id = v_me and to_id = p_user) or (from_id = p_user and to_id = v_me);
  delete from private.game_invites where (from_id = v_me and to_id = p_user) or (from_id = p_user and to_id = v_me);
  delete from private.friend_messages where (from_id = v_me and to_id = p_user) or (from_id = p_user and to_id = v_me);
end $$;

create or replace function public.unblock_user(p_user uuid) returns void
language sql security definer set search_path = '' as $$
  delete from private.blocks where user_id = (select auth.uid()) and blocked_id = p_user;
$$;

create or replace function public.blocked_list()
returns table (id uuid, nick text, num bigint, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.nick, p.num, b.created_at from private.blocks b join public.profiles p on p.id = b.blocked_id
  where b.user_id = (select auth.uid()) order by b.created_at desc;
$$;

-- Zgłoszenie gracza; p_message = wiadomość od niego do mnie (kopia 10 ostatnich wiadomości rozmowy do niej włącznie).
-- Najwyżej 10 zgłoszeń na dobę, jedna wiadomość zgłoszona raz.
create or replace function public.report_user(p_user uuid, p_message bigint, p_reason text, p_note text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_msgs jsonb := '[]'::jsonb;
  v_id bigint;
begin
  if v_me is null then raise exception 'not_logged_in'; end if;
  if not exists (select 1 from public.profiles where id = v_me) then raise exception 'no_profile'; end if;
  if p_user is null or p_user = v_me or not exists (select 1 from public.profiles where id = p_user) then raise exception 'player_missing'; end if;
  if p_reason is null or p_reason not in ('insult', 'spam', 'scam', 'other') then raise exception 'report_reason'; end if;
  if v_note is not null and length(v_note) > 300 then raise exception 'report_long'; end if;
  if (select count(*) from private.reports where reporter_id = v_me and created_at > now() - interval '1 day') >= 10 then raise exception 'report_limit'; end if;
  if p_message is not null then
    if not exists (select 1 from private.friend_messages where id = p_message and from_id = p_user and to_id = v_me) then raise exception 'report_message_missing'; end if;
    select coalesce(jsonb_agg(jsonb_build_object('from', x.nick, 'body', x.body, 'at', x.created_at, 'reported', x.id = p_message) order by x.id), '[]'::jsonb) into v_msgs
    from (select m.id, p.nick, m.body, m.created_at from private.friend_messages m join public.profiles p on p.id = m.from_id
          where ((m.from_id = v_me and m.to_id = p_user) or (m.from_id = p_user and m.to_id = v_me)) and m.id <= p_message
          order by m.id desc limit 10) x;
  end if;
  insert into private.reports (reporter_id, user_id, message_id, reason, note, messages) values (v_me, p_user, p_message, p_reason, v_note, v_msgs) returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'report_exists';
end $$;

-- Ostrzeżenia, których gracz jeszcze nie widział (okno w launcherze), i ich obejrzenie
create or replace function public.my_warnings()
returns table (id bigint, num integer, reason text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select w.id, w.num, w.reason, w.created_at from private.warnings w
  where w.user_id = (select auth.uid()) and w.seen_at is null order by w.id;
$$;
create or replace function public.warnings_seen() returns void
language sql security definer set search_path = '' as $$
  update private.warnings set seen_at = now() where user_id = (select auth.uid()) and seen_at is null;
$$;

-- ===== Osiągnięcia i karta znajomego (od 0.20.0) =====
-- Liczby do osiągnięć (launcher liczy z nich odznaki). Cudzą kartę widzi tylko znajomy: z nazwą konta Minecraft
-- (do skina) i założonymi kosmetykami z teksturami.
create or replace function public.profile_card(p_user uuid default null) returns json
language plpgsql stable security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v uuid := coalesce(p_user, auth.uid());
  p public.profiles;
begin
  if v_me is null then raise exception 'not_logged_in'; end if;
  if v <> v_me and not private.are_friends(v_me, v) then raise exception 'not_friend'; end if;
  select * into p from public.profiles where id = v;
  if not found then raise exception 'player_missing'; end if;
  return json_build_object(
    'id', p.id, 'nick', p.nick, 'num', p.num, 'founder', p.founder, 'created_at', p.created_at, 'bugs_found', p.bugs_found,
    'playtime_min', p.playtime_min, 'launches', p.launches, 'versions', (select count(*) from jsonb_object_keys(p.version_stats)),
    'friends', (select count(*) from private.friends where accepted and (from_id = v or to_id = v)),
    'ideas', (select count(*) from public.ideas where user_id = v),
    'ideas_done', (select count(*) from public.ideas where user_id = v and status = 'done'),
    'owned', (select count(*) from public.owned_cosmetics where user_id = v),
    'mc_name', case when v <> v_me then (select name from private.mib_players where user_id = v order by seen_at desc limit 1) end,
    'equipped', case when v = v_me then '[]'::json else (
      select coalesce(json_agg(json_build_object('type', c.type, 'id', c.id, 'name', c.name, 'texture', c.texture)), '[]'::json)
      from jsonb_each_text(p.equipped) e join public.cosmetics c on c.id = e.value and c.type = e.key
      where exists (select 1 from public.owned_cosmetics o where o.user_id = v and o.cosmetic_id = c.id)) end);
end $$;

-- ===== Raport awarii do twórcy (od 0.20.0) =====
-- Po awarii gry gracz wysyła zgłoszenie błędu z raportem (launcher usuwa z niego tokeny i ścieżki z nazwą konta systemu)
alter table public.ideas add column if not exists details text check (details is null or length(details) <= 20000);
create or replace function public.submit_crash(p_body text, p_details text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v bigint;
begin
  if v_uid is null then raise exception 'not_logged_in'; end if;
  perform 1 from public.profiles where id = v_uid for update;
  if not found then raise exception 'no_profile'; end if;
  if private.is_banned(v_uid) then raise exception 'banned'; end if;
  if length(trim(coalesce(p_body, ''))) not between 10 and 1000 then raise exception 'idea_short'; end if;
  if length(coalesce(p_details, '')) > 20000 then raise exception 'crash_long'; end if;
  if (select count(*) from public.ideas where user_id = v_uid and created_at > now() - interval '1 day') >= 5 then raise exception 'idea_limit'; end if;
  insert into public.ideas (user_id, category, body, details) values (v_uid, 'bug', trim(p_body), nullif(p_details, '')) returning id into v;
  return v;
end $$;

-- ===== Głosowanie na pomysły (od 0.21.0) =====
-- Gracze widzą pomysły innych (bez zgłoszeń błędów, odrzuconych i od zbanowanych) i dają im głos: jeden na pomysł,
-- nie na własny. Twórca widzi liczbę głosów w panelu admina.
create table if not exists private.idea_votes (
  idea_id bigint not null references public.ideas (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (idea_id, user_id)
);
create index if not exists idea_votes_user on private.idea_votes (user_id);

create or replace function private.idea_public(p_id bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.ideas i join public.profiles p on p.id = i.user_id
                 where i.id = p_id and i.category <> 'bug' and i.status <> 'rejected' and p.banned_at is null);
$$;

-- p_sort: 'top' (najwięcej głosów) albo 'new' (najnowsze); 100 pomysłów
create or replace function public.ideas_public(p_sort text)
returns table (id bigint, nick text, category text, body text, status text, reply text, votes integer, voted boolean, mine boolean, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select i.id, p.nick, i.category, i.body, i.status, i.reply,
    (select count(*) from private.idea_votes v where v.idea_id = i.id)::integer,
    exists (select 1 from private.idea_votes v where v.idea_id = i.id and v.user_id = (select auth.uid())),
    i.user_id = (select auth.uid()), i.created_at
  from public.ideas i join public.profiles p on p.id = i.user_id
  where (select auth.uid()) is not null and i.category <> 'bug' and i.status <> 'rejected' and p.banned_at is null
  order by case when p_sort = 'new' then 0 else (select count(*) from private.idea_votes v where v.idea_id = i.id) end desc, i.created_at desc
  limit 100;
$$;

-- Głos (p_on = true) albo jego cofnięcie; wynik to liczba głosów na pomysł
create or replace function public.idea_vote(p_id bigint, p_on boolean) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'not_logged_in'; end if;
  if not exists (select 1 from public.profiles where id = v_me) then raise exception 'no_profile'; end if;
  if private.is_banned(v_me) then raise exception 'banned'; end if;
  if not private.idea_public(p_id) then raise exception 'idea_missing'; end if;
  if exists (select 1 from public.ideas where id = p_id and user_id = v_me) then raise exception 'idea_own'; end if;
  if coalesce(p_on, true) then
    insert into private.idea_votes (idea_id, user_id) values (p_id, v_me) on conflict do nothing;
  else
    delete from private.idea_votes where idea_id = p_id and user_id = v_me;
  end if;
  return (select count(*) from private.idea_votes where idea_id = p_id);
end $$;

-- ===== Dzienna aktywność (od 0.20.0): wykres graczy w panelu admina =====
create or replace function private.today() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Europe/Warsaw')::date;
$$;
create table if not exists private.activity (
  day date not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  played boolean not null default false,
  primary key (day, user_id)
);

-- Ważna aktualność (od 0.20.0): okno, które każdy gracz zobaczy raz (w launcherze i powiadomienie w grze)
alter table public.announcements add column if not exists popup boolean not null default false;

-- ===== Panel admina =====
-- Admin jest zapisany jako konto (nie numer MIB): przy pierwszym uruchomieniu tego pliku zostaje nim profil MIB-000002.
-- Późniejsze uruchomienia niczego tu nie zmieniają, nawet gdy numeracja zostanie wyzerowana.
create table if not exists private.admins (user_id uuid primary key references auth.users (id) on delete cascade);
insert into private.admins (user_id)
  select id from public.profiles where num = 2 and not exists (select 1 from private.admins);
do $$ begin
  if not exists (select 1 from private.admins) then
    raise notice 'Panel admina: brak profilu MIB-000002, admin nie został jeszcze przypisany.';
  end if;
end $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.admins where user_id = auth.uid());
$$;

create or replace function private.need_admin() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
end $$;

-- Losowy kod prezentowy, np. MIB-7KQ2-XW9P (bez mylących znaków 0/O, 1/I/L)
create or replace function private.random_code() returns text
language plpgsql volatile set search_path = '' as $$
declare
  a text := '23456789ABCDEFGHJKMNPQRSTVWXYZ';
  b bytea := extensions.gen_random_bytes(8);
  s text := 'MIB-';
begin
  for i in 0..7 loop
    s := s || substr(a, (get_byte(b, i) % length(a)) + 1, 1);
    if i = 3 then s := s || '-'; end if;
  end loop;
  return s;
end $$;

create or replace function public.admin_stats() returns json
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.need_admin();
  return json_build_object(
    'profiles', (select count(*) from public.profiles),
    'new7', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'active7', (select count(*) from public.profiles where last_played_at > now() - interval '7 days'),
    'foundersLeft', greatest(0, 1000 - coalesce(pg_sequence_last_value('public.profiles_num_seq'::regclass), 0)),
    'cosmetics', (select count(*) from public.cosmetics),
    'owned', (select count(*) from public.owned_cosmetics),
    -- teraz (od 0.16.0): profile MiB w grze i w launcherze (sygnał w ostatnich 5 minutach), konta w grze z modem MiB
    -- (10 minut, też bez profilu) oraz zbiorczo najpopularniejsze serwery (tylko udostępniane znajomym) i wersje
    'nowGame', (select count(*) from private.presence where seen_at > now() - interval '5 minutes' and playing),
    'nowLauncher', (select count(*) from private.presence where seen_at > now() - interval '5 minutes' and not playing),
    'nowMod', (select count(*) from private.mib_players where seen_at > now() - interval '10 minutes'),
    'nowServers', (select coalesce(json_agg(x), '[]'::json) from (
      select server, count(*) as players from private.presence
      where seen_at > now() - interval '5 minutes' and playing and server is not null group by server order by 2 desc, 1 limit 5) x),
    'nowVersions', (select coalesce(json_agg(x), '[]'::json) from (
      select version, count(*) as players from private.presence
      where seen_at > now() - interval '5 minutes' and playing and version is not null group by version order by 2 desc, 1 limit 5) x),
    'versions', (select coalesce(json_agg(v), '[]'::json) from (
      select key as version, sum((value ->> 'min')::integer) as min, sum((value ->> 'runs')::integer) as runs
      from public.profiles, jsonb_each(version_stats) group by key order by 2 desc limit 5) v));
end $$;

-- od 0.20.0 także ostrzeżenia i ban, od 0.23.0 MiB Coins (inny wynik funkcji, więc najpierw stara wersja znika)
drop function if exists public.admin_find_players(text);
create or replace function public.admin_find_players(p_q text)
returns table (id uuid, num bigint, nick text, email text, created_at timestamptz, founder boolean, playtime_min integer, launches integer,
  warnings integer, banned boolean, ban_reason text, coins integer)
language plpgsql stable security definer set search_path = '' as $$
declare
  q text := trim(coalesce(p_q, ''));
  like_q text := '%' || replace(replace(replace(trim(coalesce(p_q, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%';
begin
  perform private.need_admin();
  return query
    select p.id, p.num, p.nick, u.email::text, p.created_at, p.founder, p.playtime_min, p.launches, p.warnings, p.banned_at is not null, p.ban_reason, p.coins
    from public.profiles p join auth.users u on u.id = p.id
    where q = ''
       or (q ~* '^(MIB-)?[0-9]{1,12}$' and p.num = regexp_replace(upper(q), '^MIB-', '')::bigint)
       or p.nick ilike like_q or u.email ilike like_q
    order by p.num desc limit 20;
end $$;

create or replace function public.admin_player_cosmetics(p_user uuid) returns json
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.need_admin();
  return (select coalesce(json_agg(json_build_object('id', c.id, 'name', c.name, 'source', o.source, 'acquired_at', o.acquired_at) order by o.acquired_at), '[]'::json)
          from public.owned_cosmetics o join public.cosmetics c on c.id = o.cosmetic_id where o.user_id = p_user);
end $$;

create or replace function public.admin_grant(p_user uuid, p_cosmetic text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.need_admin();
  insert into public.owned_cosmetics (user_id, cosmetic_id, source) values (p_user, p_cosmetic, 'admin') on conflict do nothing;
end $$;

create or replace function public.admin_revoke(p_user uuid, p_cosmetic text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.need_admin();
  delete from public.owned_cosmetics where user_id = p_user and cosmetic_id = p_cosmetic;
end $$;

create or replace function public.admin_delete_player(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.need_admin();
  if exists (select 1 from private.admins where user_id = p_user) then raise exception 'cannot_delete_admin'; end if;
  delete from private.reset_attempts where email = (select lower(email) from auth.users where id = p_user);
  delete from auth.users where id = p_user;
end $$;

create or replace function public.admin_save_cosmetic(p_id text, p_name text, p_type text, p_texture text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.need_admin();
  if p_id !~ '^[a-z0-9_]{2,32}$' then raise exception 'cosmetic_id_invalid'; end if;
  if length(trim(coalesce(p_name, ''))) not between 1 and 40 then raise exception 'cosmetic_name_invalid'; end if;
  if p_type not in ('cape', 'hat', 'wings', 'aura', 'mask') then raise exception 'cosmetic_type_invalid'; end if;
  -- aura (od 0.22.0): końcówka id mówi, jak poruszają się cząsteczki (launcher i mod znają te ruchy; snow i burst od 0.25.0)
  if p_type = 'aura' and p_id !~ '_(souls|pumpkins|ghosts|magic|snow|burst)$' then raise exception 'aura_id_invalid'; end if;
  insert into public.cosmetics (id, name, type, texture) values (p_id, trim(p_name), p_type, p_texture)
    on conflict (id) do update set name = excluded.name, type = excluded.type, texture = coalesce(excluded.texture, public.cosmetics.texture);
end $$;

create or replace function public.admin_delete_cosmetic(p_id text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.need_admin();
  if exists (select 1 from public.owned_cosmetics where cosmetic_id = p_id) or exists (select 1 from private.gift_codes where cosmetic_id = p_id)
    or exists (select 1 from private.shop_offers where p_id = any(items)) then
    raise exception 'cosmetic_in_use';
  end if;
  delete from public.cosmetics where id = p_id;
end $$;

-- Kody prezentowe: losowe (MIB-XXXX-XXXX) albo jeden kod o własnej nazwie (p_code, np. TURNIEJ2026); ważność w dniach
-- albo do daty (p_until, od 0.20.0)
drop function if exists public.admin_create_codes(text, integer, integer, integer);
create or replace function public.admin_create_codes(p_cosmetic text, p_count integer, p_max_uses integer, p_days integer default null,
  p_until timestamptz default null, p_code text default null) returns json
language plpgsql security definer set search_path = '' as $$
declare
  v text;
  out text[] := '{}';
  v_own text := nullif(upper(btrim(coalesce(p_code, ''))), '');
  v_exp timestamptz := coalesce(p_until, case when p_days is null then null else now() + make_interval(days => p_days) end);
begin
  perform private.need_admin();
  if not exists (select 1 from public.cosmetics where id = p_cosmetic) then raise exception 'cosmetic_missing'; end if;
  if p_count not between 1 and 100 or p_max_uses not between 1 and 100000 or (p_days is not null and p_days not between 1 and 3650)
    or (p_until is not null and p_until <= now()) then raise exception 'codes_invalid'; end if;
  if v_own is not null then
    if v_own !~ '^[A-Z0-9-]{4,24}$' then raise exception 'code_name_invalid'; end if;
    if p_count <> 1 then raise exception 'codes_invalid'; end if;
    if exists (select 1 from private.gift_codes where code = v_own) then raise exception 'code_exists'; end if;
    insert into private.gift_codes (code, cosmetic_id, max_uses, expires_at) values (v_own, p_cosmetic, p_max_uses, v_exp);
    return to_json(array[v_own]);
  end if;
  for i in 1..p_count loop
    loop
      v := private.random_code();
      exit when not exists (select 1 from private.gift_codes where code = v);
    end loop;
    insert into private.gift_codes (code, cosmetic_id, max_uses, expires_at) values (v, p_cosmetic, p_max_uses, v_exp);
    out := out || v;
  end loop;
  return to_json(out);
end $$;

create or replace function public.admin_list_codes()
returns table (code text, cosmetic_id text, cosmetic_name text, used_count integer, max_uses integer, expires_at timestamptz, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.need_admin();
  return query
    select g.code, g.cosmetic_id, c.name, g.used_count, g.max_uses, g.expires_at, g.created_at
    from private.gift_codes g join public.cosmetics c on c.id = g.cosmetic_id
    order by g.created_at desc limit 200;
end $$;

create or replace function public.admin_delete_code(p_code text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.need_admin();
  delete from private.gift_codes where code = p_code;
end $$;

drop function if exists public.admin_list_announcements();
create or replace function public.admin_list_announcements()
returns table (id bigint, title text, body text, pinned boolean, visible_until timestamptz, popup boolean, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.need_admin();
  return query select a.id, a.title, a.body, a.pinned, a.visible_until, a.popup, a.created_at from public.announcements a order by a.pinned desc, a.created_at desc;
end $$;

-- p_popup (od 0.20.0): ważna aktualność, którą każdy gracz zobaczy raz w oknie
drop function if exists public.admin_save_announcement(bigint, text, text, boolean, timestamptz);
create or replace function public.admin_save_announcement(p_id bigint, p_title text, p_body text, p_pinned boolean, p_until timestamptz,
  p_popup boolean default false) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v bigint;
begin
  perform private.need_admin();
  if p_id is null then
    insert into public.announcements (title, body, pinned, visible_until, popup)
      values (trim(p_title), coalesce(p_body, ''), coalesce(p_pinned, false), p_until, coalesce(p_popup, false)) returning id into v;
  else
    update public.announcements set title = trim(p_title), body = coalesce(p_body, ''), pinned = coalesce(p_pinned, false), visible_until = p_until,
      popup = coalesce(p_popup, false) where id = p_id returning id into v;
    if v is null then raise exception 'announcement_missing'; end if;
  end if;
  return v;
end $$;

create or replace function public.admin_delete_announcement(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.need_admin();
  delete from public.announcements where id = p_id;
end $$;

-- nowe pomysły na górze; nick, num i user_id są puste, gdy autor usunął konto (od 0.19.0 też odpowiedź i nagroda,
-- od 0.20.0 czy jest raport awarii — sam raport z admin_idea_details, od 0.21.0 liczba głosów graczy)
drop function if exists public.admin_list_ideas();
create or replace function public.admin_list_ideas()
returns table (id bigint, user_id uuid, nick text, num bigint, category text, body text, status text, reply text, rewarded boolean, has_details boolean,
  votes integer, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.need_admin();
  return query
    select i.id, p.id, p.nick, p.num, i.category, i.body, i.status, i.reply, i.rewarded, i.details is not null,
      (select count(*) from private.idea_votes v where v.idea_id = i.id)::integer, i.created_at
    from public.ideas i left join public.profiles p on p.id = i.user_id
    order by i.status = 'new' desc, i.created_at desc limit 300;
end $$;

create or replace function public.admin_count_new_ideas() returns integer
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.need_admin();
  return (select count(*) from public.ideas where status = 'new');
end $$;

create or replace function public.admin_set_idea_status(p_id bigint, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.need_admin();
  if p_status is null or p_status not in ('new', 'seen', 'planned', 'done', 'rejected') then raise exception 'idea_status_invalid'; end if;
  -- autor dostaje powiadomienie o zmianie statusu (poza powrotem do „Nowy”)
  update public.ideas set updated_at = case when status is distinct from p_status and p_status <> 'new' then now() else updated_at end,
    status = p_status where id = p_id;
  if not found then raise exception 'idea_missing'; end if;
end $$;

-- Status i odpowiedź dla autora pomysłu (pusta odpowiedź ją usuwa); autor dostaje powiadomienie
create or replace function public.admin_answer_idea(p_id bigint, p_status text, p_reply text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_reply text := nullif(btrim(coalesce(p_reply, '')), '');
begin
  perform private.need_admin();
  if p_status is null or p_status not in ('new', 'seen', 'planned', 'done', 'rejected') then raise exception 'idea_status_invalid'; end if;
  if v_reply is not null and length(v_reply) > 500 then raise exception 'idea_reply_long'; end if;
  update public.ideas set status = p_status, reply = v_reply, updated_at = now() where id = p_id;
  if not found then raise exception 'idea_missing'; end if;
end $$;

-- Prezent dla gracza (kosmetyk z wiadomością do odebrania w launcherze). Z p_idea to nagroda za ten pomysł: pomysł
-- dostaje status „Zrobione” i znacznik nagrody, a nagrodzony błąd liczy się do odznaki Łowca błędów.
create or replace function public.admin_gift(p_user uuid, p_cosmetic text, p_message text, p_idea bigint) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_id bigint;
  v_msg text := nullif(btrim(coalesce(p_message, '')), '');
  v_cat text;
begin
  perform private.need_admin();
  if not exists (select 1 from public.profiles where id = p_user) then raise exception 'player_missing'; end if;
  if not exists (select 1 from public.cosmetics where id = p_cosmetic) then raise exception 'cosmetic_missing'; end if;
  if v_msg is not null and length(v_msg) > 200 then raise exception 'gift_message_long'; end if;
  if p_idea is not null then
    update public.ideas set rewarded = true, status = 'done', updated_at = now()
      where id = p_idea and user_id = p_user and not rewarded returning category into v_cat;
    if v_cat is null then raise exception 'idea_rewarded'; end if;
    if v_cat = 'bug' then update public.profiles set bugs_found = bugs_found + 1 where id = p_user; end if;
  end if;
  insert into private.gifts (user_id, cosmetic_id, message, idea_id) values (p_user, p_cosmetic, v_msg, p_idea) returning id into v_id;
  return v_id;
end $$;

create or replace function public.admin_delete_idea(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.need_admin();
  delete from public.ideas where id = p_id;
end $$;

create or replace function public.admin_idea_details(p_id bigint) returns text
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.need_admin();
  return (select details from public.ideas where id = p_id);
end $$;

-- Prezent dla wszystkich (od 0.20.0): każdy profil bez bana, który nie ma tego kosmetyku ani nie czeka na niego; wynik = ilu graczy
create or replace function public.admin_gift_all(p_cosmetic text, p_message text) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_msg text := nullif(btrim(coalesce(p_message, '')), '');
  v_n integer;
begin
  perform private.need_admin();
  if not exists (select 1 from public.cosmetics where id = p_cosmetic) then raise exception 'cosmetic_missing'; end if;
  if v_msg is not null and length(v_msg) > 200 then raise exception 'gift_message_long'; end if;
  insert into private.gifts (user_id, cosmetic_id, message)
    select p.id, p_cosmetic, v_msg from public.profiles p
    where p.banned_at is null
      and not exists (select 1 from public.owned_cosmetics o where o.user_id = p.id and o.cosmetic_id = p_cosmetic)
      and not exists (select 1 from private.gifts g where g.user_id = p.id and g.cosmetic_id = p_cosmetic and g.claimed_at is null);
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ===== Zgłoszenia, ostrzeżenia i ban (od 0.20.0) =====
create or replace function public.admin_list_reports()
returns table (id bigint, reporter text, user_id uuid, nick text, num bigint, warnings integer, banned boolean, reason text, note text, messages jsonb, status text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.need_admin();
  return query
    select r.id, rp.nick, p.id, p.nick, p.num, p.warnings, p.banned_at is not null, r.reason, r.note, r.messages, r.status, r.created_at
    from private.reports r join public.profiles p on p.id = r.user_id left join public.profiles rp on rp.id = r.reporter_id
    order by r.status = 'new' desc, r.created_at desc limit 200;
end $$;

create or replace function public.admin_count_new_reports() returns integer
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.need_admin();
  return (select count(*) from private.reports where status = 'new');
end $$;

-- Ostrzeżenie z powodem (gracz zobaczy je w launcherze); czwarte banuje konto. Wynik: {warnings, banned}
create or replace function public.admin_warn(p_user uuid, p_reason text, p_report bigint) returns json
language plpgsql security definer set search_path = '' as $$
declare
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_n integer;
begin
  perform private.need_admin();
  if v_reason is null or length(v_reason) > 300 then raise exception 'warn_reason'; end if;
  if exists (select 1 from private.admins where user_id = p_user) then raise exception 'cannot_ban_admin'; end if;
  update public.profiles set warnings = warnings + 1 where id = p_user and banned_at is null returning warnings into v_n;
  if v_n is null then
    if exists (select 1 from public.profiles where id = p_user) then raise exception 'already_banned'; end if;
    raise exception 'player_missing';
  end if;
  insert into private.warnings (user_id, num, reason) values (p_user, v_n, v_reason);
  if v_n >= 4 then
    update public.profiles set banned_at = now(), ban_reason = v_reason where id = p_user;
    delete from private.presence where user_id = p_user;
  end if;
  if p_report is not null then update private.reports set status = case when v_n >= 4 then 'banned' else 'warned' end where id = p_report; end if;
  return json_build_object('warnings', v_n, 'banned', v_n >= 4);
end $$;

-- Ban od razu (np. oszustwo), bez czekania na cztery ostrzeżenia
create or replace function public.admin_ban(p_user uuid, p_reason text, p_report bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  perform private.need_admin();
  if v_reason is null or length(v_reason) > 300 then raise exception 'warn_reason'; end if;
  if exists (select 1 from private.admins where user_id = p_user) then raise exception 'cannot_ban_admin'; end if;
  update public.profiles set banned_at = now(), ban_reason = v_reason where id = p_user and banned_at is null;
  if not found then
    if exists (select 1 from public.profiles where id = p_user) then raise exception 'already_banned'; end if;
    raise exception 'player_missing';
  end if;
  delete from private.presence where user_id = p_user;
  if p_report is not null then update private.reports set status = 'banned' where id = p_report; end if;
end $$;

-- Zdjęcie bana: konto wraca z zerem ostrzeżeń
create or replace function public.admin_unban(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.need_admin();
  update public.profiles set banned_at = null, ban_reason = null, warnings = 0 where id = p_user;
  if not found then raise exception 'player_missing'; end if;
  update private.warnings set seen_at = coalesce(seen_at, now()) where user_id = p_user;
end $$;

create or replace function public.admin_dismiss_report(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.need_admin();
  update private.reports set status = 'dismissed' where id = p_id;
  if not found then raise exception 'report_missing'; end if;
end $$;

-- Wykres graczy (od 0.20.0): dzień po dniu (czas polski) profile z otwartym launcherem, z nich w grze i nowe profile.
-- Starsze niż 120 dni dane znikają.
create or replace function public.admin_activity(p_days integer)
returns table (day date, players integer, played integer, new_profiles integer)
language plpgsql security definer set search_path = '' as $$
declare
  v_days integer := least(greatest(coalesce(p_days, 30), 7), 90);
begin
  perform private.need_admin();
  delete from private.activity a where a.day < private.today() - 120;
  return query
    select d::date,
      (select count(*) from private.activity a where a.day = d::date)::integer,
      (select count(*) from private.activity a where a.day = d::date and a.played)::integer,
      (select count(*) from public.profiles p where (p.created_at at time zone 'Europe/Warsaw')::date = d::date)::integer
    from generate_series(private.today() - (v_days - 1), private.today(), interval '1 day') d
    order by 1;
end $$;

-- ===== Kosmetyki na Halloween (od 0.22.0) =====
-- Trafiają do listy kosmetyków; graczom daje je admin (kody, prezenty). Zmienionych w panelu admina nie nadpisują.
-- Skrzydła o teksturze szerokiej na co najmniej 128 pikseli to skrzydła jak u wróżki (dwa rozłożone skrzydła), węższe rysują się jak elytra.
-- Aura: obrazki cząsteczek 8×8 w pierwszym rzędzie tekstury, ruch z końcówki id.
insert into public.cosmetics (id, name, type, texture) values
  ('halloween_cape_pumpkin', 'Dyniowa', 'cape', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAYAAACinX6EAAAAyklEQVR4nO2XPQrCQBCFp7IyzRYewtpS0M4rWAteyNLWi1l7AvGHlRFeGJdREWwy8z4Yshm2yPs2JLsiItKNSv1nyZDQB55Ols86X2792OvZud9qMCLehfJkpBGw2JS6PXR5BUBCOgH7Wamn9filtJdCAMJfd/M+PMaQEFaAXfn7ceWOdU54ARq4FYD7FAI+VQoBWG278qneAARvK7wA+xfwPoLh/wLcB/wQKqwAbH3tGaDthRWgAXEAwtXrhRRACCGEEEIIIYTk4wHBcYGYsPJF6AAAAABJRU5ErkJggg=='),
  ('halloween_cape_bats', 'Nietoperze o zmierzchu', 'cape', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAKACAYAAAAsHn5DAAAFkklEQVR4nO3dTYolRRiF4TtyZE0cuAb3oHNX0ODQDbgLV9CrcBmCq3Dm2A00TfuHDVeSqIzMCBDEc54XgrzV2YOOQ1E033kr4vF4PB4vn3z257+5Hv8n/v4Hf/n5t0tr9+/+13tb4mpTf7z/6eOqDOC5+d9/+To/gO+++Pl0PQN4fl0XwLiiAxifVQH88Obdx3X8fLbiA7hbsQH8+P1vSys2gA9vvzpd47v4AJ6fn/+lHUOIDeDXbz79Z41fj+/iA7gKIjqAs++Esz+LDGBnCSAtAAAAAAAASuEHbAw54gYi/AB+AD+AH3DcYGUARzfgqi6PDoAfwA84dwMq6vGZFFEjSIyV+FVlHh0AP4AfUFiP1wcAAAAAAEAp/ICNIUfcQIQfwA/gB/AD6gMYzw+YVebxAdQKEndOQKUfcOYI1AVwFkhkAGe1eF09fleNxwfAD2itx+sDAAAAAACgFH7AxpAjbiDCD+AH8APU4/UB1Nfj9YLEnRtwfEYGcFeJx9fj/ICFX52PbocJEvyA4nq8PgAAAAAAAErhB2wMOeIGIvwAfgA/QD0+bnJ210BsAGc1eFU97n4B9wvc1+LR9fjVhsfPkQE4Xl8A/IDeerw+AAAAAAAASuEHbAw54gYi/AB+AD+AH3C20aoAztyAmTcQHwA/gB9wXZXXBPAyHJwQLUjMqvGadpgfwA8orsfrAwAAAAAAoBR+wMaQI24gwg/gB/AD+AH1AczODzhzByoCqBMkVt2A2AB2HIHIANwvcFGPH9/XBVBTj/MDmuvx+gAAAAAAACiFH7Ax5IgbiPAD+AH8APV4fQD19Xi9IHHnCDzfxwawWo1XB1DnBzg/oE2Q4Ae01uP1AQAAAAAAUAo/YGPIETcQ4QfwA/gB6vHZZse7BmIDuDpOv6Ied79A+/0CO45AZADjfQKzyxViA5j5AVX1uPsF+AGl9Xh9AAAAAAAAlMIP2BhyxA1E+AH8AH4AP+BqwxUBXLkBx/dVAfADmvyAWT1ec37A1eaP72IDuHMDjs+aAPgB/ICSerw+AAAAAAAASuEHbAw54gYi/AB+AD+AH1AfwN35AcdnVQA1gsTxDoFKP2DHEYgMwP0CC+cHxHaDK35AhSDBD2itx+sDAAAAAACgFH7AxpAjbiDCD+AH8APU4/UB1Nfj9YLEqiMQG8CKGxBdj/MDLvyAmnp85fCE6AD4Aa31eH0AAAAAAACUwg/YGHLEDUT4AfwAfoB6/G7Tz2dsACvH6kfX4+4XcL/A66P0q+rx55qFcHwXGcCdH1BRj7tfgB9QWo/XBwAAAAAAQCn8gI0hR9xAhB/AD+AH8ANWNh4dwKobUBkAP6DFD7iqx+P9gBVBIvpnwJ0j8NJ8fkBFPc4PaK7H6wMAAAAAAKAUfsDGkCNuIMIP4AfwA/gB9QHsOAKRAay6AbEBjA5ApR+w4gjEB1B9v8CKIxAbwMwF4AfwAwrq8foAAAAAAAAohR+wMeSIG4jwA/gB/AD1eH0A9fV4vSAxugEzRyA2gLOj9Kvq8Xo/4M4NiG+HZ/V4jSDBD2iux+sDAAAAAACgFH7AxpAjbiDCD+AH8APU48c7BK42HxvAjiMQGYD7Bdwv8LoGr6vHj3cIzEKIDWDl/IDodtj9AvyA4nq8PgAAAAAAAErhB2wMOeIGIvwAfgA/gB+wGkJsAMdfka88P4AfwA947QZU1ePjhisFidU7BiID4AfwA4rr8foAAAAAAAAohR+wMeSIG4jwA/gB/AB+QH0AO45AZAArm48OYOYCVPoBV45ATQB19wsc2+ErRyA6gHHz/AB+QEk9Xh8AAAAAAACl8AM2hhxxAxF+AD+AH6Aerw+gvh6vFyRmbsD4LjaAWRVeU4/zAy4q8Yp2+EyQ4AfwA0rq8foAAAAAAADo4y+JlesVYe7gZQAAAABJRU5ErkJggg=='),
  ('halloween_cape_bloodmoon', 'Krwawy księżyc', 'cape', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAYAAACinX6EAAAAm0lEQVR4nO2XMQqAMBAEr7ITwdq0+V9e4Ed9iJ2icHAeGhRscrsDywk27iQaFBGRvhu3PyMt8bXcNORXaUaEL7jkfAmUAC29lnLmTkJ4AbY4pACbOSU8AVoacgfAfgT1gXX6wn6GFFArGF7A8d7rih/Xvoy9H1aAlrTTB0KA3QlwAp5WP/wpUBMAcQzybxBZACGEEEIIIYQQgscO5soMcxzK+rIAAAAASUVORK5CYII='),
  ('halloween_hat_pumpkin', 'Dynia', 'hat', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAYAAACinX6EAAAAxElEQVR4nO2WMQqAMAxFnZx08SyOgtdwFryQo6u38woOSoZCqMVU0KrJfxCwFdP+n9o2ywSmutqWrggGvZNCyv95SOg6Ngfxrs+EAX7Fr6yCJ+Y0zGU6Y7nQtq82GpybkNIAN/6dOUW4UBqcJvGmAXfmi+KLv0BSzG+C6o9Bv5pn7dAKuPJ9qP22/igDKMo8/GzCABLsG8Db6g2QQr0Brtq88qZWgBPuhxkDVG+C0jkuHYMxd4Ff3xMAAAAAAAAAAACgjh3mKz+ytrVOUgAAAABJRU5ErkJggg=='),
  ('halloween_hat_lantern', 'Świecąca dynia', 'hat', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAYAAACinX6EAAAA0ElEQVR4nGNgIABmmQj9fxXBgxWD5AhhQuYPegDy6O9JNhieh4mNiABAj3FSUgEt3JS6mJd+AYvsUfskof8gy5EDgZ4BALOfmmYSBMgeBVkOcsRABgA1zSMKDMYsQFcw4gvBYV8NoscmPj62FECKfmz8gfY/UQEAwn8fuGNlj4gAAHn438/DcA+D2MiBMOwDgBAe9gEAi20QjcweUQEASvbIeEQFwLAuBAnV44SqQWLaAkO6nTAKRsEoGAWjYBSMglEwCkbBKBgFo2AUjIJhBwC6amckoHo7BgAAAABJRU5ErkJggg=='),
  ('halloween_hat_skull', 'Czaszka', 'hat', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAYAAACinX6EAAAAr0lEQVR4nO2WSwqAMAwFXblz4/1x4crriOAJFI+hKBRCaZpS0X7yBoJKqfCmwdg0Ase+nb5al9lb0vuzh4adxkG3AJcElQKoBHUC7E5QK0B9B0BALQKkgF9X6vy/C7DHaOr8rIC7fc191/ZPcc/Sfi581gJoxQgIOf1iBLwNnvU3wNWqUivTNWl/EQK4EGbNnLp9peMuRlAWY1Ka41yI0H3F/ycAAAAAAAAAAACgOi6e+0i1pfNj/gAAAABJRU5ErkJggg=='),
  ('halloween_hat_mummy', 'Mumia', 'hat', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAYAAACinX6EAAAA5UlEQVR4nO2VTQoCMQyFeyoXblx6SxeuvIcnEMG1C2XO4EIrEZRSOn3pHyPt+yDQmUxKXtJpjAFM95t17XI+/cx/Dhna/+9xxYas+wLEun/Y78YqwJAnwO+yK17ovgA5Xe+qAHPdH+YX8AXLL9FVAdCcb+2vlX/2Bto538pfQ3hRAdCcjx131N1Y/NdfKr5qAUK2Wa/s63G0z+v2sxaTtbyTNYpHlp14QEdWIJrz6FijeORfvAApo03b1ZSLMDXPLJExtALnviudCouKN8o5n3K7+/HIr8mviXBCCCGEEEIIIYQMyxtZ7YzJ3yCIyQAAAABJRU5ErkJggg=='),
  ('halloween_hat_ghost', 'Duch', 'hat', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAYAAACinX6EAAAAeklEQVR4nO3VMQqAMBBE0a3sbLz/pUTwOglaiexm0oSV+B+kkFXJTIqYCUU4j7251P8/jwIogAIogAIoYOICVMDRsvNTQM8m12W7V/RMARQweQEjZee366qKvGfeyavv1Tw7v0WbfN7lUQHeO96sNc/ODwAAAAAA/qcCHf2h0PcDX8UAAAAASUVORK5CYII='),
  ('halloween_wings_fire', 'Piekielny ogień', 'wings', 'data:image/png;base64,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'),
  ('halloween_wings_bone', 'Kościane skrzydła', 'wings', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAABACAYAAADS1n9/AAAC8klEQVR4nO2aSY4TQRBF4wbsetVrFlyBDUfhZCxYcR2ExHUaWSJbQSimLKedLvyeZJVk15AVP/JHDhYBuAe/f/18m/nsbi806Qr64/u3qQ+JspnVwn5++fr+iZ6pzyFR7sRKYT+9fHl7/fDxn+PlGZdjJf5A32tca++5MlHuEeOHphLWnuMJYsX2fp9NgCPPuBx1W/X9ove8fYQfHGvNXmCtI3SE0MfxnJk2RW3JksL2+Kwt3YT87+kEeARUHzOxPcuebZdXUrx7H2mjTZ6nprJYG1TtCN71kf3PtisrAzYpdI+3iVCVj/URPRlVgKNeNZKhU6dn7dYbVGZt1W2xCYADFFQ27vV8HXgpkuhorc1mFlo8T3ztBFX5WB/RE9JxAJsMlROM+14z0BplIGqj15YhescBVsbwtFQ2njlApxzcygG8Z0YOIIlL3SKmp2KmvmZie9+LEnK2Xfq6bsJ126rfeX1ET0ZnhO3NCuz50ffXlgBPZDu6j77vzFRWxvKUVIMkK+pYPvUC6iWBTC4CDbzFoEj80ZNtza/GJzhAYwAoExYsf0XQv68aAwzxozZHJYiBYEE2145svbJWfd2KWUDW86NSFV3nvfNTUzmAJ3a21CrO7OHoQlB3NO9N+cSsEOIAAXbJVZTYkcg6MaLA6uuv2Qvo7EBmDqGvF5PIbAYV26/a/sWIXW0I6W3Yow5gr60SzWtrNF5hN1Bhk0DU9mok8gisKGF0UO3/CWYTwO7nizMwHM/O5vve9jXiB1gn8KZ00QAxC6oWtEOWMNHsILJ5+w4In6CdQJQQ0ZKs7l2dwHaSoHOOXiGMXEqXEVH7EiRAwQjS6OGepdvetSOoepagS5ctGcMhEH8S2xN1ULUD7AzqENjau20T//07QBQ0OyLflQRWfEnKEAlwgCxodqFmZwJ0ajsJcCNmR/er2V2Cnh4SALYlAeI/ELsS4N7PBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADYwR/D3V6h8BlThQAAAABJRU5ErkJggg=='),
  ('halloween_aura_souls', 'Dusze', 'aura', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAYAAACinX6EAAAAV0lEQVR4nO3QsQ2AMAwEwEzAEMzIICzBROxBQ4sEShE6mxZLd1Kqd5H/1uC1nded5fN+pHlpvXwvGI0wsmyE0gP1z48X3UzLmhb8yn+vfAEAAAAAAAAIPX1EK5DOK+d6AAAAAElFTkSuQmCC'),
  ('halloween_aura_pumpkins', 'Dyniowe ogniki', 'aura', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAYAAACinX6EAAAAVElEQVR4nO3QsQmAQAwF0BvAynkES1ewdiQntHYFkZMU2mmlpnkPQpoEflIKXPqprdkZ0qxjU7e5q9HvZvZleHxQ7H8S7g9x+FnZWQAAAAAAAIDXHT+4Fef2M92hAAAAAElFTkSuQmCC'),
  ('halloween_aura_ghosts', 'Duszki', 'aura', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAYAAACinX6EAAAASklEQVR4nO3SQQrAIAwEQE+99eL/H1qkYJEgSB9goJ2BkOtuSCmEq919TnaW7dbyvzzCKHweta87O9NWPsABovB7AwAAAAAA8CEPeLBggf+J6XEAAAAASUVORK5CYII='),
  ('halloween_aura_magic', 'Czarna magia', 'aura', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAYAAACinX6EAAAAQUlEQVR4nO3SsREAEBAEQE3qUUOKUIHwjUQoZIbd9JL7n0sJlpJ73O5wzTy+1YjdE2Z+ttVhXy8AAAAAAAAA3jYAkQETRZ57KnUAAAAASUVORK5CYII=')
on conflict (id) do nothing;

-- ===== MiB Coins i sklep (od 0.23.0) =====
-- Saldo w profiles.coins, każda zmiana w historii. Coinsy kupuje się na stronie sklepu (link w app_config, przycisk
-- „Kup MiB Coins” w Kosmetykach); na razie dodaje je admin w panelu.
create table if not exists private.coin_log (
  id bigserial primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  delta integer not null,
  balance integer not null,
  reason text check (reason is null or length(reason) <= 200),
  by_admin uuid,
  created_at timestamptz not null default now()
);
create index if not exists coin_log_user on private.coin_log (user_id, created_at desc);

-- Ustawienia launchera widoczne dla wszystkich (także bez profilu): na razie tylko link do sklepu
create table if not exists public.app_config (
  key text primary key check (key in ('shop_url')),
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_config enable row level security;
revoke all on public.app_config from public, anon, authenticated;
grant select on public.app_config to anon, authenticated;
drop policy if exists app_config_read on public.app_config;
create policy app_config_read on public.app_config for select to anon, authenticated using (true);

-- Dodanie (albo zabranie, gdy p_amount < 0) coinsów graczowi; wynik: nowe saldo. W bazie mogła już być funkcja
-- o tej nazwie z innymi nazwami parametrów (np. p_note) — wtedy create or replace się nie uda, więc najpierw ją usuwamy.
drop function if exists public.admin_give_coins(uuid, integer, text);
create or replace function public.admin_give_coins(p_user uuid, p_amount integer, p_reason text) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v integer;
begin
  perform private.need_admin();
  if p_amount is null or p_amount = 0 or abs(p_amount) > 1000000 then raise exception 'coins_amount'; end if;
  if not exists (select 1 from public.profiles where id = p_user) then raise exception 'player_missing'; end if;
  update public.profiles set coins = coins + p_amount where id = p_user and coins + p_amount >= 0 returning coins into v;
  if v is null then raise exception 'coins_not_enough'; end if;
  insert into private.coin_log (user_id, delta, balance, reason, by_admin)
    values (p_user, p_amount, v, nullif(left(trim(coalesce(p_reason, '')), 200), ''), auth.uid());
  return v;
end $$;

-- Link do sklepu (tylko https); pusty usuwa przycisk „Kup MiB Coins”
drop function if exists public.admin_set_config(text, text);
create or replace function public.admin_set_config(p_key text, p_value text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.need_admin();
  if p_key is null or p_key not in ('shop_url') then raise exception 'config_key'; end if;
  if nullif(trim(coalesce(p_value, '')), '') is null then
    delete from public.app_config where key = p_key;
    return;
  end if;
  if length(trim(p_value)) > 300 or trim(p_value) !~ '^https://[^\s<>"''/]+\.[^\s<>"'']+$' then raise exception 'shop_url_invalid'; end if;
  insert into public.app_config (key, value) values (p_key, trim(p_value))
    on conflict (key) do update set value = excluded.value, updated_at = now();
end $$;

-- ===== Motywy świąteczne (od 0.25.0) =====
-- Wygląd każdego motywu jest wbudowany w launcher i mod; tutaj są daty, włączanie, „Włącz teraz” (forced), nagroda
-- świąteczna, dodatek do nagrody dziennej i kolekcja: kosmetyki z kolekcji są na sprzedaż tylko w czasie święta.
-- Daty: 'MM-DD' albo 'E-7' / 'E+2' (dni od Wielkanocy, liczonej co roku). Koniec przed początkiem = przez Nowy Rok.
create table if not exists public.themes (
  id text primary key check (id ~ '^[a-z]{3,20}$'),
  name text not null check (length(name) between 1 and 40),
  starts text not null check (starts ~ '^([0-9]{2}-[0-9]{2}|E[+-][0-9]{1,2})$'),
  ends text not null check (ends ~ '^([0-9]{2}-[0-9]{2}|E[+-][0-9]{1,2})$'),
  enabled boolean not null default true,
  forced boolean not null default false,
  gift_coins integer not null default 0 check (gift_coins between 0 and 100000),
  gift_cosmetic text references public.cosmetics (id) on delete set null,
  daily_bonus integer not null default 0 check (daily_bonus between 0 and 1000),
  items text[] not null default '{}',
  sort integer not null default 0
);
alter table public.themes enable row level security;
revoke all on public.themes from public, anon, authenticated;
grant select on public.themes to anon, authenticated;
drop policy if exists themes_read on public.themes;
create policy themes_read on public.themes for select to anon, authenticated using (true);
insert into public.themes (id, name, starts, ends, gift_coins, items, sort) values
  ('niepodleglosc', 'Święto Niepodległości', '11-08', '11-12', 50, '{niepodleglosc_cape_flaga,niepodleglosc_hat_kotylion,niepodleglosc_aura_iskry_magic}', 1),
  ('boze', 'Boże Narodzenie', '12-01', '01-06', 0, '{zima_cape_sweter,zima_cape_zorza,zima_cape_sniezynki,zima_hat_mikolaj,zima_hat_renifer,zima_hat_elf,zima_hat_balwan,zima_wings_lod,zima_aura_snieg_snow,zima_aura_prezenty_ghosts}', 2),
  ('sylwester', 'Sylwester', '12-31', '01-01', 100, '{sylwester_aura_fajerwerki_burst,sylwester_hat_cylinder,sylwester_cape_konfetti}', 3),
  ('walentynki', 'Walentynki', '02-10', '02-15', 50, '{walentynki_wings_amor,walentynki_aura_serca_souls,walentynki_hat_wianek}', 4),
  ('wielkanoc', 'Wielkanoc', 'E-7', 'E+2', 50, '{wielkanoc_hat_uszy,wielkanoc_hat_pisanka,wielkanoc_cape_pisanki,wielkanoc_aura_platki_snow,wielkanoc_wings_motyl}', 5),
  ('primaaprilis', 'Prima Aprilis', '04-01', '04-01', 1, '{primaaprilis_hat_blazen,primaaprilis_cape_glitch}', 6),
  ('urodzinymc', 'Urodziny Minecrafta', '05-17', '05-17', 50, '{urodzinymc_cape_trawa,urodzinymc_aura_kostki_ghosts}', 7),
  ('dziendziecka', 'Dzień Dziecka', '06-01', '06-01', 100, '{dziendziecka_hat_smiglo,dziendziecka_aura_banki_souls}', 8),
  ('wakacje', 'Wakacje', '06-25', '08-31', 100, '{wakacje_mask_okulary,wakacje_hat_slomkowy,wakacje_cape_palmy,wakacje_aura_babelki_souls,wakacje_wings_papuga}', 9),
  ('urodzinymib', 'Urodziny MiB Client', '10-10', '10-14', 200, '{urodzinymib_cape_rok,urodzinymib_aura_konfetti_snow,urodzinymib_hat_tort}', 10),
  ('halloween', 'Halloween', '10-15', '11-05', 50, '{halloween_cape_pumpkin,halloween_cape_bats,halloween_cape_bloodmoon,halloween_hat_pumpkin,halloween_hat_lantern,halloween_hat_skull,halloween_hat_mummy,halloween_hat_ghost,halloween_wings_fire,halloween_wings_bone,halloween_aura_souls,halloween_aura_pumpkins,halloween_aura_ghosts,halloween_aura_magic}', 11)
on conflict (id) do nothing;

-- Wielkanoc w roku y (algorytm Meeusa/Jonesa/Butchera, kalendarz gregoriański)
create or replace function private.easter(y integer) returns date
language plpgsql immutable set search_path = '' as $$
declare a integer := y % 19; b integer := y / 100; c integer := y % 100; d integer; e integer; f integer; g integer; h integer; i integer; k integer; l integer; m integer;
begin
  d := b / 4; e := b % 4; f := (b + 8) / 25; g := (b - f + 1) / 3; h := (19 * a + b - d - g + 15) % 30; i := c / 4; k := c % 4;
  l := (32 + 2 * e + 2 * i - h - k) % 7; m := (a + 11 * h + 22 * l) / 451;
  return make_date(y, (h + l - 7 * m + 114) / 31, (h + l - 7 * m + 114) % 31 + 1);
end $$;
-- Dzień z zapisu daty motywu ('MM-DD' albo 'E±n') w roku y
create or replace function private.theme_date(p_spec text, y integer) returns date
language sql immutable set search_path = '' as $$
  select case when p_spec like 'E%' then private.easter(y) + substr(p_spec, 2)::integer
    else make_date(y, substr(p_spec, 1, 2)::integer, substr(p_spec, 4, 2)::integer) end;
$$;
-- Okres motywu, który trwa w dniu p_day albo zaczyna się najbliższy po nim: rok sezonu (rok początku), od, do
create or replace function private.theme_span(t public.themes, p_day date, out season integer, out d_from date, out d_to date)
language plpgsql stable set search_path = '' as $$
declare y integer;
begin
  for y in extract(year from p_day)::integer - 1 .. extract(year from p_day)::integer + 1 loop
    d_from := private.theme_date(t.starts, y); d_to := private.theme_date(t.ends, y);
    if d_to < d_from then d_to := private.theme_date(t.ends, y + 1); end if;
    if d_to >= p_day then season := y; return; end if;
  end loop;
end $$;
-- Rok sezonu, gdy motyw trwa w dniu p_day (null, gdy nie trwa albo jest wyłączony); „Włącz teraz” trwa zawsze
create or replace function private.theme_season(t public.themes, p_day date) returns integer
language plpgsql stable set search_path = '' as $$
declare sp record;
begin
  if not t.enabled then return null; end if;
  if t.forced then return extract(year from p_day)::integer; end if;
  sp := private.theme_span(t, p_day);
  return case when p_day between sp.d_from and sp.d_to then sp.season end;
end $$;
-- Ostatni dzień trwającego motywu (do odliczania w sklepie); null, gdy nie trwa albo jest tylko wymuszony
create or replace function private.theme_until(t public.themes, p_day date) returns date
language sql stable set search_path = '' as $$
  select case when t.enabled and p_day between sp.d_from and sp.d_to then sp.d_to end from private.theme_span(t, p_day) sp;
$$;
-- Czy kosmetyk z ceną można teraz kupić: spoza kolekcji zawsze, z kolekcji tylko w czasie jej święta
create or replace function private.on_sale(p_cosmetic text, p_day date) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.themes t where p_cosmetic = any (t.items))
    or exists (select 1 from public.themes t where p_cosmetic = any (t.items) and private.theme_season(t, p_day) is not null);
$$;

-- ===== Sklep za MiB Coins (od 0.24.0) =====
-- Kosmetyki z ceną (cosmetics.price, null = nie na sprzedaż) i oferty (pakiety albo jeden kosmetyk taniej, z datą
-- końca) kupuje się za coinsy w launcherze; kosmetyk można też kupić znajomemu (trafia do jego prezentów). Do tego
-- nagroda dzienna: 10 coinsów za każdy dzień, a co 7. dzień z rzędu 50 więcej. Każda zmiana salda jest w coin_log.
alter table public.cosmetics add column if not exists price integer check (price is null or price between 1 and 1000000);
alter table private.coin_log add column if not exists kind text not null default 'admin' check (kind in ('admin', 'buy', 'gift', 'offer', 'daily'));
alter table private.coin_log add column if not exists item text;
alter table private.coin_log add column if not exists to_user uuid references public.profiles (id) on delete set null;

create table if not exists private.shop_offers (
  id bigint generated always as identity primary key,
  name text not null check (length(name) between 1 and 40),
  items text[] not null check (cardinality(items) between 1 and 20),
  price integer not null check (price between 1 and 1000000),
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists private.daily (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  last_day date not null,
  streak integer not null default 1
);

-- Gracz ma kosmetyk albo czeka on na niego w prezentach
create or replace function private.has_cosmetic(p_user uuid, p_cosmetic text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.owned_cosmetics where user_id = p_user and cosmetic_id = p_cosmetic)
    or exists (select 1 from private.gifts where user_id = p_user and cosmetic_id = p_cosmetic and claimed_at is null);
$$;

-- Cena oferty dla gracza: pełna, gdy nie ma żadnego przedmiotu z oferty, 0, gdy ma wszystkie, a gdy ma część —
-- tyle, ile ze zwykłych cen przypada na brakujące (zaokrąglone w górę; bez zwykłych cen: według liczby przedmiotów)
create or replace function private.offer_price(p_offer bigint, p_user uuid) returns integer
language sql stable security definer set search_path = '' as $$
  with it as (
    select coalesce(c.price, 0) as price, private.has_cosmetic(p_user, c.id) as has
    from private.shop_offers s cross join lateral unnest(s.items) as x(id) join public.cosmetics c on c.id = x.id
    where s.id = p_offer
  ), t as (
    select coalesce(sum(price), 0) as full_p, coalesce(sum(price) filter (where not has), 0) as miss_p,
      count(*) as n, count(*) filter (where not has) as miss_n from it
  )
  select case when t.miss_n = 0 then 0
    when t.miss_n = t.n then s.price
    when t.full_p > 0 then greatest(1, ceil(s.price::numeric * t.miss_p / t.full_p)::integer)
    else greatest(1, ceil(s.price::numeric * t.miss_n / t.n)::integer) end
  from private.shop_offers s, t where s.id = p_offer;
$$;

-- Sklep: saldo, kosmetyki na sprzedaż i z aktualnych ofert (owned: gracz już go ma albo czeka w prezentach; price
-- tylko gdy można go teraz kupić osobno), aktualne oferty (full: suma zwykłych cen, mine: cena dla tego gracza) i od
-- 0.25.0 trwające święta z kolekcją (until: ostatni dzień)
drop function if exists public.shop();
create or replace function public.shop() returns json
language sql stable security definer set search_path = '' as $$
  with me as (select auth.uid() as id, private.today() as day),
  offers as (select * from private.shop_offers where ends_at is null or ends_at > now())
  select json_build_object(
    'coins', (select p.coins from public.profiles p, me where p.id = me.id),
    'items', coalesce((select json_agg(json_build_object('id', c.id, 'name', c.name, 'type', c.type, 'texture', coalesce(c.texture, c.image_url),
        'price', case when private.on_sale(c.id, me.day) then c.price end, 'owned', private.has_cosmetic(me.id, c.id)) order by c.price nulls last, c.name)
      from public.cosmetics c, me where (c.price is not null and private.on_sale(c.id, me.day)) or exists (select 1 from offers o where c.id = any(o.items))), '[]'::json),
    'themes', coalesce((select json_agg(json_build_object('id', t.id, 'name', t.name, 'until', private.theme_until(t, me.day), 'items', t.items) order by t.sort)
      from public.themes t, me where cardinality(t.items) > 0 and private.theme_season(t, me.day) is not null), '[]'::json),
    'offers', coalesce((select json_agg(json_build_object('id', o.id, 'name', o.name, 'items', o.items, 'price', o.price,
        'full', (select coalesce(sum(c.price), 0) from public.cosmetics c where c.id = any(o.items)),
        'mine', private.offer_price(o.id, me.id), 'ends_at', o.ends_at) order by o.ends_at nulls last, o.id)
      from offers o, me), '[]'::json));
$$;

-- Zakup kosmetyku dla siebie (p_for puste) albo w prezencie dla znajomego (z wiadomością); wynik: saldo po zakupie
create or replace function public.buy_cosmetic(p_cosmetic text, p_for uuid default null, p_message text default null) returns json
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_to uuid := coalesce(p_for, auth.uid());
  v_msg text := nullif(btrim(regexp_replace(regexp_replace(coalesce(p_message, ''), '§.?', '', 'g'), '[[:cntrl:]]+', ' ', 'g')), '');
  c public.cosmetics;
  v integer;
  v_gift bigint;
begin
  if v_me is null then raise exception 'not_logged_in'; end if;
  if private.is_banned(v_me) then raise exception 'banned'; end if;
  select * into c from public.cosmetics where id = p_cosmetic;
  -- kosmetyk z kolekcji świątecznej (od 0.25.0) można kupić tylko w czasie święta
  if not found or c.price is null or not private.on_sale(c.id, private.today()) then raise exception 'not_for_sale'; end if;
  if v_to <> v_me then
    if not private.are_friends(v_me, v_to) or private.is_blocked(v_me, v_to) then raise exception 'gift_not_friend'; end if;
    if v_msg is not null and length(v_msg) > 200 then raise exception 'gift_message_long'; end if;
  end if;
  -- oba profile zablokowane (zawsze w tej samej kolejności): dwa zakupy naraz nie dadzą jednego kosmetyku dwa razy
  perform 1 from public.profiles where id in (v_me, v_to) order by id for update;
  if private.has_cosmetic(v_to, c.id) then
    if v_to = v_me then raise exception 'already_owned'; end if;
    raise exception 'friend_has_it';
  end if;
  update public.profiles set coins = coins - c.price where id = v_me and coins >= c.price returning coins into v;
  if v is null then raise exception 'coins_not_enough'; end if;
  if v_to = v_me then
    insert into public.owned_cosmetics (user_id, cosmetic_id, source) values (v_me, c.id, 'shop');
    insert into private.coin_log (user_id, delta, balance, reason, kind, item) values (v_me, -c.price, v, c.name, 'buy', c.id);
  else
    insert into private.gifts (user_id, cosmetic_id, message, from_user) values (v_to, c.id, v_msg, v_me) returning id into v_gift;
    insert into private.coin_log (user_id, delta, balance, reason, kind, item, to_user) values (v_me, -c.price, v, c.name, 'gift', c.id, v_to);
  end if;
  return json_build_object('coins', v, 'id', c.id, 'name', c.name, 'type', c.type, 'gift', v_gift);
end $$;

-- Zakup oferty: przedmioty, których gracz jeszcze nie ma, za cenę z offer_price
create or replace function public.buy_offer(p_offer bigint) returns json
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  s private.shop_offers;
  v_price integer;
  v_items text[];
  v integer;
begin
  if v_me is null then raise exception 'not_logged_in'; end if;
  if private.is_banned(v_me) then raise exception 'banned'; end if;
  perform 1 from public.profiles where id = v_me for update;
  select * into s from private.shop_offers where id = p_offer and (ends_at is null or ends_at > now());
  if not found then raise exception 'offer_missing'; end if;
  v_price := coalesce(private.offer_price(s.id, v_me), 0);
  if v_price = 0 then raise exception 'already_owned'; end if;
  select array_agg(c.id) into v_items from public.cosmetics c where c.id = any(s.items) and not private.has_cosmetic(v_me, c.id);
  update public.profiles set coins = coins - v_price where id = v_me and coins >= v_price returning coins into v;
  if v is null then raise exception 'coins_not_enough'; end if;
  insert into public.owned_cosmetics (user_id, cosmetic_id, source) select v_me, x, 'shop' from unnest(v_items) as x;
  insert into private.coin_log (user_id, delta, balance, reason, kind, item) values (v_me, -v_price, v, s.name, 'offer', s.id::text);
  return json_build_object('coins', v, 'price', v_price, 'items', to_json(v_items));
end $$;

-- Historia coinsów gracza: 50 ostatnich zmian (albo 50 przed p_before); friend = komu kupił prezent
create or replace function public.my_coin_log(p_before bigint default null)
returns table (id bigint, delta integer, balance integer, kind text, item text, label text, friend text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select l.id, l.delta, l.balance, l.kind, l.item, l.reason, f.nick, l.created_at
  from private.coin_log l left join public.profiles f on f.id = l.to_user
  where l.user_id = (select auth.uid()) and (p_before is null or l.id < p_before)
  order by l.id desc limit 50;
$$;

-- Nagroda dzienna (doba w czasie polskim): 10 coinsów, co 7. dzień z rzędu 50 więcej; drugi raz tego dnia: claimed = false
create or replace function public.claim_daily() returns json
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_day date := private.today();
  v_streak integer;
  v_amount integer;
  v_bonus integer;
  v integer;
begin
  if v_me is null then raise exception 'not_logged_in'; end if;
  if private.is_banned(v_me) or not exists (select 1 from public.profiles where id = v_me) then
    return json_build_object('claimed', false);
  end if;
  insert into private.daily as d (user_id, last_day, streak) values (v_me, v_day, 1)
    on conflict (user_id) do update set streak = case when d.last_day = v_day - 1 then d.streak + 1 else 1 end, last_day = v_day
    where d.last_day < v_day
    returning d.streak into v_streak;
  if v_streak is null then
    return json_build_object('claimed', false, 'streak', (select streak from private.daily where user_id = v_me));
  end if;
  -- w czasie święta dodatek z panelu admina (od 0.25.0; najwyższy z trwających)
  v_bonus := coalesce((select max(t.daily_bonus) from public.themes t where private.theme_season(t, v_day) is not null), 0);
  v_amount := 10 + case when v_streak % 7 = 0 then 50 else 0 end + v_bonus;
  update public.profiles set coins = coins + v_amount where id = v_me returning coins into v;
  insert into private.coin_log (user_id, delta, balance, kind, item) values (v_me, v_amount, v, 'daily', v_streak::text);
  return json_build_object('claimed', true, 'amount', v_amount, 'streak', v_streak, 'coins', v, 'bonus', v_bonus);
end $$;

-- Cena kosmetyku w sklepie (null zdejmuje go ze sprzedaży)
create or replace function public.admin_set_price(p_id text, p_price integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.need_admin();
  if p_price is not null and p_price not between 1 and 1000000 then raise exception 'price_invalid'; end if;
  update public.cosmetics set price = p_price where id = p_id;
  if not found then raise exception 'cosmetic_missing'; end if;
end $$;

-- Oferty: wszystkie (także zakończone) z liczbą sprzedanych
create or replace function public.admin_list_offers()
returns table (id bigint, name text, items text[], price integer, full_price integer, ends_at timestamptz, sold bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.need_admin();
  return query select s.id, s.name, s.items, s.price,
      (select coalesce(sum(c.price), 0)::integer from public.cosmetics c where c.id = any(s.items)), s.ends_at,
      (select count(*) from private.coin_log l where l.kind = 'offer' and l.item = s.id::text)
    from private.shop_offers s order by s.ends_at is not null and s.ends_at < now(), s.id desc;
end $$;

-- Nowa oferta (p_id puste) albo zmiana; p_ends: koniec oferty (puste = bez końca)
create or replace function public.admin_save_offer(p_id bigint, p_name text, p_items text[], p_price integer, p_ends timestamptz) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_items text[] := (select array_agg(distinct x) from unnest(coalesce(p_items, '{}')) as x where x is not null);
  v_id bigint;
begin
  perform private.need_admin();
  if length(btrim(coalesce(p_name, ''))) not between 1 and 40 then raise exception 'offer_name_invalid'; end if;
  if coalesce(cardinality(v_items), 0) not between 1 and 20
    or (select count(*) from public.cosmetics where id = any(v_items)) <> cardinality(v_items) then raise exception 'offer_items_invalid'; end if;
  if p_price is null or p_price not between 1 and 1000000 then raise exception 'price_invalid'; end if;
  if p_ends is not null and p_ends <= now() then raise exception 'offer_end_past'; end if;
  if p_id is null then
    insert into private.shop_offers (name, items, price, ends_at) values (btrim(p_name), v_items, p_price, p_ends) returning id into v_id;
  else
    update private.shop_offers set name = btrim(p_name), items = v_items, price = p_price, ends_at = p_ends where id = p_id returning id into v_id;
    if v_id is null then raise exception 'offer_missing'; end if;
  end if;
  return v_id;
end $$;

create or replace function public.admin_delete_offer(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.need_admin();
  delete from private.shop_offers where id = p_id;
end $$;

-- Historia coinsów gracza dla admina (np. gdy gracz pisze, że coinsy zniknęły)
create or replace function public.admin_coin_log(p_user uuid)
returns table (id bigint, delta integer, balance integer, kind text, item text, label text, friend text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.need_admin();
  return query select l.id, l.delta, l.balance, l.kind, l.item, l.reason, f.nick, l.created_at
    from private.coin_log l left join public.profiles f on f.id = l.to_user
    where l.user_id = p_user order by l.id desc limit 100;
end $$;

-- ===== Kosmetyki na święta, nagrody świąteczne i kalendarz adwentowy (od 0.25.0) =====
-- 43 kosmetyki do motywów (ceny to propozycje, zmienia je admin). Nowy rodzaj: maska (osobne miejsce, razem z czapką).
-- Czapka z teksturą szeroką na 128 px (klatka 128×64) ma drugą kostkę nad głową: dolna od (0,0), górna od (64,0).
-- Kosmetyki adwent_* są tylko w kalendarzu adwentowym (bez ceny).
insert into public.cosmetics (id, name, type, price, texture) values
-- [kosmetyki-swieta]
  ('niepodleglosc_cape_flaga', 'Biało-czerwona', 'cape', 800, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAEACAYAAAADRnAGAAACc0lEQVR42u3dQUrzQBjH4ZxBvIzgjTyFJ/EcXsALuHXn0uV3gEoKgVCSyaD5wHn/zwOB0mzaN0Wk8+tkmqZperl7uJx5TCOZX/Dn17/LYn48H69v79djfa7kILYGsH7zEQPoufrzYwNIGMDex7/8AI6ufsQAWld/fj5qAGvlB/Bx/3g9lhc+P748PV+P23NlB7B+87cDKP0f4dYAzrj6Qw2g5+r/ZBAGMOIA9j7+5QdwdPUjBtC6+vPzpb8XAAAAgDDxfcDeUtjtQknpPqCnEYgJJBQiaYWIREYhohAJL0Q2lsHPWCIfdgBnNQLDDEAhohAJL0QkMgqR4EIEAAAAQukDdhZDlueXc2W/EWr9XHZ9rvwAFCIKEYWIAShEIguRxq9Ff7NIOvwAlucjBvA/GoHhBqAQUYgoRE7546cQ0QcAAADAEN8J6AM6lshLL4+3dpSOHMDWMplCRCGiEKnfB7S22leIVF4Y6WkEIvqA1iqRQsQAFCIKEYVI9T7grC109AEAAADw978TiO4Deu46XfrGy0c7SpcfgELEABQiCpHoQqRnC53yfUBPIxATSOwtkylEFCIGoBBRiChE9AEAAABQQXwf0HPX6fJ9QE8jEBNIKETSChGJjEJEIZJdiBztKF2+D+htBBQiChGFiAEoRBQi+gAAAACoQB9wsKN0/Rsvd9x1OmIAChGFiELEABQiiYVI7xJ53ABuz5UPJI4WSRUiChGFSFYgIZFJKEQAAAAglD6g46bL5ZfHWztKRw5ga5lMIaIQUYjU7wNaW+0rRBJuvHzWXaeH7QNaq0QKEQNQiChEFCLV+4C9LXT0AQAAAFDGN0ABn+f3gGG9AAAAAElFTkSuQmCC'),
  ('niepodleglosc_hat_kotylion', 'Kotylion', 'hat', 300, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAYAAACinX6EAAAAQklEQVR42u3UwQkAIAgFUIdonPafol2KDoWHFgjfA/HsV4wAAPjcTEoOP1q/VS6EE0DuLsAPKGZvPncBAAAAAPC2AM8vTdF0JqcVAAAAAElFTkSuQmCC'),
  ('niepodleglosc_aura_iskry_magic', 'Biało-czerwone iskry', 'aura', 900, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAYAAACinX6EAAAAO0lEQVR42u3SMQ0AIBADQEQgB/8q8FLCABsGnruk2y9tvjW4kuTr8sfrZvaRnW8/oPwAAAAAAAAAUNcCpMMcmbac23sAAAAASUVORK5CYII='),
  ('zima_cape_sweter', 'Świąteczny sweter', 'cape', 800, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAYAAACinX6EAAAAeklEQVR42u3XwQmAMBBE0alBvFuHYo+WYGP2ouxBkBx0A16S+Q+WXN1h0ChJ2of5/HPUktrljnFNTTNBxINO25KabgMIseDXSQN6DaBmKYsAgmUA9+LladWAJ6sGvKEBvAP4CngFYHcPsL8JZv4DAg3oMQAAAAAAAPxcr+xgRad0Rt8AAAAASUVORK5CYII='),
  ('zima_cape_zorza', 'Zorza polarna', 'cape', 1200, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAIACAYAAAAyrmqbAAAFYklEQVR42u3dMY5URxSF4Y4cmMRCbIDUEpLXYQl5Dd6JN+WYxEsgs+TEoUPHNlYNFHOpqXpN4GTu+X6p1CMgoG4/QavPX6dut9vt9uKb7z78n+v2nBh/4W9f/nC5BuP1a/7sXM9mEHNT737/d7uR337954tNtR3AbuODH//45fMQ2g6gvstzjY2P9eb9u89DaDuA+i6P17HGxscavzaH0HYA9V2e7/yr128f1vi9+dp2AHOD85Gvaw5irNYDqO/2abV/AsbrIHIAr37+/vIJGJ8T2g/g+Ph/+r2+AxgbnMsANpv/tNoO4M+//v7w05uXDxseP481f44ZwNUawxmvbQfwtbQcAAAAAAAAofAD+AGPmzy5AbF+QKQgMVPimhq3FySqHzA3X92A9oJE9QOqE1Cj89aCRPUDajIUI0jwA/gB135A22SIH8AP4AfwA/gB/AAAAAAAAOLgB/AD+AFPNj7WOCwZ5wfUE+RRfsDqBsT5AasbEOcH7NyAuAKFKzcgpkAh2g+4evf5AfwAfgA/gB/AD+AHAAAAAADQBX7AnS83ZvV+lB+wa5yPOz6/DiXKD1jdgDg/YHUDIv2A6gZE+gHVDYjxA05DiPEDxv/5J0uEH8AP4AfwA/gB/AB+AD8AAAAAAIAG8AP0BzxKECc3IC4en/cLRA1gdQNi/ICTGxBVoHB1fD6iQOEUj8cUKFxtPuaChdP9AvyA128fPifwA/gB/AB+AD+AH8APAAAAAACgA/wAfsCX/QH8AH7A0+6A9vH4VXfAHE7rePyqO2AOp3U8fnV8fg4n4vj8LhvMiMcPfkBOgcJFPD4vXuAH8AP4AfwAfgA/gB8AAAAAAEAH+AH8gMdNntyAqHh8psW1VCHq+PyuOyDm+PypOyDy+HyUH3Cq2I/yA67SYX4AP4AfwA/gB/AD+AH8AH4AAAAAAAA94Afc+XJjpsT8gCQ/YC1ViPMDdk9ClB+wugFxfsDqBkT4AbtK/TmcWD8gJx4vNfq7IfR/Au7cL8AP4AfwA/gB/AB+AD8AAAAAAIAu8AP0B3yUIK7cgJh4fCbBUX7Arjtg3VBEPF67A+qTEHN8vq7aIhF1fH4+AbVFIur4/MkPiHkC1v6AnAKFO37A+JzAD+AH8AP4AfwAfgA/AAAAAACADvAD+AEfNxnrB9Tb5+sQqh8Qc/v8rjsg5vb5U3dAXLv82h3QPhxd7xNYuwOi4vHdRQvR9wvUpT+AH8AP4AfwA/gB/AB+AAAAAAAADeAH8AOeHpWP8wN2sfi8WSLm+PzpXoEIP2B1A2L9gNoiEekH1A6BWD9gd7dAlB8wnwB+AD9APG4A/AB+AD+AHwAAAAAAQEP4AXe+3JgpMT8gzQ+YQ4m5ff6qOyDOD1jdgDg/YHUD4vyAdfNxfkBePF5q9Hebj/MD1iHwA/gB/AB+AD+AH8APAAAAAACgC/yA9P6AkQPWo/K71T4e3x2br35A+3j8XndA63D05AbUzbf+N2Ct1K9WSMzx+d29ApHH509uQNz9AtH9AbvNj88J/AB+AD+AH8AP4AfwAwAAAAAA6AA/wP0C1/0BMzBtLUic/IDaLdBakLjqDpiBaet4/Ko7YPoD7cPRq+6A9v0BOz9gjczj/IDY+wXi/QD3C4jHDYAfwA/gB/ADAAAAAADoDD+AH8APON4sEeMH3OsOiCpQ2HUHRByfP3UHxNwvcNUd0D4d3jkB/AB+AD9APG4A/AB+AD+AHwAAAAAAQD/4AXe+3JjV+5F+QE2N4/yAwQxM4/yA1Q2I8wNWNyDOD4gKR0/dAVHx+LrpvHi81OifUmJ+AD+AH8AP4AfwA/gB/AAAAAAAAJ43/wFofZ2yQJWs8gAAAABJRU5ErkJggg=='),
  ('zima_cape_sniezynki', 'Śnieżynki', 'cape', 900, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAIACAYAAAAyrmqbAAAD5ElEQVR42u3dMW4UQRCG0YkIIEGIGIkbEHMHLsalOAihQ0JyjAqppaaZmd6AxPW/J43ACwFbGiNwfe45juM43rx6+/w/r+MlqT/wt++/nkv9+Prdp8urfu/dr6+/98UMoP7Ad29+/FrrAdy9+XF3RA4g/g6I+TtgvUrMAN5//PLnKuPnZ1f7AewuAzCAgAHc/T3QdgAfPn996IocQIkYwNOPn3+98fq4/gU4f9x2APXm1mv+P8B4re0ArowhDC0HAAAAAKHi+4Cr9fj6WtuvCAkkBBICCYFEdCBxtgc82xEKJKzHDcAA2q/H53W4PiBpAGd9wHxHxPUBoxGYP47qA+b/A+gDAAAAoB99wGYpGrseF0gIJKzHBRIRd4DlqEBCIOFTQB/g/IDwQOKqD4g9P2BcJfb8gJU+AAAAAPrQB2xWYpFniwskBBICCYFETCCx2wnWm7ccFUgIJHwK6AMMIKAPmM8L0Acslz5AHwAAAABt6ANuvrAxP4I7bjcokBBICCQEEvHnBwgkBBICCYGEPkAf4PyAnD5gPi9AH6APAAAAgLb0AemP3hZICCQEEgKJ6EBiXoFbjwsk3AECibhA4pGj9fUB+gDnB+gD9AEAAADQhz7gYh2uDzAAgYRAQiCRFkjELkcFEgIJgYTnC8zXWSsgkNAH6AP0AfoAAAAA6EEfYD0ukHAHCCQEEsGBxNV6fH1NICGQEEgIJHz7vECicR8wv2l9gD5AHwAAAACd6QNshw1AIOEOEEgEBxK7pWjselwgIZAQSGQEErsuoN685wuknR+wBhIRfUDRB+gDAAAAIII+wHLUAAxAIOEOCA4kdkvRyIevCyQEEgIJ5weMNkAgkRBIeL7Acp21AvoAfQAAAAC0oQ94YDFqOWoABiCQcAckfu9wiewDBBICCYFETiAxr8CdH5AaSNz1AfXmPV9AH6APAAAAgE70AZtvmY3ZDQokrMcNwAAiA4nds8dj+wCBhEBCIJEXSMQerx8fSFz1ARGBxK4LaB9I6AMAAAAgjz7AblAgIZDwKWAAzg/4Zx2uDzAAgYRAIiKQuFqPr68JJJLuAOcHTG1A+0BiZwxBHwAAAAB96AM2X9yoL4jYDQokBBI+BQzAelwg4Q4QSAgkQo7XP1uZCySSAomz8wRa9wEjgnB+wEUb0DaQAAAAgFD6gE0b0P47RgQStsMCCYGEPsB22AAEEu6A1EBid6x+RB8gkDg5P2DtBSICibuzBFr3AWMIni8AAAAAGfQB0wrcelwg4Q6wHhdI6AMsRw1AIOEOCBrA3ZH6JbIPiAsk1vMC1kAi8vyA9bWIQEIfAAAAAO39Bv26Pu4v8lPzAAAAAElFTkSuQmCC'),
  ('zima_hat_mikolaj', 'Czapka Mikołaja', 'hat', 600, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAABACAYAAADS1n9/AAAA00lEQVR42u3XQQrCMBAF0JxBvIzgXb2YO5cue4BKQV0EktSW2jR5DwKFUUic75CGUHA/X8fcCrRNAARAAARAAARAAARAAARAAARAALpq8NbrqL/b+PZr7XABuJ0ui2otB2Dad6rJqVq1Zy01aPJ4Dt9Dxc8tBWDOnnKfWVrbfZTlGrz2+6UJUlsAcnsq7ftz1lytu3vT2oDtNQn/XaeC5sfTKtW8+J+euhfFk0UIvAUJQW1Kd5St6zoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD9eQFaCQF1Wu4XtAAAAABJRU5ErkJggg=='),
  ('zima_hat_renifer', 'Rogi renifera', 'hat', 600, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAABACAYAAADS1n9/AAAAy0lEQVR42u3XwQ2CMBQGYGYgLuAADmDiBF4cxBW8OImLuUsJBxNCCjzgQG2+L2lI2v4c6KOFpgGAvMelTa/7Odv6MU9IAQAAFZz3e871vfkj9d80w+u4fy4zd481eQVwcAH8Wm4xc4uauw7vEc0rgAKLYLyoU3Oncrl5kX7+5BiIbP9r8hS0Ayz1r32ro/nipec7fU+3VPsOsDS25cMumi/ap72mvtX8FxQZi87bkkcBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlesAQHXIaG06738AAAAASUVORK5CYII='),
  ('zima_hat_elf', 'Czapka elfa', 'hat', 500, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAABACAYAAADS1n9/AAAAvElEQVR42u3XwQnCMBSA4QxRz94dQVzGiVzMEZzES6QHL4U2Qogvbb4PguCjYM2fiikVnB/XvLUSxyYAAQhAAAIQgAAEIAABCEAAAhhqg1uvPX1X7+cpz2u4AKb75af39h7A956i5mEBbG3wa7rl2dprbSA9HoaoeYjSBtdeXwqkt81f+1yt54dVG1jUT+G/53R0+peb1HpOZ6d/+ZhuPcffYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYCAfnVCFS2kT3YwAAAAASUVORK5CYII='),
  ('zima_hat_balwan', 'Bałwan', 'hat', 500, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAABACAYAAADS1n9/AAAAwElEQVR42u3XIQ7CMBSA4SoMCMSCQnIMDGfidFgEF8ByEdQjcwtpOkVbtu9LXiApgmw/Iy+lGTHj9ngWJ/HfBJDScThFbgQgAAEIQAACEIAABCAAAVgDF3iDf80dEEBz280+clPrXAAC6D+A8Qvn3gtgZU+A9/UQ98tOAP4CBLCIAMZVrbTiTR/536/Tz5RWxNJ5D9fgNZwjN7XOmwfQcnr99dcaeygAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKzPB/6Rszh/ZcLgAAAAAElFTkSuQmCC'),
  ('zima_wings_lod', 'Lodowe skrzydła', 'wings', 1500, 'data:image/png;base64,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'),
  ('zima_aura_snieg_snow', 'Płatki śniegu', 'aura', 1000, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAYAAACinX6EAAAAQ0lEQVR42u3UsRHAMAgEQfpvyoWoF79TBZILgN2EmBuGKqqS5DTHRXjWm7/l24bZl79FaB9o/AWM/wEAAAAAAAA09wG5rlmsWf0JKgAAAABJRU5ErkJggg=='),
  ('zima_aura_prezenty_ghosts', 'Prezenty', 'aura', 1000, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAYAAACinX6EAAAAU0lEQVR42u3TwQmAMAwF0M4gOozgri7UEZykl0rAXqoTmPcgkOaWT1PKo9Wtf/WpxOIpl7/Wo0eNAMY7TQDnsr8CiFm6rz+XE3ACAAAAAAAA/MYNp95U/Uua0HoAAAAASUVORK5CYII='),
  ('adwent_hat_pompon', 'Czapka z pomponem MiB', 'hat', null, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAABACAYAAADS1n9/AAAAqUlEQVR42u3WMQqEMBAF0BzHC3mMvZcXsrC2Wra0sIzYqbhaSELU9yBgGGzyxzEhnPhUXTxagWebQ27qcRX6cu+EXtAAJoAGiP8mgRMyAXAHwATAHYAHfuGplwQK+8fvPaesS6DwCfBt4+EyAW7uLOCr75sAGuxSg0EWcSN3nQLC73/Dbkip6xTSBMuActcBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAID3mACf8eUJC4gkwgAAAABJRU5ErkJggg=='),
  ('adwent_mask_broda', 'Broda Mikołaja', 'mask', null, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAYAAACinX6EAAAATElEQVR42u3WsQkAIAwEQPffyAVcwIEU7IOIleYOUlgmBD+lAFwagdTNpxoCABmiLnp/ne27Q+fLzI8arq2vSnH0nG6AjwIAAAB4xQRvc9XTLxu+lAAAAABJRU5ErkJggg=='),
  ('adwent_aura_gwiazdki_snow', 'Złote gwiazdki', 'aura', null, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAYAAACinX6EAAAAV0lEQVR42u3UwQmAMAwF0C7h0q7hOs7hAt4EifRQ9CC5G9+DQMntJ6GtcTvWKQwgcW5zlA3eK/YlxvstfO9nQ/j0BY3gWYiyF/Dc3u//AQAAAAAAAIq6ABeiNleuBGe1AAAAAElFTkSuQmCC'),
  ('adwent_cape_gwiazda', 'Gwiazda betlejemska', 'cape', null, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAEACAYAAAADRnAGAAACQ0lEQVR42u3dMUoEQRAF0I4MNBFZMxPBA3gRL+Y1vI7n8AJmgqy0UEsz2z0YmGzVezDoqsFOOatC/fm21lq7ubo9/ufRLkl/wt313fPp2D6Oo3/t7OOrr72YAfQn/PV+fzq2J3P8fKsxgH6iswGUvwLSD8DPgMkJbK+E74/XWgOIky5xBRweX5ZHH0K8n/oKWA0gfg2mHsDedz2OPoSSL4Hx8+kHsB3G+Pd9+gHMTnZ2pBzAw+Hp9wnH63z7ON6mHsBfDgPIOAAAAAAoqnw+YLUTjLV4md3g3mY4/XZ4zAeU3Q6XvQK2PwNWgyidDyg3APmASvmA2Tp8XIuXywfMAhPyAfIB8gHyAdbjBiAfAAAAAFnoD3Dv8P7d47Ei0x+gP0B/QN18QOrdoHyA/gD9AWdZAPkA+QD5APkA+QD5APkAAAAAyEp/wGInWGYzpD9Af4D+AP0B+gPkAwrnA2br8HEA+gPkA+QD5APkA+QD5APkAwAAACAR/QHuHd6/ezz+0YL+AP0B+gPq5gP6klQ+QD5Af0CNK2D2DxfkA+QD5APkA6zHDUA+AAAAALLQH7DYCcZa3N3j+gNcAfoD9AfoD5APyDuA2Tp8XIvrD5APkA+QD5APkA+QD5APAAAAgET0B7h3eP/u8ViR6Q/QH6A/oG4+IPVuUD5Af4D+gLMsgHyAfIB8gHyAfIB8gHwAAAAAZKU/YLETLLMZ0h+gP0B/gP4A/QHyAYXzAbN1+DgA/QHyAfIB8gHyAfIB8gHyAQAAAJDDD8V1/c2P7ww0AAAAAElFTkSuQmCC'),
  ('adwent_wings_aniol', 'Skrzydła anioła', 'wings', null, 'data:image/png;base64,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'),
  ('sylwester_aura_fajerwerki_burst', 'Fajerwerki', 'aura', 1200, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAYAAACinX6EAAAAWUlEQVR42u3SsRFAUBQEQEXQgDp0pAqpPnQjk4qFEplhnpHI/Pyzm150N1cU8Ii2i1R+Ln0yH7Yjsi4/l028jXCX38cq3ka4y9fTGtmP8NsHAAAAAAAAwLddgVUvjBjf2XYAAAAASUVORK5CYII='),
  ('sylwester_hat_cylinder', 'Sylwestrowy cylinder', 'hat', 600, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAABACAYAAADS1n9/AAAAqUlEQVR42u3XoQ7CMBCA4VMYDAIckjff6/A2OMwRxBJEBySE5tJ+X3KZqNr2p+siPtjvDvlugrEJIOJ8vGRrBCAAAQhAAAIQgAAEIAABMOAL/vdUfga91ksHsLX9rTNKAK176bVe8vv27Xfu10DsAJMeoCodpATgHCSAmd2vp8zbks/r6/Rap0AArem1jt9gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABgIg/jIyG/GBhkwgAAAABJRU5ErkJggg=='),
  ('sylwester_cape_konfetti', 'Złote konfetti', 'cape', 900, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAHACAYAAAASrm6yAAADM0lEQVR42u3cMUorURQG4KlsbCy0s5KsJr2rsHMFZiuK4Arcg2Bn7xJsIgREGLkDI5M4k9yAzZzzfXB5z/AKnXedCff8+ZumaZqv14v2P1czJ+UbPj05a9ubVffncJXXhq/3/7ZmzeZClG/08nwxuR7X379/D3sBjvmhUuyA/nd57PXwO+DpetOt1DtgaqW9Byzf73LsgM/b527ZAdmfAmOrXT/k2gH9o9AOyHAPuHr7yH0PeLlfVq2wF+CY5QJEuwAAAACQVPp8QDkTrDkXDH0q3IchtmYBO1+nnAyVgERZ5gKZdsC+aVH4HVDCEabDpsPbqwQkygq/A0o4wg7wFBhfoQMSU//bdoB8gHyAfIB8AAAAAMSkPyD7mWAJR6SfC2iQ0CBhOqxBQoOE6bAGCQ0SngIaJBI2SMgHyAfIBwAAAEA28gGVJ8AmQ5EDEhokNEhokDAd1iChQcJ0WIOEHeApkLBBQj5APkA+AAAAALKRD9Aqu6j6/LDJkAYJDRIaJNwDNEhokDAd1iChQcJTQD7AeNwFkA8AAACAOZMPMBnSKqtBQoOEBgkNEhokTIc1SGiQ8E5Qg4R8gHyAfIB8AAAAAMQnHzA4E9x3LmgypFVWg4TJkAYJDRIaJNwDNEhokPBOUIOEfIDxuAsgHwAAAAAzJh9QcSYY+kNTw1ZZp8ImQxokNEhokNAgoUFCg4QGCQ0S3gnqD5APkA+QDwAAAICo5ANMhw+3yqY4FdYgYTKkQUKDhAYJDRIaJDRIaJDQILGRD5APkA+QDwAAAIDI5AN2zgRNh02HNUjYAe4BGiQ0SGiQ0CChQUKDhAYJ+QD5APkA+QAAAAAISD5g5DAj7WSo/9CU6bDpsAYJO8A9QIOEBgkNEhokNEhokJAPkA+QD5APAAAAgGjkA0yH/57/p50NapAwHdYgYQe4B2iQ0CChQUKDhAaJRA0S8gHyAfIBAAAAkI18wIEzQXOBjK2yGiRMh02HNUjYAe4BGiTsAA0SGiRW+gPkA+QD5AMAAAAgGvmAkfO/sXPCtK2yfbOsuYAGCQ0SpsMaJDRIeApokNAg4SmgQUI+wHjcBZAPAAAAgJn6AVeDIQ1Xmv0/AAAAAElFTkSuQmCC'),
  ('walentynki_wings_amor', 'Skrzydła amorka', 'wings', 1200, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAABACAYAAADS1n9/AAACFUlEQVR42u2b3U3DMBRGOwTjMFWHYw0WYAAG4K0PICFVilzb99fOrXqOFCFR0HX8nTqOnVwuAFF+rh+/7fGMNcAZxu3z++GIhrWjBjgDaYPoMQpLWydSAxkWBC+FIXEMaVYro4ZFOBDCjwQyC6mttaoOEhivtW342YGMQskYZUZ12/PiUtH55rVDZ1YIvUB7ofT+JrMNo7nFywugCSwreIsAu9qDAEl8vb3/d/D9p3VY1vzPsUYWCJAUfntkC2CtgQAbBLgPq2cJkHF5YBKoWHDRXE+94Xsl8M4TmAQKAsw6UvpcMyxHBJBqaNuPAIIAx07MvDfXrgRmrjnMwkeAiQAZoXs6fEcbEEApQKRj22+fZzPIU8vaVgRQdG7kW+ldj7deDrzngQCLh//IenvWZhQCbBJgxXZsxnY0AiwWYMcDGb0HUhCggABnPHxh3bFEgMA6wIoJXqYIUQkQYBC+pmOfRYDjOSGAYS+gsgTW8NkLGCAFXlECb/i93yGAImzrAx4VBNCeCwIog5Y+qySA5TMECHReRQGs7UcAx3AvPeV7hgDaTSEEmNwFWCd+VQTwtJe7gMESq7ZD2/vrswTwtpUXQyYdu2O7d+cqIK+KOQTQDqtnDaXediKA8pIw6+Aqb+BKu4O8LZw4N6jcmVI7CT5RhsqdyZu/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADwAvwBy2uPl0pnQpkAAAAASUVORK5CYII='),
  ('walentynki_aura_serca_souls', 'Serduszka', 'aura', 1000, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAYAAACinX6EAAAAYUlEQVR42u3UwQmAMBAEQIuwHDvyZwc2ZRs2YAEW4M/HiUgghKSBOAPLfY5ANpBh4HOMU+Tzd5ePeY13ppQ717JFPrsroEytgJTWOfd+RhcltHa6fP3aPwAAAAAAAAD9eQAR+znDHbz3WwAAAABJRU5ErkJggg=='),
  ('walentynki_hat_wianek', 'Wianek z róż', 'hat', 500, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAYAAACinX6EAAAAj0lEQVR42u3VMQ6AIAxAUQ7B7s4RjJdxdvMGnsDbeBqP4V5TEhIG7UZCyn+LhC7YFhpC56ZzljsuEtckun72S+q94J31k5oI9wnQSv/FtBvcJ8Cq8vBXwOoON6w2H+IN4AqsKY+8MgLLOCx7LipszfnW8S4qXA5WH1S2I39bx7t76b/WreMAAAAAAAAAMIwXhfPS2SgGTXsAAAAASUVORK5CYII='),
  ('wielkanoc_hat_uszy', 'Uszy zająca', 'hat', 500, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAABACAYAAADS1n9/AAAAdUlEQVR42u3XsQnAIBBAUfffyAVsU2SJ7GCREAh2QeUakfcqFa4QfqEpQc/9+dsjAPdHAAAAbPDYm30ERudZOIB6XO38Xc8GMDLPAgHkcoYCiMwjAASAAPALQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMCmHk9NsxxAlluwAAAAAElFTkSuQmCC'),
  ('wielkanoc_hat_pisanka', 'Pisanka', 'hat', 500, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAABACAYAAADS1n9/AAAA3ElEQVR42u3XwQnCMBQG4C7hDK7gDI7jxatTeXMDNxCcwoN4qVQISont6ZG0+T54NPBOaf6mSdfNuG2P/VTt76fJ6lZiPO+uFQLw/x0IQAMB+J3r67r5VFMhEIDv4ufGAiAAAuAXIAAOgQLgGrjKBY6upSxwdL+Y9E8r9VzCFh/dtwNUdMofH/Ki+8UDsLs8+5LlA6ggAIO0ILlxZL/0/B+Hc1+y7AAVBGCQe6aK7BcPwNw1LrrsABXcAtJi5MbRfWcAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACgNW95ZBeaS/ZJhgAAAABJRU5ErkJggg=='),
  ('wielkanoc_cape_pisanki', 'Pisanki', 'cape', 800, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAYAAACinX6EAAAA3ElEQVR42u2XsQ3CQAxFPQQsQENLScEEYRNKGlpqBqKDCbIBiCkoEM2hf5KRdXIQSDSx/5O+clKuiH9834mIiKwPs/JPyZjAA2/Oi9Ld9q7sPewd2tdqNEbYoi7zXdWQIaENQOHPflqFtdcF4Q2w8rogtAHL06MoWHtZED4DULgtXo9EmhC05x2FXyerKjUhrAHeede3b7sgRQdoF9y3x3cmYB3eAO0CmwMoHEoxBr+ZBGmmQDsN0ozB9muwDccUIahfgqn+BWx7f7qGNeAXhTOAEEIIIYQQQgjJxwsb8NPJwkpApQAAAABJRU5ErkJggg=='),
  ('wielkanoc_aura_platki_snow', 'Płatki kwiatów', 'aura', 900, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAYAAACinX6EAAAAQ0lEQVR42u3TsRGAIAADQGZmJXZwDdawx84iNp4lPfK/QXJJKfC56pGtw9/9zKyEJNOCMlp+vYC8fAUAAAAAAACW8wBdHx+mDHtF+gAAAABJRU5ErkJggg=='),
  ('wielkanoc_wings_motyl', 'Skrzydła motyla', 'wings', 1200, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAABACAYAAADS1n9/AAACrklEQVR42u2b0U3EMAyGbwpmYAeWYQHG45kXlkDMAocqEclYtmM36bVHv0+Kinrcpbb/2kmaXi4Aozw9PF91u8c+YGUw3j6//7SF0WDp7y/ofhDETkFvQdYBsVr7v2yQZvSBGDYIvHb2mtYyQ9TX6O/r7EAEB4O/Nhhe8wLjlZMZ/RHJQq2V599fv6YH3ssC8rOZQlhs0HZRKgSLgxaWY3NWC0Y7NyPw0Z3pfT4qhHb9Uljy3HJEAL8O0Y7RbVbgrbFAVPvXCsGywbINARiO8lo26JmA9TLAyG9XbEIABWd5Ilhzl1YFkO2vag8CKDpMimCkTo8IwOt/jS2nF8DL48dVtozTRgdo3ixgdKCZuXZtLwJQDolEIB09e24+Y8TfE4JlKwIwnCJFIAdfI7OCrVcCLaHKa/bsRACOY3p3UyU1VxZerO+snfZJMSCApACkwzLjgKhlloAzS8KZvnp13xMCAjACXw3uFuvxa6eGUbOEwLMAx1G9DHCLhzEVEWRG/mwqCQRgOWjGquCs6xsRQJQJKAFBfYwE0UvDW2aqyiwgsosSIAQgj14J8MYCt76brL6jzKWDL48IQAU+MwPQy8F7lq/sMrBnJwJQDml//zcBWMFHAIYApMOyA8A9RGCNBaLge5ng9AKIAu6JYO+9d5VHwT27EEDBWdH07wgCsGYDPXsQQMFhR9l921sXQAATBdDOH2n7dfZ6MiUBASRrfuT03mPeLQQQPTZu14oAEuidslHNj0RwlAygP4tsWzi9APQLmL0dP57zjyCA3uBQv3zCs4BgibVXX/dK/14ZqGwtJ9Idp1ZFsPdCUPZ69xLr3WaB3v68ve+oTMaqvp4Oxtjg6K9ee6+wU+s3EMORncluHwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOAE/P4IyfVUMbVoAAAAASUVORK5CYII='),
  ('primaaprilis_hat_blazen', 'Czapka błazna', 'hat', 400, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAABACAYAAADS1n9/AAAA5ElEQVR42u3Y0Q2CMBQF0A6h27it6ziCW/jnDyZ+1YbXlhC1wDkJMYFCAveKrSk13E+XKd+et/PHltg3BVAABVAABTisMvCyEJ6QAqAAKAD7DLg1CWwd31KB5ia1tYluz/il5yvAn1c7vfujVVA5vnfcsAWYHtf3/uhz7wVYEmp0nXL8UPfeCnjt+VsrQCvYWvj5/UVftMPNndYW7NclaL2yo+N5wLU3rcnzoGoBRz9xvQFHb0BPfbDw5wLu+Su8FrBl9IbC/8YqRwEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIDSCyW4UkjF+oYYAAAAAElFTkSuQmCC'),
  ('primaaprilis_cape_glitch', 'Glitch', 'cape', 800, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAGACAYAAAAd9mTeAAADZ0lEQVR42u3dMY4UMRAF0I5ISIg4AAncgXOQ7wWIuRL3IVpxB9INF7U0LRlPuXsCkq3/ntRaQASM6ZrxlH/b27Zt2/t3H17/57W9Jfs/+PuX59dPv/7cXfufj9f+d79+fHroejMDMb6o359/3F3zi2o9AI+8qJYDMN/q1bXfDdF3QPwAtC6Bw89vL//c9vPv298B+wver/HX4ydBxABUP2M+BaoSGCdE3gQNQPBESAkoASXQcwAAAAAglHyAnuD5i9nXBtr3BGd6gmklMMdhtMUTS0A+oMgHRJWAfEB6CcR/ChwzPoujiROhOSgdOxGKDEuvbvk5Mi8fAAAAAH3IB+gJrjMBFke1xYPyAatucFwJxK0LWByVD5APUALyASZCJkLZJTBahSXkA+QDAAAAoA35gPSeYKVaJ4xpi88N0vYbKGiLWxmyMvTQAmnEHXCWEYgZgFVGIKYExoOW4krAp8BJWsxESAkYgL4lMMZknS8AAAAA/ckH6Aned4OjHpmJP2BBCWiLa4tfPjjdvgSu9g5oXwLHsvjxwucnSaNWhlarRN4EDUDzidD8sLSJkBKwhYZ8AAAAADQlH3Bri1sc1RP02JwSUALJbXHnCzhfoN47ICYl5nyB1DfBq+N12g/AVS4grgRW+4p5D0j5LjAmxeUDAAAAoCf5AIujTw8tkesJJuUDKhF3wGr7DCVgcVQ+IDcfoARuQUpvggYgYAsN3wWUQJ0TjvsuUJWDfAAAAAD0IR9QNETmNcL90hNMGoBqk+WonmD1KJ0SSDpjJDYic7ZAGnEHnGUEYgZglRFQAj4FDICNlFrfARUlcPteoATkAwAAAKAV+YAHmiHyAd17gnMWILYnWEVjIleGqk2WvQfYP6DpAKzYP8D+Ac4X8CkgH6AElEBuCThfAAAAAPqSD9ATvH5cRk8wvS1uZ2klEHL09ng5XyAtH3B85MkH3FaF5ANS3gRXT4ubCPkuEDYRqmKySkA+AAAAAFqSD9ATPH9o2uKonmBgW3zuDgtI2Fw96HyBcf8A5ws4X+DFRMhEyEQopASqqJwSSCqB/X9cPgAAAAAyyAfoCd7vGWBzdW1xj80pAfmA1HzAag+BmAE4do+QD0gsgSotdvz0KZA0EZo3Vo8ogatdJJRA5xJYnS8mHwAAAADt/AXcdjv5ibmprwAAAABJRU5ErkJggg=='),
  ('urodzinymc_cape_trawa', 'Blok trawy', 'cape', 700, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAYAAACinX6EAAAArElEQVR42u2WsQ2EMAwAPceXtDRfswIbUDAAo/ArfMcAbMBqIBdBIQqQggb7TrKUIAr7YkxERKRvPuuTIW9CEx6W7x7tWB32cei7v64uiteISAVcyTArIBR6dfrmO0CTDgLCWkPX5gWkiZ/tXQi4K8pNB+SemxVwVnRcuGkBmvB/mm/bnRlgVUB6+rlZ4GIG5ETwCXj4C3APKCzWtICSC5FJAQAAAAAAAAD+2ABKRwj1ExUNtwAAAABJRU5ErkJggg=='),
  ('urodzinymc_aura_kostki_ghosts', 'Bloki trawy', 'aura', 900, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAYAAACinX6EAAAAV0lEQVR42u3UsQmAQAwF0MxhaWtj7QpuYOEAjqI7udqJQiwcwbwHn1ybT7gIIrZzbN+UK2De+3f5+12qgGMZWmadumeWKyAXz5S9gCzDzwgAAAAAAMC/XBmRNGymYGvbAAAAAElFTkSuQmCC'),
  ('dziendziecka_hat_smiglo', 'Czapka ze śmigiełkiem', 'hat', 500, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAAEACAYAAAB7+X6nAAAB9klEQVR42u3dsU3DQBSA4QwBtLSMgBArUTEIC9AxABNkAxZAYhCgMSLSk5Jz7CdkCfvuvk9yk/gsw/2Kk+rtdomPi/vh+Ph+uzw5drRNAAIQgAAE0K3rp7vh+Ljdf54c/kMCQAAIgLo3ODb04eb9cJRf/r4erw5HfPmLdXF+rI/X47yp68b17IAA2HIAmZYCeH55HX6PuZ/Bc4/Ac+vL88vrrf5HZxu8dH3tAfzn+01aGpgAEAACQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAvDI8WgAAEIAABCKBPhkcLQAACEIAABND2BhsfLwABCGC8UZlWAoj7jPub+jk89ejL3s+uv5ql492z9TV9ApgdvMHABIAAEAACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAemF4tAAEIAABCEAAfTI8WgACEIAABCCAtjfY+HgBCEAA443K1B5AGfrcI+7c6Nfy/PJ62frVLR3vnq2v6RPA7OANBiYABIAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAANALw6MFIAABCEAAAuiT4dECEIAABCAAAbS9wcbHC0AAAhhvVKaVAOK+ph5t8Xqc99f3s+uvZul492x9TZ8AZgdvMDABIAAEgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIBG/AA2u67nFaTlTwAAAABJRU5ErkJggg=='),
  ('dziendziecka_aura_banki_souls', 'Bańki mydlane', 'aura', 900, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAYAAACinX6EAAAAWUlEQVR42u3UwQ2AIAwFUPbfwxHcwI28amqIcjHgXfreBULg0PaHUrgt+xHbekZdUxbf9vHo3asNmrIB78J6KWhno+aM3v0uAV+TnjYB6f8AAAAAAAAAErgA+xtA3uQoQ4gAAAAASUVORK5CYII='),
  ('wakacje_mask_okulary', 'Okulary przeciwsłoneczne', 'mask', 400, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAYAAACinX6EAAAAR0lEQVR42u3SoQ3AIBQEUFQNhgk6R8OI7MReOEgQTQ0K1fa95MTJ/3MhAADAFI/Ud/LJh1y19TOX+8hn/9UqVh0AAAAAeI0Baowkm4qUBlkAAAAASUVORK5CYII='),
  ('wakacje_hat_slomkowy', 'Słomkowy kapelusz', 'hat', 500, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAYAAACinX6EAAAAfklEQVR42u3UQQ2AMAyF4ScCOShAGjJwg4JdUIGBEQTQHprRMf4vIT2RsrcXJMdZ1rpvS32aaix7v6zl93xjvxWORr8B65A0gAbQABrwiwY03e/dcOupbN5HHtNsPtEQ0gPwDhh9P9qA7gOMBhQ94OcDGv0nDgAAAAAAAHTmAiP5e7O5lSm1AAAAAElFTkSuQmCC'),
  ('wakacje_cape_palmy', 'Zachód słońca', 'cape', 800, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAYAAACinX6EAAAAzElEQVR42u2SMQrCQBBFp0ojSApJZSWBHMIbeArvoOAdrDyDniZ1CgvvYKGV1coMThgWkS1sMvMffHYWUuS/HSIimlV1+mdoSvAPr5ttUfjb+f5UlMmIgICqTrfuUBS3ApaLVsIl7RxGwGvXjMU5fP8W1xugEvRUQghIz4tkLP65S8w9hgBbPotbAavhLmEBOnNhnTVuBehPswBbgiXkpdxugH39kBuQv36oDXhcjyKAz19xL6A/b2S2pw02AAIcCgAAAAAAAAAAAOLxBgYXM5o3DK1cAAAAAElFTkSuQmCC'),
  ('wakacje_aura_babelki_souls', 'Morskie bąbelki', 'aura', 900, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAYAAACinX6EAAAAUElEQVR42u3UwQmAMAwF0M7i7k7kHr14FeKh5CLqAMl7ECi5/U/oGCzbMSOnZfh8R8RnCWXLeQZ7C5q7vxL284qyBZS+gPZ/AAAAAAAAAA3c3TE1sNJCAWYAAAAASUVORK5CYII='),
  ('wakacje_wings_papuga', 'Skrzydła papugi', 'wings', 1200, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAABACAYAAADS1n9/AAACsElEQVR42u2cTU7DMBBGs2LDhgVsOQdCnJA7cQOOwEEQmyJQI5mRPfONYxJXfU+yKEVN7JkX/yVlWQC28vj8erLlEs8BG5IRlRnPAZ0JeXr7/FNGJilzLK8eZGxw4m2wewXwkpM9jlInMrgx+V6QeyS4vbn7LfZc6/sjkm/rRSYTXW5P8hUJbIJb9VBE6KlX1N6r5ev94VSWNTA/r7OBrkngJdTr+luf66mTbVdZEMAEpFZ6BFCuZGXst8fJJj4qCCAESZVgTZY6lmcmf+WxRyUfAZZl+bh/OdmSlcAmJrsayE78IhFa9a+1FQEqQWlJECU+EqA1EVSHDfX8avIRwBHAk0Dpim23bRPrrUZqn1OGnmzyESAQwEoQJd5LeLT8Usd/5fxq8hFAEKAMvB0KvMSM3gn0RLNdf/k3BOgUoAxgLbDKEDDyXoC6+ihFte1AAEGAMmCtwG7ZFfwPAbwewLYFARoC2KCVwfImgmrJ1it7/NoEUGnb1QuQDbS6GTNivz3TA/S2AwEaV4a3HMwMAaNuVvXs/kWTWgQ4DwGtcT8rwF6PhGUF8OYDCHAOSPnTBi4SYO9bqy0RbD1rvZptKwI0AuPtBczywIWVINoDqLURAUxw7OvWVTWbAK3eKmofAlSCsv7u3RCyW75HJN/bDbTS1noCBDAbQfbKtxJES7C9Vy7KZHBtQ0t0BKgIYIOnLP/2ngSqy8Ha1jACFLSCZd+b6elbZV8gag9PBFUE8IJ2aQIoyUeAQAAb0EsRwNYVARICeFe8J8EsAnh156FQcYs1eupmVgHUevPFkCCwUXdfe/rn6F1Atc4kPbGzpkpwtACz1/Uih4TMPf+j66qsCOjyB8wNZv3qNf8vYEcZZg4m3/wFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAr4BuyBo/wusHkMQAAAABJRU5ErkJggg=='),
  ('urodzinymib_cape_rok', '1 rok MiB', 'cape', 1500, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAEACAYAAAADRnAGAAAB5UlEQVR42u3dsW0CMRSAYS8RBqDKDmzAFPQoTSaAWRArMAUdFU1GSEOqCOkQSIdOluyKhve+T6JIlCJnBSe2f8WllFL+jx/DK1/lndy/4a/P87CYrZ6v1sf3r51+vvd6m4EYH+rv+9B9+PAD0Hv4+ek3/gDUDz++n6eDEXYAWg9fD074t0D98NPBGS67XHNA/RYwB2SaA8aHTTkHTB+2HhxzQPQ5oPW3fco5IN1a4PG7fr21Fuj9JKT6O6D1qzHcAAAAAEBS+gB7gvoAe4LOBvUB+gBng+aARh+w/NnoA/QB+gB9QK45wFpAH6APAAAAgMj0AfYE7QnaE3Q2qA/o9wHOBiMPQO9toA/QB5gD9AH6gMxrgf3lai2gD9AHAAAAQDj6AHuC+gD3Czgb1AfoA/QB5gD3C+gD9AH6APcL6AP0AfoAAAAAiE8fYE/Q/QL6AGeD+gD3CzgbNAfoA/QB+gB9gD7AWkAfoA8AAACA+PQB9gT1AfYEnQ3qA/QBzgbNAe4X0AfoA/QB/peYtYC1gD4AAAAA4tMH2BO0J2hP0NmgPsD9Au4XMAfoA/QB+gB9gLWA+wWsBfQBAAAAEJ8+wJ6gPsD9As4G9QH6AH2AOcD9AvoAfYA+wP0C+gB9gD4AAAAAQrsBVF69dTnKWFEAAAAASUVORK5CYII='),
  ('urodzinymib_aura_konfetti_snow', 'Urodzinowe konfetti', 'aura', 900, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAYAAACinX6EAAAAWElEQVR42u3SsQmAQBAEQJuwAUu0JbEFqxAMbMLI5I1UOPkCHkx9Z5INLtrlmgZe69Y9qi549FNcy1YsOaa7eIs0xDm3kfOzA+TyeYTffgAAAAAAAADU6wHltSDyfDFqYgAAAABJRU5ErkJggg=='),
  ('urodzinymib_hat_tort', 'Tort na głowie', 'hat', 600, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAAEACAYAAAB7+X6nAAACZElEQVR42u3dsWkDMRQGYE/hPuukzyJOm23cZAKv4DJDpAmkPEMwASucQcchRFw9JE7fBwL5VJn3nyS7ebvdA+mB3cb9fnyl/8bWv/89AJ/fU3WMEoA0HdP1db8UfZ7PzwRgkAC8v/zcRw7A+rMAOAIEQAAEwBEgANsNwPrSV14KhwiAn4EbPgJSY71s8WVhyy0/an1H32949FCBDgJwOZyWgtTmkesq0EEA3p6flqLkee1ZxLoKNDYXouVQgcZu0zm1HCpgB0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVjSO1DtY69jRW8dqHq15tPbxjgABEABHgCNgxACsL33lpdDPQEfAtgscrZctvixsueVHrfunqfM3PHqoQAcBuBxOS0Fq88h1FeggAHMP31yUPK89i1hXgcY0jx7cbTqnlkMF7AAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwIrGkXoHax07HZdWseVnARggAJpHax/vCBAAAXAEOAJcAoe8BPoZuOEjIDXWyxZfFrbc8qPW/dPU+RsePVSggwBcDqelILV55LoKdBCAuYdvLkqe155FrKtAY5pHD+42nVPLoQJ2AAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABgReNIvYOHbx17fd3fRy76+rMADBAAzaO1j3cECIAAOAIcAS6BQ14C/Qzc8BGQGutliy8LW275Uev+aer8DY8eKtBBAC6H01KQ2jxyXQU6CMDcwzcXJc9rzyLWVaAxzaMHd5vOqeVQATsAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIzkD4T+6m2e/MIzAAAAAElFTkSuQmCC')
-- [/kosmetyki-swieta]
on conflict (id) do nothing;

-- nowe rodzaje zmian coinsów: nagroda świąteczna i kalendarz adwentowy
alter table private.coin_log drop constraint if exists coin_log_kind_check;
alter table private.coin_log add constraint coin_log_kind_check check (kind in ('admin', 'buy', 'gift', 'offer', 'daily', 'theme', 'advent'));

-- Nagroda świąteczna: raz na każde święto w roku (coinsy i/lub kosmetyk z panelu admina)
create table if not exists private.theme_claims (
  user_id uuid not null references public.profiles (id) on delete cascade,
  theme_id text not null references public.themes (id) on delete cascade,
  season integer not null,
  claimed_at timestamptz not null default now(),
  primary key (user_id, theme_id, season)
);
-- Nagrody trwających świąt, których gracz jeszcze nie odebrał
create or replace function public.my_theme_gifts()
returns table (id text, name text, coins integer, cosmetic_id text, cosmetic_name text, type text, texture text, until date)
language sql stable security definer set search_path = '' as $$
  select t.id, t.name, t.gift_coins, c.id, c.name, c.type, coalesce(c.texture, c.image_url), private.theme_until(t, private.today())
  from public.themes t left join public.cosmetics c on c.id = t.gift_cosmetic
  where (select auth.uid()) is not null and not private.is_banned((select auth.uid()))
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()))
    and (t.gift_coins > 0 or t.gift_cosmetic is not null)
    and private.theme_season(t, private.today()) is not null
    and not exists (select 1 from private.theme_claims k where k.user_id = (select auth.uid()) and k.theme_id = t.id
      and k.season = private.theme_season(t, private.today()))
  order by t.sort;
$$;
create or replace function public.claim_theme_gift(p_theme text) returns json
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  t public.themes;
  c public.cosmetics;
  v_season integer;
  v integer;
  v_new boolean := false;
begin
  if v_me is null then raise exception 'not_logged_in'; end if;
  if private.is_banned(v_me) then raise exception 'banned'; end if;
  perform 1 from public.profiles where id = v_me for update;
  if not found then raise exception 'no_profile'; end if;
  select * into t from public.themes where id = p_theme;
  if not found then raise exception 'theme_missing'; end if;
  v_season := private.theme_season(t, private.today());
  if v_season is null or (t.gift_coins = 0 and t.gift_cosmetic is null) then raise exception 'theme_gift_missing'; end if;
  insert into private.theme_claims (user_id, theme_id, season) values (v_me, t.id, v_season) on conflict do nothing;
  if not found then raise exception 'theme_gift_claimed'; end if;
  if t.gift_coins > 0 then
    update public.profiles set coins = coins + t.gift_coins where id = v_me returning coins into v;
    insert into private.coin_log (user_id, delta, balance, reason, kind, item) values (v_me, t.gift_coins, v, t.name, 'theme', t.id);
  end if;
  if t.gift_cosmetic is not null then
    insert into public.owned_cosmetics (user_id, cosmetic_id, source) values (v_me, t.gift_cosmetic, 'theme') on conflict do nothing;
    v_new := found;
    select * into c from public.cosmetics where id = t.gift_cosmetic;
  end if;
  return json_build_object('coins', coalesce(v, (select coins from public.profiles where id = v_me)), 'amount', t.gift_coins,
    'cosmetic', case when c.id is null then null else json_build_object('id', c.id, 'name', c.name, 'type', c.type, 'texture', coalesce(c.texture, c.image_url), 'new', v_new) end);
end $$;

-- Kalendarz adwentowy: 24 dni (coinsy i/lub kosmetyk, zmienia admin), otwierany od 1 do 26 grudnia, gdy motyw
-- Bożego Narodzenia jest włączony; zaległe okienka do 26 grudnia. Nagrody widać dopiero po otwarciu.
create table if not exists private.advent_days (
  day integer primary key check (day between 1 and 24),
  coins integer not null default 0 check (coins between 0 and 100000),
  cosmetic_id text references public.cosmetics (id) on delete set null
);
insert into private.advent_days (day, coins, cosmetic_id)
  select d, case when d >= 20 then 0 when d = 6 then 100 when d = 13 then 50 when d < 6 then 20 when d < 13 then 25 else 30 end,
    case d when 20 then 'adwent_hat_pompon' when 21 then 'adwent_mask_broda' when 22 then 'adwent_aura_gwiazdki_snow' when 23 then 'adwent_cape_gwiazda'
      when 24 then 'adwent_wings_aniol' end
  from generate_series(1, 24) d
on conflict (day) do nothing;
create table if not exists private.advent_claims (
  user_id uuid not null references public.profiles (id) on delete cascade,
  year integer not null,
  day integer not null check (day between 1 and 24),
  claimed_at timestamptz not null default now(),
  primary key (user_id, year, day)
);
-- Dzień kalendarza, który można dziś otworzyć jako ostatni (0 = kalendarz zamknięty)
create or replace function private.advent_today(p_day date) returns integer
language sql stable security definer set search_path = '' as $$
  select case when extract(month from p_day) = 12 and extract(day from p_day) <= 26 and exists (select 1 from public.themes where id = 'boze' and enabled)
    then least(24, extract(day from p_day)::integer) else 0 end;
$$;
create or replace function public.advent() returns json
language sql stable security definer set search_path = '' as $$
  with me as (select auth.uid() as id, private.today() as day, extract(year from private.today())::integer as y)
  select json_build_object('open', private.advent_today(me.day) > 0, 'today', private.advent_today(me.day), 'year', me.y,
    'days', (select json_agg(json_build_object('day', a.day, 'kind', case when a.cosmetic_id is not null then 'cosmetic' else 'coins' end, 'opened', k.day is not null,
        'coins', case when k.day is not null then a.coins end,
        'cosmetic', case when k.day is not null and c.id is not null then json_build_object('id', c.id, 'name', c.name, 'type', c.type, 'texture', coalesce(c.texture, c.image_url)) end)
      order by a.day)
      from private.advent_days a left join public.cosmetics c on c.id = a.cosmetic_id
        left join private.advent_claims k on k.user_id = me.id and k.year = me.y and k.day = a.day))
  from me;
$$;
create or replace function public.claim_advent(p_day integer) returns json
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_today date := private.today();
  a private.advent_days;
  c public.cosmetics;
  v integer;
  v_new boolean := false;
begin
  if v_me is null then raise exception 'not_logged_in'; end if;
  if private.is_banned(v_me) then raise exception 'banned'; end if;
  perform 1 from public.profiles where id = v_me for update;
  if not found then raise exception 'no_profile'; end if;
  if private.advent_today(v_today) = 0 then raise exception 'advent_closed'; end if;
  if p_day is null or p_day < 1 or p_day > private.advent_today(v_today) then raise exception 'advent_locked'; end if;
  insert into private.advent_claims (user_id, year, day) values (v_me, extract(year from v_today)::integer, p_day) on conflict do nothing;
  if not found then raise exception 'advent_opened'; end if;
  select * into a from private.advent_days where day = p_day;
  if a.coins > 0 then
    update public.profiles set coins = coins + a.coins where id = v_me returning coins into v;
    insert into private.coin_log (user_id, delta, balance, reason, kind, item) values (v_me, a.coins, v, 'Kalendarz adwentowy', 'advent', p_day::text);
  end if;
  if a.cosmetic_id is not null then
    insert into public.owned_cosmetics (user_id, cosmetic_id, source) values (v_me, a.cosmetic_id, 'advent') on conflict do nothing;
    v_new := found;
    select * into c from public.cosmetics where id = a.cosmetic_id;
  end if;
  return json_build_object('day', p_day, 'coins', coalesce(v, (select coins from public.profiles where id = v_me)), 'amount', coalesce(a.coins, 0),
    'cosmetic', case when c.id is null then null else json_build_object('id', c.id, 'name', c.name, 'type', c.type, 'texture', coalesce(c.texture, c.image_url), 'new', v_new) end);
end $$;

-- ===== Panel admina: motywy i kalendarz =====
create or replace function public.admin_list_themes()
returns table (id text, name text, starts text, ends text, enabled boolean, forced boolean, gift_coins integer, gift_cosmetic text, gift_name text,
  daily_bonus integer, items text[], active boolean, d_from date, d_to date, claims bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.need_admin();
  return query select t.id, t.name, t.starts, t.ends, t.enabled, t.forced, t.gift_coins, t.gift_cosmetic, c.name, t.daily_bonus, t.items,
      private.theme_season(t, private.today()) is not null, sp.d_from, sp.d_to,
      (select count(*) from private.theme_claims k where k.theme_id = t.id and k.season = sp.season)
    from public.themes t left join public.cosmetics c on c.id = t.gift_cosmetic, lateral private.theme_span(t, private.today()) sp
    order by t.sort;
end $$;
-- Zmiana motywu; p_forced = „Włącz teraz” (tylko jeden naraz, włącza też motyw)
create or replace function public.admin_save_theme(p_id text, p_starts text, p_ends text, p_enabled boolean, p_forced boolean, p_gift_coins integer,
  p_gift_cosmetic text, p_daily_bonus integer, p_items text[]) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_items text[] := (select coalesce(array_agg(distinct x), '{}') from unnest(coalesce(p_items, '{}')) as x where x is not null);
begin
  perform private.need_admin();
  if not exists (select 1 from public.themes where id = p_id) then raise exception 'theme_missing'; end if;
  begin
    if p_starts !~ '^([0-9]{2}-[0-9]{2}|E[+-][0-9]{1,2})$' or p_ends !~ '^([0-9]{2}-[0-9]{2}|E[+-][0-9]{1,2})$' then raise exception 'x'; end if;
    perform private.theme_date(p_starts, 2028), private.theme_date(p_ends, 2028), private.theme_date(p_starts, 2027);
  exception when others then raise exception 'theme_date_invalid';
  end;
  if coalesce(p_gift_coins, 0) not between 0 and 100000 then raise exception 'coins_amount'; end if;
  if coalesce(p_daily_bonus, 0) not between 0 and 1000 then raise exception 'theme_bonus_invalid'; end if;
  if p_gift_cosmetic is not null and not exists (select 1 from public.cosmetics where id = p_gift_cosmetic) then raise exception 'cosmetic_missing'; end if;
  if (select count(*) from public.cosmetics where id = any (v_items)) <> cardinality(v_items) then raise exception 'theme_items_invalid'; end if;
  if coalesce(p_forced, false) then update public.themes set forced = false where id <> p_id; end if;
  update public.themes set starts = p_starts, ends = p_ends, enabled = coalesce(p_enabled, true) or coalesce(p_forced, false), forced = coalesce(p_forced, false),
    gift_coins = coalesce(p_gift_coins, 0), gift_cosmetic = p_gift_cosmetic, daily_bonus = coalesce(p_daily_bonus, 0), items = v_items
    where id = p_id;
end $$;
create or replace function public.admin_advent()
returns table (day integer, coins integer, cosmetic_id text, cosmetic_name text, cosmetic_type text, opened bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.need_admin();
  return query select a.day, a.coins, a.cosmetic_id, c.name, c.type,
      (select count(*) from private.advent_claims k where k.day = a.day and k.year = extract(year from private.today())::integer)
    from private.advent_days a left join public.cosmetics c on c.id = a.cosmetic_id order by a.day;
end $$;
create or replace function public.admin_set_advent_day(p_day integer, p_coins integer, p_cosmetic text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.need_admin();
  if p_day is null or p_day not between 1 and 24 then raise exception 'advent_day_invalid'; end if;
  if coalesce(p_coins, 0) not between 0 and 100000 then raise exception 'coins_amount'; end if;
  if p_cosmetic is not null and not exists (select 1 from public.cosmetics where id = p_cosmetic) then raise exception 'cosmetic_missing'; end if;
  if coalesce(p_coins, 0) = 0 and p_cosmetic is null then raise exception 'advent_empty'; end if;
  update private.advent_days set coins = coalesce(p_coins, 0), cosmetic_id = p_cosmetic where day = p_day;
end $$;

-- ===== Uprawnienia do funkcji =====
revoke all on function public.nick_available(text) from public, anon, authenticated;
revoke all on function public.redeem_code(text) from public, anon, authenticated;
revoke all on function public.set_recovery_code(text) from public, anon, authenticated;
revoke all on function public.reset_password_with_code(text, text, text) from public, anon, authenticated;
revoke all on function public.add_play_session(text, integer) from public, anon, authenticated;
revoke all on function public.delete_my_profile() from public, anon, authenticated;
revoke all on function public.create_my_profile(text) from public, anon, authenticated;
revoke all on function public.submit_idea(text, text) from public, anon, authenticated;
revoke all on function public.equip_cosmetic(text, text) from public, anon, authenticated;
revoke all on function public.mib_hello(text, text) from public, anon, authenticated;
revoke all on function public.mib_ping(uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.mib_who(uuid[], text[]) from public, anon, authenticated;
revoke all on function private.friend_target(text) from public, anon, authenticated;
revoke all on function public.friend_request(text) from public, anon, authenticated;
revoke all on function public.friend_answer(uuid, boolean) from public, anon, authenticated;
revoke all on function public.friend_remove(uuid) from public, anon, authenticated;
revoke all on function public.friends_list() from public, anon, authenticated;
revoke all on function public.presence_ping(boolean, text, text, boolean) from public, anon, authenticated;
revoke all on function public.presence_leave() from public, anon, authenticated;
revoke all on function private.make_profile(uuid, text) from public, anon, authenticated;
revoke all on function private.norm_code(text) from public, anon, authenticated;
grant execute on function public.nick_available(text) to anon, authenticated;
grant execute on function public.reset_password_with_code(text, text, text) to anon, authenticated;
grant execute on function public.redeem_code(text) to authenticated;
grant execute on function public.set_recovery_code(text) to authenticated;
grant execute on function public.add_play_session(text, integer) to authenticated;
grant execute on function public.delete_my_profile() to authenticated;
grant execute on function public.create_my_profile(text) to authenticated;
grant execute on function public.submit_idea(text, text) to authenticated;
grant execute on function public.equip_cosmetic(text, text) to authenticated;
grant execute on function public.mib_hello(text, text) to anon, authenticated;
grant execute on function public.mib_ping(uuid, text, boolean) to anon, authenticated;
grant execute on function public.mib_who(uuid[], text[]) to anon, authenticated;
grant execute on function public.friend_request(text) to authenticated;
grant execute on function public.friend_answer(uuid, boolean) to authenticated;
grant execute on function public.friend_remove(uuid) to authenticated;
grant execute on function public.friends_list() to authenticated;
grant execute on function public.presence_ping(boolean, text, text, boolean) to authenticated;
grant execute on function public.presence_leave() to authenticated;
revoke all on function public.game_invite(uuid) from public, anon;
revoke all on function public.game_invites_list() from public, anon;
revoke all on function public.game_invite_dismiss(uuid) from public, anon;
grant execute on function public.game_invite(uuid) to authenticated;
grant execute on function public.game_invites_list() to authenticated;
grant execute on function public.game_invite_dismiss(uuid) to authenticated;
revoke all on function private.are_friends(uuid, uuid) from public, anon, authenticated;
revoke all on function public.my_gifts() from public, anon;
revoke all on function public.claim_gift(bigint) from public, anon;
revoke all on function public.ideas_updates() from public, anon;
revoke all on function public.ideas_seen() from public, anon;
grant execute on function public.my_gifts() to authenticated;
grant execute on function public.claim_gift(bigint) to authenticated;
grant execute on function public.ideas_updates() to authenticated;
grant execute on function public.ideas_seen() to authenticated;
revoke all on function public.message_send(uuid, text) from public, anon;
revoke all on function public.messages_with(uuid, bigint) from public, anon;
revoke all on function public.messages_read(uuid) from public, anon;
revoke all on function public.messages_unread() from public, anon;
grant execute on function public.message_send(uuid, text) to authenticated;
grant execute on function public.messages_with(uuid, bigint) to authenticated;
grant execute on function public.messages_read(uuid) to authenticated;
grant execute on function public.messages_unread() to authenticated;
revoke all on function private.is_banned(uuid) from public, anon, authenticated;
revoke all on function private.is_blocked(uuid, uuid) from public, anon, authenticated;
revoke all on function private.today() from public, anon, authenticated;
revoke all on function public.block_user(uuid) from public, anon;
revoke all on function public.unblock_user(uuid) from public, anon;
revoke all on function public.blocked_list() from public, anon;
revoke all on function public.report_user(uuid, bigint, text, text) from public, anon;
revoke all on function public.my_warnings() from public, anon;
revoke all on function public.warnings_seen() from public, anon;
revoke all on function public.profile_card(uuid) from public, anon;
revoke all on function public.submit_crash(text, text) from public, anon;
grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.unblock_user(uuid) to authenticated;
grant execute on function public.blocked_list() to authenticated;
grant execute on function public.report_user(uuid, bigint, text, text) to authenticated;
grant execute on function public.my_warnings() to authenticated;
grant execute on function public.warnings_seen() to authenticated;
grant execute on function public.profile_card(uuid) to authenticated;
grant execute on function public.submit_crash(text, text) to authenticated;
revoke all on function private.idea_public(bigint) from public, anon, authenticated;
revoke all on function public.ideas_public(text) from public, anon;
revoke all on function public.idea_vote(bigint, boolean) from public, anon;
grant execute on function public.ideas_public(text) to authenticated;
grant execute on function public.idea_vote(bigint, boolean) to authenticated;
revoke all on function private.has_cosmetic(uuid, text) from public, anon, authenticated;
revoke all on function private.offer_price(bigint, uuid) from public, anon, authenticated;
revoke all on function public.shop() from public, anon;
revoke all on function public.buy_cosmetic(text, uuid, text) from public, anon;
revoke all on function public.buy_offer(bigint) from public, anon;
revoke all on function public.my_coin_log(bigint) from public, anon;
revoke all on function public.claim_daily() from public, anon;
grant execute on function public.shop() to authenticated;
grant execute on function public.buy_cosmetic(text, uuid, text) to authenticated;
grant execute on function public.buy_offer(bigint) to authenticated;
grant execute on function public.my_coin_log(bigint) to authenticated;
grant execute on function public.claim_daily() to authenticated;
revoke all on function private.easter(integer) from public, anon, authenticated;
revoke all on function private.theme_date(text, integer) from public, anon, authenticated;
revoke all on function private.theme_span(public.themes, date) from public, anon, authenticated;
revoke all on function private.theme_season(public.themes, date) from public, anon, authenticated;
revoke all on function private.theme_until(public.themes, date) from public, anon, authenticated;
revoke all on function private.on_sale(text, date) from public, anon, authenticated;
revoke all on function private.advent_today(date) from public, anon, authenticated;
revoke all on function public.my_theme_gifts() from public, anon;
revoke all on function public.claim_theme_gift(text) from public, anon;
revoke all on function public.advent() from public, anon;
revoke all on function public.claim_advent(integer) from public, anon;
grant execute on function public.my_theme_gifts() to authenticated;
grant execute on function public.claim_theme_gift(text) to authenticated;
grant execute on function public.advent() to authenticated;
grant execute on function public.claim_advent(integer) to authenticated;

-- panel admina: wywołać może każdy zalogowany, ale każda funkcja sama sprawdza, czy to admin
revoke all on function private.need_admin() from public, anon, authenticated;
revoke all on function private.random_code() from public, anon, authenticated;
revoke all on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated;
do $$
declare f text;
begin
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'admin\_%' loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
