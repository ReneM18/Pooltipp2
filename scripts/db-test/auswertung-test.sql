-- Tests für supabase/auswertung-server.sql (nur Test-Datenbank).
-- Läuft nach legacy-fixture.sql und auswertung-server.sql, siehe run.sh.
\set ON_ERROR_STOP 1
\set rene '00000000-0000-0000-0000-00000000000a'
\set anna '00000000-0000-0000-0000-00000000000b'
\set bob '00000000-0000-0000-0000-00000000000c'
\set cara '00000000-0000-0000-0000-00000000000d'
\set dora '00000000-0000-0000-0000-00000000000e'
\set emil '00000000-0000-0000-0000-00000000000f'

create schema if not exists t;
grant usage on schema t to authenticated, anon;

create or replace function t.eq(p_actual anyelement, p_expected anyelement, p_label text)
returns void language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FAIL %: ist %, erwartet %', p_label, p_actual, p_expected;
  end if;
  raise notice 'ok   %', p_label;
end $$;

create or replace function t.expect_error(p_sql text, p_label text)
returns void language plpgsql as $$
declare
  v_failed boolean := false;
begin
  begin
    execute p_sql;
  exception when others then
    v_failed := true;
    raise notice 'ok   % (Fehler: %)', p_label, sqlerrm;
  end;
  if not v_failed then
    raise exception 'FAIL %: kein Fehler', p_label;
  end if;
end $$;

-- Als Spieler einloggen (wie Supabase: JWT-Angaben + Rolle authenticated).
create or replace function t.login(p_user uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'email', (select email from auth.users where id = p_user))::text, true);
end $$;

create or replace function t.stars(p_user uuid) returns int language sql as $$
  select free_stars from public.profiles where id = p_user $$;
create or replace function t.rang(p_user uuid, p_sport text) returns int language sql as $$
  select (rang_punkte ->> p_sport)::int from public.profiles where id = p_user $$;
create or replace function t.match(p_id text, p_sport text, p_mode text, p_stake int, p_kickoff timestamptz)
returns jsonb language sql as $$
  select jsonb_build_object('id', p_id, 'sport', p_sport, 'tipMode', p_mode, 'fixedStake', p_stake,
    'status', 'upcoming', 'liveHomeScore', null, 'liveAwayScore', null,
    'kickoff', p_kickoff, 'tipDeadline', p_kickoff - interval '30 minutes',
    'homeTeamId', 'h', 'awayTeamId', 'a') $$;
grant execute on all functions in schema t to authenticated, anon;

-- ============================================================================
-- A) Übernahme des alten Stands
-- ============================================================================
select t.eq(t.stars(:'anna'), 200, 'A1 Anna: alter exakter Tipp, keine Sterne doppelt');
select t.eq(t.rang(:'anna', 'Fußball'), 10, 'A2 Anna: Rangpunkte nach neuer Regel 10 statt 16');
select t.eq((select rang_delta from public.tips where id = 't-a1'), 10, 'A3 Anna: Tipp rang_delta 10');
select t.eq((select claimed_milestones from public.profiles where id = :'anna'),
            '["herbst-2026:1", "herbst-2026:2"]'::jsonb, 'A4 Anna: Pass-Level 1+2 eingetragen (300 XP)');
select t.eq(t.stars(:'bob'), 100, 'A5 Bob: offener Tendenz-Tipp nachgewertet (+20 = Einsatz zurück)');
select t.eq(t.rang(:'bob', 'Fußball'), 6, 'A6 Bob: 6 Rangpunkte');
select t.eq((select narration from public.tips where id = 't-b1'), '👍 Tendenz richtig erkannt – +6 Rangpunkte.', 'A7 Bob: Text');
select t.eq((select count(*)::int from public.activity_feed where user_id = :'bob' and text like '👍 Tendenz%'), 1, 'A8 Bob: Feed-Meldung');
select t.eq(t.stars(:'cara'), 125, 'A9 Cara: 1X2 +5 Nachzahlung und Bonusfrage +15');
select t.eq((select result_tier || '/' || rang_delta || '/' || stars_delta from public.tips where id = 't-c1'),
            'tendenz/6/10', 'A10 Cara: 1X2-Tipp jetzt richtig, 6 Rangpunkte, +10 netto');
