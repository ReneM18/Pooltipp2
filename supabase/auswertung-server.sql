-- ============================================================================
-- PoolTipp – Sterne, Rangpunkte und Saison-XP nur noch in der Datenbank
-- ============================================================================
-- Bisher hat jeder Browser selbst gerechnet (Tipp-Auswertung, Einsatz,
-- Tagesbonus, Serien-Bonus, Bonusfragen, Saison-Pass) und das Ergebnis ins
-- eigene Profil geschrieben. Wer sich auskennt, konnte so beliebig viele
-- Sterne, Rangpunkte oder XP eintragen.
--
-- Ab jetzt:
--   1) Die Datenbank wertet ein Spiel selbst aus, sobald der Admin den
--      Endstand speichert (für ALLE Spieler auf einmal, auch wenn sie die App
--      gerade nicht offen haben). Eine Endstand-Korrektur bucht nur die
--      Differenz um, nie doppelt. Ein beendetes Spiel bleibt beendet.
--   2) Beim Tippen zieht die Datenbank den Einsatz ab (Spiel-Einsatz,
--      höchstens das Guthaben, Tageslimit 100, einmal 20 Rettungs-Sterne).
--      Ein Tipp pro Spiel, nach Tippschluss keiner mehr.
--   3) Tagesbonus, Tipp-Serie, Saison-Pass-Sterne, Bonusfragen und
--      Duell-Einsätze laufen über Datenbank-Funktionen.
--   4) Der Browser kann Sterne, Rangpunkte, XP, Serie, Pass-Level und die
--      Auswertung von Tipps nicht mehr selbst ändern (es bleibt dann einfach
--      der alte Wert stehen). Den Anzeigenamen ändern geht weiter.
--
-- Einmalig beim Ausführen:
--   - Spiele, die schon beendet sind, werden nachgewertet (offene Tipps
--     bekommen ihre Sterne/Rangpunkte, alte 1X2-Tipps werden auf die neue
--     Regel korrigiert). Nichts wird doppelt bezahlt.
--   - Rangpunkte jedes Spielers = Summe seiner Tipp-Punkte (wie
--     rangpunkte-neu-berechnen.sql).
--   - Bonusfrage-Antworten ziehen in eine eigene Tabelle um.
--
-- Darf beliebig oft ausgeführt werden.
--
-- Gelöscht wird nichts: alle Tipps, Spiele, Teams, Tipprunden, Duelle,
-- Freunde und der Chat bleiben, wie sie sind.
--
-- Ausführen: vorher alle PoolTipp-Tabs schließen. Dann Supabase-Dashboard ->
-- SQL Editor -> New query -> dieses komplette Skript einfügen -> "Run".
-- Läuft als ein Block: bricht etwas ab, ändert sich gar nichts.
-- (Ist das Skript für den SQL Editor zu lang, in zwei Teilen ausführen, siehe
-- scripts/db-test/split.sh. Teil 1 legt nur Funktionen an, die noch niemand
-- benutzt; erst Teil 2 schaltet sie ein.)
-- ============================================================================

begin;


-- ----------------------------------------------------------------------------
-- 0) Hilfsfunktionen
-- ----------------------------------------------------------------------------

-- true, wenn gerade der Browser eines Spielers schreibt (anon/authenticated).
-- Datenbank-Funktionen mit erweiterten Rechten (SECURITY DEFINER) und der
-- SQL-Editor laufen unter einer anderen Rolle und dürfen alles.
create or replace function public.is_client_write()
returns boolean
language sql
stable
as $$
  select current_user in ('authenticated', 'anon');
$$;

-- Kalendertag in Österreich (Tagesbonus, Tageslimit, Tipp-Serie).
create or replace function public.pooltipp_day(p_ts timestamptz)
returns date
language sql
stable
as $$
  select (p_ts at time zone 'Europe/Vienna')::date;
$$;

-- Text -> Zeitpunkt, ohne bei kaputten Werten abzubrechen.
create or replace function public.try_timestamptz(p_text text)
returns timestamptz
language plpgsql
stable
as $$
begin
  return p_text::timestamptz;
exception when others then
  return null;
end;
$$;

