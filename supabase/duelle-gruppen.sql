-- ============================================================================
-- PoolTipp – Duelle mit bis zu 5 Spielern und mehreren Spielen
-- ============================================================================
-- Im Supabase SQL Editor: alles einfügen -> "Run". Läuft als ein Block:
-- bricht etwas ab, ändert sich gar nichts. Mehrfach ausführen schadet nicht.
--
-- Neu:
--   1) Ein Duell hat 1 bis 10 Spiele und 2 bis 5 Spieler (Ersteller + bis zu
--      4 Eingeladene). Jeder setzt einmal den gleichen Einsatz in Coins.
--   2) Punkte pro Spiel wie in der Rangliste: exakt 10, Tordifferenz 7,
--      Tendenz 5, falsch oder kein Tipp -3 (1X2: richtig 5, falsch -3).
--      Platz 1 = meiste Punkte über alle Spiele.
--   3) Auszahlung: 2 Spieler -> Sieger bekommt beide Einsätze. Ab 3 Spielern
--      -> Platz 2 bekommt seinen Einsatz zurück, Platz 1 den Rest. Alle
--      gleich -> jeder bekommt seinen Einsatz zurück. Geteilter Platz 1 teilt
--      den Topf, geteilter Platz 2 teilt den einen Einsatz.
--   4) Annehmen bis zum Tippschluss des ersten Spiels. Danach läuft das Duell
--      mit allen, die angenommen haben; hat niemand angenommen, bekommt der
--      Ersteller seinen Einsatz zurück.
--   5) Zurückziehen (Ersteller) bis zum ersten Tippschluss: alle Einsätze
--      zurück, alle Eingeladenen bekommen eine Nachricht.
--   6) Abgesagte Spiele zählen nicht; sind alle abgesagt, alle Einsätze
--      zurück.
--   7) Schutz gegen Absprachen (Zahlen in der Tabelle duel_settings, mit
--      einem "update public.duel_settings set ..." änderbar):
--      Einsatz höchstens 50 Coins, Gewinn aus Duellen höchstens +100 Coins
--      pro Tag und +300 pro Woche (was darüber liegt, verfällt; Verlieren
--      ist nicht gedeckelt), dieselben zwei Spieler höchstens 2 gemeinsame
--      Duelle pro Woche, Duelle erst ab 10 Tipps und 3 Tagen Konto-Alter.
--   8) Admin-Bericht "Auffällige Duelle" (nur Anzeige, sperrt nichts).
--
-- Bestehende Duelle, Tipps, Coins, Joker und Serien bleiben, wie sie sind.
-- Für bestehende Duelle werden nur die Spielerlisten nachgetragen.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1) Einstellungen (eine Zeile)
-- ----------------------------------------------------------------------------
create table if not exists public.duel_settings (
  id boolean primary key default true check (id),
  max_players int not null default 5,        -- inklusive Ersteller
  max_games int not null default 10,
  max_stake int not null default 50,         -- Coins pro Spieler und Duell
  day_win_cap int not null default 100,      -- höchstens so viel Gewinn pro Tag
  week_win_cap int not null default 300,     -- ... und pro Woche
  pair_per_week int not null default 2,      -- gemeinsame Duelle zweier Spieler pro Woche
  min_tips int not null default 10,          -- Tipps, bevor man Duelle spielen darf
  min_account_days int not null default 3    -- Tage seit Anmeldung
);
insert into public.duel_settings (id) values (true) on conflict do nothing;
alter table public.duel_settings enable row level security;
drop policy if exists "Duell-Regeln lesen" on public.duel_settings;
create policy "Duell-Regeln lesen" on public.duel_settings for select using (true);
revoke all on public.duel_settings from anon, authenticated;
grant select on public.duel_settings to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2) Duelle: mehrere Spiele, Annahme-Schluss, Gegner darf fehlen
-- ----------------------------------------------------------------------------
alter table public.duels add column if not exists match_ids text[];
alter table public.duels add column if not exists accept_until timestamptz;
alter table public.duels add column if not exists accepted_at timestamptz;

-- Gruppen-Duelle haben keinen einzelnen Gegner mehr. Löscht ein Eingeladener
-- sein Konto, bleibt das Duell für die anderen bestehen (vorher wurde es
-- mitgelöscht).
alter table public.duels alter column opponent_id drop not null;
do $$
declare v_name text;
begin
  for v_name in
    select c.conname from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
    where c.conrelid = 'public.duels'::regclass and c.contype = 'f' and a.attname = 'opponent_id'
  loop
    execute format('alter table public.duels drop constraint %I', v_name);
  end loop;
end $$;
alter table public.duels add constraint duels_opponent_id_fkey
  foreign key (opponent_id) references auth.users(id) on delete set null;

-- ----------------------------------------------------------------------------
-- 3) Spieler eines Duells
-- ----------------------------------------------------------------------------
create table if not exists public.duel_participants (
  duel_id text not null references public.duels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  is_creator boolean not null default false,
  status text not null default 'eingeladen',  -- eingeladen | angenommen | abgelehnt | verfallen
  invited_at timestamptz not null default now(),
  responded_at timestamptz,
  points int,          -- Punkte über alle Spiele (nach der Auswertung)
  place int,
  payout int,          -- gutgeschriebene Coins (Gewinn bzw. Rückzahlung)
  capped int,          -- wegen Gewinn-Deckel verfallene Coins
  game_results jsonb,  -- pro Spiel: Tipp, Stufe, Punkte
  primary key (duel_id, user_id)
);
create index if not exists duel_participants_user_idx on public.duel_participants(user_id);

-- Bestehende Duelle: Spielerliste nachtragen (an den Duellen selbst und an
-- den Coins ändert sich nichts).
insert into public.duel_participants (duel_id, user_id, display_name, is_creator, status, invited_at, responded_at, place, payout)
select d.id, d.challenger_id, d.challenger_name, true, 'angenommen', d.created_at, d.created_at,
  case when d.status = 'ausgewertet' then case when d.result = 'opponent' then 2 else 1 end end,
  case
    when d.status = 'ausgewertet' then case d.result when 'challenger' then d.stars_credited when 'unentschieden' then d.stake else 0 end
    when d.status in ('abgelehnt', 'verfallen', 'abgesagt') then d.stake
  end
