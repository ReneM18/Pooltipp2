-- ============================================================================
-- PoolTipp – Anfänger-Schutz im Rankingsystem
-- ============================================================================
-- Problem: Rangpunkte fallen nie unter 0, ein Fehltipp kostet aber -3 plus
-- bis zu -10 Bonus. Wer neu ist und noch wenige Treffer hat, fällt nach
-- jedem Gewinn sofort wieder auf 0.
--
-- Regel (Rene, 15.10.2026): Die ersten 10 gewerteten Tipps eines Spielers
-- INSGESAMT (alle Sportarten zusammen) kosten nie Punkte. Alle bisher
-- gewerteten Tipps zählen mit, auch die von vor dem Anfänger-Schutz: Wer
-- schon 10 oder mehr gewertete Tipps hat (z. B. Rene, Doris), hat keinen
-- Schutz mehr. Ist ein geschützter Tipp unterm Strich (feste Punkte +
-- Bonus, nach Jokern) im Minus, zählt er 0. Gewinne zählen ganz normal.
-- Ab dem 11. gewerteten Tipp gelten die normalen Regeln.
-- (Die erste Fassung zählte je Sportart; Teil 2 korrigiert das.)
--
-- Ob ein Tipp zu den ersten 10 gehört, wird beim ersten Auswerten am Tipp
-- gespeichert (tips.beginner_slot). Eine Endstand-Korrektur rechnet mit
-- genau diesem Wert. tips.beginner_shielded = der Schutz hat wirklich ein
-- Minus verhindert (für die Anzeige auf der Tippkarte).
--
-- Teil 1: Spalten und Auswertung (sonst unverändert aus
--         supabase/prestige.sql).
-- Teil 2: Korrektur der ersten Fassung (je Sportart): Tipps mit
--         beginner_slot, die nicht zu den ersten 10 gewerteten Tipps des
--         Spielers insgesamt gehören, verlieren den Schutz. Hat der Schutz
--         dort ein Minus verhindert, wird es nachgebucht (nie unter 0).
--         Coins werden nicht angefasst. Wurde die erste Fassung nie
--         ausgeführt, ändert Teil 2 nichts.
-- Teil 3: Nicole bekommt den Schutz nachträglich: ihre schon gewerteten
--         Tipps werden neu durchgerechnet (erste 10 insgesamt geschützt).
--         Coins werden nicht angefasst. Teil 3 läuft in einem eigenen
--         Block: Findet er Nicole nicht eindeutig, bricht nur Teil 3 ab,
--         Teil 1 und 2 bleiben gespeichert.
--
-- Bestehende Daten anderer Spieler: Außer der Korrektur in Teil 2 werden
-- keine Rangpunkte, Tipps oder Coins geändert. Tipps, die schon vor diesem
-- Skript gewertet waren, sind nicht geschützt (außer bei Nicole, Teil 3),
-- zählen aber bei den ersten 10 mit.
--
-- Voraussetzung: supabase/prestige.sql wurde schon ausgeführt.
-- Ausführen: Supabase-Dashboard -> SQL Editor -> New query -> dieses
-- komplette Skript einfügen -> "Run". Darf mehrfach ausgeführt werden.
-- ============================================================================

-- ============================================================================
-- Teil 1: Anfänger-Schutz in der Auswertung
-- ============================================================================
begin;

do $$
begin
  if to_regprocedure('public.prestige_strength(uuid, text)') is null then
    raise exception 'Bitte zuerst supabase/prestige.sql ausführen, dann dieses Skript.';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 1) Spalten am Tipp (nur der Server setzt sie)
-- ----------------------------------------------------------------------------
-- beginner_slot: Tipp gehört zu den ersten 10 gewerteten Tipps insgesamt.
-- beginner_shielded: der Anfänger-Schutz hat ein Minus auf 0 gesetzt.
alter table public.tips add column if not exists beginner_slot boolean;
alter table public.tips add column if not exists beginner_shielded boolean not null default false;