create or replace function public.try_int(p_value jsonb)
returns int
language plpgsql
immutable
as $$
begin
  if p_value is null or jsonb_typeof(p_value) not in ('number', 'string') then
    return null;
  end if;
  return round((p_value #>> '{}')::numeric)::int;
exception when others then
  return null;
end;
$$;

-- Zeitstempel im gleichen Format wie der Browser (new Date().toISOString()).
create or replace function public.iso_now()
returns text
language sql
stable
as $$
  select to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
$$;

-- Private Meldung im eigenen Feed ("Exakt getroffen!", "+10 Sterne Bonus").
create or replace function public.add_private_activity(p_user uuid, p_icon text, p_text text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.activity_feed (id, user_id, author_name, icon, text, created_at)
  values ('srv-' || gen_random_uuid()::text, p_user, null, p_icon, p_text, now());
end;
$$;


-- ----------------------------------------------------------------------------
-- 1) Neue Spalten und Tabellen
-- ----------------------------------------------------------------------------
alter table public.profiles add column if not exists rescue_bonus_used boolean not null default false;
alter table public.tips add column if not exists staked_at timestamptz;
-- Kommt eigentlich aus spiel-absagen.sql; hier nur angelegt, falls das noch
-- nicht ausgeführt wurde (sonst bricht die Übernahme unten ab).
alter table public.tips add column if not exists refunded_at timestamptz;
alter table public.duels add column if not exists accepted_at timestamptz;

-- Saison-Pass-Level, damit die Datenbank weiß, ab wie vielen XP es welche
-- Belohnung gibt (gleiche Werte wie lib/seasons/herbst2026.ts). Für eine
-- neue Saison (z. B. Winter) hier nur ihre Zeilen hinzufügen.
create table if not exists public.season_pass_levels (
  season_id text not null,
  level int not null,
  xp_required int not null,
  stars_reward int not null default 0,
  primary key (season_id, level)
);
alter table public.season_pass_levels enable row level security;
drop policy if exists "Pass-Level lesen" on public.season_pass_levels;
create policy "Pass-Level lesen" on public.season_pass_levels for select using (true);
revoke all on public.season_pass_levels from anon, authenticated;
grant select on public.season_pass_levels to anon, authenticated;

insert into public.season_pass_levels (season_id, level, xp_required, stars_reward) values
  ('herbst-2026', 1, 0, 0),
  ('herbst-2026', 2, 200, 0),
  ('herbst-2026', 3, 500, 0),
  ('herbst-2026', 4, 900, 0),
  ('herbst-2026', 5, 1400, 0),
  ('herbst-2026', 6, 2000, 0),
  ('herbst-2026', 7, 2700, 0),
  ('herbst-2026', 8, 3500, 0),
  ('herbst-2026', 9, 4500, 0),
  ('herbst-2026', 10, 6000, 50)
on conflict (season_id, level) do nothing;

-- Laufende Saison. Wird nur angelegt, wenn es sie noch nicht gibt – der
-- Saisonwechsel (eigenes Skript) darf sie mit eigener Logik ersetzen.
do $$
begin
  if to_regprocedure('public.current_pass_season_id()') is null then
    execute $f$
      create function public.current_pass_season_id()
      returns text
      language sql
      stable
      as $b$ select 'herbst-2026'::text $b$
    $f$;
  end if;
end $$;

-- Bonusfrage-Antworten: bisher nur in profile_extras (vom Browser frei
-- änderbar, auch nachdem die richtige Antwort bekannt war).
create table if not exists public.bonus_answers (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  match_id text not null,
  option_index int not null,
  submitted_at timestamptz not null default now(),
  evaluated boolean not null default false,
  correct boolean,
  stars_delta int,
  unique (user_id, match_id)
);
alter table public.bonus_answers enable row level security;
drop policy if exists "Eigene Bonus-Antworten lesen" on public.bonus_answers;
create policy "Eigene Bonus-Antworten lesen" on public.bonus_answers
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Eigene Bonus-Antwort abgeben" on public.bonus_answers;
create policy "Eigene Bonus-Antwort abgeben" on public.bonus_answers
  for insert to authenticated with check (auth.uid() = user_id);
revoke all on public.bonus_answers from anon, authenticated;
grant select, insert on public.bonus_answers to authenticated;


-- ----------------------------------------------------------------------------
-- 2) Sterne abbuchen (Tipp-Einsatz, Duell, Shop) – nur intern
-- ----------------------------------------------------------------------------

-- Heute schon eingesetzte Sterne (Tipps + Duelle), für das Tageslimit 100.
-- Erstattete Tipps und abgesagte Duelle zählen nicht.
create or replace function public.stake_used_today(p_user uuid)
returns int
language sql
stable
security definer set search_path = public
as $$
  select (
    coalesce((select sum(stake) from public.tips
              where user_id = p_user and refunded_at is null and staked_at is not null
                and public.pooltipp_day(staked_at) = public.pooltipp_day(now())), 0)
    + coalesce((select sum(stake) from public.duels
                where challenger_id = p_user and status <> 'abgesagt'
                  and public.pooltipp_day(created_at) = public.pooltipp_day(now())), 0)
    + coalesce((select sum(stake) from public.duels
                where opponent_id = p_user and accepted_at is not null and status <> 'abgesagt'
                  and public.pooltipp_day(accepted_at) = public.pooltipp_day(now())), 0)
  )::int;
$$;

-- Zieht bis zu p_amount Sterne ab: nie mehr als das Guthaben, mit
-- p_use_budget nie mehr als das restliche Tageslimit (100). p_all_or_nothing:
-- reicht es nicht, wird gar nichts abgebucht (Fehler). Fällt das Guthaben
-- dabei auf 0, gibt es einmalig 20 Rettungs-Sterne. Rückgabe: tatsächlich
-- abgezogene Sterne. Gleiche Regeln wie früher spendStars() im Browser.
create or replace function public.take_stars(p_user uuid, p_amount int, p_use_budget boolean, p_all_or_nothing boolean)
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_stars int;
  v_rescue_used boolean;
  v_actual int;
begin
  select free_stars, rescue_bonus_used into v_stars, v_rescue_used
  from public.profiles where id = p_user for update;
  if not found then
    raise exception 'Profil nicht gefunden';
  end if;

  v_actual := greatest(0, least(coalesce(p_amount, 0), v_stars));
  if p_use_budget then
    v_actual := least(v_actual, greatest(0, 100 - public.stake_used_today(p_user)));
  end if;
  if p_all_or_nothing and v_actual < coalesce(p_amount, 0) then
    raise exception 'Nicht genug Sterne';
  end if;
  if v_actual = 0 then
    return 0;
  end if;

  v_stars := v_stars - v_actual;
  if v_stars <= 0 and not v_rescue_used then
    v_stars := v_stars + 20;
    v_rescue_used := true;
    perform public.add_private_activity(p_user, '🎁',
      'Deine Sterne waren aufgebraucht – hier 20 Sterne geschenkt, damit''s weitergeht.');
  end if;

  update public.profiles
  set free_stars = v_stars, rescue_bonus_used = v_rescue_used, updated_at = now()
  where id = p_user;
  return v_actual;
end;
$$;


-- ----------------------------------------------------------------------------
-- 3) Profil: Sterne, Rangpunkte, XP usw. sind für den Browser tabu
-- ----------------------------------------------------------------------------
create or replace function public.protect_profile_values()
returns trigger
language plpgsql
as $$
begin
  if not public.is_client_write() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Neues Konto: immer mit den Startwerten, egal was der Browser schickt.
    new.free_stars := 100;
    new.rang_punkte := '{"Fußball":0,"NFL":0,"NBA":0,"NHL":0}'::jsonb;
    new.pass_xp := 0;
    new.streak_count := 0;
    new.last_tip_date := null;
    new.claimed_milestones := '[]'::jsonb;
    new.last_claimed_at := null;
    new.rescue_bonus_used := false;
    return new;
  end if;

  new.id := old.id;
  new.created_at := old.created_at;
  new.free_stars := old.free_stars;
  new.rang_punkte := old.rang_punkte;
  new.pass_xp := old.pass_xp;
  new.streak_count := old.streak_count;
  new.last_tip_date := old.last_tip_date;
  new.claimed_milestones := old.claimed_milestones;
  new.last_claimed_at := old.last_claimed_at;
  new.rescue_bonus_used := old.rescue_bonus_used;
  return new;
end;
$$;


-- ----------------------------------------------------------------------------
-- 4) Tipps
-- ----------------------------------------------------------------------------

-- 4a) Was der Browser an einem Tipp ändern darf: nur das getippte Ergebnis,
--     und das nur bis Tippschluss und solange nicht ausgewertet.
create or replace function public.protect_tip_fields()
returns trigger
language plpgsql
as $$
declare
  v_deadline timestamptz;
