-- Tests für supabase/trainingstaschen.sql (nur Test-Datenbank). Läuft nach
-- dranbleiben-test.sql (nutzt t.call/t.ruser/t.rtip/t.finish), siehe run.sh.
\set ON_ERROR_STOP 1
\set rene '00000000-0000-0000-0000-00000000000a'

-- ============================================================================
-- A) Einspielen: nichts Bestehendes ändert sich
-- ============================================================================
create table t.tasnap as select id, free_stars, rang_punkte, pass_xp, pause_jokers, streak_count, claimed_milestones from public.profiles;
create table t.tasnap_tips as select id, user_id, match_id, predicted_home_score, predicted_away_score, stake, joker, evaluated, stars_delta from public.tips;
create table t.tasnap_joker as select * from public.joker_vorrat;
set client_min_messages = warning;
\o /dev/null
\i supabase/trainingstaschen.sql
\i supabase/trainingstaschen.sql
\o
set client_min_messages = notice;
select t.eq((select count(*)::int from (select * from t.tasnap except
  select id, free_stars, rang_punkte, pass_xp, pause_jokers, streak_count, claimed_milestones from public.profiles) x), 0,
  'TA1 Profile (Coins, Punkte, XP, Pause-Joker, Serien) unverändert');
select t.eq((select count(*)::int from (select * from t.tasnap_tips except
  select id, user_id, match_id, predicted_home_score, predicted_away_score, stake, joker, evaluated, stars_delta from public.tips) x), 0,
  'TA2 Alle Tipps unverändert');
select t.eq((select count(*)::int from (select * from t.tasnap_joker except select * from public.joker_vorrat) x), 0, 'TA3 Joker-Vorrat unverändert');
select t.eq((select count(*)::int from public.tips where gutschein), 0, 'TA4 Kein alter Tipp hat einen Gutschein');
select t.eq((select count(*)::int from pg_publication_tables where pubname = 'supabase_realtime'
  and tablename in ('booster_gutscheine', 'taschen_kaeufe')), 2, 'TA5 Sofort-Abgleich für Gutscheine und Taschen');

create or replace function t.gut(p_user uuid) returns int language sql as $$
  select coalesce((select anzahl from public.booster_gutscheine where user_id = p_user), 0) $$;
create or replace function t.pause(p_user uuid) returns int language sql as $$
  select pause_jokers from public.profiles where id = p_user $$;
create or replace function t.xp(p_user uuid) returns int language sql as $$
  select pass_xp from public.profiles where id = p_user $$;
grant execute on all functions in schema t to authenticated, anon;

select from t.ruser(80, 0) a, t.ruser(81, 0) b, t.ruser(82, 0) c, t.ruser(83, 0) d;
select from t.call(:'rene', 'select to_jsonb(public.set_shop_open(false))') a;

-- ============================================================================
-- B) Gesperrt, zu wenig Coins, Wochen-Grenze
-- ============================================================================
update public.profiles set free_stars = 2000, pause_jokers = 0 where id in (t.u(80), t.u(81), t.u(82), t.u(83));
select t.expect_error(format('select t.call(%L, %L)', t.u(80), 'select public.buy_tasche(''training'')'), 'TB1 Shop gesperrt: Spieler kann nicht kaufen');
select t.eq(t.stars(t.u(80)), 2000, 'TB2 Nichts abgebucht');
select from t.call(:'rene', 'select to_jsonb(public.set_shop_open(true))') a;

update public.profiles set free_stars = 100 where id = t.u(83);
select t.expect_error(format('select t.call(%L, %L)', t.u(83), 'select public.buy_tasche(''training'')'), 'TB3 Zu wenig Coins');
select t.eq(t.stars(t.u(83)), 100, 'TB4 Bei zu wenig Coins nichts abgebucht');
select t.expect_error(format('select t.call(%L, %L)', t.u(80), 'select public.buy_tasche(''gold'')'), 'TB5 Unbekannte Tasche');

