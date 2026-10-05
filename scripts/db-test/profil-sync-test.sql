-- Tests für supabase/profil-sync.sql (nur Test-Datenbank). Läuft nach
-- tipp-zuruecknehmen-test.sql (nutzt t.call/t.ruser), siehe run.sh.
\set ON_ERROR_STOP 1

create table t.psnap as select id, photos, photo_visibility, rank_icon_id, frame_colors from public.profile_extras;
create table t.psnap_clubs as select * from public.club_fans;
set client_min_messages = warning;
\o /dev/null
\i supabase/profil-sync.sql
\i supabase/profil-sync.sql
\o
set client_min_messages = notice;
select t.eq((select count(*)::int from (select * from t.psnap except
  select id, photos, photo_visibility, rank_icon_id, frame_colors from public.profile_extras) x), 0, 'PA1 Profil-Einstellungen unverändert');
select t.eq((select count(*)::int from (select * from t.psnap_clubs except select * from public.club_fans) x), 0, 'PA2 Herzensvereine unverändert');
select t.eq((select count(*)::int from public.profile_extras where season_design_off is not null), 0, 'PA3 Saison-Design-Spalte am Anfang leer');
select t.eq((select count(*)::int from pg_publication_tables where pubname = 'supabase_realtime'
  and tablename in ('profile_extras', 'club_fans', 'club_settings')), 3, 'PA4 Sofort-Abgleich für Einstellungen + Herzensverein');

-- Zwei Geräte: jedes schreibt nur das Feld, das es geändert hat
select from t.ruser(80, 0) a, t.ruser(81, 0) b;
begin;
select t.login(t.u(80));
set local role authenticated;
insert into public.profile_extras (id, photo_visibility, rank_icon_id, frame_colors)
values (t.u(80), 'friends', 'bronze-1', '{"from":"#111111","to":"#222222"}');
commit;
-- Gerät A ändert das Rang-Icon
begin;
select t.login(t.u(80));
set local role authenticated;
insert into public.profile_extras (id, rank_icon_id) values (t.u(80), 'gold-2')
on conflict (id) do update set rank_icon_id = excluded.rank_icon_id;
commit;
-- Gerät B (alter Stand) ändert nur den Saison-Design-Schalter
begin;
select t.login(t.u(80));
set local role authenticated;
insert into public.profile_extras (id, season_design_off) values (t.u(80), true)
on conflict (id) do update set season_design_off = excluded.season_design_off;
commit;
select t.eq((select rank_icon_id || ' ' || photo_visibility || ' ' || season_design_off::text || ' ' || (frame_colors ->> 'from')
  from public.profile_extras where id = t.u(80)), 'gold-2 friends true #111111', 'PB1 Kein Gerät überschreibt das Feld des anderen');

-- Fremde Einstellungen bleiben unsichtbar und unveränderbar
select t.eq(t.call(t.u(81), 'select coalesce(jsonb_agg(id), ''[]'') from public.profile_extras where id = ''' || t.u(80) || ''''),
  '[]'::jsonb, 'PB2 Fremde Einstellungen nicht lesbar');
begin;
select t.login(t.u(81));
set local role authenticated;
update public.profile_extras set season_design_off = false where id = t.u(80);
commit;
select t.eq((select season_design_off from public.profile_extras where id = t.u(80)), true, 'PB3 Fremde Einstellungen nicht änderbar');
select t.expect_error('set local role anon; select * from public.profile_extras', 'PB4 Ohne Login: kein Zugriff');

\echo PROFIL-SYNC-TESTS GRÜN
