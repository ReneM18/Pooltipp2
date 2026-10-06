-- Tests für supabase/tipps-schutz.sql (nur Test-Datenbank). Aufruf siehe tipps-schutz-test.sh.
\set ON_ERROR_STOP 1
\set rita '00000000-0000-0000-0000-0000000000d1'
\set dani '00000000-0000-0000-0000-0000000000d2'

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
create or replace function t.login(p_user uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  perform set_config('request.jwt.claims', case when p_user is null then '' else json_build_object('sub', p_user)::text end, true);
end $$;
grant execute on all functions in schema t to authenticated, anon;

insert into auth.users (id, email) values (:'rita', 'rita@test.at'), (:'dani', 'dani@test.at') on conflict do nothing;
insert into public.profiles (id, display_name) values (:'rita', 'Rita'), (:'dani', 'Dani') on conflict (id) do nothing;

-- Offenes Spiel (Tippschluss morgen), Spiel nach Tippschluss, beendetes Spiel.
insert into public.matches (id, data) values
  ('ts-offen', jsonb_build_object('id', 'ts-offen', 'sport', 'Fußball', 'status', 'upcoming',
     'kickoff', (now() + interval '1 day')::text, 'tipDeadline', (now() + interval '23 hours')::text)),
  ('ts-zu', jsonb_build_object('id', 'ts-zu', 'sport', 'Fußball', 'status', 'upcoming',
     'kickoff', (now() + interval '10 minutes')::text, 'tipDeadline', (now() - interval '1 minute')::text)),
  ('ts-ende', jsonb_build_object('id', 'ts-ende', 'sport', 'Fußball', 'status', 'finished',
     'kickoff', (now() + interval '1 day')::text, 'tipDeadline', (now() + interval '1 day')::text));
-- Tipps direkt als Datenbank (wie bestehende Tipps): Rita und Dani auf jedes Spiel.
alter table public.tips disable trigger user;
insert into public.tips (id, user_id, match_id, predicted_home_score, predicted_away_score, submitted_at, stake) values
  ('ts-r1', :'rita', 'ts-offen', 2, 1, now(), 0), ('ts-d1', :'dani', 'ts-offen', 0, 3, now(), 0),
  ('ts-r2', :'rita', 'ts-zu', 1, 1, now(), 0),    ('ts-d2', :'dani', 'ts-zu', 4, 0, now(), 0),
  ('ts-r3', :'rita', 'ts-ende', 3, 3, now(), 0),  ('ts-d3', :'dani', 'ts-ende', 1, 2, now(), 0);
alter table public.tips enable trigger user;

-- Gast (nicht eingeloggt)
begin;
set local role anon;
select t.login(null);
select t.eq((select count(*)::int from public.tips where match_id = 'ts-offen'), 0, 'G1 Gast sieht keine Tipps vor Tippschluss');
select t.eq((select count(*)::int from public.tips where match_id = 'ts-zu'), 2, 'G2 Gast sieht Tipps nach Tippschluss');
select t.eq((select count(*)::int from public.tips where match_id = 'ts-ende'), 2, 'G3 Gast sieht Tipps beendeter Spiele');
select t.eq((select tips from public.tip_counts() where match_id = 'ts-offen'), 2, 'G4 Zähler zählt auch verdeckte Tipps');
select t.eq((select count(*)::int from public.match_tippers('ts-offen')), 2, 'G5 Wer hat getippt: beide Namen');
select t.eq((select count(*)::int from public.match_tippers('ts-offen') where predicted_home_score is not null), 0, 'G6 Wer hat getippt: keine Zahlen vor Tippschluss');
select t.eq((select count(*)::int from public.match_tippers('ts-zu') where predicted_home_score is not null), 2, 'G7 Wer hat getippt: Zahlen nach Tippschluss');
select t.expect_error($$select public.decline_duel('duel-1')$$, 'G8 Gast kann kein Duell ablehnen');
rollback;

-- Rita eingeloggt
begin;
set local role authenticated;
select t.login(:'rita');
select t.eq((select string_agg(id, ',' order by id) from public.tips where match_id = 'ts-offen'), 'ts-r1', 'R1 Rita sieht vor Tippschluss nur ihren eigenen Tipp');
select t.eq((select count(*)::int from public.tips where user_id = :'rita'), 3, 'R2 Rita sieht alle eigenen Tipps');
select t.eq((select count(*)::int from public.tips where match_id in ('ts-zu', 'ts-ende')), 4, 'R3 Rita sieht fremde Tipps ab Tippschluss');
select t.eq((select predicted_home_score from public.match_tippers('ts-offen') where user_id = :'rita'), 2, 'R4 eigene Zahl in der Liste');
select t.eq((select predicted_home_score from public.match_tippers('ts-offen') where user_id = :'dani'), null::int, 'R5 Danis Zahl vor Tippschluss verdeckt');
select t.eq((select predicted_away_score from public.match_tippers('ts-zu') where user_id = :'dani'), 0, 'R6 Danis Zahl nach Tippschluss sichtbar');
rollback;

-- Spiel wird abgesagt -> Tipps sichtbar; gelöschtes Spiel -> sichtbar
update public.matches set data = data || '{"status":"cancelled"}' where id = 'ts-offen';
begin;
set local role anon;
select t.login(null);
select t.eq((select count(*)::int from public.tips where match_id = 'ts-offen'), 2, 'A1 abgesagtes Spiel: Tipps sichtbar');
rollback;

-- Tipps unverändert
select t.eq((select string_agg(id || ':' || predicted_home_score || '-' || predicted_away_score, ',' order by id) from public.tips where id like 'ts-%'),
  'ts-d1:0-3,ts-d2:4-0,ts-d3:1-2,ts-r1:2-1,ts-r2:1-1,ts-r3:3-3', 'T1 Tipps unverändert');
