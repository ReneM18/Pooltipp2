-- ============================================================================
-- PoolTipp – Rankingsystem: Feinschliff nach dem Probelauf
-- ============================================================================
-- 1) Toleranz-Joker: Liegst du nur 1 Tor daneben, kostet dich der Tipp nie
--    Punkte (feste Punkte 0 und auch kein Minus beim Bonus), so wie es im
--    Shop steht.
-- 2) Neue Spieler (weniger als 5 gewertete Tipps in einer Sportart) zählen
--    beim Bonus mit dem mittleren Punktestand der anderen Tipper, nicht als
--    Letzte.
-- 3) Fällt ein Minus wegen "nie unter 0" kleiner aus, steht im Text, wie
--    viel wirklich abgezogen wurde.
--
-- Bestehende Daten: Kein Tipp und keine Punkte werden geändert. Schon
-- ausgewertete Tipps bekommen nur ihren damaligen Vergleichswert gespeichert,
-- damit eine spätere Endstand-Korrektur genau gleich rechnet.
--
-- Voraussetzung: supabase/rankingsystem-tempo.sql wurde schon ausgeführt.
-- Ausführen: Supabase-Dashboard -> SQL Editor -> New query -> dieses
-- komplette Skript einfügen -> "Run". Darf mehrfach ausgeführt werden.
-- ============================================================================

begin;

do $$
begin
  if to_regprocedure('public.ranking_bonus_counts(text[], integer[], integer[])') is null then
    raise exception 'Bitte zuerst supabase/rankingsystem-tempo.sql ausführen, dann dieses Skript.';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 1) Vergleichswert für den Bonus am Tipp (nur der Server setzt ihn)
-- ----------------------------------------------------------------------------
alter table public.tips add column if not exists compare_points int;

-- Schon ausgewertete Tipps: verglichen wurde mit dem Punktestand beim ersten
-- Auswerten.
update public.tips set compare_points = rank_points_before
where compare_points is null and rank_points_before is not null and ranking_scored;

create or replace function public.protect_ranking_tip_columns()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      -- Upsert auf einen schon gespeicherten Tipp: der Update-Teil regelt das.
      if exists (select 1 from public.tips where id = new.id) then
        return new;
      end if;
      new.rank_points_before := null;
      new.compare_points := null;
      new.base_points := null;
      new.bonus_points := null;
      new.opponents := null;
      new.beaten := null;
      new.rang_booked := null;
      new.joker := null;
      new.ranking_scored := false;
      new.ranking_legacy := false;
    else
      new.rank_points_before := old.rank_points_before;
      new.compare_points := old.compare_points;
      new.base_points := old.base_points;
      new.bonus_points := old.bonus_points;
      new.opponents := old.opponents;
      new.beaten := old.beaten;
      new.rang_booked := old.rang_booked;
      new.joker := old.joker;
      new.ranking_scored := old.ranking_scored;
      new.ranking_legacy := old.ranking_legacy;
    end if;
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2) Auswertung (sonst unverändert aus supabase/rankingsystem-tempo.sql)
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
    v_rps := v_rps || v_rp;
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
                         where table_schema = 'public' and table_name = 'tips' and column_name = 'compare_points')
             and pg_get_functiondef('public.evaluate_match_tips(text)'::regprocedure) like '%v_tolerated%'
            then 'ok' else 'FEHLER: bitte Claude Bescheid geben' end as feinschliff;
