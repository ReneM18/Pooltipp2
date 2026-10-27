-- ============================================================================
-- PoolTipp – Sportlerkarte pro Sportart (Rene, 20.10.2026)
-- ============================================================================
-- Die Karte beweist, dass man sich in einer Sportart auskennt. Darum gibt es
-- sie pro Sportart, mit Rang-Abzeichen, Platz und Rangpunkten dieser
-- Sportart und auf der Rückseite der Tipp-Statistik dieser Sportart.
--
-- Dauerhafte Tipp-Statistik (Rene, 27.10.2026): "du musst was einbauen was
-- jeden tipp im hintergrund speichert in die statistik ... auch wenn ich die
-- matches natürlich mit der zeit lösche". Darum gibt es die Tabelle
-- tip_stats: eine Zeile pro Tipp mit Sportart und Wertung. Sie wird im
-- Hintergrund bei jedem Tipp und jeder Auswertung nachgeführt und bleibt
-- stehen, wenn Spiele (oder ausgewertete Tipps) gelöscht werden. Nur ein
-- zurückgenommener offener Tipp und ein erstatteter Tipp (Spiel abgesagt)
-- fallen heraus.
--
-- Für den Tipp-Typ (supabase/tipp-typ.sql, Rene 27.10.2026: "Tipptyp ohne
-- Statistik") stehen dazu auch der getippte Spielstand, Tippmodus,
-- Tippschluss und die beiden Vereine in tip_stats, so rechnet auch der
-- Tipp-Typ nach dem Löschen von Spielen weiter.
--
-- Einmalig werden alle bisherigen Tipps übernommen. Bei Tipps, deren Spiel
-- schon gelöscht ist, wird die Sportart aus dem Feed-Eintrag "hat beim
-- Spiel ... getippt" geholt (dessen Symbol ⚽/🏈/🏀/🏒 nennt die Sportart).
--
-- sport_card_stats(p_user) liefert je Sportart:
--   points, place, prestige  – wie in der Rangliste (seit dem Neustart, öffentlich)
--   Die Tipp-Statistik zählt dagegen ALLE Tipps seit dem ersten (aus tip_stats).
--   tips, evaluated, exakt, richtig, first_tip, last_tip (Zeitraum der
--     Statistik, Rene: "von wann bis wann") – NUR wenn der Betrachter die Statistik
--     sehen darf (Einstellung "Wer sieht meine Statistik", stats_visible aus
--     supabase/rivalen.sql), sonst leer.
--
-- Ausführen: Supabase-Dashboard -> SQL Editor -> New query -> dieses
-- komplette Skript einfügen -> "Run". Darf mehrfach ausgeführt werden.
-- Ändert keine Tipps, Punkte oder Spiele.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Tabelle: jeder Tipp dauerhaft
-- ----------------------------------------------------------------------------
create table if not exists public.tip_stats (
  tip_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id text not null,
  sport text,
  submitted_at timestamptz not null,
  evaluated boolean not null default false,
  result_tier text,
  updated_at timestamptz not null default now()
);
-- Seit 27.10.2026 (Tipp-Typ): Tipp selbst und Angaben zum Spiel.
alter table public.tip_stats add column if not exists predicted_home int;
alter table public.tip_stats add column if not exists predicted_away int;
alter table public.tip_stats add column if not exists tip_mode text;
alter table public.tip_stats add column if not exists deadline timestamptz;
alter table public.tip_stats add column if not exists home_id text;
alter table public.tip_stats add column if not exists away_id text;
create index if not exists tip_stats_user_idx on public.tip_stats(user_id, sport);
create index if not exists tip_stats_match_idx on public.tip_stats(match_id);
alter table public.tip_stats enable row level security;
-- Nur über sport_card_stats lesbar, kein direkter Zugriff aus der App.
revoke all on public.tip_stats from anon, authenticated;

-- Sportart eines Spiels; Spiele ohne Sportart sind Fußball wie in der
-- Auswertung.
create or replace function public.tip_stats_sport_of(p_data jsonb)
returns text
language sql
immutable
as $$
  select coalesce(nullif(p_data ->> 'sport', ''), 'Fußball');
$$;

-- Tippmodus und Tippschluss eines Spiels (für den Tipp-Typ). Ohne Spiel
-- (schon gelöscht) bleibt beides leer.
create or replace function public.tip_stats_mode_of(p_data jsonb)
returns text
language sql
immutable
as $$
  select case when p_data is null then null else coalesce(nullif(p_data ->> 'tipMode', ''), 'score') end;
$$;

create or replace function public.tip_stats_deadline_of(p_data jsonb)
returns timestamptz
language sql
stable
as $$
  select coalesce(public.try_timestamptz(p_data ->> 'tipDeadline'), public.try_timestamptz(p_data ->> 'kickoff'));
$$;

-- ----------------------------------------------------------------------------
-- 2) Im Hintergrund nachführen
-- ----------------------------------------------------------------------------
create or replace function public.tip_stats_sync()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_sport text;
  v_data jsonb;
