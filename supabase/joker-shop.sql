-- ============================================================================
-- PoolTipp – Joker-Shop: Joker mit Sternen kaufen und auf Tipps einsetzen
-- ============================================================================
-- Voraussetzung: supabase/rankingsystem.sql wurde schon ausgeführt (dort wirken
-- die Joker bei der Auswertung).
--
-- Kaufen ist am Anfang GESPERRT. Nur der Admin kann schon testen. Für alle
-- freigeben: Admin-Seite -> "Joker-Shop" -> "Kaufen freigeben" (oder
-- update public.ranking_settings set shop_open = true where id;).
--
--   Schutz-Joker    120 Sterne  Spiel kostet keine Rangpunkte (0 statt Minus)
--   Pause-Joker     100 Sterne  schützt eine Woche vor der Strafe fürs Nicht-Tippen
--   Doppel-Joker    180 Sterne  feste Punkte doppelt (20 / 14 / 10)
--   Toleranz-Joker  150 Sterne  1 Tor daneben = 0 statt -3 (nur Ergebnis-Tipps)
--   Trend-Joker     100 Sterne  zeigt vor Tippschluss, wie die anderen getippt haben
--
-- Schutz, Doppel und Toleranz setzt man auf einen eigenen Tipp, bis zum
-- Tippschluss (pro Tipp ein Joker, wieder abnehmen geht). Wird das Spiel
-- abgesagt oder der Tipp gelöscht, kommt der Joker zurück in den Vorrat.
--
-- Bestehende Tipps, Sterne und Rangpunkte ändern sich durch dieses Skript
-- nicht. Darf mehrmals ausgeführt werden.
--
-- Ausführen: Supabase-Dashboard -> SQL Editor -> New query -> dieses
-- komplette Skript einfügen -> "Run".
-- ============================================================================

do $$
begin
  if to_regclass('public.ranking_settings') is null then
    raise exception 'Bitte zuerst supabase/rankingsystem.sql ausführen, dann dieses Skript.';
  end if;
end $$;

-- 1) Schalter: Kaufen für alle freigegeben? (Start: nein)
alter table public.ranking_settings add column if not exists shop_open boolean not null default false;

-- 2) Joker-Vorrat pro Spieler (Pause-Joker stehen wie bisher in profiles.pause_jokers)
create table if not exists public.joker_vorrat (
  user_id uuid not null references public.profiles(id) on delete cascade,
  joker text not null check (joker in ('schutz', 'doppel', 'toleranz', 'trend')),
  anzahl int not null default 0 check (anzahl >= 0),
  primary key (user_id, joker)
);
alter table public.joker_vorrat enable row level security;
drop policy if exists "Eigene Joker sehen" on public.joker_vorrat;
create policy "Eigene Joker sehen" on public.joker_vorrat for select to authenticated using (user_id = auth.uid());
revoke all on public.joker_vorrat from anon, authenticated;
grant select on public.joker_vorrat to authenticated;

-- 3) Kauf-Protokoll (für Rückfragen und Erstattungen)
create table if not exists public.joker_kaeufe (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joker text not null,
  preis int not null,
  gekauft_am timestamptz not null default now()
);
alter table public.joker_kaeufe enable row level security;
drop policy if exists "Eigene Joker-Käufe sehen" on public.joker_kaeufe;
create policy "Eigene Joker-Käufe sehen" on public.joker_kaeufe for select to authenticated using (user_id = auth.uid());
revoke all on public.joker_kaeufe from anon, authenticated;
grant select on public.joker_kaeufe to authenticated;

-- 4) Für welche Spiele hat jemand schon einen Trend-Joker eingesetzt?
create table if not exists public.trend_joker_einsaetze (
  user_id uuid not null references public.profiles(id) on delete cascade,
  match_id text not null,
  eingesetzt_am timestamptz not null default now(),
  primary key (user_id, match_id)
);
alter table public.trend_joker_einsaetze enable row level security;
drop policy if exists "Eigene Trend-Joker sehen" on public.trend_joker_einsaetze;
create policy "Eigene Trend-Joker sehen" on public.trend_joker_einsaetze for select to authenticated using (user_id = auth.uid());
revoke all on public.trend_joker_einsaetze from anon, authenticated;
grant select on public.trend_joker_einsaetze to authenticated;

-- 5) Preise (gleich wie lib/mockShopItems.ts)
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
    when 'trend' then 100
  end
$$;

