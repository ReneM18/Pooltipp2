-- Tests für supabase/dranbleiben.sql (nur Test-Datenbank). Läuft nach
-- profil-sync-test.sql (nutzt t.ruser/t.u/t.rtip/t.call), siehe run.sh.
\set ON_ERROR_STOP 1

create table t.drsnap_profiles as select id, free_stars, rang_punkte, pass_xp, streak_count, last_tip_date, claimed_milestones from public.profiles;
create table t.drsnap_tips as select id, user_id, match_id, predicted_home_score, predicted_away_score, stake, evaluated, rang_delta from public.tips;
create table t.drsnap_extras as select id, photos, photo_visibility, rank_icon_id, frame_colors, season_design_off, premium_trial from public.profile_extras;
set client_min_messages = warning;
\o /dev/null
\i supabase/dranbleiben.sql
\i supabase/dranbleiben.sql
\o
set client_min_messages = notice;
select t.eq((select count(*)::int from (select * from t.drsnap_profiles except
  select id, free_stars, rang_punkte, pass_xp, streak_count, last_tip_date, claimed_milestones from public.profiles) x), 0, 'DA1 Profile (Coins, Punkte, Serien) unverändert');
select t.eq((select count(*)::int from (select * from t.drsnap_tips except
  select id, user_id, match_id, predicted_home_score, predicted_away_score, stake, evaluated, rang_delta from public.tips) x), 0, 'DA2 Alle Tipps unverändert');
select t.eq((select count(*)::int from (select * from t.drsnap_extras except
  select id, photos, photo_visibility, rank_icon_id, frame_colors, season_design_off, premium_trial from public.profile_extras) x), 0, 'DA3 Einstellungen unverändert');
select t.eq((select count(*)::int from public.profile_extras where start_done or review_seen_week is not null), 0, 'DA4 Start-Erlebnis/Rückblick am Anfang leer');
select t.eq((select count(*)::int from pg_publication_tables where pubname = 'supabase_realtime'
  and tablename = 'streak_shields'), 1, 'DA5 Sofort-Abgleich für Serien-Schutz');

