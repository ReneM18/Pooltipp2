-- Tests für supabase/tipp-zuruecknehmen.sql (nur Test-Datenbank). Läuft
-- nach joker-shop-test.sql (nutzt t.call/t.vorrat/t.ruser), siehe run.sh.
\set ON_ERROR_STOP 1

-- ============================================================================
-- A) Einspielen: nichts Bestehendes ändert sich
-- ============================================================================
create table t.wsnap as select id, free_stars, rang_punkte, pass_xp from public.profiles;
create table t.wsnap_tips as select id, user_id, match_id, predicted_home_score, predicted_away_score, stake, joker, evaluated from public.tips;
create table t.wsnap_joker as select * from public.joker_vorrat;
set client_min_messages = warning;
\o /dev/null
\i supabase/tipp-zuruecknehmen.sql
\i supabase/tipp-zuruecknehmen.sql
\o
set client_min_messages = notice;
select t.eq((select count(*)::int from (select * from t.wsnap except
  select id, free_stars, rang_punkte, pass_xp from public.profiles) x), 0, 'WA1 Profile unverändert');
select t.eq((select count(*)::int from (select * from t.wsnap_tips except
  select id, user_id, match_id, predicted_home_score, predicted_away_score, stake, joker, evaluated from public.tips) x), 0, 'WA2 Tipps unverändert');
select t.eq((select count(*)::int from (select * from t.wsnap_joker except select * from public.joker_vorrat) x), 0, 'WA3 Joker-Vorrat unverändert');
select t.eq((select count(*)::int from pg_publication_tables where pubname = 'supabase_realtime'
  and tablename in ('tips', 'profiles', 'joker_vorrat')), 3, 'WA4 Sofort-Abgleich für Tipps, Profil, Joker');

-- ============================================================================
-- B) Booster-Tipp mit Joker zurücknehmen
-- ============================================================================
select from t.ruser(70, 0) a, t.ruser(71, 0) b;
update public.profiles set free_stars = 100 where id in (t.u(70), t.u(71));
insert into public.joker_vorrat (user_id, joker, anzahl) values (t.u(70), 'schutz', 1);
insert into public.matches (id, data) values
  ('wd-b', t.match('wd-b', 'Fußball', 'score', 20, now() + interval '1 day') || '{"booster":true}'),
  ('wd-n', t.match('wd-n', 'NFL', '1x2', 0, now() + interval '1 day')),
  ('wd-zu', t.match('wd-zu', 'Fußball', 'score', 0, now() + interval '1 day')),
  ('wd-fertig', t.match('wd-fertig', 'Fußball', 'score', 0, now() + interval '1 day'));

begin; select from t.rtip(70, 'wd-b', 2, 1) a; commit;
select t.eq(t.stars(t.u(70)), 80, 'WB1 Booster-Tipp kostet 20');
select from t.call(t.u(70), 'select public.set_tip_joker(''wd-b'', ''schutz'')') a;
select t.eq(t.vorrat(t.u(70), 'schutz'), 0, 'WB2 Joker gesetzt');

select t.eq(t.call(t.u(70), 'select public.withdraw_tip(''wd-b'')'),
  '{"withdrawn": true, "refunded": 20, "joker": "schutz", "free_stars": 100}'::jsonb, 'WB3 Rücknahme meldet 20 Coins + Joker');
select t.eq((select count(*)::int from public.tips where user_id = t.u(70) and match_id = 'wd-b'), 0, 'WB4 Tipp ist weg');
select t.eq(t.stars(t.u(70)), 100, 'WB5 20 Coins zurück');
select t.eq(t.vorrat(t.u(70), 'schutz'), 1, 'WB6 Joker wieder im Vorrat');