begin
  if tg_op = 'DELETE' then
    -- Zurückgenommene offene Tipps fallen raus, ausgewertete bleiben.
    delete from public.tip_stats where tip_id = old.id and not evaluated;
    return old;
  end if;
  if new.refunded_at is not null then
    delete from public.tip_stats where tip_id = new.id;
    return new;
  end if;
  select m.data, public.tip_stats_sport_of(m.data) into v_data, v_sport
  from public.matches m where m.id = new.match_id;
  insert into public.tip_stats as s
    (tip_id, user_id, match_id, sport, submitted_at, evaluated, result_tier,
     predicted_home, predicted_away, tip_mode, deadline, home_id, away_id)
  values
    (new.id, new.user_id, new.match_id, v_sport, new.submitted_at, new.evaluated, new.result_tier,
     new.predicted_home_score, new.predicted_away_score,
     public.tip_stats_mode_of(v_data), public.tip_stats_deadline_of(v_data),
     v_data ->> 'homeTeamId', v_data ->> 'awayTeamId')
  on conflict (tip_id) do update set
    sport = coalesce(excluded.sport, s.sport),
    submitted_at = excluded.submitted_at,
    evaluated = excluded.evaluated,
    result_tier = excluded.result_tier,
    predicted_home = excluded.predicted_home,
    predicted_away = excluded.predicted_away,
    tip_mode = coalesce(excluded.tip_mode, s.tip_mode),
    deadline = coalesce(excluded.deadline, s.deadline),
    home_id = coalesce(excluded.home_id, s.home_id),
    away_id = coalesce(excluded.away_id, s.away_id),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists tip_stats_sync on public.tips;
create trigger tip_stats_sync
  after insert or update or delete on public.tips
  for each row execute function public.tip_stats_sync();

-- Ändert der Admin Sportart, Tippmodus, Tippschluss oder Vereine eines
-- Spiels, zieht die Statistik mit.
create or replace function public.tip_stats_match_sport()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if public.tip_stats_sport_of(new.data) is distinct from public.tip_stats_sport_of(old.data)
     or public.tip_stats_mode_of(new.data) is distinct from public.tip_stats_mode_of(old.data)
     or public.tip_stats_deadline_of(new.data) is distinct from public.tip_stats_deadline_of(old.data)
     or (new.data ->> 'homeTeamId') is distinct from (old.data ->> 'homeTeamId')
     or (new.data ->> 'awayTeamId') is distinct from (old.data ->> 'awayTeamId') then
    update public.tip_stats
    set sport = public.tip_stats_sport_of(new.data),
        tip_mode = public.tip_stats_mode_of(new.data),
        deadline = public.tip_stats_deadline_of(new.data),
        home_id = new.data ->> 'homeTeamId',
        away_id = new.data ->> 'awayTeamId',
        updated_at = now()
    where match_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists tip_stats_match_sport on public.matches;
create trigger tip_stats_match_sport
  after update of data on public.matches
  for each row execute function public.tip_stats_match_sport();

revoke all on function public.tip_stats_sync() from public, anon, authenticated;
revoke all on function public.tip_stats_match_sport() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3) Einmalig: alle bisherigen Tipps übernehmen
-- ----------------------------------------------------------------------------
insert into public.tip_stats as s
  (tip_id, user_id, match_id, sport, submitted_at, evaluated, result_tier,
   predicted_home, predicted_away, tip_mode, deadline, home_id, away_id)
select t.id, t.user_id, t.match_id,
       case when m.id is not null then public.tip_stats_sport_of(m.data) end,
       t.submitted_at, t.evaluated, t.result_tier,
       t.predicted_home_score, t.predicted_away_score,
       public.tip_stats_mode_of(m.data), public.tip_stats_deadline_of(m.data),
       m.data ->> 'homeTeamId', m.data ->> 'awayTeamId'
from public.tips t
left join public.matches m on m.id = t.match_id
where t.refunded_at is null
on conflict (tip_id) do update set
  sport = coalesce(excluded.sport, s.sport),
  submitted_at = excluded.submitted_at,
  evaluated = excluded.evaluated,
  result_tier = excluded.result_tier,
  predicted_home = excluded.predicted_home,
  predicted_away = excluded.predicted_away,
  tip_mode = coalesce(excluded.tip_mode, s.tip_mode),
  deadline = coalesce(excluded.deadline, s.deadline),
  home_id = coalesce(excluded.home_id, s.home_id),
  away_id = coalesce(excluded.away_id, s.away_id),
  updated_at = now();

