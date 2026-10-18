#!/usr/bin/env bash
# Najważniejsze linie logu Gradle/gry jako adnotacje błędów GitHuba (najwyżej 10 na krok, po ok. 3000 znaków).
log="$1"
cut -c1-300 "$log" | grep -vE "^ALSA|^\s+at |Picked up JAVA_TOOL_OPTIONS|World loading finished" > short.txt
{
  grep -E "MIB-TEST|error:|warning: \[|What went wrong|^> |Caused by|Exception|AssertionError|Mixin|FAILED|Could not|cannot find|\[ERROR\]|/ERROR\]|/WARN\]" short.txt | head -120
  echo "----- miejsca w kodzie MiB (stos) -----"
  grep -E "^\s+at .*(pl\.mibclient|mib\$)" "$log" | cut -c1-200 | awk '!seen[$0]++' | head -15
  echo "----- skąd wyjątki (pierwsze linie stosu) -----"
  awk '/Caused by|Exception in thread|ExceptionInInitializerError/ { n = 4; print substr($0, 1, 200); next } n > 0 && /^[ \t]+at / { print substr($0, 1, 200); n-- }' "$log" | awk '!seen[$0]++' | head -40
  echo "----- ostatnie stany wczytywania świata -----"
  grep "World loading finished" "$log" | cut -c1-300 | tail -3
  echo "----- koniec logu -----"
  grep -vE "^\[Download|^ALSA" short.txt | tail -60
} > annot.txt
split -C 3000 annot.txt annot_part_
n=0
for f in annot_part_*; do
  n=$((n + 1)); [ "$n" -gt 10 ] && break
  msg=$(sed -e 's/%/%25/g' -e 's/\r/%0D/g' "$f" | awk 'BEGIN{ORS="%0A"} {print}')
  echo "::error title=log $n::$msg"
done
