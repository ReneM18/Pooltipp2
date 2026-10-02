-- ============================================================================
-- PoolTipp – Beispiel-Einträge erfundener Nutzer entfernen (OPTIONAL)
-- ============================================================================
-- Löscht nur die Beispiel-Kommentare, Feed-Einträge und Chat-Nachrichten von
-- "Marco T.", "Sabine K." und "Jonas H.", die social-features.sql beim
-- Einrichten angelegt hat, dazu die erfundenen Laufband-Meldungen und das
-- Beispiel-Turnier "Spieltag-Spezial". Echte Einträge echter Nutzer und im
-- Admin-Bereich geänderte Meldungen/Turniere bleiben unberührt.
--
-- Ausführen: Supabase-Dashboard -> SQL Editor -> "New query" -> dieses
-- komplette Skript einfügen -> "Run". Kann gefahrlos mehrfach laufen.
-- ============================================================================

delete from public.match_comments
where user_id is null and id in ('comment-1', 'comment-2', 'comment-3');

delete from public.activity_feed
where user_id is null and id in ('activity-1', 'activity-2', 'activity-3', 'activity-4', 'activity-5');

delete from public.chat_messages
where user_id is null and id in ('chat-1', 'chat-2');

-- Laufband: nur, solange noch der ursprüngliche Beispiel-Text drinsteht.
delete from public.news
where (id = 'news-1' and data->>'text' = 'Bayern führt weiter die Bundesliga-Tabelle an')
   or (id = 'news-2' and data->>'text' = 'Neu im Prämien-Shop: der Titel „Tipp-König“')
   or (id = 'news-3' and data->>'text' = 'Sabine K. verteidigt Platz 1 in der Rangliste')
   or (id = 'news-4' and data->>'text' = 'Über 500.000 Sterne wurden diesen Spieltag verteilt');

delete from public.tournaments
where id = 'tournament-demo' and data->>'name' = 'Spieltag-Spezial';

-- Kontrolle: sollte überall 0 zeigen.
select
  (select count(*) from public.match_comments where id in ('comment-1', 'comment-2', 'comment-3')) as beispiel_kommentare,
  (select count(*) from public.activity_feed where id like 'activity-_') as beispiel_feed,
  (select count(*) from public.chat_messages where id in ('chat-1', 'chat-2')) as beispiel_chat,
  (select count(*) from public.news where id in ('news-1', 'news-2', 'news-3', 'news-4')) as beispiel_laufband,
  (select count(*) from public.tournaments where id = 'tournament-demo') as beispiel_turnier;
