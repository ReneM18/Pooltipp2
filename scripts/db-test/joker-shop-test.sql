-- Tests für supabase/joker-shop.sql (nur Test-Datenbank). Läuft nach
-- rankingsystem-test.sql, siehe run.sh.
\set ON_ERROR_STOP 1

-- ============================================================================
-- A) Einspielen: nichts Bestehendes ändert sich
-- ============================================================================
create table t.jsnap as select id, free_stars, rang_punkte, pass_xp, pause_jokers from public.profiles;
create table t.jsnap_tips as select id, joker, evaluated, rang_delta, stars_delta from public.tips;
set client_min_messages = warning;
\o /dev/null
\i supabase/joker-shop.sql
\i supabase/joker-shop.sql
\o
set client_min_messages = notice;
select t.eq((select count(*)::int from (select * from t.jsnap except
  select id, free_stars, rang_punkte, pass_xp, pause_jokers from public.profiles) x), 0, 'JA1 Profile unverändert');
select t.eq((select count(*)::int from (select * from t.jsnap_tips except
  select id, joker, evaluated, rang_delta, stars_delta from public.tips) x), 0, 'JA2 Tipps unverändert');
select t.eq((select shop_open from public.ranking_settings), false, 'JA3 Kaufen am Anfang gesperrt');

-- Aufruf als eingeloggter Spieler (Rolle authenticated), Ergebnis als jsonb
create or replace function t.call(p_user uuid, p_sql text) returns jsonb language plpgsql as $$
declare v jsonb;
begin
  perform t.login(p_user);
  set local role authenticated;
  execute p_sql into v;
  reset role;
  return v;
end $$;
create or replace function t.vorrat(p_user uuid, p_joker text) returns int language sql as $$
  select coalesce((select anzahl from public.joker_vorrat where user_id = p_user and joker = p_joker), 0) $$;
create or replace function t.tipjoker(p_id text) returns text language sql as $$
  select coalesce(joker, '-') from public.tips where id = p_id $$;
grant execute on all functions in schema t to authenticated, anon;

-- Spieler 40-45, Admin = Rene (rene.cr7@gmx.at aus legacy-fixture.sql)
select from t.ruser(40, 0) a, t.ruser(41, 0) b, t.ruser(42, 0) c, t.ruser(43, 0) d, t.ruser(44, 0) e;
\set rene '00000000-0000-0000-0000-00000000000a'
update public.profiles set free_stars = 1000 where id = :'rene';
update public.profiles set free_stars = 500 where id = t.u(40);

-- ============================================================================
-- B) Kaufen und Schalter
-- ============================================================================
select t.eq(t.call(t.u(40), 'select public.my_jokers()') - 'trend_matches',
  '{"schutz":0,"doppel":0,"toleranz":0,"trend":0,"pause":0,"shop_open":false}'::jsonb, 'JB1 Leerer Vorrat');
select t.expect_error(format('select t.call(%L, %L)', t.u(40), 'select public.buy_joker(''schutz'')'), 'JB2 Gesperrt: Spieler kann nicht kaufen');
select t.eq(t.stars(t.u(40)), 500, 'JB3 Gesperrt: keine Sterne abgebucht');
select t.eq((t.call(:'rene', 'select public.buy_joker(''doppel'')') -> 'jokers' ->> 'doppel')::int, 1, 'JB4 Admin kann schon testen');
select t.eq(t.stars(:'rene'), 820, 'JB5 Admin: 180 Sterne abgebucht');
select t.eq((select count(*)::int from public.joker_kaeufe where user_id = :'rene' and joker = 'doppel' and preis = 180), 1, 'JB6 Kauf protokolliert');
select t.expect_error(format('select t.call(%L, %L)', t.u(40), 'select to_jsonb(public.set_shop_open(true))'), 'JB7 Spieler darf Shop nicht freigeben');
select t.eq(t.call(:'rene', 'select to_jsonb(public.set_shop_open(true))'), 'true'::jsonb, 'JB8 Admin gibt frei');
select t.eq((select shop_open from public.ranking_settings), true, 'JB9 Schalter steht auf frei');

