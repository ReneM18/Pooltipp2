-- ============================================================================
-- PoolTipp – Vereinswertung (Herzensverein pro Sportart)
-- ============================================================================
-- Jeder Spieler kann pro Sportart (Fußball, NFL, NBA, NHL) freiwillig einen
-- Herzensverein wählen und mit seinen Tipps für ihn spielen. Pro Sportart
-- gibt es eine eigene Vereinstabelle.
--
-- Regeln (alle in der Datenbank gerechnet, nicht im Browser fälschbar):
--   - Tipp-Punkte: exaktes Ergebnis 3, richtige Tendenz 1, falsch 0.
--     Bei 1X2-Spielen (nur Sieg/Unentschieden/Niederlage) gibt ein richtiger
--     Tipp 2 Punkte.
--   - Es zählen nur Tipps auf Spiele dieser Sportart, die beendet sind, in
--     der laufenden Saison (1. Juli bis 30. Juni) und die NACH der Wahl des
--     Herzensvereins angepfiffen wurden.
--   - Aktiver Fan = mindestens 3 gewertete Tipps in dieser Saison.
--   - Pro Fan zählt sein Schnitt pro Tipp. Vereinswert = Durchschnitt aller
--     aktiven Fans mal 100 (z. B. Schnitt 1,25 -> 125).
--   - Gewertet wird ein Verein erst ab 10 aktiven Fans, darunter steht er
--     als "noch nicht gewertet" in der Tabelle.
--   - Herzensverein wechseln: danach 30 Tage Sperre; gezählt wird beim neuen
--     Verein erst ab dem Wechsel.
--   - Schalter "Für Vereine spielen" aus: man zählt für keinen Verein. Beim
--     Wieder-Einschalten zählt man ab diesem Moment neu.
--   - Sterne und Ranglistenpunkte sind davon nicht betroffen.
--
-- Zusätzlich: Ein Tipp kann ab Anpfiff nicht mehr geändert oder neu
-- angelegt werden (vorher ging das über die Datenbank-Schnittstelle).
--
-- Ausführen: Supabase-Dashboard -> SQL Editor -> "New query" -> dieses
-- komplette Skript einfügen -> "Run". Kann gefahrlos mehrfach laufen.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Tabellen
-- ----------------------------------------------------------------------------
create table if not exists public.club_fans (
  user_id uuid not null references auth.users(id) on delete cascade,
  sport text not null check (sport in ('Fußball', 'NFL', 'NBA', 'NHL')),
  team_id text,                                   -- null = kein Verein gewählt
  since timestamptz not null default now(),       -- ab hier zählen Tipps
  changed_at timestamptz not null default now(),  -- letzter Wechsel (Sperrfrist)
  primary key (user_id, sport)
);
create index if not exists club_fans_team_idx on public.club_fans(sport, team_id);

create table if not exists public.club_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  play_for_clubs boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.club_fans enable row level security;
alter table public.club_settings enable row level security;

drop policy if exists "Eigene Herzensvereine lesen" on public.club_fans;
create policy "Eigene Herzensvereine lesen" on public.club_fans
  for select using (auth.uid() = user_id);

drop policy if exists "Eigene Vereins-Einstellung lesen" on public.club_settings;
create policy "Eigene Vereins-Einstellung lesen" on public.club_settings
  for select using (auth.uid() = user_id);

-- Ändern geht nur über die Funktionen unten (Sperrfrist wird dort geprüft).
grant usage on schema public to anon, authenticated;
revoke all on public.club_fans, public.club_settings from anon, authenticated;
grant select on public.club_fans, public.club_settings to authenticated;

-- ----------------------------------------------------------------------------
-- 2) Tipps ab Anpfiff einfrieren. Die App speichert immer alle eigenen Tipps
--    auf einmal; deshalb wird hier nichts abgelehnt (sonst ginge auch die
--    Auswertung verloren), sondern die Tipp-Werte bleiben einfach, wie sie
--    vor dem Anpfiff waren. Neue Tipps nach Anpfiff werden ignoriert.
-- ----------------------------------------------------------------------------
create or replace function public.match_kickoff(p_match_id text)
returns timestamptz
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_kickoff timestamptz;
begin
  select (data ->> 'kickoff')::timestamptz into v_kickoff from public.matches where id = p_match_id;
  return v_kickoff;
exception when others then
  return null;
end;
$$;

create or replace function public.freeze_tip_after_kickoff()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_kickoff timestamptz;
begin
  if tg_op = 'INSERT' then
    -- Upsert auf einen schon gespeicherten Tipp: der Update-Teil regelt das.
    if exists (select 1 from public.tips where id = new.id) then
      return new;
    end if;
    v_kickoff := public.match_kickoff(new.match_id);
    if v_kickoff is not null and now() >= v_kickoff then
      return null;
    end if;
    return new;
  end if;

  new.user_id := old.user_id;
  new.match_id := old.match_id;
  v_kickoff := public.match_kickoff(old.match_id);
  if v_kickoff is not null and now() >= v_kickoff then
    new.predicted_home_score := old.predicted_home_score;
    new.predicted_away_score := old.predicted_away_score;
    new.submitted_at := old.submitted_at;
    new.stake := old.stake;
  end if;
  return new;
