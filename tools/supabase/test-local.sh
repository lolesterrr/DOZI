#!/usr/bin/env bash
# Checks the Supabase migrations and RLS tests on a plain local PostgreSQL (with pgTAP), without
# Docker or a Supabase account. Used by cloud sessions; the developer runs the same tests against
# the real project instead (docs/SETUP.md Part D).
#
#   PGHOST=/var/run/postgresql PGUSER=postgres tools/supabase/test-local.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DB="${DOZI_TEST_DB:-dozi_supabase_test}"
PSQL=(psql -X -q -v ON_ERROR_STOP=1)

"${PSQL[@]}" -d postgres -c "drop database if exists $DB" -c "create database $DB"
"${PSQL[@]}" -d "$DB" -f "$ROOT/tools/supabase/stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "migration: $(basename "$f")"
  "${PSQL[@]}" -d "$DB" -f "$f"
done

status=0
for f in "$ROOT"/supabase/tests/database/*.sql; do
  echo "test: $(basename "$f")"
  out="$("${PSQL[@]}" -d "$DB" -t -A -f "$f" 2>&1)" || status=1
  echo "$out" | grep -E '^(not ok|ok|#|1\.\.|psql)' || true
  if echo "$out" | grep -q '^not ok'; then status=1; fi
done
"${PSQL[@]}" -d postgres -c "drop database $DB"
exit $status
