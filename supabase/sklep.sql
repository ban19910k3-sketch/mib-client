-- MiB Client — sklep z kosmetykami i MiB Coins (dla strony internetowej).
-- Wklej całość w Supabase → SQL Editor → Run, PO pliku schema.sql z launchera.
-- Można uruchamiać wielokrotnie (nie kasuje danych). MiB Coins są wspólne z launcherem (profiles.coins). Launcher czyta z cosmetics tylko id, name, type i texture,
-- więc nowe kolumny niczego w nim nie zmieniają.

-- ===== Przedmioty: pola sklepu =====
alter table public.cosmetics add column if not exists price integer check (price is null or price between 0 and 1000000);
alter table public.cosmetics add column if not exists old_price integer check (old_price is null or old_price between 0 and 1000000);
alter table public.cosmetics add column if not exists description text check (description is null or length(description) <= 300);
alter table public.cosmetics add column if not exists rarity text not null default 'common' check (rarity in ('common', 'rare', 'epic', 'legendary'));
-- rzadkość halloween (od Halloween 2026): poprawiamy też starszą wersję tego ograniczenia
alter table public.cosmetics drop constraint if exists cosmetics_rarity_check;
alter table public.cosmetics add constraint cosmetics_rarity_check check (rarity in ('common', 'rare', 'epic', 'legendary', 'halloween'));
alter table public.cosmetics add column if not exists available_until timestamptz;
-- nowe i dotychczasowe przedmioty (np. z kodów) są w sklepie dopiero, gdy admin je pokaże
alter table public.cosmetics add column if not exists visible boolean not null default false;
alter table public.cosmetics add column if not exists featured boolean not null default false;
alter table public.cosmetics add column if not exists sort integer not null default 0;

-- ===== MiB Coins: te same co w launcherze (od 0.23.0) =====
-- Saldo jest w public.profiles.coins, historia w private.coin_log. Poniżej kopia tych definicji ze schema.sql
-- launchera, więc nie ma znaczenia, który plik wkleisz pierwszy.
alter table public.profiles add column if not exists coins integer not null default 0;
do $$ begin
  alter table public.profiles add constraint profiles_coins_not_negative check (coins >= 0);
exception when duplicate_object then null;
end $$;
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

-- Starsza wersja sklepu trzymała monety osobno (public.wallets). Przenosimy je raz na saldo w profilu,
-- a w starym portfelu zostaje 0 (ponowne uruchomienie niczego nie podwaja).
do $$
begin
  if to_regclass('public.wallets') is not null then
    insert into private.coin_log (user_id, delta, balance, reason)
      select w.user_id, w.coins, p.coins + w.coins, 'Przeniesione z poprzedniego portfela sklepu'
      from public.wallets w join public.profiles p on p.id = w.user_id where w.coins > 0;
    update public.profiles p set coins = p.coins + w.coins from public.wallets w where w.user_id = p.id and w.coins > 0;
    update public.wallets w set coins = 0 where w.coins > 0 and exists (select 1 from public.profiles p where p.id = w.user_id);
  end if;
end $$;

-- ===== Sklep dla graczy =====
-- Przedmioty widoczne w sklepie: pokazane, z ceną i nie po terminie
create or replace function public.shop_items()
returns table (id text, name text, type text, rarity text, description text, price integer, old_price integer,
               available_until timestamptz, featured boolean, image_url text, texture text)
language sql stable set search_path = '' as $$
  select c.id, c.name, c.type, c.rarity, c.description, c.price, c.old_price, c.available_until, c.featured, c.image_url, c.texture
  from public.cosmetics c
  where c.visible and c.price is not null and (c.available_until is null or c.available_until > now())
  order by c.featured desc, c.sort, c.created_at desc;
$$;

-- Stan zalogowanego gracza: monety, posiadane przedmioty, nick i czy to admin
create or replace function public.my_shop() returns json
language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'coins', coalesce((select p.coins from public.profiles p where p.id = auth.uid()), 0),
    'owned', coalesce((select json_agg(o.cosmetic_id) from public.owned_cosmetics o where o.user_id = auth.uid()), '[]'::json),
    'nick', (select p.nick from public.profiles p where p.id = auth.uid()),
    'admin', public.is_admin());
