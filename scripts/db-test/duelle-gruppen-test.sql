-- Tests für supabase/duelle-gruppen.sql (nur Test-Datenbank). Läuft nach
-- trainingstaschen-test.sql (nutzt t.call/t.ruser/t.u/t.finish), siehe run.sh.
\set ON_ERROR_STOP 1
\set rene '00000000-0000-0000-0000-00000000000a'

-- ============================================================================
-- A) Einspielen: nichts Bestehendes ändert sich
-- ============================================================================
create table t.dgsnap as select id, free_stars, rang_punkte, pass_xp, streak_count from public.profiles;
create table t.dgsnap_duels as select * from public.duels;
create table t.dgsnap_tips as select id, user_id, match_id, predicted_home_score, predicted_away_score, stake, evaluated, stars_delta from public.tips;
set client_min_messages = warning;
\o /dev/null
\i supabase/duelle-gruppen.sql
\i supabase/duelle-gruppen.sql
\o
set client_min_messages = notice;
select t.eq((select count(*)::int from (select * from t.dgsnap except
  select id, free_stars, rang_punkte, pass_xp, streak_count from public.profiles) x), 0, 'DA1 Profile (Coins, Punkte, XP, Serien) unverändert');
select t.eq((select count(*)::int from (select * from t.dgsnap_duels except
  select id, challenger_id, challenger_name, opponent_id, opponent_name, match_id, stake, status, my_tier, opponent_tier,
         result, stars_credited, created_at, resolved_at, accepted_at from public.duels) x), 0, 'DA2 Bestehende Duelle unverändert');
select t.eq((select count(*)::int from (select * from t.dgsnap_tips except
  select id, user_id, match_id, predicted_home_score, predicted_away_score, stake, evaluated, stars_delta from public.tips) x), 0, 'DA3 Tipps unverändert');
select t.eq((select count(*)::int from public.duel_participants where is_creator),
            (select count(*)::int from public.duels), 'DA4 Jedes alte Duell hat seinen Ersteller als Spieler');
select t.eq((select count(*)::int from public.duel_participants where not is_creator),
            (select count(*)::int from public.duels where opponent_id is not null and opponent_id <> challenger_id), 'DA5 ... und seinen Gegner');
select t.eq((select count(*)::int from pg_publication_tables where pubname = 'supabase_realtime'
  and tablename in ('duels', 'duel_participants')), 2, 'DA6 Sofort-Abgleich für Duelle und Spieler');

-- Helfer
create or replace function t.dcall(p_user uuid, p_sql text) returns void language plpgsql as $$
begin
  perform t.login(p_user);
  set local role authenticated;
  execute p_sql;
  reset role;
end $$;
create or replace function t.newduel(p_user uuid, p_invitees uuid[], p_matches text[], p_stake int) returns text language plpgsql as $$
declare v jsonb;
begin
  v := t.call(p_user, format('select public.create_duel(%L::uuid[], %L::text[], %s)', p_invitees, p_matches, p_stake));
  return v ->> 'id';
end $$;
create or replace function t.dstatus(p_id text) returns text language sql as $$ select status from public.duels where id = p_id $$;
create or replace function t.pay(p_id text, p_user uuid) returns int language sql as $$
  select payout from public.duel_participants where duel_id = p_id and user_id = p_user $$;
create or replace function t.dtip(p_user uuid, p_match text, p_home int, p_away int) returns void language plpgsql as $$
begin
  perform t.login(p_user);
  set local role authenticated;
  insert into public.tips (id, user_id, match_id, predicted_home_score, predicted_away_score, stake, submitted_at)
  values (p_match || '-' || p_user, p_user, p_match, p_home, p_away, 0, now());
  reset role;
end $$;
create or replace function t.msgs(p_user uuid, p_like text) returns int language sql as $$
  select count(*)::int from public.activity_feed where user_id = p_user and text like p_like $$;
grant execute on all functions in schema t to authenticated, anon;