create or replace function public.protect_beginner_tip_columns()
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
      new.beginner_slot := null;
      new.beginner_shielded := false;
    else
      new.beginner_slot := old.beginner_slot;
      new.beginner_shielded := old.beginner_shielded;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_beginner_tip_columns on public.tips;
create trigger protect_beginner_tip_columns
  before insert or update on public.tips
  for each row execute function public.protect_beginner_tip_columns();

-- ----------------------------------------------------------------------------
-- 2) Auswertung (sonst unverändert aus supabase/prestige.sql)
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
  v_slot boolean;
  v_beginner boolean;
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

    -- Anfänger-Schutz: Die ersten 10 gewerteten Tipps eines Spielers
    -- insgesamt (alle Sportarten zusammen) kosten nie Punkte (Gewinne
    -- zählen normal; Rene, 15.10.2026). Ob ein Tipp dazu gehört, wird beim
    -- ersten Auswerten am Tipp gespeichert, damit eine Endstand-Korrektur
    -- dasselbe ergibt. Tipps, die schon vor dem Anfänger-Schutz gewertet
    -- waren, sind nicht geschützt, zählen aber mit.
    if v_tip.beginner_slot is not null then
      v_slot := v_tip.beginner_slot;
    elsif v_was_evaluated then
      v_slot := false;
    else
      select count(*) < 10 into v_slot
      from public.tips t
      where t.user_id = v_tip.user_id
        and t.id <> v_tip.id
        and t.evaluated and t.result_tier is not null and t.refunded_at is null;
    end if;
    v_beginner := coalesce(v_slot, false) and not coalesce(v_shielded, false) and v_total < 0;
    if v_beginner then
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
    if v_beginner then
      v_detail := v_detail || ', Anfänger-Schutz (deine ersten 10 Tipps): kein Minus';
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
        beginner_slot = v_slot,
        beginner_shielded = v_beginner,
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

-- ============================================================================
-- Teil 2: Korrektur der ersten Fassung (Schutz je Sportart)
-- ============================================================================
-- Reihenfolge wie bei der Auswertung: Anpfiff, dann Spiel-ID. Zu den
-- ersten 10 zählen alle gewerteten, nicht erstatteten Tipps des Spielers
-- (auch alte). Tipps mit beginner_slot außerhalb davon:
--   beginner_slot = false; hat der Schutz ein Minus verhindert
--   (beginner_shielded), wird es jetzt nachgebucht: rang_delta = feste
--   Punkte + Bonus, rang_booked = was wirklich abgezogen wurde (Rangpunkte
--   der Sportart nie unter 0), beginner_shielded = false.
-- Coins bleiben. Ein zweiter Lauf ändert nichts mehr.
begin;

do $$
declare
  t record;
  v_raw int;
  v_cur int;
  v_booked int;
  v_note text;
begin
  for t in
    with ranked as (
      select x.id, x.user_id, x.beginner_slot,
             coalesce(nullif(m.data ->> 'sport', ''), 'Fußball') as sport,
             row_number() over (
               partition by x.user_id
               order by public.try_timestamptz(m.data ->> 'kickoff') nulls last, x.match_id, x.id) as nr
      from public.tips x
      join public.matches m on m.id = x.match_id
      where x.evaluated and x.result_tier is not null and x.refunded_at is null
    )
    select r.sport, x.*
    from ranked r
    join public.tips x on x.id = r.id
    where r.beginner_slot and r.nr > 10
    order by r.user_id, r.nr
  loop
    if not t.beginner_shielded then
      update public.tips set beginner_slot = false, updated_at = now() where id = t.id;
      continue;
    end if;

    -- Verhindertes Minus nachbuchen (der Schutz griff nur, wenn kein Joker
    -- schon geschützt hat, darum sind feste Punkte + Bonus der echte Wert).
    v_raw := coalesce(t.base_points, 0) + coalesce(t.bonus_points, 0);
    select coalesce(public.try_int(p.rang_punkte -> t.sport), 0) into v_cur
    from public.profiles p where p.id = t.user_id for update;
    v_cur := coalesce(v_cur, 0);
    -- Bisher gebucht: 0 (geschützt). Jetzt v_raw, aber nie unter 0.
    v_booked := greatest(v_raw, -v_cur);

    update public.profiles
    set rang_punkte = jsonb_set(coalesce(rang_punkte, '{}'::jsonb), array[t.sport], to_jsonb(v_cur + v_booked)),
        updated_at = now()
    where id = t.user_id;

    v_note := 'Korrektur: Der Anfänger-Schutz gilt nur für deine ersten 10 Tipps insgesamt, dieser Tipp zählt jetzt '
      || v_raw || ' Rangpunkte'
      || case when v_booked <> v_raw then ' (Rangpunkte fallen nie unter 0, abgezogen: ' || -v_booked || ')' else '' end
      || '.';
    update public.tips
    set beginner_slot = false,
        beginner_shielded = false,
        rang_delta = v_raw,
        rang_booked = v_booked,
        narration = coalesce(narration || ' ', '') || v_note,
        updated_at = now()
    where id = t.id;
  end loop;