-- 6) Eigener Vorrat + Schalterstand
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
    'pause', coalesce((select pause_jokers from public.profiles where id = v_uid), 0),
    'shop_open', coalesce((select shop_open from public.ranking_settings where id), false),
    'trend_matches', coalesce((select jsonb_agg(match_id) from public.trend_joker_einsaetze where user_id = v_uid), '[]'::jsonb)
  );
end;
$$;

-- 7) Kaufen: Sterne abbuchen (alles oder nichts), Joker in den Vorrat
create or replace function public.buy_joker(p_joker text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_price int := public.joker_price(p_joker);
begin
  if v_uid is null then
    raise exception 'Nicht eingeloggt';
  end if;
  if v_price is null then
    raise exception 'Unbekannter Joker';
  end if;
  if not coalesce((select shop_open from public.ranking_settings where id), false) and not public.is_admin() then
    raise exception 'Der Joker-Shop ist noch gesperrt.';
  end if;

  perform public.take_stars(v_uid, v_price, false, true);

  if p_joker = 'pause' then
    update public.profiles set pause_jokers = pause_jokers + 1, updated_at = now() where id = v_uid;
  else
    insert into public.joker_vorrat (user_id, joker, anzahl) values (v_uid, p_joker, 1)
    on conflict (user_id, joker) do update set anzahl = public.joker_vorrat.anzahl + 1;
  end if;
  insert into public.joker_kaeufe (user_id, joker, preis) values (v_uid, p_joker, v_price);

  return jsonb_build_object('jokers', public.my_jokers(), 'wallet', public.my_wallet());
end;
$$;

-- Hilfsfunktion: einen Joker in den Vorrat zurücklegen
create or replace function public.return_joker(p_user uuid, p_joker text)
returns void
language sql
security definer set search_path = public
as $$
  insert into public.joker_vorrat (user_id, joker, anzahl) values (p_user, p_joker, 1)
  on conflict (user_id, joker) do update set anzahl = public.joker_vorrat.anzahl + 1;
$$;

-- 8) Joker auf den eigenen Tipp setzen (p_joker = null nimmt ihn wieder ab)
create or replace function public.set_tip_joker(p_match_id text, p_joker text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tip record;
  v_match jsonb;
  v_deadline timestamptz;
  v_left int;
begin
  if v_uid is null then
    raise exception 'Nicht eingeloggt';
  end if;
  if p_joker is not null and p_joker not in ('schutz', 'doppel', 'toleranz') then
    raise exception 'Diesen Joker kann man nicht auf einen Tipp setzen';
  end if;

  select data into v_match from public.matches where id = p_match_id;
  if not found then
    raise exception 'Spiel nicht gefunden';
  end if;
  v_deadline := coalesce(public.try_timestamptz(v_match ->> 'tipDeadline'), public.try_timestamptz(v_match ->> 'kickoff'));
  if coalesce(v_match ->> 'status', 'upcoming') in ('live', 'finished', 'cancelled')
     or v_deadline is null or now() >= v_deadline then
    raise exception 'Tippschluss: Joker können nicht mehr geändert werden';
  end if;
  if p_joker = 'toleranz' and coalesce(v_match ->> 'tipMode', 'score') = '1x2' then
    raise exception 'Der Toleranz-Joker gilt nur für Ergebnis-Tipps';
  end if;

  select id, joker, evaluated into v_tip from public.tips
  where user_id = v_uid and match_id = p_match_id
  order by submitted_at desc limit 1
  for update;
  if not found then
    raise exception 'Erst tippen, dann den Joker setzen';
  end if;
  if v_tip.evaluated then
    raise exception 'Der Tipp ist schon ausgewertet';
  end if;
  if v_tip.joker is not distinct from p_joker then
    return public.my_jokers();
  end if;

  if p_joker is not null then
    update public.joker_vorrat set anzahl = anzahl - 1
    where user_id = v_uid and joker = p_joker and anzahl > 0
    returning anzahl into v_left;
    if not found then
      raise exception 'Kein Joker dieser Art im Vorrat';
    end if;
  end if;
  if v_tip.joker is not null then
    perform public.return_joker(v_uid, v_tip.joker);
  end if;

  update public.tips set joker = p_joker where id = v_tip.id;
  return public.my_jokers();
end;
$$;

-- 9) Trend-Joker: Verteilung der anderen Tipps (Heimsieg / Remis / Auswärtssieg).
--    Einmal pro Spiel bezahlen, danach kann man es kostenlos wieder ansehen.
create or replace function public.use_trend_joker(p_match_id text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_match jsonb;
  v_deadline timestamptz;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'Nicht eingeloggt';
  end if;
  select data into v_match from public.matches where id = p_match_id;
  if not found then
    raise exception 'Spiel nicht gefunden';
  end if;

  if not exists (select 1 from public.trend_joker_einsaetze where user_id = v_uid and match_id = p_match_id) then
    v_deadline := coalesce(public.try_timestamptz(v_match ->> 'tipDeadline'), public.try_timestamptz(v_match ->> 'kickoff'));
    if coalesce(v_match ->> 'status', 'upcoming') in ('live', 'finished', 'cancelled')
       or v_deadline is null or now() >= v_deadline then
      raise exception 'Tippschluss: Ab jetzt siehst du alle Tipps ohnehin';
    end if;
    update public.joker_vorrat set anzahl = anzahl - 1
    where user_id = v_uid and joker = 'trend' and anzahl > 0;
    if not found then
      raise exception 'Kein Trend-Joker im Vorrat';
    end if;
    insert into public.trend_joker_einsaetze (user_id, match_id) values (v_uid, p_match_id);
  end if;

  select jsonb_build_object(
    'tipps', count(*),
    'heim', count(*) filter (where t.predicted_home_score > t.predicted_away_score),
    'remis', count(*) filter (where t.predicted_home_score = t.predicted_away_score),
    'gast', count(*) filter (where t.predicted_home_score < t.predicted_away_score)
  ) into v_result
  from public.tips t
  where t.match_id = p_match_id and t.user_id <> v_uid;
  return v_result;
end;
$$;

-- 10) Admin: Kaufen für alle freigeben oder wieder sperren
create or replace function public.set_shop_open(p_open boolean)
returns boolean
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Nur der Admin darf den Shop freigeben';
  end if;
  update public.ranking_settings set shop_open = coalesce(p_open, false) where id;
  return coalesce(p_open, false);