select from t.ruser(60, 0) a, t.ruser(61, 0) b, t.ruser(62, 0) c, t.ruser(63, 0) d, t.ruser(64, 0) e, t.ruser(65, 0) f;
update public.profiles set free_stars = 200, rescue_bonus_used = true where id in (t.u(60), t.u(61), t.u(62), t.u(63), t.u(64), t.u(65));
-- Erst ohne Konto-Prüfung und Paarungs-Grenze, die kommen in G).
update public.duel_settings set min_tips = 0, min_account_days = 0, pair_per_week = 100;

insert into public.matches (id, data) values
  ('dg1', t.match('dg1', 'Fußball', 'score', 0, now() + interval '1 day')),
  ('dg2', t.match('dg2', 'Fußball', 'score', 0, now() + interval '2 days')),
  ('dg3', t.match('dg3', 'Fußball', '1x2', 0, now() + interval '3 days')),
  ('dg4', t.match('dg4', 'Fußball', 'score', 0, now() + interval '1 day')),
  ('dg5', t.match('dg5', 'Fußball', 'score', 0, now() + interval '1 day')),
  ('dg6', t.match('dg6', 'Fußball', 'score', 0, now() + interval '1 day')),
  ('dg7', t.match('dg7', 'Fußball', 'score', 0, now() + interval '1 day')),
  ('dg8', t.match('dg8', 'Fußball', 'score', 0, now() + interval '1 day')),
  ('dg9', t.match('dg9', 'Fußball', 'score', 0, now() + interval '1 day')),
  ('dg10', t.match('dg10', 'Fußball', 'score', 0, now() + interval '1 day')),
  ('dg11', t.match('dg11', 'Fußball', 'score', 0, now() + interval '1 day')),
  ('dgalt', t.match('dgalt', 'Fußball', 'score', 0, now() - interval '1 hour'));

-- ============================================================================
-- B) Anlegen: Prüfungen
-- ============================================================================
select t.expect_error(format('select t.newduel(%L, array[%L]::uuid[], array[''dg1''], 51)', t.u(60), t.u(61)), 'DB1 Einsatz über 50 geht nicht');
select t.expect_error(format('select t.newduel(%L, array[%L]::uuid[], array[''dg1''], 20)', t.u(60), t.u(60)), 'DB2 Sich selbst einladen geht nicht');
select t.expect_error(format('select t.newduel(%L, array[%L,%L,%L,%L,%L]::uuid[], array[''dg1''], 20)', t.u(60), t.u(61), t.u(62), t.u(63), t.u(64), t.u(65)),
  'DB3 Mehr als 5 Spieler geht nicht');
select t.expect_error(format('select t.newduel(%L, array[%L]::uuid[], array[''dg1'',''dgalt''], 20)', t.u(60), t.u(61)), 'DB4 Spiel nach Tippschluss geht nicht');
select t.expect_error(format('select t.newduel(%L, array[%L]::uuid[], array[''dg1'',''dg2'',''dg3'',''dg4'',''dg5'',''dg6'',''dg7'',''dg8'',''dg9'',''dg10'',''dg11''], 20)', t.u(60), t.u(61)),
  'DB5 Mehr als 10 Spiele geht nicht');
select t.expect_error(format('select t.newduel(%L, array[]::uuid[], array[''dg1''], 20)', t.u(60)), 'DB6 Ohne Gegner geht nicht');
select t.eq(t.stars(t.u(60)), 200, 'DB7 Bei Fehlern wird nichts abgebucht');
select t.eq((select count(*)::int from public.duels where challenger_id = t.u(60)), 0, 'DB8 ... und nichts gespeichert');

