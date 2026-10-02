#!/usr/bin/env bash
# Teilt supabase/auswertung-server.sql für den Supabase SQL Editor in zwei
# Teile (jeder läuft für sich als ein Block): split.sh <ausgabe-ordner>
set -euo pipefail
cd "$(dirname "$0")/../.."
out="${1:?Ausgabe-Ordner fehlt}"
f=supabase/auswertung-server.sql
n=$(grep -n '^-- ===== TEIL 2 =====$' "$f" | cut -d: -f1)
{ echo "-- PoolTipp – Auswertung auf dem Server, TEIL 1 von 2 (danach Teil 2 ausführen)"
  head -n $((n - 1)) "$f"; echo "commit;"; } > "$out/teil1.sql"
{ echo "-- PoolTipp – Auswertung auf dem Server, TEIL 2 von 2 (erst nach Teil 1 ausführen)"
  echo "begin;"; tail -n +"$n" "$f"; } > "$out/teil2.sql"
wc -c "$out"/teil1.sql "$out"/teil2.sql
