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
  settings jsonb,
  settings_updated_at bigint,
  playtime_min integer not null default 0,
  launches integer not null default 0,
  version_stats jsonb not null default '{}'::jsonb
);
create unique index if not exists profiles_nick_lower on public.profiles (lower(nick));
alter table public.profiles enable row level security;
revoke all on public.profiles from public, anon, authenticated;
grant select on public.profiles to authenticated;
grant update (settings, settings_updated_at) on public.profiles to authenticated;
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated using (id = (select auth.uid()));
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Profil powstaje razem z kontem; nick przychodzi w danych rejestracji
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_nick text := new.raw_user_meta_data ->> 'nick';
  v_num bigint;
begin
  if v_nick is null or v_nick !~ '^[A-Za-z0-9_]{3,16}$' then
    raise exception 'nick_invalid';
  end if;
  if exists (select 1 from public.profiles where lower(nick) = lower(v_nick)) then
    raise exception 'nick_taken';
  end if;
  insert into public.profiles (id, nick) values (new.id, v_nick) returning num into v_num;
  update public.profiles set founder = (v_num <= 1000) where id = new.id;
  return new;
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
  code text primary key,
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
  locked_until timestamptz
);

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
  if exists (select 1 from private.reset_attempts where email = v_email and locked_until > now()) then
    raise exception 'reset_locked';
  end if;
  select u.id, r.hash into v_uid, v_hash
    from auth.users u join private.recovery r on r.user_id = u.id
    where lower(u.email) = v_email;
  if v_hash is null or extensions.crypt(private.norm_code(p_code), v_hash) <> v_hash then
    insert into private.reset_attempts as a (email, fails) values (v_email, 1)
      on conflict (email) do update set
        fails = case when a.locked_until is not null then 1 else a.fails + 1 end,
        locked_until = null
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
    version_stats = jsonb_set(version_stats, array[v_ver], jsonb_build_object(
      'min', coalesce((version_stats -> v_ver ->> 'min')::integer, 0) + v_min,
      'runs', coalesce((version_stats -> v_ver ->> 'runs')::integer, 0) + 1))
  where id = v_uid;
end $$;

-- ===== Kopia modów =====
create table if not exists public.mod_backups (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  game_version text not null,
  loader text,
  mods jsonb not null default '[]'::jsonb,
  skipped integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, game_version)
);
alter table public.mod_backups enable row level security;
revoke all on public.mod_backups from public, anon, authenticated;
grant select, insert, update, delete on public.mod_backups to authenticated;
drop policy if exists mod_backups_own on public.mod_backups;
create policy mod_backups_own on public.mod_backups for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ===== Usunięcie profilu (RODO) =====
create or replace function public.delete_my_profile() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_logged_in'; end if;
  delete from auth.users where id = auth.uid();
end $$;

-- ===== Uprawnienia do funkcji =====
revoke all on function public.nick_available(text) from public, anon, authenticated;
revoke all on function public.redeem_code(text) from public, anon, authenticated;
revoke all on function public.set_recovery_code(text) from public, anon, authenticated;
revoke all on function public.reset_password_with_code(text, text, text) from public, anon, authenticated;
revoke all on function public.add_play_session(text, integer) from public, anon, authenticated;
revoke all on function public.delete_my_profile() from public, anon, authenticated;
revoke all on function private.norm_code(text) from public, anon, authenticated;
grant execute on function public.nick_available(text) to anon, authenticated;
grant execute on function public.reset_password_with_code(text, text, text) to anon, authenticated;
grant execute on function public.redeem_code(text) to authenticated;
grant execute on function public.set_recovery_code(text) to authenticated;
grant execute on function public.add_play_session(text, integer) to authenticated;
grant execute on function public.delete_my_profile() to authenticated;
