#!/usr/bin/env bash
# Test für supabase/chat.sql auf einer frischen lokalen Test-Datenbank:
#   PGHOST=... PGPORT=... scripts/db-test/chat-test.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
export PGUSER="${PGUSER:-postgres}"
DB=pooltipp_chat_test
PGOPTIONS="-c client_min_messages=error" scripts/db-test/setup.sh "$DB" >/dev/null 2>&1
PGOPTIONS="-c client_min_messages=notice" psql -q -t -A -v ON_ERROR_STOP=1 -d "$DB" -f scripts/db-test/chat-test.sql 2>&1 \
  | grep -E "ok |FAIL|ERROR" | sed 's/^psql:[^ ]* NOTICE:  //'
