-- PoolTipp – Experten-Joker + neue Joker-Preise (Rene, 12.10.2026)
-- Einmal im Supabase SQL Editor ausführen (beliebig oft wiederholbar).
-- Voraussetzung: supabase/joker-shop.sql wurde schon ausgeführt.
--
--   Trend-Joker     80 Coins (vorher 100)  Prozente der anderen Tipps
--   Experten-Joker 100 Coins (neu)         Prozente + häufigstes Ergebnis
--                                          der Top 30 % der Sportart
--
-- "Top 30 %": Rangliste der jeweiligen Sportart (profiles.rang_punkte), nur
-- Spieler mit mehr als 0 Rangpunkten. Das häufigste Ergebnis gibt es erst ab
-- 3 Top-Tippern bei diesem Spiel – sonst verrät es praktisch den Tipp einer
-- einzelnen Person. Bei 1X2-Spielen: die häufigste Wahl (1 / X / 2).
-- Einmal pro Spiel bezahlen, danach kostenlos wieder ansehen.
-- Bestehende Tipps, Coins, Joker und Rangpunkte bleiben unverändert.

begin;

do $$
begin
  if to_regclass('public.joker_vorrat') is null then
    raise exception 'Bitte zuerst supabase/joker-shop.sql ausführen, dann dieses Skript.';
  end if;
end $$;

-- 1) Neuer Joker im Vorrat erlaubt
alter table public.joker_vorrat drop constraint if exists joker_vorrat_joker_check;
alter table public.joker_vorrat add constraint joker_vorrat_joker_check
  check (joker in ('schutz', 'doppel', 'toleranz', 'trend', 'experte'));

-- 2) Für welche Spiele wurde schon ein Experten-Joker eingesetzt?
create table if not exists public.experten_joker_einsaetze (
  user_id uuid not null references public.profiles(id) on delete cascade,
  match_id text not null,
  eingesetzt_am timestamptz not null default now(),
  primary key (user_id, match_id)
);
alter table public.experten_joker_einsaetze enable row level security;
drop policy if exists "Eigene Experten-Joker sehen" on public.experten_joker_einsaetze;
create policy "Eigene Experten-Joker sehen" on public.experten_joker_einsaetze
  for select to authenticated using (user_id = auth.uid());
revoke all on public.experten_joker_einsaetze from anon, authenticated;
grant select on public.experten_joker_einsaetze to authenticated;

-- 3) Preise (gleich wie lib/mockShopItems.ts)
create or replace function public.joker_price(p_joker text)
returns int
language sql
immutable
as $$
  select case p_joker
    when 'schutz' then 120
    when 'pause' then 100
    when 'doppel' then 180
    when 'toleranz' then 150
    when 'trend' then 80
    when 'experte' then 100
  end
$$;

-- 4) Eigener Vorrat (wie bisher, plus Experten-Joker)
create or replace function public.my_jokers()
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Nicht eingeloggt';
  end if;
  return jsonb_build_object(
    'schutz', coalesce((select anzahl from public.joker_vorrat where user_id = v_uid and joker = 'schutz'), 0),
    'doppel', coalesce((select anzahl from public.joker_vorrat where user_id = v_uid and joker = 'doppel'), 0),
    'toleranz', coalesce((select anzahl from public.joker_vorrat where user_id = v_uid and joker = 'toleranz'), 0),
    'trend', coalesce((select anzahl from public.joker_vorrat where user_id = v_uid and joker = 'trend'), 0),
    'experte', coalesce((select anzahl from public.joker_vorrat where user_id = v_uid and joker = 'experte'), 0),
    'pause', coalesce((select pause_jokers from public.profiles where id = v_uid), 0),
    'shop_open', coalesce((select shop_open from public.ranking_settings where id), false),
    'trend_matches', coalesce((select jsonb_agg(match_id) from public.trend_joker_einsaetze where user_id = v_uid), '[]'::jsonb),
    'experte_matches', coalesce((select jsonb_agg(match_id) from public.experten_joker_einsaetze where user_id = v_uid), '[]'::jsonb)
  );
end;
$$;

