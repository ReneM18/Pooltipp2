-- PoolTipp – Booster freiwillig (Rene, 11.10.2026)
-- Einmal im Supabase SQL Editor ausführen (beliebig oft wiederholbar).
--
-- Bei den Spielen, die der Admin als Booster-Spiel markiert, entscheidet jeder
-- Spieler selbst, ob er den Booster einsetzt. Ohne Booster ist der Tipp
-- gratis (nur Rangpunkte), mit Booster kostet er wie bisher 20 Coins (oder
-- einen Gutschein). Abgebucht wird erst beim Tipp-Abgeben. Rücknahme bis
-- Tippschluss gibt den Einsatz wie bisher zurück (withdraw_tip, unverändert).
--
-- Geändert wird nur die Funktion protect_tip_stake (Einsatz beim Speichern
-- eines Tipps) – alles andere (Tipp-Serie, Serien-Schutz, Gutscheine) ist
-- unverändert aus supabase/trainingstaschen.sql übernommen.
-- Bestehende Tipps, Punkte und Coins werden nicht verändert.

begin;

alter table public.tips add column if not exists booster_gewaehlt boolean;

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
  v_shield_week date;
  v_shielded boolean := false;
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

  -- Booster-Spiel: fester Einsatz 20 Coins, der volle Einsatz muss da sein,
  -- außer ein Booster-Gutschein bezahlt ihn. Alle anderen Spiele sind gratis
  -- (nur Rangpunkte). Was der Browser als Einsatz schickt, zählt nie.
  new.gutschein := false;
  -- Neu (11.10.2026): Bei Booster-Spielen entscheidet der Spieler selbst,
  -- ob er den Booster einsetzt (booster_gewaehlt). Ohne Angabe (ältere App)
  -- wie bisher: Booster-Spiel = Booster-Tipp.
  if coalesce(v_match ->> 'booster', 'false') = 'true' and coalesce(new.booster_gewaehlt, true) then
    update public.booster_gutscheine set anzahl = anzahl - 1
    where user_id = new.user_id and anzahl > 0;
    if found then
      new.stake := 20;
      new.gutschein := true;
    else
      if v_profile.free_stars < 20 then
        raise exception 'Für einen Booster-Tipp brauchst du 20 Sterne';
      end if;
      new.stake := public.take_stars(new.user_id, 20, false, true);
    end if;
    new.booster := true;
  else
    new.stake := 0;
    new.booster := false;
  end if;
  new.staked_at := now();

  -- Tipp-Serie: ein Kalendertag zählt einmal, der Folgetag verlängert.
  -- Genau ein ausgelassener Tag wird vom Serien-Schutz überbrückt, einmal
  -- pro Woche (Woche des ausgelassenen Tages). Sonst beginnt eine Lücke
  -- wieder bei 1. Meilensteine (3/5/10/20 Tage) gibt es je einmal.
  -- Gleiche Werte wie STREAK_MILESTONES in lib/poolScore.ts.
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
  elsif v_last_day is not null and v_last_day = v_today - 2 and v_count > 0 then
    v_shield_week := (v_today - 1) - (extract(isodow from v_today - 1)::int - 1);
    insert into public.streak_shields (user_id, week_start, missed_day)
    values (new.user_id, v_shield_week, v_today - 1)
    on conflict (user_id, week_start) do nothing;
    if found then
      v_shielded := true;
      v_count := v_count + 1;
    else
      v_count := 1;
    end if;
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

  if v_shielded then
    perform public.add_private_activity(new.user_id, '🛡️',
      'Serien-Schutz: Gestern hast du nicht getippt, deine Serie läuft trotzdem weiter (' || v_count || ' Tage).');
  end if;
  if v_bonus > 0 then
    perform public.add_private_activity(new.user_id, '🔥',
      v_days || ' Spieltage in Folge getippt – +' || v_bonus || ' Coins Bonus!');
  end if;
  return new;
end;
$$;

revoke all on function public.protect_tip_stake() from public, anon, authenticated;

commit;
