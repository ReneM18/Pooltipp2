-- Rangpunkte aller Spieler neu berechnen – nach der neuen, einfachen Regel:
--   Exakt getroffen = 10, Tendenz richtig = 6, daneben = 0.
-- Früher wurde zusätzlich mit erfundenen "Gegnern" und dem eigenen
-- Punktestand gerechnet; dadurch bekamen gleiche Tipps verschieden viele
-- Punkte. Dieses Skript rechnet alle bereits ausgewerteten Tipps nach der
-- neuen Regel um und setzt die Rangpunkte jedes Spielers auf die Summe
-- seiner Tipps (pro Sportart). Alte Demo-Rangpunkte verschwinden dabei.
--
-- Sterne, Saison-Pass-XP und die Tipps selbst bleiben unverändert.
-- Darf beliebig oft ausgeführt werden – das Ergebnis ist immer gleich.
--
-- Ausführen: vorher alle PoolTipp-Tabs schließen. Dann Supabase-Dashboard ->
-- SQL Editor -> New query -> dieses komplette Skript einfügen -> "Run".

-- 1) Punkte jedes ausgewerteten Tipps nach der neuen Regel.
--    beat_percent (das alte, simulierte "gegen X %") wird geleert.
update public.tips
set rang_delta = case result_tier
                   when 'exakt' then 10
                   when 'tendenz' then 6
                   else 0
                 end,
    beat_percent = null
where evaluated and result_tier is not null;

-- 2) Rangpunkte jedes Spielers = Summe seiner Tipp-Punkte je Sportart.
--    Die Sportart kommt aus dem Spiel (Tabelle matches).
update public.profiles p
set rang_punkte = jsonb_build_object(
      'Fußball', coalesce(s.fussball, 0),
      'NFL', coalesce(s.nfl, 0),
      'NBA', coalesce(s.nba, 0),
      'NHL', coalesce(s.nhl, 0)
    ),
    updated_at = now()
from (
  select pr.id as user_id,
         sum(t.rang_delta) filter (where m.data->>'sport' = 'Fußball') as fussball,
         sum(t.rang_delta) filter (where m.data->>'sport' = 'NFL') as nfl,
         sum(t.rang_delta) filter (where m.data->>'sport' = 'NBA') as nba,
         sum(t.rang_delta) filter (where m.data->>'sport' = 'NHL') as nhl
  from public.profiles pr
  left join public.tips t on t.user_id = pr.id and t.evaluated
  left join public.matches m on m.id = t.match_id
  group by pr.id
) s
where s.user_id = p.id;

-- 3) Kontrolle: neue Rangpunkte aller Spieler (erscheint unten als Tabelle).
select display_name,
       rang_punkte,
       (select count(*) from public.tips t where t.user_id = p.id and t.evaluated) as ausgewertete_tipps
from public.profiles p
order by display_name;