end $$;

commit;

-- ============================================================================
-- Teil 3: Nicole nachträglich
-- ============================================================================
-- Ihre gewerteten Tipps werden in Auswertungsreihenfolge (Anpfiff, dann
-- Spiel-ID) über alle Sportarten neu durchgerechnet: Bei den ersten 10
-- insgesamt zählt ein Minus als 0, danach normal. Rangpunkte fallen wie
-- bisher je Sportart nie unter 0. Gesetzt werden rang_delta, rang_booked,
-- beginner_slot und beginner_shielded der Tipps und profiles.rang_punkte je
-- Sportart. Coins bleiben, wie sie sind. Ein zweiter Lauf ergibt dasselbe.
begin;

do $$
declare
  v_user uuid;
  v_hits int;
  v_names text;
  v_sport text;
  v_cur int;
  v_sum int;
  v_bal jsonb := '{}'::jsonb;
  v_balance int;
  v_raw int;
  v_total int;
  v_booked int;
  v_beginner boolean;
  t record;
begin
  select count(*), string_agg(p.display_name || ' (' || p.id || ')', ', ' order by p.display_name)
  into v_hits, v_names
  from public.profiles p
  where p.display_name ilike 'nicole%';
  if v_hits = 0 then
    raise exception 'Kein Profil gefunden, dessen Name mit "Nicole" beginnt. Teil 3 wurde nicht ausgeführt (Teil 1 und 2 sind gespeichert).';
  elsif v_hits > 1 then
    raise exception 'Mehrere Profile beginnen mit "Nicole": %. Teil 3 wurde nicht ausgeführt (Teil 1 und 2 sind gespeichert). Bitte Claude Bescheid geben, welches gemeint ist.', v_names;
  end if;
  select p.id into v_user from public.profiles p where p.display_name ilike 'nicole%';

  -- Profil sperren, damit keine Auswertung dazwischen bucht.
  perform 1 from public.profiles p where p.id = v_user for update;

  -- Ausgangsstand je Sportart ohne ihre Tipps (z. B. Strafe fürs
  -- Nicht-Tippen): aktueller Stand minus alles, was ihre Tipps gebucht haben.
  for v_sport in
    select distinct coalesce(nullif(m.data ->> 'sport', ''), 'Fußball')
    from public.tips x
    join public.matches m on m.id = x.match_id
    where x.user_id = v_user and x.evaluated and x.result_tier is not null and x.refunded_at is null
  loop
    select coalesce(public.try_int(p.rang_punkte -> v_sport), 0) into v_cur
    from public.profiles p where p.id = v_user;
    select coalesce(sum(coalesce(x.rang_booked, x.rang_delta, 0)), 0) into v_sum
    from public.tips x
    join public.matches m on m.id = x.match_id
    where x.user_id = v_user and x.evaluated and x.result_tier is not null and x.refunded_at is null
      and x.ranking_scored and not x.ranking_legacy
      and coalesce(nullif(m.data ->> 'sport', ''), 'Fußball') = v_sport;
    v_bal := jsonb_set(v_bal, array[v_sport], to_jsonb(greatest(0, coalesce(v_cur, 0) - v_sum)));
  end loop;

  -- Alle ihre Tipps zusammen, die ersten 10 insgesamt sind geschützt.
  for t in
    select x.*, coalesce(nullif(m.data ->> 'sport', ''), 'Fußball') as sport,
           row_number() over (
             order by public.try_timestamptz(m.data ->> 'kickoff') nulls last, x.match_id, x.id) as nr
    from public.tips x
    join public.matches m on m.id = x.match_id
    where x.user_id = v_user and x.evaluated and x.result_tier is not null and x.refunded_at is null
    order by nr
  loop
    -- Nach den alten Regeln gewertet: zählt mit, Punkte bleiben.
    if not t.ranking_scored or t.ranking_legacy then
      continue;
    end if;
    -- Gerechnete Punkte ohne Anfänger-Schutz (bei einem zweiten Lauf aus
    -- festen Punkten + Bonus, denn rang_delta ist dann schon 0).
    v_raw := case when t.beginner_shielded then coalesce(t.base_points, 0) + coalesce(t.bonus_points, 0)
                  else coalesce(t.rang_delta, 0) end;
    v_beginner := t.nr <= 10 and v_raw < 0;
    v_total := case when v_beginner then 0 else v_raw end;
    v_balance := coalesce(public.try_int(v_bal -> t.sport), 0);
    v_booked := greatest(v_total, -v_balance);
    v_bal := jsonb_set(v_bal, array[t.sport], to_jsonb(v_balance + v_booked));

    update public.tips
    set rang_delta = v_total,
        rang_booked = v_booked,
        beginner_slot = t.nr <= 10,
        beginner_shielded = v_beginner,
        narration = case
          when v_beginner and coalesce(narration, '') not like '%Anfänger-Schutz%'
            then coalesce(narration || ' ', '') || 'Nachträglich mit Anfänger-Schutz (deine ersten 10 Tipps): 0 Rangpunkte.'
          else narration end,
        updated_at = now()
    where id = t.id;
  end loop;

  update public.profiles
  set rang_punkte = coalesce(rang_punkte, '{}'::jsonb) || v_bal,
      updated_at = now()
  where id = v_user;
