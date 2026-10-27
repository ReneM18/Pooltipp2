-- PoolTipp – Kürbisse geben Pass-XP (Rene, 27.10.2026)
-- Einmal im Supabase SQL Editor ausführen (beliebig oft wiederholbar).
-- Braucht supabase/halloween-event.sql (läuft schon).
--
-- Saison-Pass und Halloween sind ein Fortschritt: jeder Kürbis gibt
-- zusätzlich +50 Pass-XP. Die Halloween-Belohnungen schalten weiter nach
-- Kürbis-Anzahl frei (2 / 5 / 10 / 16 / 23 / 30).
-- Schon gesammelte Kürbisse werden einmal nachgezahlt. Die Spalte xp_paid
-- merkt sich, welcher Kürbis seine XP schon bekommen hat, darum zahlt ein
-- zweiter Lauf nichts doppelt.
--
-- Zurück: die Funktion app_event_award aus halloween-event.sql nochmal
-- ausführen. Schon gezahlte XP bleiben dann.

begin;

alter table public.app_event_progress
  add column if not exists xp_paid boolean not null default false;

-- Kürbis gutschreiben + Pass-XP + erreichte Stufen eintragen (nur intern)
create or replace function public.app_event_award(p_user uuid, p_event text, p_art text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_today date := public.pooltipp_day(now());
  v_event record;
  v_points int;
  v_claimed jsonb;
  v_level record;
  v_key text;
begin
  if p_user is null then
    return;
  end if;
  select * into v_event from public.app_events where id = p_event;
  if not found or v_today < v_event.starts_on or v_today > v_event.ends_on then
    return;
  end if;

  insert into public.app_event_progress (user_id, event_id, day, art, xp_paid)
  values (p_user, p_event, v_today, p_art, true)
  on conflict do nothing;
  if not found then
    return; -- heute schon gutgeschrieben
  end if;

  select count(*)::int into v_points
  from public.app_event_progress where user_id = p_user and event_id = p_event;

  select coalesce(claimed_milestones, '[]'::jsonb) into v_claimed
  from public.profiles where id = p_user for update;
  if not found then
    return;
  end if;

  for v_level in
    select level from public.app_event_levels
    where event_id = p_event and points <= v_points
    order by level
  loop
    v_key := p_event || ':' || v_level.level;
    if not v_claimed @> jsonb_build_array(v_key) then
      v_claimed := v_claimed || jsonb_build_array(v_key);
    end if;
  end loop;

  update public.profiles
  set claimed_milestones = v_claimed, pass_xp = pass_xp + 50, updated_at = now()
  where id = p_user;
end;
$$;
revoke all on function public.app_event_award(uuid, text, text) from public, anon, authenticated;

-- Einmal nachzahlen: +50 Pass-XP für jeden Kürbis, der noch keine XP hatte.
lock table public.app_event_progress in share row exclusive mode;

update public.profiles p
set pass_xp = p.pass_xp + 50 * o.n, updated_at = now()
from (
  select user_id, count(*)::int as n
  from public.app_event_progress
  where not xp_paid
  group by user_id
) o
where p.id = o.user_id;

update public.app_event_progress set xp_paid = true where not xp_paid;

commit;
