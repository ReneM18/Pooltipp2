-- Tests für supabase/rankingsystem-tempo.sql (nur Test-Datenbank). Läuft
-- nach handball-test.sql, siehe run.sh: die schnelle Bonus-Zählung muss
-- genau dasselbe ergeben wie der Vergleich jeder gegen jeden.
\set ON_ERROR_STOP 1

create table t.tsnap as select id, free_stars, rang_punkte, pass_xp from public.profiles;
create table t.tsnap_tips as select * from public.tips;
set client_min_messages = warning;
\o /dev/null
\i supabase/rankingsystem-tempo.sql
\i supabase/rankingsystem-tempo.sql
\o
set client_min_messages = notice;
select t.eq((select count(*)::int from (select * from t.tsnap except
  select id, free_stars, rang_punkte, pass_xp from public.profiles) x), 0, 'TA1 Profile unverändert');
select t.eq((select count(*)::int from (select * from t.tsnap_tips except select * from public.tips) x), 0, 'TA2 Tipps unverändert');

-- Der bisherige Vergleich jeder gegen jeden als Referenz.
create or replace function t.bonus_ref(p_ids text[], p_stages int[], p_rps int[])
returns table (id text, stage int, n int, beaten int, s int) language sql as $$
  with x as (select * from unnest(p_ids, p_stages, p_rps) as u(id, stage, rp))
  select a.id, a.stage, count(b.id)::int, (count(b.id) filter (where b.stage < a.stage))::int,
         coalesce(sum(case
           when b.stage < a.stage then case when b.rp > a.rp then 2 else 1 end
           when b.stage > a.stage then case when b.rp < a.rp then -2 else -1 end
           else 0 end), 0)::int
  from x a left join x b on b.id <> a.id
  group by a.id, a.stage order by a.id $$;

-- Zufällige Spiele: 0, 1, 2 und viele Tipper, Ergebnis-Tipps (Stufe 0-3) und
-- 1X2 (Stufe 0-1), viele gleiche Punktestände.
create or replace function t.bonus_diff(p_n int, p_max_stage int, p_max_rp int) returns int language plpgsql as $$
declare v_ids text[]; v_st int[]; v_rp int[]; v_diff int;
begin
  select coalesce(array_agg('t' || g order by g), '{}'), coalesce(array_agg((random() * p_max_stage)::int order by g), '{}'),
         coalesce(array_agg((random() * p_max_rp)::int order by g), '{}')
  into v_ids, v_st, v_rp from generate_series(1, p_n) g;
  select count(*) into v_diff from (
    (select * from public.ranking_bonus_counts(v_ids, v_st, v_rp) except select * from t.bonus_ref(v_ids, v_st, v_rp))
    union all
    (select * from t.bonus_ref(v_ids, v_st, v_rp) except select * from public.ranking_bonus_counts(v_ids, v_st, v_rp))) d;
  return v_diff;
end $$;
select t.eq((select sum(t.bonus_diff(n, st, rp))::int
             from unnest(array[0, 1, 2, 3, 8, 40, 300]) n, unnest(array[1, 3]) st, unnest(array[0, 3, 500]) rp, generate_series(1, 5)), 0,
  'TB1 Zufällige Spiele: schnelle Zählung = jeder gegen jeden');
select t.eq((select count(*)::int from public.ranking_bonus_counts('{}', '{}', '{}')), 0, 'TB2 Ohne Tipps: nichts');
select t.eq((select n || '/' || beaten || '/' || s from public.ranking_bonus_counts(array['a'], array[3], array[10])), '0/0/0',
  'TB3 Allein: kein Mittipper, kein Bonus');

-- Ganzes Spiel wie B in rankingsystem-test.sql: gleiche Zahlen.
select from t.ruser(41, 0) f1, t.ruser(42, 20) f2, t.ruser(43, 50) f3, t.ruser(44, 50) f4,
       t.ruser(45, 100) g1, t.ruser(46, 150) g2, t.ruser(47, 300) g3, t.ruser(48, 2) g4;
insert into public.matches (id, data) values ('tp-8', t.match('tp-8', 'Fußball', 'score', 0, now() + interval '1 day'));
begin;
select from t.rtip(41, 'tp-8', 2, 1) f1, t.rtip(42, 'tp-8', 3, 2) f2, t.rtip(43, 'tp-8', 1, 0) f3, t.rtip(44, 'tp-8', 2, 0) f4,
       t.rtip(45, 'tp-8', 1, 1) g1, t.rtip(46, 'tp-8', 0, 2) g2, t.rtip(47, 'tp-8', 3, 1) g3, t.rtip(48, 'tp-8', 0, 0) g4;
commit;
select from t.finish('tp-8', 2, 1) f1;
select t.eq(t.line('tp-8-41'), 'exakt 10/7/17 gebucht 17 (7 von 7)', 'TC1 exakt: 10 + 7');
select t.eq(t.line('tp-8-42'), 'differenz 7/5/12 gebucht 12 (5 von 7)', 'TC2 Tordifferenz 3:2: 7 + 5');
select t.eq(t.line('tp-8-43'), 'differenz 7/4/11 gebucht 11 (5 von 7)', 'TC3 Tordifferenz 1:0: 7 + 4');
select t.eq(t.line('tp-8-44'), 'tendenz 5/0/5 gebucht 5 (3 von 7)', 'TC4 Tendenz: 5 + 0');
select t.eq(t.line('tp-8-45'), 'falsch -3/-6/-9 gebucht -9 (0 von 7)', 'TC5 Remis-Tipp falsch: -3 - 6');
select t.eq(t.line('tp-8-47'), 'tendenz 5/-2/3 gebucht 3 (3 von 7)', 'TC6 Tendenz mit 300 Punkten: 5 - 2');
select t.eq(t.line('tp-8-48'), 'falsch -3/-4/-7 gebucht -2 (0 von 7)', 'TC7 Nur 2 Punkte: -7 gerechnet, -2 gebucht');
select from t.finish('tp-8', 1, 1) f1;
select t.eq(t.line('tp-8-45'), 'exakt 10/6/16 gebucht 16 (7 von 7)', 'TC8 Korrektur: Remis-Tipp jetzt exakt');
select t.eq(t.line('tp-8-41'), 'falsch -3/-1/-4 gebucht 0 (0 von 7)', 'TC9 Korrektur: 2:1 jetzt falsch, bei 0 nichts abgezogen');
select t.eq((select string_agg(t.rang(t.u(n), 'Fußball')::text, ',' order by n) from generate_series(41, 48) n),
  '0,15,45,45,116,144,294,14', 'TC10 Punktestände wie direkt mit 1:1');

\echo TEMPO-TESTS GRÜN