end $$;

commit;

-- Kontrolle Teil 1: muss "ok" zeigen
select case when pg_get_functiondef('public.evaluate_match_tips(text)'::regprocedure) like '%v_beginner%'
             and pg_get_functiondef('public.evaluate_match_tips(text)'::regprocedure) like '%prestige_strength%'
            then 'ok' else 'FEHLER: bitte Claude Bescheid geben' end as anfaenger_schutz;

-- Kontrolle Teil 2: Spieler, die noch Anfänger-Schutz übrig haben
-- (weniger als 10 gewertete Tipps insgesamt). Rene, Doris & Co. stehen hier
-- nicht.
select p.display_name,
       count(x.id) as gewertete_tipps,
       10 - count(x.id) as noch_geschuetzt
from public.profiles p
left join public.tips x on x.user_id = p.id
  and x.evaluated and x.result_tier is not null and x.refunded_at is null
group by p.id, p.display_name
having count(x.id) < 10
order by p.display_name;

-- Kontrolle Teil 3: Nicoles neue Rangpunkte je Sportart
select p.display_name,
       s.key as sportart,
       coalesce(public.try_int(s.value), 0) as rangpunkte,
       (select count(*) from public.tips x join public.matches m on m.id = x.match_id
        where x.user_id = p.id and x.evaluated and x.result_tier is not null and x.refunded_at is null
          and coalesce(nullif(m.data ->> 'sport', ''), 'Fußball') = s.key) as gewertete_tipps,
       (select count(*) from public.tips x join public.matches m on m.id = x.match_id
        where x.user_id = p.id and x.beginner_shielded
          and coalesce(nullif(m.data ->> 'sport', ''), 'Fußball') = s.key) as tipps_mit_anfaenger_schutz
from public.profiles p
cross join lateral jsonb_each(coalesce(p.rang_punkte, '{}'::jsonb)) s
where p.display_name ilike 'nicole%'
order by p.display_name, s.key;
