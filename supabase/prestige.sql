-- ============================================================================
-- PoolTipp – Prestige und faire Football-Grenzen
-- ============================================================================
-- 1) Prestige: Wer in einer Sportart GOAT ist, kann freiwillig "Prestige
--    gehen". Die Rangpunkte dieser Sportart starten wieder bei 0 (Bronze),
--    dafür gibt es einen Prestige-Stern (bis 5, danach eine Krone).
--    Der Punktestand vorher wird in prestige_log gesichert.
-- 2) Bonus: Ein Prestige-Spieler zählt beim Bonus weiter als "oben"
--    (Punkte + je Prestige einmal die GOAT-Grenze der Sportart).
-- 3) Football hat eigene Rang-Grenzen (GOAT ab 650 statt 1.900), weil es
--    nur rund 285 Spiele im Jahr gibt. Die Grenzen stehen in der App
--    (lib/rankTiers.ts), hier nur die GOAT-Grenze für Prestige und Bonus.
-- 4) Community-Meldung: "Rene hat in Fußball den GOAT-Rang gegen Prestige 1
--    eingetauscht".
--
-- Bestehende Daten: Keine Rangpunkte, Tipps oder Coins werden geändert.
-- Alle Spieler starten mit Prestige 0, damit rechnet der Bonus genau wie
-- bisher.
--
-- Voraussetzung: supabase/rankingsystem-feinschliff.sql wurde schon
-- ausgeführt. Ausführen: Supabase-Dashboard -> SQL Editor -> New query ->
-- dieses komplette Skript einfügen -> "Run". Darf mehrfach ausgeführt werden.
-- ============================================================================

begin;

do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'tips' and column_name = 'compare_points') then
    raise exception 'Bitte zuerst supabase/rankingsystem-feinschliff.sql ausführen, dann dieses Skript.';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 1) Prestige pro Sportart am Profil (nur der Server ändert es)
-- ----------------------------------------------------------------------------
alter table public.profiles add column if not exists prestige jsonb not null default '{}'::jsonb;

create or replace function public.protect_prestige_column()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.prestige := '{}'::jsonb;
    else
      new.prestige := old.prestige;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_prestige_column on public.profiles;
create trigger protect_prestige_column
  before insert or update on public.profiles
  for each row execute function public.protect_prestige_column();

-- Sicherung: jeder Prestige-Schritt mit dem Punktestand davor.
create table if not exists public.prestige_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  sport text not null,
  points_before int not null,
  prestige_after int not null,
  created_at timestamptz not null default now()
);
create index if not exists prestige_log_user_idx on public.prestige_log(user_id);
alter table public.prestige_log enable row level security;
drop policy if exists "Eigene Prestige-Sicherung lesen" on public.prestige_log;
create policy "Eigene Prestige-Sicherung lesen" on public.prestige_log for select using (auth.uid() = user_id);
revoke all on public.prestige_log from anon, authenticated;
grant select on public.prestige_log to authenticated;

-- Rang-Icon: Prestige-Abzeichen zulassen.
alter table public.profiles drop constraint if exists profiles_rank_icon_id_check;
alter table public.profiles add constraint profiles_rank_icon_id_check check (
  rank_icon_id is null
  or rank_icon_id in ('sport-Fußball', 'sport-NFL', 'sport-NBA', 'sport-NHL', 'sport-Handball', 'elite', 'unsterblich',
                      'prestige-Fußball', 'prestige-NFL', 'prestige-NBA', 'prestige-NHL', 'prestige-Handball')
);

-- ----------------------------------------------------------------------------
-- 2) GOAT-Grenze je Sportart und Bonus-Stärke
-- ----------------------------------------------------------------------------
create or replace function public.goat_min_points(p_sport text)
returns int
language sql
immutable
as $$
  select case when p_sport = 'NFL' then 650 else 1900 end;
$$;

