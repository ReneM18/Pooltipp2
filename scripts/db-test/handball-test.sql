-- Tests für supabase/handball.sql (nur Test-Datenbank). Läuft nach
-- joker-shop-test.sql, siehe run.sh.
\set ON_ERROR_STOP 1

-- A) Einspielen (zweimal): nichts Bestehendes ändert sich
create table t.hsnap as select id, free_stars, rang_punkte, pass_xp from public.profiles;
create table t.hsnap_tips as select id, evaluated, rang_delta, stars_delta from public.tips;
set client_min_messages = warning;
\o /dev/null
\i supabase/handball.sql
\i supabase/handball.sql
\o
set client_min_messages = notice;
select t.eq((select count(*)::int from (select * from t.hsnap except
  select id, free_stars, rang_punkte, pass_xp from public.profiles) x), 0, 'HA1 Profile unverändert');
select t.eq((select count(*)::int from (select * from t.hsnap_tips except
  select id, evaluated, rang_delta, stars_delta from public.tips) x), 0, 'HA2 Tipps unverändert');

-- B) Handball-Spiel tippen und auswerten
select from t.ruser(60, 0) a, t.ruser(61, 0) b;
insert into public.teams (id, data) values
  ('hb-thw', '{"id":"hb-thw","name":"THW Kiel","sport":"Handball","primaryColor":"#000000","secondaryColor":"#FFFFFF"}'),
  ('hb-sga', '{"id":"hb-sga","name":"SG Flensburg-Handewitt","sport":"Handball","primaryColor":"#0033A0","secondaryColor":"#E30613"}');
insert into public.matches (id, data) values
  ('hb-1', t.match('hb-1', 'Handball', 'score', 0, now() + interval '1 day') || '{"homeTeamId":"hb-thw","awayTeamId":"hb-sga"}');
begin; select from t.rtip(60, 'hb-1', 30, 28) a; commit;
begin; select from t.rtip(61, 'hb-1', 27, 27) a; commit;
select from t.finish('hb-1', 30, 28) f;
select t.eq((select evaluated from public.tips where id = 'hb-1-60'), true, 'HB1 Handball-Tipp ausgewertet');
select t.eq((select base_points from public.tips where id = 'hb-1-60'), 10, 'HB2 Exakt +10');
select t.eq(t.rang(t.u(60), 'Handball') > 0, true, 'HB3 Rangpunkte bei Handball gebucht');
select t.eq(t.rang(t.u(60), 'Fußball'), 0, 'HB4 Fußball unberührt');
select t.eq((select icon from public.activity_feed where user_id = t.u(60) and text not like '%getippt%' order by created_at desc limit 1), '🤾', 'HB5 Feed-Meldung mit Handball-Symbol');

-- C) Herzensverein und Rang-Icon
select t.eq(t.call(t.u(60), 'select to_jsonb(public.set_favorite_club(''Handball'', ''hb-thw''))'), '""'::jsonb, 'HC1 Handball-Herzensverein wählbar');
select t.eq((select team_id from public.club_fans where user_id = t.u(60) and sport = 'Handball'), 'hb-thw', 'HC2 Verein gespeichert');
select t.eq((select count(*)::int from t.call(t.u(60), 'select jsonb_agg(sport) from public.my_clubs()') x(v),
  jsonb_array_elements_text(x.v) s where s = 'Handball'), 1, 'HC3 my_clubs zeigt Handball');
update public.profiles set rank_icon_id = 'sport-Handball' where id = t.u(60);
select t.eq((select rank_icon_id from public.profiles where id = t.u(60)), 'sport-Handball', 'HC4 Handball-Rang-Icon erlaubt');
\echo HANDBALL-TESTS GRÜN
