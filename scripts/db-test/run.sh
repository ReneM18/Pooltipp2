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