-- ============================================================================
-- C) Profi-Tasche: Pause-Joker + Tag nachholen, sicher
-- ============================================================================
update public.profiles set pass_xp = 500 where id = t.u(80);
select t.eq(t.call(t.u(80), 'select public.buy_tasche(''profi'')') -> 'inhalt',
  '[{"art": "pause", "menge": 1}, {"art": "tag", "menge": 100}]'::jsonb, 'TC1 Profi-Tasche: Pause-Joker + Tag nachholen');
select t.eq(t.stars(t.u(80)), 1200, 'TC2 800 Coins abgebucht');
select t.eq(t.pause(t.u(80)), 1, 'TC3 Pause-Joker im Vorrat');
select t.eq(t.xp(t.u(80)), 600, 'TC4 +100 Saison-XP');
select t.eq(t.call(t.u(80), 'select public.my_taschen()') - 'shop_open',
  '{"gutscheine": 0, "woche_gekauft": true, "tage_saison": 1, "pause": 1}'::jsonb, 'TC5 my_taschen: Woche gekauft, 1 Tag in der Saison');
select t.eq((select count(*)::int from public.taschen_kaeufe where user_id = t.u(80)), 1, 'TC6 Kauf protokolliert');
select t.expect_error(format('select t.call(%L, %L)', t.u(80), 'select public.buy_tasche(''training'')'), 'TC7 Zweite Tasche in derselben Woche geht nicht');
select t.eq(t.stars(t.u(80)), 1200, 'TC8 Zweiter Versuch bucht nichts ab');
select t.eq(t.call(t.u(81), 'select public.my_taschen()') ->> 'woche_gekauft', 'false', 'TC9 Anderer Spieler: Woche noch frei');

-- Letzte Woche gekauft zählt nicht für diese Woche
update public.taschen_kaeufe set woche = woche - 7 where user_id = t.u(80);
select t.eq(t.call(t.u(80), 'select public.my_taschen()') ->> 'woche_gekauft', 'false', 'TC10 Neue Woche: wieder frei');

-- ============================================================================
-- D) Grenzen voll: stattdessen Booster-Gutschein
-- ============================================================================
update public.profiles set pause_jokers = 2 where id = t.u(81);
insert into public.taschen_kaeufe (user_id, tasche, preis, woche, saison, inhalt)
select t.u(81), 'matchtag', 400, current_date - 30, (select coalesce(to_jsonb(p) ->> 'pass_season_id', 'herbst-2026') from public.profiles p where id = t.u(81)),
  '[{"art": "tag", "menge": 100}]'::jsonb
from generate_series(1, 3);
select t.eq(t.call(t.u(81), 'select public.buy_tasche(''profi'')') -> 'inhalt',
  '[{"art": "gutschein", "menge": 1}, {"art": "gutschein", "menge": 1}]'::jsonb, 'TD1 Pause-Vorrat voll + 3 Tage nachgeholt: 2 Gutscheine');
select t.eq(t.pause(t.u(81)), 2, 'TD2 Pause-Joker bleibt bei 2');
select t.eq(t.gut(t.u(81)), 2, 'TD3 2 Gutscheine im Vorrat');
select t.eq(t.call(t.u(81), 'select public.my_jokers()') ->> 'pause', '2', 'TD4 Joker-Shop zeigt weiter 2 Pause-Joker');

-- ============================================================================
-- E) Zufall: Admin testet viele Trainings- und Matchtag-Taschen (gesperrter
--    Shop = keine Wochen-Grenze für den Admin)
-- ============================================================================
select from t.call(:'rene', 'select to_jsonb(public.set_shop_open(false))') a;
create table t.ziehung (tasche text, inhalt jsonb);
do $$
declare i int;
begin
  for i in 1..400 loop
    update public.profiles set free_stars = 5000, pause_jokers = 0 where id = '00000000-0000-0000-0000-00000000000a';
    delete from public.taschen_kaeufe where user_id = '00000000-0000-0000-0000-00000000000a';
    insert into t.ziehung values ('training', t.call('00000000-0000-0000-0000-00000000000a', 'select public.buy_tasche(''training'')') -> 'inhalt');
    insert into t.ziehung values ('matchtag', t.call('00000000-0000-0000-0000-00000000000a', 'select public.buy_tasche(''matchtag'')') -> 'inhalt');
  end loop;