select from t.call(t.u(40), 'select public.buy_joker(''schutz'')') a;
select from t.call(t.u(40), 'select public.buy_joker(''toleranz'')') a;
select from t.call(t.u(40), 'select public.buy_joker(''trend'')') a;
select t.eq((t.call(t.u(40), 'select public.buy_joker(''pause'')') -> 'jokers' ->> 'pause')::int, 1, 'JB10 Pause-Joker gekauft');
select t.eq(t.stars(t.u(40)), 30, 'JB11 500 - 120 - 150 - 100 - 100 = 30 Sterne');
select t.eq((select pause_jokers from public.profiles where id = t.u(40)), 1, 'JB12 Pause-Joker im Profil');
select t.expect_error(format('select t.call(%L, %L)', t.u(40), 'select public.buy_joker(''doppel'')'), 'JB13 Zu wenig Sterne');
select t.eq(t.stars(t.u(40)) || '/' || t.vorrat(t.u(40), 'doppel'), '30/0', 'JB14 Zu wenig Sterne: nichts gebucht');
select t.expect_error(format('select t.call(%L, %L)', t.u(40), 'select public.buy_joker(''korrektur'')'), 'JB15 Unbekannter Joker');
select t.expect_error($$set local role anon; select public.buy_joker('schutz')$$, 'JB16 Ohne Login kein Kauf');
select t.expect_error(format('select t.call(%L, %L)', t.u(40),
  format('insert into public.joker_vorrat values (%L, ''doppel'', 5) returning to_jsonb(anzahl)', t.u(40))), 'JB17 Vorrat nicht selbst auffüllbar');

-- ============================================================================
-- C) Joker auf einen Tipp setzen
-- ============================================================================
update public.profiles set free_stars = 2000 where id = t.u(40);
select from t.call(t.u(40), 'select public.buy_joker(''schutz'')') a;  -- jetzt 2 Schutz
insert into public.matches (id, data) values
  ('jk-1', t.match('jk-1', 'Fußball', 'score', 0, now() + interval '1 day')),
  ('jk-2', t.match('jk-2', 'NBA', '1x2', 0, now() + interval '1 day')),
  ('jk-3', t.match('jk-3', 'Fußball', 'score', 0, now() + interval '10 minutes')),
  ('jk-4', t.match('jk-4', 'Fußball', 'score', 0, now() + interval '1 day')),
  ('jk-5', t.match('jk-5', 'Fußball', 'score', 0, now() + interval '1 day')),
  ('jk-6', t.match('jk-6', 'Fußball', 'score', 0, now() + interval '1 day'));

select t.expect_error(format('select t.call(%L, %L)', t.u(40), 'select public.set_tip_joker(''jk-1'', ''schutz'')'), 'JC1 Ohne Tipp kein Joker');
begin; select from t.rtip(40, 'jk-1', 2, 1) a; commit;
select from t.call(t.u(40), 'select public.set_tip_joker(''jk-1'', ''schutz'')') a;
select t.eq(t.tipjoker('jk-1-40') || '/' || t.vorrat(t.u(40), 'schutz'), 'schutz/1', 'JC2 Schutz-Joker gesetzt, 1 übrig');
select from t.call(t.u(40), 'select public.set_tip_joker(''jk-1'', ''toleranz'')') a;
select t.eq(t.tipjoker('jk-1-40') || '/' || t.vorrat(t.u(40), 'schutz') || '/' || t.vorrat(t.u(40), 'toleranz'), 'toleranz/2/0',
  'JC3 Getauscht: Schutz zurück, Toleranz verbraucht');
select t.expect_error(format('select t.call(%L, %L)', t.u(40), 'select public.set_tip_joker(''jk-1'', ''doppel'')'), 'JC4 Doppel nicht im Vorrat');
select t.eq(t.tipjoker('jk-1-40'), 'toleranz', 'JC5 Fehler: Joker bleibt');
select from t.call(t.u(40), 'select public.set_tip_joker(''jk-1'', null)') a;
select t.eq(t.tipjoker('jk-1-40') || '/' || t.vorrat(t.u(40), 'toleranz'), '-/1', 'JC6 Abgenommen: zurück im Vorrat');
select from t.call(t.u(40), 'select public.set_tip_joker(''jk-1'', null)') a;
select t.eq(t.vorrat(t.u(40), 'toleranz'), 1, 'JC7 Zweimal abnehmen: nichts doppelt');

begin; select from t.rtip(40, 'jk-2', 1, 0) a; commit;
select t.expect_error(format('select t.call(%L, %L)', t.u(40), 'select public.set_tip_joker(''jk-2'', ''toleranz'')'), 'JC8 Toleranz nicht bei 1X2');
select from t.call(t.u(40), 'select public.set_tip_joker(''jk-2'', ''schutz'')') a;
select t.eq(t.tipjoker('jk-2-40'), 'schutz', 'JC9 Schutz bei 1X2 geht');

begin; select from t.rtip(40, 'jk-3', 1, 0) a; commit;  -- Tippschluss vor 20 Minuten
update public.tips set submitted_at = now() - interval '1 hour' where id = 'jk-3-40';
select t.expect_error(format('select t.call(%L, %L)', t.u(40), 'select public.set_tip_joker(''jk-3'', ''schutz'')'), 'JC10 Nach Tippschluss kein Joker');

