-- Test-Stand "wie live vor auswertung-server.sql": Spieler, deren Tipps teils
-- vom alten Browser-Code ausgewertet wurden (alte Rangpunkte-Regel, alte
-- 1X2-Regel), teils noch offen sind. Nur für die Test-Datenbank.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'rene.cr7@gmx.at', '{"display_name":"Rene"}'),
  ('00000000-0000-0000-0000-00000000000b', 'anna@test.at', '{"display_name":"Anna"}'),
  ('00000000-0000-0000-0000-00000000000c', 'bob@test.at', '{"display_name":"Bob"}'),
  ('00000000-0000-0000-0000-00000000000d', 'cara@test.at', '{"display_name":"Cara"}'),
  ('00000000-0000-0000-0000-00000000000e', 'dora@test.at', '{"display_name":"Dora"}');

delete from public.matches;
insert into public.matches (id, data) values
  ('m-alt', jsonb_build_object('id','m-alt','sport','Fußball','tipMode','score','fixedStake',20,'status','finished',
     'liveHomeScore',2,'liveAwayScore',1,'kickoff',now() - interval '1 day','tipDeadline',now() - interval '1 day 30 minutes',
     'homeTeamId','team-fcb','awayTeamId','team-bvb')),
  ('m-alt-1x2', jsonb_build_object('id','m-alt-1x2','sport','NFL','tipMode','1x2','fixedStake',20,'status','finished',
     'liveHomeScore',1,'liveAwayScore',0,'kickoff',now() - interval '2 days','tipDeadline',now() - interval '2 days 15 minutes',
     'homeTeamId','team-bills','awayTeamId','team-chiefs')),
  ('m-bonus-alt', jsonb_build_object('id','m-bonus-alt','sport','Fußball','tipMode','score','fixedStake',20,'status','upcoming',
     'liveHomeScore',null,'liveAwayScore',null,'kickoff',now() + interval '3 days','tipDeadline',now() + interval '3 days',
     'bonusQuestion', jsonb_build_object('question','Wer trifft zuerst?','options',jsonb_build_array('Heim','Gast','Keiner'),
        'correctOptionIndex',1,'bonusStars',15)));

update public.profiles set free_stars = 200, pass_xp = 300,
  rang_punkte = '{"Fußball":16,"NFL":0,"NBA":0,"NHL":0}', claimed_milestones = '["herbst-2026:1"]'
where id = '00000000-0000-0000-0000-00000000000b';
update public.profiles set free_stars = 80 where id = '00000000-0000-0000-0000-00000000000c';
update public.profiles set free_stars = 105, rang_punkte = '{"Fußball":0,"NFL":10,"NBA":0,"NHL":0}'
where id = '00000000-0000-0000-0000-00000000000d';
update public.profiles set pass_xp = 6000,
  claimed_milestones = '[3, "herbst-2026:1","herbst-2026:2","herbst-2026:3","herbst-2026:4","herbst-2026:5","herbst-2026:6","herbst-2026:7","herbst-2026:8","herbst-2026:9"]'
where id = '00000000-0000-0000-0000-00000000000e';

-- Trigger aus, sonst verwirft freeze_tip_after_kickoff Tipps auf vergangene Spiele.
set session_replication_role = replica;
insert into public.tips (id, user_id, match_id, predicted_home_score, predicted_away_score, stake, submitted_at,
                         evaluated, result_tier, rang_delta, stars_delta, beat_percent, narration, evaluated_home_score, evaluated_away_score) values
  ('t-a1', '00000000-0000-0000-0000-00000000000b', 'm-alt', 2, 1, 20, now() - interval '2 days', true, 'exakt', 16, 10, 46, 'alt', 2, 1),
  ('t-b1', '00000000-0000-0000-0000-00000000000c', 'm-alt', 1, 0, 20, now() - interval '2 days', false, null, null, null, null, null, null, null),
  ('t-c1', '00000000-0000-0000-0000-00000000000d', 'm-alt-1x2', 1, 0, 20, now() - interval '3 days', true, 'exakt', 10, 5, null, 'alt', 1, 0);
set session_replication_role = origin;

insert into public.profile_extras (id, stake_state, bonus_answers) values
  ('00000000-0000-0000-0000-00000000000d', '{"rescueBonusUsed":true,"stakedToday":0}',
   jsonb_build_array(jsonb_build_object('id','bonus-c1','matchId','m-bonus-alt','optionIndex',1,'submittedAt',now() - interval '1 hour'))),
  ('00000000-0000-0000-0000-00000000000c', '{"rescueBonusUsed":false}',
   jsonb_build_array(jsonb_build_object('id','bonus-b1','matchId','m-bonus-alt','optionIndex',1,'submittedAt',now() - interval '1 hour',
                                        'evaluated',true,'correct',true,'starsDelta',15)));