begin
  if not public.is_client_write() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Upsert auf einen schon gespeicherten Tipp: der Update-Teil regelt das.
    if exists (select 1 from public.tips where id = new.id) then
      return new;
    end if;
    new.submitted_at := now();
    new.evaluated := false;
    new.result_tier := null;
    new.rang_delta := null;
    new.stars_delta := null;
    new.beat_percent := null;
    new.narration := null;
    new.evaluated_home_score := null;
    new.evaluated_away_score := null;
    new.refunded_at := null;
    new.staked_at := null;
    return new;
  end if;

  new.id := old.id;
  new.user_id := old.user_id;
  new.match_id := old.match_id;
  new.stake := old.stake;
  new.staked_at := old.staked_at;
  new.submitted_at := old.submitted_at;
  new.evaluated := old.evaluated;
  new.result_tier := old.result_tier;
  new.rang_delta := old.rang_delta;
  new.stars_delta := old.stars_delta;
  new.beat_percent := old.beat_percent;
  new.narration := old.narration;
  new.evaluated_home_score := old.evaluated_home_score;
  new.evaluated_away_score := old.evaluated_away_score;
  new.refunded_at := old.refunded_at;

  select coalesce(public.try_timestamptz(data ->> 'tipDeadline'), public.try_timestamptz(data ->> 'kickoff'))
  into v_deadline
  from public.matches where id = old.match_id;
  if old.evaluated or (v_deadline is not null and now() >= v_deadline) then
    new.predicted_home_score := old.predicted_home_score;
    new.predicted_away_score := old.predicted_away_score;
  end if;
  return new;
end;
$$;

-- 4b) Neuer Tipp: Einsatz abziehen und Tipp-Serie fortschreiben. Läuft nach
--     protect_tip_fields und vor refund_tip_on_cancelled_match (Trigger
--     laufen alphabetisch).
create or replace function public.protect_tip_stake()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_match jsonb;
  v_deadline timestamptz;
  v_stake int;
  v_profile record;
  v_today date;
  v_last_day date;
  v_count int;
  v_claimed jsonb;
  v_bonus int := 0;
  v_days int;
  v_milestone record;
begin
  -- Sperrt das Profil: zwei gleichzeitige Speicherungen desselben Tipps
  -- (zwei Tabs, Doppelklick) buchen so nie zweimal ab.
  select * into v_profile from public.profiles where id = new.user_id for update;
  if not found then
    return null;
  end if;

  if exists (select 1 from public.tips where id = new.id) then
    return new;
  end if;
  -- Ein Tipp pro Spiel.
  if exists (select 1 from public.tips where user_id = new.user_id and match_id = new.match_id) then
    return null;
  end if;

  select data into v_match from public.matches where id = new.match_id;
  if v_match is null or coalesce(v_match ->> 'status', '') in ('finished', 'cancelled') then
    return null;
  end if;
  v_deadline := coalesce(public.try_timestamptz(v_match ->> 'tipDeadline'), public.try_timestamptz(v_match ->> 'kickoff'));
  if v_deadline is not null and now() >= v_deadline then
    return null;
  end if;

  -- Einsatz = vom Admin festgelegter Spiel-Einsatz (nicht, was der Browser schickt).
  v_stake := greatest(0, coalesce(public.try_int(v_match -> 'fixedStake'), 20));
  new.stake := public.take_stars(new.user_id, v_stake, true, false);
  new.staked_at := now();

  -- Tipp-Serie: ein Kalendertag zählt einmal, der Folgetag verlängert, eine
  -- Lücke beginnt wieder bei 1. Meilensteine (3/5/10/20 Tage) gibt es je
  -- einmal. Gleiche Werte wie STREAK_MILESTONES in lib/poolScore.ts.
  select streak_count, last_tip_date, claimed_milestones into v_profile
  from public.profiles where id = new.user_id;
  v_today := public.pooltipp_day(now());
  v_last_day := public.pooltipp_day(public.try_timestamptz(v_profile.last_tip_date));
  v_count := coalesce(v_profile.streak_count, 0);
  v_claimed := coalesce(v_profile.claimed_milestones, '[]'::jsonb);
  if v_last_day is not null and v_last_day = v_today then
    v_count := greatest(v_count, 1);
  elsif v_last_day is not null and v_last_day = v_today - 1 then
    v_count := v_count + 1;
  else
    v_count := 1;
  end if;

  for v_milestone in
    select * from (values (3, 10), (5, 15), (10, 30), (20, 60)) as m(days, stars)
  loop
    if v_milestone.days = v_count and not v_claimed @> jsonb_build_array(v_milestone.days) then
      v_claimed := v_claimed || jsonb_build_array(v_milestone.days);
      v_bonus := v_milestone.stars;
      v_days := v_milestone.days;
    end if;
  end loop;

  update public.profiles
  set streak_count = v_count,
      last_tip_date = public.iso_now(),
      claimed_milestones = v_claimed,
      free_stars = free_stars + v_bonus,
      updated_at = now()
  where id = new.user_id;

  if v_bonus > 0 then
    perform public.add_private_activity(new.user_id, '🔥',
      v_days || ' Spieltage in Folge getippt – +' || v_bonus || ' Sterne Bonus!');
  end if;
  return new;
end;
$$;

-- 4c) Tipp-Bewertung mit 1X2 (dort gibt es kein "exakt").
create or replace function public.classify_tip_mode(p_home int, p_away int, p_actual_home int, p_actual_away int, p_one_x_two boolean)
returns text
language sql
immutable
as $$
  select case
    when not p_one_x_two and p_home = p_actual_home and p_away = p_actual_away then 'exakt'
    when sign(p_home - p_away) = sign(p_actual_home - p_actual_away) then 'tendenz'
    else 'falsch'
  end;
$$;

