#!/usr/bin/env bash
# Spielt auswertung-server.sql (in zwei Teilen wie im SQL Editor) auf einen
# Nachbau von Renes Live-Stand und zeigt, was sich bei den Spielern ändert:
#   PGHOST=... PGPORT=... scripts/db-test/renes-stand.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
export PGUSER="${PGUSER:-postgres}"
DB=pooltipp_renes_stand
tmp=$(mktemp -d)
SCRIPTS="profiles tips social-features fixes-features40 fix-rechte-tabellen tipprunden vereinswertung saisonwechsel" \
  PGOPTIONS="-c client_min_messages=error" scripts/db-test/setup.sh "$DB" >/dev/null 2>&1
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f scripts/db-test/renes-stand.sql >/dev/null
scripts/db-test/split.sh "$tmp" >/dev/null

q() { psql -q -t -A -v ON_ERROR_STOP=1 -d "$DB" -c "$1"; }
q "create schema vorher;
   create table vorher.zeilen as
     select table_name::text as tabelle, (xpath('/row/n/text()', query_to_xml('select count(*) as n from public.' || table_name, false, true, '')))[1]::text::int as n
     from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE';
   create table vorher.tips as select * from public.tips;
   create table vorher.profile as select id, display_name, free_stars, rang_punkte, pass_xp from public.profiles;
   create table vorher.duels as select * from public.duels;"

for teil in teil1 teil2; do
  PGOPTIONS="-c client_min_messages=error" psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$tmp/$teil.sql" >/dev/null
done
echo "Zweiter Lauf (darf nichts ändern):"
q "create table vorher.profile2 as select id, free_stars, rang_punkte, pass_xp from public.profiles"
for teil in teil1 teil2; do
  PGOPTIONS="-c client_min_messages=error" psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$tmp/$teil.sql" >/dev/null
done
q "select '  geänderte Profile: ' || count(*) from (select id, free_stars, rang_punkte, pass_xp from public.profiles except select * from vorher.profile2) x"

echo "Zeilen pro Tabelle (vorher -> nachher, nur Unterschiede):"
q "select '  ' || v.tabelle || ': ' || v.n || ' -> ' || n.n from vorher.zeilen v
   cross join lateral (select (xpath('/row/n/text()', query_to_xml('select count(*) as n from public.' || v.tabelle, false, true, '')))[1]::text::int as n) n
   where v.n <> n.n order by 1"
q "select '  Tipps mit geändertem Inhalt (Ergebnis, Einsatz, Spiel, Spieler): ' || count(*) from public.tips t join vorher.tips s using (id)
   where (t.user_id, t.match_id, t.predicted_home_score, t.predicted_away_score, t.stake) is distinct from
         (s.user_id, s.match_id, s.predicted_home_score, s.predicted_away_score, s.stake)"
echo "Spieler (vorher -> nachher):"
q "select '  ' || s.display_name || ': Sterne ' || s.free_stars || ' -> ' || p.free_stars
          || ', Rangpunkte ' || s.rang_punkte::text || ' -> ' || p.rang_punkte::text
          || ', XP ' || s.pass_xp || ' -> ' || p.pass_xp
   from vorher.profile s join public.profiles p using (id) order by 1"
echo "Tipps (vorher -> nachher):"
q "select '  ' || t.id || ': ' || coalesce(s.result_tier, 'offen') || '/' || coalesce(s.stars_delta::text, '-') || '/' || coalesce(s.rang_delta::text, '-')
          || ' -> ' || coalesce(t.result_tier, 'offen') || '/' || coalesce(t.stars_delta::text, '-') || '/' || coalesce(t.rang_delta::text, '-')
   from public.tips t join vorher.tips s using (id) order by 1"
echo "Duelle (vorher -> nachher):"
q "select '  ' || d.id || ': ' || s.status || ' -> ' || d.status from public.duels d join vorher.duels s using (id) order by 1"
rm -rf "$tmp"
