-- Tests für supabase/rankingsystem-feinschliff.sql (nur Test-Datenbank).
-- Läuft nach tempo-test.sql, siehe run.sh.
\set ON_ERROR_STOP 1

create table t.fsnap as select id, free_stars, rang_punkte, pass_xp from public.profiles;
create table t.fsnap_tips as select * from public.tips;
set client_min_messages = warning;
\o /dev/null
\i supabase/rankingsystem-feinschliff.sql
\i supabase/rankingsystem-feinschliff.sql
\o
set client_min_messages = notice;
select t.eq((select count(*)::int from (select * from t.fsnap except
  select id, free_stars, rang_punkte, pass_xp from public.profiles) x), 0, 'FA1 Profile unverändert');
select t.eq((select count(*)::int from (select to_jsonb(f) from t.fsnap_tips f except
  select to_jsonb(t2) - 'compare_points' from public.tips t2) z), 0, 'FA2 Tipps unverändert (bis auf den neuen Vergleichswert)');
select t.eq((select count(*)::int from public.tips where ranking_scored and rank_points_before is not null
  and compare_points is distinct from rank_points_before), 0, 'FA3 Ausgewertete Tipps: Vergleichswert = Punktestand damals');

-- ============================================================================
-- B) Toleranz-Joker
-- ============================================================================
select from t.ruser(51, 100) a, t.ruser(52, 0) b, t.ruser(53, 0) c, t.ruser(54, 100) d;
insert into public.matches (id, data) values
  ('fs-tol', t.match('fs-tol', 'Fußball', 'score', 0, now() + interval '1 day')),
  ('fs-tol2', t.match('fs-tol2', 'Fußball', 'score', 0, now() + interval '1 day'));
begin;
select from t.rtip(51, 'fs-tol', 1, 1) a, t.rtip(52, 'fs-tol', 2, 1) b, t.rtip(53, 'fs-tol', 2, 1) c;
select from t.rtip(54, 'fs-tol2', 0, 1) a, t.rtip(52, 'fs-tol2', 2, 1) b, t.rtip(53, 'fs-tol2', 2, 1) c;
commit;
update public.tips set joker = 'toleranz' where id in ('fs-tol-51', 'fs-tol2-54');
select from t.finish('fs-tol', 2, 1) a, t.finish('fs-tol2', 2, 1) b;
select t.eq(t.line('fs-tol-51'), 'falsch 0/-2/0 gebucht 0 (0 von 2)', 'FB1 Toleranz 1 Tor daneben: auch kein Bonus-Minus');
select t.eq(t.rang(t.u(51), 'Fußball'), 100, 'FB2 Toleranz: Punkte bleiben 100');
select t.eq((select narration from public.tips where id = 'fs-tol-51'),
  '😬 Daneben getippt. Treffer 0 (Toleranz-Joker), Bonus -2 (gegen 0 von 2 durchgesetzt), Toleranz-Joker: kein Minus: 0 Rangpunkte.',
  'FB3 Text Toleranz');
select t.eq(t.line('fs-tol2-54'), 'falsch -3/-2/-5 gebucht -5 (0 von 2)', 'FB4 Toleranz 2 Tore daneben: normales Minus');

-- ============================================================================
-- C) Neue Spieler zählen beim Bonus mit dem mittleren Punktestand
-- ============================================================================
-- A, B, C haben je 5 gewertete Fußball-Tipps, N ist neu.
select from t.ruser(55, 100) a, t.ruser(56, 200) b, t.ruser(57, 300) c, t.ruser(58, 0) n;
insert into public.matches (id, data) values ('fs-alt', t.match('fs-alt', 'Fußball', 'score', 0, now() - interval '1 day'));
set session_replication_role = replica;
insert into public.tips (id, user_id, match_id, predicted_home_score, predicted_away_score, stake, submitted_at, evaluated, result_tier, ranking_scored)
select 'fs-alt-' || u || '-' || g, t.u(u), 'fs-alt', 1, 0, 0, now() - interval '2 days', true, 'tendenz', true
from unnest(array[55, 56, 57]) u, generate_series(1, 5) g;
set session_replication_role = origin;
insert into public.matches (id, data) values ('fs-neu', t.match('fs-neu', 'Fußball', 'score', 0, now() + interval '1 day'));
begin;
select from t.rtip(55, 'fs-neu', 0, 2) a, t.rtip(56, 'fs-neu', 0, 2) b, t.rtip(57, 'fs-neu', 0, 2) c, t.rtip(58, 'fs-neu', 2, 1) n;
commit;
select from t.finish('fs-neu', 2, 1) f;
select t.eq((select string_agg(compare_points::text, ',' order by id) from public.tips where match_id = 'fs-neu'), '100,200,300,200',
  'FC1 Neuer Spieler zählt mit 200 (Mitte), die anderen mit ihrem Stand');