-- 5) Experten-Joker einsetzen
create or replace function public.use_experten_joker(p_match_id text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_match jsonb;
  v_deadline timestamptz;
  v_sport text;
  v_one_x_two boolean;
  v_result jsonb;
  v_top_count int := 0;
  v_top jsonb := null;
begin
  if v_uid is null then
    raise exception 'Nicht eingeloggt';
  end if;
  select data into v_match from public.matches where id = p_match_id;
  if not found then
    raise exception 'Spiel nicht gefunden';
  end if;

  if not exists (select 1 from public.experten_joker_einsaetze where user_id = v_uid and match_id = p_match_id) then
    v_deadline := coalesce(public.try_timestamptz(v_match ->> 'tipDeadline'), public.try_timestamptz(v_match ->> 'kickoff'));
    if coalesce(v_match ->> 'status', 'upcoming') in ('live', 'finished', 'cancelled')
       or v_deadline is null or now() >= v_deadline then
      raise exception 'Tippschluss: Ab jetzt siehst du alle Tipps ohnehin';
    end if;
    update public.joker_vorrat set anzahl = anzahl - 1
    where user_id = v_uid and joker = 'experte' and anzahl > 0;
    if not found then
      raise exception 'Kein Experten-Joker im Vorrat';
    end if;
    insert into public.experten_joker_einsaetze (user_id, match_id) values (v_uid, p_match_id);
  end if;

  v_sport := coalesce(v_match ->> 'sport', '');
  v_one_x_two := coalesce(v_match ->> 'tipMode', 'score') = '1x2';

  -- Verteilung aller anderen Tipps (wie beim Trend-Joker)
  select jsonb_build_object(
    'tipps', count(*),
    'heim', count(*) filter (where t.predicted_home_score > t.predicted_away_score),
    'remis', count(*) filter (where t.predicted_home_score = t.predicted_away_score),
    'gast', count(*) filter (where t.predicted_home_score < t.predicted_away_score)
  ) into v_result
  from public.tips t
  where t.match_id = p_match_id and t.user_id <> v_uid;

  -- Top 30 % der Rangliste dieser Sportart, die dieses Spiel getippt haben
  with ranked as (
    select p.id,
           row_number() over (order by public.try_int(p.rang_punkte -> v_sport) desc, p.id) as platz,
           count(*) over () as spieler
    from public.profiles p
    where coalesce(public.try_int(p.rang_punkte -> v_sport), 0) > 0
  ),
  top_tips as (
    select t.predicted_home_score as h, t.predicted_away_score as a
    from public.tips t
    join ranked r on r.id = t.user_id
    where t.match_id = p_match_id
      and t.user_id <> v_uid
      and r.platz <= ceil(r.spieler * 0.3)
  )
  select count(*)::int into v_top_count from top_tips;

  if v_top_count >= 3 then
    with ranked as (
      select p.id,
             row_number() over (order by public.try_int(p.rang_punkte -> v_sport) desc, p.id) as platz,
             count(*) over () as spieler
      from public.profiles p
      where coalesce(public.try_int(p.rang_punkte -> v_sport), 0) > 0
    ),
    top_tips as (
      select case when v_one_x_two then sign(t.predicted_home_score - t.predicted_away_score)::int else t.predicted_home_score end as h,
             case when v_one_x_two then 0 else t.predicted_away_score end as a
      from public.tips t
      join ranked r on r.id = t.user_id
      where t.match_id = p_match_id
        and t.user_id <> v_uid
        and r.platz <= ceil(r.spieler * 0.3)
    )
    select jsonb_build_object('heim', h, 'gast', a, 'anzahl', anzahl)
    into v_top
    from (select h, a, count(*)::int as anzahl from top_tips group by h, a) g
    order by anzahl desc, h desc, a asc
    limit 1;
  end if;

  -- Bei 1X2 steht in "heim": 1 = Heimsieg, 0 = Remis, -1 = Auswärtssieg.
  return v_result || jsonb_build_object('top_tipper', v_top_count, 'top', v_top, 'eins_x_zwei', v_one_x_two);
end;
$$;

revoke all on function public.use_experten_joker(text) from public, anon;
grant execute on function public.use_experten_joker(text) to authenticated;
grant execute on function public.joker_price(text) to authenticated;
grant execute on function public.my_jokers() to authenticated;

commit;
