-- PoolTipp – Online-Status in der Freundesliste (Rene, 12.10.2026)
-- Einmal im Supabase SQL Editor ausführen (beliebig oft wiederholbar).
--
-- Neue Einstellung pro Konto: "Online-Status zeigen" (Standard: an). Wer sie
-- ausschaltet, meldet sich in der App gar nicht als online. Wer gerade online
-- ist, läuft über Supabase Realtime (Presence), dafür braucht es keine Tabelle.
-- Bestehende Daten werden nicht verändert.

alter table public.profile_extras add column if not exists show_online boolean not null default true;