end $$;
select t.eq((select count(*)::int from t.ziehung where jsonb_array_length(inhalt) <> 1), 0, 'TE1 Training/Matchtag: immer genau 1 Stück');
select t.eq((select count(*)::int from t.ziehung where tasche = 'training' and inhalt -> 0 ->> 'art' = 'coins'
  and ((inhalt -> 0 ->> 'menge')::int not between 60 and 100 or (inhalt -> 0 ->> 'menge')::int % 10 <> 0)), 0, 'TE2 Coins zurück: 60 bis 100');
select t.eq((select count(*)::int from t.ziehung where tasche = 'matchtag' and inhalt -> 0 ->> 'art' = 'coins'
  and (inhalt -> 0 ->> 'menge')::int <> 200), 0, 'TE3 Matchtag: 200 Coins zurück');
select t.eq((select count(*)::int from t.ziehung where tasche = 'matchtag' and inhalt -> 0 ->> 'art' = 'gutschein'
  and (inhalt -> 0 ->> 'menge')::int <> 2), 0, 'TE4 Matchtag: 2 Gutscheine');
select t.eq((select bool_and(n between lo and hi) from (
  select count(*) filter (where inhalt -> 0 ->> 'art' = 'coins') n, 140 lo, 260 hi from t.ziehung where tasche = 'training'
  union all select count(*) filter (where inhalt -> 0 ->> 'art' = 'gutschein'), 90, 190 from t.ziehung where tasche = 'training'
  union all select count(*) filter (where inhalt -> 0 ->> 'art' = 'pause'), 20, 80 from t.ziehung where tasche = 'training'
  union all select count(*) filter (where inhalt -> 0 ->> 'art' = 'pause'), 110, 210 from t.ziehung where tasche = 'matchtag'
) x), true, 'TE5 Verteilung passt zu den Chancen (50/35/12/3 und 40/30/15/15)');
\echo Verteilung (400 je Tasche):
select tasche || ' ' || (inhalt -> 0 ->> 'art') || ': ' || count(*) from t.ziehung group by tasche, inhalt -> 0 ->> 'art' order by 1;

-- ============================================================================
-- F) Booster-Gutschein beim Tippen
-- ============================================================================
update public.profiles set free_stars = 0, rescue_bonus_used = true where id = t.u(82);
insert into public.booster_gutscheine (user_id, anzahl) values (t.u(82), 1)
on conflict (user_id) do update set anzahl = 1;
insert into public.matches (id, data) values
  ('ts-b1', t.match('ts-b1', 'Fußball', 'score', 20, now() + interval '1 day') || '{"booster":true}'),
  ('ts-b2', t.match('ts-b2', 'Fußball', 'score', 20, now() + interval '1 day') || '{"booster":true}'),
  ('ts-b3', t.match('ts-b3', 'Fußball', 'score', 20, now() + interval '1 day') || '{"booster":true}');

begin; select from t.rtip(82, 'ts-b1', 2, 1) a; commit;
select t.eq((select stake || ' ' || booster || ' ' || gutschein from public.tips where id = 'ts-b1-82'), '20 true true',
  'TF1 Booster-Tipp mit Gutschein trotz 0 Coins');
select t.eq(t.stars(t.u(82)), 0, 'TF2 Keine Coins abgebucht');
select t.eq(t.gut(t.u(82)), 0, 'TF3 Gutschein verbraucht');

-- Browser darf den Merker nicht ändern
begin;
select from t.login(t.u(82)) a;
set local role authenticated;
update public.tips set gutschein = false where id = 'ts-b1-82';
commit;
select t.eq((select gutschein from public.tips where id = 'ts-b1-82'), true, 'TF4 Browser kann den Gutschein-Merker nicht ändern');

-- Zurücknehmen: Gutschein zurück, keine Coins dazu
select t.eq(t.call(t.u(82), 'select public.withdraw_tip(''ts-b1'')') ->> 'withdrawn', 'true', 'TF5 Tipp zurückgenommen');
select t.eq(t.stars(t.u(82)), 0, 'TF6 Zurücknehmen bringt keine Coins (war ja gratis)');
select t.eq(t.gut(t.u(82)), 1, 'TF7 Gutschein wieder da');