-- Spieler mit Serie: letzter Tipp vor p_days Tagen, Serie p_count.
create or replace function t.serie(p_n int, p_days int, p_count int) returns void language sql as $$
  update public.profiles
  set last_tip_date = to_char((now() - make_interval(days => p_days)) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      streak_count = p_count
  where id = t.u(p_n) $$;
create or replace function t.count(p_n int) returns int language sql as $$
  select streak_count from public.profiles where id = t.u(p_n) $$;
create or replace function t.shields(p_n int) returns int language sql as $$
  select count(*)::int from public.streak_shields where user_id = t.u(p_n) $$;

select from t.ruser(90, 0) a, t.ruser(91, 0) b, t.ruser(92, 0) c, t.ruser(93, 0) d;
insert into public.matches (id, data) values
  ('dr-1', t.match('dr-1', 'Fußball', 'score', 0, now() + interval '2 days')),
  ('dr-2', t.match('dr-2', 'Fußball', 'score', 0, now() + interval '2 days')),
  ('dr-3', t.match('dr-3', 'Fußball', 'score', 0, now() + interval '2 days'));

-- Gestern getippt: Serie läuft ganz normal weiter, kein Schutz nötig
select t.serie(90, 1, 5);
begin; select t.rtip(90, 'dr-1', 1, 0); commit;
select t.eq(t.count(90), 6, 'DB1 Gestern getippt: Serie 5 -> 6');
select t.eq(t.shields(90), 0, 'DB2 Kein Serien-Schutz verbraucht');

-- Einen Tag ausgelassen: der Schutz hält die Serie, Meilenstein 3 Tage gibt Coins
select t.serie(91, 2, 2);
begin; select t.rtip(91, 'dr-1', 1, 0); commit;
select t.eq(t.count(91), 3, 'DC1 Ein Tag ausgelassen: Serie 2 -> 3 (Schutz)');
select t.eq(t.shields(91), 1, 'DC2 Serien-Schutz für diese Woche verbraucht');
select t.eq((select missed_day from public.streak_shields where user_id = t.u(91)),
  public.pooltipp_day(now()) - 1, 'DC3 Gemerkt wird der ausgelassene Tag (gestern)');
select t.eq(t.stars(t.u(91)), 110, 'DC4 Meilenstein 3 Tage: +10 Coins wie bisher');
select t.eq((select count(*)::int from public.activity_feed where user_id = t.u(91) and text like 'Serien-Schutz%'), 1,
  'DC5 Hinweis im eigenen Verlauf');
-- Gleicher Tag nochmal: nichts doppelt
begin; select t.rtip(91, 'dr-2', 2, 0); commit;
select t.eq(t.count(91), 3, 'DC6 Zweiter Tipp am selben Tag: Serie bleibt 3');
select t.eq(t.shields(91), 1, 'DC7 Kein zweiter Schutz verbraucht');

-- Schutz dieser Woche schon weg: Serie beginnt wieder bei 1
select t.serie(91, 2, 3);
begin; select t.rtip(91, 'dr-3', 1, 1); commit;
select t.eq(t.count(91), 1, 'DD1 Schutz schon verbraucht: Serie startet neu');
select t.eq(t.shields(91), 1, 'DD2 Weiterhin nur ein Schutz pro Woche');

-- Zwei Tage ausgelassen: kein Schutz, Serie startet neu
select t.serie(92, 3, 7);
begin; select t.rtip(92, 'dr-1', 1, 0); commit;
select t.eq(t.count(92), 1, 'DE1 Zwei Tage ausgelassen: Serie startet neu');
select t.eq(t.shields(92), 0, 'DE2 Kein Schutz verbraucht');

-- Erster Tipp überhaupt
begin; select t.rtip(93, 'dr-1', 0, 0); commit;
select t.eq(t.count(93), 1, 'DF1 Erster Tipp: Serie 1');
select t.eq(t.shields(93), 0, 'DF2 Kein Schutz verbraucht');

-- Rechte: Schutz kann man nicht selbst eintragen, fremde nicht lesen
select t.expect_error($$select t.call(t.u(92), 'insert into public.streak_shields (user_id, week_start, missed_day) values (''' || t.u(92) || ''', current_date, current_date) returning null::jsonb')$$,
  'DG1 Serien-Schutz nicht selbst eintragbar');
select t.eq(t.call(t.u(91), 'select count(*)::int::text::jsonb from public.streak_shields'), '1'::jsonb, 'DG2 Eigenen Schutz lesen');
select t.eq(t.call(t.u(92), 'select count(*)::int::text::jsonb from public.streak_shields'), '0'::jsonb, 'DG3 Fremden Schutz nicht lesen');
begin;
set local role anon;
select t.expect_error('select 1 from public.streak_shields', 'DG4 Ohne Login: kein Zugriff');
commit;

-- Einstellungen: jedes Gerät schreibt nur sein Feld
begin;
select t.login(t.u(90));
set local role authenticated;
insert into public.profile_extras (id, start_done) values (t.u(90), true)
on conflict (id) do update set start_done = excluded.start_done;
insert into public.profile_extras (id, review_seen_week) values (t.u(90), '2026-09-28')
on conflict (id) do update set review_seen_week = excluded.review_seen_week;
commit;
select t.eq((select start_done::text || ' ' || review_seen_week from public.profile_extras where id = t.u(90)),
  'true 2026-09-28', 'DH1 Start-Erlebnis und Rückblick fürs Konto gespeichert');
select t.eq(t.call(t.u(91), 'select count(*)::int::text::jsonb from public.profile_extras where id = ''' || t.u(90) || ''''),
  '0'::jsonb, 'DH2 Fremde Einstellungen nicht lesbar');

\echo DRANBLEIBEN-TESTS GRÜN