-- 4d) Auswertung aller Tipps eines beendeten Spiels. Gleiche Regeln wie
--     lib/poolScore.ts:
--       Ergebnis-Tipp: exakt = Einsatz x1,5 (10 Rangpunkte),
--                      Tendenz = Einsatz zurück (6), falsch = Hälfte zurück (0).
--       1X2-Tipp:      richtig = Einsatz x1,5 (6), falsch = Hälfte zurück (0).
--     Schon ausgewertete Tipps werden nur angefasst, wenn sich etwas ändert
--     (Endstand korrigiert, Regel geändert) – dann wird nur die Differenz
--     gebucht. Rückgabe: Zahl der geänderten Tipps.
create or replace function public.evaluate_match_tips(p_match_id text)
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_data jsonb;
  v_home int;
  v_away int;
  v_one_x_two boolean;
  v_sport text;
  v_icon text;
  v_tip record;
  v_tier text;
  v_rang int;
  v_credit int;
  v_net int;
  v_was_evaluated boolean;
  v_score_changed boolean;
  v_stars_change int;
  v_rang_change int;
  v_label text;
  v_narration text;
  v_count int := 0;
begin
  select data into v_data from public.matches where id = p_match_id for update;
  if v_data is null or v_data ->> 'status' is distinct from 'finished' then
    return 0;
  end if;
  v_home := public.try_int(v_data -> 'liveHomeScore');
  v_away := public.try_int(v_data -> 'liveAwayScore');
  if v_home is null or v_away is null then
    return 0;
  end if;
  v_one_x_two := coalesce(v_data ->> 'tipMode', 'score') = '1x2';
  v_sport := coalesce(nullif(v_data ->> 'sport', ''), 'Fußball');
  v_icon := case v_sport when 'NFL' then '🏈' when 'NBA' then '🏀' when 'NHL' then '🏒' else '⚽' end;

  for v_tip in
    select * from public.tips
    where match_id = p_match_id and refunded_at is null
    order by submitted_at, id
    for update
  loop
    v_tier := public.classify_tip_mode(v_tip.predicted_home_score, v_tip.predicted_away_score, v_home, v_away, v_one_x_two);
    v_rang := case v_tier when 'exakt' then 10 when 'tendenz' then 6 else 0 end;
    v_credit := case v_tier
      when 'exakt' then round(v_tip.stake * 1.5)
      when 'tendenz' then round(v_tip.stake * case when v_one_x_two then 1.5 else 1 end)
      else round(v_tip.stake * 0.5)
    end;
    v_net := v_credit - v_tip.stake;

    -- "evaluated" ohne Ergebnis = alter Browser hat den Tipp für sich
    -- reserviert, aber nie fertig ausgewertet -> wie offen behandeln.
    v_was_evaluated := v_tip.evaluated and v_tip.result_tier is not null;
    v_score_changed := v_was_evaluated and (
      v_tip.evaluated_home_score is distinct from v_home or v_tip.evaluated_away_score is distinct from v_away);

    if v_was_evaluated then
      if not v_score_changed
        and v_tip.result_tier = v_tier
        and coalesce(v_tip.rang_delta, 0) = v_rang
        and coalesce(v_tip.stars_delta, 0) = v_net then
        continue;
      end if;
      v_stars_change := v_net - coalesce(v_tip.stars_delta, 0);
      v_rang_change := v_rang - coalesce(v_tip.rang_delta, 0);
    else
      v_stars_change := v_credit;
      v_rang_change := v_rang;
    end if;

    v_label := '+' || v_rang;
    if v_score_changed then
      v_narration := '🔧 Ein Admin hat den Endstand korrigiert – dein Tipp gilt ' ||
        case v_tier
          when 'exakt' then 'jetzt exakt getroffen'
          when 'tendenz' then case when v_one_x_two then 'jetzt richtig' else 'jetzt Tendenz richtig' end
          else 'jetzt daneben'
        end || ' (' || v_label || ' Rangpunkte).';
    else
      v_narration := case v_tier
        when 'exakt' then '🎯 Exakt getroffen! ' || v_label || ' Rangpunkte.'
        when 'tendenz' then case when v_one_x_two
          then '👍 Richtig getippt – ' || v_label || ' Rangpunkte.'
          else '👍 Tendenz richtig erkannt – ' || v_label || ' Rangpunkte.' end
        else '😬 Daneben getippt (' || v_label || ' Rangpunkte).'
      end;
    end if;

    if v_stars_change <> 0 or v_rang_change <> 0 then
      update public.profiles
      set free_stars = greatest(0, free_stars + v_stars_change),
          rang_punkte = jsonb_set(
            coalesce(rang_punkte, '{}'::jsonb),
            array[v_sport],
            to_jsonb(greatest(0, coalesce(public.try_int(rang_punkte -> v_sport), 0) + v_rang_change))
          ),
          updated_at = now()
      where id = v_tip.user_id;
    end if;

    update public.tips
    set evaluated = true,
        result_tier = v_tier,
        rang_delta = v_rang,
        stars_delta = v_net,
        beat_percent = null,
        narration = v_narration,
        evaluated_home_score = v_home,
        evaluated_away_score = v_away,
        updated_at = now()
    where id = v_tip.id;

    -- Feed-Meldung nur bei echter Neuigkeit (erste Auswertung oder
    -- korrigierter Endstand), nicht bei stillen Regel-Korrekturen.
    if not v_was_evaluated or v_score_changed then
      perform public.add_private_activity(v_tip.user_id, v_icon, v_narration);
    end if;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;


-- ===== TEIL 2 =====

-- ----------------------------------------------------------------------------
-- 5) Duelle
-- ----------------------------------------------------------------------------

-- 5a) Duell-Auswertung ohne Admin-Prüfung (nur intern). Wie bisher, aber
--     1X2-Spiele kennen kein "exakt" mehr (ein 1X2-Tipp "1:0" schlug bei
--     Endstand 1:0 sonst einen anderen richtigen 1X2-Tipp).
create or replace function public.resolve_duels_internal(p_match_id text, p_actual_home int, p_actual_away int)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_duel record;
  v_one_x_two boolean;
  v_challenger_home int;
  v_challenger_away int;
  v_opponent_home int;
  v_opponent_away int;
  v_challenger_tier text;
  v_opponent_tier text;
  v_result text;
  v_credit_challenger int;
  v_credit_opponent int;
