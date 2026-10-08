-- Pass-Belohnungen selbst anlegen/ablegen + Deko anderer ausblenden
--
-- Profil -> Einstellungen -> Pass-Belohnungen:
--  1) Welchen Rahmen, Titel und welches Abzeichen man zeigt (oder keins),
--     und ob das Saison-Icon (Premium) neben dem Namen steht.
--     Gespeichert in profile_extras.pass_display (nur man selbst) und
--     zusätzlich in profiles.pass_display, damit andere es in Chat,
--     Rangliste und auf der Spielerseite sehen.
--  2) Schalter "Deko anderer Spieler": profile_extras.hide_others_deco
--     (nur die eigene Ansicht, den anderen bleibt alles).
-- Beides kommt binnen Sekunden auf allen offenen Geräten an (die Tabellen
-- sind schon im Sofort-Abgleich, wird hier zur Sicherheit nochmal gesetzt).
-- Bestehende Daten bleiben unverändert; leer = alles wie bisher.
-- Voraussetzung: profil-extras.sql wurde schon ausgeführt. Darf beliebig oft
-- ausgeführt werden.
-- Ausführen: Supabase-Dashboard -> SQL Editor -> New query -> dieses
-- komplette Skript einfügen -> "Run".

alter table public.profile_extras add column if not exists pass_display jsonb;
alter table public.profile_extras add column if not exists hide_others_deco boolean;
alter table public.profiles add column if not exists pass_display jsonb;

-- Nur ein kleines Objekt zulassen (Schutz gegen Riesen-Einträge).
alter table public.profile_extras drop constraint if exists profile_extras_pass_display_check;
alter table public.profile_extras add constraint profile_extras_pass_display_check
  check (pass_display is null or (jsonb_typeof(pass_display) = 'object' and octet_length(pass_display::text) <= 1000));
alter table public.profiles drop constraint if exists profiles_pass_display_check;
alter table public.profiles add constraint profiles_pass_display_check
  check (pass_display is null or (jsonb_typeof(pass_display) = 'object' and octet_length(pass_display::text) <= 1000));

-- Rechte: profile_extras nur der Besitzer; profiles lesen alle, ändern darf
-- jeder nur sein eigenes Profil (bestehende Richtlinie, RLS ist schon an).
alter table public.profile_extras enable row level security;
grant select, insert, update on public.profile_extras to authenticated;
revoke all on public.profile_extras from anon;
alter table public.profiles enable row level security;
grant select on public.profiles to anon, authenticated;
grant update (pass_display) on public.profiles to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.profile_extras;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.profiles;
exception when duplicate_object then null;
end $$;

-- Kontrolle: sollte drei Zeilen zeigen.
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and ((table_name = 'profile_extras' and column_name in ('pass_display', 'hide_others_deco'))
    or (table_name = 'profiles' and column_name = 'pass_display'))
order by table_name, column_name;