from public.duels d
where exists (select 1 from auth.users u where u.id = d.challenger_id)
on conflict do nothing;

insert into public.duel_participants (duel_id, user_id, display_name, is_creator, status, invited_at, responded_at, place, payout)
select d.id, d.opponent_id, d.opponent_name, false,
  case
    when d.status = 'pending' then 'eingeladen'
    when d.status = 'abgelehnt' then 'abgelehnt'
    when d.status in ('offen', 'ausgewertet') then 'angenommen'
    when d.status = 'abgesagt' and d.accepted_at is not null then 'angenommen'
    else 'verfallen'
  end,
  d.created_at,
  case when d.status in ('offen', 'ausgewertet') or (d.status = 'abgesagt' and d.accepted_at is not null)
       then coalesce(d.accepted_at, d.created_at)
       when d.status = 'abgelehnt' then d.resolved_at end,
  case when d.status = 'ausgewertet' then case when d.result = 'challenger' then 2 else 1 end end,
  case
    when d.status = 'ausgewertet' then case d.result when 'opponent' then d.stars_credited when 'unentschieden' then d.stake else 0 end
    when d.status = 'abgesagt' and d.accepted_at is not null then d.stake
  end
from public.duels d
where d.opponent_id is not null and d.opponent_id <> d.challenger_id
  and exists (select 1 from auth.users u where u.id = d.opponent_id)
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- 4) Lesen: alle Spieler eines Duells sehen das Duell und die Spielerliste
-- ----------------------------------------------------------------------------
create or replace function public.is_duel_member(p_duel_id text)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select auth.uid() is not null and (
    exists (select 1 from public.duel_participants where duel_id = p_duel_id and user_id = auth.uid())
    or exists (select 1 from public.duels where id = p_duel_id and (challenger_id = auth.uid() or opponent_id = auth.uid()))
  );
$$;

drop policy if exists "Duell-Spieler lesen" on public.duels;
create policy "Duell-Spieler lesen" on public.duels
  for select using (public.is_duel_member(id));

alter table public.duel_participants enable row level security;
drop policy if exists "Duell-Spieler lesen" on public.duel_participants;
create policy "Duell-Spieler lesen" on public.duel_participants
  for select using (public.is_duel_member(duel_id));
revoke all on public.duel_participants from anon, authenticated;
grant select on public.duel_participants to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.duel_participants;
exception when duplicate_object then null;
end $$;

-- ----------------------------------------------------------------------------
-- 5) Hilfsfunktionen (nur intern)
-- ----------------------------------------------------------------------------

-- Tippschluss eines Spiels.
create or replace function public.match_deadline(p_match_id text)
returns timestamptz
language sql
stable
security definer set search_path = public
as $$
  select coalesce(public.try_timestamptz(data ->> 'tipDeadline'), public.try_timestamptz(data ->> 'kickoff'))
  from public.matches where id = p_match_id;
$$;

-- Bis wann das Duell angenommen (und zurückgezogen) werden kann: erster
-- Tippschluss (auch wenn ein Spiel später vorverlegt wird).
create or replace function public.duel_accept_until(p_duel_id text)
returns timestamptz
language sql
stable
security definer set search_path = public
as $$
  select coalesce(
    (select min(public.match_deadline(m)) from unnest(coalesce(d.match_ids, array[d.match_id])) m),
    d.accept_until)
  from public.duels d where d.id = p_duel_id;
$$;

-- null = darf Duelle spielen, sonst der Grund.
create or replace function public.duel_not_allowed(p_user uuid)
returns text
language plpgsql
stable
security definer set search_path = public
as $$
declare
  s public.duel_settings;
  v_created timestamptz;
  v_name text;
  v_tips int;
begin
  select * into s from public.duel_settings;
  select created_at, display_name into v_created, v_name from public.profiles where id = p_user;
  if not found then
    return 'Spieler nicht gefunden';
  end if;
  select count(*) into v_tips from public.tips where user_id = p_user and refunded_at is null;
  if v_tips < s.min_tips or v_created > now() - make_interval(days => s.min_account_days) then
    return coalesce(v_name, 'Dieses Konto') || ' kann noch keine Duelle spielen (erst ab ' || s.min_tips
      || ' Tipps und ' || s.min_account_days || ' Tagen)';
  end if;
  return null;
end;
$$;

-- Gemeinsame Duelle zweier Spieler in dieser Woche (ohne p_skip_duel).
-- Zählt laufende und gespielte Duelle, keine zurückgezogenen/abgelehnten.
create or replace function public.duel_pair_count_week(p_a uuid, p_b uuid, p_skip_duel text)
returns int
language sql
stable
security definer set search_path = public
as $$
  select count(*)::int
  from public.duels d
  where d.id is distinct from p_skip_duel
    and d.status in ('pending', 'offen', 'ausgewertet')
    and date_trunc('week', public.pooltipp_day(d.created_at)) = date_trunc('week', public.pooltipp_day(now()))
    and exists (select 1 from public.duel_participants p where p.duel_id = d.id and p.user_id = p_a
                and p.status in ('eingeladen', 'angenommen'))
    and exists (select 1 from public.duel_participants p where p.duel_id = d.id and p.user_id = p_b
                and p.status in ('eingeladen', 'angenommen'));
$$;

-- Gewinn (über den Einsatz hinaus) aus Duellen seit p_since.
create or replace function public.duel_won_since(p_user uuid, p_since timestamptz)
returns int
language sql
stable
security definer set search_path = public
as $$
  select coalesce(sum(greatest(0, coalesce(p.payout, 0) - d.stake)), 0)::int
  from public.duel_participants p join public.duels d on d.id = p.duel_id
  where p.user_id = p_user and d.status = 'ausgewertet' and d.resolved_at >= p_since;
$$;

-- Heute schon eingesetzte Coins für das Tageslimit 100 (nur Duelle).
-- Einsätze, die zurückgezahlt wurden, zählen nicht.
create or replace function public.stake_used_today(p_user uuid)
returns int
language sql
stable
security definer set search_path = public
as $$
  select coalesce(sum(d.stake), 0)::int
  from public.duel_participants p join public.duels d on d.id = p.duel_id
  where p.user_id = p_user and p.status = 'angenommen'
    and d.status not in ('abgesagt', 'zurueckgezogen', 'abgelehnt', 'verfallen')
    and public.pooltipp_day(p.responded_at) = public.pooltipp_day(now());
