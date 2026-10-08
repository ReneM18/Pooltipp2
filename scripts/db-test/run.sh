#!/usr/bin/env bash
# Komplett-Test der serverseitigen Auswertung auf einer lokalen Test-Datenbank:
#   PGHOST=... PGPORT=... scripts/db-test/run.sh
# Mit WITH_SAISON=1 wird vorher auch supabase/saisonwechsel.sql eingespielt.
set -euo pipefail
cd "$(dirname "$0")/../.."
export PGUSER="${PGUSER:-postgres}" PGOPTIONS="${PGOPTIONS:--c client_min_messages=notice}"
DB=pooltipp_test
PGOPTIONS="-c client_min_messages=error" scripts/db-test/setup.sh "$DB" >/dev/null 2>&1
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f scripts/db-test/legacy-fixture.sql >/dev/null
PGOPTIONS="-c client_min_messages=warning" psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/auswertung-server.sql >/dev/null
psql -q -t -A -v ON_ERROR_STOP=1 -d "$DB" -f scripts/db-test/auswertung-test.sql 2>&1 | grep -v "^$" | sed 's/^psql:[^ ]* NOTICE:  //'
psql -q -t -A -v ON_ERROR_STOP=1 -d "$DB" -f scripts/db-test/booster-test.sql 2>&1 | grep -v "^$" | sed 's/^psql:[^ ]* NOTICE:  //'
psql -q -t -A -v ON_ERROR_STOP=1 -d "$DB" -f scripts/db-test/duelle-test.sql 2>&1 | grep -v "^$" | sed 's/^psql:[^ ]* NOTICE:  //'

# Übernahme-Schutz: Würde die Übernahme Rangpunkte ändern, bricht das Skript
# ab und es bleibt alles wie vorher.
q() { psql -q -t -A -v ON_ERROR_STOP=1 -d "$DB" -c "$1"; }
q "update public.scoring_settings set migrated_at = null;
   create or replace function t.sabotage() returns trigger language plpgsql as \$\$
   begin update public.profiles set rang_punkte = '{\"Fußball\": 1}' where id = new.user_id; return new; end \$\$;
   create trigger sabotage after update on public.tips for each row execute function t.sabotage();"
before=$(q "select md5(string_agg(id || coalesce(rang_punkte::text, ''), ',' order by id)) from public.profiles")
if PGOPTIONS="-c client_min_messages=error" psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/duelle-punkte.sql >/dev/null 2>&1; then
  echo "FAIL Ü1 Übernahme hätte abbrechen müssen"; exit 1
fi
after=$(q "select md5(string_agg(id || coalesce(rang_punkte::text, ''), ',' order by id)) from public.profiles")
[ "$before" = "$after" ] && echo "ok   Ü1 Abbruch: Rangpunkte unverändert" || { echo "FAIL Ü1 Rangpunkte geändert"; exit 1; }
[ "$(q "select migrated_at is null from public.scoring_settings")" = "t" ] && echo "ok   Ü2 Abbruch: nichts gespeichert" || { echo "FAIL Ü2"; exit 1; }
q "drop trigger sabotage on public.tips; update public.scoring_settings set migrated_at = now();"
echo ÜBERNAHME-SCHUTZ GRÜN

# Rankingsystem (neue Auswertung, Strafe, Neustart der Rangpunkte)
psql -q -t -A -v ON_ERROR_STOP=1 -d "$DB" -f scripts/db-test/rankingsystem-test.sql 2>&1 | grep -v "^$" | sed 's/^psql:[^ ]* NOTICE:  //'

# Joker-Shop (kaufen, einsetzen, Schalter)
psql -q -t -A -v ON_ERROR_STOP=1 -d "$DB" -f scripts/db-test/joker-shop-test.sql 2>&1 | grep -v "^$" | sed 's/^psql:[^ ]* NOTICE:  //'

# Handball als neue Tipp-Sportart
psql -q -t -A -v ON_ERROR_STOP=1 -d "$DB" -f scripts/db-test/handball-test.sql 2>&1 | grep -v "^$" | sed 's/^psql:[^ ]* NOTICE:  //'

# Schnellere Auswertung bei vielen Tippern
psql -q -t -A -v ON_ERROR_STOP=1 -d "$DB" -f scripts/db-test/tempo-test.sql 2>&1 | grep -v "^$" | sed 's/^psql:[^ ]* NOTICE:  //'

# Feinschliff: Toleranz-Joker, neue Spieler, Text bei "nie unter 0"
psql -q -t -A -v ON_ERROR_STOP=1 -d "$DB" -f scripts/db-test/feinschliff-test.sql 2>&1 | grep -v "^$" | sed 's/^psql:[^ ]* NOTICE:  //'

# "Ändern" nimmt den Tipp zurück (Coins/Joker zurück), Sofort-Abgleich
psql -q -t -A -v ON_ERROR_STOP=1 -d "$DB" -f scripts/db-test/tipp-zuruecknehmen-test.sql 2>&1 | grep -v "^$" | sed 's/^psql:[^ ]* NOTICE:  //'

# Einstellungen auf jedem Gerät (Saison-Design-Schalter, Sofort-Abgleich)
psql -q -t -A -v ON_ERROR_STOP=1 -d "$DB" -f scripts/db-test/profil-sync-test.sql 2>&1 | grep -v "^$" | sed 's/^psql:[^ ]* NOTICE:  //'

# Saison-Pass gibt nie Coins
psql -q -t -A -v ON_ERROR_STOP=1 -d "$DB" -f scripts/db-test/pass-ohne-coins-test.sql 2>&1 | grep -v "^$" | sed 's/^psql:[^ ]* NOTICE:  //'

# Dranbleiben: Serien-Schutz, Start-Erlebnis und Wochenrückblick fürs Konto
psql -q -t -A -v ON_ERROR_STOP=1 -d "$DB" -f scripts/db-test/dranbleiben-test.sql 2>&1 | grep -v "^$" | sed 's/^psql:[^ ]* NOTICE:  //'

# Trainingstaschen: Kauf, Auslosung auf dem Server, Booster-Gutscheine
psql -q -t -A -v ON_ERROR_STOP=1 -d "$DB" -f scripts/db-test/trainingstaschen-test.sql 2>&1 | grep -v "^$" | sed 's/^psql:[^ ]* NOTICE:  //'

# Duelle mit bis zu 5 Spielern und mehreren Spielen, Schutz gegen Absprachen
psql -q -t -A -v ON_ERROR_STOP=1 -d "$DB" -f scripts/db-test/duelle-gruppen-test.sql 2>&1 | grep -v "^$" | sed 's/^psql:[^ ]* NOTICE:  //'

# Prestige: GOAT freiwillig auf 0, Prestige-Stern, Bonus zählt weiter "oben"
psql -q -t -A -v ON_ERROR_STOP=1 -d "$DB" -f scripts/db-test/prestige-test.sql 2>&1 | grep -v "^$" | sed 's/^psql:[^ ]* NOTICE:  //'

# Erster der Woche bekommt Saison-XP (nie Coins), jede Woche nur einmal
psql -q -t -A -v ON_ERROR_STOP=1 -d "$DB" -f scripts/db-test/wochensieger-test.sql 2>&1 | grep -v "^$" | sed 's/^psql:[^ ]* NOTICE:  //'
