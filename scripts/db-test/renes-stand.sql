-- Nachbau von Renes Live-Stand vor auswertung-server.sql (nur Test-Datenbank):
-- nur die SQLs, die Rene wirklich ausgeführt hat (ohne profil-extras, freunde,
-- spiel-absagen, Rangpunkte-/1X2-Korrektur), zwei Spieler mit ausgewerteten
-- und offenen Tipps, einem laufenden Duell und einem angepfiffenen Spiel.
-- Aufruf siehe renes-stand.sh.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'rene.cr7@gmx.at', '{"display_name":"Rene"}'),
  ('00000000-0000-0000-0000-0000000000d0', 'doris@test.at', '{"display_name":"Doris"}');

delete from public.matches;
insert into public.teams (id, data) values
  ('team-x', '{"id":"team-x","name":"Renes Team"}') on conflict do nothing;

set session_replication_role = replica;
insert into public.matches (id, data) values
  -- Beendet, von beiden Browsern schon ausgewertet (alte Rangpunkte-Regel).
  ('m-fertig', jsonb_build_object('id','m-fertig','sport','Fußball','tipMode','score','fixedStake',20,'status','finished',
     'liveHomeScore',2,'liveAwayScore',1,'kickoff',now() - interval '3 days','tipDeadline',now() - interval '3 days')),
  -- Beendet, aber noch nicht ausgewertet (keiner hat seither die App geöffnet).
  ('m-offen', jsonb_build_object('id','m-offen','sport','Fußball','tipMode','score','fixedStake',20,'status','finished',
     'liveHomeScore',1,'liveAwayScore',1,'kickoff',now() - interval '1 day','tipDeadline',now() - interval '1 day')),
  -- Beendetes 1X2-Spiel, mit der alten 1X2-Regel ausgewertet (richtig = nur Einsatz zurück).
  ('m-1x2', jsonb_build_object('id','m-1x2','sport','NFL','tipMode','1x2','fixedStake',20,'status','finished',
     'liveHomeScore',24,'liveAwayScore',17,'kickoff',now() - interval '2 days','tipDeadline',now() - interval '2 days')),
  -- Angepfiffen, läuft gerade, mit Duell.
  ('m-live', jsonb_build_object('id','m-live','sport','Fußball','tipMode','score','fixedStake',20,'status','live',
     'liveHomeScore',0,'liveAwayScore',0,'kickoff',now() - interval '30 minutes','tipDeadline',now() - interval '30 minutes')),
  -- Kommt noch, mit offener Duell-Anfrage.
  ('m-bald', jsonb_build_object('id','m-bald','sport','Fußball','tipMode','score','fixedStake',20,'status','upcoming',
     'kickoff',now() + interval '2 days','tipDeadline',now() + interval '2 days'));

insert into public.tips (id, user_id, match_id, predicted_home_score, predicted_away_score, stake, submitted_at,
                         evaluated, result_tier, rang_delta, stars_delta, beat_percent, narration, evaluated_home_score, evaluated_away_score) values
  ('r-fertig', '00000000-0000-0000-0000-00000000000a', 'm-fertig', 2, 1, 20, now() - interval '4 days', true, 'exakt', 23, 10, 80, 'alt', 2, 1),
  ('d-fertig', '00000000-0000-0000-0000-0000000000d0', 'm-fertig', 1, 0, 20, now() - interval '4 days', true, 'tendenz', 9, 0, 40, 'alt', 2, 1),
  ('r-offen',  '00000000-0000-0000-0000-00000000000a', 'm-offen', 0, 2, 20, now() - interval '2 days', false, null, null, null, null, null, null, null),
  ('d-offen',  '00000000-0000-0000-0000-0000000000d0', 'm-offen', 1, 1, 20, now() - interval '2 days', false, null, null, null, null, null, null, null),
  ('r-1x2',    '00000000-0000-0000-0000-00000000000a', 'm-1x2', 1, 0, 20, now() - interval '3 days', true, 'tendenz', 6, 0, null, 'alt', 24, 17),
  ('d-1x2',    '00000000-0000-0000-0000-0000000000d0', 'm-1x2', 0, 1, 20, now() - interval '3 days', true, 'falsch', 0, -10, null, 'alt', 24, 17),
  ('r-live',   '00000000-0000-0000-0000-00000000000a', 'm-live', 1, 1, 20, now() - interval '1 day', false, null, null, null, null, null, null, null),
  ('d-live',   '00000000-0000-0000-0000-0000000000d0', 'm-live', 2, 0, 20, now() - interval '1 day', false, null, null, null, null, null, null, null),
  ('r-bald',   '00000000-0000-0000-0000-00000000000a', 'm-bald', 3, 1, 20, now() - interval '1 hour', false, null, null, null, null, null, null, null);

insert into public.duels (id, challenger_id, challenger_name, opponent_id, opponent_name, match_id, stake, status, created_at) values
  ('duell-live', '00000000-0000-0000-0000-00000000000a', 'Rene', '00000000-0000-0000-0000-0000000000d0', 'Doris', 'm-live', 10, 'offen', now() - interval '1 day'),
  ('duell-bald', '00000000-0000-0000-0000-0000000000d0', 'Doris', '00000000-0000-0000-0000-00000000000a', 'Rene', 'm-bald', 15, 'pending', now() - interval '1 hour');

insert into public.leagues (id, name, description, code, scoring_mode, creator_id) values
  ('11111111-1111-1111-1111-111111111111', 'Renes Runde', 'Test', 'ABC123', 'ergebnis', '00000000-0000-0000-0000-00000000000a');
insert into public.league_members (league_id, user_id) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000a'), ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-0000000000d0');
insert into public.chat_messages (id, user_id, author_name, text)
  values ('chat-test-rene', '00000000-0000-0000-0000-00000000000a', 'Rene', 'Hallo Doris');
set session_replication_role = origin;

-- Kontostände, wie der alte Browser sie gespeichert hat (Rangpunkte noch mit
-- Demo-Anteil, XP aus Tagesbonus).
update public.profiles set free_stars = 245, rang_punkte = '{"Fußball":980,"NFL":6,"NBA":0,"NHL":0}', pass_xp = 1180,
  streak_count = 2, claimed_milestones = '["herbst-2026:1","herbst-2026:2","herbst-2026:3","herbst-2026:4"]'
where id = '00000000-0000-0000-0000-00000000000a';
update public.profiles set free_stars = 70, rang_punkte = '{"Fußball":9,"NFL":0,"NBA":0,"NHL":0}', pass_xp = 300
where id = '00000000-0000-0000-0000-0000000000d0';
