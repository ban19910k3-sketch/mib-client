#!/usr/bin/env bash
# Pakiety systemu na Linuksie w CI (od 0.47.3). apt-get update zwraca błąd już przy jednym niedostępnym źródle (reszta list
# i tak się odświeża), więc to tylko ostrzeżenie; instalowane są wyłącznie brakujące pakiety, do 3 prób, a powód błędu
# trafia do adnotacji przebiegu. Użycie: bash .github/workflows/apt.sh <pakiet>…
missing=()
for p in "$@"; do dpkg -s "$p" >/dev/null 2>&1 || missing+=("$p"); done
if [ ${#missing[@]} -eq 0 ]; then echo "Pakiety już są: $*"; exit 0; fi
why() { echo "$1" | grep -E '^(E|Err|W):' | head -3 | tr '\n' ' '; }
out=$(sudo apt-get update 2>&1) || echo "::warning::apt-get update z błędem, instaluję mimo to: $(why "$out")"
for i in 1 2 3; do
  out=$(sudo apt-get install -y "${missing[@]}" 2>&1) && { echo "Zainstalowano: ${missing[*]}"; exit 0; }
  echo "::warning::Instalacja ${missing[*]}, próba $i: $(why "$out")"
  sleep $((i * 20))
  sudo apt-get update >/dev/null 2>&1 || true
done
echo "::error::Nie udało się zainstalować: ${missing[*]} — $(why "$out")"
exit 1