select t.eq(t.rang(:'cara', 'NFL'), 6, 'A11 Cara: NFL-Rangpunkte 6');
select t.eq((select rescue_bonus_used from public.profiles where id = :'cara'), true, 'A12 Cara: Rettungsbonus-Merker übernommen');
select t.eq((select count(*)::int from public.activity_feed where user_id = :'cara' and text like '🔧%'), 0, 'A13 Cara: keine Korrektur-Meldung bei Regel-Umstellung');
select t.eq((select evaluated and correct and stars_delta = 15 from public.bonus_answers where id = 'bonus-c1'), true, 'A14 Cara: Bonusantwort übernommen und ausgewertet');
select t.eq((select evaluated from public.bonus_answers where id = 'bonus-b1'), true, 'A15 Bob: alte ausgewertete Bonusantwort übernommen');
select t.eq(t.stars(:'dora'), 100, 'A16 Dora: Level 10 erreicht -> keine Coins (Pass gibt nie Coins)');
select t.eq((select claimed_milestones @> '[3, "herbst-2026:10"]' from public.profiles where id = :'dora'), true, 'A17 Dora: Level 10 + Serien-Meilenstein bleiben');

-- Zweiter Lauf des Skripts ändert nichts.
create table t.snap as select id, free_stars, rang_punkte, pass_xp, claimed_milestones from public.profiles;
create table t.snap_tips as select id, evaluated, result_tier, rang_delta, stars_delta from public.tips;
\o /dev/null
\i supabase/auswertung-server.sql
\o
select t.eq((select count(*)::int from (
  select id, free_stars, rang_punkte, pass_xp, claimed_milestones from public.profiles
  except select * from t.snap) x), 0, 'A18 Zweiter Lauf: Profile unverändert');
select t.eq((select count(*)::int from (
  select id, evaluated, result_tier, rang_delta, stars_delta from public.tips
  except select * from t.snap_tips) x), 0, 'A19 Zweiter Lauf: Tipps unverändert');

-- ============================================================================
-- B) Tippen: Einsatz zieht die Datenbank ab
-- ============================================================================
insert into public.matches (id, data) values
  ('m1', t.match('m1', 'Fußball', 'score', 20, now() + interval '1 day')),
  ('m2', t.match('m2', 'Fußball', 'score', 20, now() + interval '1 day')),
  ('m3', t.match('m3', 'NBA', 'score', 20, now() + interval '1 day')),
  ('m4', t.match('m4', 'NHL', 'score', 20, now() + interval '1 day')),
  ('m5', t.match('m5', 'NFL', '1x2', 20, now() + interval '1 day')),
  ('m6', t.match('m6', 'Fußball', 'score', 20, now() + interval '1 day')),
  ('m-zu', t.match('m-zu', 'Fußball', 'score', 20, now() + interval '10 minutes')),
  ('m-teuer', t.match('m-teuer', 'Fußball', 'score', 35, now() + interval '1 day'));

begin;
select t.login(:'anna');
set local role authenticated;
-- Browser schickt Einsatz 0 und eine gefälschte Auswertung mit.
insert into public.tips (id, user_id, match_id, predicted_home_score, predicted_away_score, stake, submitted_at,
                         evaluated, result_tier, rang_delta, stars_delta)
values ('tip-a-m1', :'anna', 'm1', 2, 0, 0, '2020-01-01', true, 'exakt', 999, 999);
select t.eq((select stake from public.tips where id = 'tip-a-m1'), 20, 'B1 Einsatz = Spiel-Einsatz 20, nicht was der Browser schickt');
select t.eq((select evaluated from public.tips where id = 'tip-a-m1'), false, 'B2 Gefälschte Auswertung beim Anlegen ignoriert');
select t.eq((select rang_delta from public.tips where id = 'tip-a-m1'), null::int, 'B3 rang_delta leer');
select t.eq(t.stars(:'anna'), 180, 'B4 Anna: 200 - 20');
-- Alter Browser speichert immer alle Tipps erneut (Upsert).
insert into public.tips (id, user_id, match_id, predicted_home_score, predicted_away_score, stake, submitted_at, evaluated)
values ('tip-a-m1', :'anna', 'm1', 2, 0, 20, now(), false)
on conflict (id) do update set predicted_home_score = excluded.predicted_home_score, stake = excluded.stake;
select t.eq(t.stars(:'anna'), 180, 'B5 Upsert desselben Tipps bucht nicht nochmal ab');
-- Zweiter Tipp aufs gleiche Spiel.
insert into public.tips (id, user_id, match_id, predicted_home_score, predicted_away_score, stake, submitted_at)
values ('tip-a-m1-zwei', :'anna', 'm1', 5, 0, 20, now());
select t.eq((select count(*)::int from public.tips where user_id = :'anna' and match_id = 'm1'), 1, 'B6 Nur ein Tipp pro Spiel');
select t.eq(t.stars(:'anna'), 180, 'B7 Zweiter Tipp kostet nichts');
-- Nach Tippschluss.
insert into public.tips (id, user_id, match_id, predicted_home_score, predicted_away_score, stake, submitted_at)
values ('tip-a-zu', :'anna', 'm-zu', 1, 1, 20, now());
select t.eq((select count(*)::int from public.tips where id = 'tip-a-zu'), 0, 'B8 Tipp nach Tippschluss wird nicht gespeichert');
-- Tipp ändern: Ergebnis ja, Einsatz/Auswertung nein.
update public.tips set predicted_home_score = 3, predicted_away_score = 1, stake = 1, evaluated = true,
  stars_delta = 500, rang_delta = 500, result_tier = 'exakt'
