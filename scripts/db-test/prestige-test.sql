-- Tests für supabase/prestige.sql (nur Test-Datenbank, siehe run.sh).
\set ON_ERROR_STOP 1
create schema if not exists t;
create or replace function t.eq(p_actual anyelement, p_expected anyelement, p_label text)
returns void language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FAIL %: ist %, erwartet %', p_label, p_actual, p_expected;
  end if;
  raise notice 'ok   %', p_label;
end $$;
create or replace function t.fails(p_sql text) returns text language plpgsql as $$
begin
  execute p_sql;
  return 'kein Fehler';
exception when others then
  return sqlerrm;
end $$;
create or replace function t.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user)::text, true);
end $$;
create or replace function t.pu(p_n int) returns uuid language sql as $$
  select ('00000000-0000-0000-0000-0000000007' || lpad(p_n::text, 2, '0'))::uuid $$;
create or replace function t.puser(p_n int, p_fb int, p_nfl int) returns uuid language plpgsql as $$
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values (t.pu(p_n), 'p' || p_n || '@test.at', jsonb_build_object('display_name', 'P' || p_n)) on conflict do nothing;
  update public.profiles set display_name = 'P' || p_n,
    rang_punkte = jsonb_build_object('Fußball', p_fb, 'NFL', p_nfl, 'NBA', 5, 'NHL', 0) where id = t.pu(p_n);
  return t.pu(p_n);
end $$;
create or replace function t.ptip(p_n int, p_match text, p_home int, p_away int) returns void language plpgsql as $$
begin
  perform t.login(t.pu(p_n));
  set local role authenticated;
  insert into public.tips (id, user_id, match_id, predicted_home_score, predicted_away_score, stake, submitted_at)
  values (p_match || '-' || p_n, t.pu(p_n), p_match, p_home, p_away, 0, now());
  reset role;
end $$;
create or replace function t.pmatch(p_id text, p_sport text) returns jsonb language sql as $$
  select jsonb_build_object('id', p_id, 'sport', p_sport, 'tipMode', 'score', 'fixedStake', 0,
    'status', 'upcoming', 'liveHomeScore', null, 'liveAwayScore', null,
    'kickoff', now() + interval '1 day', 'tipDeadline', now() + interval '1 day' - interval '30 minutes',
    'homeTeamId', 'h', 'awayTeamId', 'a') $$;
create or replace function t.pfinish(p_id text, p_home int, p_away int) returns void language sql as $$
  update public.matches set data = data || jsonb_build_object('status', 'finished', 'liveHomeScore', p_home, 'liveAwayScore', p_away)
  where id = p_id $$;
create or replace function t.prang(p_user uuid, p_sport text) returns int language sql as $$
  select (rang_punkte ->> p_sport)::int from public.profiles where id = p_user $$;
grant usage on schema t to authenticated, anon;
grant execute on all functions in schema t to authenticated, anon;

-- ============================================================================
-- A) Einspielen ändert nichts am bisherigen Stand
-- ============================================================================
select from t.puser(1, 1950, 0) a, t.puser(2, 1000, 700) b, t.puser(3, 1899, 649) c;
create table t.psnap as select id, free_stars, rang_punkte, pass_xp, rank_icon_id from public.profiles;
create table t.psnap_tips as select * from public.tips;
set client_min_messages = warning;
\o /dev/null
\i supabase/prestige.sql
\i supabase/prestige.sql
\o
set client_min_messages = notice;
select t.eq((select count(*)::int from (select * from t.psnap except
  select id, free_stars, rang_punkte, pass_xp, rank_icon_id from public.profiles) x), 0, 'PA1 Profile (Punkte, Coins, XP, Icon) unverändert');
select t.eq((select count(*)::int from (select to_jsonb(s) from t.psnap_tips s except select to_jsonb(x) from public.tips x) z), 0,
  'PA2 Tipps unverändert');
select t.eq((select count(*)::int from public.profiles where prestige <> '{}'::jsonb), 0, 'PA3 Alle starten mit Prestige 0');

-- ============================================================================
-- B) Prestige gehen
-- ============================================================================
select t.eq(t.fails($$select public.go_prestige('Fußball')$$) like '%einloggen%', true, 'PB1 Ohne Login nicht möglich');
begin;
select t.login(t.pu(3));
set local role authenticated;
select t.eq(t.fails($$select public.go_prestige('Fußball')$$), 'Prestige geht erst als GOAT (ab 1900 Punkten).', 'PB2 1.899 Punkte: noch kein GOAT');
select t.eq(t.fails($$select public.go_prestige('NFL')$$), 'Prestige geht erst als GOAT (ab 650 Punkten).', 'PB3 Football 649: noch kein GOAT');
select t.eq(t.fails($$select public.go_prestige('Golf')$$), 'Unbekannte Sportart.', 'PB4 Unbekannte Sportart');
commit;
select t.eq(t.prang(t.pu(3), 'Fußball'), 1899, 'PB5 Abgelehnt: Punkte bleiben');

begin;
select t.login(t.pu(1));
set local role authenticated;
select t.eq((select public.go_prestige('Fußball')), '{"sport": "Fußball", "prestige": 1, "points_before": 1950}'::jsonb, 'PB6 Prestige 1');
commit;
select t.eq(t.prang(t.pu(1), 'Fußball'), 0, 'PB7 Fußball-Punkte auf 0');
select t.eq((select rang_punkte - 'Fußball' from public.profiles where id = t.pu(1)), '{"NFL": 0, "NBA": 5, "NHL": 0}'::jsonb,
  'PB8 Andere Sportarten unverändert');
