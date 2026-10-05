-- Tests für supabase/rankingsystem.sql und rankingsystem-neustart.sql (nur
-- Test-Datenbank). Läuft nach duelle-test.sql, siehe run.sh. Die erwarteten
-- Zahlen stammen aus der Referenz-Rechnung rankingsystem.py.
\set ON_ERROR_STOP 1

-- ============================================================================
-- A) Einspielen: nichts Bestehendes ändert sich
-- ============================================================================
create table t.rsnap as select id, free_stars, rang_punkte, pass_xp from public.profiles;
create table t.rsnap_tips as select id, user_id, match_id, predicted_home_score, predicted_away_score, stake,
  evaluated, result_tier, rang_delta, stars_delta, narration from public.tips;
set client_min_messages = warning;
\o /dev/null
\i supabase/rankingsystem.sql
\i supabase/rankingsystem.sql
\o
set client_min_messages = notice;
select t.eq((select count(*)::int from (select * from t.rsnap except
  select id, free_stars, rang_punkte, pass_xp from public.profiles) x), 0, 'A1 Profile (Sterne, Rangpunkte, XP) unverändert');
select t.eq((select count(*)::int from (select * from t.rsnap_tips except
  select id, user_id, match_id, predicted_home_score, predicted_away_score, stake,
         evaluated, result_tier, rang_delta, stars_delta, narration from public.tips) x), 0, 'A2 Alte Tipps unverändert');

-- Spieler mit festem Punktestand (Fußball).
create or replace function t.ruser(p_n int, p_points int) returns uuid language plpgsql as $$
declare v_id uuid := ('00000000-0000-0000-0000-0000000005' || lpad(p_n::text, 2, '0'))::uuid;
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values (v_id, 'r' || p_n || '@test.at', jsonb_build_object('display_name', 'R' || p_n)) on conflict do nothing;
  update public.profiles set rang_punkte = jsonb_build_object('Fußball', p_points, 'NFL', 0, 'NBA', 0, 'NHL', 0),
    free_stars = 100 where id = v_id;
  return v_id;
end $$;
create or replace function t.u(p_n int) returns uuid language sql as $$
  select ('00000000-0000-0000-0000-0000000005' || lpad(p_n::text, 2, '0'))::uuid $$;
create or replace function t.rtip(p_n int, p_match text, p_home int, p_away int) returns void language plpgsql as $$
begin
  perform t.login(t.u(p_n));
  set local role authenticated;
  insert into public.tips (id, user_id, match_id, predicted_home_score, predicted_away_score, stake, submitted_at)
  values (p_match || '-' || p_n, t.u(p_n), p_match, p_home, p_away, 0, now());
  reset role;
end $$;
create or replace function t.line(p_id text) returns text language sql as $$
  select result_tier || ' ' || base_points || '/' || bonus_points || '/' || rang_delta || ' gebucht ' || rang_booked
         || ' (' || beaten || ' von ' || opponents || ')'
  from public.tips where id = p_id $$;

-- ============================================================================
-- B) 8 Tipper, Endstand 2:1
-- ============================================================================
select from t.ruser(1, 0) f1, t.ruser(2, 20) f2, t.ruser(3, 50) f3, t.ruser(4, 50) f4,
       t.ruser(5, 100) g1, t.ruser(6, 150) g2, t.ruser(7, 300) g3, t.ruser(8, 2) g4;
insert into public.matches (id, data) values ('rs-8', t.match('rs-8', 'Fußball', 'score', 0, now() + interval '1 day'));
begin;
select from t.rtip(1, 'rs-8', 2, 1) f1, t.rtip(2, 'rs-8', 3, 2) f2, t.rtip(3, 'rs-8', 1, 0) f3, t.rtip(4, 'rs-8', 2, 0) f4,
       t.rtip(5, 'rs-8', 1, 1) g1, t.rtip(6, 'rs-8', 0, 2) g2, t.rtip(7, 'rs-8', 3, 1) g3, t.rtip(8, 'rs-8', 0, 0) g4;