end;
$$;

-- 11) Joker zurück in den Vorrat: Tipp gelöscht oder Spiel abgesagt
create or replace function public.return_joker_on_tip_delete()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if old.joker is not null and not coalesce(old.evaluated, false)
     and exists (select 1 from public.profiles where id = old.user_id) then
    perform public.return_joker(old.user_id, old.joker);
  end if;
  return old;
end;
$$;

drop trigger if exists return_joker_on_tip_delete on public.tips;
create trigger return_joker_on_tip_delete
  before delete on public.tips
  for each row execute function public.return_joker_on_tip_delete();

create or replace function public.return_jokers_on_cancel()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_tip record;
begin
  if new.data ->> 'status' = 'cancelled' and old.data ->> 'status' is distinct from 'cancelled' then
    for v_tip in
      select id, user_id, joker from public.tips
      where match_id = new.id and joker is not null and not coalesce(evaluated, false)
      for update
    loop
      perform public.return_joker(v_tip.user_id, v_tip.joker);
      update public.tips set joker = null where id = v_tip.id;
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists return_jokers_on_cancel on public.matches;
create trigger return_jokers_on_cancel
  after update on public.matches
  for each row execute function public.return_jokers_on_cancel();

-- 12) Rechte
revoke all on function public.joker_price(text) from public, anon;
revoke all on function public.return_joker(uuid, text) from public, anon, authenticated;
revoke all on function public.return_joker_on_tip_delete() from public, anon, authenticated;
revoke all on function public.return_jokers_on_cancel() from public, anon, authenticated;
revoke all on function public.my_jokers() from public, anon;
revoke all on function public.buy_joker(text) from public, anon;
revoke all on function public.set_tip_joker(text, text) from public, anon;
revoke all on function public.use_trend_joker(text) from public, anon;
revoke all on function public.set_shop_open(boolean) from public, anon;
grant execute on function public.joker_price(text) to authenticated;
grant execute on function public.my_jokers() to authenticated;
grant execute on function public.buy_joker(text) to authenticated;
grant execute on function public.set_tip_joker(text, text) to authenticated;
grant execute on function public.use_trend_joker(text) to authenticated;
grant execute on function public.set_shop_open(boolean) to authenticated;

-- Kontrolle: Shop-Schalter (false = Kaufen noch gesperrt)
select shop_open as kaufen_freigegeben from public.ranking_settings;
