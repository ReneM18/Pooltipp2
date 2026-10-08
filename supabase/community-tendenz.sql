-- PoolTipp – Community-Tendenz auf der Spielkarte
-- Einmal im Supabase SQL Editor ausführen (beliebig oft wiederholbar).
--
-- Liefert pro Spiel nur die Anzahl der Tipps auf Heimsieg / Unentschieden /
-- Auswärtssieg, und zwar erst ab Tippschluss (tip_is_public aus
-- tipps-schutz.sql). Vorher bleibt die Verteilung geheim (dafür gibt es den
-- Trend-Joker). Einzelne Tipps oder Namen werden hier nicht herausgegeben.
-- Bestehende Tipps, Punkte und Coins werden nicht verändert.

begin;

create or replace function public.tip_tendencies()
returns table (match_id text, home int, draw int, away int)
language sql
stable
security definer set search_path = public
as $$
  select c.match_id, c.home, c.draw, c.away
  from (
    select t.match_id,
           count(*) filter (where t.predicted_home_score > t.predicted_away_score)::int as home,
           count(*) filter (where t.predicted_home_score = t.predicted_away_score)::int as draw,
           count(*) filter (where t.predicted_home_score < t.predicted_away_score)::int as away
    from public.tips t
    where t.predicted_home_score is not null
      and t.predicted_away_score is not null
    group by t.match_id
  ) c
  where public.tip_is_public(c.match_id);
$$;

grant execute on function public.tip_tendencies() to anon, authenticated;

commit;
