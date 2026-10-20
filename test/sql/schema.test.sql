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
-- ponowne uruchomienie schematu, gdy profile już są: adminem zostaje konto MIB-000002 (tu: Drugi)
\i ../../supabase/schema.sql
\i ../../supabase/schema.sql
do $$ begin
  assert (select count(*) from private.admins) = 1, 'jeden admin';
  assert exists (select 1 from private.admins where user_id = '22222222-2222-2222-2222-222222222222'), 'adminem jest konto MIB-000002';
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

-- Zakładanie kosmetyków: tylko własne, tylko pasujący typ, zdejmowanie
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
do $$ begin
  assert (public.equip_cosmetic('cape', 'cape_start') ->> 'cape') = 'cape_start', 'zakładanie peleryny';
  assert (select equipped ->> 'cape' from public.profiles) = 'cape_start', 'zapisane na profilu';
  assert (public.equip_cosmetic('cape', 'cape_two') ->> 'cape') = 'cape_two', 'zmiana peleryny';
  assert (public.equip_cosmetic('cape', null) ->> 'cape') is null, 'zdejmowanie';
end $$;
select pg_temp.expect_error($q$select public.equip_cosmetic('hat', 'cape_two')$q$, 'not_owned');
select pg_temp.expect_error($q$select public.equip_cosmetic('cape', 'nie_ma')$q$, 'not_owned');
select pg_temp.expect_error($q$select public.equip_cosmetic('xyz', null)$q$, 'cosmetic_type_invalid');
select pg_temp.expect_error($q$update public.profiles set equipped = '{"cape":"cape_two"}'$q$, 'permission denied');
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select pg_temp.expect_error($q$select public.equip_cosmetic('cape', 'cape_start')$q$, 'not_owned');
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

-- Konto bez profilu (założone przed uruchomieniem schematu): gracz dokańcza profil sam
reset role;
delete from public.profiles where id = '22222222-2222-2222-2222-222222222222';
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select pg_temp.expect_error($q$select public.create_my_profile('Gracz_1')$q$, 'nick_taken');
select pg_temp.expect_error($q$select public.create_my_profile('zły nick')$q$, 'nick_invalid');
select public.create_my_profile('Drugi_Nowy');
do $$ begin
  assert (select nick from public.profiles) = 'Drugi_Nowy', 'profil dokończony';
  assert (select num from public.profiles) = 3, 'kolejny numer';
end $$;
select pg_temp.expect_error($q$select public.create_my_profile('Trzeci')$q$, 'profile_exists');
reset role;
set role anon;
select pg_temp.expect_error($q$select public.create_my_profile('Anonim')$q$, 'permission denied');
reset role;
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

-- ===== Panel admina =====
reset role;
\i ../../supabase/schema.sql
do $$ begin
  assert (select count(*) from private.admins) = 1 and exists (select 1 from private.admins where user_id = '22222222-2222-2222-2222-222222222222'), 'ponowne uruchomienie nie zmienia admina';
end $$;
set role anon;
select pg_temp.expect_error($q$select public.admin_stats()$q$, 'permission denied');
select pg_temp.expect_error($q$select public.is_admin()$q$, 'permission denied');
reset role;
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
do $$ begin assert not public.is_admin(), 'zwykły gracz nie jest adminem'; end $$;
select pg_temp.expect_error($q$select public.admin_stats()$q$, 'not_admin');
select pg_temp.expect_error($q$select public.admin_save_announcement(null, 'x', '', false, null)$q$, 'not_admin');
select pg_temp.expect_error($q$select public.admin_create_codes('cape_start', 1, 1, null)$q$, 'not_admin');
select pg_temp.expect_error($q$select * from public.admin_find_players('')$q$, 'not_admin');

-- Pomysły graczy
select public.submit_idea('feature', '  Tryb ciemny w konsoli launchera  ');
select pg_temp.expect_error($q$select public.submit_idea('feature', 'krótko')$q$, 'idea_short');
select pg_temp.expect_error($q$select public.submit_idea('hack', 'Dłuższy pomysł gracza')$q$, 'idea_category');
select pg_temp.expect_error($q$select public.submit_idea(null, 'Dłuższy pomysł gracza')$q$, 'idea_category');
select pg_temp.expect_error($q$select public.submit_idea('bug', repeat('x', 1001))$q$, 'idea_long');
do $$ begin
  for i in 1..4 loop perform public.submit_idea('other', 'Pomysł numer ' || i || ' od gracza'); end loop;
