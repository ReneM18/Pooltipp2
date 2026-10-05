-- ============================================================================
-- PoolTipp – Rankingsystem: Neustart der Rangpunkte
-- ============================================================================
-- Setzt die Rangpunkte ALLER Spieler in jeder Sportart auf 0, damit alle
-- im neuen Rankingsystem gleich starten.
--   - Vorher wird eine Sicherungskopie angelegt (Tabelle
--     rang_punkte_neustart_sicherung).
--   - Tipps bleiben, wie sie sind. Sie werden nur als "vor dem Neustart"
--     markiert, damit sie nicht mehr in die Wochen- und Saison-Summen zählen
--     und eine spätere Endstand-Korrektur keine Rangpunkte mehr bewegt.
--   - Sterne, Saison-XP, Pass und Rang-Icon-Auswahl bleiben unverändert.
--   - Läuft nur einmal: ein zweites Ausführen ändert nichts mehr.
--
-- Voraussetzung: supabase/rankingsystem.sql wurde schon ausgeführt.
-- Ausführen: Supabase-Dashboard -> SQL Editor -> New query -> dieses
-- komplette Skript einfügen -> "Run".
--
-- Zurückholen (nur im Notfall), alte Punkte aus der Sicherung:
--   update public.profiles p set rang_punkte = s.rang_punkte
--   from public.rang_punkte_neustart_sicherung s where s.id = p.id;
-- ============================================================================

begin;

do $$
begin
  if to_regclass('public.ranking_settings') is null then
    raise exception 'Bitte zuerst supabase/rankingsystem.sql ausführen, dann dieses Skript.';
  end if;
end $$;

-- 1) Sicherungskopie
create table if not exists public.rang_punkte_neustart_sicherung (
  id uuid primary key,
  display_name text,
  rang_punkte jsonb,
  gesichert_am timestamptz not null default now()
);
alter table public.rang_punkte_neustart_sicherung enable row level security;
revoke all on public.rang_punkte_neustart_sicherung from anon, authenticated;

do $$
declare
  v_players int;
begin
  if (select points_reset_at from public.ranking_settings where id) is not null then
    raise notice 'Der Neustart wurde schon gemacht, es wurde nichts geändert.';
    return;
  end if;

  insert into public.rang_punkte_neustart_sicherung (id, display_name, rang_punkte)
  select id, display_name, rang_punkte from public.profiles
  on conflict (id) do nothing;

  -- 2) Alte Tipps markieren (die Tipps selbst bleiben gleich)
  update public.tips set ranking_legacy = true
  where evaluated and result_tier is not null and not ranking_legacy;

  -- 3) Rangpunkte auf 0 (jede Sportart, die es beim Spieler gibt, plus die vier Standard-Sportarten)
  update public.profiles
  set rang_punkte = '{"Fußball":0,"NFL":0,"NBA":0,"NHL":0}'::jsonb || coalesce(
        (select jsonb_object_agg(e.key, 0)
         from jsonb_each(case when jsonb_typeof(rang_punkte) = 'object' then rang_punkte else '{}'::jsonb end) e),
        '{}'::jsonb),
      inactive_weeks = 0,
      updated_at = now();
  get diagnostics v_players = row_count;

  -- 4) Start merken (ab hier zählen auch die Wochen fürs Nicht-Tippen neu)
  update public.ranking_settings set points_reset_at = now(), started_at = now() where id;
  raise notice 'Neustart fertig: Rangpunkte von % Spielern auf 0 gesetzt, Sicherung angelegt.', v_players;
end $$;

commit;

-- Kontrolle: alte Punkte (Sicherung) und neue Punkte pro Spieler
select coalesce(p.display_name, 'Spieler') as spieler,
       s.rang_punkte as vorher,
       p.rang_punkte as jetzt
from public.profiles p
left join public.rang_punkte_neustart_sicherung s on s.id = p.id
order by p.display_name;
