\set ON_ERROR_STOP 1
\pset format unaligned
\pset tuples_only on
create or replace function pg_temp.check(ok boolean, name text) returns void language plpgsql as $$
begin if not ok then raise exception 'FEHLER: %', name; end if; raise notice 'ok: %', name; end $$;

-- Migration hat bestehende Spieler auf Herbst gesetzt
select pg_temp.check((select count(*) from profiles where pass_season_id='herbst-2026' and pass_season_start='2026-09-23')=2, 'Bestehende Spieler = herbst-2026');

-- Neuer Spieler nach der Migration
insert into profiles(id, display_name, pass_xp) values ('00000000-0000-0000-0000-00000000000c','Cleo',0);

-- Testsaisons relativ zum heutigen Server-Tag in Wien
select (now() at time zone 'Europe/Vienna')::date as heute \gset
set role authenticated;

-- 1) Gleiche Saison: nichts passiert
set test.uid = '00000000-0000-0000-0000-00000000000a';
select pg_temp.check((start_pass_season('herbst-2026', '2026-09-23'))->>'pass_xp' = '6200', 'gleiche Saison behält XP');
select pg_temp.check((select pass_xp from profiles where id=auth.uid())=6200, 'XP unverändert in DB');

-- 2) Saison, die laut Server noch nicht begonnen hat (Handy-Uhr vorgestellt)
select pg_temp.check((start_pass_season('winter-2026', (:'heute'::date + 1)))->>'reset' = 'false', 'Zukunftssaison wird abgelehnt');
select pg_temp.check((select pass_xp from profiles where id=auth.uid())=6200, 'XP nach Ablehnung unverändert');

-- 3) Neue Saison hat heute begonnen -> Reset genau einmal
select pg_temp.check((start_pass_season('winter-2026', :'heute'::date))->>'reset' = 'true', 'Neue Saison setzt zurück');
select pg_temp.check((select pass_xp=0 and pass_season_id='winter-2026' from profiles where id=auth.uid()), 'XP 0 + Saison umgestellt');
select pg_temp.check((select claimed_milestones = '[3,7,"herbst-2026:1","herbst-2026:2","herbst-2026:10"]'::jsonb from profiles where id=auth.uid()), 'Abzeichen/Level/Streaks bleiben');

-- Spieler sammelt in der neuen Saison XP (wie die App es heute speichert)
update profiles set pass_xp = 300 where id = auth.uid();
select pg_temp.check((start_pass_season('winter-2026', :'heute'::date))->>'reset' = 'false', 'Zweiter Aufruf: kein zweiter Reset');
select pg_temp.check((select pass_xp from profiles where id=auth.uid())=300, 'Neue XP bleiben erhalten');

-- 4) Zurück in alte Saison (Handy-Uhr zurückgestellt) -> abgelehnt
select pg_temp.check((start_pass_season('herbst-2026', '2026-09-23'))->>'reset' = 'false', 'Alte Saison: kein Reset');
select pg_temp.check((select pass_xp=300 and pass_season_id='winter-2026' from profiles where id=auth.uid()), 'bleibt in neuer Saison');

-- 5) Ben war während des Wechsels nicht da: Reset erst beim ersten Öffnen
set test.uid = '00000000-0000-0000-0000-00000000000b';
select pg_temp.check((select pass_xp from profiles where id='00000000-0000-0000-0000-00000000000b')=450, 'Ben unberührt bis er kommt');
select pg_temp.check((start_pass_season('winter-2026', :'heute'::date))->>'pass_xp' = '0', 'Ben Reset beim Öffnen');

-- 6) Neuer Spieler (Saison noch leer)
set test.uid = '00000000-0000-0000-0000-00000000000c';
select pg_temp.check((start_pass_season('herbst-2026', '2026-09-23'))->>'pass_season_id' = 'herbst-2026', 'Neuer Spieler bekommt Saison');
select pg_temp.check((select pass_xp=0 and pass_season_start='2026-09-23' from profiles where id=auth.uid()), 'Neuer Spieler 0 XP');

-- 7) Nur das eigene Profil, fremde Ungültiges
do $$ begin perform start_pass_season('x; drop table profiles', '2026-01-01'); raise exception 'FEHLER: ungültige id angenommen'; exception when raise_exception then
  if sqlerrm like 'FEHLER%' then raise; end if; raise notice 'ok: ungültige Saison-id abgelehnt'; end $$;
reset test.uid;
do $$ begin perform start_pass_season('winter-2026', '2026-01-01'); raise exception 'FEHLER: ohne Login angenommen'; exception when raise_exception then
  if sqlerrm like 'FEHLER%' then raise; end if; raise notice 'ok: ohne Login abgelehnt'; end $$;
reset role;

-- 8) Verträglich mit späterer Sperre: App darf pass_xp nicht mehr direkt schreiben
revoke update on public.profiles from authenticated;
grant update (display_name, claimed_milestones, updated_at) on public.profiles to authenticated;
update profiles set pass_season_id='herbst-2026', pass_season_start='2026-09-23', pass_xp=999 where id='00000000-0000-0000-0000-00000000000b';
set role authenticated;
set test.uid = '00000000-0000-0000-0000-00000000000b';
do $$ begin update profiles set pass_xp = 5 where id = auth.uid(); raise exception 'FEHLER: direkte Schreibsperre greift nicht'; exception when insufficient_privilege then raise notice 'ok: direkte Änderung gesperrt'; end $$;
select pg_temp.check((start_pass_season('winter-2026', :'heute'::date))->>'reset' = 'true', 'Reset klappt trotz Sperre');
select pg_temp.check((select pass_xp from profiles where id=auth.uid())=0, 'XP 0 trotz Sperre');
reset role;

-- 9) Saison-Spalten kann der Browser nicht selbst setzen (Reset umgehen)
update profiles set pass_season_id='herbst-2026', pass_season_start='2026-09-23', pass_xp=4000 where id='00000000-0000-0000-0000-00000000000b';
grant update on public.profiles to authenticated;
set role authenticated;
set test.uid = '00000000-0000-0000-0000-00000000000b';
select pg_temp.check(current_pass_season_id() = 'herbst-2026', 'current_pass_season_id = eigene Saison');
update profiles set pass_season_id = 'winter-2026', pass_season_start = :'heute'::date where id = auth.uid();
select pg_temp.check((select pass_season_id from profiles where id=auth.uid())='herbst-2026', 'Browser kann Saison nicht vorstellen');
select pg_temp.check((start_pass_season('winter-2026', :'heute'::date))->>'reset' = 'true', 'Reset trotzdem');
select pg_temp.check(current_pass_season_id() = 'winter-2026', 'current_pass_season_id nach Wechsel');
set test.uid = '00000000-0000-0000-0000-00000000000d';
insert into profiles(id, display_name, pass_season_id) values ('00000000-0000-0000-0000-00000000000d','Dora','winter-2026');
reset role;
select pg_temp.check((select pass_season_id is null from profiles where id='00000000-0000-0000-0000-00000000000d'), 'Neues Profil kann Saison nicht selbst setzen');