end $$;
select pg_temp.expect_error($q$select public.submit_idea('other', 'Szósty pomysł tego dnia')$q$, 'idea_limit');
select pg_temp.expect_error($q$insert into public.ideas (user_id, category, body) values (auth.uid(), 'other', 'Wpis z pominięciem limitu')$q$, 'permission denied');
select pg_temp.expect_error($q$update public.ideas set status = 'done'$q$, 'permission denied');
select pg_temp.expect_error($q$select * from public.admin_list_ideas()$q$, 'not_admin');
select pg_temp.expect_error($q$select public.admin_set_idea_status(1, 'done')$q$, 'not_admin');
do $$ begin
  assert (select count(*) from public.ideas) = 5, 'gracz widzi swoje pomysły';
  assert (select body from public.ideas order by id limit 1) = 'Tryb ciemny w konsoli launchera', 'treść bez spacji na brzegach';
  assert (select status from public.ideas order by id limit 1) = 'new', 'nowy pomysł';
end $$;
reset role;
set role anon;
select pg_temp.expect_error($q$select public.submit_idea('feature', 'Pomysł bez profilu MiB')$q$, 'permission denied');
select pg_temp.expect_error($q$select count(*) from public.ideas$q$, 'permission denied');
reset role;
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$
declare v bigint; codes text[];
begin
  assert public.is_admin(), 'admin';
  -- ogłoszenia
  v := public.admin_save_announcement(null, ' Turniej w sobotę ', 'Start 18:00', true, null);
  perform public.admin_save_announcement(null, 'Stare', '', false, now() - interval '1 day');
  perform public.admin_save_announcement(v, 'Turniej w niedzielę', 'Start 18:00', true, null);
  assert (select count(*) from public.admin_list_announcements()) = 2, 'admin widzi wszystkie';
  -- kosmetyki
  perform public.admin_save_cosmetic('cape_mib', 'Peleryna MiB', 'cape', 'data:image/png;base64,iVBORw0KGgo=');
  assert (select texture from public.cosmetics where id = 'cape_mib') like 'data:image/png;base64,%', 'tekstura zapisana';
  perform public.admin_save_cosmetic('cape_mib', 'Peleryna MiB 2', 'cape', null);
  assert (select texture from public.cosmetics where id = 'cape_mib') is not null, 'edycja bez tekstury jej nie kasuje';
  -- kody
  codes := array(select json_array_elements_text(public.admin_create_codes('cape_mib', 3, 1, 7)));
  assert array_length(codes, 1) = 3, '3 kody';
  assert codes[1] ~ '^MIB-[2-9A-HJKMNP-TV-Z]{4}-[2-9A-HJKMNP-TV-Z]{4}$', 'format kodu: ' || codes[1];
  assert (select count(*) from public.admin_list_codes() where cosmetic_id = 'cape_mib') = 3, 'lista kodów';
  -- gracze
  assert (select nick from public.admin_find_players('MIB-000001')) = 'Gracz_1', 'szukanie po ID';
  assert (select count(*) from public.admin_find_players('gracz_')) >= 1, 'szukanie po nicku';
  assert (select count(*) from public.admin_find_players('gracz_x')) = 0, '_ nie jest wildcardem';
  assert (select count(*) from public.admin_find_players('a@test')) = 1, 'szukanie po e-mailu';
  assert (select count(*) from public.admin_find_players('100%')) = 0, 'procent nie jest wildcardem';
  perform public.admin_grant('11111111-1111-1111-1111-111111111111', 'cape_mib');
  assert json_array_length(public.admin_player_cosmetics('11111111-1111-1111-1111-111111111111')) = 3, 'nadany przedmiot';
  perform public.admin_revoke('11111111-1111-1111-1111-111111111111', 'cape_mib');
  assert json_array_length(public.admin_player_cosmetics('11111111-1111-1111-1111-111111111111')) = 2, 'zabrany przedmiot';
  -- statystyki
  assert (public.admin_stats() ->> 'profiles')::int = 2, 'liczba profili';
  assert (public.admin_stats() ->> 'foundersLeft')::int = 997, 'wolne miejsca Założyciela';
  -- pomysły
  assert (select count(*) from public.ideas) = 0, 'przez tabelę admin widzi tylko swoje pomysły';
  assert public.admin_count_new_ideas() = 5, 'nowe pomysły';
  assert (select count(*) from public.admin_list_ideas()) = 5, 'admin widzi pomysły graczy';
  assert (select nick from public.admin_list_ideas() limit 1) = 'Gracz_1', 'z nickiem autora';
  assert (select num from public.admin_list_ideas() limit 1) = 1, 'z numerem MIB autora';
  perform public.admin_set_idea_status((select min(i.id) from public.admin_list_ideas() i), 'planned');
  assert public.admin_count_new_ideas() = 4, 'zmieniony status';
  assert (select status from public.admin_list_ideas() order by created_at, id limit 1) = 'planned', 'status zapisany';
  assert (select status from public.admin_list_ideas() limit 1) = 'new', 'nowe na górze listy';
  perform public.admin_delete_idea((select max(i.id) from public.admin_list_ideas() i));
  assert (select count(*) from public.admin_list_ideas()) = 4, 'usunięty pomysł';
