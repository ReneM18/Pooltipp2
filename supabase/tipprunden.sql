-- ============================================================================
-- PoolTipp – Private Tipprunden (echte Speicherung statt nur im Browser)
-- ============================================================================
-- Bisher lebten Tipprunden nur im Browser der Person, die sie angelegt hat:
-- Niemand anderes konnte mit dem Code beitreten, und nach dem Neuladen war
-- alles weg. Dieses Skript legt die Tabellen dafür an:
--   leagues         – die Tipprunden selbst (Name, Modus, Einladungscode)
--   league_members  – wer in welcher Tipprunde ist
--   league_matches  – Spiele, die der Gründer in seiner Runde anlegt
--   league_tips     – die Tipps der Mitglieder auf diese Spiele
--
-- Regeln (in der Datenbank abgesichert, nicht nur in der App):
--   - Eine Tipprunde und alles darin sehen NUR ihre Mitglieder.
--   - Beitreten geht nur mit dem richtigen Code (join_league).
--   - Spiele anlegen/ändern/Endstand eintragen darf nur der Gründer.
--   - Tippen geht nur bis zum Anpfiff und nur auf Spiele der eigenen Runde.
--   - Fremde Tipps sind erst ab Anpfiff sichtbar (kein Abschreiben).
--   - Die Liga-Punkte rechnet die Datenbank (league_leaderboard) – niemand
--     kann sich selbst Punkte geben. Sterne spielen hier keine Rolle.
--
-- Ausführen: Supabase-Dashboard -> SQL Editor -> "New query" -> dieses
-- komplette Skript einfügen -> "Run". Kann gefahrlos mehrfach laufen.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Tabellen
-- ----------------------------------------------------------------------------
create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  description text not null default '' check (char_length(description) <= 200),
  code text not null unique,
  scoring_mode text not null default 'ergebnis' check (scoring_mode in ('ergebnis', 'dreiweg')),
  creator_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.league_members (
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);
create index if not exists league_members_user_idx on public.league_members(user_id);

create table if not exists public.league_matches (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  kickoff timestamptz not null,
  -- Beide leer = Spiel läuft noch / kommt noch. Beide gesetzt = beendet.
  final_home integer check (final_home >= 0),
  final_away integer check (final_away >= 0),
  created_at timestamptz not null default now(),
  check ((final_home is null) = (final_away is null))
);
create index if not exists league_matches_league_idx on public.league_matches(league_id);

create table if not exists public.league_tips (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  match_id uuid not null references public.league_matches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  home integer not null check (home between 0 and 99),
  away integer not null check (away between 0 and 99),
  updated_at timestamptz not null default now(),
  unique (match_id, user_id)
);
create index if not exists league_tips_league_idx on public.league_tips(league_id);