where id = 'tip-a-m1';
select t.eq((select predicted_home_score || ':' || predicted_away_score || ' E' || stake || ' ' || evaluated
             from public.tips where id = 'tip-a-m1'), '3:1 E20 false', 'B9 Tipp ändern: nur das Ergebnis ändert sich');
-- Fremden Tipp anlegen.
select t.expect_error($$insert into public.tips (id, user_id, match_id, predicted_home_score, predicted_away_score, stake, submitted_at)
  values ('tip-fremd', '00000000-0000-0000-0000-00000000000c', 'm2', 1, 0, 20, now())$$, 'B10 Tipp für andere Person anlegen verboten');
commit;

-- Tageslimit 100 und höherer Spiel-Einsatz.
begin;
select t.login(:'anna');
set local role authenticated;
insert into public.tips (id, user_id, match_id, predicted_home_score, predicted_away_score, stake, submitted_at) values
  ('tip-a-m2', :'anna', 'm2', 1, 0, 20, now()),
  ('tip-a-m3', :'anna', 'm3', 100, 90, 20, now()),
  ('tip-a-m-teuer', :'anna', 'm-teuer', 0, 0, 20, now());
select t.eq((select stake from public.tips where id = 'tip-a-m-teuer'), 35, 'B11 Einsatz 35 bei Spiel-Einsatz 35');
select t.eq((select (my_wallet() ->> 'stake_budget_remaining')::int), 5, 'B12 Restliches Tageslimit 5 (20+20+20+35)');
insert into public.tips (id, user_id, match_id, predicted_home_score, predicted_away_score, stake, submitted_at) values
  ('tip-a-m4', :'anna', 'm4', 3, 2, 20, now()),
  ('tip-a-m5', :'anna', 'm5', 1, 0, 20, now());
select t.eq((select stake from public.tips where id = 'tip-a-m4'), 5, 'B13 Tageslimit: nur noch 5 eingesetzt');
select t.eq((select stake from public.tips where id = 'tip-a-m5'), 0, 'B14 Tageslimit erreicht: Tipp mit Einsatz 0');
select t.eq(t.stars(:'anna'), 100, 'B15 Anna: 200 - 100 Tageslimit');
commit;

-- Rettungs-Bonus.
update public.profiles set free_stars = 30, rescue_bonus_used = false where id = :'bob';
begin;
select t.login(:'bob');
set local role authenticated;
insert into public.tips (id, user_id, match_id, predicted_home_score, predicted_away_score, stake, submitted_at) values
  ('tip-b-m1', :'bob', 'm1', 0, 1, 20, now());
select t.eq(t.stars(:'bob'), 10, 'B16 Bob: 30 - 20');
insert into public.tips (id, user_id, match_id, predicted_home_score, predicted_away_score, stake, submitted_at) values
  ('tip-b-m2', :'bob', 'm2', 2, 0, 20, now());
select t.eq((select stake from public.tips where id = 'tip-b-m2'), 10, 'B17 Bob: Einsatz auf Guthaben 10 gekürzt');
select t.eq(t.stars(:'bob'), 20, 'B18 Bob: auf 0 gefallen -> 20 Rettungs-Sterne');
insert into public.tips (id, user_id, match_id, predicted_home_score, predicted_away_score, stake, submitted_at) values
  ('tip-b-m3', :'bob', 'm3', 99, 100, 20, now());
select t.eq(t.stars(:'bob'), 0, 'B19 Bob: Rettungs-Sterne nur einmal');
commit;

-- Tipp-Serie.
update public.profiles set streak_count = 2, last_tip_date = to_char((now() - interval '1 day') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  claimed_milestones = '[]', free_stars = 100 where id = :'cara';
begin;
select t.login(:'cara');
set local role authenticated;
insert into public.tips (id, user_id, match_id, predicted_home_score, predicted_away_score, stake, submitted_at) values
  ('tip-c-m1', :'cara', 'm1', 3, 1, 20, now());
select t.eq((select streak_count from public.profiles where id = :'cara'), 3, 'B20 Serie: Folgetag -> 3');
select t.eq(t.stars(:'cara'), 90, 'B21 Serie: 100 - 20 + 10 Meilenstein-Bonus');
insert into public.tips (id, user_id, match_id, predicted_home_score, predicted_away_score, stake, submitted_at) values
  ('tip-c-m5', :'cara', 'm5', 0, 1, 20, now());
select t.eq((select streak_count from public.profiles where id = :'cara'), 3, 'B22 Serie: gleicher Tag zählt einmal');
select t.eq(t.stars(:'cara'), 70, 'B23 Serie: kein zweiter Bonus');
commit;

-- ============================================================================
-- C) Angriffe auf Profil und Funktionen
-- ============================================================================
begin;
select t.login(:'anna');
set local role authenticated;
update public.profiles set free_stars = 99999, pass_xp = 99999, rang_punkte = '{"Fußball":9999}',
  claimed_milestones = '["herbst-2026:10"]', streak_count = 50, last_claimed_at = null,
  rescue_bonus_used = false, display_name = 'Anna B.'