-- ============================================================================
-- C) Duell zu dritt über 2 Spiele: einer lehnt ab, 2 Spieler spielen
-- ============================================================================
select t.newduel(t.u(60), array[t.u(61), t.u(62)], array['dg1', 'dg2'], 20) as d1 \gset
select t.eq(t.stars(t.u(60)), 180, 'DC1 Ersteller zahlt 20');
select t.eq(t.dstatus(:'d1'), 'pending', 'DC2 Wartet auf Antworten');
select t.eq((select count(*)::int from public.duel_participants where duel_id = :'d1'), 3, 'DC3 3 Spieler eingetragen');
select t.eq((select accept_until from public.duels where id = :'d1') = public.match_deadline('dg1'), true, 'DC4 Annehmen bis zum ersten Tippschluss');
select t.eq(t.msgs(t.u(61), '%lädt dich zu einem Duell ein: 2 Spiele, Einsatz 20 Coins%'), 1, 'DC5 Eingeladene bekommen eine Nachricht');
-- Lesen: Mitspieler ja, Fremde nein
select t.eq(t.call(t.u(62), format('select to_jsonb(count(*)) from public.duel_participants where duel_id = %L', :'d1')), '3'::jsonb, 'DC6 Eingeladene sehen alle Spieler');
select t.eq(t.call(t.u(62), format('select to_jsonb(count(*)) from public.duels where id = %L', :'d1')), '1'::jsonb, 'DC7 ... und das Duell');
select t.eq(t.call(t.u(64), format('select to_jsonb(count(*)) from public.duels where id = %L', :'d1')), '0'::jsonb, 'DC8 Fremde sehen es nicht');
select t.expect_error(format('select t.dcall(%L, %L)', t.u(64), format('select public.accept_duel(%L)', :'d1')), 'DC9 Fremde können nicht annehmen');
select t.expect_error(format('select t.dcall(%L, %L)', t.u(60), format('update public.duel_participants set payout = 999 where duel_id = %L', :'d1')), 'DC10 Spieler können nichts direkt ändern');
select t.eq((select count(*)::int from public.duel_participants where payout = 999), 0, 'DC11 ... wirklich nicht');

select t.dcall(t.u(61), format('select public.accept_duel(%L)', :'d1'));
select t.eq(t.stars(t.u(61)), 180, 'DC12 Annehmen kostet 20');
select t.eq(t.dstatus(:'d1'), 'pending', 'DC13 Noch offen, solange jemand nicht geantwortet hat');
select t.eq(t.msgs(t.u(60), '%hat dein Duell angenommen%'), 1, 'DC14 Ersteller bekommt Nachricht');
select t.dcall(t.u(62), format('select public.decline_duel(%L)', :'d1'));
select t.eq(t.dstatus(:'d1'), 'offen', 'DC15 Alle haben geantwortet: Duell läuft');
select t.eq(t.stars(t.u(62)), 200, 'DC16 Ablehnen kostet nichts');
select t.expect_error(format('select t.dcall(%L, %L)', t.u(62), format('select public.accept_duel(%L)', :'d1')), 'DC17 Nach Ablehnen nicht mehr annehmen');

select t.dtip(t.u(60), 'dg1', 2, 1);
select t.dtip(t.u(60), 'dg2', 0, 0);
select t.dtip(t.u(61), 'dg1', 1, 0);
-- 61 tippt dg2 gar nicht
select t.finish('dg1', 2, 1);
select t.eq(t.dstatus(:'d1'), 'offen', 'DC18 Erst ein Spiel fertig: noch keine Auswertung');
select t.finish('dg2', 0, 0);
select t.eq(t.dstatus(:'d1'), 'ausgewertet', 'DC19 Beide Spiele fertig: ausgewertet');
select t.eq((select points from public.duel_participants where duel_id = :'d1' and user_id = t.u(60)), 20, 'DC20 Ersteller: exakt + exakt = 20');
select t.eq((select points from public.duel_participants where duel_id = :'d1' and user_id = t.u(61)), 4, 'DC21 Gegner: Tordifferenz 7 + kein Tipp -3 = 4');
select t.eq(t.pay(:'d1', t.u(60)), 40, 'DC22 2 Spieler: Sieger bekommt beide Einsätze');
select t.eq(t.stars(t.u(60)), 220, 'DC23 Ersteller +20');
select t.eq(t.stars(t.u(61)), 180, 'DC24 Gegner -20');
select t.eq((select result from public.duels where id = :'d1'), 'challenger', 'DC25 Ergebnis wie bisher für die alte Anzeige');
select t.eq(t.msgs(t.u(60), 'Duell mit%gewonnen, +20 Coins.'), 1, 'DC26 Sieger bekommt Nachricht');

