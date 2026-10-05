-- ============================================================================
-- PoolTipp – Gewähltes Rang-Icon für alle sichtbar
-- ============================================================================
-- Bisher stand das im Profil gewählte Rang-Icon nur in "profile_extras", die
-- nur man selbst lesen darf. Andere Spieler sahen deshalb immer automatisch
-- das stärkste Icon. Jetzt steht die Auswahl zusätzlich in "profiles"
-- (lesen darf jeder, ändern nur man selbst), damit Rangliste, Chat und
-- Spielerseite sie anzeigen.
--
-- Ausführen: Supabase-Dashboard -> SQL Editor -> "New query" -> dieses
-- komplette Skript einfügen -> "Run". Kann gefahrlos mehrfach laufen.
-- Bestehende Daten bleiben erhalten; eine schon getroffene Auswahl wird
-- übernommen.
-- ============================================================================

alter table public.profiles add column if not exists rank_icon_id text;

-- Nur bekannte Icons zulassen (eins pro Sportart, Legende, Unsterblich).
alter table public.profiles drop constraint if exists profiles_rank_icon_id_check;
alter table public.profiles add constraint profiles_rank_icon_id_check check (
  rank_icon_id is null
  or rank_icon_id in ('sport-Fußball', 'sport-NFL', 'sport-NBA', 'sport-NHL', 'elite', 'unsterblich')
);

-- Bisherige Auswahl aus profile_extras übernehmen (falls die Tabelle existiert).
do $$
begin
  if to_regclass('public.profile_extras') is not null then
    update public.profiles p
    set rank_icon_id = e.rank_icon_id
    from public.profile_extras e
    where e.id = p.id
      and p.rank_icon_id is null
      and e.rank_icon_id in ('sport-Fußball', 'sport-NFL', 'sport-NBA', 'sport-NHL', 'elite', 'unsterblich');
  end if;
end $$;

-- Rechte: Lesen dürfen alle (Rangliste), ändern nur eingeloggte Spieler ihr
-- eigenes Profil – das regelt die bestehende Richtlinie
-- "Eigenes Profil aktualisieren" (RLS ist auf profiles schon an).
alter table public.profiles enable row level security;
grant select on public.profiles to anon, authenticated;
grant update (rank_icon_id) on public.profiles to authenticated;

-- Kontrolle: zeigt, wer schon ein Icon gewählt hat.
select display_name, rank_icon_id from public.profiles order by display_name;
