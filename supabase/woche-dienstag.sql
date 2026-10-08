-- ============================================================================
-- PoolTipp – Woche von Dienstag 8:00 bis Dienstag 8:00, gezählt nach Anpfiff
-- ============================================================================
-- Die Wochen-Rangliste und "Erster der Woche" (supabase/wochensieger.sql)
-- wechseln nicht mehr Montag 0:00, sondern Dienstag 8:00 mitteleuropäische
-- Zeit. Dann sind das NFL-Wochenende samt Monday Night Football (Anpfiff
-- Dienstag ~2:15) und die späten NBA-/NHL-Spiele aus Nordamerika (Anpfiff
-- spätestens ~4:30) schon angepfiffen, und vor 8:00 beginnt kein Spiel.
-- Ein Tipp zählt zur Woche, in der sein Spiel angepfiffen wird (nicht mehr
-- nach Abgabezeit). Wird ein Spiel verschoben, wandert der Tipp mit.
--
-- Auszahlung: frühestens Mittwoch 8:00 (ein Tag Puffer zum Auswerten). Sind
-- dann noch Tipps der Woche offen (Spiel noch nicht ausgewertet), wird
-- gewartet, höchstens bis Freitag 8:00; danach zählt, was ausgewertet ist.
-- Regeln sonst unverändert: nur Tipp-Punkte ohne Platz-Bonus, +50 XP für
-- den Ersten (alle bei Gleichstand), ab 3 Spielern, nur XP.
--
-- Voraussetzung: supabase/wochensieger.sql wurde ausgeführt.
-- Ausführen: Supabase -> SQL Editor -> New query -> alles einfügen -> Run.
-- Kann gefahrlos mehrfach ausgeführt werden.
-- ============================================================================

begin;

-- 1) Erste Woche: Dienstag 6.10.2026 statt Montag 5.10. (bisher wurde noch
--    keine Woche ausgezahlt).
update public.weekly_winner_settings set first_week = date '2026-10-06' where first_week = date '2026-10-05';
alter table public.weekly_winner_settings alter column first_week set default date '2026-10-06';
delete from public.weekly_winner_weeks w
where extract(isodow from w.week_start) <> 2
  and not exists (select 1 from public.weekly_winners x where x.week_start = w.week_start);

-- 2) Tipp-Punkte pro Spieler für Spiele, die im Zeitraum angepfiffen wurden.
--    Die App lädt damit auch die Wochen-Rangliste (nur Summen pro Spieler,
--    wie sie die Rangliste ohnehin zeigt).
create or replace function public.weekly_points(p_from timestamptz, p_to timestamptz)
returns table (user_id uuid, points int)
language sql
stable
security definer set search_path = public
as $$
  select t.user_id, sum(
    case when t.joker = 'schutz' and coalesce(t.base_points, t.rang_delta, 0) < 0 then 0
         else coalesce(t.base_points, t.rang_delta, 0) end
  )::int
  from public.tips t
  left join public.matches m on m.id = t.match_id
  where t.evaluated
    and not coalesce(t.ranking_legacy, false)
    and t.refunded_at is null
    and coalesce(public.try_timestamptz(m.data ->> 'kickoff'), t.submitted_at) >= p_from
    and coalesce(public.try_timestamptz(m.data ->> 'kickoff'), t.submitted_at) < p_to
  group by t.user_id;
$$;
revoke all on function public.weekly_points(timestamptz, timestamptz) from public;
grant execute on function public.weekly_points(timestamptz, timestamptz) to anon, authenticated;

-- 3) Auszahlen: Wochen ab Dienstag 8:00, nach Anpfiff.
create or replace function public.settle_weekly_winners()
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_set public.weekly_winner_settings%rowtype;
  v_week date;
  v_from timestamptz;
  v_to timestamptz;
  v_players int;
  v_top int;
  v_paid int := 0;
  v_rounds int := 0;
  v_winner record;
begin
  if auth.uid() is null then
    raise exception 'Nicht eingeloggt';
  end if;
  select * into v_set from public.weekly_winner_settings where id;
  if not found then
    return 0;
  end if;

  -- Ab der Woche nach der letzten erledigten (oder ab first_week), immer
  -- auf einen Dienstag ausgerichtet.
  v_week := greatest(v_set.first_week, coalesce((select max(week_start) + 7 from public.weekly_winner_weeks), date '2000-01-04'));
  v_week := v_week - ((extract(isodow from v_week)::int - 2 + 7) % 7);

  while v_rounds < 52 loop
    v_rounds := v_rounds + 1;
    v_from := (v_week + time '08:00') at time zone 'Europe/Vienna';
    v_to := (v_week + 7 + time '08:00') at time zone 'Europe/Vienna';
    -- Frühestens einen Tag nach Wochenende ...
    exit when now() < v_to + interval '1 day';
    -- ... und solange Spiele der Woche noch nicht ausgewertet sind, warten
    -- (höchstens drei Tage).
    exit when now() < v_to + interval '3 days' and exists (
      select 1 from public.tips t
      left join public.matches m on m.id = t.match_id
      where not t.evaluated
        and t.refunded_at is null
        and not coalesce(t.ranking_legacy, false)
        and coalesce(public.try_timestamptz(m.data ->> 'kickoff'), t.submitted_at) >= v_from
        and coalesce(public.try_timestamptz(m.data ->> 'kickoff'), t.submitted_at) < v_to
    );

    insert into public.weekly_winner_weeks (week_start) values (v_week)
    on conflict do nothing;
    if found then
      select count(*), max(w.points) into v_players, v_top from public.weekly_points(v_from, v_to) w;
      update public.weekly_winner_weeks set players = v_players, top_points = v_top where week_start = v_week;

      if v_players >= v_set.min_players and coalesce(v_top, 0) > 0 then
        for v_winner in select w.user_id from public.weekly_points(v_from, v_to) w where w.points = v_top loop
          insert into public.weekly_winners (week_start, user_id, points, players, xp)
          values (v_week, v_winner.user_id, v_top, v_players, v_set.xp)
          on conflict do nothing;
          if found then
            update public.profiles set pass_xp = pass_xp + v_set.xp, updated_at = now()
            where id = v_winner.user_id;
            perform public.claim_pass_rewards(v_winner.user_id);
            perform public.add_private_activity(
              v_winner.user_id, '🥇',
              'Erster der Woche (' || to_char(v_week, 'DD.MM.') || ' – ' || to_char(v_week + 7, 'DD.MM.')
                || ') mit ' || v_top || ' Punkten: +' || v_set.xp || ' Pass-XP!'
            );
            v_paid := v_paid + 1;
          end if;
        end loop;
      end if;
    end if;
    v_week := v_week + 7;
  end loop;
  return v_paid;
end;
$$;

revoke all on function public.settle_weekly_winners() from public, anon;
grant execute on function public.settle_weekly_winners() to authenticated;

commit;

-- Kontrolle: erste Woche (Dienstag) und noch keine Auszahlung
select first_week, min_players, xp, (select count(*) from public.weekly_winners) as sieger_bisher
from public.weekly_winner_settings;