-- ============================================================================
-- D) Zu viert: Platz 2 bekommt Einsatz zurück, Gewinn-Deckel
-- ============================================================================
update public.duel_settings set day_win_cap = 50;
select t.newduel(t.u(60), array[t.u(61), t.u(62), t.u(63)], array['dg4'], 30) as d2 \gset
select t.dcall(t.u(61), format('select public.accept_duel(%L)', :'d2'));
select t.dcall(t.u(62), format('select public.accept_duel(%L)', :'d2'));
select t.dcall(t.u(63), format('select public.accept_duel(%L)', :'d2'));
select t.eq(t.dstatus(:'d2'), 'offen', 'DD1 Alle angenommen: läuft');
select t.dtip(t.u(60), 'dg4', 3, 1);
select t.dtip(t.u(61), 'dg4', 2, 0);
select t.dtip(t.u(62), 'dg4', 0, 1);
select t.dtip(t.u(63), 'dg4', 0, 2);
select t.finish('dg4', 3, 1);
-- Topf 120: Platz 2 (61) 30 zurück, Platz 1 (60) 90 = +60 Gewinn, aber
-- heute schon +20 gewonnen, Deckel 50 -> nur +30, 30 verfallen.
select t.eq(t.pay(:'d2', t.u(61)), 30, 'DD2 Platz 2 bekommt Einsatz zurück');
select t.eq(t.pay(:'d2', t.u(62)) + t.pay(:'d2', t.u(63)), 0, 'DD3 Platz 3 und 4 verlieren');
select t.eq(t.pay(:'d2', t.u(60)), 60, 'DD4 Sieger: Gewinn auf den Tagesdeckel gekürzt');
select t.eq((select capped from public.duel_participants where duel_id = :'d2' and user_id = t.u(60)), 30, 'DD5 30 Coins verfallen');
select t.eq(t.stars(t.u(60)), 220 - 30 + 60, 'DD6 Coins Sieger');
select t.eq(t.msgs(t.u(60), '%30 Coins über dem Gewinn-Deckel verfallen%'), 1, 'DD7 Sieger erfährt vom Deckel');
update public.duel_settings set day_win_cap = 100;

-- ============================================================================
-- E) Gleichstände
-- ============================================================================
-- Alle gleich: alle bekommen den Einsatz zurück
select t.newduel(t.u(61), array[t.u(62), t.u(63)], array['dg5'], 10) as d3 \gset
select t.dcall(t.u(62), format('select public.accept_duel(%L)', :'d3'));
select t.dcall(t.u(63), format('select public.accept_duel(%L)', :'d3'));
select t.dtip(t.u(61), 'dg5', 1, 0);
select t.dtip(t.u(62), 'dg5', 1, 0);
select t.dtip(t.u(63), 'dg5', 1, 0);
create table t.dge as select id, free_stars from public.profiles where id in (t.u(61), t.u(62), t.u(63));
select t.finish('dg5', 1, 0);
select t.eq((select count(*)::int from public.duel_participants where duel_id = :'d3' and payout = 10), 3, 'DE1 Alle gleich: jeder bekommt 10 zurück');
select t.eq((select result from public.duels where id = :'d3'), 'unentschieden', 'DE2 Unentschieden');

-- Geteilter Platz 2 teilt den einen Einsatz
select t.newduel(t.u(61), array[t.u(62), t.u(63)], array['dg6'], 20) as d4 \gset
select t.dcall(t.u(62), format('select public.accept_duel(%L)', :'d4'));
select t.dcall(t.u(63), format('select public.accept_duel(%L)', :'d4'));
select t.dtip(t.u(61), 'dg6', 2, 2);
select t.dtip(t.u(62), 'dg6', 0, 1);
select t.dtip(t.u(63), 'dg6', 0, 3);
select t.finish('dg6', 2, 2);
select t.eq(t.pay(:'d4', t.u(61)), 40, 'DE3 Sieger: Topf 60 minus 20');
select t.eq(t.pay(:'d4', t.u(62)) || '/' || t.pay(:'d4', t.u(63)), '10/10', 'DE4 Zwei auf Platz 2 teilen sich 20');