end;
$$;

drop trigger if exists freeze_tip_after_kickoff on public.tips;
create trigger freeze_tip_after_kickoff
  before insert or update on public.tips
  for each row execute procedure public.freeze_tip_after_kickoff();

-- ----------------------------------------------------------------------------
-- 3) Hilfsfunktionen für die Wertung
-- ----------------------------------------------------------------------------
-- Beginn der laufenden Saison (1. Juli, österreichische Zeit).
create or replace function public.club_season_start()
returns timestamptz
language sql
stable
as $$
  select make_timestamptz(
    case when extract(month from now() at time zone 'Europe/Vienna') >= 7
      then extract(year from now() at time zone 'Europe/Vienna')::int
      else extract(year from now() at time zone 'Europe/Vienna')::int - 1 end,
    7, 1, 0, 0, 0, 'Europe/Vienna');
$$;

-- Ein gewerteter Tipp pro Spieler und Spiel (der zuletzt abgegebene) mit
-- seinen Vereinspunkten, für alle beendeten Spiele.
create or replace function public.club_tip_points()
returns table (user_id uuid, sport text, kickoff timestamptz, points int)
language sql
stable
security definer set search_path = public
as $$
  with finished as (
    select m.id,
           m.data ->> 'sport' as sport,
           public.match_kickoff(m.id) as kickoff,
           coalesce(m.data ->> 'tipMode', 'score') as tip_mode,
           (m.data ->> 'liveHomeScore')::int as home,
           (m.data ->> 'liveAwayScore')::int as away
    from public.matches m
    where m.data ->> 'status' = 'finished'
      and jsonb_typeof(m.data -> 'liveHomeScore') = 'number'
      and jsonb_typeof(m.data -> 'liveAwayScore') = 'number'
  ),
  last_tip as (
    select distinct on (t.user_id, t.match_id)
           t.user_id, t.match_id, t.predicted_home_score as ph, t.predicted_away_score as pa
    from public.tips t
    order by t.user_id, t.match_id, t.submitted_at desc, t.id desc
  )
  select lt.user_id, f.sport, f.kickoff,
         case
           when f.tip_mode = '1x2' then
             case when sign(lt.ph - lt.pa) = sign(f.home - f.away) then 2 else 0 end
           when lt.ph = f.home and lt.pa = f.away then 3
           when sign(lt.ph - lt.pa) = sign(f.home - f.away) then 1
           else 0
         end
  from last_tip lt
  join finished f on f.id = lt.match_id
  where f.kickoff is not null;
$$;

-- Schnitt jedes Fans (nur Fans mit eingeschaltetem Schalter und gewähltem
-- Verein der passenden Sportart).
create or replace function public.club_fan_stats(p_sport text)
returns table (user_id uuid, team_id text, tips int, avg_points numeric)
language sql
stable
security definer set search_path = public
as $$
  select cf.user_id, cf.team_id,
         count(p.points)::int as tips,
         coalesce(avg(p.points), 0)::numeric as avg_points
  from public.club_fans cf
  join public.teams tm on tm.id = cf.team_id and tm.data ->> 'sport' = cf.sport
  left join public.club_settings cs on cs.user_id = cf.user_id
  left join public.club_tip_points() p
         on p.user_id = cf.user_id
        and p.sport = cf.sport
        and p.kickoff >= greatest(cf.since, public.club_season_start())
  where cf.sport = p_sport
    and cf.team_id is not null
    and coalesce(cs.play_for_clubs, true)
  group by cf.user_id, cf.team_id;
$$;

-- ----------------------------------------------------------------------------
-- 4) Vereinstabelle einer Sportart (für die Rangliste, auch ohne Login)
-- ----------------------------------------------------------------------------
create or replace function public.club_table(p_sport text)
returns table (team_id text, fans int, active_fans int, score int, ranked boolean)
language sql
stable
security definer set search_path = public
as $$
  select s.team_id,
         count(*)::int as fans,
         count(*) filter (where s.tips >= 3)::int as active_fans,
         coalesce(round(avg(s.avg_points) filter (where s.tips >= 3) * 100), 0)::int as score,
         count(*) filter (where s.tips >= 3) >= 10 as ranked
  from public.club_fan_stats(p_sport) s
  group by s.team_id
  order by ranked desc, score desc, active_fans desc, team_id;
$$;

-- ----------------------------------------------------------------------------
-- 5) Eigener Stand (für das Profil)
-- ----------------------------------------------------------------------------
create or replace function public.my_clubs()
returns table (sport text, team_id text, since timestamptz, next_change_at timestamptz,
               tips int, avg_points numeric, play_for_clubs boolean)
