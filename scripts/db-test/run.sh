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