commit;
select from t.finish('rs-8', 2, 1) f1;
select t.eq(t.line('rs-8-1'), 'exakt 10/7/17 gebucht 17 (7 von 7)', 'B1 exakt, 0 Punkte: 10 + 7 = 17');
select t.eq(t.line('rs-8-2'), 'differenz 7/5/12 gebucht 12 (5 von 7)', 'B2 Tordifferenz 3:2: 7 + 5');
select t.eq(t.line('rs-8-3'), 'differenz 7/4/11 gebucht 11 (5 von 7)', 'B3 Tordifferenz 1:0: 7 + 4');
select t.eq(t.line('rs-8-4'), 'tendenz 5/0/5 gebucht 5 (3 von 7)', 'B4 Tendenz: 5 + 0');
select t.eq(t.line('rs-8-5'), 'falsch -3/-6/-9 gebucht -9 (0 von 7)', 'B5 Remis-Tipp falsch: -3 - 6');
select t.eq(t.line('rs-8-7'), 'tendenz 5/-2/3 gebucht 3 (3 von 7)', 'B6 Tendenz mit 300 Punkten: 5 - 2');
select t.eq(t.line('rs-8-8'), 'falsch -3/-4/-7 gebucht -2 (0 von 7)', 'B7 Nur 2 Punkte: -7 gerechnet, -2 gebucht');
select t.eq((select string_agg(t.rang(t.u(n), 'Fußball')::text, ',' order by n) from generate_series(1, 8) n),
  '17,32,61,55,91,141,303,0', 'B8 Punktestände nach dem Spiel');
select t.eq((select rank_points_before from public.tips where id = 'rs-8-7'), 300, 'B9 Punktestand beim Auswerten gespeichert');
select t.eq((select narration from public.tips where id = 'rs-8-2'),
  '👍 Tordifferenz richtig. Treffer +7, Bonus +5 (gegen 5 von 7 durchgesetzt): +12 Rangpunkte.', 'B10 Text Tordifferenz');
select t.eq((select narration from public.tips where id = 'rs-8-8'),
  '😬 Daneben getippt. Treffer -3, Bonus -4 (gegen 0 von 7 durchgesetzt): -7 Rangpunkte.', 'B11 Text falsch');
select t.eq((select ranking_scored from public.tips where id = 'rs-8-1'), true, 'B12 Als Rankingsystem markiert');

-- Nochmal auswerten bucht nichts doppelt
create table t.rs_snap as select id, rang_punkte, free_stars from public.profiles;
select from public.evaluate_match('rs-8');
select t.eq((select count(*)::int from (select * from t.rs_snap except select id, rang_punkte, free_stars from public.profiles) x), 0,
  'B13 Nochmal auswerten: nichts doppelt');

-- ============================================================================
-- C) Endstand-Korrektur 2:1 -> 1:1: gleicher gespeicherter Punktestand,
--    Ergebnis = Stand vorher + neue Punkte (nie unter 0)
-- ============================================================================
select from t.finish('rs-8', 1, 1) f1;
select t.eq(t.line('rs-8-5'), 'exakt 10/6/16 gebucht 16 (7 von 7)', 'C1 Korrektur: Remis-Tipp jetzt exakt');
select t.eq(t.line('rs-8-8'), 'tendenz 5/7/12 gebucht 12 (6 von 7)', 'C2 Korrektur: 0:0 jetzt Tendenz (Remis ohne Differenz)');
select t.eq(t.line('rs-8-1'), 'falsch -3/-1/-4 gebucht 0 (0 von 7)', 'C3 Korrektur: 2:1 jetzt falsch, bei 0 nichts abgezogen');
select t.eq((select string_agg(t.rang(t.u(n), 'Fußball')::text, ',' order by n) from generate_series(1, 8) n),
  '0,15,45,45,116,144,294,14', 'C4 Punktestände wie direkt mit 1:1 (inkl. nie unter 0)');
select t.eq((select count(*)::int from public.activity_feed where user_id = t.u(8) and text like '🔧%'), 1, 'C5 Korrektur-Meldung');

-- ============================================================================
-- D) Allein, 1X2, Booster
-- ============================================================================
select from t.ruser(11, 50) f1, t.ruser(12, 50) f2;
insert into public.matches (id, data) values
  ('rs-allein', t.match('rs-allein', 'Fußball', 'score', 0, now() + interval '1 day')),
  ('rs-1x2', t.match('rs-1x2', 'Fußball', '1x2', 0, now() + interval '1 day')),
  ('rs-boost', t.match('rs-boost', 'Fußball', 'score', 0, now() + interval '1 day') || '{"booster": true}');
