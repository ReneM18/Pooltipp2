-- ============================================================================
-- PoolTipp – Trainingstaschen im Prämien-Shop
-- ============================================================================
-- Drei Taschen, mit Coins gekauft (Coins kann man nie mit Geld kaufen):
--   Trainingstasche  150 Coins  Coins zurück (60-100) 50 %, Booster-Gutschein
--                               35 %, Pause-Joker 12 %, Tag nachholen 3 %
--   Matchtag-Tasche  400 Coins  Pause-Joker 40 %, 2 Booster-Gutscheine 30 %,
--                               Tag nachholen 15 %, 200 Coins zurück 15 %
--   Profi-Tasche     800 Coins  Pause-Joker + Tag nachholen, sicher
--
-- Grenzen: 1 Tasche pro Woche (Montag bis Sonntag), höchstens 2 Pause-Joker
-- im Vorrat, "Tag nachholen" höchstens 3 pro Saison. Ist eine Grenze voll,
-- gibt es stattdessen einen Booster-Gutschein.
--   Pause-Joker       wie im Joker-Shop (profiles.pause_jokers)
--   Tag nachholen     +100 Saison-XP (ein verpasster Tagesbonus)
--   Booster-Gutschein der nächste Booster-Tipp kostet keine 20 Coins: Gewinn
--                     wie immer (exakt +40, Tordifferenz +10), daneben
--                     kostet er nichts (Tendenz und falsch 0)
--
-- Kaufen und Auslosen passieren in EINEM Schritt auf dem Server (buy_tasche),
-- der Browser zeigt danach nur das Öffnen. Kaufen hängt am selben Schalter
-- wie der Joker-Shop ("Kaufen freigeben" auf der Admin-Seite). Der Admin
-- kann vorher testen; solange der Shop gesperrt ist, gilt für ihn die
-- Wochen-Grenze nicht.
--
-- Bestehende Tipps, Coins, Joker, Serien und Rangpunkte bleiben unverändert.
-- Voraussetzung: joker-shop.sql, dranbleiben.sql und saisonwechsel.sql
-- wurden schon ausgeführt. Darf beliebig oft ausgeführt werden.
-- Ausführen: Supabase-Dashboard -> SQL Editor -> New query -> dieses
-- komplette Skript einfügen -> "Run". Läuft als ein Block: bricht etwas ab,
-- ändert sich gar nichts.
-- ============================================================================

begin;

do $$
begin
  if to_regclass('public.joker_vorrat') is null or to_regclass('public.streak_shields') is null then
    raise exception 'Bitte zuerst joker-shop.sql und dranbleiben.sql ausführen, dann dieses Skript.';
  end if;
end $$;

-- 1) Booster-Gutscheine pro Spieler
create table if not exists public.booster_gutscheine (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  anzahl int not null default 0 check (anzahl >= 0)
);
alter table public.booster_gutscheine enable row level security;
drop policy if exists "Eigene Gutscheine sehen" on public.booster_gutscheine;
create policy "Eigene Gutscheine sehen" on public.booster_gutscheine for select to authenticated using (user_id = auth.uid());
revoke all on public.booster_gutscheine from anon, authenticated;
grant select on public.booster_gutscheine to authenticated;

-- 2) Gekaufte Taschen (Protokoll, Wochen- und Saison-Grenze)
create table if not exists public.taschen_kaeufe (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  tasche text not null check (tasche in ('training', 'matchtag', 'profi')),
  preis int not null,
  woche date not null,
  saison text not null,
  inhalt jsonb not null,
  gekauft_am timestamptz not null default now()
);
create index if not exists taschen_kaeufe_user_woche on public.taschen_kaeufe (user_id, woche);
alter table public.taschen_kaeufe enable row level security;
drop policy if exists "Eigene Taschen sehen" on public.taschen_kaeufe;
create policy "Eigene Taschen sehen" on public.taschen_kaeufe for select to authenticated using (user_id = auth.uid());
revoke all on public.taschen_kaeufe from anon, authenticated;
grant select on public.taschen_kaeufe to authenticated;

-- 3) Merker am Tipp: Booster-Tipp mit Gutschein bezahlt (setzt nur die Datenbank)
alter table public.tips add column if not exists gutschein boolean not null default false;

create or replace function public.keep_tip_gutschein()
returns trigger
language plpgsql
as $$
begin
  if public.is_client_write() then
    new.gutschein := old.gutschein;
  end if;
  return new;
end;
$$;
drop trigger if exists keep_tip_gutschein on public.tips;
create trigger keep_tip_gutschein
  before update on public.tips
  for each row execute procedure public.keep_tip_gutschein();

-- 4) Neuer Tipp: wie bisher (dranbleiben.sql). Neu ist nur der Gutschein:
--    Hat jemand einen, kostet der Booster-Tipp keine Coins. Der Einsatz von
--    20 steht trotzdem am Tipp, damit der Gewinn wie immer berechnet wird.
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
  if coalesce(v_match ->> 'booster', 'false') = 'true' then
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