$$;

-- Namen der Mitspieler (für Nachrichten).
create or replace function public.duel_names(p_duel_id text, p_without uuid)
returns text
language sql
stable
security definer set search_path = public
as $$
  select coalesce(string_agg(display_name, ', ' order by is_creator desc, invited_at, display_name), '')
  from public.duel_participants
  where duel_id = p_duel_id and user_id is distinct from p_without and status in ('eingeladen', 'angenommen');
$$;

-- ----------------------------------------------------------------------------
-- 6) Duell anlegen
-- ----------------------------------------------------------------------------

-- Vor dem Speichern: Spiele, Einsatz und Ersteller prüfen, Einsatz abbuchen.
create or replace function public.protect_duel_stake()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  s public.duel_settings;
  v_ids text[];
  v_id text;
  v_match jsonb;
  v_deadline timestamptz;
  v_first timestamptz;
  v_first_id text;
  v_reason text;
begin
  select * into s from public.duel_settings;
  v_ids := array(select distinct x from unnest(coalesce(new.match_ids, array[new.match_id])) x where x is not null);
  if coalesce(array_length(v_ids, 1), 0) = 0 then
    raise exception 'Wähle mindestens ein Spiel aus';
  end if;
  if array_length(v_ids, 1) > s.max_games then
    raise exception 'Höchstens % Spiele pro Duell', s.max_games;
  end if;
  foreach v_id in array v_ids loop
    select data into v_match from public.matches where id = v_id;
    if v_match is null or coalesce(v_match ->> 'status', '') in ('finished', 'cancelled', 'live') then
      raise exception 'Spiel nicht gefunden oder schon vorbei';
    end if;
    v_deadline := public.match_deadline(v_id);
    if v_deadline is not null and now() >= v_deadline then
      raise exception 'Tippschluss für ein gewähltes Spiel ist schon vorbei';
    end if;
    if v_first is null or (v_deadline is not null and v_deadline < v_first) then
      v_first := v_deadline;
      v_first_id := v_id;
    end if;
  end loop;
  if new.stake is null or new.stake < 1 then
    raise exception 'Gib einen gültigen Einsatz ein';
  end if;
  if new.stake > s.max_stake then
    raise exception 'Einsatz höchstens % Coins pro Duell', s.max_stake;
  end if;
  if new.opponent_id is not null and new.opponent_id = new.challenger_id then
    raise exception 'Du kannst dich nicht selbst herausfordern';
  end if;
  v_reason := public.duel_not_allowed(new.challenger_id);
  if v_reason is not null then
    raise exception '%', v_reason;
  end if;

  new.match_ids := v_ids;
  new.match_id := coalesce(v_first_id, v_ids[1]);
  new.accept_until := v_first;
  new.status := 'pending';
  new.created_at := now();
  new.accepted_at := null;
  new.result := null;
  new.stars_credited := null;
  new.resolved_at := null;
  new.my_tier := null;
  new.opponent_tier := null;
  select coalesce(display_name, new.challenger_name) into new.challenger_name
  from public.profiles where id = new.challenger_id;
  -- Alles oder nichts: alle Spieler setzen denselben Betrag.
  perform public.take_stars(new.challenger_id, new.stake, true, true);
  return new;
end;
$$;

drop trigger if exists protect_duel_stake on public.duels;
create trigger protect_duel_stake
  before insert on public.duels
  for each row execute procedure public.protect_duel_stake();

-- Einen Spieler einladen (Prüfungen + Nachricht).
create or replace function public.duel_invite(p_duel_id text, p_user uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  s public.duel_settings;
  v_duel record;
  v_name text;
  v_reason text;
  v_games int;
begin
  select * into s from public.duel_settings;
  select * into v_duel from public.duels where id = p_duel_id;
  select display_name into v_name from public.profiles where id = p_user;
  if v_name is null then
    raise exception 'Gegner nicht gefunden';
  end if;
  if p_user = v_duel.challenger_id then
    raise exception 'Du kannst dich nicht selbst herausfordern';
  end if;
  if exists (select 1 from public.duel_participants where duel_id = p_duel_id and user_id = p_user) then
    return;
  end if;
  if (select count(*) from public.duel_participants where duel_id = p_duel_id) >= s.max_players then
    raise exception 'Höchstens % Spieler pro Duell', s.max_players;
  end if;
  v_reason := public.duel_not_allowed(p_user);
  if v_reason is not null then
    raise exception '%', v_reason;
  end if;
  if public.duel_pair_count_week(v_duel.challenger_id, p_user, p_duel_id) >= s.pair_per_week then
    raise exception 'Mit % hast du diese Woche schon % Duelle (mehr geht erst nächste Woche)', v_name, s.pair_per_week;
  end if;

  insert into public.duel_participants (duel_id, user_id, display_name, is_creator, status, invited_at)
  values (p_duel_id, p_user, v_name, false, 'eingeladen', now());

  v_games := coalesce(array_length(v_duel.match_ids, 1), 1);
  perform public.add_private_activity(p_user, '⚔️',
    v_duel.challenger_name || ' lädt dich zu einem Duell ein: ' || v_games
    || case when v_games = 1 then ' Spiel' else ' Spiele' end
    || ', Einsatz ' || v_duel.stake || ' Coins. Annehmen unter Duelle.');
end;
$$;

-- Nach dem Speichern: Ersteller als Spieler eintragen; alter Weg mit einem
-- einzelnen Gegner (opponent_id) lädt diesen gleich ein.
create or replace function public.duel_after_insert()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.duel_participants (duel_id, user_id, display_name, is_creator, status, invited_at, responded_at)
  values (new.id, new.challenger_id, new.challenger_name, true, 'angenommen', now(), now())
  on conflict do nothing;
  if new.opponent_id is not null then
    perform public.duel_invite(new.id, new.opponent_id);
  end if;
  return null;
end;
$$;

drop trigger if exists duel_after_insert on public.duels;
create trigger duel_after_insert
  after insert on public.duels
  for each row execute procedure public.duel_after_insert();

-- Neues Duell aus der App: Spieler, Spiele, Einsatz. Gibt id und Einsatz zurück.
create or replace function public.create_duel(p_invitees uuid[], p_match_ids text[], p_stake int)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  s public.duel_settings;
  v_uid uuid := auth.uid();
  v_invitees uuid[];
  v_user uuid;
  v_id text := 'duel-' || replace(gen_random_uuid()::text, '-', '');
  v_names text;
begin
  if v_uid is null then
    raise exception 'Nicht eingeloggt';
  end if;
  select * into s from public.duel_settings;
  v_invitees := array(select distinct x from unnest(p_invitees) x where x is not null);
  if v_uid = any(v_invitees) then
    raise exception 'Du kannst dich nicht selbst herausfordern';
  end if;
  if coalesce(array_length(v_invitees, 1), 0) = 0 then
    raise exception 'Lade mindestens einen Gegner ein';
  end if;
  if array_length(v_invitees, 1) > s.max_players - 1 then
    raise exception 'Höchstens % Spieler pro Duell', s.max_players;
  end if;
  select string_agg(display_name, ', ' order by display_name) into v_names
  from public.profiles where id = any(v_invitees);

  insert into public.duels (id, challenger_id, challenger_name, opponent_id, opponent_name, match_id, match_ids, stake, status)
  values (v_id, v_uid, '', null, coalesce(v_names, ''), p_match_ids[1], p_match_ids, p_stake, 'pending');

  foreach v_user in array v_invitees loop
    perform public.duel_invite(v_id, v_user);
  end loop;

  return jsonb_build_object('id', v_id, 'stake', (select stake from public.duels where id = v_id));
end;
$$;

-- ----------------------------------------------------------------------------
-- 7) Weiter, wenn alle geantwortet haben oder der Annahme-Schluss vorbei ist
-- ----------------------------------------------------------------------------
create or replace function public.duel_advance(p_duel_id text, p_force boolean)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_duel record;
  v_expired boolean;
  v_open int;
  v_accepted int;