begin;
select from t.rtip(11, 'rs-allein', 3, 0) f1;
select from t.rtip(11, 'rs-1x2', 1, 0) f1, t.rtip(12, 'rs-1x2', 0, 1) f2;
select from t.rtip(11, 'rs-boost', 3, 1) f1, t.rtip(12, 'rs-boost', 1, 1) f2;
commit;
select t.eq((select stake from public.tips where id = 'rs-boost-11'), 20, 'D0 Booster-Einsatz 20');
select from t.finish('rs-allein', 4, 1) f1;
select t.eq(t.line('rs-allein-11'), 'differenz 7/0/7 gebucht 7 (0 von 0)', 'D1 Allein: nur feste Punkte');
select t.eq((select narration from public.tips where id = 'rs-allein-11'), '👍 Tordifferenz richtig: +7 Rangpunkte.', 'D2 Allein: Text ohne Bonus');
select from t.finish('rs-1x2', 2, 0) f1;
select t.eq(t.line('rs-1x2-11'), 'tendenz 5/1/6 gebucht 6 (1 von 1)', 'D3 1X2 richtig: 5 + 1 (Bonus nie mehr als Mittipper)');
select t.eq(t.line('rs-1x2-12'), 'falsch -3/-1/-4 gebucht -4 (0 von 1)', 'D4 1X2 falsch: -3 - 1');
select t.eq((select narration from public.tips where id = 'rs-1x2-11'),
  '👍 Richtig getippt. Treffer +5, Bonus +1 (gegen 1 von 1 durchgesetzt): +6 Rangpunkte.', 'D5 1X2 Text');
select t.eq((select t.stars(t.u(11)) || '/' || t.stars(t.u(12))), '80/80', 'D6 Booster vorher: je 20 eingesetzt');
select from t.finish('rs-boost', 2, 0) f1;
select t.eq((select stars_delta from public.tips where id = 'rs-boost-11'), 10, 'D7 Booster Tordifferenz: +10 Sterne');
select t.eq((select stars_delta from public.tips where id = 'rs-boost-12'), -10, 'D8 Booster falsch: -10 Sterne');
select t.eq((select t.stars(t.u(11)) || '/' || t.stars(t.u(12))), '110/90', 'D9 Booster: Kontostand 110 und 90');
select t.eq(t.line('rs-boost-11'), 'differenz 7/1/8 gebucht 8 (1 von 1)', 'D10 Booster ändert die Rangpunkte nicht');

-- ============================================================================
-- E) Joker (setzt nur der Server)
-- ============================================================================
select from t.ruser(21, 50) f1, t.ruser(22, 50) f2, t.ruser(23, 50) f3, t.ruser(24, 50) f4, t.ruser(25, 50) f5;
insert into public.matches (id, data) values
  ('rs-j1', t.match('rs-j1', 'Fußball', 'score', 0, now() + interval '1 day')),
  ('rs-j2', t.match('rs-j2', 'Fußball', 'score', 0, now() + interval '1 day')),
  ('rs-j3', t.match('rs-j3', 'Fußball', 'score', 0, now() + interval '1 day')),
  ('rs-j4', t.match('rs-j4', 'Fußball', 'score', 0, now() + interval '1 day')),
  ('rs-j5', t.match('rs-j5', 'Fußball', 'score', 0, now() + interval '1 day'));
begin;
select from t.rtip(21, 'rs-j1', 2, 1) f1, t.rtip(22, 'rs-j2', 0, 1) f2, t.rtip(23, 'rs-j3', 0, 1) f3,
       t.rtip(24, 'rs-j4', 0, 2) g1, t.rtip(25, 'rs-j5', 0, 2) g2;