begin
  select coalesce(data ->> 'tipMode', 'score') = '1x2' into v_one_x_two
  from public.matches where id = p_match_id;
  v_one_x_two := coalesce(v_one_x_two, false);

  for v_duel in
    select * from public.duels
    where match_id = p_match_id and status in ('offen', 'pending')
    for update
  loop
    if v_duel.status = 'pending' then
      update public.duels set status = 'verfallen', resolved_at = now() where id = v_duel.id;
      update public.profiles set free_stars = free_stars + v_duel.stake, updated_at = now()
      where id = v_duel.challenger_id;
      continue;
    end if;

    v_challenger_home := null;
    v_challenger_away := null;
    v_opponent_home := null;
    v_opponent_away := null;

    select predicted_home_score, predicted_away_score into v_challenger_home, v_challenger_away
    from public.tips where user_id = v_duel.challenger_id and match_id = p_match_id and refunded_at is null
    order by submitted_at desc limit 1;

    select predicted_home_score, predicted_away_score into v_opponent_home, v_opponent_away
    from public.tips where user_id = v_duel.opponent_id and match_id = p_match_id and refunded_at is null
    order by submitted_at desc limit 1;

    v_challenger_tier := case when v_challenger_home is null then 'falsch'
      else public.classify_tip_mode(v_challenger_home, v_challenger_away, p_actual_home, p_actual_away, v_one_x_two) end;
    v_opponent_tier := case when v_opponent_home is null then 'falsch'
      else public.classify_tip_mode(v_opponent_home, v_opponent_away, p_actual_home, p_actual_away, v_one_x_two) end;

    v_credit_challenger := 0;
    v_credit_opponent := 0;

    if public.tier_order(v_challenger_tier) > public.tier_order(v_opponent_tier) then
      v_result := 'challenger';
      v_credit_challenger := v_duel.stake * 2;
    elsif public.tier_order(v_opponent_tier) > public.tier_order(v_challenger_tier) then
      v_result := 'opponent';
      v_credit_opponent := v_duel.stake * 2;
    else
      v_result := 'unentschieden';
      v_credit_challenger := v_duel.stake;
      v_credit_opponent := v_duel.stake;
    end if;

    update public.duels
    set status = 'ausgewertet',
        my_tier = v_challenger_tier,
        opponent_tier = v_opponent_tier,
        result = v_result,
        stars_credited = greatest(v_credit_challenger, v_credit_opponent),
        resolved_at = now()
    where id = v_duel.id;

    if v_credit_challenger > 0 then
      update public.profiles set free_stars = free_stars + v_credit_challenger, updated_at = now()
      where id = v_duel.challenger_id;
    end if;
    if v_credit_opponent > 0 then
      update public.profiles set free_stars = free_stars + v_credit_opponent, updated_at = now()
      where id = v_duel.opponent_id;
    end if;
  end loop;
end;
$$;

-- Der bisherige Aufruf aus dem Admin-Bereich bleibt erlaubt (nur Admin).
create or replace function public.resolve_duels_for_match(p_match_id text, p_actual_home int, p_actual_away int)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Nur der Admin kann Duelle auswerten';
  end if;
  perform public.resolve_duels_internal(p_match_id, p_actual_home, p_actual_away);
end;
$$;

-- 5b) Herausfordern: Einsatz des Herausforderers zieht die Datenbank ab
--     (vorher der Browser – ein Duell ließ sich so auch ohne Bezahlen anlegen).
create or replace function public.protect_duel_stake()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_match jsonb;
  v_deadline timestamptz;
  v_actual int;
begin
  select data into v_match from public.matches where id = new.match_id;
  if v_match is null or coalesce(v_match ->> 'status', '') in ('finished', 'cancelled') then
    raise exception 'Spiel nicht gefunden oder schon vorbei';
  end if;
  v_deadline := coalesce(public.try_timestamptz(v_match ->> 'tipDeadline'), public.try_timestamptz(v_match ->> 'kickoff'));
  if v_deadline is not null and now() >= v_deadline then
    raise exception 'Tippschluss für dieses Spiel ist schon vorbei';
  end if;
  if not exists (select 1 from public.profiles where id = new.opponent_id) then
    raise exception 'Gegner nicht gefunden';
  end if;

  new.created_at := now();
  new.accepted_at := null;
  v_actual := public.take_stars(new.challenger_id, new.stake, true, false);
  if v_actual < 1 then
    raise exception 'Nicht genug Sterne für diesen Einsatz';
  end if;
  new.stake := v_actual;
  return new;
end;
$$;

-- 5c) Annehmen: Einsatz des Gegners zieht die Datenbank ab.
create or replace function public.accept_duel(p_duel_id text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_duel record;
begin
  select * into v_duel from public.duels where id = p_duel_id for update;
  if not found then
    raise exception 'Duell nicht gefunden';
  end if;
  if v_duel.opponent_id <> auth.uid() then
    raise exception 'Nur der Herausgeforderte kann annehmen';
  end if;
  if v_duel.status <> 'pending' then
    raise exception 'Duell ist nicht mehr offen';
  end if;
  perform public.take_stars(v_duel.opponent_id, v_duel.stake, true, true);
  update public.duels set status = 'offen', accepted_at = now() where id = p_duel_id;
end;
$$;


-- ----------------------------------------------------------------------------
-- 6) Bonusfragen
-- ----------------------------------------------------------------------------

-- 6a) Antwort nur bis Tippschluss und nur, solange die richtige Antwort noch
--     nicht feststeht. Auswertungs-Felder setzt nur die Datenbank.
create or replace function public.protect_bonus_answer()
returns trigger
language plpgsql
as $$
declare
  v_match jsonb;
  v_deadline timestamptz;
begin
  if not public.is_client_write() then
    return new;
  end if;
  select data into v_match from public.matches where id = new.match_id;
  if v_match is null or jsonb_typeof(v_match -> 'bonusQuestion') is distinct from 'object' then
    return null;
  end if;
  if public.try_int(v_match -> 'bonusQuestion' -> 'correctOptionIndex') is not null then
    return null;
  end if;
  if new.option_index < 0
    or new.option_index >= coalesce(jsonb_array_length(v_match -> 'bonusQuestion' -> 'options'), 0) then
    return null;
  end if;
  v_deadline := coalesce(public.try_timestamptz(v_match ->> 'tipDeadline'), public.try_timestamptz(v_match ->> 'kickoff'));
  if v_deadline is not null and now() >= v_deadline then
    return null;
  end if;
  new.user_id := auth.uid();
  new.submitted_at := now();
  new.evaluated := false;
  new.correct := null;
  new.stars_delta := null;
  return new;
end;
$$;

-- 6b) Auswertung, sobald der Admin die richtige Antwort gesetzt hat. Ändert
--     er sie später, wird nur die Differenz gebucht.
create or replace function public.evaluate_match_bonus(p_match_id text)
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_question jsonb;
  v_correct_index int;
  v_bonus int;
  v_answer record;
  v_correct boolean;
  v_stars int;
  v_count int := 0;
