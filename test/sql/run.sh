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
# baza sprzed 0.33.0: czapki z modelem 3D podmienią się raz, inne zmiany z panelu admina zostają (sprawdza schema.test.sql)
$P -c "delete from private.migrations where id = 'czapki-0.33'; update public.cosmetics set texture = 'data:image/png;base64,c3RhcmE=' where id in ('zima_hat_mikolaj', 'zima_hat_balwan')"
$P -f ../../supabase/schema.sql   # drugi raz: plik musi być idempotentny
$P -f schema.test.sql
echo "ALL SQL TESTS PASSED"