commit;
update public.tips set joker = 'doppel' where id = 'rs-j1-21';
update public.tips set joker = 'doppel' where id = 'rs-j2-22';
update public.tips set joker = 'toleranz' where id = 'rs-j3-23';
update public.tips set joker = 'toleranz' where id = 'rs-j4-24';
update public.tips set joker = 'schutz' where id = 'rs-j5-25';
select from t.finish('rs-j1', 2, 1) f1, t.finish('rs-j2', 1, 0) f2, t.finish('rs-j3', 1, 1) f3, t.finish('rs-j4', 1, 1) f4, t.finish('rs-j5', 1, 0) f5;
select t.eq(t.line('rs-j1-21'), 'exakt 20/0/20 gebucht 20 (0 von 0)', 'E1 Doppel-Joker exakt: 20');
select t.eq(t.line('rs-j2-22'), 'falsch -3/0/-3 gebucht -3 (0 von 0)', 'E2 Doppel-Joker falsch: Minus bleibt -3');
select t.eq(t.line('rs-j3-23'), 'falsch 0/0/0 gebucht 0 (0 von 0)', 'E3 Toleranz-Joker 1 Tor daneben: 0 statt -3');
select t.eq(t.line('rs-j4-24'), 'falsch -3/0/-3 gebucht -3 (0 von 0)', 'E4 Toleranz-Joker 2 Tore daneben: -3');
select t.eq(t.line('rs-j5-25'), 'falsch -3/0/0 gebucht 0 (0 von 0)', 'E5 Schutz-Joker: kein Minus');
select t.eq((select narration from public.tips where id = 'rs-j1-21'), '🎯 Exakt getroffen (Doppel-Joker): +20 Rangpunkte.', 'E6 Text Doppel-Joker');
select t.eq((select narration from public.tips where id = 'rs-j5-25'), '😬 Daneben getippt, Schutz-Joker: kein Minus: 0 Rangpunkte.', 'E7 Text Schutz-Joker');

-- ============================================================================
-- F) Alte Tipps (vor dem Rankingsystem ausgewertet): Korrektur lässt die
--    Rangpunkte in Ruhe
-- ============================================================================
create table t.legacy as
  select t2.id, t2.user_id, t2.match_id, m.data ->> 'sport' as sport from public.tips t2 join public.matches m on m.id = t2.match_id
  where t2.evaluated and t2.result_tier is not null and not t2.ranking_scored and t2.refunded_at is null
    and m.data ->> 'status' = 'finished' limit 1;
select t.eq((select count(*)::int from t.legacy), 1, 'F0 Es gibt einen alten ausgewerteten Tipp');
create table t.legacy_rang as select id, rang_punkte from public.profiles;
update public.matches set data = data || jsonb_build_object('liveHomeScore', public.try_int(data -> 'liveHomeScore') + 3)
where id = (select match_id from t.legacy);
select t.eq((select count(*)::int from (select * from t.legacy_rang except select id, rang_punkte from public.profiles) x), 0,
  'F1 Korrektur eines alten Spiels: Rangpunkte unverändert');
select t.eq((select narration like '🔧%vor dem neuen Punktesystem%' from public.tips where id = (select id from t.legacy)), true,
  'F2 Text erklärt es');
select t.eq((select ranking_scored from public.tips where id = (select id from t.legacy)), false, 'F3 Bleibt alter Tipp');

-- ============================================================================
-- G) Sicherheit: der Browser darf nichts davon schreiben
-- ============================================================================
begin;
select t.login(t.u(12));
set local role authenticated;
update public.tips set joker = 'doppel', rang_booked = 99, base_points = 99, bonus_points = 9, ranking_legacy = true,
  rank_points_before = 9999 where id = 'rs-1x2-12';
update public.profiles set pause_jokers = 50, inactive_weeks = -99 where id = t.u(12);
select t.expect_error($$update public.ranking_settings set free_weeks = 99$$, 'G1 Browser kann Einstellungen nicht ändern');
select t.expect_error($$select public.apply_inactivity_penalties()$$, 'G2 Browser kann die Strafe nicht auslösen');
select t.eq((select count(*)::int from public.ranking_settings), 1, 'G3 Einstellungen lesbar');
commit;
select t.eq(t.line('rs-1x2-12') || ' ' || coalesce((select joker from public.tips where id = 'rs-1x2-12'), '-'),
  'falsch -3/-1/-4 gebucht -4 (0 von 1) -', 'G4 Browser kann Joker und Punkte am Tipp nicht ändern');
select t.eq((select pause_jokers || '/' || inactive_weeks from public.profiles where id = t.u(12)), '0/0', 'G5 Browser kann Pause-Joker nicht ändern');

