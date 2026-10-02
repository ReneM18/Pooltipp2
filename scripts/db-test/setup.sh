#!/usr/bin/env bash
# Baut eine frische Test-Datenbank: Supabase-Nachbau + alle bisherigen
# SQL-Skripte in der Reihenfolge, in der sie live ausgeführt wurden.
# Aufruf: PGHOST=... PGPORT=... scripts/db-test/setup.sh [db-name]
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="${1:-pooltipp_test}"
export PGUSER="${PGUSER:-postgres}"
psql -q -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB"
run() { psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1" >/dev/null; }
# Rollen gibt es pro Cluster nur einmal.
psql -q -d postgres -tc "select 1 from pg_roles where rolname='anon'" | grep -q 1 \
  && sed '/^create role/d' scripts/db-test/supabase-stub.sql | psql -q -v ON_ERROR_STOP=1 -d "$DB" >/dev/null \
  || run scripts/db-test/supabase-stub.sql
for f in ${SCRIPTS:-profiles tips social-features fixes-features40 fix-rechte-tabellen tipprunden vereinswertung \
         profil-extras freunde rangpunkte-neu-berechnen sterne-1x2-korrektur spiel-absagen ${WITH_SAISON:+saisonwechsel}}; do
  run "supabase/$f.sql"
done
echo "Test-Datenbank $DB mit dem bisherigen Live-Stand angelegt."
