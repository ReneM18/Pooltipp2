-- ============================================================================
-- PoolTipp – Punkte-Modell "Jeder Tipp gegen alle"
-- ============================================================================
-- Rangpunkte pro Tipp = Grundpunkte (exakt 10, Tendenz 6, falsch 0, wie
-- bisher) + Duellpunkte. Nach dem Endstand tritt jeder Tipp gegen jeden
-- anderen Tipp desselben Spiels an:
--   - höhere Stufe (exakt > Tendenz > falsch) = Sieg, gleiche Stufe zählt 0
--   - Sieg bringt 2 x (1 - e), Niederlage kostet 2 x e. e = Chance, gegen
--     diesen Gegner zu gewinnen (aus der Tippstärke). Gegen Stärkere zu
--     gewinnen bringt also mehr, gegen Schwächere zu verlieren kostet mehr.
--   - Duellpunkte = runden(20 x Durchschnitt x Größenfaktor), Größenfaktor
--     = Wurzel(min(Gegner, 25) / 25), gedeckelt auf +20 / -10.
-- Tippstärke = Elo-Zahl pro Spieler und Sportart (Start 1000, K 64 in den
-- ersten 20 Tipps, danach 32). Alle Zahlen stehen in scoring_settings.
--
-- Bestehende Daten: Rangpunkte, Sterne und Tipps bleiben unverändert. Alte
-- Spiele bekommen keine Duellpunkte, nur die Tippstärke wird aus ihnen
-- nachgerechnet. Vorher werden die Rangpunkte gesichert; weicht danach auch
-- nur ein Wert ab, bricht das Skript ab und ändert gar nichts.
--
-- Voraussetzung: booster.sql wurde schon ausgeführt.
-- Ausführen: Supabase-Dashboard -> SQL Editor -> New query -> dieses
-- komplette Skript einfügen -> "Run". Darf mehrfach ausgeführt werden.
-- ============================================================================

begin;

do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'tips' and column_name = 'booster') then
    raise exception 'Bitte zuerst supabase/booster.sql ausführen, dann dieses Skript.';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 1) Einstellungen (eine Zeile). Ändern z. B. mit:
--    update public.scoring_settings set min_opponent_tips = 10;
-- ----------------------------------------------------------------------------
create table if not exists public.scoring_settings (
  id boolean primary key default true check (id),
  duel_factor numeric not null default 20,
  duel_cap_win int not null default 20,
  duel_cap_loss int not null default -10,
  full_field int not null default 25,
  -- Wie stark die Gegnerstärke zählt: kleiner = stärker (200 = etwa 20 %).
  weight_divisor numeric not null default 200,
  -- Ab so vielen ausgewerteten Tipps (und bestätigter Mail) zählt ein
  -- Spieler für die anderen als Gegner. Testphase 0, öffentlich 10.
  min_opponent_tips int not null default 0,
  migrated_at timestamptz
);
insert into public.scoring_settings (id) values (true) on conflict (id) do nothing;
alter table public.scoring_settings enable row level security;
drop policy if exists "Einstellungen lesen" on public.scoring_settings;
create policy "Einstellungen lesen" on public.scoring_settings for select to authenticated using (true);
revoke all on public.scoring_settings from anon, authenticated;
grant select on public.scoring_settings to authenticated;

-- ----------------------------------------------------------------------------
-- 2) Tippstärke pro Spieler und Sportart (nur der Server schreibt)
-- ----------------------------------------------------------------------------
create table if not exists public.tip_strength (
  user_id uuid not null references auth.users(id) on delete cascade,
  sport text not null,
  rating int not null default 1000,
  evaluated_tips int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, sport)
);
alter table public.tip_strength enable row level security;
drop policy if exists "Tippstärke lesen" on public.tip_strength;
create policy "Tippstärke lesen" on public.tip_strength for select to authenticated using (true);
revoke all on public.tip_strength from anon, authenticated;
grant select on public.tip_strength to authenticated;

-- ----------------------------------------------------------------------------
-- 3) Neue Spalten am Tipp (rang_delta bleibt = Grund + Duell)
-- ----------------------------------------------------------------------------
alter table public.tips add column if not exists base_points int;
alter table public.tips add column if not exists duel_points int;
alter table public.tips add column if not exists duels_won int;
alter table public.tips add column if not exists duels_drawn int;
alter table public.tips add column if not exists duels_lost int;
alter table public.tips add column if not exists strength_before int;
alter table public.tips add column if not exists strength_k int;
alter table public.tips add column if not exists strength_delta int;
alter table public.tips add column if not exists counts_as_opponent boolean;
-- Vor der Umstellung ausgewertet: bleibt ohne Duellpunkte, auch wenn der
-- Endstand später korrigiert wird.
alter table public.tips add column if not exists scored_without_duels boolean not null default false;