$$;

-- Zakup za MiB Coins. Wszystko w jednej transakcji: brak monet albo posiadany już przedmiot cofa całość.
create or replace function public.shop_buy(p_id text) returns json
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  c public.cosmetics;
  v_left integer;
begin
  if v_uid is null then raise exception 'not_signed_in'; end if;
  select * into c from public.cosmetics where id = p_id;
  if not found or not c.visible or c.price is null then raise exception 'item_unavailable'; end if;
  if c.available_until is not null and c.available_until <= now() then raise exception 'item_expired'; end if;
  if exists (select 1 from public.owned_cosmetics where user_id = v_uid and cosmetic_id = p_id) then raise exception 'already_owned'; end if;
  update public.profiles set coins = coins - c.price where id = v_uid and coins >= c.price returning coins into v_left;
  if v_left is null then raise exception 'not_enough_coins'; end if;
  insert into public.owned_cosmetics (user_id, cosmetic_id, source) values (v_uid, p_id, 'shop');
  insert into private.coin_log (user_id, delta, balance, reason) values (v_uid, -c.price, v_left, left('Sklep: ' || c.name, 200));
  return json_build_object('coins', v_left, 'cosmetic_id', p_id);
end $$;

-- Koszyk: kilka przedmiotów naraz, w jednej transakcji (wszystko albo nic).
-- p_total to suma, którą gracz widział: inna suma w bazie (zmiana ceny w międzyczasie) cofa zakup.
create or replace function public.shop_buy_many(p_ids text[], p_total integer) returns json
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_ids text[];
  v_n integer;
  v_total integer;
  v_left integer;
begin
  if v_uid is null then raise exception 'not_signed_in'; end if;
  select array_agg(distinct x) into v_ids from unnest(coalesce(p_ids, '{}'::text[])) x where x is not null;
  if v_ids is null then raise exception 'cart_empty'; end if;
  if cardinality(v_ids) > 50 then raise exception 'cart_too_big'; end if;
  select count(*), coalesce(sum(c.price), 0) into v_n, v_total from public.cosmetics c
    where c.id = any(v_ids) and c.visible and c.price is not null and (c.available_until is null or c.available_until > now());
  if v_n <> cardinality(v_ids) then raise exception 'item_unavailable'; end if;
  if p_total is null or p_total <> v_total then raise exception 'price_changed'; end if;
  if exists (select 1 from public.owned_cosmetics where user_id = v_uid and cosmetic_id = any(v_ids)) then raise exception 'already_owned'; end if;
  update public.profiles set coins = coins - v_total where id = v_uid and coins >= v_total returning coins into v_left;
  if v_left is null then raise exception 'not_enough_coins'; end if;
  insert into public.owned_cosmetics (user_id, cosmetic_id, source) select v_uid, x, 'shop' from unnest(v_ids) x;
  insert into private.coin_log (user_id, delta, balance, reason)
    select v_uid, -v_total, v_left, left('Sklep: ' || string_agg(c.name, ', ' order by c.name), 200)
    from public.cosmetics c where c.id = any(v_ids);
  return json_build_object('coins', v_left, 'bought', to_json(v_ids));
end $$;

-- ===== Panel admina =====
-- Wszystkie przedmioty z polami sklepu (także ukryte i po terminie)
create or replace function public.admin_shop_list() returns json
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.need_admin();
  return (select coalesce(json_agg(json_build_object(
      'id', c.id, 'name', c.name, 'type', c.type, 'rarity', c.rarity, 'description', c.description,
      'price', c.price, 'old_price', c.old_price, 'available_until', c.available_until,
      'visible', c.visible, 'featured', c.featured, 'sort', c.sort, 'image_url', c.image_url, 'texture', c.texture,
      'owners', (select count(*) from public.owned_cosmetics o where o.cosmetic_id = c.id))
    order by c.featured desc, c.sort, c.created_at desc), '[]'::json)
  from public.cosmetics c);