-- Spiel abgesagt: Gutschein zurück, keine Coins dazu
begin; select from t.rtip(82, 'ts-b2', 1, 1) a; commit;
select t.eq(t.gut(t.u(82)), 0, 'TF8 Gutschein für zweiten Tipp verbraucht');
select from t.call(:'rene', 'select to_jsonb(public.cancel_match(''ts-b2''))') a;
select t.eq(t.stars(t.u(82)), 0, 'TF9 Absage bringt keine Coins');
select t.eq(t.gut(t.u(82)), 1, 'TF10 Absage gibt den Gutschein zurück');

-- Auswertung: Gewinn wie bei jedem Booster-Tipp (exakt = 60)
begin; select from t.rtip(82, 'ts-b3', 2, 1) a; commit;
select t.finish('ts-b3', 2, 1);
select from public.evaluate_match_tips('ts-b3') a;
select t.eq(t.stars(t.u(82)), 40, 'TF11 Exakt mit Gutschein: +40 Coins (Gewinn wie immer, nichts bezahlt)');
select from public.evaluate_match_tips('ts-b3') a;
select t.eq(t.stars(t.u(82)), 40, 'TF12 Zweite Auswertung bucht nichts doppelt');
select t.eq((select stars_delta from public.tips where id = 'ts-b3-82'), 40, 'TF12b Gespeicherter Gewinn +40');
-- Endstand korrigiert (Konto hat inzwischen 100: 60 andere + 40 aus dem Tipp):
-- daneben -> der Tipp kostet mit Gutschein nichts, die 40 gehen wieder weg
update public.profiles set free_stars = 100 where id = t.u(82);
select t.finish('ts-b3', 0, 3);
select from public.evaluate_match_tips('ts-b3') a;
select t.eq(t.stars(t.u(82)), 60, 'TF12c Korrektur auf falsch: Tipp bringt 0, kein Minus, keine Coins geschenkt');
-- Korrigiert auf Tendenz (Heimsieg, andere Differenz): 0
select t.finish('ts-b3', 4, 1);
select from public.evaluate_match_tips('ts-b3') a;
select t.eq(t.stars(t.u(82)), 60, 'TF12d Tendenz mit Gutschein: 0');
-- Korrigiert auf Tordifferenz: +10
select t.finish('ts-b3', 3, 2);
select from public.evaluate_match_tips('ts-b3') a;
select t.eq(t.stars(t.u(82)), 70, 'TF12e Tordifferenz mit Gutschein: +10');
select t.finish('ts-b3', 2, 1);
select from public.evaluate_match_tips('ts-b3') a;
select t.eq(t.stars(t.u(82)), 100, 'TF12f Zurück auf exakt: +40');

-- Ohne Gutschein: wie bisher 20 Coins
update public.profiles set free_stars = 100 where id = t.u(83);
insert into public.matches (id, data) values
  ('ts-b4', t.match('ts-b4', 'Fußball', 'score', 20, now() + interval '1 day') || '{"booster":true}');
begin; select from t.rtip(83, 'ts-b4', 0, 0) a; commit;
select t.eq((select stake || ' ' || gutschein from public.tips where id = 'ts-b4-83'), '20 false', 'TF13 Ohne Gutschein: normaler Einsatz');
select t.eq(t.stars(t.u(83)), 80, 'TF14 Ohne Gutschein: 20 Coins abgebucht');

-- ============================================================================
-- G) Lesen nur eigene Daten
-- ============================================================================
select t.eq(t.call(t.u(83), 'select to_jsonb(count(*)) from public.taschen_kaeufe'), '0'::jsonb, 'TG1 Fremde Taschen nicht lesbar');
select t.eq(t.call(t.u(83), 'select to_jsonb(count(*)) from public.booster_gutscheine'), '0'::jsonb, 'TG2 Fremde Gutscheine nicht lesbar');
select t.expect_error(format('select t.call(%L, %L)', t.u(83),
  'insert into public.booster_gutscheine (user_id, anzahl) values (auth.uid(), 9) returning to_jsonb(anzahl)'), 'TG3 Gutscheine selbst eintragen verboten');

\echo TRAININGSTASCHEN-TESTS GRÜN