end $$;
select pg_temp.expect_error($q$select public.admin_set_idea_status(1, 'zrobione')$q$, 'idea_status_invalid');
select pg_temp.expect_error($q$select public.admin_set_idea_status(999999, 'done')$q$, 'idea_missing');
select pg_temp.expect_error($q$select public.admin_save_cosmetic('Zła Nazwa', 'x', 'cape', null)$q$, 'cosmetic_id_invalid');
select pg_temp.expect_error($q$select public.admin_save_cosmetic('ok_id', 'x', 'cape', 'http://zly.link/x.png')$q$, 'check constraint');
select pg_temp.expect_error($q$select public.admin_delete_cosmetic('cape_mib')$q$, 'cosmetic_in_use');
select pg_temp.expect_error($q$select public.admin_create_codes('cape_mib', 500, 1, null)$q$, 'codes_invalid');
select pg_temp.expect_error($q$select public.admin_delete_player('22222222-2222-2222-2222-222222222222')$q$, 'cannot_delete_admin');
select pg_temp.expect_error($q$select public.delete_my_profile()$q$, 'admin_cannot_delete');
reset role;
set role anon;
do $$ begin
  assert (select count(*) from public.announcements) = 1, 'gracze widzą tylko aktualne ogłoszenia';
  assert (select title from public.announcements) = 'Turniej w niedzielę', 'edycja ogłoszenia';
end $$;
reset role;
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select pg_temp.expect_error($q$insert into public.announcements (title) values ('hack')$q$, 'permission denied');
select pg_temp.expect_error($q$update public.cosmetics set name = 'hack'$q$, 'permission denied');
do $$ begin
  assert (select count(*) from public.ideas) = 4, 'gracz widzi swoje pomysły po usunięciu jednego przez admina';
  assert (select status from public.ideas order by id limit 1) = 'planned', 'gracz widzi status nadany przez admina';
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

-- Znajomi: zaproszenie po nicku i numerze, przyjęcie, obecność widoczna tylko dla znajomych
reset role;
insert into auth.users (id, email, encrypted_password, raw_user_meta_data) values ('44444444-4444-4444-4444-444444444444', 'z@test.pl', 'x', '{"nick":"Trzeci"}');
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select pg_temp.expect_error($q$select public.friend_request('Nikt_Taki')$q$, 'friend_not_found');
select pg_temp.expect_error($q$select public.friend_request('gracz_1')$q$, 'friend_self');
do $$ begin
  assert public.friend_request('drugi_nowy') = 'sent', 'zaproszenie po nicku (bez wielkości liter)';
