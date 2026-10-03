-- ============================================================================
-- PoolTipp – Booster-Tipps
-- ============================================================================
-- Neue Sterne-Regeln:
--   1) Normale Tipps sind gratis: kein Sterne-Einsatz, nur Rangpunkte 10/6/0.
--   2) Booster-Spiele (der Admin markiert bis zu 3 pro Tag): fester Einsatz
--      20 Sterne. Exakt = 60 zurück (x3), Tendenz = Einsatz zurück, falsch =
--      Hälfte zurück. 1X2 bleibt: richtig x1,5, falsch die Hälfte.
--   3) Das Tageslimit 100 gilt nur noch für Duelle (Tipps zählen nicht mehr).
--   4) Tagesbonus: +8 Sterne nur bis zu einem Kontostand von 500, darüber
--      gibt es nur noch die +100 XP.
--   5) Der einmalige Rettungsbonus (20 Sterne) bleibt, bis es Werbung gibt.
--
-- Bestehende Daten bleiben unverändert: kein Tipp, kein Kontostand und keine
-- Rangpunkte werden umgerechnet. Schon abgegebene Tipps mit Einsatz werden
-- nach der alten Regel (exakt x1,5) fertig ausgewertet.
--
-- Ausführen: Supabase-Dashboard -> SQL Editor -> New query -> dieses
-- komplette Skript einfügen -> "Run". Darf beliebig oft ausgeführt werden.
-- Läuft als ein Block: bricht etwas ab, ändert sich gar nichts.
-- ============================================================================

begin;

-- Merker am Tipp: mit Booster-Einsatz abgegeben (setzt nur die Datenbank).
alter table public.tips add column if not exists booster boolean not null default false;

-- Heute schon eingesetzte Sterne für das Tageslimit 100 – nur noch Duelle.
create or replace function public.stake_used_today(p_user uuid)
returns int
language sql
stable
security definer set search_path = public
as $$
  select (
    coalesce((select sum(stake) from public.duels
              where challenger_id = p_user and status <> 'abgesagt'
                and public.pooltipp_day(created_at) = public.pooltipp_day(now())), 0)
    + coalesce((select sum(stake) from public.duels
                where opponent_id = p_user and accepted_at is not null and status <> 'abgesagt'
                  and public.pooltipp_day(accepted_at) = public.pooltipp_day(now())), 0)
  )::int;
$$;

-- Der Browser darf den Booster-Merker nie setzen oder ändern.
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

-- Neuer Tipp: Einsatz nur bei Booster-Spielen, Tipp-Serie wie bisher.
create or replace function public.protect_tip_stake()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_match jsonb;
  v_deadline timestamptz;
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

  -- Booster-Spiel: fester Einsatz 20 Sterne, der volle Einsatz muss da sein.
  -- Alle anderen Spiele sind gratis (nur Rangpunkte). Was der Browser als
  -- Einsatz schickt, zählt nie.
  if coalesce(v_match ->> 'booster', 'false') = 'true' then
    if v_profile.free_stars < 20 then
      raise exception 'Für einen Booster-Tipp brauchst du 20 Sterne';
    end if;
    new.stake := public.take_stars(new.user_id, 20, false, true);
    new.booster := true;
  else
    new.stake := 0;
    new.booster := false;
  end if;
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

-- Auswertung: wie bisher, nur exakt beim Booster x3.
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

-- Tagesbonus: +8 Sterne bis Kontostand 500, immer +100 XP.
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
  v_added int;
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
    return public.my_wallet() || jsonb_build_object('claimed', false, 'stars_added', 0);
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

  -- Sterne nur bis zur Obergrenze 500, darüber gibt es nur noch die XP.
  v_added := greatest(0, least(8, 500 - v_profile.free_stars));

  update public.profiles
  set free_stars = free_stars + v_added,
      pass_xp = pass_xp + 100,
      last_claimed_at = public.iso_now(),
      rang_punkte = v_rang,
      updated_at = now()
  where id = auth.uid();

  perform public.claim_pass_rewards(auth.uid());
  return public.my_wallet() || jsonb_build_object('claimed', true, 'stars_added', v_added);
end;
$$;

revoke all on function public.stake_used_today(uuid) from public, anon, authenticated;
revoke all on function public.protect_tip_stake() from public, anon, authenticated;
revoke all on function public.evaluate_match_tips(text) from public, anon, authenticated;
revoke all on function public.claim_daily_bonus() from public, anon;
grant execute on function public.claim_daily_bonus() to authenticated;

commit;