begin
  select * into v_duel from public.duels where id = p_duel_id for update;
  if not found or v_duel.status <> 'pending' then
    return;
  end if;
  v_expired := p_force or now() >= coalesce(public.duel_accept_until(p_duel_id), 'infinity'::timestamptz);
  if v_expired then
    update public.duel_participants set status = 'verfallen', responded_at = now()
    where duel_id = p_duel_id and status = 'eingeladen';
  end if;
  select count(*) filter (where status = 'eingeladen'),
         count(*) filter (where status = 'angenommen' and not is_creator)
  into v_open, v_accepted
  from public.duel_participants where duel_id = p_duel_id;
  if v_open > 0 then
    return;
  end if;

  if v_accepted = 0 then
    update public.duels
    set status = case when v_expired then 'verfallen' else 'abgelehnt' end, resolved_at = now()
    where id = p_duel_id;
    update public.duel_participants set payout = v_duel.stake
    where duel_id = p_duel_id and user_id = v_duel.challenger_id;
    update public.profiles set free_stars = free_stars + v_duel.stake, updated_at = now()
    where id = v_duel.challenger_id;
    perform public.add_private_activity(v_duel.challenger_id, '↩️',
      case when v_expired then 'Niemand hat dein Duell rechtzeitig angenommen'
           else 'Alle haben dein Duell abgelehnt' end
      || ' – deine ' || v_duel.stake || ' Coins sind zurück.');
  else
    update public.duels set status = 'offen', accepted_at = coalesce(accepted_at, now()) where id = p_duel_id;
  end if;
end;
$$;

-- Abgelaufene Einladungen sofort abschließen (die App ruft das beim Laden auf).
create or replace function public.expire_my_duels()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_id text;
begin
  if auth.uid() is null then
    return;
  end if;
  for v_id in
    select d.id from public.duels d
    where d.status = 'pending'
      and exists (select 1 from public.duel_participants p where p.duel_id = d.id and p.user_id = auth.uid())
      and now() >= coalesce(public.duel_accept_until(d.id), 'infinity'::timestamptz)
  loop
    perform public.duel_advance(v_id, false);
  end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- 8) Annehmen, Ablehnen, Zurückziehen
