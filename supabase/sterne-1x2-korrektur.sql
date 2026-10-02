-- Korrigiert bereits ausgewertete 1X2-Tipps (Sieg / Unentschieden / Niederlage)
-- auf die neue Regel: richtig = Einsatz + 50 %, 6 Rangpunkte. Kein "exakt".
--
-- Was vorher falsch war:
--  a) Ein 1X2-Tipp wird intern als 1:0, 0:0 oder 0:1 gespeichert. Endete das
--     Spiel genau so, galt der Tipp als "exakt" (10 statt 6 Rangpunkte).
--  b) Ein richtiger 1X2-Tipp brachte nur +25 % Sterne statt jetzt +50 %.
--     Die Differenz wird nachgezahlt.
--
-- Darf beliebig oft ausgeführt werden: schon korrigierte Tipps werden nicht
-- nochmal angefasst.
--
-- Ausführen: vorher alle PoolTipp-Tabs schließen. Dann Supabase-Dashboard ->
-- SQL Editor -> New query -> dieses komplette Skript einfügen -> "Run".

with fix as (
  select t.id,
         t.user_id,
         m.data ->> 'sport' as sport,
         -- Rangpunkte: jeder richtige 1X2-Tipp zählt 6 ("exakt" gab 10)
         coalesce(t.rang_delta, 0) - 6 as rang_minus,
         -- Sterne: neuer Netto-Gewinn minus bisher gebuchter Netto-Gewinn
         (round(t.stake * 1.5)::int - t.stake) - coalesce(t.stars_delta, 0) as stars_plus
  from public.tips t
  join public.matches m on m.id = t.match_id
  where t.evaluated
    and m.data ->> 'tipMode' = '1x2'
    and t.result_tier in ('exakt', 'tendenz')
    and (t.result_tier = 'exakt'
         or coalesce(t.stars_delta, 0) <> round(t.stake * 1.5)::int - t.stake)
),
upd_tips as (
  update public.tips t
  set result_tier = 'tendenz',
      rang_delta = 6,
      stars_delta = round(t.stake * 1.5)::int - t.stake,
      narration = '👍 Richtig getippt – +6 Rangpunkte.',
      updated_at = now()
  from fix
  where t.id = fix.id
  returning t.id
),
per_user as (
  select user_id,
         sum(stars_plus) as stars_plus,
         sum(rang_minus) filter (where sport = 'Fußball') as fussball,
         sum(rang_minus) filter (where sport = 'NFL') as nfl,
         sum(rang_minus) filter (where sport = 'NBA') as nba,
         sum(rang_minus) filter (where sport = 'NHL') as nhl
  from fix
  group by user_id
)
update public.profiles p
set free_stars = greatest(0, p.free_stars + u.stars_plus),
    rang_punkte = coalesce(p.rang_punkte, '{}'::jsonb) || jsonb_build_object(
      'Fußball', greatest(0, coalesce((p.rang_punkte ->> 'Fußball')::int, 0) - coalesce(u.fussball, 0)),
      'NFL',     greatest(0, coalesce((p.rang_punkte ->> 'NFL')::int, 0) - coalesce(u.nfl, 0)),
      'NBA',     greatest(0, coalesce((p.rang_punkte ->> 'NBA')::int, 0) - coalesce(u.nba, 0)),
      'NHL',     greatest(0, coalesce((p.rang_punkte ->> 'NHL')::int, 0) - coalesce(u.nhl, 0))
    ),
    updated_at = now()
from per_user u
where p.id = u.user_id;

-- Kontrolle: alle ausgewerteten 1X2-Tipps nach der Korrektur
-- (erscheint unten als Tabelle; leer = es gab noch keine).
select p.display_name,
       m.data ->> 'sport' as sportart,
       t.stake as einsatz,
       t.result_tier as ergebnis,
       t.stars_delta as sterne_netto,
       t.rang_delta as rangpunkte
from public.tips t
join public.matches m on m.id = t.match_id
join public.profiles p on p.id = t.user_id
where t.evaluated and m.data ->> 'tipMode' = '1x2'
order by p.display_name, t.submitted_at;
