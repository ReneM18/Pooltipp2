-- PoolTipp – Community-Tendenz auf der Spielkarte
-- Einmal im Supabase SQL Editor ausführen (beliebig oft wiederholbar).
-- Steht für sich allein (braucht kein anderes SQL vorher).
--
-- Liefert pro Spiel nur die Anzahl der Tipps auf Heimsieg / Unentschieden /
-- Auswärtssieg, und zwar erst ab Tippschluss (oder wenn das Spiel läuft,
-- beendet oder abgesagt ist). Vorher bleibt die Verteilung geheim (dafür gibt
-- es den Trend-Joker). Einzelne Tipps oder Namen werden nicht herausgegeben.
-- Bestehende Tipps, Punkte und Coins werden nicht verändert.

begin;

-- Zeitangabe aus den Spieldaten sicher lesen (kaputter Text -> leer statt Fehler).
create or replace function public.tendency_ts(p_text text)
returns timestamptz
language plpgsql
immutable
as $$
begin
  return p_text::timestamptz;
exception when others then
  return null;
end;
$$;

create or replace function public.tip_tendencies()
returns table (match_id text, home int, draw int, away int)
language sql
stable
security definer set search_path = public
as $$
  select t.match_id,
         count(*) filter (where t.predicted_home_score > t.predicted_away_score)::int,
         count(*) filter (where t.predicted_home_score = t.predicted_away_score)::int,
         count(*) filter (where t.predicted_home_score < t.predicted_away_score)::int
  from public.tips t
  join public.matches m on m.id = t.match_id
  where t.predicted_home_score is not null
    and t.predicted_away_score is not null
    and (
      m.data ->> 'status' in ('live', 'finished', 'cancelled')
      or coalesce(public.tendency_ts(m.data ->> 'tipDeadline'), public.tendency_ts(m.data ->> 'kickoff')) <= now()
    )
  group by t.match_id;
$$;

grant execute on function public.tendency_ts(text) to anon, authenticated;
grant execute on function public.tip_tendencies() to anon, authenticated;

commit;