begin
  select data -> 'bonusQuestion' into v_question from public.matches where id = p_match_id for update;
  if v_question is null or jsonb_typeof(v_question) <> 'object' then
    return 0;
  end if;
  v_correct_index := public.try_int(v_question -> 'correctOptionIndex');
  if v_correct_index is null then
    return 0;
  end if;
  v_bonus := greatest(0, coalesce(public.try_int(v_question -> 'bonusStars'), 0));

  for v_answer in
    select * from public.bonus_answers where match_id = p_match_id order by submitted_at, id for update
  loop
    v_correct := v_answer.option_index = v_correct_index;
    v_stars := case when v_correct then v_bonus else 0 end;
    if v_answer.evaluated and v_answer.correct is not distinct from v_correct
      and coalesce(v_answer.stars_delta, 0) = v_stars then
      continue;
    end if;

    update public.profiles
    set free_stars = greatest(0, free_stars + v_stars - case when v_answer.evaluated then coalesce(v_answer.stars_delta, 0) else 0 end),
        updated_at = now()
    where id = v_answer.user_id;

    update public.bonus_answers
    set evaluated = true, correct = v_correct, stars_delta = v_stars
    where id = v_answer.id;

    if not v_answer.evaluated then
      perform public.add_private_activity(v_answer.user_id,
        case when v_correct then '🎁' else '🤔' end,
        case when v_correct then '🎁 Bonusfrage richtig beantwortet – +' || v_stars || ' Sterne!'
             else 'Bonusfrage leider daneben – kein Sterne-Bonus diesmal.' end);
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;


-- ----------------------------------------------------------------------------
-- 7) Spiel beendet -> automatisch auswerten
-- ----------------------------------------------------------------------------

-- 7a) Beendet bleibt beendet (ein veralteter Admin-Tab kann ein Spiel nicht
--     wieder öffnen oder den Endstand leeren). Korrigieren geht weiter.
create or replace function public.keep_match_finished()
returns trigger
language plpgsql
as $$
begin
  if old.data ->> 'status' = 'finished' then
    if new.data ->> 'status' is distinct from 'finished' then
      new.data := jsonb_set(new.data, '{status}', '"finished"');
      new.data := jsonb_set(new.data, '{liveHomeScore}', coalesce(old.data -> 'liveHomeScore', 'null'::jsonb));
      new.data := jsonb_set(new.data, '{liveAwayScore}', coalesce(old.data -> 'liveAwayScore', 'null'::jsonb));
    elsif public.try_int(new.data -> 'liveHomeScore') is null or public.try_int(new.data -> 'liveAwayScore') is null then
      new.data := jsonb_set(new.data, '{liveHomeScore}', coalesce(old.data -> 'liveHomeScore', 'null'::jsonb));
      new.data := jsonb_set(new.data, '{liveAwayScore}', coalesce(old.data -> 'liveAwayScore', 'null'::jsonb));
    end if;
  end if;
  return new;
end;
$$;

-- 7b) Nach jeder Änderung eines Spiels: Tipps + Duelle auswerten, wenn der
--     Endstand (oder der Tipp-Modus) neu ist; Bonusfrage auswerten, wenn die
--     richtige Antwort neu ist. Der Admin-Bereich speichert immer alle
--     Spiele auf einmal – unveränderte Spiele lösen hier nichts aus.
create or replace function public.evaluate_after_match_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_old jsonb := case when tg_op = 'UPDATE' then old.data else '{}'::jsonb end;
  v_home int;
  v_away int;
begin
  if new.data ->> 'status' = 'finished'
    and (v_old ->> 'status' is distinct from 'finished'
         or v_old -> 'liveHomeScore' is distinct from new.data -> 'liveHomeScore'
         or v_old -> 'liveAwayScore' is distinct from new.data -> 'liveAwayScore'
         or v_old -> 'tipMode' is distinct from new.data -> 'tipMode') then
    v_home := public.try_int(new.data -> 'liveHomeScore');
    v_away := public.try_int(new.data -> 'liveAwayScore');
    if v_home is not null and v_away is not null then
      perform public.evaluate_match_tips(new.id);
      perform public.resolve_duels_internal(new.id, v_home, v_away);
    end if;
  end if;

  if v_old -> 'bonusQuestion' -> 'correctOptionIndex' is distinct from new.data -> 'bonusQuestion' -> 'correctOptionIndex'
    or v_old -> 'bonusQuestion' -> 'bonusStars' is distinct from new.data -> 'bonusQuestion' -> 'bonusStars' then
    perform public.evaluate_match_bonus(new.id);
  end if;
  return null;
end;
$$;

-- 7c) Auswertung von Hand nachholen (nur Admin), z. B. im SQL-Editor:
--     select public.evaluate_match('match-123');
create or replace function public.evaluate_match(p_match_id text)
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_data jsonb;
  v_count int;
begin
  -- Ohne Login (SQL-Editor) erlaubt, aus der App nur für den Admin.
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Nur der Admin kann Spiele auswerten';
  end if;
  v_count := public.evaluate_match_tips(p_match_id);
  select data into v_data from public.matches where id = p_match_id;
  if v_data ->> 'status' = 'finished'
    and public.try_int(v_data -> 'liveHomeScore') is not null
    and public.try_int(v_data -> 'liveAwayScore') is not null then
    perform public.resolve_duels_internal(p_match_id, public.try_int(v_data -> 'liveHomeScore'), public.try_int(v_data -> 'liveAwayScore'));
  end if;
  perform public.evaluate_match_bonus(p_match_id);
  return v_count;
end;
$$;


-- ----------------------------------------------------------------------------
-- 8) Saison-Pass, Tagesbonus, Shop – Funktionen für den Browser
-- ----------------------------------------------------------------------------

-- 8a) Erreichte Pass-Level der laufenden Saison eintragen und deren Sterne
--     einmalig gutschreiben (nur intern).
create or replace function public.claim_pass_rewards(p_user uuid)
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_season text;
  v_xp int;
  v_claimed jsonb;
  v_level record;
  v_key text;
  v_stars int := 0;