-- ----------------------------------------------------------------------------
create or replace function public.accept_duel(p_duel_id text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  s public.duel_settings;
  v_uid uuid := auth.uid();
  v_duel record;
  v_me record;
  v_other record;
  v_reason text;
begin
  if v_uid is null then
    raise exception 'Nicht eingeloggt';
  end if;
  select * into s from public.duel_settings;
  select * into v_duel from public.duels where id = p_duel_id for update;
  if not found then
    raise exception 'Duell nicht gefunden';
  end if;
  select * into v_me from public.duel_participants where duel_id = p_duel_id and user_id = v_uid;
  if not found or v_me.is_creator then
    raise exception 'Nur Eingeladene können annehmen';
  end if;
  if v_duel.status <> 'pending' or v_me.status <> 'eingeladen' then
    raise exception 'Duell ist nicht mehr offen';
  end if;
  if now() >= coalesce(public.duel_accept_until(p_duel_id), 'infinity'::timestamptz) then
    raise exception 'Tippschluss vorbei – die Einladung ist abgelaufen';
  end if;
  v_reason := public.duel_not_allowed(v_uid);
  if v_reason is not null then
    raise exception '%', v_reason;
  end if;
  for v_other in
    select user_id, display_name from public.duel_participants
    where duel_id = p_duel_id and status = 'angenommen' and user_id <> v_uid
  loop
    if public.duel_pair_count_week(v_uid, v_other.user_id, p_duel_id) >= s.pair_per_week then
      raise exception 'Mit % hast du diese Woche schon % Duelle (mehr geht erst nächste Woche)',
        v_other.display_name, s.pair_per_week;
    end if;
  end loop;

  perform public.take_stars(v_uid, v_duel.stake, true, true);
  update public.duel_participants set status = 'angenommen', responded_at = now()
  where duel_id = p_duel_id and user_id = v_uid;
  if v_duel.opponent_id = v_uid then
    update public.duels set accepted_at = now() where id = p_duel_id;
  end if;
  perform public.add_private_activity(v_duel.challenger_id, '⚔️',
    v_me.display_name || ' hat dein Duell angenommen (Einsatz ' || v_duel.stake || ' Coins).');
  perform public.duel_advance(p_duel_id, false);
end;
$$;

create or replace function public.decline_duel(p_duel_id text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_duel record;
  v_me record;
begin
  if v_uid is null then
    raise exception 'Nicht eingeloggt';
  end if;
  select * into v_duel from public.duels where id = p_duel_id for update;
  if not found then
    raise exception 'Duell nicht gefunden';
  end if;
  select * into v_me from public.duel_participants where duel_id = p_duel_id and user_id = v_uid;
  if not found or v_me.is_creator then
    raise exception 'Nur Eingeladene können ablehnen';
  end if;
  if v_duel.status <> 'pending' or v_me.status <> 'eingeladen' then
    raise exception 'Duell ist nicht mehr offen';
  end if;
  update public.duel_participants set status = 'abgelehnt', responded_at = now()
  where duel_id = p_duel_id and user_id = v_uid;
  perform public.add_private_activity(v_duel.challenger_id, '🚫',
    v_me.display_name || ' hat dein Duell abgelehnt.');
  perform public.duel_advance(p_duel_id, false);
end;
$$;

-- Ersteller zieht das Duell zurück (bis zum ersten Tippschluss): alle
-- Einsätze zurück, alle anderen bekommen eine Nachricht.
create or replace function public.withdraw_duel(p_duel_id text)
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_duel record;
  v_p record;
begin
  if v_uid is null then
    raise exception 'Nicht eingeloggt';
  end if;
  select * into v_duel from public.duels where id = p_duel_id for update;
  if not found then
    raise exception 'Duell nicht gefunden';
  end if;
  if v_duel.challenger_id <> v_uid then
    raise exception 'Nur wer das Duell erstellt hat, kann es zurückziehen';
  end if;
  if v_duel.status not in ('pending', 'offen') then
    raise exception 'Duell ist nicht mehr offen';
  end if;
  if now() >= coalesce(public.duel_accept_until(p_duel_id), 'infinity'::timestamptz) then
    raise exception 'Tippschluss vorbei – zurückziehen geht nicht mehr';
  end if;

  update public.duels set status = 'zurueckgezogen', resolved_at = now() where id = p_duel_id;
  for v_p in
    select * from public.duel_participants where duel_id = p_duel_id and status in ('eingeladen', 'angenommen')
  loop
    if v_p.status = 'angenommen' then
      update public.duel_participants set payout = v_duel.stake where duel_id = p_duel_id and user_id = v_p.user_id;
      update public.profiles set free_stars = free_stars + v_duel.stake, updated_at = now() where id = v_p.user_id;
    end if;
    if not v_p.is_creator then
      perform public.add_private_activity(v_p.user_id, '↩️',
        v_duel.challenger_name || ' hat '
        || case when v_p.status = 'angenommen'
                then 'das Duell zurückgezogen – deine ' || v_duel.stake || ' Coins sind zurück.'
                else 'die Duell-Einladung zurückgezogen.' end);
    end if;
  end loop;
  return v_duel.stake;
end;
$$;

-- ----------------------------------------------------------------------------
-- 9) Auswertung
-- ----------------------------------------------------------------------------

-- Alle Einsätze zurück (alle Spiele abgesagt oder zu wenige Spieler).
create or replace function public.duel_refund_all(p_duel_id text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_duel record;
  v_p record;
begin
  select * into v_duel from public.duels where id = p_duel_id for update;
  if not found or v_duel.status not in ('pending', 'offen') then
    return;
  end if;
  update public.duels set status = 'abgesagt', stars_credited = v_duel.stake, resolved_at = now() where id = p_duel_id;
  update public.duel_participants set status = 'verfallen', responded_at = now()
  where duel_id = p_duel_id and status = 'eingeladen';
  for v_p in select * from public.duel_participants where duel_id = p_duel_id and status = 'angenommen' loop
    update public.duel_participants set payout = v_duel.stake where duel_id = p_duel_id and user_id = v_p.user_id;
    update public.profiles set free_stars = free_stars + v_duel.stake, updated_at = now() where id = v_p.user_id;
    perform public.add_private_activity(v_p.user_id, '↩️',
      'Duell von ' || v_duel.challenger_name || ' fällt aus – deine ' || v_duel.stake || ' Coins sind zurück.');
  end loop;
end;
$$;

-- Wertet ein angenommenes Duell aus, sobald alle seine Spiele beendet oder
-- abgesagt sind. p_skip_match zählt als abgesagt (wird gerade gelöscht);
-- p_match/p_home/p_away = gerade beendetes Spiel mit Endstand.
create or replace function public.finalize_duel(p_duel_id text, p_skip_match text, p_match text, p_home int, p_away int)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  s public.duel_settings;
  v_duel record;
  v_ids text[];
  v_id text;
  v_data jsonb;
  v_home int;
  v_away int;
  v_one_x_two boolean;
  v_games jsonb := '[]'::jsonb;  -- gespielte Spiele: {m, h, a, x}
  v_game jsonb;
  v_p record;
  v_th int;
  v_ta int;
  v_stage int;
  v_tier text;
  v_pts int;
  v_sum int;
  v_res jsonb;
  v_n int;
  v_pot int;
  v_max int;
  v_first int;
  v_second int;
  v_second_n int;
  v_share int;
  v_rest int;
  v_profit int;
  v_allowed int;
  v_day timestamptz;
  v_week timestamptz;
  v_winner uuid;
begin
  select * into s from public.duel_settings;
  select * into v_duel from public.duels where id = p_duel_id for update;
  if not found or v_duel.status <> 'offen' then
    return;
  end if;
  v_ids := coalesce(v_duel.match_ids, array[v_duel.match_id]);

  foreach v_id in array v_ids loop
    if v_id = p_skip_match then
      continue;
    end if;
    select data into v_data from public.matches where id = v_id;
    if v_data is null or v_data ->> 'status' = 'cancelled' then
      continue;
    end if;
    if v_id = p_match and p_home is not null and p_away is not null then
      v_home := p_home;
      v_away := p_away;
    elsif v_data ->> 'status' = 'finished'
      and public.try_int(v_data -> 'liveHomeScore') is not null
      and public.try_int(v_data -> 'liveAwayScore') is not null then
      v_home := public.try_int(v_data -> 'liveHomeScore');
      v_away := public.try_int(v_data -> 'liveAwayScore');
    else
      return;  -- ein Spiel läuft noch
    end if;
    v_games := v_games || jsonb_build_object('m', v_id, 'h', v_home, 'a', v_away,
      'x', coalesce(v_data ->> 'tipMode', 'score') = '1x2');
  end loop;

  select count(*) into v_n from public.duel_participants where duel_id = p_duel_id and status = 'angenommen';
  if jsonb_array_length(v_games) = 0 or v_n < 2 then
    perform public.duel_refund_all(p_duel_id);
    return;
  end if;

  -- Punkte pro Spieler
  for v_p in select * from public.duel_participants where duel_id = p_duel_id and status = 'angenommen' loop
    v_sum := 0;
    v_res := '[]'::jsonb;
    for v_game in select * from jsonb_array_elements(v_games) loop
      v_th := null;
      v_ta := null;
      select predicted_home_score, predicted_away_score into v_th, v_ta
      from public.tips
      where user_id = v_p.user_id and match_id = v_game ->> 'm' and refunded_at is null
      order by submitted_at desc limit 1;
      v_one_x_two := (v_game ->> 'x')::boolean;
      if v_th is null or v_ta is null then
        v_stage := 0;
      else
        v_stage := public.ranking_stage(v_th, v_ta, (v_game ->> 'h')::int, (v_game ->> 'a')::int, v_one_x_two);
      end if;
      v_tier := case when v_one_x_two then case v_stage when 1 then 'tendenz' else 'falsch' end
                     else case v_stage when 3 then 'exakt' when 2 then 'differenz' when 1 then 'tendenz' else 'falsch' end end;
      v_pts := case v_tier when 'exakt' then 10 when 'differenz' then 7 when 'tendenz' then 5 else -3 end;
      v_sum := v_sum + v_pts;
      v_res := v_res || jsonb_build_object('m', v_game ->> 'm', 'tier', v_tier, 'pts', v_pts,
        'tip', case when v_th is null then null else v_th || ':' || v_ta end);
    end loop;
    update public.duel_participants set points = v_sum, game_results = v_res
    where duel_id = p_duel_id and user_id = v_p.user_id;
  end loop;
  -- Abgesagte Spiele für die Anzeige
  foreach v_id in array v_ids loop
    if not exists (select 1 from jsonb_array_elements(v_games) g where g ->> 'm' = v_id) then
      update public.duel_participants
      set game_results = game_results || jsonb_build_array(jsonb_build_object('m', v_id, 'abgesagt', true))
      where duel_id = p_duel_id and status = 'angenommen';
    end if;
  end loop;

  -- Plätze
  update public.duel_participants p set place = r.place
  from (select user_id, rank() over (order by points desc) as place
        from public.duel_participants where duel_id = p_duel_id and status = 'angenommen') r
  where p.duel_id = p_duel_id and p.user_id = r.user_id;

  -- Auszahlung (vor dem Deckel)
  v_pot := v_n * v_duel.stake;
  select max(points) into v_max from public.duel_participants where duel_id = p_duel_id and status = 'angenommen';
  select count(*) into v_first from public.duel_participants where duel_id = p_duel_id and status = 'angenommen' and points = v_max;
  update public.duel_participants set payout = 0 where duel_id = p_duel_id and status = 'angenommen';

  if v_first = v_n then
    update public.duel_participants set payout = v_duel.stake where duel_id = p_duel_id and status = 'angenommen';
  elsif v_n = 2 then
    update public.duel_participants set payout = v_pot where duel_id = p_duel_id and status = 'angenommen' and points = v_max;
  elsif v_first >= 2 then
    v_share := v_pot / v_first;
    v_rest := v_pot - v_share * v_first;
    update public.duel_participants p set payout = v_share + case when r.rn <= v_rest then 1 else 0 end
    from (select user_id, row_number() over (order by responded_at, user_id) as rn
          from public.duel_participants where duel_id = p_duel_id and status = 'angenommen' and points = v_max) r
    where p.duel_id = p_duel_id and p.user_id = r.user_id;
  else
    select max(points) into v_second from public.duel_participants
    where duel_id = p_duel_id and status = 'angenommen' and points < v_max;
    select count(*) into v_second_n from public.duel_participants
    where duel_id = p_duel_id and status = 'angenommen' and points = v_second;
    v_share := v_duel.stake / v_second_n;
    v_rest := v_duel.stake - v_share * v_second_n;
    update public.duel_participants set payout = v_pot - v_duel.stake + v_rest
    where duel_id = p_duel_id and status = 'angenommen' and points = v_max;
    update public.duel_participants set payout = v_share
    where duel_id = p_duel_id and status = 'angenommen' and points = v_second;
  end if;

  -- Gewinn-Deckel pro Tag und Woche, dann gutschreiben und benachrichtigen
  v_day := (public.pooltipp_day(now())::timestamp at time zone 'Europe/Vienna');
  v_week := (date_trunc('week', public.pooltipp_day(now()))::timestamp at time zone 'Europe/Vienna');
  for v_p in
    select * from public.duel_participants where duel_id = p_duel_id and status = 'angenommen'
    order by place, responded_at, user_id
  loop
    v_profit := greatest(0, v_p.payout - v_duel.stake);
    v_allowed := least(v_profit,
      greatest(0, s.day_win_cap - public.duel_won_since(v_p.user_id, v_day)),
      greatest(0, s.week_win_cap - public.duel_won_since(v_p.user_id, v_week)));
    update public.duel_participants
    set payout = v_p.payout - (v_profit - v_allowed), capped = v_profit - v_allowed
    where duel_id = p_duel_id and user_id = v_p.user_id;
    if v_p.payout - (v_profit - v_allowed) > 0 then
      update public.profiles set free_stars = free_stars + v_p.payout - (v_profit - v_allowed), updated_at = now()
      where id = v_p.user_id;
    end if;
    -- Damit der nächste Spieler im selben Duell den richtigen Stand sieht,
    -- zählt der Gewinn erst nach dem Abschluss unten (status ausgewertet).
    perform public.add_private_activity(v_p.user_id,
      case when v_first = v_n then '🤝' when v_p.place = 1 then '🏆' when v_p.payout > 0 then '🥈' else '⚔️' end,
      'Duell mit ' || public.duel_names(p_duel_id, v_p.user_id) || ': '
      || case
           when v_first = v_n then 'Gleichstand – deine ' || v_duel.stake || ' Coins sind zurück.'
           when v_p.place = 1 then 'gewonnen, +' || v_allowed || ' Coins'
             || case when v_profit > v_allowed then ' (' || (v_profit - v_allowed) || ' Coins über dem Gewinn-Deckel verfallen)' else '' end || '.'
           when v_p.payout > 0 then 'Platz ' || v_p.place || ', ' || (v_p.payout - (v_profit - v_allowed)) || ' Coins zurück.'
           else 'Platz ' || v_p.place || ', ' || v_duel.stake || ' Coins verloren.'
         end);
  end loop;

  select user_id into v_winner from public.duel_participants
  where duel_id = p_duel_id and status = 'angenommen' and place = 1 and v_first = 1;
  update public.duels
  set status = 'ausgewertet',
      result = case when v_first = v_n then 'unentschieden'
                    when v_winner = v_duel.challenger_id then 'challenger'
                    else 'opponent' end,
      stars_credited = (select max(payout) from public.duel_participants where duel_id = p_duel_id),
      resolved_at = now()
  where id = p_duel_id;
end;
$$;

-- Ein Spiel ist beendet: Einladungen dieses Duells laufen ab, angenommene
-- Duelle werden ausgewertet, sobald alle ihre Spiele fertig sind.
create or replace function public.resolve_duels_internal(p_match_id text, p_actual_home int, p_actual_away int)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_id text;
begin
  for v_id in
    select id from public.duels
    where status in ('pending', 'offen') and p_match_id = any(coalesce(match_ids, array[match_id]))
    order by created_at
  loop
    perform public.duel_advance(v_id, true);
    perform public.finalize_duel(v_id, null, p_match_id, p_actual_home, p_actual_away);
  end loop;
end;
$$;

-- Spiel abgesagt oder gelöscht: Tipps erstatten (wie bisher), bei Duellen
-- zählt das Spiel nicht mehr mit.
create or replace function public.refund_match_stakes(p_match_id text)
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_tip record;
  v_duel record;
  v_count int := 0;
begin
  for v_tip in
    select id, user_id, stake from public.tips
    where match_id = p_match_id and not evaluated
    for update
  loop
    update public.tips
    set evaluated = true,
        refunded_at = now(),
        result_tier = null,
        rang_delta = 0,
        stars_delta = 0,
        narration = 'Spiel abgesagt – ' || v_tip.stake || ' Sterne zurück.',
        updated_at = now()
    where id = v_tip.id;
    if v_tip.stake > 0 then
      update public.profiles
      set free_stars = free_stars + v_tip.stake, updated_at = now()
      where id = v_tip.user_id;
    end if;
    v_count := v_count + 1;
  end loop;

  for v_duel in
    select id, status, coalesce(match_ids, array[match_id]) as ids from public.duels
    where status in ('pending', 'offen') and p_match_id = any(coalesce(match_ids, array[match_id]))
    order by created_at
  loop
    if not exists (
      select 1 from unnest(v_duel.ids) m(id) join public.matches x on x.id = m.id
      where m.id <> p_match_id and coalesce(x.data ->> 'status', '') <> 'cancelled'
    ) then
      perform public.duel_refund_all(v_duel.id);
    elsif v_duel.status = 'offen' then
      perform public.finalize_duel(v_duel.id, p_match_id, null, null, null);
    end if;
  end loop;

  return v_count;
end;
$$;

-- ----------------------------------------------------------------------------
-- 10) Konto löschen: wer selbst ein laufendes Duell erstellt hat, dessen
--     Mitspieler bekommen ihren Einsatz zurück. Eingeladene, die ihr Konto
--     löschen, fallen einfach aus dem Duell (der Rest spielt weiter).
-- ----------------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_league record;
  v_new_owner uuid;
  v_duel record;
begin
  if v_uid is null then
    raise exception 'Nicht eingeloggt';
  end if;
  if public.is_admin() then
    raise exception 'Das Admin-Konto kann nicht gelöscht werden';
  end if;

  -- Eigene laufende Duelle: Einsatz der Mitspieler zurück.
  for v_duel in
    select * from public.duels where challenger_id = v_uid and status in ('pending', 'offen') for update
  loop
    update public.profiles p
    set free_stars = p.free_stars + v_duel.stake, updated_at = now()
    from public.duel_participants dp
    where dp.duel_id = v_duel.id and dp.status = 'angenommen' and dp.user_id <> v_uid and p.id = dp.user_id;
  end loop;

  -- Selbst gegründete Tipprunden an das dienstälteste Mitglied übergeben.
  if to_regclass('public.leagues') is not null then
    for v_league in
      select id from public.leagues where creator_id = v_uid for update
    loop
      select m.user_id into v_new_owner
      from public.league_members m
      where m.league_id = v_league.id and m.user_id <> v_uid
      order by m.joined_at, m.user_id
      limit 1;
      if v_new_owner is not null then
        update public.leagues set creator_id = v_new_owner where id = v_league.id;
      end if;
      -- Ohne weitere Mitglieder löscht das Löschen des Kontos die Runde mit.
    end loop;
  end if;

  if to_regclass('public.chat_messages') is not null then
    update public.chat_messages set author_name = 'Gelöschter Spieler' where user_id = v_uid;
  end if;
  if to_regclass('public.match_comments') is not null then
    update public.match_comments set author_name = 'Gelöschter Spieler' where user_id = v_uid;
  end if;
  if to_regclass('public.activity_feed') is not null then
    delete from public.activity_feed where user_id = v_uid;
  end if;

  -- Das Login selbst. Alles, was per "on delete cascade" daran hängt
  -- (Profil, Tipps, Freundschaften, Duelle, Tipprunden-Mitgliedschaften,
  -- Vereine, Profil-Extras), verschwindet damit automatisch mit.
  delete from auth.users where id = v_uid;
end;
$$;

-- ----------------------------------------------------------------------------
-- 11) Admin-Bericht "Auffällige Duelle" (letzte 30 Tage, nur Anzeige)
-- ----------------------------------------------------------------------------
create or replace function public.admin_duel_report()
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_since timestamptz := now() - interval '30 days';
  v_out jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then
    raise exception 'Nur der Admin';
  end if;

  -- a) Zwei Spieler, bei denen immer derselbe vorne liegt (ab 3 Duellen)
  v_out := v_out || coalesce((
    select jsonb_agg(jsonb_build_object('art', 'Immer derselbe Sieger',
      'text', w.display_name || ' lag in allen ' || x.n || ' gemeinsamen Duellen vor ' || l.display_name))
    from (
      select a.user_id as winner, b.user_id as loser, count(*) as n
      from public.duel_participants a
      join public.duel_participants b on b.duel_id = a.duel_id and b.user_id <> a.user_id
      join public.duels d on d.id = a.duel_id
      where d.status = 'ausgewertet' and d.resolved_at >= v_since
        and a.status = 'angenommen' and b.status = 'angenommen' and a.place < b.place
        and not exists (
          select 1 from public.duel_participants a2
          join public.duel_participants b2 on b2.duel_id = a2.duel_id
          join public.duels d2 on d2.id = a2.duel_id
          where a2.user_id = a.user_id and b2.user_id = b.user_id and d2.status = 'ausgewertet'
            and d2.resolved_at >= v_since and a2.status = 'angenommen' and b2.status = 'angenommen'
            and a2.place >= b2.place)
      group by a.user_id, b.user_id
      having count(*) >= 3
    ) x
    join public.profiles w on w.id = x.winner
    join public.profiles l on l.id = x.loser), '[]'::jsonb);

  -- b) Auffällig schlechte Duell-Tipps (ab 5 Duell-Spielen fast nur falsch
  --    oder gar nicht getippt)
  v_out := v_out || coalesce((
    select jsonb_agg(jsonb_build_object('art', 'Schlechte oder fehlende Duell-Tipps',
      'text', pr.display_name || ': ' || x.bad || ' von ' || x.n || ' Duell-Spielen falsch oder ohne Tipp'
              || ', ' || x.lost || ' Duelle verloren'))
    from (
      select p.user_id,
        count(*) as n,
        count(*) filter (where g ->> 'tier' = 'falsch') as bad,
        count(distinct p.duel_id) filter (where coalesce(p.payout, 0) < d.stake) as lost
      from public.duel_participants p
      join public.duels d on d.id = p.duel_id
      cross join lateral jsonb_array_elements(coalesce(p.game_results, '[]'::jsonb)) g
      where d.status = 'ausgewertet' and d.resolved_at >= v_since and p.status = 'angenommen'
        and g ->> 'tier' is not null
      group by p.user_id
      having count(*) >= 5 and count(*) filter (where g ->> 'tier' = 'falsch') >= 0.7 * count(*)
    ) x
    join public.profiles pr on pr.id = x.user_id), '[]'::jsonb);

  -- c) Konten, die fast nur in Duellen tippen
  v_out := v_out || coalesce((
    select jsonb_agg(jsonb_build_object('art', 'Tippt fast nur in Duellen',
      'text', pr.display_name || ': ' || x.duels || ' Duelle, aber nur ' || x.other || ' Tipps auf andere Spiele'))
    from (
      select p.user_id, count(distinct p.duel_id) as duels,
        (select count(*) from public.tips t
         where t.user_id = p.user_id and t.submitted_at >= v_since and t.refunded_at is null
           and not exists (select 1 from public.duel_participants p2 join public.duels d2 on d2.id = p2.duel_id
                           where p2.user_id = p.user_id and p2.status = 'angenommen'
                             and t.match_id = any(coalesce(d2.match_ids, array[d2.match_id])))) as other
      from public.duel_participants p
      join public.duels d on d.id = p.duel_id
      where p.status = 'angenommen' and d.created_at >= v_since
        and d.status in ('offen', 'ausgewertet')
      group by p.user_id
      having count(distinct p.duel_id) >= 3
    ) x
    join public.profiles pr on pr.id = x.user_id
    where x.other < 5), '[]'::jsonb);

  -- d) Gewinn-Deckel erreicht
  v_out := v_out || coalesce((
    select jsonb_agg(jsonb_build_object('art', 'Gewinn-Deckel erreicht',
      'text', pr.display_name || ': ' || x.times || ' x gedeckelt, ' || x.coins || ' Coins verfallen'))
    from (
      select p.user_id, count(*) as times, sum(p.capped) as coins
      from public.duel_participants p join public.duels d on d.id = p.duel_id
      where coalesce(p.capped, 0) > 0 and d.resolved_at >= v_since
      group by p.user_id
    ) x
    join public.profiles pr on pr.id = x.user_id), '[]'::jsonb);

  return v_out;
