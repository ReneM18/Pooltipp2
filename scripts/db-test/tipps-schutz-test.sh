#!/usr/bin/env bash
# Test für supabase/tipps-schutz.sql auf einer frischen lokalen Test-Datenbank
# (alle bisherigen SQL-Skripte, dann tipps-schutz.sql zweimal):
#   PGHOST=... PGPORT=... scripts/db-test/tipps-schutz-test.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
export PGUSER="${PGUSER:-postgres}"
DB=pooltipp_tipps_schutz_test
WITH_SAISON=1 PGOPTIONS="-c client_min_messages=error" scripts/db-test/setup.sh "$DB" >/dev/null 2>&1
for f in auswertung-server konto-loeschen booster chat duelle-punkte rang-icon-auswahl rankingsystem rankingsystem-neustart \
         joker-shop handball rankingsystem-tempo rankingsystem-feinschliff tipp-zuruecknehmen profil-sync tipps-schutz tipps-schutz; do
  PGOPTIONS="-c client_min_messages=error" psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "supabase/$f.sql" >/dev/null
done
PGOPTIONS="-c client_min_messages=notice" psql -q -t -A -v ON_ERROR_STOP=1 -d "$DB" -f scripts/db-test/tipps-schutz-test.sql 2>&1 \
  | grep -E "ok |FAIL|ERROR" | sed 's/^psql:[^ ]* NOTICE:  //'
