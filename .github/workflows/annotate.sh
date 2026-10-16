#!/usr/bin/env bash
# Najważniejsze linie logu Gradle/gry jako adnotacje błędów GitHuba (najwyżej 10 na krok, po ok. 3000 znaków).
log="$1"
grep -E "error:|warning: \[|What went wrong|^> |Caused by|Exception|AssertionError|Mixin|FAILED|Could not|cannot find|\[ERROR\]|/ERROR\]" "$log" \
  | grep -vE "^\s+at |Picked up JAVA_TOOL_OPTIONS" | head -200 > annot.txt || true
[ -s annot.txt ] || tail -60 "$log" > annot.txt
split -C 3000 annot.txt annot_part_
n=0
for f in annot_part_*; do
  n=$((n + 1)); [ "$n" -gt 10 ] && break
  msg=$(sed -e 's/%/%25/g' -e 's/\r/%0D/g' "$f" | awk 'BEGIN{ORS="%0A"} {print}')
  echo "::error title=log $n::$msg"
done