-- 5) Gutschein-Tipp zurückgenommen oder Spiel abgesagt: Der Gutschein kommt
--    zurück. withdraw_tip / refund_match_stakes buchen danach wie immer 20
--    Coins gut, deshalb werden sie hier vorher abgezogen (unterm Strich: 0).
create or replace function public.return_tip_gutschein()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_tip record;
begin
  if tg_op = 'DELETE' then
    v_tip := old;
    if old.evaluated or old.refunded_at is not null then
      return old;
    end if;
  else
    v_tip := new;
    if not (old.refunded_at is null and new.refunded_at is not null) then
      return new;
    end if;
  end if;

  -- Konto wird gelöscht (Profil schon weg): nichts zurückgeben.
  if v_tip.gutschein and coalesce(v_tip.stake, 0) > 0
     and exists (select 1 from public.profiles where id = v_tip.user_id) then
    insert into public.booster_gutscheine (user_id, anzahl) values (v_tip.user_id, 1)
    on conflict (user_id) do update set anzahl = public.booster_gutscheine.anzahl + 1;
    update public.profiles
    set free_stars = free_stars - v_tip.stake, updated_at = now()
    where id = v_tip.user_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
revoke all on function public.return_tip_gutschein() from public, anon, authenticated;

drop trigger if exists return_tip_gutschein_on_delete on public.tips;
create trigger return_tip_gutschein_on_delete
  after delete on public.tips
  for each row execute procedure public.return_tip_gutschein();

drop trigger if exists return_tip_gutschein_on_refund on public.tips;
create trigger return_tip_gutschein_on_refund
  after update on public.tips
  for each row execute procedure public.return_tip_gutschein();

-- 5b) Auswertung eines Gutschein-Tipps: Die Auswertung bucht wie bei jedem
--     Booster-Tipp den Einsatz mal Faktor gut (exakt 60, Tordifferenz 30,
--     Tendenz 20, falsch 10). Bezahlt wurde aber nichts, darum wird hier der
--     Einsatz wieder abgezogen, und ein Minus gibt es nicht: unterm Strich
--     exakt +40, Tordifferenz +10, Tendenz und falsch 0. Wird ein Endstand
--     korrigiert, gleicht sich das genauso nach. stars_delta bleibt, wie die
--     Auswertung es rechnet (sie vergleicht damit beim Nachrechnen).
create or replace function public.gutschein_ausgleich(p_tip public.tips)
returns int
language sql
immutable
as $$
  select case
    when p_tip.gutschein and p_tip.refunded_at is null and p_tip.result_tier is not null
         and p_tip.stars_delta is not null
    then greatest(0, -p_tip.stars_delta) - coalesce(p_tip.stake, 0)
    else 0
  end
$$;
revoke all on function public.gutschein_ausgleich(public.tips) from public, anon, authenticated;

create or replace function public.settle_tip_gutschein()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_change int := public.gutschein_ausgleich(new) - public.gutschein_ausgleich(old);
begin
  if v_change <> 0 then
    update public.profiles
    set free_stars = greatest(0, free_stars + v_change), updated_at = now()
    where id = new.user_id;
  end if;
  return new;
end;
$$;
revoke all on function public.settle_tip_gutschein() from public, anon, authenticated;

drop trigger if exists settle_tip_gutschein on public.tips;
create trigger settle_tip_gutschein
  after update on public.tips
  for each row when (old.gutschein or new.gutschein)
  execute procedure public.settle_tip_gutschein();

-- 6) Eigene Taschen-Daten: Gutscheine, diese Woche schon gekauft, wie oft
--    "Tag nachholen" in dieser Saison
create or replace function public.my_taschen()
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := public.pooltipp_day(now());
  v_week date := v_today - (extract(isodow from v_today)::int - 1);
  v_season text;
begin
  if v_uid is null then
    raise exception 'Nicht eingeloggt';
  end if;
  select coalesce(to_jsonb(p) ->> 'pass_season_id', public.current_pass_season_id())
  into v_season from public.profiles p where p.id = v_uid;
  return jsonb_build_object(
    'gutscheine', coalesce((select anzahl from public.booster_gutscheine where user_id = v_uid), 0),
    'woche_gekauft', exists (select 1 from public.taschen_kaeufe where user_id = v_uid and woche = v_week),
    'tage_saison', (
      select count(*) from public.taschen_kaeufe k, jsonb_array_elements(k.inhalt) e
      where k.user_id = v_uid and k.saison = v_season and e ->> 'art' = 'tag'
    ),
    'pause', coalesce((select pause_jokers from public.profiles where id = v_uid), 0),
    'shop_open', coalesce((select shop_open from public.ranking_settings where id), false)
  );
end;
$$;

