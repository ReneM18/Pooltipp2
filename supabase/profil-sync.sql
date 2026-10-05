-- Einstellungen sofort auf jedem Gerät
--
-- Was dieses Skript einrichtet:
--  1) Der Schalter "Saison-Design an/aus" wird fürs Konto gespeichert (bisher
--     nur im Browser, galt also nur auf einem Gerät), ebenso "Premium
--     kostenlos testen" (bisher nach jedem Neuladen wieder aus). Bezahlt wird
--     weiterhin nichts.
--  2) Sofort-Abgleich: Änderungen an Profil-Einstellungen (Fotos,
--     Foto-Sichtbarkeit, Rang-Icon, Rahmenfarben, Saison-Design, Premium-Test) und am
--     Herzensverein melden sich binnen Sekunden auf allen offenen Geräten
--     (Supabase Realtime). Jeder sieht dabei nur seine eigenen Zeilen
--     (bestehende Zugriffsregeln). Name, Coins und Tipps kommen schon über
--     supabase/tipp-zuruecknehmen.sql.
--
-- Bestehende Einstellungen bleiben unverändert; die neue Spalte ist leer, bis
-- jemand die App öffnet (dann wird die Wahl seines Geräts übernommen).
-- Voraussetzung: profil-extras.sql und vereinswertung.sql wurden schon
-- ausgeführt. Darf beliebig oft ausgeführt werden.
-- Ausführen: Supabase-Dashboard -> SQL Editor -> New query -> dieses
-- komplette Skript einfügen -> "Run".

alter table public.profile_extras add column if not exists season_design_off boolean;
alter table public.profile_extras add column if not exists premium_trial boolean not null default false;

-- Rechte wie bisher: nur der Besitzer liest und schreibt seine Zeile.
grant select, insert, update on public.profile_extras to authenticated;
revoke all on public.profile_extras from anon;

do $$ begin
  alter publication supabase_realtime add table public.profile_extras;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.club_fans;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.club_settings;
exception when duplicate_object then null;
end $$;