where id = :'anna';
select t.eq(t.stars(:'anna'), 100, 'C1 Sterne selbst setzen: bleibt 100');
select t.eq((select pass_xp from public.profiles where id = :'anna'), 300, 'C2 XP selbst setzen: bleibt 300');
select t.eq(t.rang(:'anna', 'Fußball'), 10, 'C3 Rangpunkte selbst setzen: bleibt 10');
select t.eq((select claimed_milestones from public.profiles where id = :'anna'), '["herbst-2026:1", "herbst-2026:2"]'::jsonb, 'C4 Pass-Level selbst eintragen: bleibt');
select t.eq((select display_name from public.profiles where id = :'anna'), 'Anna B.', 'C5 Namen ändern geht weiter');
update public.profiles set free_stars = 0 where id = :'bob';
select t.eq(t.stars(:'bob'), 0, 'C6 Fremdes Profil: unverändert (RLS)');
select t.expect_error($$select public.add_stars(500)$$, 'C7 add_stars gesperrt');
select t.expect_error($$select public.take_stars('00000000-0000-0000-0000-00000000000c', 10, false, false)$$, 'C8 take_stars gesperrt');
select t.expect_error($$select public.evaluate_match_tips('m1')$$, 'C9 evaluate_match_tips gesperrt');
select t.expect_error($$select public.claim_pass_rewards('00000000-0000-0000-0000-00000000000b')$$, 'C10 claim_pass_rewards gesperrt');
select t.expect_error($$select public.evaluate_match_bonus('m1')$$, 'C11 evaluate_match_bonus gesperrt');
select t.expect_error($$select public.resolve_duels_internal('m1', 1, 0)$$, 'C12 resolve_duels_internal gesperrt');
select t.expect_error($$select public.evaluate_match('m-alt')$$, 'C13 evaluate_match nur Admin');
select t.expect_error($$select public.resolve_duels_for_match('m1', 1, 0)$$, 'C14 resolve_duels_for_match nur Admin');
select t.expect_error($$select public.spend_stars(-50)$$, 'C15 spend_stars mit Minus');
select t.expect_error($$select public.spend_stars(100000)$$, 'C16 spend_stars mehr als Guthaben');
select t.eq(t.stars(:'anna'), 100, 'C17 Anna nach Angriffen weiter 100');
-- Fremden Tipp ändern / Auswertung fälschen.
update public.tips set predicted_home_score = 9 where id = 'tip-b-m1';
select t.eq((select predicted_home_score from public.tips where id = 'tip-b-m1'), 0, 'C18 Fremden Tipp ändern: unverändert');
-- Spiel als Nicht-Admin beenden.
update public.matches set data = jsonb_set(jsonb_set(jsonb_set(data, '{status}', '"finished"'), '{liveHomeScore}', '3'), '{liveAwayScore}', '1') where id = 'm1';
select t.eq((select data ->> 'status' from public.matches where id = 'm1'), 'upcoming', 'C19 Nicht-Admin kann kein Spiel beenden');
delete from public.tips where id = 'tip-a-m1';
select t.eq((select count(*)::int from public.tips where id = 'tip-a-m1'), 1, 'C21 Tipp löschen geht nicht');
commit;

-- Profil selbst anlegen (Konto ohne Profil): nur mit Startwerten.
insert into auth.users (id, email) values (:'emil', 'emil@test.at');
delete from public.profiles where id = :'emil';
begin;
select t.login(:'emil');
set local role authenticated;
insert into public.profiles (id, display_name, free_stars, pass_xp, rang_punkte, claimed_milestones)
values (:'emil', 'Emil', 5000, 9000, '{"Fußball":500}', '["herbst-2026:10"]');
select t.eq((select free_stars || '/' || pass_xp || '/' || (rang_punkte ->> 'Fußball') || '/' || claimed_milestones::text
             from public.profiles where id = :'emil'), '100/0/0/[]', 'C22 Profil anlegen: immer Startwerte');
commit;

-- ============================================================================
-- D) Auswertung durch den Admin
-- ============================================================================
-- Stand vorher: m1 hat Anna 3:1 (20), Bob 0:1 (20), Cara 3:1 (20).
select t.eq(t.stars(:'anna'), 100, 'D0 Anna vorher 100');
begin;
select t.login(:'rene');
set local role authenticated;
-- Der Admin-Bereich speichert alle Spiele auf einmal (Upsert).
insert into public.matches (id, data)
select id, case when id = 'm1'
  then jsonb_set(jsonb_set(jsonb_set(data, '{status}', '"finished"'), '{liveHomeScore}', '3'), '{liveAwayScore}', '1')
  else data end
