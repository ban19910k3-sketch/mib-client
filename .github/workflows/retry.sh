#!/usr/bin/env bash
# Polecenie z ponowieniami po chwilowych błędach sieci (serwery Mavena, npm, GitHub): do 4 prób, przerwy 20 s, 60 s
# i 120 s. Numer próby (0–3) jest w MIB_TRY — np. Gradle od drugiej próby pobiera biblioteki od nowa.
# Użycie: bash .github/workflows/retry.sh <polecenie> [argumenty…]
waits=(20 60 120)
for i in 0 1 2 3; do
  MIB_TRY=$i "$@" && exit 0
  [ "$i" -lt 3 ] || break
  echo "::warning::Próba $((i + 1)) nieudana, ponawiam za ${waits[$i]} s: $*"
  sleep "${waits[$i]}"
done
echo "::error::Nie udało się po 4 próbach: $*"
exit 1
