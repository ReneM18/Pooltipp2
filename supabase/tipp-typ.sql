-- PoolTipp – Dein Tipp-Typ (Rene, 13.10.2026)
-- Einmal im Supabase SQL Editor ausführen (beliebig oft wiederholbar).
-- Braucht vorher supabase/rivalen.sql (Einstellung "Wer darf deine Statistik
-- sehen?") – die ist schon gelaufen.
--
-- Zeigt im Profil und auf der Spielerseite, was für ein Tipper jemand ist
-- (z. B. "🎯 Exakt-Künstler", "🦁 Mutiger Außenseiter"). Gerechnet wird nur
-- hier in der Datenbank aus den schon ausgewerteten Tipps (ab Neustart der
-- Rangpunkte, wie bei "Deine Statistik"). Erst ab 15 ausgewerteten Tipps.
-- Andere sehen den Tipp-Typ nur, wenn man seine Statistik freigibt.
-- Es zählen nur Spiele nach Tippschluss, offene Tipps verrät das nie.
-- Nichts wird gespeichert oder verändert (keine Tipps, Punkte oder Coins).

create or replace function public.tipp_typ_internal(p_user uuid)
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_needed int := 15;
  s record;
  v_global numeric;
  v_rate numeric;
  v_traits jsonb := '[]'::jsonb;
  v_sport record;
  v_best_sport text;
  v_best_rate numeric;
  v_best_n int;
  v_rest_rate numeric;
begin
  -- Alle Kennzahlen in einem Durchgang (pro Spiel zählt der letzte Tipp).
  with mine as (
    select distinct on (t.match_id)
           t.match_id, t.predicted_home_score as ph, t.predicted_away_score as pa,
           t.result_tier as tier, t.submitted_at
    from public.tips t
    where t.user_id = p_user
      and t.evaluated and t.result_tier is not null
      and t.refunded_at is null
      and not coalesce(t.ranking_legacy, false)
    order by t.match_id, t.submitted_at desc, t.id desc
  ),
  m as (
    select mi.*,
           x.data ->> 'sport' as sport,
           coalesce(x.data ->> 'tipMode', 'score') as mode,
           x.data ->> 'homeTeamId' as home_id,
           x.data ->> 'awayTeamId' as away_id,
           coalesce(public.try_timestamptz(x.data ->> 'tipDeadline'), public.try_timestamptz(x.data ->> 'kickoff')) as deadline
    from mine mi
    join public.matches x on x.id = mi.match_id
  ),
  others as (
    select distinct on (t.user_id, t.match_id)
           t.match_id, sign(t.predicted_home_score - t.predicted_away_score) as tend
    from public.tips t
    where t.match_id in (select match_id from mine)
      and t.refunded_at is null
    order by t.user_id, t.match_id, t.submitted_at desc, t.id desc
  ),
  crowd as (
    select match_id, count(*) as total,
           count(*) filter (where tend = 1) as h,
           count(*) filter (where tend = 0) as d,
           count(*) filter (where tend = -1) as a
    from others
    group by match_id
  ),
  majority as (
    -- Nur Spiele mit mindestens 3 Tippern und einer eindeutigen Mehrheit.
    select match_id,
           case when h > d and h > a then 1 when a > h and a > d then -1 when d > h and d > a then 0 end as tend
    from crowd
    where total >= 3
  )
  select
    count(*)::int as n,
    count(*) filter (where m.tier in ('exakt', 'differenz', 'tendenz'))::int as richtig,
    count(*) filter (where m.mode <> '1x2')::int as n_score,
    count(*) filter (where m.mode <> '1x2' and m.tier = 'exakt')::int as exakt,
    count(*) filter (where mj.tend is not null)::int as crowd_n,
    count(*) filter (where mj.tend is not null and sign(m.ph - m.pa) <> mj.tend)::int as contra,
    count(*) filter (where m.deadline is not null)::int as dl_n,
    count(*) filter (where m.deadline is not null and m.submitted_at <= m.deadline and m.deadline - m.submitted_at <= interval '1 hour')::int as late,
    count(*) filter (where m.deadline is not null and m.deadline - m.submitted_at >= interval '24 hours')::int as early,
    count(*) filter (where m.sport = 'Fußball')::int as fb_n,
    count(*) filter (where m.sport = 'Fußball' and m.ph = m.pa)::int as fb_draw,
    count(*) filter (where m.sport = 'Fußball' and m.mode <> '1x2')::int as fb_score_n,
    coalesce(avg(m.ph + m.pa) filter (where m.sport = 'Fußball' and m.mode <> '1x2'), 0)::numeric as fb_goals,
    count(cf.team_id)::int as club_n,
    count(*) filter (where (cf.team_id = m.home_id and m.ph > m.pa) or (cf.team_id = m.away_id and m.pa > m.ph))::int as club_win
  into s
  from m
  left join majority mj on mj.match_id = m.match_id
  left join public.club_fans cf
         on cf.user_id = p_user and cf.sport = m.sport and cf.team_id is not null
        and cf.team_id in (m.home_id, m.away_id);

  if s.n < v_needed then
    return jsonb_build_object('enough', false, 'evaluated', s.n, 'needed', v_needed, 'traits', '[]'::jsonb);
  end if;

  -- Schnitt aller Spieler: wie oft ist ein Ergebnis-Tipp exakt?
  select coalesce(avg(case when t.result_tier = 'exakt' then 1.0 else 0.0 end), 0)
  into v_global
  from public.tips t
  join public.matches x on x.id = t.match_id
  where t.evaluated and t.result_tier is not null and t.refunded_at is null
    and not coalesce(t.ranking_legacy, false)
    and coalesce(x.data ->> 'tipMode', 'score') <> '1x2';

  -- Jede Eigenschaft bekommt eine "Stärke" (ab 1 = trifft zu). Die stärkste
  -- wird groß als Tipp-Typ gezeigt, die nächsten als Eigenschaften.

  -- 🎯 Exakt-Künstler
  if s.n_score >= 10 then
    v_rate := s.exakt::numeric / s.n_score;
    if v_rate >= greatest(0.12, v_global * 1.4) then
      v_traits := v_traits || jsonb_build_object('id', 'exakt', 'value', round(v_rate * 100),
        'strength', round(v_rate / greatest(0.12, v_global * 1.4), 3));
    end if;
  end if;

  -- 💎 Treffsicher
  v_rate := s.richtig::numeric / s.n;
  if v_rate >= 0.65 then
    v_traits := v_traits || jsonb_build_object('id', 'treffsicher', 'value', round(v_rate * 100),
      'strength', round(v_rate / 0.65, 3));
  end if;

  -- 🦁 Mutiger Außenseiter / 🐑 Mit dem Strom
  if s.crowd_n >= 8 then
    v_rate := s.contra::numeric / s.crowd_n;
    if v_rate >= 0.35 then
      v_traits := v_traits || jsonb_build_object('id', 'aussenseiter', 'value', round(v_rate * 100),
        'strength', round(v_rate / 0.35, 3));
    elsif v_rate <= 0.08 then
      v_traits := v_traits || jsonb_build_object('id', 'strom', 'value', round(v_rate * 100),
        'strength', round(1 + (0.08 - v_rate) * 5, 3));
    end if;
  end if;

  -- ❤️ Vereinsbrille: bei Spielen des Herzensvereins fast immer auf seinen Sieg
  if s.club_n >= 4 then
    v_rate := s.club_win::numeric / s.club_n;
    if v_rate >= 0.9 then
      v_traits := v_traits || jsonb_build_object('id', 'vereinsbrille', 'value', round(v_rate * 100),
        'strength', round(v_rate / 0.9 + least(s.club_n, 20) / 100.0, 3));
    end if;
  end if;

  -- ⏰ Last-Minute-Tipper / 📅 Früh-Planer
  if s.dl_n >= 10 then
    v_rate := s.late::numeric / s.dl_n;
    if v_rate >= 0.5 then
      v_traits := v_traits || jsonb_build_object('id', 'lastminute', 'value', round(v_rate * 100),
        'strength', round(v_rate / 0.5, 3));
    end if;
    v_rate := s.early::numeric / s.dl_n;
    if v_rate >= 0.5 then
      v_traits := v_traits || jsonb_build_object('id', 'fruehplaner', 'value', round(v_rate * 100),
        'strength', round(v_rate / 0.5, 3));
    end if;
  end if;

  -- 🤝 Unentschieden-Fan (Fußball)
  if s.fb_n >= 8 then
    v_rate := s.fb_draw::numeric / s.fb_n;
    if v_rate >= 0.33 then
      v_traits := v_traits || jsonb_build_object('id', 'remis', 'value', round(v_rate * 100),
        'strength', round(v_rate / 0.33, 3));
    end if;
  end if;

  -- 🎆 Torfestival / 🧱 Defensiv-Denker (Fußball)
  if s.fb_score_n >= 8 then
    if s.fb_goals >= 3.8 then
      v_traits := v_traits || jsonb_build_object('id', 'torfestival', 'value', round(s.fb_goals, 1),
        'strength', round(s.fb_goals / 3.8, 3));
    elsif s.fb_goals <= 1.8 then
      v_traits := v_traits || jsonb_build_object('id', 'defensiv', 'value', round(s.fb_goals, 1),
        'strength', round(1.8 / greatest(s.fb_goals, 0.9), 3));
    end if;
  end if;

  -- 🏒 Spezialist: in einer Sportart klar besser als in den anderen
  -- (mindestens 8 Tipps dort und 8 Tipps in den anderen zusammen).
  select sport, rate, cnt into v_best_sport, v_best_rate, v_best_n
  from (
    select x.data ->> 'sport' as sport,
           avg(case when t.result_tier in ('exakt', 'differenz', 'tendenz') then 1.0 else 0.0 end) as rate,
           count(*)::int as cnt
    from (
      select distinct on (t.match_id) t.match_id, t.result_tier
      from public.tips t
      where t.user_id = p_user and t.evaluated and t.result_tier is not null
        and t.refunded_at is null and not coalesce(t.ranking_legacy, false)
      order by t.match_id, t.submitted_at desc, t.id desc
    ) t
    join public.matches x on x.id = t.match_id
    group by x.data ->> 'sport'
    having count(*) >= 8
  ) z
  order by rate desc, cnt desc
  limit 1;

  if v_best_sport is not null and s.n - v_best_n >= 8 then
    v_rest_rate := (s.richtig - round(v_best_rate * v_best_n))::numeric / (s.n - v_best_n);
    if v_best_rate - v_rest_rate >= 0.15 then
      v_traits := v_traits || jsonb_build_object('id', 'spezialist', 'value', round(v_best_rate * 100),
        'sport', v_best_sport, 'strength', round(1 + (v_best_rate - v_rest_rate - 0.15) * 3, 3));
    end if;
  end if;

  -- Nach Stärke sortieren; ohne Auffälligkeit: ⚖️ Allrounder
  select coalesce(jsonb_agg(e order by (e ->> 'strength')::numeric desc), '[]'::jsonb)
  into v_traits
  from jsonb_array_elements(v_traits) e;

  if jsonb_array_length(v_traits) = 0 then
    v_traits := jsonb_build_array(jsonb_build_object('id', 'allrounder', 'value', round(s.richtig::numeric / s.n * 100), 'strength', 1));
  end if;

  return jsonb_build_object('enough', true, 'evaluated', s.n, 'needed', v_needed, 'traits', v_traits);
end;
$$;

-- Für die App: eigener Tipp-Typ immer, bei anderen nur mit Freigabe.
create or replace function public.tipp_typ(p_user uuid)
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht eingeloggt';
  end if;
  if not public.stats_visible(auth.uid(), p_user) then
    return jsonb_build_object('visible', false);
  end if;
  return public.tipp_typ_internal(p_user) || jsonb_build_object('visible', true);
end;
$$;

revoke all on function public.tipp_typ_internal(uuid) from public, anon, authenticated;
revoke all on function public.tipp_typ(uuid) from public, anon;
grant execute on function public.tipp_typ(uuid) to authenticated;