-- Geteilter Platz 1 teilt den Topf
select t.newduel(t.u(61), array[t.u(62), t.u(63)], array['dg7'], 20) as d5 \gset
select t.dcall(t.u(62), format('select public.accept_duel(%L)', :'d5'));
select t.dcall(t.u(63), format('select public.accept_duel(%L)', :'d5'));
select t.dtip(t.u(61), 'dg7', 1, 0);
select t.dtip(t.u(62), 'dg7', 1, 0);
select t.dtip(t.u(63), 'dg7', 0, 1);
select t.finish('dg7', 1, 0);
select t.eq(t.pay(:'d5', t.u(61)) + t.pay(:'d5', t.u(62)), 60, 'DE5 Zwei auf Platz 1 teilen sich 60');
select t.eq(t.pay(:'d5', t.u(63)), 0, 'DE6 Platz 3 verliert');
select t.eq((select sum(payout)::int from public.duel_participants where duel_id in (:'d3', :'d4', :'d5')), 30 + 60 + 60,
  'DE7 Es entstehen keine Coins aus dem Nichts');

-- ============================================================================
-- F) Zurückziehen, Ablaufen, Absagen
-- ============================================================================
select t.newduel(t.u(60), array[t.u(64), t.u(65)], array['dg8', 'dg9'], 25) as d6 \gset
select t.dcall(t.u(64), format('select public.accept_duel(%L)', :'d6'));
create table t.dgf as select id, free_stars from public.profiles where id in (t.u(60), t.u(64), t.u(65));
select t.expect_error(format('select t.dcall(%L, %L)', t.u(64), format('select public.withdraw_duel(%L)', :'d6')), 'DF1 Nur der Ersteller kann zurückziehen');
select t.dcall(t.u(60), format('select public.withdraw_duel(%L)', :'d6'));
select t.eq(t.dstatus(:'d6'), 'zurueckgezogen', 'DF2 Zurückgezogen');
select t.eq(t.stars(t.u(60)) - (select free_stars from t.dgf where id = t.u(60)), 25, 'DF3 Ersteller bekommt Einsatz zurück');
select t.eq(t.stars(t.u(64)) - (select free_stars from t.dgf where id = t.u(64)), 25, 'DF4 Wer schon angenommen hat, auch');
select t.eq(t.msgs(t.u(64), '%hat das Duell zurückgezogen – deine 25 Coins sind zurück.'), 1, 'DF5 Nachricht an Angenommene');
select t.eq(t.msgs(t.u(65), '%hat die Duell-Einladung zurückgezogen.'), 1, 'DF6 Nachricht an Eingeladene');
select t.expect_error(format('select t.dcall(%L, %L)', t.u(65), format('select public.accept_duel(%L)', :'d6')), 'DF7 Zurückgezogenes kann man nicht annehmen');

-- Nach dem ersten Tippschluss: nicht mehr annehmen, nicht mehr zurückziehen
select t.newduel(t.u(60), array[t.u(64), t.u(65)], array['dg10'], 10) as d7 \gset
select t.dcall(t.u(64), format('select public.accept_duel(%L)', :'d7'));
update public.matches set data = data || jsonb_build_object('tipDeadline', now() - interval '1 minute') where id = 'dg10';
select t.expect_error(format('select t.dcall(%L, %L)', t.u(65), format('select public.accept_duel(%L)', :'d7')), 'DF8 Annehmen nach Tippschluss geht nicht');
select t.expect_error(format('select t.dcall(%L, %L)', t.u(60), format('select public.withdraw_duel(%L)', :'d7')), 'DF9 Zurückziehen nach Tippschluss geht nicht');
select t.dcall(t.u(65), 'select public.expire_my_duels()');
select t.eq(t.dstatus(:'d7'), 'offen', 'DF10 Abgelaufen: läuft mit denen, die angenommen haben');
select t.eq((select status from public.duel_participants where duel_id = :'d7' and user_id = t.u(65)), 'verfallen', 'DF11 Einladung verfallen');