from public.matches
on conflict (id) do update set data = excluded.data, updated_at = now();
commit;
select t.eq(t.stars(:'anna'), 130, 'D1 Anna exakt: +30 (Einsatz 20 x 1,5)');
select t.eq(t.rang(:'anna', 'Fußball'), 20, 'D2 Anna: +10 Rangpunkte');
select t.eq(t.stars(:'bob'), 10, 'D3 Bob falsch: +10 (Hälfte zurück)');
select t.eq(t.rang(:'bob', 'Fußball'), 6, 'D4 Bob: Rangpunkte bleiben');
select t.eq(t.stars(:'cara'), 100, 'D5 Cara exakt: 70 + 30');
select t.eq((select narration from public.tips where id = 'tip-a-m1'), '🎯 Exakt getroffen! +10 Rangpunkte.', 'D6 Text exakt');
select t.eq((select narration from public.tips where id = 'tip-b-m1'), '😬 Daneben getippt (+0 Rangpunkte).', 'D7 Text falsch');
select t.eq((select stars_delta from public.tips where id = 'tip-b-m1'), -10, 'D8 Bob netto -10');

-- Nochmal speichern (z. B. anderes Spiel bearbeitet): nichts doppelt.
begin;
select t.login(:'rene');
set local role authenticated;
insert into public.matches (id, data) select id, data from public.matches
on conflict (id) do update set data = excluded.data, updated_at = now();
commit;
select t.eq(t.stars(:'anna') || '/' || t.stars(:'bob') || '/' || t.stars(:'cara'), '130/10/100', 'D9 Erneutes Speichern: keine Doppelzahlung');

-- Endstand korrigieren 3:1 -> 1:1: Anna/Cara jetzt falsch, Bob falsch.
begin;
select t.login(:'rene');
set local role authenticated;
update public.matches set data = jsonb_set(data, '{liveHomeScore}', '1') where id = 'm1';
commit;
select t.eq(t.stars(:'anna'), 110, 'D10 Korrektur: Anna 130 - 20 (netto +10 -> -10)');
select t.eq(t.rang(:'anna', 'Fußball'), 10, 'D11 Korrektur: Anna -10 Rangpunkte');
select t.eq(t.stars(:'bob'), 10, 'D12 Korrektur: Bob bleibt (weiter falsch)');
select t.eq((select narration from public.tips where id = 'tip-a-m1'),
            '🔧 Ein Admin hat den Endstand korrigiert – dein Tipp gilt jetzt daneben (+0 Rangpunkte).', 'D13 Korrektur-Text');
-- Zurück auf 3:1.
begin;
select t.login(:'rene');
set local role authenticated;
update public.matches set data = jsonb_set(data, '{liveHomeScore}', '3') where id = 'm1';
commit;
select t.eq(t.stars(:'anna') || '/' || t.rang(:'anna', 'Fußball'), '130/20', 'D14 Zurückkorrigiert: wie nach erster Auswertung');

-- Veralteter Admin-Tab schreibt das Spiel als "bevorstehend" zurück.
begin;
select t.login(:'rene');
set local role authenticated;
update public.matches set data = t.match('m1', 'Fußball', 'score', 20, now() + interval '1 day') where id = 'm1';
commit;
select t.eq((select data ->> 'status' || ' ' || (data ->> 'liveHomeScore') || ':' || (data ->> 'liveAwayScore')
             from public.matches where id = 'm1'), 'finished 3:1', 'D15 Beendet bleibt beendet, Endstand bleibt');
select t.eq(t.stars(:'anna'), 130, 'D16 Veralteter Tab ändert keine Sterne');

-- 1X2-Spiel: Endstand 2:2 -> Unentschieden. Anna tippte "1" (1:0), Cara "2" (0:1).
update public.tips set predicted_home_score = 0, predicted_away_score = 0 where id = 'tip-c-m5';
begin;
select t.login(:'rene');
set local role authenticated;
update public.matches set data = jsonb_set(jsonb_set(jsonb_set(data, '{status}', '"finished"'), '{liveHomeScore}', '2'), '{liveAwayScore}', '2') where id = 'm5';
commit;
select t.eq((select result_tier || '/' || rang_delta || '/' || stars_delta from public.tips where id = 'tip-c-m5'), 'tendenz/6/10', 'D17 1X2 richtig: 6 Rangpunkte, +50 %');
select t.eq((select narration from public.tips where id = 'tip-c-m5'), '👍 Richtig getippt – +6 Rangpunkte.', 'D18 1X2 Text');
select t.eq((select result_tier || '/' || stars_delta from public.tips where id = 'tip-a-m5'), 'falsch/0', 'D19 Einsatz 0: falsch, keine Sterne');
select t.eq(t.stars(:'cara'), 130, 'D20 Cara: 100 + 30');

