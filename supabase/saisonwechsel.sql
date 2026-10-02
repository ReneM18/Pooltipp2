-- ============================================================================
-- PoolTipp – Saisonwechsel: Saison-XP pro Saison
-- ============================================================================
-- Merkt sich pro Spieler, zu welcher Saison seine Saison-XP (pass_xp)
-- gehören. Öffnet ein Spieler die App nach einem Saisonwechsel zum ersten
-- Mal, setzt start_pass_season() seine XP EINMAL auf 0 und stellt ihn auf die
-- neue Saison um. Erreichte Level, Titel und Abzeichen bleiben erhalten (sie
-- stehen getrennt davon in claimed_milestones, z. B. "herbst-2026:10").
--
-- Ausführen: Supabase -> SQL Editor -> New query -> alles einfügen -> Run.
-- Kann gefahrlos mehrfach ausgeführt werden.
-- ============================================================================

-- 1) Neue Spalten: Saison der aktuellen XP und deren Starttag.
alter table public.profiles
  add column if not exists pass_season_id text,
  add column if not exists pass_season_start date;

-- 2) Alle bisherigen XP gehören zum Herbst 2026 (die erste Saison).
update public.profiles
set pass_season_id = 'herbst-2026', pass_season_start = date '2026-09-23'
where pass_season_id is null;

-- 3) Saisonwechsel für den eingeloggten Spieler.
--    Die App schickt die Saison, die laut Datum gerade läuft. Zurückgesetzt
--    wird nur, wenn
--      - es wirklich eine andere Saison ist als die gespeicherte,
--      - sie laut Server-Uhr (österreichische Zeit) schon begonnen hat
--        (falsch gestellte Handy-Uhr kann nicht zu früh zurücksetzen),
--      - sie NEUER ist als die gespeicherte (nie zurück in eine alte Saison).
--    "for update" sperrt die Zeile: öffnet jemand die App gleichzeitig auf
--    zwei Geräten, wird trotzdem nur einmal zurückgesetzt.
--    Läuft als SECURITY DEFINER (wie add_stars): funktioniert auch dann noch,
--    wenn die App pass_xp später nicht mehr direkt schreiben darf.
create or replace function public.start_pass_season(p_season_id text, p_starts_on date)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_today date := (now() at time zone 'Europe/Vienna')::date;
begin
  if auth.uid() is null then
    raise exception 'Nicht eingeloggt';
  end if;
  if p_season_id is null or p_season_id !~ '^[a-z]+-[0-9]{4}$' or p_starts_on is null then
    raise exception 'Ungültige Saison';
  end if;

  select * into v_profile from public.profiles where id = auth.uid() for update;
  if not found then
    return jsonb_build_object('pass_xp', 0, 'pass_season_id', null, 'reset', false);
  end if;

  if v_profile.pass_season_id is distinct from p_season_id
     and p_starts_on <= v_today
     and (v_profile.pass_season_start is null or p_starts_on > v_profile.pass_season_start)
  then
    update public.profiles
    set pass_xp = 0,
        pass_season_id = p_season_id,
        pass_season_start = p_starts_on,
        updated_at = now()
    where id = auth.uid();
    return jsonb_build_object('pass_xp', 0, 'pass_season_id', p_season_id, 'reset', true);
  end if;

  return jsonb_build_object(
    'pass_xp', v_profile.pass_xp,
    'pass_season_id', v_profile.pass_season_id,
    'reset', false
  );
end;
$$;

revoke execute on function public.start_pass_season(text, date) from public, anon;
grant execute on function public.start_pass_season(text, date) to authenticated;

-- 4) Saison-Spalten vor dem Browser schützen: sonst könnte jemand vor dem
--    Wechsel schon "winter-2026" eintragen und so seine Herbst-XP in den
--    Winter mitnehmen. Ändern darf sie nur start_pass_season() (läuft als
--    Datenbank-Besitzer) und der SQL Editor.
create or replace function public.protect_pass_season_columns()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.pass_season_id := null;
      new.pass_season_start := null;
    else
      new.pass_season_id := old.pass_season_id;
      new.pass_season_start := old.pass_season_start;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_pass_season_columns on public.profiles;
create trigger protect_pass_season_columns
  before insert or update on public.profiles
  for each row execute function public.protect_pass_season_columns();

-- 5) Zu welcher Saison gehören die XP des eingeloggten Spielers? Wird von der
--    serverseitigen Saison-Pass-Auswertung (claim_pass_rewards) benutzt, damit
--    Level immer in der Saison eingetragen werden, zu der die XP gehören.
create or replace function public.current_pass_season_id()
returns text
language sql
stable
security definer set search_path = public
as $$
  select coalesce(
    (select pass_season_id from public.profiles where id = auth.uid()),
    'herbst-2026'
  );
$$;

grant execute on function public.current_pass_season_id() to authenticated;