end $$;

-- Zapis przedmiotu ze wszystkimi polami sklepu.
-- p_texture: null zostawia obecną teksturę. p_image_url: null zostawia obecny obraz, '' go usuwa.
create or replace function public.admin_save_shop_item(
  p_id text, p_name text, p_type text, p_texture text, p_image_url text,
  p_price integer, p_old_price integer, p_description text, p_rarity text,
  p_until timestamptz, p_visible boolean, p_featured boolean, p_sort integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.need_admin();
  if p_rarity is null or p_rarity not in ('common', 'rare', 'epic', 'legendary', 'halloween') then raise exception 'rarity_invalid'; end if;
  if p_price is not null and p_price not between 0 and 1000000 then raise exception 'price_invalid'; end if;
  if p_old_price is not null and (p_price is null or p_old_price <= p_price) then raise exception 'old_price_invalid'; end if;
  if p_visible and p_price is null then raise exception 'price_missing'; end if;
  if length(coalesce(p_description, '')) > 300 then raise exception 'description_too_long'; end if;
  if p_image_url is not null and p_image_url <> ''
     and p_image_url !~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/shop/[A-Za-z0-9._/-]+$' then
    raise exception 'image_url_invalid';
  end if;
  -- nazwa, rodzaj, tekstura i zasady id (np. końcówka aury) jak w panelu admina launchera
  perform public.admin_save_cosmetic(p_id, p_name, p_type, p_texture);
  update public.cosmetics set
    image_url = case when p_image_url is null then image_url else nullif(p_image_url, '') end,
    price = p_price, old_price = p_old_price,
    description = nullif(trim(coalesce(p_description, '')), ''),
    rarity = p_rarity, available_until = p_until,
    visible = coalesce(p_visible, false), featured = coalesce(p_featured, false), sort = coalesce(p_sort, 0)
  where id = p_id;
end $$;

-- Dodanie (albo zabranie, gdy p_amount < 0) coinsów graczowi; wynik: nowe saldo. Ta sama funkcja co w schema.sql
-- launchera (panel admina w launcherze i na stronie). Starsza wersja sklepu miała tu parametr p_note, więc najpierw ją usuwamy.
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

-- Coinsy gracza i ostatnie 20 zmian (zakupy w sklepie, zmiany od admina)
create or replace function public.admin_player_wallet(p_user uuid) returns json
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.need_admin();
  return json_build_object(
    'coins', coalesce((select p.coins from public.profiles p where p.id = p_user), 0),
    'history', coalesce((select json_agg(json_build_object('delta', l.delta, 'reason', l.reason, 'admin', l.by_admin is not null,
        'at', l.created_at) order by l.created_at desc)
      from (select * from private.coin_log where user_id = p_user order by created_at desc limit 20) l), '[]'::json));
end $$;

-- ===== Obrazy przedmiotów: publiczny bucket "shop" w Supabase Storage, wrzucać może tylko admin =====
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shop', 'shop', true, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists shop_admin_insert on storage.objects;
create policy shop_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'shop' and (select public.is_admin()));
drop policy if exists shop_admin_update on storage.objects;
create policy shop_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'shop' and (select public.is_admin())) with check (bucket_id = 'shop' and (select public.is_admin()));
drop policy if exists shop_admin_delete on storage.objects;
create policy shop_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'shop' and (select public.is_admin()));

-- ===== Uprawnienia do funkcji =====
revoke all on function public.shop_items() from public, anon, authenticated;
revoke all on function public.my_shop() from public, anon, authenticated;
revoke all on function public.shop_buy(text) from public, anon, authenticated;
revoke all on function public.shop_buy_many(text[], integer) from public, anon, authenticated;
grant execute on function public.shop_items() to anon, authenticated;
grant execute on function public.my_shop() to authenticated;
grant execute on function public.shop_buy(text) to authenticated;
grant execute on function public.shop_buy_many(text[], integer) to authenticated;
do $$
declare f text;
begin
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'admin\_%' loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
