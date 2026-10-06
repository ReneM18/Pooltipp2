-- Tests für supabase/pass-ohne-coins.sql (nur Test-Datenbank). Läuft am
-- Ende von run.sh (nutzt t.eq/t.u/t.stars).
\set ON_ERROR_STOP 1

create table t.posnap as select id, free_stars, pass_xp, claimed_milestones from public.profiles;
set client_min_messages = warning;
\o /dev/null
\i supabase/pass-ohne-coins.sql
\i supabase/pass-ohne-coins.sql
\o
set client_min_messages = notice;
select t.eq((select count(*)::int from (select * from t.posnap except
  select id, free_stars, pass_xp, claimed_milestones from public.profiles) x), 0, 'PO1 Coins, XP und erreichte Level unverändert');
select t.eq((select coalesce(sum(stars_reward), 0)::int from public.season_pass_levels), 0, 'PO2 Kein Pass-Level gibt Coins');

-- Level 10 erreichen: Abzeichen ja, Coins nein
select from t.ruser(84, 0) a;
update public.profiles set pass_xp = 6000, free_stars = 100,
  claimed_milestones = '[]'::jsonb, pass_season_id = public.current_pass_season_id()
where id = t.u(84);
select from public.claim_pass_rewards(t.u(84)) a;
select t.eq(t.stars(t.u(84)), 100, 'PO3 Level 10 erreicht: keine Coins');
select t.eq((select claimed_milestones @> jsonb_build_array(public.current_pass_season_id() || ':10')
  from public.profiles where id = t.u(84)), true, 'PO4 Level 10 trotzdem eingetragen');
select t.expect_error($$insert into public.season_pass_levels (season_id, level, xp_required, stars_reward)
  values ('test-saison', 1, 0, 25)$$, 'PO5 Neue Saison kann keine Coins eintragen');
\echo PASS-OHNE-COINS-TESTS GRÜN