end $$;
select pg_temp.expect_error($q$select public.friend_request('Drugi_Nowy')$q$, 'friend_exists');
select public.presence_ping(true, '1.21.11', 'MC.Hypixel.net');
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$ begin
  assert (select state from public.friends_list() where nick = 'Gracz_1') = 'incoming', 'zaproszenie widać u odbiorcy';
  assert (select status from public.friends_list() where nick = 'Gracz_1') is null, 'przed przyjęciem bez obecności';
end $$;
select pg_temp.expect_error($q$select public.friend_answer('44444444-4444-4444-4444-444444444444', true)$q$, 'friend_missing');
select public.friend_answer('11111111-1111-1111-1111-111111111111', true);
do $$ begin
  assert (select state from public.friends_list() where nick = 'Gracz_1') = 'friend', 'przyjęte';
  assert (select status from public.friends_list() where nick = 'Gracz_1') = 'game', 'znajomy w grze';
  assert (select server from public.friends_list() where nick = 'Gracz_1') = 'mc.hypixel.net', 'serwer znajomego';
  assert (select version from public.friends_list() where nick = 'Gracz_1') = '1.21.11', 'wersja gry znajomego';
end $$;
-- zaproszenie po numerze MIB i przyjęcie przez wzajemne zaproszenie
reset role;
select lpad(num::text, 6, '0') as n3 from public.profiles where nick = 'Trzeci' \gset
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select public.friend_request('MIB-' || :'n3');
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
do $$ begin
  assert public.friend_request('Drugi_Nowy') = 'accepted', 'wzajemne zaproszenie od razu przyjmuje';
  assert (select count(*) from public.friends_list()) = 1, 'Trzeci zna tylko Drugi_Nowy';
  assert not exists (select 1 from public.friends_list() where nick = 'Gracz_1'), 'cudzych znajomych nie widać';
end $$;
reset role;
do $$ begin
  assert (select count(*) from private.friends) = 2, 'jedna para = jeden wiersz';
end $$;
-- odrzucenie, usunięcie, zły serwer w obecności
set role authenticated;
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select public.friend_request('Gracz_1');
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.friend_answer('44444444-4444-4444-4444-444444444444', false);
select public.presence_ping(true, '1.21.11', 'zły serwer; drop table');
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$ begin
  assert (select server from public.friends_list() where nick = 'Gracz_1') is null, 'zły adres serwera odrzucony';
end $$;
select public.friend_remove('44444444-4444-4444-4444-444444444444');
do $$ begin
  assert not exists (select 1 from public.friends_list() where nick = 'Trzeci'), 'znajomy usunięty';
end $$;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.presence_leave();
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$ begin
  assert (select status from public.friends_list() where nick = 'Gracz_1') = 'offline', 'po zamknięciu launchera offline';
end $$;
select pg_temp.expect_error($q$select * from private.friends$q$, 'permission denied');
reset role;
set role anon;
select pg_temp.expect_error($q$select public.friend_request('Drugi_Nowy')$q$, 'permission denied');
reset role;

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
  assert (select count(*) from public.ideas where user_id is null) = 4, 'pomysły zostają, ale bez autora';
  assert not exists (select 1 from private.friends where '11111111-1111-1111-1111-111111111111' in (from_id, to_id)), 'znajomi usuniętego konta znikają';
end $$;
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$ begin
  assert (select nick from public.admin_list_ideas() limit 1) is null, 'admin nie widzi nicku usuniętego konta';
end $$;
reset role;

