-- Tests für supabase/duelle-punkte.sql (nur Test-Datenbank). Läuft nach
-- booster-test.sql, siehe run.sh: spielt duelle-punkte.sql selbst ein.
\set ON_ERROR_STOP 1
\set dr '00000000-0000-0000-0000-0000000000d1'
\set dd '00000000-0000-0000-0000-0000000000d2'
\set dm '00000000-0000-0000-0000-0000000000d3'
\set dl '00000000-0000-0000-0000-0000000000d4'
\set dt '00000000-0000-0000-0000-0000000000d5'
\set dn '00000000-0000-0000-0000-0000000000d6'

-- ============================================================================
-- P) Übernahme: Rangpunkte, Sterne und Tipps bleiben gleich
-- ============================================================================
create table t.dsnap as select id, free_stars, rang_punkte, pass_xp from public.profiles;
create table t.dsnap_tips as select id, user_id, match_id, predicted_home_score, predicted_away_score, stake,
  evaluated, result_tier, rang_delta, stars_delta, narration from public.tips;
select t.eq((select count(*)::int from public.tips where evaluated and result_tier is not null) > 5, true,
  'P0 Testdaten haben ausgewertete alte Tipps');
\o /dev/null
\i supabase/duelle-punkte.sql
\o
select t.eq((select count(*)::int from (select * from t.dsnap except
  select id, free_stars, rang_punkte, pass_xp from public.profiles) x), 0, 'P1 Profile (Sterne, Rangpunkte, XP) unverändert');
select t.eq((select count(*)::int from (select * from t.dsnap_tips except
  select id, user_id, match_id, predicted_home_score, predicted_away_score, stake,
         evaluated, result_tier, rang_delta, stars_delta, narration from public.tips) x), 0, 'P2 Alte Tipps unverändert');
select t.eq((select migrated_at is not null from public.scoring_settings), true, 'P3 Übernahme gemerkt');
select t.eq((select count(*)::int from public.tips where evaluated and result_tier is not null
             and (not scored_without_duels or base_points is distinct from rang_delta or duel_points <> 0)), 0,
  'P4 Alte Tipps: Grundpunkte = bisherige Punkte, 0 Duellpunkte');
select t.eq((select count(*)::int from public.tip_strength) > 0, true, 'P5 Tippstärke aus alten Spielen nachgerechnet');
select t.eq((select sum(evaluated_tips)::int from public.tip_strength),
            (select count(*)::int from public.tips t2 join public.matches m on m.id = t2.match_id
             where t2.evaluated and t2.refunded_at is null and m.data ->> 'status' = 'finished'),
  'P6 Jeder alte ausgewertete Tipp zählt einmal');

-- Zweiter Lauf ändert nichts mehr
create table t.dsnap_strength as select * from public.tip_strength;
create table t.dsnap2 as select id, free_stars, rang_punkte, pass_xp from public.profiles;
\o /dev/null
\i supabase/duelle-punkte.sql
\o
select t.eq((select count(*)::int from (select * from t.dsnap2 except
  select id, free_stars, rang_punkte, pass_xp from public.profiles) x), 0, 'P7 Zweiter Lauf: Profile unverändert');
select t.eq((select count(*)::int from (select user_id, sport, rating, evaluated_tips from t.dsnap_strength except
  select user_id, sport, rating, evaluated_tips from public.tip_strength) x), 0, 'P8 Zweiter Lauf: Tippstärke unverändert');

-- ============================================================================
-- Q) Neue Spiele: Duelle gegen alle
-- ============================================================================
insert into auth.users (id, email, raw_user_meta_data) values
  (:'dr', 'dr@test.at', '{"display_name":"Rene D"}'),
  (:'dd', 'dd@test.at', '{"display_name":"Doris D"}'),
  (:'dm', 'dm@test.at', '{"display_name":"Max D"}'),
  (:'dl', 'dl@test.at', '{"display_name":"Lena D"}'),
  (:'dt', 'dt@test.at', '{"display_name":"Tom D"}'),
  (:'dn', 'dn@test.at', '{"display_name":"Neu D"}');
-- Tippstärken wie im Dokument (Tom ist neu: K = 64).
insert into public.tip_strength (user_id, sport, rating, evaluated_tips) values
  (:'dr', 'Fußball', 1040, 30), (:'dd', 'Fußball', 1000, 30), (:'dm', 'Fußball', 1150, 30),
  (:'dl', 'Fußball', 1100, 30), (:'dt', 'Fußball', 900, 0);