-- Der Browser darf keine der Auswertungs-Spalten setzen oder ändern.
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
    new.booster := false;
    new.base_points := null;
    new.duel_points := null;
    new.duels_won := null;
    new.duels_drawn := null;
    new.duels_lost := null;
    new.strength_before := null;
    new.strength_k := null;
    new.strength_delta := null;
    new.counts_as_opponent := null;
    new.scored_without_duels := false;
    return new;
  end if;

  new.id := old.id;
  new.user_id := old.user_id;
  new.match_id := old.match_id;
  new.stake := old.stake;
  new.staked_at := old.staked_at;
  new.booster := old.booster;
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
  new.base_points := old.base_points;
  new.duel_points := old.duel_points;
  new.duels_won := old.duels_won;
  new.duels_drawn := old.duels_drawn;
  new.duels_lost := old.duels_lost;
  new.strength_before := old.strength_before;
  new.strength_k := old.strength_k;
  new.strength_delta := old.strength_delta;
  new.counts_as_opponent := old.counts_as_opponent;
  new.scored_without_duels := old.scored_without_duels;

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

-- ----------------------------------------------------------------------------
-- 4) Auswertung eines Spiels mit Duellen
--    p_replay = true: nur die Tippstärke nachrechnen (Übernahme alter
--    Spiele), Rangpunkte, Sterne und Meldungen bleiben unberührt.
-- ----------------------------------------------------------------------------
create or replace function public.evaluate_match_tips_core(p_match_id text, p_replay boolean)
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  s public.scoring_settings%rowtype;
  v_data jsonb;
  v_home int;
  v_away int;
  v_one_x_two boolean;
  v_sport text;
  v_icon text;
  v_tip record;
  v_tier text;
  v_rating int;
  v_cnt int;
  v_counts boolean;
  v_ids text[] := '{}';
  v_stage int[] := '{}';
  v_r int[] := '{}';
  v_opp boolean[] := '{}';
  v_k int[] := '{}';
  v_tiers text[] := '{}';
  v_total int;
  i int;
  j int;
  v_n int;
  v_won int;
  v_drawn int;
  v_lost int;
  v_wsum numeric;
  v_ssum numeric;
  v_esum numeric;
  v_ew numeric;
  v_base int;
  v_duel int;
  v_rang int;
  v_sdelta int;
  v_credit int;
  v_net int;
  v_was_evaluated boolean;
  v_score_changed boolean;
  v_stars_change int;
  v_rang_change int;
  v_strength_change int;
  v_label text;
  v_head text;
  v_detail text;
  v_narration text;
  v_count int := 0;