-- Alter Browser schreibt den Tipp mit veraltetem Stand "offen" zurück.
begin;
select t.login(:'anna');
set local role authenticated;
insert into public.tips (id, user_id, match_id, predicted_home_score, predicted_away_score, stake, submitted_at, evaluated, stars_delta)
values ('tip-a-m1', :'anna', 'm1', 0, 0, 20, now(), false, null)
on conflict (id) do update set evaluated = excluded.evaluated, stars_delta = excluded.stars_delta,
  predicted_home_score = excluded.predicted_home_score;
commit;
select t.eq((select evaluated::text || '/' || stars_delta || '/' || predicted_home_score from public.tips where id = 'tip-a-m1'),
            'true/10/3', 'D20b Veralteter Tab: Auswertung und Tipp bleiben');
select t.eq(t.stars(:'anna'), 130, 'D20c Veralteter Tab: Sterne bleiben');

-- Ohne Login (anon) geht nichts.
begin;
set local role anon;
select t.expect_error($$select public.claim_daily_bonus()$$, 'D20d Gast: kein Tagesbonus');
select t.expect_error($$select public.my_wallet()$$, 'D20e Gast: kein Kontostand');
commit;

-- Auswertung von Hand im SQL-Editor (als postgres) ändert nichts mehr.
select t.eq(public.evaluate_match('m1'), 0, 'D21 evaluate_match im SQL-Editor: nichts mehr offen');

-- ============================================================================
-- E) Duelle
-- ============================================================================
update public.profiles set free_stars = 100 where id in (:'anna', :'bob');
delete from public.tips where user_id in (:'anna', :'bob') and match_id = 'm6';
begin;
select t.login(:'bob');
set local role authenticated;
-- Bob hat heute schon 50 eingesetzt (20 + 10 + 20): Limit lässt noch 50 zu.
insert into public.duels (id, challenger_id, challenger_name, opponent_id, opponent_name, match_id, stake, status)
values ('duel-1', :'bob', 'Bob', :'anna', 'Anna', 'm6', 10000, 'pending');
select t.eq((select stake from public.duels where id = 'duel-1'), 50, 'E1 Duell-Einsatz auf Tageslimit gekürzt (50)');
select t.eq(t.stars(:'bob'), 50, 'E2 Bob: Einsatz abgezogen');
select t.expect_error($$insert into public.duels (id, challenger_id, challenger_name, opponent_id, opponent_name, match_id, stake, status)
  values ('duel-2', '00000000-0000-0000-0000-00000000000c', 'Bob', '00000000-0000-0000-0000-00000000000b', 'Anna', 'm6', 10, 'pending')$$,
  'E3 Tageslimit aufgebraucht: kein weiteres Duell');
select t.expect_error($$select public.accept_duel('duel-1')$$, 'E5 Herausforderer kann nicht selbst annehmen');
commit;

-- Duell direkt als "offen" (ohne Annahme) anlegen: Dora hat noch Limit.
update public.profiles set free_stars = 100 where id = :'dora';
begin;
select t.login(:'dora');
set local role authenticated;
select t.expect_error($$insert into public.duels (id, challenger_id, challenger_name, opponent_id, opponent_name, match_id, stake, status)
  values ('duel-3', '00000000-0000-0000-0000-00000000000e', 'Dora', '00000000-0000-0000-0000-00000000000b', 'Anna', 'm6', 10, 'offen')$$,
  'E4 Duell direkt als "offen" anlegen verboten');
commit;
select t.eq(t.stars(:'dora'), 100, 'E4b Dora: abgelehntes Duell kostet nichts');

