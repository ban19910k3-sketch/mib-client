-- MiB Client — strona internetowa i jej sklep (sklep.html).
-- Wklej całość w Supabase → SQL Editor → Run, PO pliku schema.sql z launchera (od 0.24.0, bo strona używa jego sklepu:
-- cosmetics.price, ofert, MiB Coins w profiles.coins). Można uruchamiać wielokrotnie (nie kasuje danych).
-- Zastępuje wcześniejszy sklep.sql: kosmetyki kupuje się w launcherze, a strona pokazuje ten sam sklep bez logowania,
-- pozwala przymierzyć kosmetyki i kupić MiB Coins dla gracza wskazanego numerem MIB albo nickiem.

-- ===== Pola sklepu na stronie (launcher ich nie czyta) =====
alter table public.cosmetics add column if not exists old_price integer check (old_price is null or old_price between 1 and 1000000);
alter table public.cosmetics add column if not exists description text check (description is null or length(description) <= 300);
alter table public.cosmetics add column if not exists rarity text not null default 'common';
alter table public.cosmetics drop constraint if exists cosmetics_rarity_check;
alter table public.cosmetics add constraint cosmetics_rarity_check check (rarity in ('common', 'rare', 'epic', 'legendary', 'halloween', 'holiday'));
alter table public.cosmetics add column if not exists featured boolean not null default false;
alter table public.cosmetics add column if not exists sort integer not null default 0;
-- Obraz do karty w sklepie na stronie. Osobno od image_url, bo launcher używa image_url jako tekstury, gdy texture jest puste.
alter table public.cosmetics add column if not exists shop_image text
  check (shop_image is null or shop_image ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/shop/[A-Za-z0-9._/-]+$');
-- Starszy sklep strony wpisywał swój obraz do image_url: przenosimy go do shop_image
update public.cosmetics set shop_image = image_url, image_url = null
  where image_url ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/shop/[A-Za-z0-9._/-]+$';

-- Starszy sklep strony trzymał monety osobno (public.wallets): raz przenosimy je na saldo w profilu
do $$
begin
  if to_regclass('public.wallets') is not null then
    insert into private.coin_log (user_id, delta, balance, reason, kind)
      select w.user_id, w.coins, p.coins + w.coins, 'Przeniesione z poprzedniego portfela sklepu', 'admin'
      from public.wallets w join public.profiles p on p.id = w.user_id where w.coins > 0;
    update public.profiles p set coins = p.coins + w.coins from public.wallets w where w.user_id = p.id and w.coins > 0;
    update public.wallets w set coins = 0 where w.coins > 0 and exists (select 1 from public.profiles p where p.id = w.user_id);
  end if;
end $$;

-- Funkcje starszego sklepu strony (zakupy były osobno od launchera) — teraz kupuje się tylko w launcherze
drop function if exists public.shop_items();
drop function if exists public.my_shop();
drop function if exists public.shop_buy(text);
drop function if exists public.shop_buy_many(text[], integer);
drop function if exists public.admin_save_shop_item(text, text, text, text, text, integer, integer, text, text, timestamptz, boolean, boolean, integer);
drop function if exists public.admin_player_wallet(uuid);

-- ===== Dla wszystkich (bez logowania) =====
-- Sklep tak, jak widzi go launcher: kosmetyki, które można teraz kupić (z kolekcji świątecznych tylko w czasie święta),
-- aktualne oferty i trwające kolekcje. Bez danych żadnego gracza.
create or replace function public.web_shop() returns json
language sql stable security definer set search_path = '' as $$
  with d as (select private.today() as day),
  offers as (select * from private.shop_offers where ends_at is null or ends_at > now())
  select json_build_object(
    'items', coalesce((select json_agg(json_build_object('id', c.id, 'name', c.name, 'type', c.type,
        'texture', coalesce(c.texture, c.image_url), 'image', c.shop_image,
        'price', case when c.price is not null and private.on_sale(c.id, d.day) then c.price end,
        'old_price', c.old_price, 'description', c.description, 'rarity', c.rarity, 'featured', c.featured,
        'theme', (select t.id from public.themes t where c.id = any(t.items) limit 1))
      order by c.featured desc, c.sort, c.price nulls last, c.name)
      from public.cosmetics c, d
      where (c.price is not null and private.on_sale(c.id, d.day)) or exists (select 1 from offers o where c.id = any(o.items))), '[]'::json),
    'offers', coalesce((select json_agg(json_build_object('id', o.id, 'name', o.name, 'items', o.items, 'price', o.price,
        'full', (select coalesce(sum(c.price), 0) from public.cosmetics c where c.id = any(o.items)), 'ends_at', o.ends_at)
      order by o.ends_at nulls last, o.id) from offers o), '[]'::json),
    'themes', coalesce((select json_agg(json_build_object('id', t.id, 'name', t.name, 'until', private.theme_until(t, d.day), 'items', t.items) order by t.sort)
      from public.themes t, d where cardinality(t.items) > 0 and private.theme_season(t, d.day) is not null), '[]'::json));
$$;

-- Gracz, dla którego kupuje się MiB Coins: po numerze (MIB-000123 albo 123) albo po dokładnym nicku MiB.
-- Zwraca tylko numer i nick (bez e-maila, konta Minecraft i salda); zbanowanego nie ma.
create or replace function public.web_player(p_q text) returns json
language sql stable security definer set search_path = '' as $$
  select json_build_object('num', p.num, 'nick', p.nick)
  from public.profiles p
  where not private.is_banned(p.id)
    and (case when trim(coalesce(p_q, '')) ~* '^(mib-?)?[0-9]{1,12}$'
           then p.num = regexp_replace(trim(p_q), '[^0-9]', '', 'g')::bigint
           else lower(p.nick) = lower(trim(coalesce(p_q, ''))) end)
  limit 1;
$$;

-- Logowanie właściciela na stronie numerem MIB: adres e-mail konta, ale tylko gdy to konto admina
-- (profile z konta Minecraft mają techniczny adres, którego nikt nie pamięta). Dla innych numerów: null.
create or replace function public.web_admin_email(p_num bigint) returns text
language sql stable security definer set search_path = '' as $$
  select u.email::text from public.profiles p join auth.users u on u.id = p.id
  where p.num = p_num and exists (select 1 from private.admins a where a.user_id = p.id);
$$;

-- ===== Panel admina na stronie =====
-- Wszystkie kosmetyki z polami sklepu i liczbą graczy, którzy je mają
create or replace function public.admin_shop_list() returns json
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.need_admin();
  return (select coalesce(json_agg(json_build_object(
      'id', c.id, 'name', c.name, 'type', c.type, 'rarity', c.rarity, 'description', c.description,
      'price', c.price, 'old_price', c.old_price, 'featured', c.featured, 'sort', c.sort,
      'image', c.shop_image, 'texture', coalesce(c.texture, c.image_url),
      'theme', (select t.id from public.themes t where c.id = any(t.items) limit 1),
      'owners', (select count(*) from public.owned_cosmetics o where o.cosmetic_id = c.id))
    order by c.featured desc, c.sort, c.created_at desc), '[]'::json)
  from public.cosmetics c);
end $$;

-- Zapis kosmetyku z polami sklepu. Nazwa, rodzaj, tekstura i zasady id — jak w panelu launchera (admin_save_cosmetic),
-- cena — jak admin_set_price (null zdejmuje ze sprzedaży). p_texture null zostawia teksturę, p_image null zostawia obraz,
-- '' go usuwa.
create or replace function public.admin_web_item(
  p_id text, p_name text, p_type text, p_texture text, p_image text,
  p_price integer, p_old_price integer, p_description text, p_rarity text, p_featured boolean, p_sort integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.need_admin();
  if p_rarity is null or p_rarity not in ('common', 'rare', 'epic', 'legendary', 'halloween', 'holiday') then raise exception 'rarity_invalid'; end if;
  if p_price is not null and p_price not between 1 and 1000000 then raise exception 'price_invalid'; end if;
  if p_old_price is not null and (p_price is null or p_old_price <= p_price or p_old_price > 1000000) then raise exception 'old_price_invalid'; end if;
  if length(coalesce(p_description, '')) > 300 then raise exception 'description_too_long'; end if;
  if p_image is not null and p_image <> ''
     and p_image !~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/shop/[A-Za-z0-9._/-]+$' then
    raise exception 'image_url_invalid';
  end if;
  perform public.admin_save_cosmetic(p_id, p_name, p_type, p_texture);
  update public.cosmetics set
    shop_image = case when p_image is null then shop_image else nullif(p_image, '') end,
    price = p_price, old_price = p_old_price,
    description = nullif(trim(coalesce(p_description, '')), ''),
    rarity = p_rarity, featured = coalesce(p_featured, false), sort = coalesce(p_sort, 0)
  where id = p_id;
end $$;

-- ===== Obrazy kart: publiczny bucket "shop" w Supabase Storage, wrzucać może tylko admin =====
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
revoke all on function public.web_shop() from public, anon, authenticated;
revoke all on function public.web_player(text) from public, anon, authenticated;
revoke all on function public.web_admin_email(bigint) from public, anon, authenticated;
grant execute on function public.web_shop() to anon, authenticated;
grant execute on function public.web_player(text) to anon, authenticated;
grant execute on function public.web_admin_email(bigint) to anon, authenticated;
do $$
declare f text;
begin
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'admin\_%' loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