begin
  select * into s from public.scoring_settings where id;
  if not found then
    s.duel_factor := 20; s.duel_cap_win := 20; s.duel_cap_loss := -10; s.full_field := 25;
    s.weight_divisor := 200; s.min_opponent_tips := 0;
  end if;

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

  -- Durchgang 1: Stufe jedes Tipps + Momentaufnahme der Tippstärke. Die
  -- Momentaufnahme wird beim ersten Auswerten gespeichert und bei einer
  -- Endstand-Korrektur wiederverwendet.
  for v_tip in
    select * from public.tips
    where match_id = p_match_id and refunded_at is null
    order by submitted_at, id
    for update
  loop
    v_tier := public.classify_tip_mode(v_tip.predicted_home_score, v_tip.predicted_away_score, v_home, v_away, v_one_x_two);
    if p_replay or v_tip.strength_before is null then
      select ts.rating, ts.evaluated_tips into v_rating, v_cnt
      from public.tip_strength ts where ts.user_id = v_tip.user_id and ts.sport = v_sport;
      v_rating := coalesce(v_rating, 1000);
      v_cnt := coalesce(v_cnt, 0);
      v_counts := p_replay or s.min_opponent_tips <= 0 or (
        v_cnt >= s.min_opponent_tips
        and exists (select 1 from auth.users u where u.id = v_tip.user_id and u.email_confirmed_at is not null));
      update public.tips
      set strength_before = v_rating,
          strength_k = case when v_cnt < 20 then 64 else 32 end,
          counts_as_opponent = v_counts
      where id = v_tip.id;
      v_tip.strength_before := v_rating;
      v_tip.strength_k := case when v_cnt < 20 then 64 else 32 end;
      v_tip.counts_as_opponent := v_counts;
    end if;
    v_ids := v_ids || v_tip.id;
    v_tiers := v_tiers || v_tier;
    v_stage := v_stage || case v_tier when 'exakt' then 2 when 'tendenz' then 1 else 0 end;
    v_r := v_r || v_tip.strength_before;
    v_k := v_k || v_tip.strength_k;
    v_opp := v_opp || coalesce(v_tip.counts_as_opponent, true);
  end loop;

  v_total := coalesce(array_length(v_ids, 1), 0);

  -- Durchgang 2: Duelle rechnen und buchen.
  for i in 1 .. v_total loop
    select * into v_tip from public.tips where id = v_ids[i];
    v_tier := v_tiers[i];
    v_n := 0; v_won := 0; v_drawn := 0; v_lost := 0;
    v_wsum := 0; v_ssum := 0; v_esum := 0;
    for j in 1 .. v_total loop
      continue when j = i or not v_opp[j];
      v_n := v_n + 1;
      -- Gewicht nach Gegnerstärke und Elo-Erwartung für die Tippstärke.
      v_ew := 1 / (1 + power(10::numeric, (v_r[j] - v_r[i])::numeric / s.weight_divisor));
      v_esum := v_esum + 1 / (1 + power(10::numeric, (v_r[j] - v_r[i])::numeric / 400));
      if v_stage[i] > v_stage[j] then
        v_won := v_won + 1;
        v_wsum := v_wsum + 2 * (1 - v_ew);
        v_ssum := v_ssum + 1;
      elsif v_stage[i] = v_stage[j] then
        v_drawn := v_drawn + 1;
        v_ssum := v_ssum + 0.5;
      else
        v_lost := v_lost + 1;
        v_wsum := v_wsum - 2 * v_ew;
      end if;
    end loop;

    v_base := case v_stage[i] when 2 then 10 when 1 then 6 else 0 end;
    if v_n > 0 then
      v_duel := greatest(s.duel_cap_loss, least(s.duel_cap_win,
        round(s.duel_factor * (v_wsum / v_n) * sqrt(least(v_n, s.full_field)::numeric / s.full_field))::int));
      v_sdelta := round(v_k[i] * (v_ssum / v_n - v_esum / v_n))::int;
    else
      v_duel := 0;
      v_sdelta := 0;
    end if;
    if p_replay or v_tip.scored_without_duels then
      v_duel := 0;
    end if;
    v_rang := v_base + v_duel;

    -- Tippstärke: beim ersten Mal ganz, bei einer Korrektur nur die Differenz.
    -- Beim Nachrechnen (p_replay) beginnt die Tippstärke immer neu.
    if p_replay then
      v_tip.strength_delta := null;
    end if;
    v_strength_change := v_sdelta - coalesce(v_tip.strength_delta, 0);
    if v_strength_change <> 0 or v_tip.strength_delta is null then
      insert into public.tip_strength (user_id, sport, rating, evaluated_tips, updated_at)
      values (v_tip.user_id, v_sport, greatest(100, 1000 + v_strength_change), 1, now())
      on conflict (user_id, sport) do update
        set rating = greatest(100, public.tip_strength.rating + v_strength_change),
            evaluated_tips = public.tip_strength.evaluated_tips + case when v_tip.strength_delta is null then 1 else 0 end,
            updated_at = now();
    end if;

    if p_replay then
      update public.tips
      set base_points = coalesce(base_points, v_base),
          duel_points = coalesce(duel_points, 0),
          duels_won = v_won,
          duels_drawn = v_drawn,
          duels_lost = v_lost,
          strength_delta = v_sdelta,
          beat_percent = case when v_n > 0 then round(100 * v_ssum / v_n) else null end
      where id = v_tip.id;
      v_count := v_count + 1;
      continue;
    end if;

    v_credit := case v_tier
      -- Booster-Tipp: exakt = dreifacher Einsatz. Ältere Tipps (vor den
      -- Boostern) behalten ihre Regel x1,5.
      when 'exakt' then round(v_tip.stake * case when v_tip.booster then 3 else 1.5 end)
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
        and coalesce(v_tip.stars_delta, 0) = v_net
        and v_tip.duel_points is not distinct from v_duel
        and v_tip.duels_won is not distinct from v_won
        and v_tip.duels_lost is not distinct from v_lost
        and v_strength_change = 0 then
        continue;
      end if;
      v_stars_change := v_net - coalesce(v_tip.stars_delta, 0);
      v_rang_change := v_rang - coalesce(v_tip.rang_delta, 0);
    else
      v_stars_change := v_credit;
      v_rang_change := v_rang;
    end if;

    v_label := case when v_rang >= 0 then '+' else '' end || v_rang;
    v_head := case v_tier
      when 'exakt' then 'Exakt getroffen'
      when 'tendenz' then case when v_one_x_two then 'Richtig getippt' else 'Tendenz richtig' end
      else 'Daneben getippt'
    end;
    if v_n > 0 and not v_tip.scored_without_duels then
      v_detail := v_head || '. Grundpunkte ' || case when v_base > 0 then '+' else '' end || v_base
        || ', Duelle ' || case when v_duel > 0 then '+' else '' end || v_duel
        || ' (' || v_won || ' von ' || v_n || ' geschlagen): ' || v_label || ' Rangpunkte.';
    else
      v_detail := v_head || ': ' || v_label || ' Rangpunkte.';
    end if;
    if v_score_changed then
      v_narration := '🔧 Ein Admin hat den Endstand korrigiert. ' || v_detail;
    else
      v_narration := case v_tier when 'exakt' then '🎯 ' when 'tendenz' then '👍 ' else '😬 ' end || v_detail;
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
        base_points = v_base,
        duel_points = v_duel,
        duels_won = v_won,
        duels_drawn = v_drawn,
        duels_lost = v_lost,
        strength_delta = v_sdelta,
        beat_percent = case when v_n > 0 then round(100 * v_ssum / v_n) else null end,
        narration = v_narration,
        evaluated_home_score = v_home,
        evaluated_away_score = v_away,
        updated_at = now()
    where id = v_tip.id;

    -- Feed-Meldung nur bei echter Neuigkeit (erste Auswertung oder
    -- korrigierter Endstand), nicht bei stillen Neuberechnungen.
    if not v_was_evaluated or v_score_changed then
      perform public.add_private_activity(v_tip.user_id, v_icon, v_narration);
    end if;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- Wird wie bisher vom Trigger auf matches und von evaluate_match aufgerufen.