-- Anna hat heute schon 100 eingesetzt -> Annahme scheitert am Tageslimit.
begin;
select t.login(:'anna');
set local role authenticated;
select t.expect_error($$select public.accept_duel('duel-1')$$, 'E6 Annahme über dem Tageslimit scheitert');
commit;
select t.eq(t.stars(:'anna'), 100, 'E7 Anna: nichts abgezogen');
-- Für den Test Annas heutige Einsätze auf gestern verschieben.
update public.tips set staked_at = staked_at - interval '1 day' where user_id = :'anna';
begin;
select t.login(:'anna');
set local role authenticated;
select public.accept_duel('duel-1');
insert into public.tips (id, user_id, match_id, predicted_home_score, predicted_away_score, stake, submitted_at)
values ('tip-a-m6', :'anna', 'm6', 2, 2, 20, now());
commit;
select t.eq(t.stars(:'anna'), 30, 'E8 Anna: 100 - 50 Duell - 20 Tipp');
begin;
select t.login(:'bob');
set local role authenticated;
insert into public.tips (id, user_id, match_id, predicted_home_score, predicted_away_score, stake, submitted_at)
values ('tip-b-m6', :'bob', 'm6', 1, 0, 20, now());
commit;
select t.eq(t.stars(:'bob'), 50, 'E9 Bob: Tageslimit voll, Tipp mit Einsatz 0');
begin;
select t.login(:'rene');
set local role authenticated;
update public.matches set data = jsonb_set(jsonb_set(jsonb_set(data, '{status}', '"finished"'), '{liveHomeScore}', '2'), '{liveAwayScore}', '2') where id = 'm6';
commit;
select t.eq((select status || '/' || result from public.duels where id = 'duel-1'), 'ausgewertet/opponent', 'E10 Duell ausgewertet: Anna gewinnt');
select t.eq(t.stars(:'anna'), 160, 'E11 Anna: 30 + 100 Duellgewinn + 30 Tipp exakt');
select t.eq(t.stars(:'bob'), 50, 'E12 Bob: verliert Duell, Tipp mit Einsatz 0');

-- ============================================================================
-- F) Bonusfragen
-- ============================================================================
insert into public.matches (id, data) values
  ('m-bonus', t.match('m-bonus', 'Fußball', 'score', 20, now() + interval '1 day')
     || jsonb_build_object('bonusQuestion', jsonb_build_object('question', 'Elfmeter?', 'options', jsonb_build_array('Ja', 'Nein'),
                                                               'correctOptionIndex', null, 'bonusStars', 25)));
begin;
select t.login(:'anna');
set local role authenticated;
insert into public.bonus_answers (id, user_id, match_id, option_index, evaluated, correct, stars_delta)
values ('ba-anna', :'anna', 'm-bonus', 0, true, true, 999);
select t.eq((select evaluated from public.bonus_answers where id = 'ba-anna'), false, 'F1 Gefälschte Auswertung ignoriert');
select t.expect_error($$insert into public.bonus_answers (id, user_id, match_id, option_index)
  values ('ba-anna-2', '00000000-0000-0000-0000-00000000000b', 'm-bonus', 1)$$, 'F2 Nur eine Antwort pro Spiel');
commit;
begin;
select t.login(:'bob');
set local role authenticated;
insert into public.bonus_answers (id, user_id, match_id, option_index) values ('ba-bob', :'bob', 'm-bonus', 7);
select t.eq((select count(*)::int from public.bonus_answers where id = 'ba-bob'), 0, 'F4 Ungültige Antwort-Nummer ignoriert');
insert into public.bonus_answers (id, user_id, match_id, option_index) values ('ba-bob', :'bob', 'm-bonus', 1);
commit;
begin;
select t.login(:'rene');
set local role authenticated;
update public.matches set data = jsonb_set(data, '{bonusQuestion,correctOptionIndex}', '0') where id = 'm-bonus';
commit;
select t.eq(t.stars(:'anna'), 185, 'F5 Anna richtig: +25');
select t.eq(t.stars(:'bob'), 50, 'F6 Bob falsch: nichts');
begin;
select t.login(:'cara');
set local role authenticated;
insert into public.bonus_answers (id, user_id, match_id, option_index) values ('ba-cara', :'cara', 'm-bonus', 0);
select t.eq((select count(*)::int from public.bonus_answers where id = 'ba-cara'), 0, 'F7 Antwort nach Auflösung wird nicht gespeichert');
commit;
begin;
select t.login(:'rene');
set local role authenticated;
update public.matches set data = jsonb_set(data, '{bonusQuestion,correctOptionIndex}', '1') where id = 'm-bonus';
commit;
select t.eq(t.stars(:'anna') || '/' || t.stars(:'bob'), '160/75', 'F8 Richtige Antwort geändert: Differenz umgebucht');

