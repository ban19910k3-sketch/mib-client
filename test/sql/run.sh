#!/usr/bin/env bash
# Sprawdza supabase/schema.sql na lokalnym Postgresie z atrapą Supabase.
# Wymaga działającego serwera Postgres i psql z prawami superużytkownika (zmienne PG* jak zwykle).
set -euo pipefail
export PGOPTIONS="-c client_min_messages=warning"
cd "$(dirname "$0")"
DB="mib_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
P="psql -X -q -o /dev/null -v ON_ERROR_STOP=1 -d $DB"
$P -f stub-auth.sql
$P -f ../../supabase/schema.sql
$P -f ../../supabase/schema.sql   # drugi raz: plik musi być idempotentny
$P -f schema.test.sql
echo "ALL SQL TESTS PASSED"