-- 7) Tasche kaufen und öffnen (auf dem Server ausgelost, alles oder nichts)
create or replace function public.buy_tasche(p_tasche text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_price int;
  v_today date := public.pooltipp_day(now());
  v_week date := v_today - (extract(isodow from v_today)::int - 1);
  v_open boolean := coalesce((select shop_open from public.ranking_settings where id), false);
  v_season text;
  v_pause int;
  v_tage int;
  v_draws text[] := '{}';
  v_roll numeric;
  v_draw text;
  v_items jsonb := '[]'::jsonb;
  v_amount int;
begin
  if v_uid is null then
    raise exception 'Nicht eingeloggt';
  end if;
  v_price := case p_tasche when 'training' then 150 when 'matchtag' then 400 when 'profi' then 800 end;
  if v_price is null then
    raise exception 'Unbekannte Tasche';
  end if;
  if not v_open and not public.is_admin() then
    raise exception 'Der Shop ist noch gesperrt.';
  end if;

  -- Profil sperren: zwei Geräte gleichzeitig kaufen nie zwei Taschen.
  select pause_jokers, coalesce(to_jsonb(p) ->> 'pass_season_id', public.current_pass_season_id())
  into v_pause, v_season
  from public.profiles p where p.id = v_uid for update;
  if not found then
    raise exception 'Profil nicht gefunden';
  end if;

  if (v_open or not public.is_admin())
     and exists (select 1 from public.taschen_kaeufe where user_id = v_uid and woche = v_week) then
    raise exception 'Diese Woche hast du schon eine Tasche gekauft.';
  end if;

  perform public.take_stars(v_uid, v_price, false, true);

  -- Auslosen
  v_roll := random();
  if p_tasche = 'training' then
    v_draws := array[case when v_roll < 0.50 then 'coins' when v_roll < 0.85 then 'gutschein' when v_roll < 0.97 then 'pause' else 'tag' end];
  elsif p_tasche = 'matchtag' then
    v_draws := array[case when v_roll < 0.40 then 'pause' when v_roll < 0.70 then 'gutschein2' when v_roll < 0.85 then 'tag' else 'coins200' end];
  else
    v_draws := array['pause', 'tag'];
  end if;

  select count(*) into v_tage
  from public.taschen_kaeufe k, jsonb_array_elements(k.inhalt) e
  where k.user_id = v_uid and k.saison = v_season and e ->> 'art' = 'tag';

  foreach v_draw in array v_draws loop
    -- Grenzen voll: stattdessen ein Booster-Gutschein
    if v_draw = 'pause' and v_pause >= 2 then
      v_draw := 'gutschein';
    elsif v_draw = 'tag' and v_tage >= 3 then
      v_draw := 'gutschein';
    end if;

    if v_draw = 'coins' or v_draw = 'coins200' then
      v_amount := case when v_draw = 'coins200' then 200 else 60 + floor(random() * 5)::int * 10 end;
      update public.profiles set free_stars = free_stars + v_amount, updated_at = now() where id = v_uid;
      v_items := v_items || jsonb_build_object('art', 'coins', 'menge', v_amount);
    elsif v_draw = 'gutschein' or v_draw = 'gutschein2' then
      v_amount := case when v_draw = 'gutschein2' then 2 else 1 end;
      insert into public.booster_gutscheine (user_id, anzahl) values (v_uid, v_amount)
      on conflict (user_id) do update set anzahl = public.booster_gutscheine.anzahl + v_amount;
      v_items := v_items || jsonb_build_object('art', 'gutschein', 'menge', v_amount);
    elsif v_draw = 'pause' then
      update public.profiles set pause_jokers = pause_jokers + 1, updated_at = now() where id = v_uid;
      v_pause := v_pause + 1;
      v_items := v_items || jsonb_build_object('art', 'pause', 'menge', 1);
    elsif v_draw = 'tag' then
      update public.profiles set pass_xp = pass_xp + 100, updated_at = now() where id = v_uid;
      perform public.claim_pass_rewards(v_uid);
      v_tage := v_tage + 1;
      v_items := v_items || jsonb_build_object('art', 'tag', 'menge', 100);
    end if;
  end loop;

  insert into public.taschen_kaeufe (user_id, tasche, preis, woche, saison, inhalt)
  values (v_uid, p_tasche, v_price, v_week, v_season, v_items);

  return jsonb_build_object(
    'inhalt', v_items,
    'taschen', public.my_taschen(),
    'jokers', public.my_jokers(),
    'wallet', public.my_wallet()
  );
end;
$$;

revoke all on function public.my_taschen() from public, anon;
grant execute on function public.my_taschen() to authenticated;
revoke all on function public.buy_tasche(text) from public, anon;
grant execute on function public.buy_tasche(text) to authenticated;

-- 8) Sofort-Abgleich zwischen Geräten (Supabase Realtime)
do $$ begin
  alter publication supabase_realtime add table public.booster_gutscheine;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.taschen_kaeufe;
exception when duplicate_object then null;
end $$;

commit;
