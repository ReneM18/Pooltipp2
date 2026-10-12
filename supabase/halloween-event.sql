-- PoolTipp – Halloween-Event 2026 (Rene, 12.10.2026)
-- Einmal im Supabase SQL Editor ausführen (beliebig oft wiederholbar).
--
-- Läuft vom 15.10. bis 1.11.2026 (österreichische Zeit) zusätzlich zum
-- Saison-Pass. Man sammelt Kürbisse:
--   +1 an jedem Tag, an dem man in die App kommt
--   +1 an jedem Tag, an dem man mindestens einen Tipp abgibt
-- Die Stufen (2 / 5 / 10 / 16 / 23 / 30 Kürbisse) werden wie beim Saison-Pass
-- als "halloween-2026:1" … ":6" in profiles.claimed_milestones eingetragen –
-- so zeigt die App Sticker, Titel, Abzeichen und Rahmen überall (auch anderen
-- Spielern) und man behält sie nach dem Event.
-- Keine Coins, keine Joker (Pass-Regel). Bestehende Tipps, Coins, XP und
-- Rangpunkte bleiben unverändert. Ein Fehler hier blockiert nie einen Tipp.

begin;

-- 1) Events und ihre Stufen
create table if not exists public.app_events (
  id text primary key,
  starts_on date not null,
  ends_on date not null
);
alter table public.app_events enable row level security;
drop policy if exists "Events lesen" on public.app_events;
create policy "Events lesen" on public.app_events for select using (true);
revoke all on public.app_events from anon, authenticated;
grant select on public.app_events to anon, authenticated;

create table if not exists public.app_event_levels (
  event_id text not null references public.app_events(id) on delete cascade,
  level int not null,
  points int not null,
  primary key (event_id, level)
);
alter table public.app_event_levels enable row level security;
drop policy if exists "Event-Stufen lesen" on public.app_event_levels;
create policy "Event-Stufen lesen" on public.app_event_levels for select using (true);
revoke all on public.app_event_levels from anon, authenticated;
grant select on public.app_event_levels to anon, authenticated;

insert into public.app_events (id, starts_on, ends_on)
values ('halloween-2026', date '2026-10-15', date '2026-11-01')
on conflict (id) do update set starts_on = excluded.starts_on, ends_on = excluded.ends_on;

insert into public.app_event_levels (event_id, level, points) values
  ('halloween-2026', 1, 2),
  ('halloween-2026', 2, 5),
  ('halloween-2026', 3, 10),
  ('halloween-2026', 4, 16),
  ('halloween-2026', 5, 23),
  ('halloween-2026', 6, 30)
on conflict (event_id, level) do update set points = excluded.points;

-- 2) Gesammelte Kürbisse: eine Zeile pro Tag und Art (login / tipp)
create table if not exists public.app_event_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_id text not null references public.app_events(id) on delete cascade,
  day date not null,
  art text not null check (art in ('login', 'tipp')),
  primary key (user_id, event_id, day, art)
);
alter table public.app_event_progress enable row level security;
drop policy if exists "Eigene Kürbisse sehen" on public.app_event_progress;
create policy "Eigene Kürbisse sehen" on public.app_event_progress
  for select to authenticated using (user_id = auth.uid());
revoke all on public.app_event_progress from anon, authenticated;
grant select on public.app_event_progress to authenticated;

-- 3) Kürbis gutschreiben + erreichte Stufen eintragen (nur intern)
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

  insert into public.app_event_progress (user_id, event_id, day, art)
  values (p_user, p_event, v_today, p_art)
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
  set claimed_milestones = v_claimed, updated_at = now()
  where id = p_user and claimed_milestones is distinct from v_claimed;
end;
$$;

-- 4) Stand fürs eigene Konto (Reiter "Halloween" auf der Seite Fortschritt)
create or replace function public.my_event_status(p_event text)
returns jsonb
language sql
stable
security definer set search_path = public
as $$
  select jsonb_build_object(
    'points', (select count(*) from public.app_event_progress where user_id = auth.uid() and event_id = p_event),
    'login_today', exists (
      select 1 from public.app_event_progress
      where user_id = auth.uid() and event_id = p_event and day = public.pooltipp_day(now()) and art = 'login'
    ),
    'tipp_today', exists (
      select 1 from public.app_event_progress
      where user_id = auth.uid() and event_id = p_event and day = public.pooltipp_day(now()) and art = 'tipp'
    )
  );
$$;

-- 5) Kürbis fürs Reinschauen (ruft die App beim Öffnen auf)
create or replace function public.claim_event_day(p_event text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht eingeloggt';
  end if;
  perform public.app_event_award(auth.uid(), p_event, 'login');
  return public.my_event_status(p_event);
end;
$$;

-- 6) Kürbis fürs Tippen: bei jedem neuen Tipp (höchstens einer pro Tag).
--    Läuft das Event nicht oder geht etwas schief, passiert einfach nichts.
create or replace function public.app_event_on_tip()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_event record;
begin
  begin
    for v_event in
      select id from public.app_events
      where public.pooltipp_day(now()) between starts_on and ends_on
    loop
      perform public.app_event_award(new.user_id, v_event.id, 'tipp');
    end loop;
  exception when others then
    null;
  end;
  return new;
end;
$$;
drop trigger if exists app_event_on_tip on public.tips;
create trigger app_event_on_tip after insert on public.tips
  for each row execute function public.app_event_on_tip();

revoke all on function public.app_event_award(uuid, text, text) from public, anon, authenticated;
revoke all on function public.app_event_on_tip() from public, anon, authenticated;
revoke all on function public.my_event_status(text) from public, anon;
revoke all on function public.claim_event_day(text) from public, anon;
grant execute on function public.my_event_status(text) to authenticated;
grant execute on function public.claim_event_day(text) to authenticated;

commit;

-- Live-Stand per Realtime (Fehler "already member" ist egal).
do $$
begin
  alter publication supabase_realtime add table public.app_event_progress;
exception when duplicate_object then null;
end $$;