-- Gracze MiB w grze: obecność potwierdzona przez Mojanga, peleryna tylko posiadana i założona
insert into extensions.fake_mojang values ('Gracz', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '33333333333333333333333333333333');
set role anon;
do $$ begin
  assert (public.mib_hello('Gracz', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb') ->> 'error') = 'not_verified', 'Mojang nie potwierdził';
end $$;
select pg_temp.expect_error($q$select public.mib_hello('Zły nick', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')$q$, 'name_invalid');
select pg_temp.expect_error($q$select public.mib_hello('Gracz', 'x')$q$, 'server_id_invalid');
select pg_temp.expect_error($q$select public.mib_hello('Gracz', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')$q$, 'server_id_invalid');
select pg_temp.expect_error($q$select count(*) from private.mib_players$q$, 'permission denied');
select public.mib_hello('Gracz', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa') ->> 'token' as tok \gset
do $$ begin
  assert (select count(*) from public.mib_who(array['33333333-3333-3333-3333-333333333333']::uuid[], null)) = 1, 'gracz MiB widoczny po UUID';
  assert (select name from public.mib_who(null, array['GRACZ'])) = 'Gracz', 'po nicku, bez wielkości liter';
  assert (select count(*) from public.mib_who(array['44444444-4444-4444-4444-444444444444']::uuid[], array['ktos'])) = 0, 'inni gracze nie';
  assert (select cape from public.mib_who(null, array['Gracz'])) is null, 'bez profilu MiB bez peleryny';
  assert not public.mib_ping('33333333-3333-3333-3333-333333333333', 'zly', true), 'zły token';
end $$;
select public.mib_ping('33333333-3333-3333-3333-333333333333', :'tok', false);
do $$ begin
  assert (select count(*) from public.mib_who(null, array['Gracz'])) = 0, 'po zamknięciu gry niewidoczny';
end $$;
select public.mib_ping('33333333-3333-3333-3333-333333333333', :'tok', true);
do $$ begin
  assert (select count(*) from public.mib_who(null, array['Gracz'])) = 1, 'po sygnale znowu widoczny';
end $$;
reset role;
-- zalogowany gracz z założoną peleryną
insert into public.owned_cosmetics (user_id, cosmetic_id) values ('22222222-2222-2222-2222-222222222222', 'cape_two') on conflict do nothing;
insert into public.cosmetics (id, name, type) values ('hat_one', 'Czapka', 'hat') on conflict do nothing;
insert into public.owned_cosmetics (user_id, cosmetic_id) values ('22222222-2222-2222-2222-222222222222', 'hat_one') on conflict do nothing;
update public.profiles set equipped = '{"cape":"cape_two","hat":"hat_one","wings":"nie_ma"}' where id = '22222222-2222-2222-2222-222222222222';
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select public.mib_hello('Gracz', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa') ->> 'token' as tok2 \gset
do $$ begin
  assert (select cape from public.mib_who(null, array['Gracz'])) = 'cape_two', 'peleryna gracza MiB';
  assert (select hat from public.mib_who(null, array['Gracz'])) = 'hat_one', 'czapka gracza MiB';
  assert (select wings from public.mib_who(null, array['Gracz'])) is null, 'skrzydeł nie ma';
  assert not public.mib_ping('33333333-3333-3333-3333-333333333333', 'zly', true), 'stary token po ponownym zgłoszeniu nie działa';
end $$;
reset role;
delete from public.owned_cosmetics where user_id = '22222222-2222-2222-2222-222222222222' and cosmetic_id = 'cape_two';
do $$ begin
  assert (select cape from public.mib_who(null, array['Gracz'])) is null, 'zabrana peleryna znika';
end $$;
do $$ begin
  assert (select count(*) from private.hello_log) = 3, 'nieudane próby też liczą się do limitu';
end $$;
-- limit pytań do Mojanga z jednego adresu
delete from private.hello_log;
set request.headers = '{"x-forwarded-for": "1.2.3.4, 10.0.0.1"}';
insert into private.hello_log (ip) select '1.2.3.4' from generate_series(1, 10);
set role anon;
select pg_temp.expect_error($q$select public.mib_hello('Gracz', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')$q$, 'busy');
reset role;
reset request.headers;
delete from private.hello_log;
-- limit pytań do Mojanga dla wszystkich
insert into private.hello_log select now() from generate_series(1, 120);
set role anon;
select pg_temp.expect_error($q$select public.mib_hello('Gracz', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')$q$, 'busy');
reset role;
delete from private.hello_log;

-- „Teraz gra” w statystykach admina: gracze w grze i w launcherze (ostatnie 5 minut), w grze z modem MiB,
-- najpopularniejsze serwery i wersje (tylko zbiorczo)
delete from private.presence;
delete from private.mib_players;
insert into private.presence (user_id, seen_at, playing, version, server)
  select id, now(), true, '1.21.11', 'play.mib.pl' from public.profiles where id <> '22222222-2222-2222-2222-222222222222' order by num limit 1;
insert into private.presence (user_id, seen_at, playing, version, server) values ('22222222-2222-2222-2222-222222222222', now(), false, null, null);
insert into private.mib_players (uuid, name, user_id, token_hash, seen_at) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'GraczMiB', null, 'x', now()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Dawno', null, 'x', now() - interval '1 hour');
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$
declare s json := public.admin_stats();
begin
  assert (s ->> 'nowGame')::int = 1, 'w grze teraz';
  assert (s ->> 'nowLauncher')::int = 1, 'w launcherze teraz';
  assert (s ->> 'nowMod')::int = 1, 'w grze z modem MiB teraz (dawne zgłoszenie się nie liczy)';
  assert (s -> 'nowServers' -> 0 ->> 'server') = 'play.mib.pl' and (s -> 'nowServers' -> 0 ->> 'players')::int = 1, 'serwery teraz';
  assert (s -> 'nowVersions' -> 0 ->> 'version') = '1.21.11', 'wersje teraz';
end $$;
reset role;

-- Zaproszenie znajomego do gry: tylko znajomi, tylko gdy zapraszający gra teraz na serwerze; zaproszenie widać
-- 10 minut, można je odrzucić; ponowne zaproszenie tylko je odświeża
insert into auth.users (id, email, encrypted_password, raw_user_meta_data) values
  ('55555555-5555-5555-5555-555555555555', 'inv1@test.pl', 'x', '{"nick":"Zapraszam"}'),
  ('66666666-6666-6666-6666-666666666666', 'inv2@test.pl', 'x', '{"nick":"Zaproszony"}'),
  ('77777777-7777-7777-7777-777777777777', 'inv3@test.pl', 'x', '{"nick":"Obcy"}');
set role authenticated;
set request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
select public.friend_request('Zaproszony');
set request.jwt.claim.sub = '66666666-6666-6666-6666-666666666666';
select public.friend_answer('55555555-5555-5555-5555-555555555555', true);
set request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
select pg_temp.expect_error($q$select public.game_invite('66666666-6666-6666-6666-666666666666')$q$, 'invite_no_server');
select public.presence_ping(true, '1.21.11', 'Play.MiB.pl');
select pg_temp.expect_error($q$select public.game_invite('77777777-7777-7777-7777-777777777777')$q$, 'invite_not_friend');
do $$ begin
  assert (public.game_invite('66666666-6666-6666-6666-666666666666') ->> 'server') = 'play.mib.pl', 'zaproszenie na mój serwer';
  perform public.game_invite('66666666-6666-6666-6666-666666666666');
  assert (select count(*) from public.game_invites_list()) = 0, 'zaproszenia do mnie: brak';
end $$;
set request.jwt.claim.sub = '66666666-6666-6666-6666-666666666666';
do $$ begin
  assert (select count(*) from public.game_invites_list()) = 1, 'jedno zaproszenie mimo dwóch kliknięć';
  assert (select nick || ' ' || server || ' ' || version from public.game_invites_list()) = 'Zapraszam play.mib.pl 1.21.11', 'od kogo i dokąd';
  perform public.game_invite_dismiss('55555555-5555-5555-5555-555555555555');
  assert (select count(*) from public.game_invites_list()) = 0, 'odrzucone znika';
end $$;
reset role;
update private.game_invites set created_at = now() - interval '11 minutes';
insert into private.game_invites (from_id, to_id, server, version, created_at)
  values ('55555555-5555-5555-5555-555555555555', '66666666-6666-6666-6666-666666666666', 'play.mib.pl', '1.21.11', now() - interval '11 minutes')
  on conflict do nothing;
set role authenticated;
set request.jwt.claim.sub = '66666666-6666-6666-6666-666666666666';
do $$ begin
  assert (select count(*) from public.game_invites_list()) = 0, 'stare zaproszenie (ponad 10 minut) nie wraca';
end $$;
select pg_temp.expect_error($q$select * from private.game_invites$q$, 'permission denied');
reset role;
set role anon;
select pg_temp.expect_error($q$select public.game_invite('66666666-6666-6666-6666-666666666666')$q$, 'permission denied');
reset role;
