-- ============================================================================
-- PoolTipp – Sportlerkarte pro Sportart (Rene, 20.10.2026)
-- ============================================================================
-- Die Karte beweist, dass man sich in einer Sportart auskennt. Darum gibt es
-- sie pro Sportart, mit Rang-Abzeichen, Platz und Rangpunkten dieser
-- Sportart und auf der Rückseite der Tipp-Statistik dieser Sportart.
--
-- sport_card_stats(p_user) liefert je Sportart:
--   points, place, prestige  – wie in der Rangliste (die ist ohnehin öffentlich)
--   tips, evaluated, exakt, richtig, first_tip, last_tip (Zeitraum der
--     Statistik, Rene: "von wann bis wann") – NUR wenn der Betrachter die Statistik
--     sehen darf (Einstellung "Wer sieht meine Statistik", stats_visible aus
--     supabase/rivalen.sql), sonst leer.
--
-- Die Funktion gibt es neu; wurde sie schon mit anderen Spalten angelegt,
-- muss sie vorher gelöscht werden (darum das drop).
--
-- Ausführen: Supabase-Dashboard -> SQL Editor -> New query -> dieses
-- komplette Skript einfügen -> "Run". Darf mehrfach ausgeführt werden.
-- Ändert keine Daten, legt nur eine Abfrage-Funktion an.
-- ============================================================================

drop function if exists public.sport_card_stats(uuid);
create or replace function public.sport_card_stats(p_user uuid)
returns table (
  sport text,
  points int,
  place int,
  prestige int,
  tips int,
  evaluated int,
  exakt int,
  richtig int,
  first_tip timestamptz,
  last_tip timestamptz
)
language plpgsql
stable
security definer set search_path = public
as $$
#variable_conflict use_column
declare
  v_show boolean := public.stats_visible(auth.uid(), p_user);
begin
  return query
  with rp as (
    select e.k as s, round((e.v #>> '{}')::numeric)::int as pts
    from public.profiles p,
         jsonb_each(case when jsonb_typeof(p.rang_punkte) = 'object' then p.rang_punkte else '{}'::jsonb end) as e(k, v)
    where p.id = p_user and jsonb_typeof(e.v) = 'number'
  ),
  pr as (
    select e.k as s, round((e.v #>> '{}')::numeric)::int as lvl
    from public.profiles p,
         jsonb_each(case when jsonb_typeof(p.prestige) = 'object' then p.prestige else '{}'::jsonb end) as e(k, v)
    where p.id = p_user and jsonb_typeof(e.v) = 'number'
  ),
  ts as (
    select m.data ->> 'sport' as s,
           count(*)::int as n_tips,
           count(*) filter (where t.evaluated and t.result_tier is not null)::int as n_eval,
           count(*) filter (where t.evaluated and t.result_tier = 'exakt')::int as n_exakt,
           count(*) filter (where t.evaluated and t.result_tier in ('exakt', 'differenz', 'tendenz'))::int as n_richtig,
           min(t.submitted_at) as d_first,
           max(t.submitted_at) as d_last
    from public.tips t
    join public.matches m on m.id = t.match_id
    where t.user_id = p_user and t.refunded_at is null and not coalesce(t.ranking_legacy, false)
    group by 1
  ),
  sp as (
    select rp.s from rp
    union
    select ts.s from ts where ts.s is not null
  )
  select
    sp.s,
    coalesce(rp.pts, 0),
    case
      when coalesce(rp.pts, 0) > 0 then 1 + (
        select count(*)::int from public.profiles o
        where jsonb_typeof(o.rang_punkte -> sp.s) = 'number'
          and (o.rang_punkte ->> sp.s)::numeric > rp.pts
      )
    end,
    coalesce(pr.lvl, 0),
    case when v_show then coalesce(ts.n_tips, 0) end,
    case when v_show then coalesce(ts.n_eval, 0) end,
    case when v_show then coalesce(ts.n_exakt, 0) end,
    case when v_show then coalesce(ts.n_richtig, 0) end,
    case when v_show then ts.d_first end,
    case when v_show then ts.d_last end
  from sp
  left join rp on rp.s = sp.s
  left join pr on pr.s = sp.s
  left join ts on ts.s = sp.s;
end;
$$;

revoke all on function public.sport_card_stats(uuid) from public, anon;
grant execute on function public.sport_card_stats(uuid) to authenticated;

-- Kontrolle: eigene Werte pro Sportart (im SQL Editor ohne Login leer).
select 'sport_card_stats angelegt' as status;
