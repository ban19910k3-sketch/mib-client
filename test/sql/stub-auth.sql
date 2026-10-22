-- Atrapa tego, co Supabase ma w bazie od początku (tylko do testów lokalnych).
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
create schema auth;
create schema extensions;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  encrypted_password text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create table auth.sessions (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users (id) on delete cascade);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth, public, extensions to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
-- Supabase domyślnie daje anon/authenticated pełne prawa do nowych obiektów w public
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
-- Atrapa rozszerzenia http (w Supabase włącza je schema.sql): odpowiedzi Mojanga (hasJoined) z tabeli extensions.fake_mojang
create table extensions.fake_mojang (name text, server_id text, id text);
create type extensions.http_response as (status integer, content_type varchar, headers text, content varchar);
create function extensions.http_set_curlopt(curlopt varchar, value varchar) returns boolean language sql as $$ select true $$;
create function extensions.http_get(uri varchar) returns extensions.http_response language sql as $$
  select coalesce(
    (select (200, 'application/json', null, json_build_object('id', f.id, 'name', f.name)::text)::extensions.http_response
       from extensions.fake_mojang f
       where uri = 'https://sessionserver.mojang.com/session/minecraft/hasJoined?username=' || f.name || '&serverId=' || f.server_id),
    (204, null, null, '')::extensions.http_response)
$$;

-- Funkcje założone kiedyś w bazie właściciela poza schema.sql, z innymi nazwami parametrów: schema.sql musi je zastąpić
create function public.admin_give_coins(p_user uuid, p_amount integer, p_note text) returns void language plpgsql as $$ begin end $$;
create function public.admin_set_config(p_name text, p_val text) returns boolean language plpgsql as $$ begin return true; end $$;
