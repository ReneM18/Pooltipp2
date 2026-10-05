-- ============================================================================
-- PoolTipp – Rankingsystem (neue Rangpunkte)
-- ============================================================================
-- Rangpunkte pro Tipp = feste Punkte + Bonus.
--   Feste Punkte, Ergebnis-Tipp: exakt +10, richtige Tordifferenz +7,
--     richtige Tendenz +5, falsch -3. Ein Remis-Tipp ist exakt oder Tendenz
--     (eine Tordifferenz gibt es beim Remis nicht).
--   Feste Punkte, 1X2-Tipp: richtig +5, falsch -3.
--   Bonus: Jeder Tipp wird mit jedem anderen Tipp desselben Spiels verglichen
--     (Stufen exakt > Tordifferenz > Tendenz > falsch, gleiche Stufe zählt 0).
--     Besser als jemand mit MEHR Rangpunkten in der Sportart: +2, sonst +1.
--     Schlechter als jemand mit WENIGER Rangpunkten: -2, sonst -1.
--     Bonus = runden(Summe / Mittipper x 5), höchstens +10 / -10 und nie mehr
--     als es Mittipper gibt. Verglichen wird mit dem Punktestand, den jeder
--     beim ersten Auswerten des Spiels hatte (wird am Tipp gespeichert, eine
--     Endstand-Korrektur rechnet mit genau diesem Stand).
--   Rangpunkte fallen nie unter 0. Am Tipp steht, was wirklich gebucht wurde
--   (rang_booked), damit eine Korrektur genau das zurücknimmt.
-- Joker am Tipp (nur der Server setzt sie):
--   doppel   = feste Pluspunkte doppelt (20 / 14 / 10), Bonus und Minus gleich
--   schutz   = der Tipp kostet nie Punkte (Summe mindestens 0)
--   toleranz = 1 Tor daneben: 0 statt -3
-- Booster (Sterne, ändert keine Rangpunkte): exakt +40, Tordifferenz +10,
--   Tendenz ±0, falsch -10. 1X2-Booster bleibt +10 / -10.
-- Nicht-Tippen: Wer in der ganzen App 2 Wochen lang keinen Tipp abgibt,
--   verliert ab der 3. Woche 5 Rangpunkte pro Woche in jeder Sportart (nie
--   unter 0). Wochen ohne ein einziges Spiel zählen nicht. Ein Pause-Joker
--   schützt automatisch eine Woche. Ersetzt das alte Abklingen beim
--   Tagesbonus.
--
-- Bestehende Daten: Kein Tipp und keine Punkte werden hier geändert. Tipps,
-- die schon nach den alten Regeln ausgewertet sind, bleiben so. Das
-- Zurücksetzen der Rangpunkte ist ein eigenes Skript
-- (supabase/rankingsystem-neustart.sql).
--
-- Voraussetzung: booster.sql wurde schon ausgeführt.
-- Ausführen: Supabase-Dashboard -> SQL Editor -> New query -> dieses
-- komplette Skript einfügen -> "Run". Darf mehrfach ausgeführt werden.
-- Läuft als ein Block: bricht etwas ab, ändert sich gar nichts.
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
-- 1) Einstellungen (eine Zeile, nur der Server ändert sie)
-- ----------------------------------------------------------------------------
create table if not exists public.ranking_settings (
  id boolean primary key default true check (id),
  -- Ab hier zählen die Wochen für die Strafe fürs Nicht-Tippen.
  started_at timestamptz not null default now(),
  -- Gesetzt von rankingsystem-neustart.sql.
  points_reset_at timestamptz,
  free_weeks int not null default 2,
  penalty_per_week int not null default 5
);
insert into public.ranking_settings (id) values (true) on conflict (id) do nothing;
alter table public.ranking_settings enable row level security;
drop policy if exists "Rankingsystem-Einstellungen lesen" on public.ranking_settings;
create policy "Rankingsystem-Einstellungen lesen" on public.ranking_settings for select to anon, authenticated using (true);
revoke all on public.ranking_settings from anon, authenticated;
grant select on public.ranking_settings to anon, authenticated;

-- Schon bearbeitete Wochen der Strafe (damit keine Woche doppelt zählt).
create table if not exists public.ranking_weeks (
  week_start date primary key,
  had_matches boolean not null,
  penalized int not null default 0,
  protected int not null default 0,
  processed_at timestamptz not null default now()
);
alter table public.ranking_weeks enable row level security;
revoke all on public.ranking_weeks from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2) Neue Spalten
-- ----------------------------------------------------------------------------
alter table public.tips add column if not exists rank_points_before int;
alter table public.tips add column if not exists base_points int;
alter table public.tips add column if not exists bonus_points int;
alter table public.tips add column if not exists opponents int;
alter table public.tips add column if not exists beaten int;
alter table public.tips add column if not exists rang_booked int;
alter table public.tips add column if not exists joker text;
-- true = nach dem Rankingsystem ausgewertet
alter table public.tips add column if not exists ranking_scored boolean not null default false;
-- true = vor dem Neustart der Rangpunkte ausgewertet (rankingsystem-neustart.sql)
alter table public.tips add column if not exists ranking_legacy boolean not null default false;
alter table public.tips drop constraint if exists tips_joker_check;
alter table public.tips add constraint tips_joker_check check (joker is null or joker in ('doppel', 'schutz', 'toleranz'));