-- ============================================================================
-- G) Tagesbonus und Saison-Pass
-- ============================================================================
update public.profiles set last_claimed_at = null, pass_xp = 5950, free_stars = 10 where id = :'cara';
begin;
select t.login(:'cara');
set local role authenticated;
select t.eq((select (claim_daily_bonus() ->> 'claimed')::boolean), true, 'G1 Tagesbonus abgeholt');
select t.eq(t.stars(:'cara'), 18, 'G2 +8 Sterne, Level 10 erreicht bringt keine Coins');
select t.eq((select pass_xp from public.profiles where id = :'cara'), 6050, 'G3 +100 XP');
select t.eq((select (claim_daily_bonus() ->> 'claimed')::boolean), false, 'G4 Zweites Mal am selben Tag: nein');
select t.eq(t.stars(:'cara') || '/' || (select pass_xp from public.profiles where id = :'cara'), '18/6050', 'G5 Nichts doppelt');
commit;
-- 30 Tage weg: (30 - 14) / 7 = 2 Wochen -> -10 Rangpunkte je Sportart.
update public.profiles set last_claimed_at = to_char((now() - interval '30 days') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  rang_punkte = '{"Fußball":50,"NFL":4,"NBA":0,"NHL":12}' where id = :'cara';
begin;
select t.login(:'cara');
set local role authenticated;
select claim_daily_bonus();
commit;
select t.eq((select rang_punkte from public.profiles where id = :'cara'), '{"Fußball":40,"NFL":0,"NBA":0,"NHL":2}'::jsonb, 'G6 Abklingen nach 30 Tagen: -10, nie unter 0');

-- Saisonwechsel-Funktion eines anderen Skripts (SECURITY DEFINER) darf XP zurücksetzen.
create or replace function public.test_season_reset() returns void language plpgsql security definer set search_path = public as $$
begin update public.profiles set pass_xp = 0 where id = auth.uid(); end $$;
grant execute on function public.test_season_reset() to authenticated;
begin;
select t.login(:'cara');
set local role authenticated;
select public.test_season_reset();
commit;
select t.eq((select pass_xp from public.profiles where id = :'cara'), 0, 'G7 SECURITY-DEFINER-Funktion darf XP ändern');
drop function public.test_season_reset();

-- ============================================================================
-- H) Absagen und Shop
-- ============================================================================
insert into public.matches (id, data) values ('m-ab', t.match('m-ab', 'NBA', 'score', 20, now() + interval '1 day'));
update public.profiles set free_stars = 100 where id = :'dora';
begin;
select t.login(:'dora');
set local role authenticated;
insert into public.tips (id, user_id, match_id, predicted_home_score, predicted_away_score, stake, submitted_at)
values ('tip-d-ab', :'dora', 'm-ab', 100, 99, 20, now());
select t.eq((select (my_wallet() ->> 'stake_budget_remaining')::int), 80, 'H1 Dora: Limit 80 übrig');
commit;
begin;
select t.login(:'rene');
set local role authenticated;
select t.eq(public.cancel_match('m-ab'), 1, 'H2 Spiel abgesagt, 1 Tipp erstattet');
commit;
select t.eq(t.stars(:'dora'), 100, 'H3 Dora: Einsatz zurück');
begin;
select t.login(:'dora');
set local role authenticated;
select t.eq((select (my_wallet() ->> 'stake_budget_remaining')::int), 100, 'H4 Erstatteter Einsatz zählt nicht mehr fürs Limit');
insert into public.tips (id, user_id, match_id, predicted_home_score, predicted_away_score, stake, submitted_at)
values ('tip-d-ab-2', :'dora', 'm-ab', 1, 0, 20, now());
select t.eq(t.stars(:'dora'), 100, 'H5 Tipp auf abgesagtes Spiel: nichts abgezogen');
select t.eq((select (spend_stars(30) ->> 'free_stars')::int), 70, 'H6 Shop: 30 Sterne ausgegeben');
commit;

-- ============================================================================
-- S) Saisonwechsel (nur wenn supabase/saisonwechsel.sql eingespielt ist)
-- ============================================================================
select exists (select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'profiles' and column_name = 'pass_season_id') as saison \gset
\if :saison
-- Cara ist schon im Winter: ihre XP schalten keine Herbst-Level frei.
update public.profiles set pass_season_id = 'winter-2026', pass_season_start = date '2026-12-21',
  pass_xp = 6000, claimed_milestones = '[]'::jsonb where id = :'cara';
select public.claim_pass_rewards(:'cara');
select t.eq((select claimed_milestones from public.profiles where id = :'cara'), '[]'::jsonb, 'S1 Winter-XP geben keine Herbst-Level');
-- Browser darf die Saison-Spalten nicht setzen, Reset über start_pass_season geht trotz Schutz.
update public.profiles set pass_season_id = 'herbst-2026', pass_season_start = date '2026-09-23' where id = :'dora';
begin;
select t.login(:'dora');
set local role authenticated;
update public.profiles set pass_season_id = 'winter-2026' where id = :'dora';
select t.eq((select pass_season_id from public.profiles where id = :'dora'), 'herbst-2026', 'S2 Saison-Spalte geschützt');
select public.start_pass_season('winter-2026', current_date - 1);
select t.eq((select pass_xp from public.profiles where id = :'dora'), 0, 'S3 Saisonwechsel setzt XP auf 0');
select t.eq((select pass_season_id from public.profiles where id = :'dora'), 'winter-2026', 'S4 Saisonwechsel trägt neue Saison ein');
commit;
\echo 'Saisonwechsel-Tests grün'
\endif

-- Kontrolle: kein Profil unter 0.
select t.eq((select count(*)::int from public.profiles where free_stars < 0), 0, 'Z1 Kein Guthaben unter 0');
\echo 'ALLE TESTS GRÜN'
