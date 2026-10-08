-- ============================================================================
-- PoolTipp – Erster der Woche bekommt Saison-XP
-- ============================================================================
-- Wer in einer Woche (Montag 0:00 bis Sonntag, österreichische Zeit) die
-- meisten Tipp-Punkte gemacht hat, egal in welcher Sportart, bekommt +50
-- Saison-XP für den Pass. Gezählt wird genau wie im Ranglisten-Reiter
-- "Woche": alle ausgewerteten Tipps, die in der Woche abgegeben wurden, nur
-- mit ihren Tipp-Punkten (exakt +10, Tordifferenz +7, Tendenz +5, falsch -3,
-- 1X2 +5/-3, mit Joker) OHNE Platz-Bonus. Schutz-Joker: kein Minus.
--   - Gleichstand: alle Erstplatzierten bekommen die XP.
--   - Nur wenn mindestens 3 Spieler in der Woche Punkte hatten und der Erste
--     mehr als 0 Punkte hat.
--   - Ausgezahlt wird ab Dienstag 00:00 (ein Tag Puffer, damit auch die
--     Sonntagabend-Spiele schon ausgewertet sind), beim ersten Öffnen der
--     App durch irgendeinen Spieler. Jede Woche nur einmal, nie doppelt.
--   - Es gibt NUR XP, nie Coins, Joker oder Gutscheine.
-- Werte ändern (SQL Editor), z. B. in der Testphase schon ab 1 Spieler:
--   update public.weekly_winner_settings set min_players = 1;
--
-- Ausführen: Supabase -> SQL Editor -> New query -> alles einfügen -> Run.
-- Kann gefahrlos mehrfach ausgeführt werden.
-- ============================================================================

begin;

-- 1) Einstellungen (eine Zeile)
create table if not exists public.weekly_winner_settings (
  id boolean primary key default true check (id),
  xp int not null default 50,
  min_players int not null default 3,
  -- Erste Woche, die zählt (Montag). Frühere Wochen werden nie ausgezahlt.
  first_week date not null default date '2026-10-05'
);
insert into public.weekly_winner_settings (id) values (true) on conflict do nothing;
alter table public.weekly_winner_settings enable row level security;
drop policy if exists "Wochensieger-Regeln lesen" on public.weekly_winner_settings;
create policy "Wochensieger-Regeln lesen" on public.weekly_winner_settings for select using (true);
revoke all on public.weekly_winner_settings from anon, authenticated;
grant select on public.weekly_winner_settings to anon, authenticated;

-- 2) Erledigte Wochen (auch Wochen ohne Sieger, damit nichts doppelt läuft)
create table if not exists public.weekly_winner_weeks (
  week_start date primary key,
  players int not null default 0,
  top_points int,
  settled_at timestamptz not null default now()
);
alter table public.weekly_winner_weeks enable row level security;
drop policy if exists "Wochen lesen" on public.weekly_winner_weeks;
create policy "Wochen lesen" on public.weekly_winner_weeks for select using (true);
revoke all on public.weekly_winner_weeks from anon, authenticated;
grant select on public.weekly_winner_weeks to authenticated;

-- 3) Sieger pro Woche
create table if not exists public.weekly_winners (
  week_start date not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  points int not null,
  players int not null,
  xp int not null,
  created_at timestamptz not null default now(),
  primary key (week_start, user_id)
);
alter table public.weekly_winners enable row level security;
drop policy if exists "Wochensieger lesen" on public.weekly_winners;
create policy "Wochensieger lesen" on public.weekly_winners for select to authenticated using (true);
revoke all on public.weekly_winners from anon, authenticated;
grant select on public.weekly_winners to authenticated;

-- 4) Tipp-Punkte pro Spieler in einem Zeitraum, wie im Reiter "Woche"
--    (lib/weeklyLeaderboard.ts weeklyTipPoints): ausgewertete Tipps nach
--    Abgabezeit, nur Treffer-Punkte ohne Platz-Bonus.
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
  where t.evaluated
    and not coalesce(t.ranking_legacy, false)
    and t.refunded_at is null
    and t.submitted_at >= p_from and t.submitted_at < p_to
  group by t.user_id;
$$;
revoke all on function public.weekly_points(timestamptz, timestamptz) from public, anon, authenticated;

-- 5) Auszahlen: geht alle abgeschlossenen, noch offenen Wochen durch.
--    Darf jeder eingeloggte Spieler aufrufen (die App macht das beim Öffnen);
--    die Sperre auf weekly_winner_weeks sorgt dafür, dass jede Woche nur
--    einmal ausgezahlt wird, auch bei vielen gleichzeitigen Aufrufen.
create or replace function public.settle_weekly_winners()
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_set public.weekly_winner_settings%rowtype;
  v_now_local timestamp := now() at time zone 'Europe/Vienna';
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

  -- Ab der Woche nach der letzten erledigten (oder ab first_week).
  v_week := greatest(
    v_set.first_week - (extract(isodow from v_set.first_week)::int - 1),
    coalesce((select max(week_start) + 7 from public.weekly_winner_weeks), date '2000-01-03')
  );
  -- Woche ist fertig, sobald ihr Dienstag 00:00 (nach der Woche) erreicht ist.
  while (v_week + 8)::timestamp <= v_now_local and v_rounds < 52 loop
    v_rounds := v_rounds + 1;
    insert into public.weekly_winner_weeks (week_start) values (v_week)
    on conflict do nothing;
    if found then
      v_from := v_week::timestamp at time zone 'Europe/Vienna';
      v_to := (v_week + 7)::timestamp at time zone 'Europe/Vienna';

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
              'Erster der Woche (' || to_char(v_week, 'DD.MM.') || ' – ' || to_char(v_week + 6, 'DD.MM.')
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

-- 6) Sofort-Abgleich: Sieger-Hinweis erscheint auf allen offenen Geräten
do $$ begin
  alter publication supabase_realtime add table public.weekly_winners;
exception when duplicate_object then null;
end $$;

commit;

-- Kontrolle
select xp, min_players, first_week from public.weekly_winner_settings;