-- Niemand nimmt an: Ersteller bekommt Einsatz zurück
select t.newduel(t.u(63), array[t.u(64)], array['dg11'], 15) as d8 \gset
update public.matches set data = data || jsonb_build_object('tipDeadline', now() - interval '1 minute') where id = 'dg11';
select t.eq(t.stars(t.u(63)) , (select free_stars from public.profiles where id = t.u(63)), 'DF12 (Stand)');
create table t.dgf2 as select free_stars from public.profiles where id = t.u(63);
select t.dcall(t.u(63), 'select public.expire_my_duels()');
select t.eq(t.dstatus(:'d8'), 'verfallen', 'DF13 Niemand angenommen: verfallen');
select t.eq(t.stars(t.u(63)) - (select free_stars from t.dgf2), 15, 'DF14 Ersteller bekommt Einsatz zurück');

-- Ein Spiel abgesagt: zählt nicht mit
insert into public.matches (id, data) values
  ('dg12', t.match('dg12', 'Fußball', 'score', 0, now() + interval '1 day')),
  ('dg13', t.match('dg13', 'Fußball', 'score', 0, now() + interval '1 day')),
  ('dg14', t.match('dg14', 'Fußball', 'score', 0, now() + interval '1 day'));
select t.newduel(t.u(64), array[t.u(65)], array['dg12', 'dg13'], 10) as d9 \gset
select t.dcall(t.u(65), format('select public.accept_duel(%L)', :'d9'));
select t.dtip(t.u(64), 'dg12', 9, 9);
select t.dtip(t.u(65), 'dg13', 1, 0);
select t.dcall(:'rene', 'select public.cancel_match(''dg12'')');
select t.eq(t.dstatus(:'d9'), 'offen', 'DF15 Ein Spiel abgesagt: Duell läuft weiter');
select t.finish('dg13', 1, 0);
select t.eq(t.pay(:'d9', t.u(65)), 20, 'DF16 Gewertet wird nur das gespielte Spiel');
select t.eq((select jsonb_array_length(game_results) from public.duel_participants where duel_id = :'d9' and user_id = t.u(65)), 2,
  'DF17 Abgesagtes Spiel steht trotzdem in der Liste');

-- Alle Spiele abgesagt: alle Einsätze zurück
select t.newduel(t.u(64), array[t.u(65)], array['dg14'], 10) as d10 \gset
select t.dcall(t.u(65), format('select public.accept_duel(%L)', :'d10'));
create table t.dgf3 as select id, free_stars from public.profiles where id in (t.u(64), t.u(65));
select t.dcall(:'rene', 'select public.cancel_match(''dg14'')');
select t.eq(t.dstatus(:'d10'), 'abgesagt', 'DF18 Alle Spiele abgesagt: Duell abgesagt');
select t.eq((select sum(p.free_stars - f.free_stars)::int from public.profiles p join t.dgf3 f on f.id = p.id), 20, 'DF19 Beide bekommen ihren Einsatz zurück');

-- ============================================================================
-- G) Schutz gegen Absprachen
-- ============================================================================
insert into public.matches (id, data) values
  ('dg20', t.match('dg20', 'Fußball', 'score', 0, now() + interval '1 day'));