language sql
stable
security definer set search_path = public
as $$
  with me as (select auth.uid() as id),
  setting as (
    select coalesce((select cs.play_for_clubs from public.club_settings cs, me where cs.user_id = me.id), true) as on_
  )
  select sp.sport,
         cf.team_id,
         cf.since,
         cf.changed_at + interval '30 days',
         coalesce(st.tips, 0),
         coalesce(st.avg_points, 0),
         (select on_ from setting)
  from me
  cross join unnest(array['Fußball', 'NFL', 'NBA', 'NHL']) as sp(sport)
  left join public.club_fans cf on cf.user_id = me.id and cf.sport = sp.sport
  left join lateral (
    select s.tips, s.avg_points from public.club_fan_stats(sp.sport) s where s.user_id = me.id
  ) st on true
  where me.id is not null;
$$;

-- ----------------------------------------------------------------------------
-- 6) Herzensverein setzen / entfernen (p_team_id null = keinen Verein)
-- ----------------------------------------------------------------------------
create or replace function public.set_favorite_club(p_sport text, p_team_id text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_row public.club_fans;
begin
  if auth.uid() is null then
    raise exception 'Nicht eingeloggt';
  end if;
  if p_sport not in ('Fußball', 'NFL', 'NBA', 'NHL') then
    raise exception 'Unbekannte Sportart';
  end if;
  if p_team_id is not null and not exists (
    select 1 from public.teams t
    where t.id = p_team_id
      and t.data ->> 'sport' = p_sport
      and coalesce((t.data ->> 'isNationalTeam')::boolean, false) = false
  ) then
    raise exception 'Diesen Verein gibt es in dieser Sportart nicht';
  end if;

  select * into v_row from public.club_fans where user_id = auth.uid() and sport = p_sport for update;

  if found then
    if v_row.team_id is not distinct from p_team_id then
      return;
    end if;
    -- Sperrfrist nur beim Wechsel zu einem anderen Verein; Entfernen geht immer.
    if p_team_id is not null and v_row.team_id is not null
       and v_row.changed_at > now() - interval '30 days' then
      raise exception 'Wechsel erst ab % möglich',
        to_char((v_row.changed_at + interval '30 days') at time zone 'Europe/Vienna', 'DD.MM.YYYY');
    end if;
    if p_team_id is not null and v_row.team_id is null
       and v_row.changed_at > now() - interval '30 days' then
      raise exception 'Neuer Herzensverein erst ab % möglich',
        to_char((v_row.changed_at + interval '30 days') at time zone 'Europe/Vienna', 'DD.MM.YYYY');
    end if;
    update public.club_fans
    set team_id = p_team_id,
        since = now(),
        changed_at = case when p_team_id is null and v_row.team_id is not null then now()
                          when p_team_id is null then v_row.changed_at
                          else now() end
    where user_id = auth.uid() and sport = p_sport;
  else
    if p_team_id is null then
      return;
    end if;
    insert into public.club_fans (user_id, sport, team_id) values (auth.uid(), p_sport, p_team_id);
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 7) Schalter "Für Vereine spielen"
-- ----------------------------------------------------------------------------
create or replace function public.set_play_for_clubs(p_on boolean)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_old boolean;
begin
  if auth.uid() is null then
    raise exception 'Nicht eingeloggt';
  end if;
  select play_for_clubs into v_old from public.club_settings where user_id = auth.uid();
  v_old := coalesce(v_old, true);

  insert into public.club_settings (user_id, play_for_clubs, updated_at)
  values (auth.uid(), p_on, now())
  on conflict (user_id) do update set play_for_clubs = excluded.play_for_clubs, updated_at = now();

  -- Wieder eingeschaltet: ab jetzt neu zählen (sonst könnte man in einer
  -- schlechten Phase kurz ausschalten und alte Tipps später zurückholen).
  if p_on and not v_old then
    update public.club_fans set since = now() where user_id = auth.uid();
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 8) Rechte: Interna für niemanden direkt, Tabelle für alle, Rest nur
--    für eingeloggte Spieler.
-- ----------------------------------------------------------------------------
revoke execute on function public.match_kickoff(text) from public, anon, authenticated;
revoke execute on function public.freeze_tip_after_kickoff() from public, anon, authenticated;
revoke execute on function public.club_tip_points() from public, anon, authenticated;
revoke execute on function public.club_fan_stats(text) from public, anon, authenticated;
revoke execute on function public.club_table(text) from public;
revoke execute on function public.my_clubs() from public, anon;
revoke execute on function public.set_favorite_club(text, text) from public, anon;
revoke execute on function public.set_play_for_clubs(boolean) from public, anon;

grant execute on function public.club_season_start() to anon, authenticated;
grant execute on function public.club_table(text) to anon, authenticated;
grant execute on function public.my_clubs() to authenticated;
grant execute on function public.set_favorite_club(text, text) to authenticated;
grant execute on function public.set_play_for_clubs(boolean) to authenticated;
