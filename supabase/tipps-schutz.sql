-- PoolTipp – Tipps anderer erst ab Tippschluss lesbar
-- Einmal im Supabase SQL Editor ausführen (beliebig oft wiederholbar).
--
-- Bisher gab die Datenbank jeden Tipp an jeden heraus ("Alle Tipps lesen"),
-- auch vor Tippschluss und ohne Login. Die App zeigte fremde Zahlen zwar erst
-- ab Tippschluss, im Browser konnte man sie aber mitlesen und abschreiben.
-- Jetzt:
--   * eigene Tipps sieht man immer,
--   * fremde Tipps erst ab Tippschluss (oder wenn das Spiel läuft, beendet
--     oder abgesagt ist),
--   * die Zahl "X getippt" und die Liste "Wer hat getippt?" (nur Namen)
--     kommen über eigene Funktionen, damit sie vor Tippschluss weiter stimmen.
-- Außerdem: Duell-Einladungen ablehnen geht nur noch mit Login.
-- Bestehende Tipps, Punkte und Coins werden nicht verändert.

begin;

-- Ist die Tippabgabe für dieses Spiel vorbei? Gelöschte Spiele zählen als
-- vorbei (ihre Tipps waren schon vorher sichtbar).
create or replace function public.tip_is_public(p_match_id text)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce((
    select m.data ->> 'status' in ('live', 'finished', 'cancelled')
        or coalesce(
             coalesce(public.try_timestamptz(m.data ->> 'tipDeadline'), public.try_timestamptz(m.data ->> 'kickoff')) <= now(),
             false
           )
    from public.matches m
    where m.id = p_match_id
  ), true);
$$;

drop policy if exists "Alle Tipps lesen" on public.tips;
drop policy if exists "Tipps lesen" on public.tips;
create policy "Tipps lesen" on public.tips
  for select using (auth.uid() = user_id or public.tip_is_public(match_id));

-- "X getippt" auf jeder Spielkarte: nur die Anzahl, keine Tipps.
create or replace function public.tip_counts()
returns table (match_id text, tips int)
language sql
stable
security definer set search_path = public
as $$
  select t.match_id, count(*)::int from public.tips t group by t.match_id;
$$;

-- "Wer hat getippt?": alle Namen, die Zahlen fremder Tipps erst ab Tippschluss.
create or replace function public.match_tippers(p_match_id text)
returns table (user_id uuid, predicted_home_score int, predicted_away_score int)
language sql
stable
security definer set search_path = public
as $$
  select t.user_id,
         case when v.open_tips or t.user_id = auth.uid() then t.predicted_home_score end,
         case when v.open_tips or t.user_id = auth.uid() then t.predicted_away_score end
  from public.tips t
  cross join (select public.tip_is_public(p_match_id) as open_tips) v
  where t.match_id = p_match_id;
$$;

-- Duell ablehnen: ohne Login war "auth.uid()" leer und die Prüfung lief durch.
create or replace function public.decline_duel(p_duel_id text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_duel record;
begin
  if auth.uid() is null then
    raise exception 'Bitte zuerst einloggen';
  end if;
  select * into v_duel from public.duels where id = p_duel_id for update;
  if not found then
    raise exception 'Duell nicht gefunden';
  end if;
  if v_duel.opponent_id is distinct from auth.uid() then
    raise exception 'Nur der Herausgeforderte kann ablehnen';
  end if;
  if v_duel.status <> 'pending' then
    raise exception 'Duell ist nicht mehr offen';
  end if;

  update public.duels set status = 'abgelehnt', resolved_at = now() where id = p_duel_id;
  update public.profiles set free_stars = free_stars + v_duel.stake, updated_at = now()
  where id = v_duel.challenger_id;
end;
$$;

revoke all on function public.tip_is_public(text) from public;
revoke all on function public.tip_counts() from public;
revoke all on function public.match_tippers(text) from public;
revoke all on function public.decline_duel(text) from public, anon;
grant execute on function public.tip_is_public(text) to anon, authenticated;
grant execute on function public.tip_counts() to anon, authenticated;
grant execute on function public.match_tippers(text) to anon, authenticated;
grant execute on function public.decline_duel(text) to authenticated;

commit;
