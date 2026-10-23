-- ============================================================================
-- PoolTipp – Sportlerkarte nur für Freunde (Rene, 23.10.2026)
-- ============================================================================
-- "Wenn man mit wem befreundet ist, sollte man von demjenigen auch die Karte
-- sehen, und wenn nicht befreundet, dann nicht."
--
-- Bisher wählte jeder selbst: alle, nur Freunde oder niemand. Jetzt gilt für
-- alle dasselbe: die Karte sehen der Besitzer und seine Freunde (bestätigte
-- Freundschaft), sonst niemand, auch nicht ohne Login.
-- Die Prüfung selbst steht schon in sport_bio_of (supabase/sport-steckbrief.sql,
-- Fall 'friends'); hier wird nur die Sichtbarkeit fest auf 'friends' gesetzt.
--
-- Ausführen: Supabase-Dashboard -> SQL Editor -> New query -> dieses
-- komplette Skript einfügen -> "Run". Darf mehrfach ausgeführt werden.
-- Ändert nur die Sichtbarkeit, keine Karten-Inhalte. Keine neue Tabelle.
-- ============================================================================

begin;

-- Bestehende Karten: alle auf "nur Freunde".
update public.sport_bios set visibility = 'friends' where visibility <> 'friends';

alter table public.sport_bios alter column visibility set default 'friends';

-- Auch ältere App-Versionen, die noch "alle"/"niemand" schicken, landen bei
-- "nur Freunde". Eigener Trigger, damit ein erneutes Ausführen von
-- sport-steckbrief.sql das nicht wieder aufhebt.
create or replace function public.sport_bios_only_friends()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.visibility := 'friends';
  return new;
end;
$$;

drop trigger if exists sport_bios_only_friends on public.sport_bios;
create trigger sport_bios_only_friends
  before insert or update on public.sport_bios
  for each row execute function public.sport_bios_only_friends();

commit;