select from t.call(t.u(40), 'select public.set_tip_joker(''jk-1'', ''schutz'')') a;
begin;
select t.login(t.u(40));
set local role authenticated;
update public.tips set joker = 'doppel' where id = 'jk-1-40';
update public.tips set predicted_home_score = 0, predicted_away_score = 2 where id = 'jk-1-40';
reset role;
commit;
select t.eq(t.tipjoker('jk-1-40'), 'schutz', 'JC11 Joker nicht direkt änderbar, bleibt beim Tipp-Ändern');
select t.expect_error(format('select t.call(%L, %L)', t.u(41), 'select public.set_tip_joker(''jk-1'', ''schutz'')'), 'JC12 Fremder Tipp: kein Joker');

-- ============================================================================
-- D) Auswertung, Absage, Löschen
-- ============================================================================
select from t.finish('jk-1', 2, 0) f;  -- Tipp 0:2 falsch, Schutz-Joker
select t.eq((select result_tier || ' ' || rang_delta || ' gebucht ' || rang_booked from public.tips where id = 'jk-1-40'),
  'falsch 0 gebucht 0', 'JD1 Schutz-Joker: 0 statt Minus');
select t.expect_error(format('select t.call(%L, %L)', t.u(40), 'select public.set_tip_joker(''jk-1'', null)'), 'JD2 Nach Auswertung nicht mehr abnehmbar');

select from t.call(t.u(40), 'select public.buy_joker(''doppel'')') a;
begin; select from t.rtip(40, 'jk-5', 1, 1) a; commit;
select from t.call(t.u(40), 'select public.set_tip_joker(''jk-5'', ''doppel'')') a;
select t.eq(t.vorrat(t.u(40), 'doppel'), 0, 'JD3 Doppel gesetzt');
update public.matches set data = jsonb_set(data, '{status}', '"cancelled"') where id = 'jk-5';
select t.eq(t.tipjoker('jk-5-40') || '/' || t.vorrat(t.u(40), 'doppel'), '-/1', 'JD4 Spiel abgesagt: Joker zurück');
update public.matches set data = jsonb_set(data, '{tvChannel}', '"ORF"') where id = 'jk-5';
select t.eq(t.vorrat(t.u(40), 'doppel'), 1, 'JD5 Abgesagtes Spiel nochmal geändert: nichts doppelt');

begin; select from t.rtip(40, 'jk-6', 1, 1) a; commit;
select from t.call(t.u(40), 'select public.set_tip_joker(''jk-6'', ''doppel'')') a;
delete from public.tips where id = 'jk-6-40';
select t.eq(t.vorrat(t.u(40), 'doppel'), 1, 'JD6 Tipp gelöscht: Joker zurück');

-- ============================================================================
-- E) Trend-Joker
-- ============================================================================
begin;
select from t.rtip(41, 'jk-4', 2, 0) a, t.rtip(42, 'jk-4', 3, 1) b, t.rtip(43, 'jk-4', 1, 1) c;
commit;
select t.eq(t.call(t.u(40), 'select public.use_trend_joker(''jk-4'')'), '{"tipps":3,"heim":2,"remis":1,"gast":0}'::jsonb, 'JE1 Trend: 2 Heimsieg, 1 Remis');
select t.eq(t.vorrat(t.u(40), 'trend'), 0, 'JE2 Trend-Joker verbraucht');
select t.eq(t.call(t.u(40), 'select public.use_trend_joker(''jk-4'')') ->> 'tipps', '3', 'JE3 Nochmal ansehen kostet nichts');
select t.eq(t.call(t.u(40), 'select public.my_jokers()') -> 'trend_matches', '["jk-4"]'::jsonb, 'JE4 Spiel gemerkt');
select t.expect_error(format('select t.call(%L, %L)', t.u(40), 'select public.use_trend_joker(''jk-6'')'), 'JE5 Ohne Trend-Joker kein Trend');
begin; select from t.rtip(40, 'jk-4', 0, 1) a; commit;
select t.eq(t.call(t.u(40), 'select public.use_trend_joker(''jk-4'')') ->> 'gast', '0', 'JE6 Eigener Tipp zählt nicht mit');

-- ============================================================================
-- F) Schalter wieder zu, Konto löschen
-- ============================================================================
select from t.call(:'rene', 'select to_jsonb(public.set_shop_open(false))') a;
select t.expect_error(format('select t.call(%L, %L)', t.u(40), 'select public.buy_joker(''schutz'')'), 'JF1 Wieder gesperrt');
select from t.call(t.u(40), 'select public.set_tip_joker(''jk-4'', ''toleranz'')') a;
select t.eq(t.tipjoker('jk-4-40'), 'toleranz', 'JF2 Gesperrt: eigene Joker weiter einsetzbar');
delete from auth.users where id = t.u(40);
select t.eq((select count(*)::int from public.joker_vorrat where user_id = t.u(40)), 0, 'JF3 Konto gelöscht: Vorrat weg, kein Fehler');

\echo JOKER-SHOP-TESTS GRÜN