end;
$$;

-- ----------------------------------------------------------------------------
-- 12) Rechte
-- ----------------------------------------------------------------------------
revoke all on function public.match_deadline(text) from public, anon, authenticated;
revoke all on function public.duel_accept_until(text) from public, anon, authenticated;
revoke all on function public.duel_not_allowed(uuid) from public, anon, authenticated;
revoke all on function public.duel_pair_count_week(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.duel_won_since(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.stake_used_today(uuid) from public, anon, authenticated;
revoke all on function public.duel_names(text, uuid) from public, anon, authenticated;
revoke all on function public.protect_duel_stake() from public, anon, authenticated;
revoke all on function public.duel_invite(text, uuid) from public, anon, authenticated;
revoke all on function public.duel_after_insert() from public, anon, authenticated;
revoke all on function public.duel_advance(text, boolean) from public, anon, authenticated;
revoke all on function public.duel_refund_all(text) from public, anon, authenticated;
revoke all on function public.finalize_duel(text, text, text, int, int) from public, anon, authenticated;
revoke all on function public.resolve_duels_internal(text, int, int) from public, anon, authenticated;
revoke all on function public.refund_match_stakes(text) from public, anon, authenticated;

revoke all on function public.is_duel_member(text) from public, anon;
revoke all on function public.create_duel(uuid[], text[], int) from public, anon;
revoke all on function public.expire_my_duels() from public, anon;
revoke all on function public.accept_duel(text) from public, anon;
revoke all on function public.decline_duel(text) from public, anon;
revoke all on function public.withdraw_duel(text) from public, anon;
revoke all on function public.delete_my_account() from public, anon;
revoke all on function public.admin_duel_report() from public, anon;
grant execute on function public.is_duel_member(text) to authenticated;
grant execute on function public.create_duel(uuid[], text[], int) to authenticated;
grant execute on function public.expire_my_duels() to authenticated;
grant execute on function public.accept_duel(text) to authenticated;
grant execute on function public.decline_duel(text) to authenticated;
grant execute on function public.withdraw_duel(text) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.admin_duel_report() to authenticated;

commit;