begin
  -- Saison der XP: steht seit dem Saisonwechsel (saisonwechsel.sql) im
  -- Profil; fehlt die Spalte noch, gilt die laufende Saison.
  select p.pass_xp, coalesce(p.claimed_milestones, '[]'::jsonb),
         coalesce(to_jsonb(p) ->> 'pass_season_id', public.current_pass_season_id())
    into v_xp, v_claimed, v_season
  from public.profiles p where p.id = p_user for update;
  if not found then
    return 0;
  end if;

  for v_level in
    select * from public.season_pass_levels
    where season_id = v_season and xp_required <= v_xp
    order by level
  loop
    v_key := v_season || ':' || v_level.level;
    if not v_claimed @> jsonb_build_array(v_key) then
      v_claimed := v_claimed || jsonb_build_array(v_key);
      v_stars := v_stars + v_level.stars_reward;
    end if;
  end loop;

  update public.profiles
  set claimed_milestones = v_claimed,
      free_stars = free_stars + v_stars,
      updated_at = now()
  where id = p_user and claimed_milestones is distinct from v_claimed;

  if v_stars > 0 then
    perform public.add_private_activity(p_user, '🏅', 'Saison-Pass: +' || v_stars || ' Sterne gutgeschrieben.');
  end if;
  return v_stars;
end;
$$;

-- 8b) Eigener Kontostand auf einen Blick (für die App nach jeder Aktion).
create or replace function public.my_wallet()
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Nicht eingeloggt';
  end if;
  select jsonb_build_object(
    'free_stars', p.free_stars,
    'rang_punkte', p.rang_punkte,
    'pass_xp', p.pass_xp,
    'streak_count', p.streak_count,
    'last_tip_date', p.last_tip_date,
    'claimed_milestones', p.claimed_milestones,
    'last_claimed_at', p.last_claimed_at,
    'rescue_bonus_used', p.rescue_bonus_used,
    'stake_budget_remaining', greatest(0, 100 - public.stake_used_today(p.id))
  ) into v_result
  from public.profiles p where p.id = auth.uid();
  return v_result;
end;
$$;

-- 8c) Täglicher Bonus: +8 Sterne, +100 Saison-XP, einmal pro Kalendertag.
--     Wer länger als 14 Tage weg war, verliert pro weiterer Woche 5
--     Rangpunkte je Sportart (nie unter 0). Gleiche Werte wie lib/poolScore.ts.
create or replace function public.claim_daily_bonus()
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_profile record;
  v_last timestamptz;
  v_days int;
  v_decay int := 0;
  v_rang jsonb;
begin
  if auth.uid() is null then
    raise exception 'Nicht eingeloggt';
  end if;
  select * into v_profile from public.profiles where id = auth.uid() for update;
  if not found then
    raise exception 'Profil nicht gefunden';
  end if;

  v_last := public.try_timestamptz(v_profile.last_claimed_at);
  if v_last is not null and public.pooltipp_day(v_last) = public.pooltipp_day(now()) then
    return public.my_wallet() || jsonb_build_object('claimed', false);
  end if;

  v_rang := coalesce(v_profile.rang_punkte, '{}'::jsonb);
  if v_last is not null then
    v_days := floor(extract(epoch from (now() - v_last)) / 86400);
    if v_days > 14 then
      v_decay := floor((v_days - 14) / 7) * 5;
    end if;
  end if;
  if v_decay > 0 and jsonb_typeof(v_rang) = 'object' then
    select coalesce(jsonb_object_agg(key, greatest(0, coalesce(public.try_int(value), 0) - v_decay)), '{}'::jsonb)
    into v_rang
    from jsonb_each(v_rang);
  end if;

  update public.profiles
  set free_stars = free_stars + 8,
      pass_xp = pass_xp + 100,
      last_claimed_at = public.iso_now(),
      rang_punkte = v_rang,
      updated_at = now()
  where id = auth.uid();

  perform public.claim_pass_rewards(auth.uid());
  return public.my_wallet() || jsonb_build_object('claimed', true);
end;
$$;

-- 8d) Prämien-Shop: Sterne ausgeben (nur abziehen, nie dazu).
create or replace function public.spend_stars(p_amount int)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht eingeloggt';
  end if;
  if p_amount is null or p_amount < 1 then
    raise exception 'Ungültiger Betrag';
  end if;
  perform public.take_stars(auth.uid(), p_amount, false, true);
  return public.my_wallet();
end;
$$;


-- ----------------------------------------------------------------------------
-- 9) Schutz einschalten und Rechte setzen
-- ----------------------------------------------------------------------------
-- Erst hier werden die Funktionen oben aktiv. Bis zu dieser Stelle hat das
-- Skript nur neue Funktionen angelegt, die noch niemand benutzt.
drop trigger if exists protect_profile_values on public.profiles;
create trigger protect_profile_values
  before insert or update on public.profiles
  for each row execute procedure public.protect_profile_values();

drop trigger if exists protect_tip_fields on public.tips;
create trigger protect_tip_fields
  before insert or update on public.tips
  for each row execute procedure public.protect_tip_fields();

drop trigger if exists protect_tip_stake on public.tips;
create trigger protect_tip_stake
  before insert on public.tips
  for each row execute procedure public.protect_tip_stake();

drop trigger if exists protect_duel_stake on public.duels;
create trigger protect_duel_stake
  before insert on public.duels
  for each row execute procedure public.protect_duel_stake();

drop trigger if exists protect_bonus_answer on public.bonus_answers;
create trigger protect_bonus_answer
  before insert on public.bonus_answers
  for each row execute procedure public.protect_bonus_answer();

drop trigger if exists keep_match_finished on public.matches;
create trigger keep_match_finished
  before update on public.matches
  for each row execute procedure public.keep_match_finished();

drop trigger if exists evaluate_after_match_change on public.matches;
create trigger evaluate_after_match_change
  after insert or update on public.matches
  for each row execute procedure public.evaluate_after_match_change();

-- Der alte Weg "beliebige Sterne-Änderung" ist zu.
do $$
begin
  if to_regprocedure('public.add_stars(integer)') is not null then
    revoke all on function public.add_stars(int) from public, anon, authenticated;
  end if;
end $$;

-- Interne Funktionen kann der Browser nicht aufrufen.
revoke all on function public.add_private_activity(uuid, text, text) from public, anon, authenticated;
revoke all on function public.stake_used_today(uuid) from public, anon, authenticated;
revoke all on function public.take_stars(uuid, int, boolean, boolean) from public, anon, authenticated;
revoke all on function public.evaluate_match_tips(text) from public, anon, authenticated;
revoke all on function public.evaluate_match_bonus(text) from public, anon, authenticated;
revoke all on function public.resolve_duels_internal(text, int, int) from public, anon, authenticated;
revoke all on function public.claim_pass_rewards(uuid) from public, anon, authenticated;
revoke all on function public.protect_tip_stake() from public, anon, authenticated;
revoke all on function public.protect_duel_stake() from public, anon, authenticated;
revoke all on function public.evaluate_after_match_change() from public, anon, authenticated;