insert into public.matches (id, data) values
  ('du-5', t.match('du-5', 'Fußball', 'score', 0, now() + interval '1 day')),
  ('du-2', t.match('du-2', 'Fußball', 'score', 0, now() + interval '1 day')),
  ('du-1', t.match('du-1', 'Fußball', 'score', 0, now() + interval '1 day'));

create or replace function t.tip(p_user uuid, p_id text, p_match text, p_home int, p_away int) returns void
language plpgsql as $$
begin
  perform t.login(p_user);
  set local role authenticated;
  insert into public.tips (id, user_id, match_id, predicted_home_score, predicted_away_score, stake, submitted_at)
  values (p_id, p_user, p_match, p_home, p_away, 0, now());
  reset role;
end $$;

begin;
select t.tip(:'dr', 'du5-r', 'du-5', 1, 0);
select t.tip(:'dd', 'du5-d', 'du-5', 2, 1);
select t.tip(:'dm', 'du5-m', 'du-5', 0, 1);
select t.tip(:'dl', 'du5-l', 'du-5', 2, 0);
select t.tip(:'dt', 'du5-t', 'du-5', 2, 1);
commit;
select t.finish('du-5', 2, 1);

create or replace function t.tipline(p_id text) returns text language sql as $$
  select base_points || '/' || duel_points || '/' || rang_delta || ' S' || duels_won || ' G' || duels_drawn || ' N' || duels_lost
         || ' St' || strength_delta || ' B' || beat_percent
  from public.tips where id = p_id $$;
select t.eq(t.tipline('du5-t'), '10/11/21 S3 G1 N0 St38 B88', 'Q1 Tom (900, exakt): 10 + 11 = 21');
select t.eq(t.tipline('du5-d'), '10/9/19 S3 G1 N0 St14 B88', 'Q2 Doris (1000, exakt): 10 + 9 = 19');
select t.eq(t.tipline('du5-r'), '6/-3/3 S1 G1 N2 St-4 B38', 'Q3 Rene (1040, Tendenz): 6 - 3 = 3');
select t.eq(t.tipline('du5-l'), '6/-4/2 S1 G1 N2 St-7 B38', 'Q4 Lena (1100, Tendenz): 6 - 4 = 2');
select t.eq(t.tipline('du5-m'), '0/-10/-10 S0 G0 N4 St-22 B0', 'Q5 Max (1150, falsch): Deckel -10');
select t.eq(t.rang(:'dt', 'Fußball'), 21, 'Q6 Tom: Rangpunkte 21');
select t.eq(t.rang(:'dm', 'Fußball'), 0, 'Q7 Max: Rangpunkte nie unter 0');
select t.eq((select rating || '/' || evaluated_tips from public.tip_strength where user_id = :'dt' and sport = 'Fußball'),
  '938/1', 'Q8 Tom: Tippstärke 938, 1 Tipp');
select t.eq((select rating from public.tip_strength where user_id = :'dm' and sport = 'Fußball'), 1128, 'Q9 Max: Tippstärke 1128');
select t.eq((select narration from public.tips where id = 'du5-d'),
  '🎯 Exakt getroffen. Grundpunkte +10, Duelle +9 (3 von 4 geschlagen): +19 Rangpunkte.', 'Q10 Doris: Text');
select t.eq((select narration from public.tips where id = 'du5-m'),
  '😬 Daneben getippt. Grundpunkte 0, Duelle -10 (0 von 4 geschlagen): -10 Rangpunkte.', 'Q11 Max: Text');
select t.eq((select count(*)::int from public.activity_feed where user_id = :'dd' and text like '🎯 Exakt%'), 1, 'Q12 Doris: eine Feed-Meldung');

-- Nochmal auswerten bucht nichts doppelt
create table t.q_snap as select id, rang_punkte, free_stars from public.profiles;
create table t.q_strength as select user_id, sport, rating, evaluated_tips from public.tip_strength;
select public.evaluate_match('du-5');
select t.eq((select count(*)::int from (select * from t.q_snap except select id, rang_punkte, free_stars from public.profiles) x), 0,
  'Q13 Nochmal auswerten: Rangpunkte gleich');
select t.eq((select count(*)::int from (select * from t.q_strength except select user_id, sport, rating, evaluated_tips from public.tip_strength) x), 0,
  'Q14 Nochmal auswerten: Tippstärke gleich');

