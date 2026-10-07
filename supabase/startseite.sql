-- Startseite wählbar (Profil -> Einstellungen -> Startseite)
--
-- Speichert fürs Konto, welche Seite die App beim Öffnen zeigt: Tipps,
-- Matchcenter, Saison-Pass oder Rangliste. Gilt dann auf jedem Gerät, und
-- eine Änderung kommt binnen Sekunden auf allen offenen Geräten an (die
-- Tabelle ist schon im Sofort-Abgleich, siehe profil-sync.sql).
-- Bestehende Einstellungen bleiben unverändert; leer = Tipps wie bisher.
-- Voraussetzung: profil-extras.sql wurde schon ausgeführt. Darf beliebig oft
-- ausgeführt werden.
-- Ausführen: Supabase-Dashboard -> SQL Editor -> New query -> dieses
-- komplette Skript einfügen -> "Run".

alter table public.profile_extras add column if not exists start_page text;

alter table public.profile_extras drop constraint if exists profile_extras_start_page_check;
alter table public.profile_extras add constraint profile_extras_start_page_check
  check (start_page is null or start_page in ('/', '/matchcenter', '/fortschritt', '/rangliste'));

-- Rechte wie bisher: nur der Besitzer liest und schreibt seine Zeile.
alter table public.profile_extras enable row level security;
grant select, insert, update on public.profile_extras to authenticated;
revoke all on public.profile_extras from anon;

do $$ begin
  alter publication supabase_realtime add table public.profile_extras;
exception when duplicate_object then null;
end $$;
