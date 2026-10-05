-- ============================================================================
-- PoolTipp – Rankingsystem: schnellere Auswertung bei vielen Tippern
-- ============================================================================
-- Rechnet den Bonus gegen die Mittipper genau wie bisher, aber ohne jeden
-- Tipp mit jedem anderen einzeln zu vergleichen. Bisher brauchte ein Spiel
-- mit 5.000 Tippern rund 10 Sekunden (zu lang: Supabase bricht Anfragen aus
-- der App nach 8 Sekunden ab, der Endstand ließe sich dann nicht speichern),
-- mit 20.000 Tippern fast 2 Minuten. Jetzt zählt die Datenbank pro Stufe,
-- wie viele Mittipper mehr oder weniger Rangpunkte haben.
--
-- Punkte, Texte und alles andere bleiben genau gleich. Es werden keine Tipps
-- und keine Punkte geändert, nur die Rechenfunktion ersetzt.
--
-- Voraussetzung: supabase/rankingsystem.sql und supabase/handball.sql wurden
-- schon ausgeführt.
-- Ausführen: Supabase-Dashboard -> SQL Editor -> New query -> dieses
-- komplette Skript einfügen -> "Run". Darf mehrfach ausgeführt werden.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1) Bonus-Zählung für alle Tipps eines Spiels.
--    Pro Tipp: n = Mittipper, beaten = Mittipper mit schlechterer Stufe,
--    s = Summe der Vergleiche (besser als jemand mit mehr Rangpunkten +2,
--    sonst +1; schlechter als jemand mit weniger Rangpunkten -2, sonst -1).
--    Statt jeder gegen jeden: pro Stufe (0 bis 3) wird gezählt, wie viele
--    Tipps weniger, gleich viele oder mehr Rangpunkte haben.
-- ----------------------------------------------------------------------------
create or replace function public.ranking_bonus_counts(p_ids text[], p_stages int[], p_rps int[])
returns table (id text, stage int, n int, beaten int, s int)
language sql
immutable
as $$
  with x as (
    select u.id, u.stage, u.rp from unnest(p_ids, p_stages, p_rps) as u(id, stage, rp)
  ),
  w as (
    select x.id, x.stage,
      -- pro Stufe: Tipps mit höchstens / weniger Rangpunkten / insgesamt
      array[count(*) filter (where x.stage = 0) over le, count(*) filter (where x.stage = 1) over le,
            count(*) filter (where x.stage = 2) over le, count(*) filter (where x.stage = 3) over le] as le,
      array[count(*) filter (where x.stage = 0) over lt, count(*) filter (where x.stage = 1) over lt,
            count(*) filter (where x.stage = 2) over lt, count(*) filter (where x.stage = 3) over lt] as lt,
      array[count(*) filter (where x.stage = 0) over al, count(*) filter (where x.stage = 1) over al,
            count(*) filter (where x.stage = 2) over al, count(*) filter (where x.stage = 3) over al] as tot
    from x
    window le as (order by x.rp range between unbounded preceding and current row),
           lt as (order by x.rp range between unbounded preceding and 1 preceding),
           al as ()
  )
  select w.id, w.stage,
    ((select sum(v) from unnest(w.tot) v) - 1)::int,
    coalesce((select sum(w.tot[k + 1]) from generate_series(0, 3) k where k < w.stage), 0)::int,
    -- schlechtere Stufe: alle +1, die mit mehr Rangpunkten noch einmal +1;
    -- bessere Stufe: alle -1, die mit weniger Rangpunkten noch einmal -1.
    coalesce((select sum(case when k < w.stage then w.tot[k + 1] + (w.tot[k + 1] - w.le[k + 1])
                              when k > w.stage then -(w.tot[k + 1] + w.lt[k + 1])
                              else 0 end)
              from generate_series(0, 3) k), 0)::int
  from w
  order by w.id;
$$;

-- ----------------------------------------------------------------------------
-- 2) Auswertung (sonst unverändert aus supabase/handball.sql)
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

  -- Durchgang 1: Stufe jedes Tipps und Punktestand beim ersten Auswerten.
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
  end loop;

  -- Durchgang 2: Bonus gegen alle Mittipper (ranking_bonus_counts oben),
  -- dann buchen.
  for r in
    select * from public.ranking_bonus_counts(v_ids, v_stages, v_rps)
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
    if v_tip.joker = 'doppel' and v_fixed > 0 then
      v_fixed := v_fixed * 2;
      v_joker_note := ' (Doppel-Joker)';
    elsif v_tip.joker = 'toleranz' and v_tier = 'falsch' and not v_one_x_two
      and abs(v_tip.predicted_home_score - v_home) + abs(v_tip.predicted_away_score - v_away) = 1 then
      v_fixed := 0;
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
    v_shielded := v_tip.joker = 'schutz' and v_total < 0;
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
      v_detail := v_detail || ', Schutz-Joker: kein Minus';
    end if;
    v_detail := v_detail || ': ' || case when v_total > 0 then '+' else '' end || v_total || ' Rangpunkte.';
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

revoke all on function public.ranking_bonus_counts(text[], int[], int[]) from public, anon, authenticated;
revoke all on function public.evaluate_match_tips(text) from public, anon, authenticated;

commit;

-- Kontrolle: muss "ok" zeigen (8 Tipps, Ergebnis wie bisher)
select case when string_agg(n || '/' || beaten || '/' || s, ' ' order by id) = '7/7/14 7/5/7 7/5/6 7/3/0 7/0/-9 7/0/-9 7/3/-3 7/0/-6'
            then 'ok' else 'FEHLER: bitte Claude Bescheid geben' end as schnellere_auswertung
from public.ranking_bonus_counts(array['1','2','3','4','5','6','7','8'], array[3,2,2,1,0,0,1,0], array[0,20,50,50,100,150,300,2]);
