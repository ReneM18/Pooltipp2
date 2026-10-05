-- ============================================================================
-- PoolTipp – Neue Tipp-Sportart Handball
-- ============================================================================
-- Handball wird eine Tipp-Sportart wie Fußball, Football, Basketball und
-- Eishockey (eigene Rangliste, Rangpunkte, Herzensverein, Rang-Icon).
-- Die internen Namen der anderen Sportarten (NFL, NBA, NHL) bleiben in der
-- Datenbank unverändert, nur die App zeigt sie als Football, Basketball und
-- Eishockey an. Bestehende Tipps, Punkte und Rangpunkte bleiben erhalten.
--
-- Ausführen: Supabase-Dashboard -> SQL Editor -> "New query" -> dieses
-- komplette Skript einfügen -> "Run". Kann gefahrlos mehrfach laufen.
-- ============================================================================

-- 1) Herzensverein: Handball zulassen.
alter table public.club_fans drop constraint if exists club_fans_sport_check;
alter table public.club_fans add constraint club_fans_sport_check
  check (sport in ('Fußball', 'NFL', 'NBA', 'NHL', 'Handball'));

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
  cross join unnest(array['Fußball', 'NFL', 'NBA', 'NHL', 'Handball']) as sp(sport)
  left join public.club_fans cf on cf.user_id = me.id and cf.sport = sp.sport
  left join lateral (
    select s.tips, s.avg_points from public.club_fan_stats(sp.sport) s where s.user_id = me.id
  ) st on true
  where me.id is not null;
$$;

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
  if p_sport not in ('Fußball', 'NFL', 'NBA', 'NHL', 'Handball') then
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

-- 2) Rang-Icon: Handball-Icon zulassen.
alter table public.profiles add column if not exists rank_icon_id text;
alter table public.profiles drop constraint if exists profiles_rank_icon_id_check;
alter table public.profiles add constraint profiles_rank_icon_id_check check (
  rank_icon_id is null
  or rank_icon_id in ('sport-Fußball', 'sport-NFL', 'sport-NBA', 'sport-NHL', 'sport-Handball', 'elite', 'unsterblich')
);

-- 3) Neue Konten starten auch bei Handball mit 0 Rangpunkten.
alter table public.profiles alter column rang_punkte
  set default '{"Fußball":0,"NFL":0,"NBA":0,"NHL":0,"Handball":0}'::jsonb;

-- 4) Auswertung: Handball-Meldungen im Feed mit dem Handball-Symbol 🤾
--    (sonst unverändert aus supabase/rankingsystem.sql).
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

  -- Durchgang 2: Bonus gegen alle Mittipper (ein Rechenschritt in der
  -- Datenbank statt jeder gegen jeden in einer Schleife), dann buchen.
  for r in
    with x as (select * from unnest(v_ids, v_stages, v_rps) as u(id, stage, rp))
    select a.id, a.stage,
           count(b.id)::int as n,
           (count(b.id) filter (where b.stage < a.stage))::int as beaten,
           coalesce(sum(case
             when b.stage < a.stage then case when b.rp > a.rp then 2 else 1 end
             when b.stage > a.stage then case when b.rp < a.rp then -2 else -1 end
             else 0 end), 0)::int as s
    from x a left join x b on b.id <> a.id
    group by a.id, a.stage
    order by a.id
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

-- Kontrolle: muss "Handball" enthalten.
select pg_get_constraintdef(oid) as herzensverein_sportarten
from pg_constraint where conname = 'club_fans_sport_check';