alter table public.profiles add column if not exists pause_jokers int not null default 0;
alter table public.profiles add column if not exists inactive_weeks int not null default 0;

-- Der Browser darf keine dieser Spalten setzen oder ändern (eigene Trigger,
-- die bestehenden Schutz-Trigger bleiben wie sie sind).
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

drop trigger if exists protect_ranking_tip_columns on public.tips;
create trigger protect_ranking_tip_columns
  before insert or update on public.tips
  for each row execute function public.protect_ranking_tip_columns();

create or replace function public.protect_ranking_profile_columns()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.pause_jokers := 0;
      new.inactive_weeks := 0;
    else
      new.pause_jokers := old.pause_jokers;
      new.inactive_weeks := old.inactive_weeks;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_ranking_profile_columns on public.profiles;
create trigger protect_ranking_profile_columns
  before insert or update on public.profiles
  for each row execute function public.protect_ranking_profile_columns();

-- ----------------------------------------------------------------------------
-- 3) Stufe eines Tipps: 3 exakt, 2 Tordifferenz, 1 Tendenz, 0 falsch.
--    1X2: 1 richtig, 0 falsch. (classify_tip_mode bleibt für die
--    Kopf-an-Kopf-Duelle unverändert.)
-- ----------------------------------------------------------------------------
create or replace function public.ranking_stage(p_home int, p_away int, p_actual_home int, p_actual_away int, p_one_x_two boolean)
returns int
language sql
immutable
as $$
  select case
    when p_one_x_two then case when sign(p_home - p_away) = sign(p_actual_home - p_actual_away) then 1 else 0 end
    when p_home = p_actual_home and p_away = p_actual_away then 3
    when sign(p_home - p_away) <> sign(p_actual_home - p_actual_away) then 0
    when p_actual_home <> p_actual_away and p_home - p_away = p_actual_home - p_actual_away then 2
    else 1
  end;
$$;

-- ----------------------------------------------------------------------------
-- 4) Auswertung eines beendeten Spiels (Trigger auf matches und
--    evaluate_match rufen sie wie bisher auf). Schon ausgewertete Tipps
--    werden nur angefasst, wenn sich etwas ändert (z. B. Endstand korrigiert),
--    dann wird nur die Differenz gebucht.
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
  v_icon := case v_sport when 'NFL' then '🏈' when 'NBA' then '🏀' when 'NHL' then '🏒' else '⚽' end;

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

-- ----------------------------------------------------------------------------
-- 5) Strafe fürs Nicht-Tippen. Bearbeitet jede abgeschlossene Woche
--    (Montag bis Sonntag, österreichische Zeit) seit dem Start genau einmal.
--    Läuft automatisch nach jeder Spiel-Auswertung und beim Tagesbonus.
-- ----------------------------------------------------------------------------
create or replace function public.apply_inactivity_penalties()
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  s public.ranking_settings%rowtype;
  v_week date;
  v_today date;
  v_from timestamptz;
  v_to timestamptz;
  v_had_matches boolean;
  v_user record;
  v_penalized int;
  v_protected int;
  v_weeks int := 0;
