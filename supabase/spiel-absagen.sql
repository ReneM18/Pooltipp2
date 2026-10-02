-- Spiel absagen: Alle Spieler bekommen ihren Einsatz zurück.
--
-- Was dieses Skript einrichtet:
--  1) cancel_match(): der Knopf "Absagen" im Admin-Bereich. Markiert das
--     Spiel als abgesagt und erstattet jeden noch nicht ausgewerteten Tipp
--     (voller Einsatz zurück, keine Rangpunkte) sowie offene Duelle.
--  2) Wird ein Spiel gelöscht, werden vorher automatisch alle offenen
--     Einsätze erstattet – Löschen verschluckt keine Sterne mehr.
--  3) Ein abgesagtes Spiel bleibt abgesagt (ein veralteter Admin-Tab kann es
--     nicht versehentlich wieder öffnen).
--  4) Tippt jemand mit einem veralteten Tab noch auf ein abgesagtes Spiel,
--     bekommt er den Einsatz sofort zurück.
--
-- Nie doppelt: Erstattet wird nur, was noch offen ist; der Tipp wird dabei
-- in derselben Datenbank-Transaktion als erledigt markiert. Doppelklick,
-- Neuladen oder mehrfaches Ausführen erstatten nichts zweimal.
--
-- Darf beliebig oft ausgeführt werden.
-- Ausführen: Supabase-Dashboard -> SQL Editor -> New query -> dieses
-- komplette Skript einfügen -> "Run".

alter table public.tips add column if not exists refunded_at timestamptz;

-- ----------------------------------------------------------------------------
-- Erstattet alle offenen Einsätze eines Spiels (Tipps + Duelle).
-- Nur intern (von den Funktionen/Triggern unten) aufrufbar.
-- ----------------------------------------------------------------------------
create or replace function public.refund_match_stakes(p_match_id text)
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_tip record;
  v_duel record;
  v_count int := 0;
begin
  for v_tip in
    select id, user_id, stake from public.tips
    where match_id = p_match_id and not evaluated
    for update
  loop
    update public.tips
    set evaluated = true,
        refunded_at = now(),
        result_tier = null,
        rang_delta = 0,
        stars_delta = 0,
        narration = 'Spiel abgesagt – ' || v_tip.stake || ' Sterne zurück.',
        updated_at = now()
    where id = v_tip.id;
    if v_tip.stake > 0 then
      update public.profiles
      set free_stars = free_stars + v_tip.stake, updated_at = now()
      where id = v_tip.user_id;
    end if;
    v_count := v_count + 1;
  end loop;

  -- Duelle: "pending" = nur der Herausforderer hat bezahlt, "offen" = beide.
  for v_duel in
    select * from public.duels
    where match_id = p_match_id and status in ('pending', 'offen')
    for update
  loop
    update public.duels
    set status = 'abgesagt', stars_credited = v_duel.stake, resolved_at = now()
    where id = v_duel.id;
    update public.profiles
    set free_stars = free_stars + v_duel.stake, updated_at = now()
    where id = v_duel.challenger_id;
    if v_duel.status = 'offen' then
      update public.profiles
      set free_stars = free_stars + v_duel.stake, updated_at = now()
      where id = v_duel.opponent_id;
    end if;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.refund_match_stakes(text) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 1) Spiel absagen (nur Admin). Gibt die Zahl der erstatteten Tipps zurück.
-- ----------------------------------------------------------------------------
create or replace function public.cancel_match(p_match_id text)
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_status text;
begin
  if not public.is_admin() then
    raise exception 'Nur der Admin darf Spiele absagen';
  end if;

  -- Sperrt die Zeile: ein zweiter, gleichzeitiger Aufruf wartet hier und
  -- findet danach nichts Offenes mehr.
  select data ->> 'status' into v_status from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'Spiel nicht gefunden';
  end if;
  if v_status = 'finished' then
    raise exception 'Ein beendetes Spiel kann nicht abgesagt werden';
  end if;

  update public.matches
  set data = jsonb_set(data, '{status}', '"cancelled"'), updated_at = now()
  where id = p_match_id;

  return public.refund_match_stakes(p_match_id);
end;
$$;

revoke all on function public.cancel_match(text) from public, anon;
grant execute on function public.cancel_match(text) to authenticated;

-- ----------------------------------------------------------------------------
-- 2) Vor dem Löschen eines Spiels alle offenen Einsätze erstatten.
-- ----------------------------------------------------------------------------
create or replace function public.refund_before_match_delete()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.refund_match_stakes(old.id);
  return old;
end;
$$;

drop trigger if exists refund_before_match_delete on public.matches;
create trigger refund_before_match_delete
  before delete on public.matches
  for each row execute procedure public.refund_before_match_delete();

-- ----------------------------------------------------------------------------
-- 3) Abgesagt bleibt abgesagt.
-- ----------------------------------------------------------------------------
create or replace function public.keep_match_cancelled()
returns trigger
language plpgsql
as $$
begin
  if old.data ->> 'status' = 'cancelled' and new.data ->> 'status' is distinct from 'cancelled' then
    new.data := jsonb_set(new.data, '{status}', '"cancelled"');
  end if;
  return new;
end;
$$;

drop trigger if exists keep_match_cancelled on public.matches;
create trigger keep_match_cancelled
  before update on public.matches
  for each row execute procedure public.keep_match_cancelled();

-- ----------------------------------------------------------------------------
-- 4) Neuer Tipp auf ein schon abgesagtes Spiel: sofort erstatten.
-- ----------------------------------------------------------------------------
create or replace function public.refund_tip_on_cancelled_match()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Upsert auf einen schon gespeicherten Tipp: nichts tun (sonst würde jeder
  -- Abgleich aus dem Browser erneut erstatten).
  if exists (select 1 from public.tips where id = new.id) then
    return new;
  end if;
  if exists (
    select 1 from public.matches
    where id = new.match_id and data ->> 'status' = 'cancelled'
  ) then
    new.evaluated := true;
    new.refunded_at := now();
    new.result_tier := null;
    new.rang_delta := 0;
    new.stars_delta := 0;
    new.narration := 'Spiel abgesagt – ' || new.stake || ' Sterne zurück.';
    if new.stake > 0 then
      update public.profiles
      set free_stars = free_stars + new.stake, updated_at = now()
      where id = new.user_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists refund_tip_on_cancelled_match on public.tips;
create trigger refund_tip_on_cancelled_match
  before insert on public.tips
  for each row execute procedure public.refund_tip_on_cancelled_match();