-- Endstand korrigiert auf 1:0: gleiche Momentaufnahme, nur die Differenz
select t.finish('du-5', 1, 0);
select t.eq(t.tipline('du5-r'), '10/8/18 S4 G0 N0 St16 B100', 'Q15 Korrektur: Rene jetzt exakt, 10 + 8 = 18');
select t.eq(t.tipline('du5-d'), '6/2/8 S1 G2 N1 St2 B50', 'Q16 Korrektur: Doris jetzt Tendenz, 6 + 2 = 8');
select t.eq(t.tipline('du5-t'), '6/3/9 S1 G2 N1 St14 B50', 'Q17 Korrektur: Tom 6 + 3 = 9');
select t.eq(t.rang(:'dr', 'Fußball'), 18, 'Q18 Korrektur: Rene Rangpunkte 18 (nicht 3 + 18)');
select t.eq(t.rang(:'dd', 'Fußball'), 8, 'Q19 Korrektur: Doris Rangpunkte 8');
select t.eq((select rating || '/' || evaluated_tips from public.tip_strength where user_id = :'dr' and sport = 'Fußball'),
  '1056/31', 'Q20 Korrektur: Rene Tippstärke 1040 + 16, Tipp zählt einmal');
select t.eq((select rating || '/' || evaluated_tips from public.tip_strength where user_id = :'dt' and sport = 'Fußball'),
  '914/1', 'Q21 Korrektur: Tom Tippstärke 900 + 14');
select t.eq((select count(*)::int from public.activity_feed where user_id = :'dr' and text like '🔧%'), 1, 'Q22 Korrektur-Meldung');

-- Allein getippt: nur Grundpunkte
begin;
select t.tip(:'dn', 'du1-n', 'du-1', 3, 0);
commit;
select t.finish('du-1', 3, 0);
select t.eq((select base_points || '/' || duel_points || '/' || rang_delta || '/' || coalesce(beat_percent::text, '-') from public.tips where id = 'du1-n'),
  '10/0/10/-', 'Q23 Allein: nur Grundpunkte');
select t.eq((select narration from public.tips where id = 'du1-n'), '🎯 Exakt getroffen: +10 Rangpunkte.', 'Q24 Allein: Text ohne Duelle');

-- Mindestzahl Gegner: Neu (1 Tipp) zählt für die anderen nicht, spielt aber selbst mit
update public.scoring_settings set min_opponent_tips = 10;
begin;
select t.tip(:'dr', 'du2-r', 'du-2', 1, 1);
select t.tip(:'dd', 'du2-d', 'du-2', 2, 0);
select t.tip(:'dn', 'du2-n', 'du-2', 0, 2);
commit;
select t.finish('du-2', 2, 0);
select t.eq((select counts_as_opponent::text from public.tips where id = 'du2-n'), 'false', 'Q25 Neu zählt noch nicht als Gegner');
select t.eq((select duels_won + duels_drawn + duels_lost from public.tips where id = 'du2-d'), 1, 'Q26 Doris: nur 1 Gegner (Rene)');
select t.eq((select duels_won + duels_drawn + duels_lost from public.tips where id = 'du2-n'), 2, 'Q27 Neu: spielt selbst gegen beide');
update public.scoring_settings set min_opponent_tips = 0;

-- ============================================================================
-- R) Sicherheit: der Browser darf nichts davon schreiben
-- ============================================================================
begin;
select t.login(:'dm');
set local role authenticated;
update public.tips set duel_points = 20, base_points = 10, strength_delta = 99, counts_as_opponent = true where id = 'du5-m';
commit;
select t.eq(t.tipline('du5-m'), '0/-10/-10 S0 G0 N4 St-22 B0', 'R1 Browser kann Duell-Spalten nicht ändern');
begin;
select t.login(:'dm');
set local role authenticated;
select t.expect_error($$update public.tip_strength set rating = 3000$$, 'R2 Browser kann Tippstärke nicht ändern');
select t.expect_error($$insert into public.tip_strength (user_id, sport, rating) values ('00000000-0000-0000-0000-0000000000d3', 'NHL', 3000)$$,
  'R3 Browser kann keine Tippstärke anlegen');
select t.expect_error($$update public.scoring_settings set duel_factor = 100$$, 'R4 Browser kann Einstellungen nicht ändern');
select t.expect_error($$select public.replay_tip_strength()$$, 'R5 Browser kann Nachrechnen nicht starten');
select t.eq((select count(*)::int from public.tip_strength) > 0, true, 'R6 Tippstärke für Spieler lesbar');
commit;

\echo DUELL-TESTS GRÜN
