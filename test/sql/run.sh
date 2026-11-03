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
# baza z 0.34.0: nowe modele Plecaka-misia i Domku z piernika podmienią się raz, inne plecaki zostają
$P -c "delete from private.migrations where id = 'tekstury-0.35'; update public.cosmetics set texture = 'data:image/png;base64,c3RhcmE=' where id in ('back_mis', 'zima_back_piernik', 'back_mib')"
$P -f ../../supabase/schema.sql   # drugi raz: plik musi być idempotentny
$P -f schema.test.sql
echo "ALL SQL TESTS PASSED"
