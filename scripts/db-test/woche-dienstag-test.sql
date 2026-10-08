-- Tests für supabase/woche-dienstag.sql (nur Test-Datenbank). Läuft nach
-- wochensieger-test.sql (nutzt t.eq/t.call/t.ruser/t.u).
\set ON_ERROR_STOP 1

-- Frisch anfangen: Wochen/Sieger aus dem vorigen Test weg, XP zurücksetzen.
delete from public.weekly_winners;
delete from public.weekly_winner_weeks;
delete from public.tips where id like 'ws%';
update public.weekly_winner_settings set first_week = date '2026-10-05', min_players = 3, xp = 50;
update public.profiles set pass_xp = 1000, free_stars = 100 where id in (t.u(90), t.u(91), t.u(92), t.u(93), t.u(94));

set client_min_messages = warning;
\o /dev/null
\i supabase/woche-dienstag.sql
\i supabase/woche-dienstag.sql
\o
set client_min_messages = notice;
select t.eq((select first_week from public.weekly_winner_settings), date '2026-10-06', 'WD1 Erste Woche ist Dienstag 6.10.');

-- Dienstag der Woche (0 = aktuelle Woche, 1 = Vorwoche ...), Wiener Zeit, Wechsel 8:00.
create or replace function t.tuesday(p_weeks_ago int) returns date language sql as $$
  select (v.d - ((extract(isodow from v.d)::int - 2 + 7) % 7) - case
           when extract(isodow from v.d) = 2 and v.h < 8 then 7 else 0 end - 7 * p_weeks_ago)::date
  from (select (now() at time zone 'Europe/Vienna')::date d, extract(hour from now() at time zone 'Europe/Vienna') h) v $$;
update public.weekly_winner_settings set first_week = t.tuesday(2) - 1;  -- Montag davor: wird auf Dienstag ausgerichtet
create or replace function t.vat(p_day date, p_time time) returns timestamptz language sql as $$
  select (p_day + p_time) at time zone 'Europe/Vienna' $$;
create or replace function t.game(p_id text, p_kickoff timestamptz) returns void language sql as $$
  insert into public.matches (id, data) values (p_id, jsonb_build_object('id', p_id, 'kickoff', p_kickoff))
  on conflict (id) do update set data = excluded.data $$;
create or replace function t.gtip(p_n int, p_id text, p_match text, p_submitted timestamptz, p_base int,
  p_eval boolean default true, p_bonus int default 0) returns void language sql as $$
  insert into public.tips (id, user_id, match_id, predicted_home_score, predicted_away_score, stake, submitted_at,
                           evaluated, base_points, bonus_points, rang_delta, rang_booked, ranking_legacy)
  values (p_id, t.u(p_n), p_match, 1, 0, 0, p_submitted, p_eval, p_base, p_bonus, p_base + p_bonus, p_base + p_bonus, false) $$;

set session_replication_role = replica;
-- Woche -2: Sunday Night (Montag 2:20) und Monday Night (Dienstag 2:15) gehören noch dazu.
select t.game('wd-snf', t.vat(t.tuesday(2) + 6, '02:20')),
       t.game('wd-mnf', t.vat(t.tuesday(2) + 7, '02:15')),
       t.game('wd-tnf', t.vat(t.tuesday(2) + 2, '02:15')),
       t.game('wd-spaet', t.vat(t.tuesday(2) + 7, '08:00')),     -- genau Dienstag 8:00: schon nächste Woche
       t.game('wd-naechste', t.vat(t.tuesday(1) + 4, '20:00'));
