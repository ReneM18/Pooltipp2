-- Tests für supabase/wochensieger.sql (nur Test-Datenbank). Läuft am Ende
-- von run.sh (nutzt t.eq/t.call/t.ruser/t.u aus den früheren Tests).
\set ON_ERROR_STOP 1

create table t.wsnap as select id, free_stars, rang_punkte, pass_xp from public.profiles;
set client_min_messages = warning;
\o /dev/null
\i supabase/wochensieger.sql
\i supabase/wochensieger.sql
\o
set client_min_messages = notice;
select t.eq((select count(*)::int from (select * from t.wsnap except
  select id, free_stars, rang_punkte, pass_xp from public.profiles) x), 0, 'WS1 Einspielen ändert keine Profile');
select t.eq((select count(*)::int from pg_publication_tables where pubname = 'supabase_realtime'
  and tablename = 'weekly_winners'), 1, 'WS2 Sofort-Abgleich für Wochensieger');

-- Spieler 90-94, Tipps in drei Wochen (Montag-Daten relativ zu heute).
select from t.ruser(90, 0) a, t.ruser(91, 0) b, t.ruser(92, 0) c, t.ruser(93, 0) d, t.ruser(94, 0) e;
update public.profiles set pass_xp = 1000, free_stars = 100 where id in (t.u(90), t.u(91), t.u(92), t.u(93), t.u(94));
create or replace function t.monday(p_weeks_ago int) returns date language sql as $$
  select (now() at time zone 'Europe/Vienna')::date - (extract(isodow from now() at time zone 'Europe/Vienna')::int - 1) - 7 * p_weeks_ago $$;
create or replace function t.wtip(p_n int, p_id text, p_at timestamptz, p_booked int, p_eval boolean default true,
  p_sport text default 'Fußball') returns void language sql as $$
  insert into public.tips (id, user_id, match_id, predicted_home_score, predicted_away_score, stake, submitted_at,
                           evaluated, rang_delta, rang_booked, ranking_legacy)
  values (p_id, t.u(p_n), 'ws-' || p_sport, 1, 0, 0, p_at, p_eval, p_booked, p_booked, false) $$;
create or replace function t.at(p_monday date, p_day int, p_time time) returns timestamptz language sql as $$
  select (p_monday + p_day + p_time) at time zone 'Europe/Vienna' $$;
-- Tipps direkt anlegen, ohne die Tipp-Schutz-Trigger (Spiele gibt es hier nicht).
set session_replication_role = replica;
update public.weekly_winner_settings set first_week = t.monday(3) + 2;  -- Mittwoch: zählt ab dem Montag davor

-- Woche -3: 90 und 91 gleichauf (verschiedene Sportarten zusammengezählt), 92 dahinter.
select t.wtip(90, 'ws3a', t.at(t.monday(3), 0, '00:00'), 12),
       t.wtip(90, 'ws3b', t.at(t.monday(3), 3, '12:00'), 8, true, 'NHL'),
       t.wtip(91, 'ws3c', t.at(t.monday(3), 6, '23:59'), 20, true, 'NFL'),
       t.wtip(92, 'ws3d', t.at(t.monday(3), 2, '12:00'), 5),
       t.wtip(93, 'ws3e', t.at(t.monday(3), 7, '00:00'), 50),   -- Montag danach: gehört zu Woche -2
       t.wtip(94, 'ws3f', t.at(t.monday(3), 1, '12:00'), 99, false); -- nicht ausgewertet: zählt nicht
-- Woche -2: nur 2 Spieler (93 aus Woche -3 rübergerutscht + 94) -> kein Sieger
select t.wtip(94, 'ws2a', t.at(t.monday(2), 1, '12:00'), 3);
-- Woche -1: 3 Spieler, alle 0 oder Minus -> kein Sieger
select t.wtip(90, 'ws1a', t.at(t.monday(1), 1, '12:00'), 0),
       t.wtip(91, 'ws1b', t.at(t.monday(1), 1, '12:00'), -3),
       t.wtip(92, 'ws1c', t.at(t.monday(1), 1, '12:00'), 0);
-- Diese Woche: noch nicht fertig
select t.wtip(92, 'ws0a', t.at(t.monday(0), 0, '12:00'), 40),
       t.wtip(93, 'ws0b', t.at(t.monday(0), 0, '12:00'), 1),
       t.wtip(94, 'ws0c', t.at(t.monday(0), 0, '12:00'), 1);

set session_replication_role = origin;

select t.expect_error('select public.settle_weekly_winners()', 'WS3 Ohne Login nicht aufrufbar');
select t.eq((t.call(t.u(94), 'select to_jsonb(public.settle_weekly_winners())'))::int, 2, 'WS4 Zwei Sieger ausgezahlt (Gleichstand)');
select t.eq((select pass_xp from public.profiles where id = t.u(90)), 1050, 'WS5 Sieger 90: +50 XP');
select t.eq((select pass_xp from public.profiles where id = t.u(91)), 1050, 'WS6 Sieger 91 (Gleichstand): +50 XP');
select t.eq((select pass_xp from public.profiles where id = t.u(92)), 1000, 'WS7 Zweiter bekommt nichts');
select t.eq((select pass_xp from public.profiles where id = t.u(93)) + (select pass_xp from public.profiles where id = t.u(94)), 2000,
  'WS8 Woche mit nur 2 Spielern: niemand bekommt XP');
select t.eq((select count(*)::int from public.weekly_winners), 2, 'WS9 Woche mit 0 Punkten oben: kein Sieger');
select t.eq((select free_stars from public.profiles where id = t.u(90)), 100, 'WS10 Nie Coins');
select t.eq((select string_agg(week_start::text || ':' || players, ',' order by week_start) from public.weekly_winner_weeks),
  t.monday(3) || ':3,' || t.monday(2) || ':2,' || t.monday(1) || ':3', 'WS11 Drei fertige Wochen erledigt, diese Woche nicht');
select t.eq((select count(*)::int from public.activity_feed where user_id = t.u(90) and icon = '🥇'), 1, 'WS12 Aktivität für den Sieger');

-- Nochmal aufrufen (anderes Gerät/Spieler): nichts doppelt
select t.eq((t.call(t.u(92), 'select to_jsonb(public.settle_weekly_winners())'))::int, 0, 'WS13 Zweiter Aufruf zahlt nichts doppelt');
select t.eq((select pass_xp from public.profiles where id = t.u(90)), 1050, 'WS14 XP unverändert nach zweitem Aufruf');

-- Browser darf nichts schreiben
select t.expect_error(format('select t.call(%L, %L)', t.u(92),
  'insert into public.weekly_winners (week_start, user_id, points, players, xp) values (current_date, auth.uid(), 1, 1, 50) returning 1'),
  'WS15 Browser kann sich nicht selbst als Sieger eintragen');
select t.expect_error(format('select t.call(%L, %L)', t.u(92), 'update public.weekly_winner_settings set xp = 5000 returning 1'),
  'WS16 Browser kann die Regeln nicht ändern');
select t.expect_error(format('select t.call(%L, %L)', t.u(92), 'select to_jsonb(count(*)) from public.weekly_points(now() - interval ''1 year'', now())'),
  'WS17 Hilfsfunktion nicht direkt aufrufbar');
select t.eq((t.call(t.u(92), 'select to_jsonb(count(*)) from public.weekly_winners'))::int, 2, 'WS18 Sieger für alle lesbar');