-- Nochmal (Doppelklick, zweites Gerät): nichts passiert
select t.eq(t.call(t.u(70), 'select public.withdraw_tip(''wd-b'')') ->> 'withdrawn', 'false', 'WB7 Zweiter Aufruf: nichts mehr zurückzunehmen');
select t.eq(t.stars(t.u(70)), 100, 'WB8 Kein doppeltes Erstatten');
select t.eq(t.vorrat(t.u(70), 'schutz'), 1, 'WB9 Joker nicht doppelt');

-- Neu tippen: ganz normal, mit neuem Einsatz
begin; select from t.rtip(70, 'wd-b', 0, 0) a; commit;
select t.eq((select predicted_home_score || ':' || predicted_away_score || ' ' || stake from public.tips
  where user_id = t.u(70) and match_id = 'wd-b'), '0:0 20', 'WB10 Neuer Tipp gespeichert, Einsatz 20');
select t.eq(t.stars(t.u(70)), 80, 'WB11 Neuer Einsatz abgebucht');

-- ============================================================================
-- C) Normaler Tipp, fremde Tipps, Tippschluss, ausgewertet
-- ============================================================================
begin; select from t.rtip(70, 'wd-n', 1, 0) a, t.rtip(71, 'wd-n', 0, 1) b; commit;
select t.eq(t.call(t.u(70), 'select public.withdraw_tip(''wd-n'')') ->> 'refunded', '0', 'WC1 Gratis-Tipp: nichts zu erstatten');
select t.eq(t.stars(t.u(70)), 80, 'WC2 Coins unverändert');
select t.eq((select count(*)::int from public.tips where match_id = 'wd-n'), 1, 'WC3 Nur der eigene Tipp ist weg');
select t.eq((select user_id from public.tips where match_id = 'wd-n'), t.u(71), 'WC4 Tipp von Spieler 71 bleibt');

begin; select from t.rtip(70, 'wd-zu', 1, 1) a; commit;
select t.eq((select count(*)::int from public.tips where user_id = t.u(70) and match_id = 'wd-zu'), 1, 'WC5a Tipp vor Tippschluss abgegeben');
update public.matches set data = jsonb_set(data, '{tipDeadline}', to_jsonb(now() - interval '1 minute')) where id = 'wd-zu';
select t.expect_error(format('select t.call(%L, %L)', t.u(70), 'select public.withdraw_tip(''wd-zu'')'), 'WC5 Nach Tippschluss: Fehler');
select t.eq((select count(*)::int from public.tips where user_id = t.u(70) and match_id = 'wd-zu'), 1, 'WC6 Tipp nach Tippschluss bleibt');

begin; select from t.rtip(70, 'wd-fertig', 2, 0) a; commit;
update public.tips set evaluated = true where user_id = t.u(70) and match_id = 'wd-fertig';
select t.expect_error(format('select t.call(%L, %L)', t.u(70), 'select public.withdraw_tip(''wd-fertig'')'), 'WC7 Ausgewertet: Fehler');
select t.eq((select count(*)::int from public.tips where user_id = t.u(70) and match_id = 'wd-fertig'), 1, 'WC8 Ausgewerteter Tipp bleibt');

select t.expect_error('set local role anon; select public.withdraw_tip(''wd-n'')', 'WC9 Ohne Login: verboten');

-- Direktes Löschen aus dem Browser bleibt verboten
begin;
select t.login(t.u(71));
set local role authenticated;
delete from public.tips where match_id = 'wd-n';
commit;
select t.eq((select count(*)::int from public.tips where match_id = 'wd-n'), 1, 'WC10 Direktes Löschen ohne Wirkung');

-- ============================================================================
-- D) Renes und Doris' Tipps unberührt
-- ============================================================================
select t.eq((select count(*)::int from (select * from t.wsnap_tips except
  select id, user_id, match_id, predicted_home_score, predicted_away_score, stake, joker, evaluated from public.tips) x), 0,
  'WD1 Alle Tipps von vorher noch da');

\echo TIPP-ZURÜCKNEHMEN-TESTS GRÜN