-- ----------------------------------------------------------------------------
-- 2) Hilfsfunktionen für die Regeln. Laufen mit erweiterten Rechten
--    (SECURITY DEFINER), sonst würden sich die Regeln gegenseitig blockieren
--    ("wer Mitglied ist, steht in league_members – die man aber nur als
--    Mitglied lesen darf").
-- ----------------------------------------------------------------------------
create or replace function public.is_league_member(p_league_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.league_members
    where league_id = p_league_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_league_creator(p_league_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.leagues
    where id = p_league_id and creator_id = auth.uid()
  );
$$;

-- true, sobald bei einem Spiel nicht mehr getippt werden darf (Anpfiff
-- vorbei oder Endstand schon eingetragen).
create or replace function public.league_match_locked(p_match_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce((
    select kickoff <= now() or final_home is not null
    from public.league_matches where id = p_match_id
  ), true);
$$;

-- Liga-Punkte für einen Tipp, gleiche Regeln wie bisher in der App:
-- Ergebnis-Modus: exakt 5, richtige Tordifferenz 3, richtige Tendenz 1.
-- 3-Wege-Modus: richtige Tendenz (Sieg/Unentschieden/Niederlage) 3.
create or replace function public.league_points(p_mode text, p_home int, p_away int, p_final_home int, p_final_away int)
returns int
language sql
immutable
as $$
  select case
    when p_final_home is null or p_final_away is null then 0
    when p_mode = 'dreiweg' then
      case when sign(p_home - p_away) = sign(p_final_home - p_final_away) then 3 else 0 end
    when p_home = p_final_home and p_away = p_final_away then 5
    when p_home - p_away = p_final_home - p_final_away then 3
    when sign(p_home - p_away) = sign(p_final_home - p_final_away) then 1
    else 0
  end;
$$;

-- ----------------------------------------------------------------------------
-- 3) Zugriffsregeln (RLS)
-- ----------------------------------------------------------------------------
alter table public.leagues enable row level security;
alter table public.league_members enable row level security;
alter table public.league_matches enable row level security;
alter table public.league_tips enable row level security;

-- Tipprunden: sehen nur Mitglieder; ändern/löschen nur der Gründer.
-- Angelegt wird ausschließlich über create_league() (erzeugt den Code).
drop policy if exists "Tipprunde sehen" on public.leagues;
create policy "Tipprunde sehen" on public.leagues
  for select using (public.is_league_member(id));
drop policy if exists "Tipprunde bearbeiten" on public.leagues;
create policy "Tipprunde bearbeiten" on public.leagues
  for update using (creator_id = auth.uid()) with check (creator_id = auth.uid());
drop policy if exists "Tipprunde löschen" on public.leagues;
create policy "Tipprunde löschen" on public.leagues
  for delete using (creator_id = auth.uid());

-- Mitglieder: sehen nur Mitglieder. Austreten darf jeder selbst (außer dem
-- Gründer, der löscht stattdessen die Runde); der Gründer darf andere
-- entfernen. Beitreten nur über join_league() mit Code.
drop policy if exists "Mitglieder sehen" on public.league_members;
create policy "Mitglieder sehen" on public.league_members
  for select using (public.is_league_member(league_id));
drop policy if exists "Austreten oder entfernen" on public.league_members;
create policy "Austreten oder entfernen" on public.league_members
  for delete using (
    (user_id = auth.uid() and not public.is_league_creator(league_id))
    or (user_id <> auth.uid() and public.is_league_creator(league_id))
  );

-- Spiele: sehen alle Mitglieder; anlegen/ändern/löschen nur der Gründer.
drop policy if exists "Runden-Spiele sehen" on public.league_matches;
create policy "Runden-Spiele sehen" on public.league_matches
  for select using (public.is_league_member(league_id));
drop policy if exists "Runden-Spiele anlegen" on public.league_matches;
create policy "Runden-Spiele anlegen" on public.league_matches
  for insert with check (public.is_league_creator(league_id));
drop policy if exists "Runden-Spiele ändern" on public.league_matches;
create policy "Runden-Spiele ändern" on public.league_matches
  for update using (public.is_league_creator(league_id)) with check (public.is_league_creator(league_id));
drop policy if exists "Runden-Spiele löschen" on public.league_matches;
create policy "Runden-Spiele löschen" on public.league_matches
  for delete using (public.is_league_creator(league_id));

-- Tipps: den eigenen sieht man immer, fremde erst ab Anpfiff.
-- Abgegeben/geändert werden Tipps nur über submit_league_tip().
drop policy if exists "Runden-Tipps sehen" on public.league_tips;
create policy "Runden-Tipps sehen" on public.league_tips
  for select using (
    user_id = auth.uid()
    or (public.is_league_member(league_id) and public.league_match_locked(match_id))
  );

-- ----------------------------------------------------------------------------
-- 4) Grundrechte (ohne diese greifen die Regeln oben gar nicht erst –
--    daran lag der Rangliste-Fehler "permission denied"). Bewusst nur die
--    Spalten, die wirklich geändert werden dürfen: Code und Gründer einer
--    Runde lassen sich so z. B. gar nicht verändern.
-- ----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
revoke all on public.leagues, public.league_members, public.league_matches, public.league_tips from anon, authenticated;
grant select, delete on public.leagues to authenticated;
grant update (name, description) on public.leagues to authenticated;
grant select, delete on public.league_members to authenticated;
grant select, insert, delete on public.league_matches to authenticated;
grant update (title, kickoff, final_home, final_away) on public.league_matches to authenticated;
grant select on public.league_tips to authenticated;

-- ----------------------------------------------------------------------------
-- 5) Aktionen der App
-- ----------------------------------------------------------------------------

-- Neue Tipprunde gründen: erzeugt einen eindeutigen 6-stelligen Code ohne
-- leicht verwechselbare Zeichen (kein 0/O, 1/I/L) und trägt den Gründer
-- gleich als erstes Mitglied ein.
create or replace function public.create_league(p_name text, p_description text, p_scoring_mode text)
returns public.leagues
language plpgsql
security definer set search_path = public
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
  v_league public.leagues;
  i int;