-- 90: 10 + 10 (SNF + MNF, beide früh abgegeben), 91: 7 + 7, 92: 5 + 10 Bonus
select t.gtip(90, 'wd1', 'wd-snf', t.vat(t.tuesday(3) + 3, '12:00'), 10),  -- Abgabe in der Woche davor: zählt trotzdem hier
       t.gtip(90, 'wd2', 'wd-mnf', t.vat(t.tuesday(2), '09:00'), 10),
       t.gtip(91, 'wd3', 'wd-tnf', t.vat(t.tuesday(2), '09:00'), 7),
       t.gtip(91, 'wd4', 'wd-mnf', t.vat(t.tuesday(2), '09:00'), 7),
       t.gtip(92, 'wd5', 'wd-snf', t.vat(t.tuesday(2), '09:00'), 5, true, 10),
       t.gtip(93, 'wd6', 'wd-spaet', t.vat(t.tuesday(2), '09:00'), 10),       -- zählt in Woche -1
       t.gtip(93, 'wd7', 'wd-naechste', t.vat(t.tuesday(2) + 1, '09:00'), 10); -- zählt in Woche -1
-- Woche -1: 93 (20), 94 (3), 90 (0) und ein noch NICHT ausgewertetes Spiel von 94
select t.game('wd-w1', t.vat(t.tuesday(1) + 2, '20:00')),
       t.game('wd-offen', t.vat(t.tuesday(1) + 5, '20:00'));
select t.gtip(94, 'wd8', 'wd-w1', t.vat(t.tuesday(1), '10:00'), 3),
       t.gtip(90, 'wd9', 'wd-w1', t.vat(t.tuesday(1), '10:00'), 0),
       t.gtip(94, 'wd10', 'wd-offen', t.vat(t.tuesday(1), '10:00'), null, false);
set session_replication_role = origin;

select t.eq((t.call(t.u(92), 'select coalesce(jsonb_agg(jsonb_build_array(user_id, points) order by points desc), ''[]'') from public.weekly_points(' ||
  quote_literal(t.vat(t.tuesday(2), '08:00')) || ', ' || quote_literal(t.vat(t.tuesday(1), '08:00')) || ')')),
  jsonb_build_array(jsonb_build_array(t.u(90), 20), jsonb_build_array(t.u(91), 14), jsonb_build_array(t.u(92), 5)),
  'WD2 Woche nach Anpfiff: SNF + MNF zählen, Dienstag 8:00 nicht mehr, ohne Bonus');
select t.eq((t.call(t.u(92), 'select to_jsonb(count(*)) from public.weekly_points(now() - interval ''1 day'', now())'))::int >= 0, true,
  'WD3 Rangliste darf die Wochensummen lesen');

-- Heute: Woche -2 ist fertig (> 1 Tag nach Ende), Woche -1 erst, wenn sie
-- 1 Tag vorbei ist und nichts mehr offen ist (bzw. nach 3 Tagen).
select t.eq((t.call(t.u(94), 'select to_jsonb(public.settle_weekly_winners())'))::int, 1, 'WD4 Woche -2 ausgezahlt: genau ein Sieger');
select t.eq((select pass_xp from public.profiles where id = t.u(90)), 1050, 'WD5 Sieger mit SNF + MNF: +50 XP');
select t.eq((select pass_xp from public.profiles where id = t.u(92)), 1000, 'WD6 Platz-Bonus hilft nicht');
select t.eq((select week_start from public.weekly_winners), t.tuesday(2), 'WD7 Woche beginnt am Dienstag');
select t.eq((select count(*)::int from public.weekly_winner_weeks where week_start = t.tuesday(1)),
  case when now() >= t.vat(t.tuesday(0), '08:00') + interval '3 days' then 1 else 0 end,
  'WD8 Woche mit offenem Spiel wartet (höchstens 3 Tage)');
update public.tips set evaluated = true, base_points = 0, rang_delta = 0 where id = 'wd10';
select t.eq((t.call(t.u(94), 'select to_jsonb(public.settle_weekly_winners())'))::int,
  case when now() >= t.vat(t.tuesday(0), '08:00') + interval '1 day' then 1 else 0 end,
  'WD9 Nach der Auswertung wird Woche -1 ausgezahlt (ab Mittwoch 8:00)');
select t.eq((t.call(t.u(94), 'select to_jsonb(public.settle_weekly_winners())'))::int, 0, 'WD10 Nichts doppelt');
select t.eq((select free_stars from public.profiles where id = t.u(90)), 100, 'WD11 Nie Coins');