update public.duel_settings set pair_per_week = 2;
-- 60 und 61 haben diese Woche schon mehr als 2 gemeinsame Duelle
select t.expect_error(format('select t.newduel(%L, array[%L]::uuid[], array[''dg20''], 10)', t.u(60), t.u(61)), 'DG1 Dieselben zwei: höchstens 2 Duelle pro Woche');
update public.duel_settings set pair_per_week = 100, min_tips = 10, min_account_days = 3;
select t.expect_error(format('select t.newduel(%L, array[%L]::uuid[], array[''dg20''], 10)', t.u(60), t.u(61)), 'DG2 Neue Konten (wenig Tipps) dürfen nicht');
-- 10 Tipps, aber Konto zu jung
insert into public.matches (id, data) select 'dgt' || g, t.match('dgt' || g, 'Fußball', 'score', 0, now() + interval '5 days') from generate_series(1, 10) g;
insert into public.tips (id, user_id, match_id, predicted_home_score, predicted_away_score, stake, submitted_at)
select 'dgt' || g || '-' || u, u, 'dgt' || g, 1, 0, 0, now() from generate_series(1, 10) g, unnest(array[t.u(60), t.u(61)]) u;
select t.expect_error(format('select t.newduel(%L, array[%L]::uuid[], array[''dg20''], 10)', t.u(60), t.u(61)), 'DG3 Konten jünger als 3 Tage dürfen nicht');
update public.profiles set created_at = now() - interval '4 days' where id in (t.u(60), t.u(61));
select t.newduel(t.u(60), array[t.u(61)], array['dg20'], 10) as d11 \gset
select t.eq(t.dstatus(:'d11'), 'pending', 'DG4 Mit 10 Tipps und 4 Tagen geht es');
select t.expect_error(format('select t.newduel(%L, array[%L]::uuid[], array[''dg20''], 10)', t.u(60), t.u(62)), 'DG5 Eingeladene müssen auch berechtigt sein');
update public.duel_settings set min_tips = 0, min_account_days = 0;

-- Alter Weg (App vor dem Update): Duell direkt anlegen
select t.dcall(t.u(62), format($q$insert into public.duels (id, challenger_id, challenger_name, opponent_id, opponent_name, match_id, stake, status)
  values ('dg-alt-weg', %L, 'x', %L, 'y', 'dg20', 10, 'pending')$q$, t.u(62), t.u(63)));
select t.eq((select count(*)::int from public.duel_participants where duel_id = 'dg-alt-weg'), 2, 'DG6 Alter Weg: Spielerliste wird angelegt');
select t.eq((select match_ids from public.duels where id = 'dg-alt-weg'), array['dg20'], 'DG7 Alter Weg: Spiel übernommen');
select t.expect_error(format('select t.dcall(%L, %L)', t.u(62), $q$insert into public.duels (id, challenger_id, challenger_name, opponent_id, opponent_name, match_id, stake, status)
  values ('dg-alt-weg2', '00000000-0000-0000-0000-000000000562', 'x', '00000000-0000-0000-0000-000000000563', 'y', 'dg20', 80, 'pending')$q$),
  'DG8 Alter Weg: Einsatz über 50 geht auch dort nicht');

-- Tageslimit zählt eingesetzte Coins, zurückgezahlte nicht
select t.eq(public.stake_used_today(t.u(62)), 30 + 10 + 20 + 20 + 10, 'DG9 Tageslimit: offene und gespielte Einsätze zählen');

-- Admin-Bericht
select t.expect_error(format('select t.call(%L, %L)', t.u(60), 'select public.admin_duel_report()'), 'DG10 Bericht nur für den Admin');
select t.eq(jsonb_typeof(t.call(:'rene', 'select public.admin_duel_report()')), 'array', 'DG11 Admin bekommt den Bericht');
select t.eq((select count(*)::int from jsonb_array_elements(t.call(:'rene', 'select public.admin_duel_report()')) e
  where e ->> 'art' = 'Gewinn-Deckel erreicht'), 1, 'DG12 Bericht zeigt den Gewinn-Deckel');

-- Konto löschen: Mitspieler eines eigenen laufenden Duells bekommen Einsatz zurück
select t.newduel(t.u(64), array[t.u(65)], array['dg20'], 10) as d12 \gset
select t.dcall(t.u(65), format('select public.accept_duel(%L)', :'d12'));
create table t.dgk as select free_stars from public.profiles where id = t.u(65);
select t.dcall(t.u(64), 'select public.delete_my_account()');
select t.eq(t.stars(t.u(65)) - (select free_stars from t.dgk), 10, 'DG13 Konto gelöscht: Mitspieler bekommt Einsatz zurück');

\echo DUELL-GRUPPEN-TESTS GRÜN
