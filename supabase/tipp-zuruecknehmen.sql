-- Tipp ändern auf allen Geräten + Sofort-Abgleich
--
-- Was dieses Skript einrichtet:
--  1) withdraw_tip(): "Ändern" auf einer Tipp-Karte nimmt den eigenen Tipp
--     in der Datenbank zurück. Danach ist die Karte auf JEDEM Gerät leer, als
--     hätte man noch nicht getippt. Wer nicht neu tippt, hat keinen Tipp.
--     - nur der eigene Tipp, nur vor Tippschluss, nie ein ausgewerteter Tipp
--     - Booster-Einsatz (20 Coins) kommt zurück, ein gesetzter Joker liegt
--       wieder im Vorrat (Trigger aus joker-shop.sql)
--     - mehrfach aufrufen (Doppelklick, zwei Geräte) erstattet nie doppelt:
--       ist der Tipp schon weg, passiert nichts mehr
--     - der neue Tipp wird ganz normal abgegeben, bei Booster-Spielen mit
--       neuem Einsatz
--  2) Sofort-Abgleich: Tipps, Kontostand (Profil) und Joker-Vorrat melden
--     Änderungen sofort an alle offenen Geräte (Supabase Realtime). Jeder
--     sieht dabei nur seine eigenen Zeilen (bestehende Zugriffsregeln).
--
-- Bestehende Tipps, Coins und Joker bleiben unverändert.
-- Voraussetzung: booster.sql und joker-shop.sql wurden schon ausgeführt.
-- Darf beliebig oft ausgeführt werden.
-- Ausführen: Supabase-Dashboard -> SQL Editor -> New query -> dieses
-- komplette Skript einfügen -> "Run".

create or replace function public.withdraw_tip(p_match_id text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tip record;
  v_match jsonb;
  v_deadline timestamptz;
  v_refund int := 0;
  v_joker text;
  v_stars int;
begin
  if v_uid is null then
    raise exception 'Nicht eingeloggt';
  end if;

  -- Gleiche Sperr-Reihenfolge wie beim Tippen (erst Profil, dann Tipp):
  -- zwei Geräte gleichzeitig warten aufeinander statt doppelt zu erstatten.
  perform 1 from public.profiles where id = v_uid for update;

  select id, stake, joker, evaluated, refunded_at into v_tip
  from public.tips
  where user_id = v_uid and match_id = p_match_id
  order by submitted_at desc
  limit 1
  for update;
  if not found then
    -- Schon zurückgenommen (anderes Gerät, Doppelklick): nichts mehr tun.
    select free_stars into v_stars from public.profiles where id = v_uid;
    return jsonb_build_object('withdrawn', false, 'refunded', 0, 'joker', null, 'free_stars', v_stars);
  end if;
  if v_tip.evaluated or v_tip.refunded_at is not null then
    raise exception 'Der Tipp ist schon ausgewertet';
  end if;

  select data into v_match from public.matches where id = p_match_id;
  v_deadline := coalesce(public.try_timestamptz(v_match ->> 'tipDeadline'), public.try_timestamptz(v_match ->> 'kickoff'));
  if v_match is null
     or coalesce(v_match ->> 'status', 'upcoming') in ('live', 'finished', 'cancelled')
     or v_deadline is null or now() >= v_deadline then
    raise exception 'Tippschluss: der Tipp kann nicht mehr geändert werden';
  end if;

  v_refund := greatest(coalesce(v_tip.stake, 0), 0);
  v_joker := v_tip.joker;

  -- Löschen gibt einen gesetzten Joker zurück (return_joker_on_tip_delete).
  delete from public.tips where id = v_tip.id;

  if v_refund > 0 then
    update public.profiles
    set free_stars = free_stars + v_refund, updated_at = now()
    where id = v_uid;
  end if;

  select free_stars into v_stars from public.profiles where id = v_uid;
  return jsonb_build_object('withdrawn', true, 'refunded', v_refund, 'joker', v_joker, 'free_stars', v_stars);
end;
$$;

revoke all on function public.withdraw_tip(text) from public, anon;
grant execute on function public.withdraw_tip(text) to authenticated;

-- Löschen direkt aus dem Browser bleibt verboten (es gibt keine Lösch-Regel
-- auf public.tips); zurückgenommen wird nur über withdraw_tip().

-- ----------------------------------------------------------------------------
-- 2) Sofort-Abgleich zwischen Geräten (Supabase Realtime)
-- ----------------------------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table public.tips;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.profiles;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.joker_vorrat;
exception when duplicate_object then null;
end $$;