select t.eq((select prestige from public.profiles where id = t.pu(1)), '{"Fußball": 1}'::jsonb, 'PB9 Prestige gespeichert');
select t.eq((select points_before || '/' || prestige_after from public.prestige_log where user_id = t.pu(1)), '1950/1', 'PB10 Sicherung');
select t.eq((select icon || ' ' || author_name || ': ' || text from public.activity_feed where user_id = t.pu(1) order by created_at desc limit 1),
  '⭐ P1: P1 hat in Fußball den GOAT-Rang gegen Prestige 1 eingetauscht.', 'PB11 Community-Meldung');
begin;
select t.login(t.pu(1));
set local role authenticated;
select t.eq(t.fails($$select public.go_prestige('Fußball')$$) like 'Prestige geht erst als GOAT%', true, 'PB12 Gleich nochmal geht nicht');
commit;

begin;
select t.login(t.pu(2));
set local role authenticated;
select t.eq((select public.go_prestige('NFL') ->> 'prestige'), '1', 'PB13 Football ab 650: Prestige 1');
commit;
select t.eq(t.prang(t.pu(2), 'NFL') || '/' || t.prang(t.pu(2), 'Fußball'), '0/1000', 'PB14 Nur Football auf 0');

-- ============================================================================
-- C) Schutz
-- ============================================================================
begin;
select t.login(t.pu(3));
set local role authenticated;
update public.profiles set prestige = '{"Fußball": 9}' where id = t.pu(3);
select t.eq(t.fails($$insert into public.prestige_log (user_id, sport, points_before, prestige_after) values (auth.uid(), 'Fußball', 1, 9)$$)
  like 'permission denied%', true, 'PC1 Sicherung nicht selbst beschreibbar');
select t.eq((select count(*)::int from public.prestige_log), 0, 'PC2 Fremde Sicherungen nicht lesbar');
update public.profiles set rank_icon_id = 'prestige-Fußball' where id = t.pu(3);
commit;
select t.eq((select prestige from public.profiles where id = t.pu(3)), '{}'::jsonb, 'PC3 Prestige nicht selbst änderbar');
select t.eq((select rank_icon_id from public.profiles where id = t.pu(3)), 'prestige-Fußball', 'PC4 Prestige-Abzeichen wählbar');
begin;
set local role anon;
select t.eq(t.fails($$select public.go_prestige('Fußball')$$) like 'permission denied%', true, 'PC5 Gast darf nicht');
commit;

-- ============================================================================
-- D) Bonus: Prestige-Spieler zählt weiter als "oben"
-- ============================================================================
-- P1 (0 Punkte, Prestige 1), P5 (100) und zehn Gegner mit 1.000 Punkten
-- (P10..P19) haben je 5 gewertete Tipps.
select from t.puser(5, 100, 0) e, generate_series(10, 19) g, lateral t.puser(g, 1000, 0) x;
insert into public.matches (id, data) values ('pr-alt', t.pmatch('pr-alt', 'Fußball'));
set session_replication_role = replica;
insert into public.tips (id, user_id, match_id, predicted_home_score, predicted_away_score, stake, submitted_at, evaluated, result_tier, ranking_scored)
select 'pr-alt-' || u || '-' || g, t.pu(u), 'pr-alt', 1, 0, 0, now() - interval '2 days', true, 'tendenz', true
from (select unnest(array[1, 5]) u union all select generate_series(10, 19)) us, generate_series(1, 5) g;
set session_replication_role = origin;

-- Prestige-Spieler gewinnt gegen alle zehn.
insert into public.matches (id, data) values ('pr-1', t.pmatch('pr-1', 'Fußball'));
begin;
select from t.ptip(1, 'pr-1', 2, 1) a, generate_series(10, 19) g, lateral t.ptip(g, 'pr-1', 0, 2) x;
commit;
select from t.pfinish('pr-1', 2, 1) f;
select t.eq((select rank_points_before || '/' || compare_points from public.tips where id = 'pr-1-1'),
  '0/1900', 'PD1 Vergleichswert: 0 + 1 x 1.900, echter Stand 0 bleibt gespeichert');
select t.eq((select base_points || '/' || bonus_points from public.tips where id = 'pr-1-1'), '10/5',
  'PD2 Prestige-Spieler gewinnt gegen 10: nur +1 je Gegner (Bonus +5 statt +10)');
select t.eq(t.prang(t.pu(1), 'Fußball'), 15, 'PD3 Neu gebucht: 0 + 15');

-- Gleiches Spiel ohne Prestige: P5 (100) gewinnt gegen dieselben zehn.
insert into public.matches (id, data) values ('pr-2', t.pmatch('pr-2', 'Fußball'));
begin;
select from t.ptip(5, 'pr-2', 2, 1) a, generate_series(10, 19) g, lateral t.ptip(g, 'pr-2', 0, 2) x;
commit;
select from t.pfinish('pr-2', 2, 1) f;
select t.eq((select compare_points from public.tips where id = 'pr-2-5'), 100, 'PD4 Ohne Prestige: Vergleichswert = Punktestand');
select t.eq((select base_points || '/' || bonus_points from public.tips where id = 'pr-2-5'), '10/10',
  'PD5 Ohne Prestige: Sieg gegen "oben" +2 je Gegner wie bisher (+10)');
\echo PRESTIGE GRÜN
