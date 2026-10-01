-- ============================================================================
-- PoolTipp – Profil-Einstellungen dauerhaft speichern
-- ============================================================================
-- Speichert Dinge, die bisher nach dem Neuladen der Seite wieder weg waren:
-- Profilfotos, Foto-Sichtbarkeit, gewähltes Rang-Icon, Rahmenfarben,
-- Antworten auf Bonusfragen und das Tages-Einsatz-Limit.
--
-- Eigene Tabelle statt neuer Spalten in "profiles": Profile darf jeder lesen
-- (Rangliste), diese Einstellungen (z. B. private Fotos) aber nur man selbst.
--
-- Ausführen: Supabase-Dashboard -> SQL Editor -> "New query" -> dieses
-- komplette Skript einfügen -> "Run". Kann gefahrlos mehrfach laufen.
-- ============================================================================

create table if not exists public.profile_extras (
  id uuid primary key references auth.users(id) on delete cascade,
  photos jsonb,
  photo_visibility text,
  rank_icon_id text,
  frame_colors jsonb,
  bonus_answers jsonb,
  stake_state jsonb,
  updated_at timestamptz not null default now()
);

-- Nur der Besitzer darf seine Zeile lesen, anlegen und ändern.
alter table public.profile_extras enable row level security;

drop policy if exists "Eigene Einstellungen lesen" on public.profile_extras;
create policy "Eigene Einstellungen lesen" on public.profile_extras
  for select to authenticated using (auth.uid() = id);

drop policy if exists "Eigene Einstellungen anlegen" on public.profile_extras;
create policy "Eigene Einstellungen anlegen" on public.profile_extras
  for insert to authenticated with check (auth.uid() = id);

drop policy if exists "Eigene Einstellungen ändern" on public.profile_extras;
create policy "Eigene Einstellungen ändern" on public.profile_extras
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Grundrechte (ohne sie greifen die Regeln oben gar nicht erst).
grant usage on schema public to authenticated;
grant select, insert, update on public.profile_extras to authenticated;
revoke all on public.profile_extras from anon;

-- Kontrolle: sollte eine Zeile "profile_extras | true" zeigen.
select relname as tabelle, relrowsecurity as rls_aktiv
from pg_class
where oid = 'public.profile_extras'::regclass;