-- Spiel schon gelöscht: Sportart aus dem Feed-Eintrag beim Tippen (gleicher
-- Spieler, höchstens 10 Minuten neben der Tipp-Zeit, der nächste zählt).
-- Pro Spiel gilt dann die häufigste gefundene Sportart für alle Tipps darauf,
-- so bekommen auch Tipps ohne eigenen Feed-Eintrag die Sportart.
with offen as (
  select s.tip_id, s.user_id, s.match_id, s.submitted_at
  from public.tip_stats s
  where s.sport is null
),
treffer as (
  select o.match_id,
         (select case f.icon
                   when '⚽' then 'Fußball'
                   when '🏈' then 'NFL'
                   when '🏀' then 'NBA'
                   when '🏒' then 'NHL'
                   when '🤾' then 'Handball'
                 end
          from public.activity_feed f
          where f.user_id = o.user_id
            and f.icon in ('⚽', '🏈', '🏀', '🏒', '🤾')
            and f.text like '%beim Spiel % getippt.'
            and f.created_at between o.submitted_at - interval '10 minutes'
                                 and o.submitted_at + interval '10 minutes'
          order by abs(extract(epoch from f.created_at - o.submitted_at))
          limit 1) as sport
  from offen o
),
je_spiel as (
  select treffer.match_id, mode() within group (order by treffer.sport) as sport
  from treffer
  where treffer.sport is not null
  group by treffer.match_id
)
update public.tip_stats s
set sport = j.sport, updated_at = now()
from je_spiel j
where s.match_id = j.match_id and s.sport is null;

-- ----------------------------------------------------------------------------
-- 4) Abfrage für die Karte
-- ----------------------------------------------------------------------------
drop function if exists public.sport_card_stats(uuid);
create or replace function public.sport_card_stats(p_user uuid)
returns table (
  sport text,
  points int,
  place int,
  prestige int,
  tips int,
  evaluated int,
  exakt int,
  richtig int,
  first_tip timestamptz,
  last_tip timestamptz
)
language plpgsql
stable
security definer set search_path = public
as $$
#variable_conflict use_column
declare
  v_show boolean := public.stats_visible(auth.uid(), p_user);
begin
  return query
  with rp as (
    select e.k as s, round((e.v #>> '{}')::numeric)::int as pts
    from public.profiles p,
         jsonb_each(case when jsonb_typeof(p.rang_punkte) = 'object' then p.rang_punkte else '{}'::jsonb end) as e(k, v)
    where p.id = p_user and jsonb_typeof(e.v) = 'number'
  ),
  pr as (
    select e.k as s, round((e.v #>> '{}')::numeric)::int as lvl
    from public.profiles p,
         jsonb_each(case when jsonb_typeof(p.prestige) = 'object' then p.prestige else '{}'::jsonb end) as e(k, v)
    where p.id = p_user and jsonb_typeof(e.v) = 'number'
  ),
  ts as (
    -- ALLE Tipps seit dem allerersten, auch die vor dem Neustart des
    -- Punktesystems (Rene, 20.10.2026: "von Beginn an bis zum Erwerb") und
    -- die zu längst gelöschten Spielen (aus tip_stats).
    select x.sport as s,
           count(*)::int as n_tips,
           count(*) filter (where x.evaluated and x.result_tier is not null)::int as n_eval,
           count(*) filter (where x.evaluated and x.result_tier = 'exakt')::int as n_exakt,
           count(*) filter (where x.evaluated and x.result_tier in ('exakt', 'differenz', 'tendenz'))::int as n_richtig,
           min(x.submitted_at) as d_first,
           max(x.submitted_at) as d_last
    from public.tip_stats x
    where x.user_id = p_user and x.sport is not null
    group by 1
  ),
  sp as (
    select rp.s from rp
    union
    select ts.s from ts where ts.s is not null
  )
  select
    sp.s,
    coalesce(rp.pts, 0),
    case
      when coalesce(rp.pts, 0) > 0 then 1 + (
        select count(*)::int from public.profiles o
        where jsonb_typeof(o.rang_punkte -> sp.s) = 'number'
          and (o.rang_punkte ->> sp.s)::numeric > rp.pts
      )
    end,
    coalesce(pr.lvl, 0),
    case when v_show then coalesce(ts.n_tips, 0) end,
    case when v_show then coalesce(ts.n_eval, 0) end,
    case when v_show then coalesce(ts.n_exakt, 0) end,
    case when v_show then coalesce(ts.n_richtig, 0) end,
    case when v_show then ts.d_first end,
    case when v_show then ts.d_last end
  from sp
  left join rp on rp.s = sp.s
  left join pr on pr.s = sp.s
  left join ts on ts.s = sp.s;
end;
$$;

revoke all on function public.sport_card_stats(uuid) from public, anon;
grant execute on function public.sport_card_stats(uuid) to authenticated;

-- Kontrolle: wie viele Tipps übernommen wurden und bei wie vielen die
-- Sportart nicht mehr herauszufinden war (die fehlen auf der Karte).
select 'Tipp-Statistik dauerhaft gespeichert' as status,
       (select count(*) from public.tip_stats) as tipps_gespeichert,
       (select count(*) from public.tip_stats where sport is null) as tipps_ohne_sportart;