-- ============================================================================
-- H) Strafe fürs Nicht-Tippen
--    Start vor 5 Wochen. Volle Wochen danach: -28, -21, -14, -7 Tage ab
--    diesem Montag. In Woche -14 gibt es kein Spiel (zählt nicht).
-- ============================================================================
delete from public.ranking_weeks;
update public.profiles set inactive_weeks = 0;
create table t.monday as select date_trunc('week', public.pooltipp_day(now()))::date as d;
update public.ranking_settings set started_at = ((select d from t.monday) - 35)::timestamp at time zone 'Europe/Vienna' + interval '1 hour';
insert into public.matches (id, data)
select 'rs-w' || w, t.match('rs-w' || w, 'NFL', 'score', 0, ((select d from t.monday) - w + 2)::timestamp at time zone 'Europe/Vienna' + interval '20 hours')
from unnest(array[28, 21]) w;
-- Spiele aus früheren Tests liegen in Woche -7 und später, keines in Woche -14.
select t.eq((select count(*)::int from public.matches m
  where public.try_timestamptz(m.data ->> 'kickoff') >= ((select d from t.monday) - 14)::timestamp at time zone 'Europe/Vienna'
    and public.try_timestamptz(m.data ->> 'kickoff') < ((select d from t.monday) - 7)::timestamp at time zone 'Europe/Vienna'), 0,
  'H0 Woche -14 ohne Spiele');
select t.eq((select count(*)::int from public.matches m
  where public.try_timestamptz(m.data ->> 'kickoff') >= ((select d from t.monday) - 7)::timestamp at time zone 'Europe/Vienna'
    and public.try_timestamptz(m.data ->> 'kickoff') < (select d from t.monday)::timestamp at time zone 'Europe/Vienna') > 0, true,
  'H0b Woche -7 mit Spielen');

-- P: tippt nie, Q: tippt nie, hat einen Pause-Joker, S: tippt in Woche -7, Z: tippt nie, hat 0 Punkte
select from t.ruser(31, 30) f1, t.ruser(32, 30) f2, t.ruser(33, 30) f3, t.ruser(34, 0) f4;
update public.profiles set rang_punkte = rang_punkte || '{"NFL": 4}' where id = t.u(31);
update public.profiles set pause_jokers = 1 where id in (t.u(32), t.u(34));
insert into public.matches (id, data) values ('rs-s', t.match('rs-s', 'NHL', 'score', 0, now() + interval '1 day'));
begin;
select from t.rtip(33, 'rs-s', 1, 0) f1;
commit;
update public.tips set submitted_at = ((select d from t.monday) - 5)::timestamp at time zone 'Europe/Vienna' where id = 'rs-s-33';

select t.eq(public.apply_inactivity_penalties(), 4, 'H1 Vier volle Wochen bearbeitet');
select t.eq((select string_agg(had_matches::text, ',' order by week_start) from public.ranking_weeks), 'true,true,false,true',
  'H2 Woche -14 ohne Spiele zählt nicht');
select t.eq((select rang_punkte ->> 'Fußball' || '/' || (rang_punkte ->> 'NFL') || '/' || inactive_weeks from public.profiles where id = t.u(31)),
  '25/0/3', 'H3 Nie getippt: in Woche 3 -5 pro Sportart, nie unter 0');
select t.eq((select rang_punkte ->> 'Fußball' || '/' || pause_jokers from public.profiles where id = t.u(32)),
  '30/0', 'H4 Pause-Joker schützt eine Woche und ist verbraucht');
select t.eq((select rang_punkte ->> 'Fußball' || '/' || inactive_weeks from public.profiles where id = t.u(33)),
  '30/0', 'H5 Ein Tipp in der Woche: keine Strafe');
select t.eq((select pause_jokers from public.profiles where id = t.u(34)), 1, 'H6 Ohne Punkte wird kein Pause-Joker verbraucht');
select t.eq((select count(*)::int from public.activity_feed where user_id = t.u(31) and icon = '💤'), 1, 'H7 Meldung zur Strafe');
select t.eq(public.apply_inactivity_penalties(), 0, 'H8 Nochmal: keine Woche doppelt');
select t.eq((select rang_punkte ->> 'Fußball' from public.profiles where id = t.u(31)), '25', 'H9 Nochmal: keine zweite Strafe');