begin
  select * into s from public.ranking_settings where id;
  if not found then
    return 0;
  end if;
  -- Nur einer zur selben Zeit (zwei gleichzeitige Auswertungen).
  perform pg_advisory_xact_lock(hashtext('pooltipp_inactivity_penalty'));

  v_today := public.pooltipp_day(now());
  -- Erste volle Woche nach dem Start.
  v_week := date_trunc('week', public.pooltipp_day(s.started_at))::date + 7;

  while v_week + 7 <= v_today loop
    if not exists (select 1 from public.ranking_weeks where week_start = v_week) then
      v_from := v_week::timestamp at time zone 'Europe/Vienna';
      v_to := (v_week + 7)::timestamp at time zone 'Europe/Vienna';
      select exists (
        select 1 from public.matches m
        where coalesce(m.data ->> 'status', '') <> 'cancelled'
          and public.try_timestamptz(m.data ->> 'kickoff') >= v_from
          and public.try_timestamptz(m.data ->> 'kickoff') < v_to
      ) into v_had_matches;
      v_penalized := 0;
      v_protected := 0;

      if v_had_matches then
        update public.profiles p
        set inactive_weeks = case
          when exists (select 1 from public.tips t
                       where t.user_id = p.id and t.submitted_at >= v_from and t.submitted_at < v_to) then 0
          else p.inactive_weeks + 1 end;

        for v_user in
          select p.id, p.pause_jokers from public.profiles p
          where p.inactive_weeks > s.free_weeks
            and exists (select 1 from jsonb_each(case when jsonb_typeof(p.rang_punkte) = 'object' then p.rang_punkte else '{}'::jsonb end) e
                        where coalesce(public.try_int(e.value), 0) > 0)
          for update
        loop
          if v_user.pause_jokers > 0 then
            update public.profiles set pause_jokers = pause_jokers - 1, updated_at = now() where id = v_user.id;
            perform public.add_private_activity(v_user.id, '⏸️',
              'Pause-Joker eingesetzt: Diese Woche ohne Tipp kostet dich keine Rangpunkte.');
            v_protected := v_protected + 1;
          else
            update public.profiles
            set rang_punkte = (select jsonb_object_agg(e.key, greatest(0, coalesce(public.try_int(e.value), 0) - s.penalty_per_week))
                               from jsonb_each(rang_punkte) e),
                updated_at = now()
            where id = v_user.id;
            perform public.add_private_activity(v_user.id, '💤',
              'Du hast seit über ' || s.free_weeks || ' Wochen nicht getippt: -' || s.penalty_per_week
              || ' Rangpunkte in jeder Sportart. Ein Tipp genügt, und die Strafe ist weg.');
            v_penalized := v_penalized + 1;
          end if;
        end loop;
      end if;

      insert into public.ranking_weeks (week_start, had_matches, penalized, protected)
      values (v_week, v_had_matches, v_penalized, v_protected);
      v_weeks := v_weeks + 1;
    end if;
    v_week := v_week + 7;
  end loop;
  return v_weeks;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6) Nach jeder Änderung eines Spiels auswerten (wie bisher) und danach
--    offene Wochen der Strafe nachziehen.
-- ----------------------------------------------------------------------------
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
      perform public.apply_inactivity_penalties();
    end if;
  end if;

  if v_old -> 'bonusQuestion' -> 'correctOptionIndex' is distinct from new.data -> 'bonusQuestion' -> 'correctOptionIndex'
    or v_old -> 'bonusQuestion' -> 'bonusStars' is distinct from new.data -> 'bonusQuestion' -> 'bonusStars' then
    perform public.evaluate_match_bonus(new.id);
  end if;
  return null;
end;
$$;

-- ----------------------------------------------------------------------------
-- 7) Tagesbonus: +8 Sterne bis Kontostand 500, immer +100 XP. Das alte
--    Abklingen der Rangpunkte (nach Tagen ohne Bonus) entfällt, dafür gilt
--    die Strafe fürs Nicht-Tippen oben.
-- ----------------------------------------------------------------------------
create or replace function public.claim_daily_bonus()
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_profile record;
  v_last timestamptz;
  v_added int;
begin
  if auth.uid() is null then
    raise exception 'Nicht eingeloggt';
  end if;
  perform public.apply_inactivity_penalties();
  select * into v_profile from public.profiles where id = auth.uid() for update;
  if not found then
    raise exception 'Profil nicht gefunden';
  end if;

  v_last := public.try_timestamptz(v_profile.last_claimed_at);
  if v_last is not null and public.pooltipp_day(v_last) = public.pooltipp_day(now()) then
    return public.my_wallet() || jsonb_build_object('claimed', false, 'stars_added', 0);
  end if;

  -- Sterne nur bis zur Obergrenze 500, darüber gibt es nur noch die XP.
  v_added := greatest(0, least(8, 500 - v_profile.free_stars));

  update public.profiles
  set free_stars = free_stars + v_added,
      pass_xp = pass_xp + 100,
      last_claimed_at = public.iso_now(),
      updated_at = now()
  where id = auth.uid();

  perform public.claim_pass_rewards(auth.uid());
  return public.my_wallet() || jsonb_build_object('claimed', true, 'stars_added', v_added);
end;
$$;

-- ----------------------------------------------------------------------------
-- 8) Rechte
-- ----------------------------------------------------------------------------
revoke all on function public.evaluate_match_tips(text) from public, anon, authenticated;
revoke all on function public.apply_inactivity_penalties() from public, anon, authenticated;
revoke all on function public.evaluate_after_match_change() from public, anon, authenticated;
revoke all on function public.claim_daily_bonus() from public, anon;
grant execute on function public.claim_daily_bonus() to authenticated;

commit;

-- Kontrolle: Start des Rankingsystems
select started_at as rankingsystem_seit, points_reset_at as punkte_zurueckgesetzt_am from public.ranking_settings;
