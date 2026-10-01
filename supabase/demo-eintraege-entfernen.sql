-- ============================================================================
-- PoolTipp – Beispiel-Einträge erfundener Nutzer entfernen (OPTIONAL)
-- ============================================================================
-- Löscht nur die Beispiel-Kommentare, Feed-Einträge und Chat-Nachrichten von
-- "Marco T.", "Sabine K." und "Jonas H.", die social-features.sql beim
-- Einrichten angelegt hat. Echte Einträge echter Nutzer bleiben unberührt.
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

-- Kontrolle: sollte überall 0 zeigen.
select
  (select count(*) from public.match_comments where id in ('comment-1', 'comment-2', 'comment-3')) as beispiel_kommentare,
  (select count(*) from public.activity_feed where id like 'activity-_') as beispiel_feed,
  (select count(*) from public.chat_messages where id in ('chat-1', 'chat-2')) as beispiel_chat;
