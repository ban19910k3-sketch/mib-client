-- Testy supabase/schema.sql. Każdy błąd kończy run.sh (ON_ERROR_STOP).
\set u1 '11111111-1111-1111-1111-111111111111'
\set u2 '22222222-2222-2222-2222-222222222222'

-- Oczekiwany wyjątek: uruchamia SQL i sprawdza treść błędu
create function pg_temp.expect_error(p_sql text, p_msg text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'expected error % but statement succeeded: %', p_msg, p_sql;
exception when others then
  if sqlerrm not like '%' || p_msg || '%' then raise exception 'expected % got %', p_msg, sqlerrm; end if;
end $$;
grant execute on function pg_temp.expect_error(text, text) to anon, authenticated;

-- Rejestracja tworzy profil, pierwszy jest Założycielem
insert into auth.users (id, email, encrypted_password, raw_user_meta_data) values (:'u1', 'a@test.pl', 'x', '{"nick":"Gracz_1"}');
do $$ begin
  assert (select num from public.profiles where nick = 'Gracz_1') = 1, 'num 1';
  assert (select founder from public.profiles where nick = 'Gracz_1'), 'founder';
end $$;
select pg_temp.expect_error($q$insert into auth.users (email, raw_user_meta_data) values ('b@test.pl', '{"nick":"GRACZ_1"}')$q$, 'nick_taken');
select pg_temp.expect_error($q$insert into auth.users (email, raw_user_meta_data) values ('c@test.pl', '{"nick":"Łukasz"}')$q$, 'nick_invalid');
select pg_temp.expect_error($q$insert into auth.users (email, raw_user_meta_data) values ('d@test.pl', '{}')$q$, 'nick_invalid');
insert into auth.users (id, email, encrypted_password, raw_user_meta_data) values (:'u2', 'b@test.pl', 'x', '{"nick":"Drugi"}');
do $$ begin
  assert (select num from public.profiles where nick = 'Drugi') = 2, 'num 2 (nieudane rejestracje nie mogą zostawić profilu)';
end $$;

set role anon;
do $$ begin
  assert not public.nick_available('gracz_1'), 'nick zajęty';
  assert public.nick_available('wolny'), 'nick wolny';
end $$;
select pg_temp.expect_error($q$select count(*) from public.profiles$q$, 'permission denied');
select pg_temp.expect_error($q$select public.redeem_code('X')$q$, 'permission denied');
reset role;

-- Uprawnienia zalogowanego gracza
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select pg_temp.expect_error($q$update public.profiles set nick = 'Inny'$q$, 'permission denied');
select pg_temp.expect_error($q$update public.profiles set founder = true$q$, 'permission denied');
select pg_temp.expect_error($q$insert into public.owned_cosmetics (user_id, cosmetic_id) values (auth.uid(), 'x')$q$, 'permission denied');
update public.profiles set settings = '{"ram":4096}', settings_updated_at = 5;
select pg_temp.expect_error($q$update public.profiles set settings = jsonb_build_object('x', repeat('a', 20000))$q$, 'check constraint');
do $$ begin
  assert (select count(*) from public.profiles) = 1, 'widzi tylko swój profil';
  assert (select settings->>'ram' from public.profiles) = '4096', 'zapis ustawień';
end $$;
reset role;

-- Kody prezentowe
insert into public.cosmetics (id, name) values ('cape_start', 'Peleryna Start'), ('cape_two', 'Peleryna Dwa');
insert into private.gift_codes (code, cosmetic_id, max_uses) values ('TEST', 'cape_start', 1), ('MULTI', 'cape_two', 5);
insert into private.gift_codes (code, cosmetic_id, expires_at) values ('OLD', 'cape_two', now() - interval '1 day');
select pg_temp.expect_error($q$insert into private.gift_codes (code, cosmetic_id) values ('lower', 'cape_two')$q$, 'check constraint');
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
do $$ begin
  assert (public.redeem_code(' test ') ->> 'name') = 'Peleryna Start', 'kod działa';
  assert (select count(*) from public.owned_cosmetics) = 1, 'kosmetyk na profilu';
  assert (public.redeem_code('MULTI') ->> 'cosmetic_id') = 'cape_two', 'kod wielorazowy';
end $$;
select pg_temp.expect_error($q$select public.redeem_code('MULTI')$q$, 'code_already_used');
select pg_temp.expect_error($q$select public.redeem_code('NOPE')$q$, 'code_invalid');
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select pg_temp.expect_error($q$select public.redeem_code('TEST')$q$, 'code_used_up');
select pg_temp.expect_error($q$select public.redeem_code('OLD')$q$, 'code_expired');
do $$ begin assert (select count(*) from public.owned_cosmetics) = 0, 'drugi gracz nie widzi cudzych kosmetyków'; end $$;
reset role;

-- Kod odzyskiwania i reset hasła
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.set_recovery_code('K7QM-2XPA-9TFD-W4HN');
select pg_temp.expect_error($q$select public.set_recovery_code('ABC')$q$, 'code_format');
reset role;
insert into auth.sessions (user_id) values (:'u1'), (:'u1');
select encrypted_password as old_pw from auth.users where id = :'u1' \gset
set role anon;
do $$ begin
  assert public.reset_password_with_code('A@test.pl ', 'k7qm2xpa9tfdw4hn', 'nowehaslo1'), 'reset działa (wielkość liter e-maila, kod małymi literami)';
end $$;
reset role;
do $$ begin
  assert (select count(*) from auth.sessions where user_id = '11111111-1111-1111-1111-111111111111') = 0, 'sesje usunięte';
  assert (select encrypted_password from auth.users where email = 'a@test.pl') = extensions.crypt('nowehaslo1', (select encrypted_password from auth.users where email = 'a@test.pl')), 'nowe hasło (bcrypt)';
  assert not exists (select 1 from private.recovery where user_id = '11111111-1111-1111-1111-111111111111'), 'kod zużyty';
end $$;
set role anon;
do $$ begin
  assert not public.reset_password_with_code('a@test.pl', 'K7QM2XPA9TFDW4HN', 'innehaslo1'), 'zużyty kod nie działa';
end $$;
select pg_temp.expect_error($q$select public.reset_password_with_code('a@test.pl', 'x', 'krotkie')$q$, 'weak_password');
do $$ begin
  for i in 1..5 loop
    assert not public.reset_password_with_code('b@test.pl', 'ZZZZZZZZZZZZZZZZ', 'haslohaslo'), 'zła próba';
  end loop;
end $$;
select pg_temp.expect_error($q$select public.reset_password_with_code('b@test.pl', 'ZZZZZZZZZZZZZZZZ', 'haslohaslo')$q$, 'reset_locked');
do $$ begin
  assert not public.reset_password_with_code(repeat('x', 400) || '@test.pl', 'ZZZZZZZZZZZZZZZZ', 'haslohaslo'), 'za długi e-mail';
end $$;
reset role;
do $$ begin
  assert not exists (select 1 from private.reset_attempts where length(email) > 320), 'za długi e-mail nie jest zapisywany';
end $$;
-- licznik prób zeruje się po dobie
update private.reset_attempts set fails = 4, locked_until = null, last_at = now() - interval '2 days' where email = 'b@test.pl';
set role anon;
do $$ begin
  assert not public.reset_password_with_code('b@test.pl', 'ZZZZZZZZZZZZZZZZ', 'haslohaslo'), 'zła próba po dobie';
end $$;
reset role;
do $$ begin
  assert (select fails from private.reset_attempts where email = 'b@test.pl') = 1, 'licznik od nowa po dobie';
end $$;
set role anon;
reset role;

-- Statystyki
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.add_play_session('1.8.9', 5000);
select public.add_play_session('1.8.9', 30);
do $$ begin
  assert (select playtime_min from public.profiles) = 1470, 'czas przycięty do 1440 + 30';
  assert (select launches from public.profiles) = 2, 'uruchomienia';
  assert (select (version_stats -> '1.8.9' ->> 'runs')::int from public.profiles) = 2, 'statystyki wersji';
end $$;

-- Kopia modów: tylko swoja
insert into public.mod_backups (game_version, loader, mods) values ('1.20.1', 'fabric', '[{"project":"p"}]');
select pg_temp.expect_error($q$insert into public.mod_backups (game_version) values ('zły; wpis')$q$, 'check constraint');
select pg_temp.expect_error($q$insert into public.mod_backups (game_version, loader) values ('1.8.9', 'quilt')$q$, 'check constraint');
do $$ begin
  for i in 1..49 loop insert into public.mod_backups (game_version) values ('9.' || i); end loop;
end $$;
select pg_temp.expect_error($q$insert into public.mod_backups (game_version) values ('9.99')$q$, 'too_many_backups');
delete from public.mod_backups where game_version like '9.%';
reset role;
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$ begin assert (select count(*) from public.mod_backups) = 0, 'cudza kopia niewidoczna'; end $$;
select pg_temp.expect_error($q$insert into public.mod_backups (user_id, game_version) values ('11111111-1111-1111-1111-111111111111', 'x')$q$, 'row-level security');

-- Usunięcie profilu (razem z wpisem o próbach resetu)
reset role;
insert into private.reset_attempts (email, fails) values ('a@test.pl', 2) on conflict (email) do update set fails = 2;
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.delete_my_profile();
reset role;
do $$ begin
  assert not exists (select 1 from auth.users where id = '11111111-1111-1111-1111-111111111111'), 'konto usunięte';
  assert not exists (select 1 from public.profiles where id = '11111111-1111-1111-1111-111111111111'), 'profil usunięty';
  assert not exists (select 1 from public.mod_backups), 'kopia usunięta';
  assert not exists (select 1 from private.reset_attempts where email = 'a@test.pl'), 'e-mail usunięty z prób resetu';
end $$;