-- Tagesbonus: kein altes Abklingen mehr
update public.profiles set last_claimed_at = to_char((now() - interval '40 days') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  free_stars = 100 where id = t.u(33);
begin;
select t.login(t.u(33));
set local role authenticated;
select from public.claim_daily_bonus();
commit;
select t.eq((select rang_punkte ->> 'Fußball' || '/' || free_stars from public.profiles where id = t.u(33)), '30/108',
  'H10 Tagesbonus nach 40 Tagen: +8 Sterne, kein Abzug der Rangpunkte');

-- ============================================================================
-- N) Neustart: Rangpunkte auf 0, Sicherung, Tipps unverändert
-- ============================================================================
create table t.nsnap as select id, free_stars, pass_xp, claimed_milestones from public.profiles;
create table t.nsnap_rang as select id, rang_punkte from public.profiles;
create table t.nsnap_tips as select id, user_id, match_id, predicted_home_score, predicted_away_score, stake,
  evaluated, result_tier, rang_delta, stars_delta, narration from public.tips;
set client_min_messages = warning;
\o /dev/null
\i supabase/rankingsystem-neustart.sql
\o
set client_min_messages = notice;
select t.eq((select count(*)::int from public.profiles p
  where exists (select 1 from jsonb_each(p.rang_punkte) e where e.value <> '0'::jsonb)), 0, 'N1 Alle Rangpunkte 0');
select t.eq((select count(*)::int from public.profiles where not rang_punkte ?& array['Fußball', 'NFL', 'NBA', 'NHL']), 0,
  'N2 Alle vier Sportarten vorhanden');
select t.eq((select count(*)::int from (select * from t.nsnap_rang except
  select id, rang_punkte from public.rang_punkte_neustart_sicherung) x), 0, 'N3 Sicherung = Punkte vorher');
select t.eq((select count(*)::int from (select * from t.nsnap except select id, free_stars, pass_xp, claimed_milestones from public.profiles) x), 0,
  'N4 Sterne, XP und Pass unverändert');
select t.eq((select count(*)::int from (select * from t.nsnap_tips except
  select id, user_id, match_id, predicted_home_score, predicted_away_score, stake,
         evaluated, result_tier, rang_delta, stars_delta, narration from public.tips) x), 0, 'N5 Tipps unverändert');
select t.eq((select count(*)::int from public.tips where evaluated and result_tier is not null and not ranking_legacy), 0,
  'N6 Alle ausgewerteten Tipps als "vor dem Neustart" markiert');
select t.eq((select points_reset_at is not null from public.ranking_settings), true, 'N7 Neustart gemerkt');

-- Zweites Ausführen ändert nichts
update public.profiles set rang_punkte = jsonb_set(rang_punkte, '{Fußball}', '7') where id = t.u(31);
set client_min_messages = warning;
\o /dev/null
\i supabase/rankingsystem-neustart.sql
\o
set client_min_messages = notice;
select t.eq((select rang_punkte ->> 'Fußball' from public.profiles where id = t.u(31)), '7', 'N8 Zweiter Lauf: nichts zurückgesetzt');
select t.eq((select count(*)::int from (select * from t.nsnap_rang except
  select id, rang_punkte from public.rang_punkte_neustart_sicherung) x), 0, 'N9 Zweiter Lauf: Sicherung unverändert');
update public.profiles set rang_punkte = jsonb_set(rang_punkte, '{Fußball}', '0') where id = t.u(31);

-- Korrektur eines Spiels von vor dem Neustart bewegt keine Punkte mehr
select from t.finish('rs-8', 2, 1) f1;
select t.eq((select count(*)::int from public.profiles p
  where exists (select 1 from jsonb_each(p.rang_punkte) e where e.value <> '0'::jsonb)), 0, 'N10 Korrektur nach Neustart: alle weiter 0');

-- Neues Spiel nach dem Neustart zählt normal
insert into public.matches (id, data) values ('rs-neu', t.match('rs-neu', 'Fußball', 'score', 0, now() + interval '1 day'));
begin;
select from t.rtip(1, 'rs-neu', 1, 0) f1, t.rtip(2, 'rs-neu', 0, 0) f2;
commit;
select from t.finish('rs-neu', 1, 0) f1;
select t.eq((select t.rang(t.u(1), 'Fußball') || '/' || t.rang(t.u(2), 'Fußball')), '11/0', 'N11 Nach dem Neustart: 10 + 1 und 0');

\echo RANKINGSYSTEM-TESTS GRÜN