select t.eq((select rank_points_before from public.tips where id = 'fs-neu-58'), 0, 'FC2 Echter Punktestand bleibt gespeichert');
select t.eq(t.line('fs-neu-55'), 'falsch -3/-2/-5 gebucht -5 (0 von 3)', 'FC3 Gegen den Neuen verloren: -1 statt -2');
select t.eq(t.line('fs-neu-57'), 'falsch -3/-3/-6 gebucht -6 (0 von 3)', 'FC4 Mit 300 gegen den Neuen (Mitte) verloren: -2');
select t.eq(t.line('fs-neu-58'), 'exakt 10/3/13 gebucht 13 (3 von 3)', 'FC5 Neuer: exakt + Bonus');
-- Korrektur rechnet mit denselben Vergleichswerten
select from t.finish('fs-neu', 0, 2) f;
select t.eq((select string_agg(compare_points::text, ',' order by id) from public.tips where match_id = 'fs-neu'), '100,200,300,200',
  'FC6 Korrektur: Vergleichswerte bleiben');
select t.eq(t.line('fs-neu-58'), 'falsch -3/-3/-6 gebucht 0 (0 von 3)', 'FC7 Korrektur: Neuer jetzt falsch');
select t.eq(t.rang(t.u(58), 'Fußball'), 0, 'FC8 Neuer: nie unter 0');
-- Alle neu: jeder mit dem eigenen Stand
select from t.ruser(59, 40) a;
insert into public.matches (id, data) values ('fs-allneu', t.match('fs-allneu', 'Handball', 'score', 0, now() + interval '1 day'));
begin;
select from t.rtip(58, 'fs-allneu', 30, 28) a, t.rtip(59, 'fs-allneu', 25, 30) b;
commit;
select from t.finish('fs-allneu', 30, 28) f;
select t.eq((select string_agg(compare_points::text, ',' order by id) from public.tips where match_id = 'fs-allneu'), '0,0',
  'FC9 Alle neu: eigener Stand in der Sportart');

-- ============================================================================
-- D) Text, wenn "nie unter 0" das Minus kleiner macht
-- ============================================================================
select from t.ruser(60, 1) a, t.ruser(61, 0) b;
insert into public.matches (id, data) values
  ('fs-null1', t.match('fs-null1', 'Fußball', 'score', 0, now() + interval '1 day')),
  ('fs-null2', t.match('fs-null2', 'Fußball', 'score', 0, now() + interval '1 day'));
begin;
select from t.rtip(60, 'fs-null1', 0, 3) a, t.rtip(61, 'fs-null2', 0, 3) b;
commit;
select from t.finish('fs-null1', 1, 0) a, t.finish('fs-null2', 1, 0) b;
select t.eq((select narration from public.tips where id = 'fs-null1-60'),
  '😬 Daneben getippt: -3 Rangpunkte. Rangpunkte fallen nie unter 0, darum nur 1 abgezogen.', 'FD1 Text: nur 1 abgezogen');
select t.eq((select narration from public.tips where id = 'fs-null2-61'),
  '😬 Daneben getippt: -3 Rangpunkte. Rangpunkte fallen nie unter 0, darum wurde nichts abgezogen.', 'FD2 Text: nichts abgezogen');
select t.eq((select rang_delta || '/' || rang_booked from public.tips where id = 'fs-null1-60'), '-3/-1', 'FD3 Gerechnet -3, gebucht -1');

-- ============================================================================
-- E) Der Browser kann den Vergleichswert nicht setzen
-- ============================================================================
begin;
select t.login(t.u(58));
set local role authenticated;
update public.tips set compare_points = 9999 where id = 'fs-neu-58';
commit;
select t.eq((select compare_points from public.tips where id = 'fs-neu-58'), 200, 'FE1 Vergleichswert nicht änderbar');

\echo FEINSCHLIFF-TESTS GRÜN