begin
  if auth.uid() is null then
    raise exception 'Nicht eingeloggt';
  end if;
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.leagues where code = v_code);
  end loop;

  insert into public.leagues (name, description, code, scoring_mode, creator_id)
  values (trim(p_name), coalesce(trim(p_description), ''), v_code,
          case when p_scoring_mode = 'dreiweg' then 'dreiweg' else 'ergebnis' end,
          auth.uid())
  returning * into v_league;

  insert into public.league_members (league_id, user_id) values (v_league.id, auth.uid());
  return v_league;
end;
$$;

-- Mit Code beitreten. Gibt die ID der Tipprunde zurück, oder null, wenn es
-- keine Runde mit diesem Code gibt. Schon Mitglied? Dann einfach die ID.
create or replace function public.join_league(p_code text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_league_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Nicht eingeloggt';
  end if;
  select id into v_league_id from public.leagues
  where code = upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
  if v_league_id is null then
    return null;
  end if;
  insert into public.league_members (league_id, user_id)
  values (v_league_id, auth.uid())
  on conflict do nothing;
  return v_league_id;
end;
$$;

-- Tipp abgeben oder bis zum Anpfiff ändern.
create or replace function public.submit_league_tip(p_match_id uuid, p_home int, p_away int)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_match public.league_matches;
begin
  if auth.uid() is null then
    raise exception 'Nicht eingeloggt';
  end if;
  select * into v_match from public.league_matches where id = p_match_id;
  if v_match.id is null or not public.is_league_member(v_match.league_id) then
    raise exception 'Spiel nicht gefunden';
  end if;
  if v_match.kickoff <= now() or v_match.final_home is not null then
    raise exception 'Tippschluss ist vorbei';
  end if;
  if p_home is null or p_away is null or p_home < 0 or p_away < 0 or p_home > 99 or p_away > 99 then
    raise exception 'Ungültiger Tipp';
  end if;
  insert into public.league_tips (league_id, match_id, user_id, home, away)
  values (v_match.league_id, v_match.id, auth.uid(), p_home, p_away)
  on conflict (match_id, user_id)
  do update set home = excluded.home, away = excluded.away, updated_at = now();
end;
$$;

-- Runden-Rangliste: alle aktuellen Mitglieder mit Liga-Punkten, nur für
-- Mitglieder abrufbar. Dient gleichzeitig als Mitgliederliste.
create or replace function public.league_leaderboard(p_league_id uuid)
returns table (
  user_id uuid,
  display_name text,
  points int,
  exact_tips int,
  scored_tips int,
  is_creator boolean,
  joined_at timestamptz
)
language sql
stable
security definer set search_path = public
as $$
  select
    m.user_id,
    coalesce(p.display_name, 'Spieler') as display_name,
    coalesce(sum(public.league_points(l.scoring_mode, t.home, t.away, lm.final_home, lm.final_away)), 0)::int as points,
    count(*) filter (where lm.final_home is not null and t.home = lm.final_home and t.away = lm.final_away)::int as exact_tips,
    count(lm.id) filter (where lm.final_home is not null)::int as scored_tips,
    m.user_id = l.creator_id as is_creator,
    m.joined_at
  from public.league_members m
  join public.leagues l on l.id = m.league_id
  left join public.profiles p on p.id = m.user_id
  left join public.league_tips t on t.league_id = m.league_id and t.user_id = m.user_id
  left join public.league_matches lm on lm.id = t.match_id
  where m.league_id = p_league_id
    and public.is_league_member(p_league_id)
  group by m.user_id, p.display_name, l.scoring_mode, l.creator_id, m.joined_at
  order by points desc, exact_tips desc, m.joined_at asc;
$$;

revoke execute on function public.create_league(text, text, text) from public, anon;
revoke execute on function public.join_league(text) from public, anon;
revoke execute on function public.submit_league_tip(uuid, int, int) from public, anon;
revoke execute on function public.league_leaderboard(uuid) from public, anon;
grant execute on function public.create_league(text, text, text) to authenticated;
grant execute on function public.join_league(text) to authenticated;
grant execute on function public.submit_league_tip(uuid, int, int) to authenticated;
grant execute on function public.league_leaderboard(uuid) to authenticated;
grant execute on function public.is_league_member(uuid) to authenticated;
grant execute on function public.is_league_creator(uuid) to authenticated;
grant execute on function public.league_match_locked(uuid) to authenticated;
grant execute on function public.league_points(text, int, int, int, int) to authenticated;

-- Kontrolle: sollte 4 Zeilen zeigen, alle mit "true".
select c.relname as tabelle,
       has_table_privilege('authenticated', c.oid, 'select') as eingeloggt_lesen,
       c.relrowsecurity as rls_an
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('leagues', 'league_members', 'league_matches', 'league_tips')
order by 1;
