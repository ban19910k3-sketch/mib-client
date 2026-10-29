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
reset role;
-- aura (od 0.22.0): kosmetyki na Halloween są w bazie po wczytaniu schematu
insert into public.owned_cosmetics (user_id, cosmetic_id) values ('11111111-1111-1111-1111-111111111111', 'halloween_aura_ghosts');
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
do $$ begin
  assert (public.equip_cosmetic('aura', 'halloween_aura_ghosts') ->> 'aura') = 'halloween_aura_ghosts', 'zakładanie aury';
  assert (public.equip_cosmetic('aura', null) ->> 'aura') is null, 'zdejmowanie aury';
end $$;
select pg_temp.expect_error($q$select public.equip_cosmetic('aura', 'cape_two')$q$, 'not_owned');
reset role;
delete from public.owned_cosmetics where cosmetic_id = 'halloween_aura_ghosts';
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
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
  perform public.admin_save_cosmetic('zimowa_aura_magic', 'Zimowa magia', 'aura', null);
  assert (select type from public.cosmetics where id = 'zimowa_aura_magic') = 'aura', 'aura z ruchem w id';
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
select pg_temp.expect_error($q$select public.admin_save_cosmetic('aura_bez_ruchu', 'x', 'aura', null)$q$, 'aura_id_invalid');
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
insert into public.owned_cosmetics (user_id, cosmetic_id) values ('22222222-2222-2222-2222-222222222222', 'halloween_aura_magic') on conflict do nothing;
update public.profiles set equipped = '{"cape":"cape_two","hat":"hat_one","wings":"nie_ma","aura":"halloween_aura_magic"}' where id = '22222222-2222-2222-2222-222222222222';
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select public.mib_hello('Gracz', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa') ->> 'token' as tok2 \gset
do $$ begin
  assert (select cape from public.mib_who(null, array['Gracz'])) = 'cape_two', 'peleryna gracza MiB';
  assert (select hat from public.mib_who(null, array['Gracz'])) = 'hat_one', 'czapka gracza MiB';
  assert (select wings from public.mib_who(null, array['Gracz'])) is null, 'skrzydeł nie ma';
  assert (select aura from public.mib_who(null, array['Gracz'])) = 'halloween_aura_magic', 'aura gracza MiB';
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

-- Wiadomości do znajomych: tylko znajomi, 1–500 znaków bez znaków sterujących i kodów §, nieprzeczytane do licznika,
-- rozmowę widzą tylko te dwie osoby, usunięcie ze znajomych kasuje rozmowę
set role authenticated;
set request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
select pg_temp.expect_error($q$select public.message_send('77777777-7777-7777-7777-777777777777', 'hej')$q$, 'message_not_friend');
select pg_temp.expect_error($q$select public.message_send('66666666-6666-6666-6666-666666666666', '  ')$q$, 'message_empty');
select pg_temp.expect_error($q$select public.message_send('66666666-6666-6666-6666-666666666666', repeat('a', 501))$q$, 'message_long');
do $$ begin
  assert (public.message_send('66666666-6666-6666-6666-666666666666', E'  §cHej\n co  tam? ') ->> 'id') is not null, 'wysłana';
  perform public.message_send('66666666-6666-6666-6666-666666666666', 'Wchodzisz na serwer?');
  assert (select string_agg(body, '|' order by id) from public.messages_with('66666666-6666-6666-6666-666666666666')) = 'Hej  co  tam?|Wchodzisz na serwer?', 'treść bez kodu §c i nowej linii';
  assert (select bool_and(mine) from public.messages_with('66666666-6666-6666-6666-666666666666')), 'moje wiadomości';
  assert (select count(*) from public.messages_unread()) = 0, 'moje wiadomości nie są dla mnie nieprzeczytane';
end $$;
set request.jwt.claim.sub = '77777777-7777-7777-7777-777777777777';
do $$ begin
  assert (select count(*) from public.messages_with('55555555-5555-5555-5555-555555555555')) = 0, 'obcy nie widzi cudzej rozmowy';
end $$;
set request.jwt.claim.sub = '66666666-6666-6666-6666-666666666666';
do $$ begin
  assert (select nick || ' ' || unread || ' ' || last_body from public.messages_unread()) = 'Zapraszam 2 Wchodzisz na serwer?', 'licznik nieprzeczytanych i ostatnia';
  assert (select count(*) from public.messages_with('55555555-5555-5555-5555-555555555555') where not mine) = 2, 'odbiorca widzi rozmowę';
  perform public.messages_read('55555555-5555-5555-5555-555555555555');
  assert (select count(*) from public.messages_unread()) = 0, 'po otwarciu przeczytane';
  perform public.message_send('55555555-5555-5555-5555-555555555555', 'Już!');
end $$;
select pg_temp.expect_error($q$select * from private.friend_messages$q$, 'permission denied');
select pg_temp.expect_error($q$select private.are_friends('55555555-5555-5555-5555-555555555555', '66666666-6666-6666-6666-666666666666')$q$, 'permission denied');
set request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
do $$ begin
  assert (select read from public.messages_with('66666666-6666-6666-6666-666666666666') where mine order by id limit 1), 'nadawca widzi, że przeczytane';
  for i in 1..17 loop perform public.message_send('66666666-6666-6666-6666-666666666666', 'spam ' || i); end loop;
end $$;
select pg_temp.expect_error($q$select public.message_send('66666666-6666-6666-6666-666666666666', 'za dużo')$q$, 'message_limit');
select public.friend_remove('66666666-6666-6666-6666-666666666666');
reset role;
do $$ begin
  assert (select count(*) from private.friend_messages where '55555555-5555-5555-5555-555555555555' in (from_id, to_id)) = 0, 'usunięcie ze znajomych kasuje rozmowę';
end $$;
set role anon;
select pg_temp.expect_error($q$select public.messages_unread()$q$, 'permission denied');
reset role;

-- Prezenty od MiB i odpowiedzi na pomysły: tylko admin wysyła, gracz odbiera raz, nagrodzony błąd liczy się do odznaki,
-- zmiana statusu i odpowiedź trafiają do powiadomień autora, do obejrzenia
set role authenticated;
set request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
select public.submit_idea('bug', 'Czat w grze gubi polskie litery');
select public.submit_idea('feature', 'Więcej emotek tanecznych w kole');
select pg_temp.expect_error($q$select public.admin_gift('55555555-5555-5555-5555-555555555555', 'cape_two', 'x', null)$q$, 'not_admin');
select pg_temp.expect_error($q$select public.admin_answer_idea(1, 'done', 'x')$q$, 'not_admin');
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$
declare v_bug bigint; v_feat bigint;
begin
  select id into v_bug from public.admin_list_ideas() where nick = 'Zapraszam' and category = 'bug';
  select id into v_feat from public.admin_list_ideas() where nick = 'Zapraszam' and category = 'feature';
  assert (select user_id from public.admin_list_ideas() where id = v_bug) = '55555555-5555-5555-5555-555555555555', 'admin widzi autora';
  perform public.admin_gift('55555555-5555-5555-5555-555555555555', 'cape_two', '  Dzięki za znalezienie błędu z czatem!  ', v_bug);
  assert (select status || ' ' || rewarded from public.admin_list_ideas() where id = v_bug) = 'done true', 'nagrodzony pomysł: Zrobione';
  perform public.admin_answer_idea(v_feat, 'planned', 'Dodamy w następnej wersji.');
  perform public.admin_gift('55555555-5555-5555-5555-555555555555', 'hat_one', null, null);
end $$;
select pg_temp.expect_error($q$select public.admin_gift('55555555-5555-5555-5555-555555555555', 'cape_two', null,
  (select id from public.admin_list_ideas() where nick = 'Zapraszam' and category = 'bug'))$q$, 'idea_rewarded');
select pg_temp.expect_error($q$select public.admin_gift('55555555-5555-5555-5555-555555555555', 'nie_ma', null, null)$q$, 'cosmetic_missing');
select pg_temp.expect_error($q$select public.admin_gift('55555555-5555-5555-5555-555555555555', 'cape_two', repeat('x', 201), null)$q$, 'gift_message_long');
set request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
do $$
declare v_gift bigint;
begin
  assert (select count(*) from public.my_gifts()) = 2, 'dwa prezenty do odebrania';
  assert (select message || ' ' || bug || ' ' || name from public.my_gifts() order by id limit 1) = 'Dzięki za znalezienie błędu z czatem! true Peleryna Dwa', 'wiadomość i nagroda za błąd';
  assert (select bugs_found from public.profiles) = 1, 'odznaka Łowca błędów: 1';
  assert (select count(*) from public.ideas_updates()) = 2, 'dwie zmiany w moich pomysłach';
  assert (select reply from public.ideas_updates() where status = 'planned') = 'Dodamy w następnej wersji.', 'odpowiedź twórcy';
  perform public.ideas_seen();
  assert (select count(*) from public.ideas_updates()) = 0, 'po obejrzeniu brak nowych zmian';
  select id into v_gift from public.my_gifts() order by id limit 1;
  assert public.claim_gift(v_gift) = 'cape_two', 'odebrany kosmetyk';
  assert exists (select 1 from public.owned_cosmetics where cosmetic_id = 'cape_two' and source = 'gift'), 'kosmetyk na profilu';
  assert (select count(*) from public.my_gifts()) = 1, 'odebrany znika z listy';
end $$;
select pg_temp.expect_error($q$select public.claim_gift((select min(id) from private.gifts))$q$, 'permission denied');
select pg_temp.expect_error($q$select * from private.gifts$q$, 'permission denied');
set request.jwt.claim.sub = '66666666-6666-6666-6666-666666666666';
do $$ begin
  assert (select count(*) from public.my_gifts()) = 0, 'cudzych prezentów nie widać';
end $$;
select pg_temp.expect_error($q$select public.claim_gift((select id from public.my_gifts() limit 1) + 0)$q$, 'gift_missing');
reset role;
do $$ begin
  assert (select count(*) from private.gifts where claimed_at is not null) = 1, 'odebrany tylko raz';
end $$;

-- Bezpieczeństwo (0.20.0): zgłoszenie wiadomości z kopią rozmowy, blokowanie, ostrzeżenia (czwarte = ban), zdjęcie bana
set role authenticated;
set request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
select public.friend_request('Zaproszony');
set request.jwt.claim.sub = '66666666-6666-6666-6666-666666666666';
select public.friend_answer('55555555-5555-5555-5555-555555555555', true);
select public.message_send('55555555-5555-5555-5555-555555555555', 'Cześć');
select public.message_send('55555555-5555-5555-5555-555555555555', 'Jesteś słaby, noob');
set request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
do $$
declare v_msg bigint;
begin
  select max(id) into v_msg from public.messages_with('66666666-6666-6666-6666-666666666666') where not mine;
  assert public.report_user('66666666-6666-6666-6666-666666666666', v_msg, 'insult', ' Obraża mnie ') > 0, 'zgłoszenie zapisane';
end $$;
select pg_temp.expect_error($q$select public.report_user('66666666-6666-6666-6666-666666666666',
  (select max(id) from public.messages_with('66666666-6666-6666-6666-666666666666') where not mine), 'spam', null)$q$, 'report_exists');
select pg_temp.expect_error($q$select public.report_user('66666666-6666-6666-6666-666666666666', 99999999, 'insult', null)$q$, 'report_message_missing');
select pg_temp.expect_error($q$select public.report_user('66666666-6666-6666-6666-666666666666', null, 'zly', null)$q$, 'report_reason');
select pg_temp.expect_error($q$select public.report_user('55555555-5555-5555-5555-555555555555', null, 'spam', null)$q$, 'player_missing');
select pg_temp.expect_error($q$select public.report_user('66666666-6666-6666-6666-666666666666', null, 'spam', repeat('x', 301))$q$, 'report_long');
select pg_temp.expect_error($q$select * from private.reports$q$, 'permission denied');
select pg_temp.expect_error($q$select public.admin_list_reports()$q$, 'not_admin');
select pg_temp.expect_error($q$select public.admin_warn('66666666-6666-6666-6666-666666666666', 'x', null)$q$, 'not_admin');
select public.block_user('66666666-6666-6666-6666-666666666666');
do $$ begin
  assert (select count(*) from public.friends_list()) = 0, 'blokada kończy znajomość';
  assert (select nick from public.blocked_list()) = 'Zaproszony', 'lista zablokowanych';
end $$;
set request.jwt.claim.sub = '66666666-6666-6666-6666-666666666666';
select pg_temp.expect_error($q$select public.friend_request('Zapraszam')$q$, 'friend_blocked');
select pg_temp.expect_error($q$select public.message_send('55555555-5555-5555-5555-555555555555', 'hej')$q$, 'message_not_friend');
set request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
select public.unblock_user('66666666-6666-6666-6666-666666666666');
do $$ begin
  assert (select count(*) from public.blocked_list()) = 0, 'odblokowany';
end $$;
reset role;
insert into private.mib_players (uuid, name, user_id, token_hash) values ('99999999-9999-9999-9999-999999999999', 'Zaproszony_MC', '66666666-6666-6666-6666-666666666666', 'x');
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$
declare r record; v json;
begin
  select * into r from public.admin_list_reports() where nick = 'Zaproszony';
  assert r.reporter = 'Zapraszam' and r.status = 'new' and r.note = 'Obraża mnie' and r.reason = 'insult', 'zgłoszenie w panelu';
  assert jsonb_array_length(r.messages) = 2 and (r.messages -> 1 ->> 'body') = 'Jesteś słaby, noob' and (r.messages -> 1 ->> 'reported')::boolean
    and (r.messages -> 0 ->> 'from') = 'Zaproszony', 'kopia rozmowy do zgłoszonej wiadomości';
  assert public.admin_count_new_reports() = 1, 'licznik nowych zgłoszeń';
  v := public.admin_warn(r.user_id, ' Obrażanie graczy na czacie ', r.id);
  assert (v ->> 'warnings')::integer = 1 and not (v ->> 'banned')::boolean, 'pierwsze ostrzeżenie';
  assert (select status from public.admin_list_reports() where id = r.id) = 'warned', 'zgłoszenie załatwione';
  assert public.admin_count_new_reports() = 0, 'brak nowych zgłoszeń';
  perform public.admin_warn(r.user_id, 'Spam', null);
  perform public.admin_warn(r.user_id, 'Spam', null);
  v := public.admin_warn(r.user_id, 'Ostatnie ostrzeżenie', null);
  assert (v ->> 'banned')::boolean, 'czwarte ostrzeżenie to ban';
  assert (select banned and warnings = 4 and ban_reason = 'Ostatnie ostrzeżenie' from public.admin_find_players('Zaproszony')), 'ban w panelu';
end $$;
select pg_temp.expect_error($q$select public.admin_warn('66666666-6666-6666-6666-666666666666', 'x', null)$q$, 'already_banned');
select pg_temp.expect_error($q$select public.admin_warn('22222222-2222-2222-2222-222222222222', 'x', null)$q$, 'cannot_ban_admin');
select pg_temp.expect_error($q$select public.admin_ban('22222222-2222-2222-2222-222222222222', 'x', null)$q$, 'cannot_ban_admin');
select pg_temp.expect_error($q$select public.admin_warn('55555555-5555-5555-5555-555555555555', '  ', null)$q$, 'warn_reason');
set role anon;
do $$ begin
  assert (select count(*) from public.mib_who(array['99999999-9999-9999-9999-999999999999'::uuid], null)) = 0, 'zbanowany bez logo MiB w grze';
end $$;
set role authenticated;
set request.jwt.claim.sub = '66666666-6666-6666-6666-666666666666';
do $$ begin
  assert (select count(*) from public.my_warnings()) = 4 and (select max(num) from public.my_warnings()) = 4, 'gracz widzi ostrzeżenia';
  assert (select reason from public.my_warnings() order by id limit 1) = 'Obrażanie graczy na czacie', 'powód ostrzeżenia';
  perform public.warnings_seen();
  assert (select count(*) from public.my_warnings()) = 0, 'obejrzane';
  assert (select banned_at is not null from public.profiles), 'gracz widzi swój ban';
  perform public.presence_ping(false, '1.21.11', null);
end $$;
select pg_temp.expect_error($q$select public.submit_idea('bug', 'Coś tu wcale nie działa')$q$, 'banned');
select pg_temp.expect_error($q$select public.friend_request('Gracz_1')$q$, 'banned');
select pg_temp.expect_error($q$select public.report_user('55555555-5555-5555-5555-555555555555', null, 'spam', null) + public.message_send('55555555-5555-5555-5555-555555555555', 'x')::text::bigint$q$, 'banned');
reset role;
do $$ begin
  assert not exists (select 1 from private.presence where user_id = '66666666-6666-6666-6666-666666666666'), 'zbanowany bez obecności dla znajomych';
  assert exists (select 1 from private.activity where user_id = '66666666-6666-6666-6666-666666666666' and day = private.today()), 'aktywność liczy się dalej';
end $$;
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select public.admin_unban('66666666-6666-6666-6666-666666666666');
do $$ begin
  assert (select not banned and warnings = 0 from public.admin_find_players('Zaproszony')), 'ban zdjęty, ostrzeżenia od zera';
end $$;
set role anon;
do $$ begin
  assert (select count(*) from public.mib_who(array['99999999-9999-9999-9999-999999999999'::uuid], null)) = 1, 'po zdjęciu bana logo wraca';
end $$;

-- Osiągnięcia, karta znajomego i tryb niewidoczny
set role authenticated;
set request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
do $$
declare c json := public.profile_card();
begin
  assert c ->> 'nick' = 'Zapraszam' and (c ->> 'ideas')::integer = 2 and (c ->> 'ideas_done')::integer = 1 and (c ->> 'bugs_found')::integer = 1, 'moje liczby do osiągnięć';
  assert (c ->> 'owned')::integer >= 1 and (c ->> 'friends')::integer = 0, 'kosmetyki i znajomi';
end $$;
select pg_temp.expect_error($q$select public.profile_card('66666666-6666-6666-6666-666666666666')$q$, 'not_friend');
select public.friend_request('Zaproszony');
set request.jwt.claim.sub = '66666666-6666-6666-6666-666666666666';
select public.friend_answer('55555555-5555-5555-5555-555555555555', true);
select public.presence_ping(true, '1.21.11', 'play.mib.pl', true);
set request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
do $$
declare c json := public.profile_card('66666666-6666-6666-6666-666666666666');
begin
  assert (select status from public.friends_list() where nick = 'Zaproszony') = 'offline', 'niewidoczny wygląda na offline';
  assert c ->> 'nick' = 'Zaproszony' and c ->> 'mc_name' = 'Zaproszony_MC' and json_typeof(c -> 'equipped') = 'array', 'karta znajomego';
end $$;
set request.jwt.claim.sub = '66666666-6666-6666-6666-666666666666';
select public.presence_ping(true, '1.21.11', 'play.mib.pl', false);
set request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
do $$ begin
  assert (select status from public.friends_list() where nick = 'Zaproszony') = 'game', 'widoczny znów w grze';
end $$;

-- Prezent dla wszystkich, kody z własną nazwą i datą końca, raport awarii, aktualność w oknie, wykres graczy
set request.jwt.claim.sub = '77777777-7777-7777-7777-777777777777';
select pg_temp.expect_error($q$select public.admin_gift_all('hat_one', null)$q$, 'not_admin');
select pg_temp.expect_error($q$select public.admin_activity(30)$q$, 'not_admin');
do $$
declare v bigint;
begin
  v := public.submit_crash('Awaria gry: Minecraft 1.21.11, zabrakło pamięci', repeat('log ', 100));
  assert v > 0, 'raport awarii wysłany';
end $$;
select pg_temp.expect_error($q$select public.submit_crash('krótko', null)$q$, 'idea_short');
select pg_temp.expect_error($q$select public.submit_crash('Awaria gry: Minecraft 26.1', repeat('x', 20001))$q$, 'crash_long');
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$
declare v_n integer; v_id bigint; v_codes json; r record;
begin
  v_n := public.admin_gift_all('hat_one', 'Na święta!');
  assert v_n > 0, 'prezent dla wszystkich, którzy go nie mają';
  assert public.admin_gift_all('hat_one', null) = 0, 'drugi raz nikt nie dostaje podwójnie';
  v_codes := public.admin_create_codes('cape_mib', 1, 50, null, now() + interval '2 days', ' turniej2026 ');
  assert v_codes::text = '["TURNIEJ2026"]', 'kod o własnej nazwie';
  select * into r from public.admin_list_codes() where code = 'TURNIEJ2026';
  assert r.max_uses = 50 and r.expires_at between now() + interval '47 hours' and now() + interval '49 hours', 'ważny do daty';
  select id into v_id from public.admin_list_ideas() where has_details;
  assert public.admin_idea_details(v_id) like 'log log%', 'admin czyta raport awarii';
  assert (select category from public.admin_list_ideas() where id = v_id) = 'bug', 'raport to zgłoszenie błędu';
  perform public.admin_save_announcement(null, 'Turniej za godzinę', '', false, null, true);
  assert (select popup from public.admin_list_announcements() where title = 'Turniej za godzinę'), 'aktualność w oknie';
  assert (select count(*) from public.admin_activity(30)) = 30, '30 dni na wykresie';
  select * into r from public.admin_activity(30) order by day desc limit 1;
  assert r.players >= 2 and r.played >= 1 and r.new_profiles >= 5, 'dzisiaj: gracze, w grze i nowe profile';
end $$;
reset role;
do $$ begin
  assert not exists (select 1 from public.profiles p where p.banned_at is null
    and not exists (select 1 from public.owned_cosmetics o where o.user_id = p.id and o.cosmetic_id = 'hat_one')
    and (select count(*) from private.gifts g where g.user_id = p.id and g.cosmetic_id = 'hat_one' and g.claimed_at is null) <> 1),
    'każdy gracz bez tej czapki ma dokładnie jeden prezent do odebrania';
  assert (select message from private.gifts where cosmetic_id = 'hat_one' order by id desc limit 1) = 'Na święta!', 'wiadomość do wszystkich';
end $$;
set role authenticated;
select pg_temp.expect_error($q$select public.admin_create_codes('cape_mib', 1, 1, null, null, 'TURNIEJ2026')$q$, 'code_exists');
select pg_temp.expect_error($q$select public.admin_create_codes('cape_mib', 2, 1, null, null, 'DWA-KODY')$q$, 'codes_invalid');
select pg_temp.expect_error($q$select public.admin_create_codes('cape_mib', 1, 1, null, null, 'zły kod')$q$, 'code_name_invalid');
select pg_temp.expect_error($q$select public.admin_create_codes('cape_mib', 1, 1, null, now() - interval '1 hour', null)$q$, 'codes_invalid');
set role anon;
do $$ begin
  assert (select popup from public.announcements where title = 'Turniej za godzinę'), 'gracze widzą, że to okno';
end $$;
reset role;

-- Głosowanie na pomysły (0.21.0): bez zgłoszeń błędów, odrzuconych i od zbanowanych; jeden głos, nie na własny
set role authenticated;
set request.jwt.claim.sub = '66666666-6666-6666-6666-666666666666';
do $$
declare v_id bigint;
begin
  select id into v_id from public.ideas_public('top') where body = 'Więcej emotek tanecznych w kole';
  assert v_id is not null, 'pomysł innego gracza na liście';
  assert not exists (select 1 from public.ideas_public('new') where category = 'bug'), 'bez zgłoszeń błędów';
  assert (select nick || ' ' || votes || ' ' || voted || ' ' || mine from public.ideas_public('top') where id = v_id) = 'Zapraszam 0 false false', 'autor, głosy, mój głos';
  assert public.idea_vote(v_id, true) = 1, 'głos oddany';
  assert public.idea_vote(v_id, true) = 1, 'drugi raz ten sam głos';
  assert (select voted from public.ideas_public('top') where id = v_id), 'widać mój głos';
  assert public.idea_vote(v_id, false) = 0, 'głos cofnięty';
  perform public.idea_vote(v_id, true);
end $$;
select pg_temp.expect_error($q$select public.idea_vote((select min(id) from public.admin_list_ideas()), true)$q$, 'not_admin');
select pg_temp.expect_error($q$select public.idea_vote(99999999, true)$q$, 'idea_missing');
select pg_temp.expect_error($q$select * from private.idea_votes$q$, 'permission denied');
set request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
select pg_temp.expect_error($q$select public.idea_vote((select id from public.ideas_public('top') where body = 'Więcej emotek tanecznych w kole'), true)$q$, 'idea_own');
do $$ begin
  assert (select mine from public.ideas_public('top') where body = 'Więcej emotek tanecznych w kole'), 'mój pomysł oznaczony';
end $$;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$
declare v_id bigint; v_bug bigint;
begin
  select id into v_id from public.admin_list_ideas() where body = 'Więcej emotek tanecznych w kole';
  assert (select votes from public.admin_list_ideas() where id = v_id) = 1, 'admin widzi głosy';
  select id into v_bug from public.admin_list_ideas() where category = 'bug' limit 1;
  begin
    perform public.idea_vote(v_bug, true);
    raise exception 'głos na zgłoszenie błędu przeszedł';
  exception when others then
    if sqlerrm <> 'idea_missing' then raise; end if;
  end;
  perform public.admin_set_idea_status(v_id, 'rejected');
  assert not exists (select 1 from public.ideas_public('top') where id = v_id), 'odrzucony znika z głosowania';
  perform public.admin_set_idea_status(v_id, 'planned');
  perform public.admin_ban('55555555-5555-5555-5555-555555555555', 'Test', null);
  assert not exists (select 1 from public.ideas_public('top') where id = v_id), 'pomysły zbanowanego znikają';
  perform public.admin_unban('55555555-5555-5555-5555-555555555555');
  assert exists (select 1 from public.ideas_public('top') where id = v_id), 'po zdjęciu bana wracają';
end $$;
set role anon;
select pg_temp.expect_error($q$select * from public.ideas_public('top')$q$, 'permission denied');
reset role;

-- Kosmetyki na Halloween (od 0.22.0): 3 peleryny, 5 czapek, 2 skrzydła, 4 aury z ruchem w id; tekstury PNG
do $$ begin
  assert (select count(*) from public.cosmetics where id like 'halloween\_%') = 14, 'kosmetyki na Halloween';
  assert (select string_agg(type || ':' || n, ',' order by type) from (select type, count(*) n from public.cosmetics where id like 'halloween\_%' group by type) x)
    = 'aura:4,cape:3,hat:5,wings:2', 'rodzaje kosmetyków na Halloween';
  assert not exists (select 1 from public.cosmetics where id like 'halloween\_%' and (texture not like 'data:image/png;base64,iVBORw0KGgo%'
    or (type = 'aura' and id !~ '_(souls|pumpkins|ghosts|magic)$'))), 'tekstury PNG i ruch aur';
end $$;

-- MiB Coins i sklep (od 0.23.0): saldo zmienia tylko admin, gracz widzi swoje, link do sklepu widzą wszyscy
set role authenticated;
set request.jwt.claim.sub = '77777777-7777-7777-7777-777777777777';
do $$ begin
  assert (select coins from public.profiles where id = '77777777-7777-7777-7777-777777777777') = 0, 'na start 0 coinsów';
end $$;
select pg_temp.expect_error($q$update public.profiles set coins = 999999$q$, 'permission denied');
select pg_temp.expect_error($q$select public.admin_give_coins('77777777-7777-7777-7777-777777777777', 100, 'x')$q$, 'not_admin');
select pg_temp.expect_error($q$select public.admin_set_config('shop_url', 'https://sklep.mib.pl')$q$, 'not_admin');
reset role;
insert into private.admins (user_id) values ('22222222-2222-2222-2222-222222222222') on conflict do nothing;
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$ begin
  assert public.admin_give_coins('77777777-7777-7777-7777-777777777777', 1000, 'zakup na stronie') = 1000, 'dodane coinsy';
  assert public.admin_give_coins('77777777-7777-7777-7777-777777777777', -250, null) = 750, 'zabrane coinsy';
  assert (select coins from public.admin_find_players('Obcy')) = 750, 'saldo w panelu admina';
  perform public.admin_set_config('shop_url', ' https://sklep.mib.pl/coins ');
  assert (select value from public.app_config where key = 'shop_url') = 'https://sklep.mib.pl/coins', 'link do sklepu';
end $$;
select pg_temp.expect_error($q$select public.admin_give_coins('77777777-7777-7777-7777-777777777777', -5000, null)$q$, 'coins_not_enough');
select pg_temp.expect_error($q$select public.admin_give_coins('77777777-7777-7777-7777-777777777777', 0, null)$q$, 'coins_amount');
select pg_temp.expect_error($q$select public.admin_give_coins('99999999-0000-0000-0000-000000000000', 5, null)$q$, 'player_missing');
select pg_temp.expect_error($q$select public.admin_set_config('shop_url', 'http://zly.pl')$q$, 'shop_url_invalid');
select pg_temp.expect_error($q$select public.admin_set_config('shop_url', 'https://a.pl/"><script>')$q$, 'shop_url_invalid');
select pg_temp.expect_error($q$select public.admin_set_config('inne', 'x')$q$, 'config_key');
reset role;
do $$ begin
  assert (select count(*) from private.coin_log where user_id = '77777777-7777-7777-7777-777777777777') = 2, 'historia coinsów';
  assert (select balance from private.coin_log where user_id = '77777777-7777-7777-7777-777777777777' order by id desc limit 1) = 750, 'saldo w historii';
end $$;
set role anon;
do $$ begin assert (select value from public.app_config where key = 'shop_url') = 'https://sklep.mib.pl/coins', 'link widać bez profilu'; end $$;
select pg_temp.expect_error($q$insert into public.app_config (key, value) values ('shop_url', 'https://zly.pl')$q$, 'permission denied');
reset role;
set role authenticated;
set request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
do $$ begin assert (select count(*) from public.profiles where id = '77777777-7777-7777-7777-777777777777') = 0, 'cudzego salda nie widać'; end $$;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$ begin perform public.admin_set_config('shop_url', ''); assert not exists (select 1 from public.app_config), 'pusty link usuwa przycisk'; end $$;
reset role;

-- Sklep za MiB Coins (od 0.24.0): ceny i oferty ustawia admin, gracz kupuje dla siebie albo dla znajomego,
-- pakiet taniej o to, co już ma, historia coinsów i nagroda dzienna
insert into auth.users (id, email, encrypted_password, raw_user_meta_data) values
  ('88888888-8888-8888-8888-888888888888', 'shop1@test.pl', 'x', '{"nick":"Kupiec"}'),
  ('99999999-9999-9999-9999-999999999999', 'shop2@test.pl', 'x', '{"nick":"Kumpel"}');
-- kolekcja Halloween jest na sprzedaż tylko w czasie święta (od 0.25.0): tu bez kolekcji, żeby test nie zależał od daty
update public.themes set items = '{}' where id = 'halloween';
insert into public.cosmetics (id, name, type) values ('shop_test_hat', 'Testowa czapka', 'hat');
set role authenticated;
set request.jwt.claim.sub = '88888888-8888-8888-8888-888888888888';
select pg_temp.expect_error($q$select public.buy_cosmetic('halloween_cape_pumpkin')$q$, 'not_for_sale');
select pg_temp.expect_error($q$select public.admin_set_price('halloween_cape_pumpkin', 800)$q$, 'not_admin');
select pg_temp.expect_error($q$select public.admin_save_offer(null, 'X', array['halloween_cape_pumpkin'], 1, null)$q$, 'not_admin');
select pg_temp.expect_error($q$select * from private.shop_offers$q$, 'permission denied');
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select pg_temp.expect_error($q$select public.admin_set_price('halloween_cape_pumpkin', 0)$q$, 'price_invalid');
select pg_temp.expect_error($q$select public.admin_set_price('nie_ma_takiego', 100)$q$, 'cosmetic_missing');
select pg_temp.expect_error($q$select public.admin_save_offer(null, 'Zły', array['nie_ma_takiego'], 100, null)$q$, 'offer_items_invalid');
select pg_temp.expect_error($q$select public.admin_save_offer(null, 'Zły', array[]::text[], 100, null)$q$, 'offer_items_invalid');
select pg_temp.expect_error($q$select public.admin_save_offer(null, '', array['halloween_hat_skull'], 100, null)$q$, 'offer_name_invalid');
select pg_temp.expect_error($q$select public.admin_save_offer(null, 'Zły', array['halloween_hat_skull'], 0, null)$q$, 'price_invalid');
select pg_temp.expect_error($q$select public.admin_save_offer(null, 'Zły', array['halloween_hat_skull'], 100, now() - interval '1 minute')$q$, 'offer_end_past');
select pg_temp.expect_error($q$select public.admin_save_offer(99999999, 'Zły', array['halloween_hat_skull'], 100, null)$q$, 'offer_missing');
do $$
declare v_id bigint;
begin
  perform public.admin_set_price('halloween_cape_pumpkin', 800);
  perform public.admin_set_price('halloween_hat_pumpkin', 500);
  perform public.admin_set_price('halloween_hat_skull', 500);
  perform public.admin_set_price('halloween_aura_souls', 1000);
  v_id := public.admin_save_offer(null, ' Pakiet Halloween ', array['halloween_cape_pumpkin', 'halloween_hat_pumpkin', 'halloween_hat_skull', 'halloween_hat_skull'],
    1200, now() + interval '5 days');
  assert (select name || ' ' || cardinality(items) || ' ' || full_price from public.admin_list_offers() where id = v_id) = 'Pakiet Halloween 3 1800',
    'oferta bez powtórzeń z sumą zwykłych cen';
  perform public.admin_save_offer(null, 'Tylko testowa', array['shop_test_hat'], 50, null);
  perform public.admin_give_coins('88888888-8888-8888-8888-888888888888', 2000, 'zakup na stronie');
end $$;
select pg_temp.expect_error($q$select public.admin_delete_cosmetic('shop_test_hat')$q$, 'cosmetic_in_use');
do $$ begin
  perform public.admin_delete_offer((select id from public.admin_list_offers() where name = 'Tylko testowa'));
  perform public.admin_delete_cosmetic('shop_test_hat');
  assert not exists (select 1 from public.cosmetics where id = 'shop_test_hat'), 'kosmetyk bez oferty można usunąć';
end $$;
set request.jwt.claim.sub = '88888888-8888-8888-8888-888888888888';
do $$
declare s json; r json;
begin
  s := public.shop();
  assert (s ->> 'coins')::integer = 2000, 'saldo w sklepie';
  assert (select (x ->> 'price')::integer from json_array_elements(s -> 'items') x where x ->> 'id' = 'halloween_cape_pumpkin') = 800, 'cena kosmetyku';
  assert (select x ->> 'texture' from json_array_elements(s -> 'items') x where x ->> 'id' = 'halloween_cape_pumpkin') like 'data:image/png;base64,%', 'tekstura do podglądu';
  assert not exists (select 1 from json_array_elements(s -> 'items') x where x ->> 'id' = 'cape_start'), 'bez kosmetyków spoza sklepu';
  assert (select (x ->> 'full')::integer || ' ' || (x ->> 'mine')::integer from json_array_elements(s -> 'offers') x) = '1800 1200', 'pełna i moja cena pakietu';
  r := public.buy_cosmetic('halloween_hat_pumpkin');
  assert (r ->> 'coins')::integer = 1500 and r ->> 'name' = 'Dynia' and r ->> 'gift' is null, 'zakup dla siebie';
  assert (select source from public.owned_cosmetics where user_id = auth.uid() and cosmetic_id = 'halloween_hat_pumpkin') = 'shop', 'kosmetyk na profilu';
  s := public.shop();
  assert (select (x ->> 'owned')::boolean from json_array_elements(s -> 'items') x where x ->> 'id' = 'halloween_hat_pumpkin'), 'kupiony oznaczony';
  assert (select (x ->> 'mine')::integer from json_array_elements(s -> 'offers') x) = 867, 'pakiet taniej o to, co już mam (1200 × 1300/1800 w górę)';
end $$;
select pg_temp.expect_error($q$select public.buy_cosmetic('halloween_hat_pumpkin')$q$, 'already_owned');
select pg_temp.expect_error($q$select public.buy_cosmetic('halloween_aura_souls', '99999999-9999-9999-9999-999999999999', 'hej')$q$, 'gift_not_friend');
select public.friend_request('Kumpel');
set request.jwt.claim.sub = '99999999-9999-9999-9999-999999999999';
select public.friend_answer('88888888-8888-8888-8888-888888888888', true);
set request.jwt.claim.sub = '88888888-8888-8888-8888-888888888888';
select pg_temp.expect_error($q$select public.buy_cosmetic('halloween_aura_souls', '99999999-9999-9999-9999-999999999999', repeat('x', 201))$q$, 'gift_message_long');
do $$
declare r json;
begin
  r := public.buy_cosmetic('halloween_aura_souls', '99999999-9999-9999-9999-999999999999', E' Dla Ciebie! §c\n');
  assert (r ->> 'coins')::integer = 500 and (r ->> 'gift') is not null, 'prezent dla znajomego';
  assert not exists (select 1 from public.owned_cosmetics where user_id = auth.uid() and cosmetic_id = 'halloween_aura_souls'), 'kupujący go nie dostaje';
end $$;
select pg_temp.expect_error($q$select public.buy_cosmetic('halloween_aura_souls', '99999999-9999-9999-9999-999999999999', null)$q$, 'friend_has_it');
select pg_temp.expect_error($q$select public.buy_offer((select (x ->> 'id')::bigint from json_array_elements(public.shop() -> 'offers') x))$q$, 'coins_not_enough');
set request.jwt.claim.sub = '99999999-9999-9999-9999-999999999999';
do $$ begin
  assert (select from_nick || ' ' || message || ' ' || cosmetic_id from public.my_gifts()) = 'Kupiec Dla Ciebie! halloween_aura_souls', 'prezent od znajomego z wiadomością';
end $$;
select pg_temp.expect_error($q$select public.buy_cosmetic('halloween_aura_souls')$q$, 'already_owned');
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select public.admin_give_coins('88888888-8888-8888-8888-888888888888', 1000, null);
set request.jwt.claim.sub = '88888888-8888-8888-8888-888888888888';
do $$
declare v_offer bigint := (select (x ->> 'id')::bigint from json_array_elements(public.shop() -> 'offers') x); r json;
begin
  r := public.buy_offer(v_offer);
  assert (r ->> 'coins')::integer = 633 and (r ->> 'price')::integer = 867, 'pakiet za moją cenę';
  assert (select string_agg(x, ',' order by x) from json_array_elements_text(r -> 'items') x) = 'halloween_cape_pumpkin,halloween_hat_skull', 'brakujące przedmioty';
  assert (select count(*) from public.owned_cosmetics where user_id = auth.uid() and source = 'shop') = 3, 'pakiet na profilu';
  assert (select (x ->> 'mine')::integer from json_array_elements(public.shop() -> 'offers') x) = 0, 'mam wszystko z pakietu';
  assert (select string_agg(kind, ',' order by id desc) from public.my_coin_log()) = 'offer,admin,gift,buy,admin', 'historia coinsów';
  assert (select label || ' ' || delta || ' ' || balance from public.my_coin_log() where kind = 'offer') = 'Pakiet Halloween -867 633', 'pakiet w historii';
  assert (select friend || ' ' || label from public.my_coin_log() where kind = 'gift') = 'Kumpel Dusze', 'komu prezent';
  assert (select count(*) from public.my_coin_log((select max(id) from public.my_coin_log()))) = 4, 'starsze wpisy';
end $$;
select pg_temp.expect_error($q$select public.buy_offer((select (x ->> 'id')::bigint from json_array_elements(public.shop() -> 'offers') x))$q$, 'already_owned');
select pg_temp.expect_error($q$select public.buy_offer(99999999)$q$, 'offer_missing');
set request.jwt.claim.sub = '99999999-9999-9999-9999-999999999999';
do $$ begin
  assert not exists (select 1 from public.my_coin_log()), 'cudzej historii nie widać';
end $$;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$ begin
  assert (select sold from public.admin_list_offers() where name = 'Pakiet Halloween') = 1, 'sprzedane pakiety';
  assert (select count(*) from public.admin_coin_log('88888888-8888-8888-8888-888888888888')) = 5, 'historia gracza dla admina';
  perform public.admin_save_offer(null, 'Krótka', array['halloween_hat_mummy'], 100, now() + interval '1 hour');
end $$;
reset role;
update private.shop_offers set ends_at = now() - interval '1 second' where name = 'Krótka';
set role authenticated;
set request.jwt.claim.sub = '88888888-8888-8888-8888-888888888888';
do $$ begin
  assert not exists (select 1 from json_array_elements(public.shop() -> 'offers') x where x ->> 'name' = 'Krótka'), 'zakończonej oferty nie ma';
  assert not exists (select 1 from json_array_elements(public.shop() -> 'items') x where x ->> 'id' = 'halloween_hat_mummy'), 'ani jej przedmiotów';
end $$;
select pg_temp.expect_error($q$select public.buy_offer((select id from private.shop_offers where name = 'Krótka'))$q$, 'permission denied');
-- nagroda dzienna: raz na dobę, co 7. dzień z rzędu 50 więcej, przerwa zeruje serię
do $$
declare r json;
begin
  r := public.claim_daily();
  assert (r ->> 'claimed')::boolean and (r ->> 'amount')::integer = 10 and (r ->> 'streak')::integer = 1 and (r ->> 'coins')::integer = 643, 'pierwsza nagroda';
  r := public.claim_daily();
  assert not (r ->> 'claimed')::boolean and (r ->> 'streak')::integer = 1, 'drugi raz tego dnia nic';
end $$;
reset role;
update private.daily set last_day = private.today() - 1, streak = 6 where user_id = '88888888-8888-8888-8888-888888888888';
set role authenticated;
do $$
declare r json;
begin
  r := public.claim_daily();
  assert (r ->> 'streak')::integer = 7 and (r ->> 'amount')::integer = 60, '7. dzień z rzędu z bonusem';
  assert (select kind || ' ' || item || ' ' || delta from public.my_coin_log() limit 1) = 'daily 7 60', 'nagroda w historii';
end $$;
reset role;
update private.daily set last_day = private.today() - 3 where user_id = '88888888-8888-8888-8888-888888888888';
set role authenticated;
do $$ begin
  assert (public.claim_daily() ->> 'streak')::integer = 1, 'przerwa zeruje serię';
end $$;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select public.admin_ban('88888888-8888-8888-8888-888888888888', 'Test', null);
set request.jwt.claim.sub = '88888888-8888-8888-8888-888888888888';
select pg_temp.expect_error($q$select public.buy_cosmetic('halloween_hat_skull')$q$, 'banned');
do $$ begin assert not (public.claim_daily() ->> 'claimed')::boolean, 'zbanowany bez nagrody'; end $$;
set role anon;
select pg_temp.expect_error($q$select public.shop()$q$, 'permission denied');
select pg_temp.expect_error($q$select public.buy_cosmetic('halloween_hat_skull')$q$, 'permission denied');
select pg_temp.expect_error($q$select public.claim_daily()$q$, 'permission denied');
do $$ begin assert (select price from public.cosmetics where id = 'halloween_cape_pumpkin') = 800, 'ceny widać bez profilu'; end $$;
reset role;
do $$ begin
  assert not exists (select 1 from private.coin_log where kind is null), 'stare wpisy to admin';
end $$;

-- Motywy świąteczne, nagrody, kalendarz adwentowy i maska (od 0.25.0). Dzień „dzisiaj” podmieniony przez mib.today.
create or replace function private.today() returns date language sql stable set search_path = '' as $$
  select coalesce(nullif(current_setting('mib.today', true), '')::date, (now() at time zone 'Europe/Warsaw')::date);
$$;
do $$ begin
  assert private.easter(2024) = '2024-03-31' and private.easter(2025) = '2025-04-20' and private.easter(2026) = '2026-04-05'
    and private.easter(2027) = '2027-03-28' and private.easter(2028) = '2028-04-16', 'Wielkanoc';
  assert (select private.theme_season(t, '2026-12-31') from public.themes t where id = 'boze') = 2026, 'grudzień';
  assert (select private.theme_season(t, '2027-01-06') from public.themes t where id = 'boze') = 2026, 'przez Nowy Rok do 6 stycznia';
  assert (select private.theme_season(t, '2027-01-07') from public.themes t where id = 'boze') is null, 'po 6 stycznia koniec';
  assert (select private.theme_season(t, '2027-01-01') from public.themes t where id = 'sylwester') = 2026, 'Sylwester do 1 stycznia';
  assert (select private.theme_season(t, '2027-03-21') from public.themes t where id = 'wielkanoc') = 2027, 'tydzień przed Wielkanocą';
  assert (select private.theme_season(t, '2027-03-30') from public.themes t where id = 'wielkanoc') = 2027, '2 dni po Wielkanocy';
  assert (select private.theme_season(t, '2027-03-31') from public.themes t where id = 'wielkanoc') is null, 'po Wielkanocy';
  assert (select private.theme_until(t, '2026-12-10') from public.themes t where id = 'boze') = '2027-01-06', 'do kiedy';
  assert (select private.theme_until(t, '2026-11-20') from public.themes t where id = 'boze') is null, 'przed świętem bez końca';
  assert not private.on_sale('zima_cape_sweter', '2026-10-27') and private.on_sale('zima_cape_sweter', '2026-12-10'), 'kolekcja tylko w czasie święta';
  assert private.on_sale('shop_test_nie_ma', '2026-10-27') and private.on_sale('cape_start', '2026-10-27'), 'spoza kolekcji zawsze';
  assert (select count(*) from public.cosmetics where id ~ '^(niepodleglosc|zima|adwent|sylwester|walentynki|wielkanoc|primaaprilis|urodzinymc|dziendziecka|wakacje|urodzinymib)_') = 43, '43 kosmetyki na święta';
  assert (select count(*) from public.cosmetics where type = 'mask') = 2, 'dwie maski';
  assert (select count(*) from public.cosmetics where id like 'adwent\_%' and price is null) = 5, 'kalendarz: bez ceny';
  assert not exists (select 1 from public.cosmetics where type = 'aura' and id !~ '_(souls|pumpkins|ghosts|magic|snow|burst)$'), 'ruch aur';
  assert (select count(*) from public.themes) = 11, '11 motywów';
end $$;
insert into auth.users (id, email, encrypted_password, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'xmas1@test.pl', 'x', '{"nick":"Mikolaj"}');
set role anon;
do $$ begin assert (select count(*) from public.themes) = 11, 'motywy widać bez profilu'; end $$;
select pg_temp.expect_error($q$select public.advent()$q$, 'permission denied');
select pg_temp.expect_error($q$select * from private.advent_days$q$, 'permission denied');
reset role;
set role authenticated;
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
select pg_temp.expect_error($q$select public.admin_save_theme('boze', '12-01', '01-06', true, false, 0, null, 0, '{}')$q$, 'not_admin');
select pg_temp.expect_error($q$update public.themes set gift_coins = 99999$q$, 'permission denied');
-- 27 października: Halloween trwa (nagroda 50), kolekcja zimowa nie jest na sprzedaż
set mib.today = '2026-10-27';
do $$ declare s json; begin
  s := public.shop();
  assert (select string_agg(x ->> 'id', ',') from json_array_elements(s -> 'themes') x) is null, 'kolekcja Halloween wyłączona w tym teście';
  assert not exists (select 1 from json_array_elements(s -> 'items') x where x ->> 'id' like 'zima\_%'), 'zimowych jeszcze nie ma w sklepie';
  assert (select string_agg(id || ':' || coins, ',') from public.my_theme_gifts()) = 'halloween:50', 'nagroda na Halloween';
end $$;
select pg_temp.expect_error($q$select public.buy_cosmetic('zima_hat_mikolaj')$q$, 'not_for_sale');
select pg_temp.expect_error($q$select public.claim_theme_gift('boze')$q$, 'theme_gift_missing');
do $$ declare r json; begin
  r := public.claim_theme_gift('halloween');
  assert (r ->> 'amount')::integer = 50 and (r ->> 'coins')::integer = 50 and json_typeof(r -> 'cosmetic') = 'null', 'nagroda odebrana';
  assert not exists (select 1 from public.my_theme_gifts()), 'drugi raz jej nie ma';
  assert (select kind || ' ' || label || ' ' || delta from public.my_coin_log() limit 1) = 'theme Halloween 50', 'w historii';
end $$;
select pg_temp.expect_error($q$select public.claim_theme_gift('halloween')$q$, 'theme_gift_claimed');
select pg_temp.expect_error($q$select public.claim_theme_gift('nie_ma')$q$, 'theme_missing');
-- admin: nagroda z kosmetykiem, dodatek do nagrody dziennej, błędne daty, „Włącz teraz” tylko jeden
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select pg_temp.expect_error($q$select public.admin_save_theme('boze', '12-01', 'xx', true, false, 0, null, 0, '{}')$q$, 'theme_date_invalid');
select pg_temp.expect_error($q$select public.admin_save_theme('boze', '02-30', '03-01', true, false, 0, null, 0, '{}')$q$, 'theme_date_invalid');
select pg_temp.expect_error($q$select public.admin_save_theme('boze', '12-01', '01-06', true, false, 0, null, 0, '{nie_ma}')$q$, 'theme_items_invalid');
select pg_temp.expect_error($q$select public.admin_save_theme('nie_ma', '12-01', '01-06', true, false, 0, null, 0, '{}')$q$, 'theme_missing');
select pg_temp.expect_error($q$select public.admin_save_theme('boze', '12-01', '01-06', true, false, 0, 'nie_ma', 0, '{}')$q$, 'cosmetic_missing');
select pg_temp.expect_error($q$select public.admin_save_theme('boze', '12-01', '01-06', true, false, 0, null, 5000, '{}')$q$, 'theme_bonus_invalid');
do $$ declare r record; begin
  perform public.admin_save_theme('niepodleglosc', '11-08', '11-12', true, false, 30, 'niepodleglosc_hat_kotylion', 0, '{niepodleglosc_cape_flaga}');
  perform public.admin_save_theme('boze', '12-01', '01-06', true, false, 0, null, 15, (select items from public.themes where id = 'boze'));
  perform public.admin_save_theme('walentynki', '02-10', '02-15', false, true, 50, null, 0, (select items from public.themes where id = 'walentynki'));
  perform public.admin_save_theme('wakacje', '06-25', '08-31', true, true, 100, null, 0, (select items from public.themes where id = 'wakacje'));
  assert (select string_agg(id, ',') from public.themes where forced) = 'wakacje', 'tylko jeden wymuszony';
  assert (select enabled from public.themes where id = 'walentynki'), 'wymuszenie włącza motyw';
  select * into r from public.admin_list_themes() where id = 'wakacje';
  assert r.active and r.forced, 'wymuszony trwa';
  select * into r from public.admin_list_themes() where id = 'halloween';
  assert r.active and r.claims = 1 and r.d_from = '2026-10-15' and r.d_to = '2026-11-05', 'Halloween: trwa, 1 odebrana nagroda';
  select * into r from public.admin_list_themes() where id = 'niepodleglosc';
  assert not r.active and r.d_from = '2026-11-08' and r.gift_name = 'Kotylion' and r.items = '{niepodleglosc_cape_flaga}', 'najbliższy termin i nagroda';
  perform public.admin_save_theme('wakacje', '06-25', '08-31', true, false, 100, null, 0, (select items from public.themes where id = 'wakacje'));
end $$;
-- 10 listopada: nagroda z kosmetykiem; kolekcja w sklepie z datą końca
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
set mib.today = '2026-11-10';
do $$ declare r json; s json; begin
  s := public.shop();
  assert (select (x ->> 'until') || ' ' || (x -> 'items') from json_array_elements(s -> 'themes') x where x ->> 'id' = 'niepodleglosc') = '2026-11-12 ["niepodleglosc_cape_flaga"]', 'kolekcja do 12 listopada';
  assert (select (x ->> 'price')::integer from json_array_elements(s -> 'items') x where x ->> 'id' = 'niepodleglosc_cape_flaga') = 800, 'peleryna na sprzedaż';
  assert (select (x ->> 'price')::integer from json_array_elements(s -> 'items') x where x ->> 'id' = 'niepodleglosc_hat_kotylion') = 300, 'wyjęty z kolekcji: na sprzedaż zawsze';
  r := public.claim_theme_gift('niepodleglosc');
  assert (r ->> 'amount')::integer = 30 and r -> 'cosmetic' ->> 'id' = 'niepodleglosc_hat_kotylion' and (r -> 'cosmetic' ->> 'new')::boolean, 'nagroda z kosmetykiem';
  assert (select source from public.owned_cosmetics where user_id = auth.uid() and cosmetic_id = 'niepodleglosc_hat_kotylion') = 'theme', 'kosmetyk z nagrody';
end $$;
-- 30 listopada: kalendarz jeszcze zamknięty
set mib.today = '2026-11-30';
do $$ begin assert not (public.advent() ->> 'open')::boolean and (public.advent() ->> 'today')::integer = 0, 'kalendarz zamknięty w listopadzie'; end $$;
select pg_temp.expect_error($q$select public.claim_advent(1)$q$, 'advent_closed');
-- 3 grudnia: okienka 1–3, nagroda dzienna z dodatkiem świątecznym
set mib.today = '2026-12-03';
do $$ declare r json; a json; begin
  r := public.claim_advent(1);
  assert (r ->> 'amount')::integer = 20 and r -> 'cosmetic' is not null and json_typeof(r -> 'cosmetic') = 'null', 'okienko 1: 20 coinsów';
  a := public.advent();
  assert (a ->> 'open')::boolean and (a ->> 'today')::integer = 3 and json_array_length(a -> 'days') = 24, 'kalendarz otwarty';
  assert (select (x ->> 'opened')::boolean and (x ->> 'coins')::integer = 20 from json_array_elements(a -> 'days') x where (x ->> 'day')::integer = 1), 'otwarte okienko pokazuje nagrodę';
  assert (select x -> 'coins' is null or json_typeof(x -> 'coins') = 'null' from json_array_elements(a -> 'days') x where (x ->> 'day')::integer = 2), 'zamknięte nie pokazuje nagrody';
  assert (select x ->> 'kind' from json_array_elements(a -> 'days') x where (x ->> 'day')::integer = 22) = 'cosmetic', 'wiadomo, że to kosmetyk';
  r := public.claim_daily();
  assert (r ->> 'amount')::integer = 25 and (r ->> 'bonus')::integer = 15, 'nagroda dzienna z dodatkiem świątecznym';
end $$;
select pg_temp.expect_error($q$select public.claim_advent(1)$q$, 'advent_opened');
select pg_temp.expect_error($q$select public.claim_advent(4)$q$, 'advent_locked');
select pg_temp.expect_error($q$select public.claim_advent(0)$q$, 'advent_locked');
select pg_temp.expect_error($q$select public.buy_cosmetic('adwent_hat_pompon')$q$, 'not_for_sale');
-- 21 grudnia: zaległe okienka i kosmetyki z kalendarza; maska zakłada się osobno od czapki
set mib.today = '2026-12-21';
do $$ declare r json; begin
  perform public.claim_advent(2);
  r := public.claim_advent(21);
  assert r -> 'cosmetic' ->> 'id' = 'adwent_mask_broda' and r -> 'cosmetic' ->> 'type' = 'mask', 'okienko 21: broda';
  perform public.claim_advent(20);
  assert (select source from public.owned_cosmetics where user_id = auth.uid() and cosmetic_id = 'adwent_mask_broda') = 'advent', 'kosmetyk z kalendarza';
  perform public.equip_cosmetic('mask', 'adwent_mask_broda');
  perform public.equip_cosmetic('hat', 'adwent_hat_pompon');
  assert (select equipped ->> 'mask' || ',' || (equipped ->> 'hat') from public.profiles where id = auth.uid()) = 'adwent_mask_broda,adwent_hat_pompon', 'maska razem z czapką';
end $$;
select pg_temp.expect_error($q$select public.equip_cosmetic('hat', 'adwent_mask_broda')$q$, 'not_owned');
select pg_temp.expect_error($q$select public.claim_advent(22)$q$, 'advent_locked');
-- 26 grudnia: ostatni dzień na zaległe (do 24 okienka), 27 grudnia zamknięty
set mib.today = '2026-12-26';
do $$ begin perform public.claim_advent(24); assert (public.advent() ->> 'today')::integer = 24, 'po Wigilii do okienka 24'; end $$;
set mib.today = '2026-12-27';
select pg_temp.expect_error($q$select public.claim_advent(23)$q$, 'advent_closed');
-- następny rok: znów nagroda i nowy kalendarz
set mib.today = '2027-11-09';
do $$ begin assert (select string_agg(id, ',') from public.my_theme_gifts()) = 'niepodleglosc', 'nagroda w następnym roku'; end $$;
set mib.today = '2027-12-01';
do $$ begin assert not (select bool_or((x ->> 'opened')::boolean) from json_array_elements(public.advent() -> 'days') x), 'nowy kalendarz'; end $$;
-- admin: dni kalendarza, wyłączony motyw zamyka kalendarz
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
set mib.today = '2026-12-21';
select pg_temp.expect_error($q$select public.admin_set_advent_day(25, 10, null)$q$, 'advent_day_invalid');
select pg_temp.expect_error($q$select public.admin_set_advent_day(3, 0, null)$q$, 'advent_empty');
select pg_temp.expect_error($q$select public.admin_set_advent_day(3, 10, 'nie_ma')$q$, 'cosmetic_missing');
do $$ begin
  perform public.admin_set_advent_day(3, 40, 'zima_hat_elf');
  assert (select coins || ' ' || cosmetic_name || ' ' || opened from public.admin_advent() where day = 3) = '40 Czapka elfa 0', 'dzień zmieniony';
  assert (select opened from public.admin_advent() where day = 21) = 1, 'ile otwarło';
  perform public.admin_save_theme('boze', '12-01', '01-06', false, false, 0, null, 0, (select items from public.themes where id = 'boze'));
  assert not (public.advent() ->> 'open')::boolean, 'wyłączony motyw zamyka kalendarz';
  perform public.admin_save_theme('boze', '12-01', '01-06', true, false, 0, null, 0, (select items from public.themes where id = 'boze'));
  perform public.admin_save_cosmetic('zimowa_aura_snow', 'Śnieżyca', 'aura', null);
  perform public.admin_save_cosmetic('maska_test', 'Maska', 'mask', null);
end $$;
reset role;
reset mib.today;

-- ===== Profil MiB z konta Minecraft (0.26.0) =====
delete from private.hello_log;
-- konto zakładane przez funkcję mc-login (dane konta Minecraft w app_metadata): profil z nickiem z Minecrafta
insert into auth.users (id, email, raw_app_meta_data) values ('aaaaaaaa-0000-0000-0000-00000000c001', 'mc-1@mc.mib.invalid', '{"mc_uuid":"44444444-4444-4444-4444-444444444444","mc_name":"Steve"}');
-- zajęty nick dostaje dopisek, za krótki jest dopełniony, ten sam Minecraft drugi raz nie przejdzie
insert into auth.users (id, email, raw_app_meta_data) values ('aaaaaaaa-0000-0000-0000-00000000c002', 'mc-2@mc.mib.invalid', '{"mc_uuid":"55555555-5555-5555-5555-555555555555","mc_name":"steve"}');
insert into auth.users (id, email, raw_app_meta_data) values ('aaaaaaaa-0000-0000-0000-00000000c003', 'mc-3@mc.mib.invalid', '{"mc_uuid":"66666666-6666-6666-6666-666666666666","mc_name":"Al"}');
insert into auth.users (id, email, raw_app_meta_data) values ('aaaaaaaa-0000-0000-0000-00000000c004', 'mc-4@mc.mib.invalid', '{"mc_uuid":"77777777-7777-7777-7777-777777777771","mc_name":"Drugi_Nowy"}');
select pg_temp.expect_error($q$insert into auth.users (email, raw_app_meta_data) values ('mc-5@mc.mib.invalid', '{"mc_uuid":"44444444-4444-4444-4444-444444444444","mc_name":"Steve"}')$q$, 'mc_taken');
-- zwykła rejestracja z mc_uuid w danych gracza (user_metadata) niczego nie łączy
insert into auth.users (id, email, raw_user_meta_data) values ('aaaaaaaa-0000-0000-0000-00000000c006', 'hack@test.pl', '{"nick":"Podszywacz","mc_uuid":"88888888-8888-8888-8888-888888888888"}');
do $$ begin
  assert (select nick || ' ' || mc_name || ' ' || mc_uuid from public.profiles where id = 'aaaaaaaa-0000-0000-0000-00000000c001') = 'Steve Steve 44444444-4444-4444-4444-444444444444', 'profil z konta Minecraft';
  assert (select nick from public.profiles where id = 'aaaaaaaa-0000-0000-0000-00000000c002') = 'steve_1', 'zajęty nick z dopiskiem';
  assert (select nick from public.profiles where id = 'aaaaaaaa-0000-0000-0000-00000000c003') = 'Al_', 'krótki nick dopełniony';
  assert (select nick from public.profiles where id = 'aaaaaaaa-0000-0000-0000-00000000c004') = 'Drugi_Nowy_1', 'nick Drugi_Nowy zajęty';
  assert (select mc_uuid from public.profiles where id = 'aaaaaaaa-0000-0000-0000-00000000c006') is null, 'user_metadata nie łączy konta Minecraft';
end $$;
-- mc_account: tylko klucz serwisowy; zapisuje nowy nick z Minecrafta
set role service_role;
do $$ declare v json; begin
  v := public.mc_account('44444444-4444-4444-4444-444444444444', 'Steve2');
  assert v ->> 'user_id' = 'aaaaaaaa-0000-0000-0000-00000000c001' and v ->> 'email' = 'mc-1@mc.mib.invalid', 'konto po Minecrafcie';
  assert public.mc_account('99999999-9999-9999-9999-999999999999', 'Nikt') is null, 'brak konta';
end $$;
reset role;
do $$ begin assert (select mc_name from public.profiles where id = 'aaaaaaaa-0000-0000-0000-00000000c001') = 'Steve2', 'nowy nick z Minecrafta'; end $$;
set role authenticated;
select pg_temp.expect_error($q$select public.mc_account('44444444-4444-4444-4444-444444444444', 'Steve')$q$, 'permission denied');
reset role;
-- link_minecraft: profil e-mail łączy się z kontem potwierdzonym u Mojanga
insert into extensions.fake_mojang values ('Notch', 'cccccccccccccccccccccccccccccccc', '99999999999999999999999999999999'),
  ('Steve2', 'dddddddddddddddddddddddddddddddd', '44444444444444444444444444444444'), ('Inny', 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', '12121212121212121212121212121212'),
  ('steve', 'abababababababababababababababab', '55555555555555555555555555555555');
-- profil Steve2 (z konta Minecraft) ma już kosmetyk: nie ustąpi profilowi e-mail
insert into public.owned_cosmetics (user_id, cosmetic_id) values ('aaaaaaaa-0000-0000-0000-00000000c001', (select id from public.cosmetics order by id limit 1));
insert into auth.users (id, email, raw_user_meta_data) values ('aaaaaaaa-0000-0000-0000-00000000c007', 'mail7@test.pl', '{"nick":"Mailowy"}');
set role authenticated;
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-00000000c006';
do $$ begin
  assert public.link_minecraft('Notch', 'ffffffffffffffffffffffffffffffff') ->> 'error' = 'not_verified', 'Mojang nie potwierdził';
  assert public.link_minecraft('Steve2', 'dddddddddddddddddddddddddddddddd') ->> 'error' = 'mc_taken', 'konto Minecraft ma już inny profil';
  assert (public.link_minecraft('Notch', 'cccccccccccccccccccccccccccccccc') ->> 'ok')::boolean, 'połączone';
  assert public.link_minecraft('Inny', 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') ->> 'error' = 'mc_other', 'profil ma już inne konto Minecraft';
  assert (public.link_minecraft('Notch', 'cccccccccccccccccccccccccccccccc') ->> 'ok')::boolean, 'ponowne połączenie tego samego konta';
end $$;
select pg_temp.expect_error($q$select public.link_minecraft('Zły nick', 'cccccccccccccccccccccccccccccccc')$q$, 'name_invalid');
-- pusty profil z samego konta Minecraft (steve_1) ustępuje profilowi e-mail tego gracza
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-00000000c007';
do $$ begin assert (public.link_minecraft('steve', 'abababababababababababababababab') ->> 'ok')::boolean, 'przejęte od pustego profilu'; end $$;
reset role;
do $$ begin
  assert (select mc_name || ' ' || mc_uuid from public.profiles where id = 'aaaaaaaa-0000-0000-0000-00000000c006') = 'Notch 99999999-9999-9999-9999-999999999999', 'profil e-mail połączony';
  assert not exists (select 1 from auth.users where id = 'aaaaaaaa-0000-0000-0000-00000000c002'), 'pusty profil z konta Minecraft usunięty';
  assert (select mc_uuid from public.profiles where id = 'aaaaaaaa-0000-0000-0000-00000000c007') = '55555555-5555-5555-5555-555555555555', 'konto Minecraft przy profilu e-mail';
  assert not (select mc_auto from public.profiles where id = 'aaaaaaaa-0000-0000-0000-00000000c007'), 'profil e-mail nie jest „z konta Minecraft”';
  assert (select mc_auto from public.profiles where id = 'aaaaaaaa-0000-0000-0000-00000000c001'), 'profil z konta Minecraft oznaczony';
end $$;
-- mib_hello dalej działa przez wspólną weryfikację
set role anon;
do $$ begin assert public.mib_hello('Notch', 'cccccccccccccccccccccccccccccccc') ->> 'name' = 'Notch', 'mib_hello'; end $$;
reset role;