revoke all on function public.my_wallet() from public, anon;
revoke all on function public.claim_daily_bonus() from public, anon;
revoke all on function public.spend_stars(int) from public, anon;
revoke all on function public.evaluate_match(text) from public, anon;
revoke all on function public.accept_duel(text) from public, anon;
revoke all on function public.resolve_duels_for_match(text, int, int) from public, anon;
grant execute on function public.my_wallet() to authenticated;
grant execute on function public.claim_daily_bonus() to authenticated;
grant execute on function public.spend_stars(int) to authenticated;
grant execute on function public.evaluate_match(text) to authenticated;
grant execute on function public.accept_duel(text) to authenticated;
grant execute on function public.resolve_duels_for_match(text, int, int) to authenticated;


-- ----------------------------------------------------------------------------
-- 10) Einmalige Übernahme des bisherigen Stands
-- ----------------------------------------------------------------------------

-- Tageslimit: bestehende Tipps zählen ab ihrer Abgabe.
update public.tips set staked_at = submitted_at where staked_at is null;

-- Rettungs-Bonus schon bekommen? Stand bisher in profile_extras.
do $$
begin
  if to_regclass('public.profile_extras') is not null then
    update public.profiles p
    set rescue_bonus_used = true
    from public.profile_extras e
    where e.id = p.id and not p.rescue_bonus_used
      and to_jsonb(e) -> 'stake_state' ->> 'rescueBonusUsed' = 'true';
  end if;
end $$;

-- Bonusfrage-Antworten aus profile_extras in die neue Tabelle übernehmen.
do $$
begin
  if to_regclass('public.profile_extras') is not null then
    insert into public.bonus_answers (id, user_id, match_id, option_index, submitted_at, evaluated, correct, stars_delta)
    select a ->> 'id',
           e.id,
           a ->> 'matchId',
           public.try_int(a -> 'optionIndex'),
           coalesce(public.try_timestamptz(a ->> 'submittedAt'), now()),
           coalesce(a ->> 'evaluated' = 'true', false),
           case when a ? 'correct' and jsonb_typeof(a -> 'correct') = 'boolean' then (a ->> 'correct')::boolean end,
           public.try_int(a -> 'starsDelta')
    from public.profile_extras e
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(to_jsonb(e) -> 'bonus_answers') = 'array' then to_jsonb(e) -> 'bonus_answers' else '[]'::jsonb end
    ) a
    where jsonb_typeof(a) = 'object'
      and a ->> 'id' is not null
      and a ->> 'matchId' is not null
      and public.try_int(a -> 'optionIndex') is not null
      and exists (select 1 from auth.users u where u.id = e.id)
    on conflict do nothing;
  end if;
end $$;

-- Alte Rangpunkte-Regel (mit erfundenen Gegnern) auf 10/6/0 umstellen, damit
-- die Nachwertung unten das nicht als "Korrektur" meldet.
update public.tips
set rang_delta = case result_tier when 'exakt' then 10 when 'tendenz' then 6 else 0 end,
    beat_percent = null
where evaluated and result_tier is not null and refunded_at is null
  and rang_delta is distinct from case result_tier when 'exakt' then 10 when 'tendenz' then 6 else 0 end;

-- Beendete Spiele nachwerten (offene Tipps, 1X2-Korrektur, Duelle, Bonusfragen).
do $$
declare
  v_match record;
begin
  for v_match in
    select id from public.matches where data ->> 'status' = 'finished' order by id
  loop
    perform public.evaluate_match(v_match.id);
  end loop;
  for v_match in
    select id from public.matches
    where public.try_int(data -> 'bonusQuestion' -> 'correctOptionIndex') is not null
      and data ->> 'status' is distinct from 'finished'
    order by id
  loop
    perform public.evaluate_match_bonus(v_match.id);
  end loop;
end $$;

-- Rangpunkte = Summe der Tipp-Punkte je Sportart.
update public.profiles p
set rang_punkte = jsonb_build_object(
      'Fußball', coalesce(s.fussball, 0),
      'NFL', coalesce(s.nfl, 0),
      'NBA', coalesce(s.nba, 0),
      'NHL', coalesce(s.nhl, 0)
    ),
    updated_at = now()
from (
  select pr.id as user_id,
         sum(t.rang_delta) filter (where m.data ->> 'sport' = 'Fußball') as fussball,
         sum(t.rang_delta) filter (where m.data ->> 'sport' = 'NFL') as nfl,
         sum(t.rang_delta) filter (where m.data ->> 'sport' = 'NBA') as nba,
         sum(t.rang_delta) filter (where m.data ->> 'sport' = 'NHL') as nhl
  from public.profiles pr
  left join public.tips t on t.user_id = pr.id and t.evaluated and t.refunded_at is null
  left join public.matches m on m.id = t.match_id
  group by pr.id
) s
where s.user_id = p.id
  and p.rang_punkte is distinct from jsonb_build_object(
      'Fußball', coalesce(s.fussball, 0),
      'NFL', coalesce(s.nfl, 0),
      'NBA', coalesce(s.nba, 0),
      'NHL', coalesce(s.nhl, 0));

-- Saison-Pass-Level aller Spieler eintragen (Sterne gibt es nur, wenn ein
-- Level mit Sternen neu erreicht ist).
do $$
declare
  v_user record;
begin
  for v_user in select id from public.profiles loop
    perform public.claim_pass_rewards(v_user.id);
  end loop;
end $$;


commit;

-- ----------------------------------------------------------------------------
-- Kontrolle (erscheint unten als Tabelle): Stand aller Spieler.
-- ----------------------------------------------------------------------------
select p.display_name as spieler,
       p.free_stars as sterne,
       p.rang_punkte as rangpunkte,
       p.pass_xp as saison_xp,
       (select count(*) from public.tips t where t.user_id = p.id and t.evaluated and t.refunded_at is null) as ausgewertete_tipps,
       (select count(*) from public.tips t join public.matches m on m.id = t.match_id
        where t.user_id = p.id and not t.evaluated and m.data ->> 'status' = 'finished') as offen_trotz_endstand
from public.profiles p
order by p.display_name;
