-- Tests für supabase/booster.sql (nur Test-Datenbank). Läuft nach
-- auswertung-test.sql, siehe run.sh: spielt booster.sql selbst ein.
\set ON_ERROR_STOP 1
\set fritz '00000000-0000-0000-0000-0000000000f1'
\set gina '00000000-0000-0000-0000-0000000000f2'

insert into auth.users (id, email, raw_user_meta_data) values
  (:'fritz', 'fritz@test.at', '{"display_name":"Fritz"}'),
  (:'gina', 'gina@test.at', '{"display_name":"Gina"}');
update public.profiles set free_stars = 100, rescue_bonus_used = false where id in (:'fritz', :'gina');

create or replace function t.finish(p_id text, p_home int, p_away int) returns void language sql as $$
  update public.matches set data = data || jsonb_build_object('status', 'finished', 'liveHomeScore', p_home, 'liveAwayScore', p_away)
  where id = p_id $$;

-- Vorher (noch alte Regeln): Fritz tippt ein Spiel mit Einsatz 20.
insert into public.matches (id, data) values
  ('bo-alt', t.match('bo-alt', 'Fußball', 'score', 20, now() + interval '1 day'));
begin;
select t.login(:'fritz');
set local role authenticated;
insert into public.tips (id, user_id, match_id, predicted_home_score, predicted_away_score, stake, submitted_at)
values ('bo-t-alt', :'fritz', 'bo-alt', 1, 0, 0, now());
commit;
select t.eq(t.stars(:'fritz'), 80, 'K0 Vorher: alter Tipp kostet 20');

-- ============================================================================
-- K) booster.sql einspielen: nichts Bestehendes ändert sich
-- ============================================================================
create table t.bsnap as select id, free_stars, rang_punkte, pass_xp, claimed_milestones, rescue_bonus_used from public.profiles;
create table t.bsnap_tips as select id, user_id, match_id, predicted_home_score, predicted_away_score, stake,
  evaluated, result_tier, rang_delta, stars_delta from public.tips;
create table t.bsnap_matches as select id, data from public.matches;
\o /dev/null
\i supabase/booster.sql
\i supabase/booster.sql
\o
select t.eq((select count(*)::int from (select * from t.bsnap except
  select id, free_stars, rang_punkte, pass_xp, claimed_milestones, rescue_bonus_used from public.profiles) x), 0,
  'K1 Profile (Sterne, Rangpunkte, XP) unverändert');
select t.eq((select count(*)::int from (select * from t.bsnap_tips except
  select id, user_id, match_id, predicted_home_score, predicted_away_score, stake,
         evaluated, result_tier, rang_delta, stars_delta from public.tips) x), 0, 'K2 Alle Tipps unverändert');
select t.eq((select count(*)::int from (select * from t.bsnap_matches except select id, data from public.matches) x), 0,
  'K3 Spiele unverändert');
select t.eq((select count(*)::int from public.tips where booster), 0, 'K4 Kein alter Tipp ist ein Booster');

-- ============================================================================
-- L) Tippen mit Booster
-- ============================================================================
insert into public.matches (id, data) values
  ('bo-normal', t.match('bo-normal', 'Fußball', 'score', 20, now() + interval '1 day')),
  ('bo-b1', t.match('bo-b1', 'Fußball', 'score', 20, now() + interval '1 day') || '{"booster":true}'),
  ('bo-b2', t.match('bo-b2', 'Fußball', 'score', 20, now() + interval '1 day') || '{"booster":true}'),
  ('bo-b3', t.match('bo-b3', 'NFL', '1x2', 20, now() + interval '1 day') || '{"booster":true}'),
  ('bo-b4', t.match('bo-b4', 'Fußball', 'score', 20, now() + interval '1 day') || '{"booster":true}');

begin;
select t.login(:'fritz');
set local role authenticated;
-- Normales Spiel: gratis, auch wenn der Browser Einsatz und Booster schickt.
insert into public.tips (id, user_id, match_id, predicted_home_score, predicted_away_score, stake, submitted_at, booster)
values ('bo-t-normal', :'fritz', 'bo-normal', 2, 1, 50, now(), true);
select t.eq((select stake::text || '/' || booster::text from public.tips where id = 'bo-t-normal'), '0/false', 'L1 Normaler Tipp: Einsatz 0, kein Booster');
select t.eq(t.stars(:'fritz'), 80, 'L2 Normaler Tipp kostet nichts');
-- Booster: fest 20, egal was der Browser schickt.
insert into public.tips (id, user_id, match_id, predicted_home_score, predicted_away_score, stake, submitted_at, booster)
values ('bo-t-b1', :'fritz', 'bo-b1', 2, 1, 0, now(), false);
select t.eq((select stake::text || '/' || booster::text from public.tips where id = 'bo-t-b1'), '20/true', 'L3 Booster-Tipp: Einsatz 20, Booster-Merker');
select t.eq(t.stars(:'fritz'), 60, 'L4 Booster kostet 20');
insert into public.tips (id, user_id, match_id, predicted_home_score, predicted_away_score, stake, submitted_at)
values ('bo-t-b2', :'fritz', 'bo-b2', 0, 0, 20, now());
insert into public.tips (id, user_id, match_id, predicted_home_score, predicted_away_score, stake, submitted_at)
values ('bo-t-b3', :'fritz', 'bo-b3', 1, 0, 20, now());
select t.eq(t.stars(:'fritz'), 20, 'L5 Drei Booster: 80 - 60');
-- Booster-Merker lässt sich nachträglich nicht ändern.
update public.tips set booster = false, stake = 0 where id = 'bo-t-b1';
update public.tips set booster = true where id = 'bo-t-normal';
select t.eq((select string_agg(id || '=' || booster::text || '/' || stake, ',' order by id) from public.tips where id in ('bo-t-b1', 'bo-t-normal')),
  'bo-t-b1=true/20,bo-t-normal=false/0', 'L6 Browser kann Booster und Einsatz nicht ändern');
