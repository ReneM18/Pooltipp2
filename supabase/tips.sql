-- Legt die "tips"-Tabelle an: eine Zeile pro abgegebenem Tipp eines
-- registrierten Users (Vorhersage + Einsatz + später die PoolScore-
-- Auswertung). Wird von lib/UserContext.tsx gelesen und beschrieben.
--
-- Ausführen: Supabase-Dashboard -> SQL Editor -> Neues Query -> dieses
-- komplette Skript einfügen -> "Run".

create table if not exists public.tips (
  -- Gleiche id wie im Browser (z. B. "tip-1234567890"), kein eigener
  -- Zähler nötig – so kann direkt per id aktualisiert werden (upsert),
  -- statt Duplikate zu erzeugen.
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id text not null,
  predicted_home_score integer not null,
  predicted_away_score integer not null,
  stake integer not null,
  submitted_at timestamptz not null,
  -- Auswertung (PoolScore) – erst gesetzt, sobald der Admin das Spiel
  -- beendet und ausgewertet hat.
  evaluated boolean not null default false,
  result_tier text,
  rang_delta integer,
  stars_delta integer,
  beat_percent numeric,
  narration text,
  updated_at timestamptz not null default now()
);

-- Schnellere Abfrage "alle Tipps von User X" beim Laden nach dem Login.
create index if not exists tips_user_id_idx on public.tips(user_id);

-- Row Level Security: jeder darf NUR seine eigenen Tipps lesen/anlegen/
-- ändern, nie die von anderen Usern.
alter table public.tips enable row level security;

drop policy if exists "Eigene Tipps lesen" on public.tips;
create policy "Eigene Tipps lesen" on public.tips
  for select using (auth.uid() = user_id);

drop policy if exists "Eigene Tipps anlegen" on public.tips;
create policy "Eigene Tipps anlegen" on public.tips
  for insert with check (auth.uid() = user_id);

drop policy if exists "Eigene Tipps aktualisieren" on public.tips;
create policy "Eigene Tipps aktualisieren" on public.tips
  for update using (auth.uid() = user_id);