create or replace function public.evaluate_match_tips(p_match_id text)
returns int
language plpgsql
security definer set search_path = public
as $$
begin
  return public.evaluate_match_tips_core(p_match_id, false);
end;
$$;

-- Tippstärke aus allen schon beendeten Spielen nachrechnen (in der
-- Reihenfolge des Anpfiffs). Ändert keine Rangpunkte und keine Sterne.
create or replace function public.replay_tip_strength()
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_match record;
  v_count int := 0;
begin
  delete from public.tip_strength;
  for v_match in
    select m.id from public.matches m
    where m.data ->> 'status' = 'finished'
      and exists (select 1 from public.tips t where t.match_id = m.id and t.evaluated and t.refunded_at is null)
    order by public.try_timestamptz(m.data ->> 'kickoff') nulls last, m.id
  loop
    perform public.evaluate_match_tips_core(v_match.id, true);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.evaluate_match_tips_core(text, boolean) from public, anon, authenticated;
revoke all on function public.evaluate_match_tips(text) from public, anon, authenticated;
revoke all on function public.replay_tip_strength() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5) Übernahme (nur beim ersten Ausführen)
-- ----------------------------------------------------------------------------
create table if not exists public.rang_punkte_sicherung (
  id uuid primary key,
  rang_punkte jsonb,
  gesichert_am timestamptz not null default now()
);
alter table public.rang_punkte_sicherung enable row level security;
revoke all on public.rang_punkte_sicherung from anon, authenticated;

do $$
declare
  v_matches int;
  v_diff int;
begin
  if (select migrated_at from public.scoring_settings where id) is not null then
    raise notice 'Übernahme wurde schon gemacht, nur die Funktionen wurden aktualisiert.';
    return;
  end if;

  -- a) Rangpunkte sichern
  delete from public.rang_punkte_sicherung;
  insert into public.rang_punkte_sicherung (id, rang_punkte)
  select id, rang_punkte from public.profiles;

  -- b) Alte Tipps: Grundpunkte = bisherige Punkte, keine Duellpunkte
  update public.tips
  set base_points = rang_delta,
      duel_points = 0,
      scored_without_duels = true
  where evaluated and refunded_at is null and result_tier is not null;

  -- c) Tippstärke aus den alten Spielen nachrechnen
  v_matches := public.replay_tip_strength();

  -- d) Prüfen: Rangpunkte unverändert, sonst alles zurück
  select count(*) into v_diff
  from public.profiles p join public.rang_punkte_sicherung b using (id)
  where p.rang_punkte is distinct from b.rang_punkte;
  if v_diff > 0 then
    raise exception 'Abbruch: Bei % Spielern hätten sich die Rangpunkte geändert. Es wurde nichts geändert.', v_diff;
  end if;

  update public.scoring_settings set migrated_at = now() where id;
  raise notice 'Übernahme fertig: % alte Spiele nachgerechnet, Rangpunkte unverändert.', v_matches;
end $$;

commit;

-- Bericht: Rangpunkte (unverändert) und neue Tippstärke pro Spieler
select coalesce(p.display_name, 'Spieler') as spieler,
       p.rang_punkte as rangpunkte,
       ts.sport as sportart,
       ts.rating as tippstaerke,
       ts.evaluated_tips as ausgewertete_tipps
from public.profiles p
left join public.tip_strength ts on ts.user_id = p.id
order by p.display_name, ts.sport;