create or replace function public.prestige_strength(p_user uuid, p_sport text)
returns int
language sql
stable
security definer set search_path = public
as $$
  select coalesce((
    select greatest(0, coalesce(public.try_int(p.prestige -> p_sport), 0)) * public.goat_min_points(p_sport)
    from public.profiles p where p.id = p_user
  ), 0);
$$;

-- ----------------------------------------------------------------------------
-- 3) Prestige gehen (nur für sich selbst, nur als GOAT)
-- ----------------------------------------------------------------------------
create or replace function public.go_prestige(p_sport text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_points int;
  v_level int;
  v_name text;
  v_label text;
begin
  if v_uid is null then
    raise exception 'Bitte zuerst einloggen.';
  end if;
  if p_sport is null or p_sport not in ('Fußball', 'NFL', 'NBA', 'NHL', 'Handball') then
    raise exception 'Unbekannte Sportart.';
  end if;

  select coalesce(public.try_int(p.rang_punkte -> p_sport), 0),
         greatest(0, coalesce(public.try_int(p.prestige -> p_sport), 0)),
         p.display_name
  into v_points, v_level, v_name
  from public.profiles p where p.id = v_uid
  for update;
  if not found then
    raise exception 'Profil nicht gefunden.';
  end if;
  if v_points < public.goat_min_points(p_sport) then
    raise exception 'Prestige geht erst als GOAT (ab % Punkten).', public.goat_min_points(p_sport);
  end if;

  v_level := v_level + 1;
  insert into public.prestige_log (user_id, sport, points_before, prestige_after)
  values (v_uid, p_sport, v_points, v_level);

  update public.profiles
  set rang_punkte = jsonb_set(coalesce(rang_punkte, '{}'::jsonb), array[p_sport], to_jsonb(0)),
      prestige = jsonb_set(coalesce(prestige, '{}'::jsonb), array[p_sport], to_jsonb(v_level)),
      updated_at = now()
  where id = v_uid;

  v_label := case p_sport when 'NFL' then 'Football' when 'NBA' then 'Basketball' when 'NHL' then 'Eishockey' else p_sport end;
  insert into public.activity_feed (id, user_id, author_name, icon, text, created_at)
  values ('srv-' || gen_random_uuid()::text, v_uid, v_name, '⭐',
          coalesce(v_name, 'Spieler') || ' hat in ' || v_label || ' den GOAT-Rang gegen Prestige ' || v_level || ' eingetauscht.',
          now());

  return jsonb_build_object('sport', p_sport, 'prestige', v_level, 'points_before', v_points);
end;
$$;

revoke all on function public.go_prestige(text) from public, anon;
grant execute on function public.go_prestige(text) to authenticated;
revoke all on function public.prestige_strength(uuid, text) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4) Auswertung (sonst unverändert aus supabase/rankingsystem-feinschliff.sql)
-- ----------------------------------------------------------------------------
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
  r record;
  v_rp int;
  v_ids text[] := '{}';
  v_stages int[] := '{}';
  v_rps int[] := '{}';
  v_users uuid[] := '{}';
  v_cmps int[] := '{}';
  v_tolerated boolean;
  v_tier text;
  v_fixed int;
  v_bonus int;
  v_cap int;
  v_total int;
  v_joker_note text;
  v_shielded boolean;
  v_credit int;
  v_net int;
  v_was_evaluated boolean;
  v_legacy boolean;
  v_score_changed boolean;
  v_stars_change int;
  v_old_booked int;
  v_cur int;
  v_base_cur int;
  v_booked int;
  v_head text;
  v_detail text;
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
  v_icon := case v_sport when 'NFL' then '🏈' when 'NBA' then '🏀' when 'NHL' then '🏒' when 'Handball' then '🤾' else '⚽' end;

  -- Durchgang 1: Stufe jedes Tipps, Punktestand beim ersten Auswerten und
  -- der Vergleichswert für den Bonus (compare_points).
  for v_tip in
    select * from public.tips
    where match_id = p_match_id and refunded_at is null
    order by submitted_at, id
    for update
  loop
    if v_tip.rank_points_before is null then
      select coalesce(public.try_int(p.rang_punkte -> v_sport), 0) into v_rp
      from public.profiles p where p.id = v_tip.user_id;
      v_rp := coalesce(v_rp, 0);
      update public.tips set rank_points_before = v_rp where id = v_tip.id;
    else
      v_rp := v_tip.rank_points_before;
    end if;
    v_ids := v_ids || v_tip.id;
    v_stages := v_stages || public.ranking_stage(v_tip.predicted_home_score, v_tip.predicted_away_score, v_home, v_away, v_one_x_two);
    -- Prestige: Wer schon Prestige gegangen ist, zählt beim Bonus weiter
    -- als "oben" (Punkte + je Prestige einmal die GOAT-Grenze), damit er
    -- nach dem Neustart nicht mit Rückenwind gegen alle punktet.
    v_rps := v_rps || (v_rp + public.prestige_strength(v_tip.user_id, v_sport));
    v_users := v_users || v_tip.user_id;
    v_cmps := v_cmps || v_tip.compare_points;
  end loop;

  -- Neue Spieler (weniger als 5 gewertete Tipps in dieser Sportart) zählen
  -- beim Bonus mit dem mittleren Punktestand der anderen Tipper dieses
  -- Spiels, statt als Letzte. Wird beim ersten Auswerten am Tipp
  -- gespeichert, eine Endstand-Korrektur rechnet mit genau diesem Wert.
  if array_position(v_cmps, null) is not null then
    with x as (
      select * from unnest(v_ids, v_users, v_rps, v_cmps) with ordinality as u(id, uid, rp, cmp, ord)
    ),
    prior as (
      select t.user_id, count(*) as n
      from public.tips t
      join public.matches m on m.id = t.match_id
      where t.user_id in (select uid from x)
        and t.match_id <> p_match_id
        and t.ranking_scored and not t.ranking_legacy and t.refunded_at is null
        and coalesce(nullif(m.data ->> 'sport', ''), 'Fußball') = v_sport
      group by t.user_id
    ),
    y as (
      select x.*, coalesce(p.n, 0) >= 5 as established
      from x left join prior p on p.user_id = x.uid
    ),
    med as (
      select round(percentile_cont(0.5) within group (order by y.rp))::int as m from y where y.established
    )
    select coalesce(array_agg(coalesce(y.cmp, case when y.established or med.m is null then y.rp else med.m end) order by y.ord), '{}')
    into v_cmps
    from y cross join med;

    update public.tips t set compare_points = c.cmp
    from unnest(v_ids, v_cmps) as c(id, cmp)
    where t.id = c.id and t.compare_points is null;
  end if;

  -- Durchgang 2: Bonus gegen alle Mittipper (ranking_bonus_counts oben),
  -- dann buchen.
  for r in
    select * from public.ranking_bonus_counts(v_ids, v_stages, v_cmps)
  loop
    select * into v_tip from public.tips where id = r.id;

    -- "evaluated" ohne Ergebnis = alter Browser hat den Tipp für sich
    -- reserviert, aber nie fertig ausgewertet -> wie offen behandeln.
    v_was_evaluated := v_tip.evaluated and v_tip.result_tier is not null;
    v_legacy := v_was_evaluated and (not v_tip.ranking_scored or v_tip.ranking_legacy);
    v_score_changed := v_was_evaluated and (
      v_tip.evaluated_home_score is distinct from v_home or v_tip.evaluated_away_score is distinct from v_away);

    -- Nach den alten Regeln ausgewertet: Rangpunkte bleiben, wie sie sind.
    -- Nur bei einem korrigierten Endstand werden Ergebnis und Sterne
    -- (alte Booster-Regel) nachgezogen.
    if v_legacy then
      if not v_score_changed then
        continue;
      end if;
      v_tier := public.classify_tip_mode(v_tip.predicted_home_score, v_tip.predicted_away_score, v_home, v_away, v_one_x_two);
      v_credit := case v_tier
        when 'exakt' then round(v_tip.stake * case when v_tip.booster then 3 else 1.5 end)
        when 'tendenz' then round(v_tip.stake * case when v_one_x_two then 1.5 else 1 end)
        else round(v_tip.stake * 0.5)
      end;
      v_net := v_credit - v_tip.stake;
      v_stars_change := v_net - coalesce(v_tip.stars_delta, 0);
      if v_stars_change <> 0 then
        update public.profiles
        set free_stars = greatest(0, free_stars + v_stars_change), updated_at = now()
        where id = v_tip.user_id;
      end if;
      v_narration := '🔧 Ein Admin hat den Endstand korrigiert. Dein Tipp gilt jetzt als '
        || case v_tier when 'exakt' then 'exakt getroffen' when 'tendenz' then 'richtig' else 'daneben' end
        || '. Er stammt aus der Zeit vor dem neuen Punktesystem, deine Rangpunkte bleiben gleich.';
      update public.tips
      set result_tier = v_tier,
          stars_delta = v_net,
          narration = v_narration,
          evaluated_home_score = v_home,
          evaluated_away_score = v_away,
          updated_at = now()
      where id = v_tip.id;
      perform public.add_private_activity(v_tip.user_id, v_icon, v_narration);
      v_count := v_count + 1;
      continue;
    end if;

    v_tier := case
      when v_one_x_two then case r.stage when 1 then 'tendenz' else 'falsch' end
      else case r.stage when 3 then 'exakt' when 2 then 'differenz' when 1 then 'tendenz' else 'falsch' end
    end;

    -- Feste Punkte (+ Joker)
    v_fixed := case v_tier when 'exakt' then 10 when 'differenz' then 7 when 'tendenz' then 5 else -3 end;
    v_joker_note := '';
    v_tolerated := false;
    if v_tip.joker = 'doppel' and v_fixed > 0 then
      v_fixed := v_fixed * 2;
      v_joker_note := ' (Doppel-Joker)';
    elsif v_tip.joker = 'toleranz' and v_tier = 'falsch' and not v_one_x_two
      and abs(v_tip.predicted_home_score - v_home) + abs(v_tip.predicted_away_score - v_away) = 1 then
      v_fixed := 0;
      v_tolerated := true;
      v_joker_note := ' (Toleranz-Joker)';
    end if;

    -- Bonus
    if r.n > 0 then
      v_cap := least(10, r.n);
      v_bonus := greatest(-v_cap, least(v_cap, round(r.s::numeric / r.n * 5)::int));
    else
      v_bonus := 0;
    end if;
    v_total := v_fixed + v_bonus;
    -- Schutz-Joker: nie Minus. Toleranz-Joker bei 1 Tor daneben: auch der
    -- Bonus kostet nichts, der Tipp zählt mindestens 0.
    v_shielded := (v_tip.joker = 'schutz' or v_tolerated) and v_total < 0;
    if v_shielded then
      v_total := 0;
    end if;

    -- Sterne (nur bei Einsatz): Booster exakt x3, Tordifferenz x1,5,
    -- Tendenz Einsatz zurück, falsch die Hälfte. Ältere Tipps mit Einsatz
    -- (vor den Boostern) behalten exakt x1,5, Tordifferenz zählt dort wie
    -- Tendenz.
    v_credit := case v_tier
      when 'exakt' then round(v_tip.stake * case when v_tip.booster then 3 else 1.5 end)
      when 'differenz' then round(v_tip.stake * case when v_tip.booster then 1.5 else 1 end)
      when 'tendenz' then round(v_tip.stake * case when v_one_x_two then 1.5 else 1 end)
      else round(v_tip.stake * 0.5)
    end;
    v_net := v_credit - v_tip.stake;

    if v_was_evaluated then
      if not v_score_changed
        and v_tip.result_tier = v_tier
        and v_tip.rang_delta is not distinct from v_total
        and v_tip.base_points is not distinct from v_fixed
        and v_tip.bonus_points is not distinct from v_bonus
        and coalesce(v_tip.stars_delta, 0) = v_net then
        continue;
      end if;
      v_stars_change := v_net - coalesce(v_tip.stars_delta, 0);
      v_old_booked := coalesce(v_tip.rang_booked, v_tip.rang_delta, 0);
    else
      v_stars_change := v_credit;
      v_old_booked := 0;
    end if;

    -- Buchen: erst die alte Buchung zurücknehmen, dann neu buchen. Nie
    -- unter 0, gespeichert wird, was wirklich gebucht wurde.
    select coalesce(public.try_int(p.rang_punkte -> v_sport), 0) into v_cur
    from public.profiles p where p.id = v_tip.user_id for update;
    v_cur := coalesce(v_cur, 0);
    v_base_cur := greatest(0, v_cur - v_old_booked);
    v_booked := greatest(v_total, -v_base_cur);

    if v_stars_change <> 0 or v_base_cur + v_booked <> v_cur then
      update public.profiles
      set free_stars = greatest(0, free_stars + v_stars_change),
          rang_punkte = jsonb_set(coalesce(rang_punkte, '{}'::jsonb), array[v_sport], to_jsonb(v_base_cur + v_booked)),
          updated_at = now()
      where id = v_tip.user_id;
    end if;

    v_head := case v_tier
      when 'exakt' then 'Exakt getroffen'
      when 'differenz' then 'Tordifferenz richtig'
      when 'tendenz' then case when v_one_x_two then 'Richtig getippt' else 'Tendenz richtig' end
      else 'Daneben getippt'
    end;
    if r.n > 0 then
      v_detail := v_head || '. Treffer ' || case when v_fixed > 0 then '+' else '' end || v_fixed || v_joker_note
        || ', Bonus ' || case when v_bonus > 0 then '+' else '' end || v_bonus
        || ' (gegen ' || r.beaten || ' von ' || r.n || ' durchgesetzt)';
    else
      v_detail := v_head || v_joker_note;
    end if;
    if v_shielded then
      v_detail := v_detail || case when v_tolerated then ', Toleranz-Joker' else ', Schutz-Joker' end || ': kein Minus';
    end if;
    v_detail := v_detail || ': ' || case when v_total > 0 then '+' else '' end || v_total || ' Rangpunkte.';
    if v_booked <> v_total then
      v_detail := v_detail || ' Rangpunkte fallen nie unter 0, darum '
        || case when v_booked = 0 then 'wurde nichts abgezogen.' else 'nur ' || -v_booked || ' abgezogen.' end;
    end if;
    if v_score_changed then
      v_narration := '🔧 Ein Admin hat den Endstand korrigiert. ' || v_detail;
    else
      v_narration := case v_tier when 'exakt' then '🎯 ' when 'falsch' then '😬 ' else '👍 ' end || v_detail;
    end if;

    update public.tips
    set evaluated = true,
        result_tier = v_tier,
        rang_delta = v_total,
        rang_booked = v_booked,
        stars_delta = v_net,
        base_points = v_fixed,
        bonus_points = v_bonus,
        opponents = r.n,
        beaten = r.beaten,
        beat_percent = case when r.n > 0 then round(100.0 * r.beaten / r.n) else null end,
        ranking_scored = true,
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

revoke all on function public.evaluate_match_tips(text) from public, anon, authenticated;

commit;

-- Kontrolle: muss "ok" zeigen
select case when exists (select 1 from information_schema.columns
                         where table_schema = 'public' and table_name = 'profiles' and column_name = 'prestige')
             and pg_get_functiondef('public.evaluate_match_tips(text)'::regprocedure) like '%prestige_strength%'
             and to_regprocedure('public.go_prestige(text)') is not null
            then 'ok' else 'FEHLER: bitte Claude Bescheid geben' end as prestige;