-- Duell-Tageslimit: Booster zählen nicht mehr mit.
select t.eq((public.my_wallet() ->> 'stake_budget_remaining')::int, 100, 'L7 Tageslimit (nur Duelle) noch voll');
commit;

-- Genau 20 Sterne: Booster geht, Konto 0 -> einmal 20 Rettungs-Sterne.
begin;
select t.login(:'fritz');
set local role authenticated;
insert into public.tips (id, user_id, match_id, predicted_home_score, predicted_away_score, stake, submitted_at)
values ('bo-t-b4', :'fritz', 'bo-b4', 3, 3, 20, now());
select t.eq(t.stars(:'fritz'), 20, 'L8 Letzte 20 eingesetzt -> Rettungsbonus 20');
commit;

-- Zu wenig Sterne: Booster wird abgelehnt, normales Spiel geht weiter.
update public.profiles set free_stars = 15 where id = :'gina';
begin;
select t.login(:'gina');
set local role authenticated;
select t.expect_error($$insert into public.tips (id, user_id, match_id, predicted_home_score, predicted_away_score, stake, submitted_at)
  values ('bo-g-b1', '00000000-0000-0000-0000-0000000000f2', 'bo-b1', 1, 0, 20, now())$$, 'L9 Booster mit 15 Sternen abgelehnt');
insert into public.tips (id, user_id, match_id, predicted_home_score, predicted_away_score, stake, submitted_at)
values ('bo-g-normal', :'gina', 'bo-normal', 2, 1, 20, now());
select t.eq(t.stars(:'gina'), 15, 'L10 Gina: Sterne unverändert, normaler Tipp gespeichert');
select t.eq((select count(*)::int from public.tips where user_id = :'gina'), 1, 'L11 Gina: nur der normale Tipp');
commit;

-- ============================================================================
-- M) Auswertung
-- ============================================================================
select t.finish('bo-alt', 1, 0);
select t.eq((select result_tier || '/' || stars_delta || '/' || rang_delta from public.tips where id = 'bo-t-alt'),
  'exakt/10/10', 'M1 Alter Tipp exakt: alte Regel x1,5 (+10)');
select t.finish('bo-normal', 2, 1);
select t.eq((select result_tier || '/' || stars_delta || '/' || rang_delta from public.tips where id = 'bo-t-normal'),
  'exakt/0/10', 'M2 Normaler Tipp exakt: 0 Sterne, 10 Rangpunkte');
select t.eq((select result_tier || '/' || stars_delta || '/' || rang_delta from public.tips where id = 'bo-g-normal'),
  'exakt/0/10', 'M3 Gina normal exakt: 0 Sterne, 10 Rangpunkte');
select t.finish('bo-b1', 2, 1);
select t.eq((select result_tier || '/' || stars_delta from public.tips where id = 'bo-t-b1'), 'exakt/40', 'M4 Booster exakt: +40 netto (60 zurück)');
select t.finish('bo-b2', 1, 1);
select t.eq((select result_tier || '/' || stars_delta from public.tips where id = 'bo-t-b2'), 'tendenz/0', 'M5 Booster Tendenz: Einsatz zurück');
select t.finish('bo-b3', 0, 2);
select t.eq((select result_tier || '/' || stars_delta from public.tips where id = 'bo-t-b3'), 'falsch/-10', 'M6 Booster 1X2 falsch: Hälfte zurück');
select t.finish('bo-b4', 1, 0);
select t.eq((select result_tier || '/' || stars_delta from public.tips where id = 'bo-t-b4'), 'falsch/-10', 'M7 Booster falsch: Hälfte zurück');
-- 20 + 30 (alt) + 60 + 20 + 10 + 10 = 150
select t.eq(t.stars(:'fritz'), 150, 'M8 Fritz: Kontostand stimmt');
create table t.bsnap2 as select id, free_stars, rang_punkte from public.profiles;
select public.evaluate_match_tips(id) from public.matches where id like 'bo-%';
select t.eq((select count(*)::int from (select id, free_stars, rang_punkte from public.profiles except select * from t.bsnap2) x), 0,
  'M9 Nochmal auswerten bucht nichts doppelt');

-- ============================================================================
-- N) Tagesbonus mit Obergrenze 500
-- ============================================================================
update public.profiles set free_stars = 495, last_claimed_at = null, pass_xp = 0 where id = :'gina';
begin;
select t.login(:'gina');
set local role authenticated;
select t.eq((public.claim_daily_bonus() ->> 'stars_added')::int, 5, 'N1 Bei 495: nur +5');
commit;
select t.eq(t.stars(:'gina'), 500, 'N2 Gina: 500');
select t.eq((select pass_xp from public.profiles where id = :'gina'), 100, 'N3 XP trotzdem +100');
update public.profiles set free_stars = 640, last_claimed_at = null where id = :'gina';
begin;
select t.login(:'gina');
set local role authenticated;
select t.eq((public.claim_daily_bonus() ->> 'stars_added')::int, 0, 'N4 Über 500: keine Sterne');
commit;
select t.eq(t.stars(:'gina'), 640, 'N5 Über 500: nichts weggenommen');
select t.eq((select pass_xp from public.profiles where id = :'gina'), 200, 'N6 XP +100');
update public.profiles set free_stars = 100, last_claimed_at = null where id = :'gina';
begin;
select t.login(:'gina');
set local role authenticated;
select t.eq((public.claim_daily_bonus() ->> 'stars_added')::int, 8, 'N7 Normal: +8');
commit;

\echo BOOSTER-TESTS GRÜN
