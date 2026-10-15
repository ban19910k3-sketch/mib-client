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
  return json_build_object('cosmetic_id', c.id, 'name', c.name, 'type', c.type, 'image_url', c.image_url);
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

-- ===== Panel admina =====
-- Admin jest zapisany jako konto (nie numer MIB): przy pierwszym uruchomieniu tego pliku zostaje nim profil MIB-000002.
-- Późniejsze uruchomienia niczego tu nie zmieniają, nawet gdy numeracja zostanie wyzerowana.
create table if not exists private.admins (user_id uuid primary key references auth.users (id) on delete cascade);
insert into private.admins (user_id)
  select id from public.profiles where num = 2 and not exists (select 1 from private.admins);

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
    'versions', (select coalesce(json_agg(v), '[]'::json) from (
      select key as version, sum((value ->> 'min')::integer) as min, sum((value ->> 'runs')::integer) as runs
      from public.profiles, jsonb_each(version_stats) group by key order by 2 desc limit 5) v));
end $$;

create or replace function public.admin_find_players(p_q text)
returns table (id uuid, num bigint, nick text, email text, created_at timestamptz, founder boolean, playtime_min integer, launches integer)
language plpgsql stable security definer set search_path = '' as $$
declare
  q text := trim(coalesce(p_q, ''));
  like_q text := '%' || replace(replace(trim(coalesce(p_q, '')), '\', '\\'), '%', '\%') || '%';
begin
  perform private.need_admin();
  return query
    select p.id, p.num, p.nick, u.email::text, p.created_at, p.founder, p.playtime_min, p.launches
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
  if p_type not in ('cape', 'hat', 'wings') then raise exception 'cosmetic_type_invalid'; end if;
  insert into public.cosmetics (id, name, type, texture) values (p_id, trim(p_name), p_type, p_texture)
    on conflict (id) do update set name = excluded.name, type = excluded.type, texture = coalesce(excluded.texture, public.cosmetics.texture);
end $$;

create or replace function public.admin_delete_cosmetic(p_id text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.need_admin();
  if exists (select 1 from public.owned_cosmetics where cosmetic_id = p_id) or exists (select 1 from private.gift_codes where cosmetic_id = p_id) then
    raise exception 'cosmetic_in_use';
  end if;
  delete from public.cosmetics where id = p_id;
end $$;

drop function if exists public.admin_create_codes(text, integer, integer, integer);
create or replace function public.admin_create_codes(p_cosmetic text, p_count integer, p_max_uses integer, p_days integer) returns json
language plpgsql security definer set search_path = '' as $$
declare
  v text;
  out text[] := '{}';
begin
  perform private.need_admin();
  if not exists (select 1 from public.cosmetics where id = p_cosmetic) then raise exception 'cosmetic_missing'; end if;
  if p_count not between 1 and 100 or p_max_uses not between 1 and 100000 or (p_days is not null and p_days not between 1 and 3650) then raise exception 'codes_invalid'; end if;
  for i in 1..p_count loop
    loop
      v := private.random_code();
      exit when not exists (select 1 from private.gift_codes where code = v);
    end loop;
    insert into private.gift_codes (code, cosmetic_id, max_uses, expires_at)
      values (v, p_cosmetic, p_max_uses, case when p_days is null then null else now() + make_interval(days => p_days) end);
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

create or replace function public.admin_list_announcements()
returns table (id bigint, title text, body text, pinned boolean, visible_until timestamptz, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.need_admin();
  return query select a.id, a.title, a.body, a.pinned, a.visible_until, a.created_at from public.announcements a order by a.pinned desc, a.created_at desc;
end $$;

create or replace function public.admin_save_announcement(p_id bigint, p_title text, p_body text, p_pinned boolean, p_until timestamptz) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v bigint;
begin
  perform private.need_admin();
  if p_id is null then
    insert into public.announcements (title, body, pinned, visible_until) values (trim(p_title), coalesce(p_body, ''), coalesce(p_pinned, false), p_until) returning id into v;
  else
    update public.announcements set title = trim(p_title), body = coalesce(p_body, ''), pinned = coalesce(p_pinned, false), visible_until = p_until where id = p_id returning id into v;
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

-- ===== Uprawnienia do funkcji =====
revoke all on function public.nick_available(text) from public, anon, authenticated;
revoke all on function public.redeem_code(text) from public, anon, authenticated;
revoke all on function public.set_recovery_code(text) from public, anon, authenticated;
revoke all on function public.reset_password_with_code(text, text, text) from public, anon, authenticated;
revoke all on function public.add_play_session(text, integer) from public, anon, authenticated;
revoke all on function public.delete_my_profile() from public, anon, authenticated;
revoke all on function public.create_my_profile(text) from public, anon, authenticated;
revoke all on function private.make_profile(uuid, text) from public, anon, authenticated;
revoke all on function private.norm_code(text) from public, anon, authenticated;
grant execute on function public.nick_available(text) to anon, authenticated;
grant execute on function public.reset_password_with_code(text, text, text) to anon, authenticated;
grant execute on function public.redeem_code(text) to authenticated;
grant execute on function public.set_recovery_code(text) to authenticated;
grant execute on function public.add_play_session(text, integer) to authenticated;
grant execute on function public.delete_my_profile() to authenticated;
grant execute on function public.create_my_profile(text) to authenticated;

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
