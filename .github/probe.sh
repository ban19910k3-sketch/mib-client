#!/usr/bin/env bash
# Podgląd klas Minecrafta danej wersji (pomoc przy nowych wersjach gry): czyta .github/probe.txt, linie
#   <wersja> class <klasa>                      — sygnatury pól i metod klasy
#   <wersja> calls <tekst> in <pakiet>         — metody z pakietu (z podpakietami), które w kodzie mają <tekst>
#   <wersja> members <klasa> <regex>           — tylko pola i metody pasujące do wyrażenia
#   <wersja> code <klasa> <regex>              — wywołania, pola i stałe w metodach pasujących do wyrażenia
# Wynik w probe-out.txt i w adnotacjach przebiegu.
# Argument (opcjonalny): tylko ta wersja gry.
cd mod
out=../probe-out.txt; : > "$out"
for v in $(awk -v only="$1" '!/^#/ && NF && (only == "" || $1 == only) {print $1}' ../.github/probe.txt | sort -u); do
  ./gradlew -q -Pmc="$v" ":mc-$v:help" > /dev/null 2>&1 || true
  jar=$(find ~/.gradle/caches/fabric-loom .gradle -name 'minecraft-client.jar' -path "*/$v/*" 2>/dev/null | head -1)
  [ -n "$jar" ] || jar=$(find ~/.gradle/caches .gradle -name "*.jar" -path "*minecraft*" 2>/dev/null | grep -F "$v" | grep -vE 'sources|mappings|intermediary' | head -1)
  echo "##### $v ($jar)" >> "$out"
  while read -r ver kind rest; do
    [ "$ver" = "$v" ] || continue
    if [ "$kind" = class ]; then
      echo "=== $rest" >> "$out"
      javap -p -cp "$jar" "$rest" 2>&1 | head -80 >> "$out"
    elif [ "$kind" = calls ]; then
      text=${rest% in *}; pkg=${rest##* in }
      echo "=== wywołania '$text' w $pkg" >> "$out"
      unzip -Z1 "$jar" | grep -E "^${pkg//.//}([/\$].*)?\.class$" | sed 's/\.class$//; s#/#.#g' > /tmp/classes.txt
      xargs -a /tmp/classes.txt -n 400 javap -c -p -cp "$jar" 2>/dev/null | awk -v t="$text" '
        /^[a-z ]*(class|interface|enum|record) / { cls = $0; sub(/ *\{$/, "", cls); sub(/ (extends|implements|permits) .*/, "", cls); n = split(cls, w, " "); cls = w[n]; next }
        /^  [^ ].*\(.*\).*;$/ { m = $0; next }
        index($0, t) { ins = $0; sub(/^ *[0-9]+: */, "", ins); key = cls " :: " m " :: " ins; if (!(key in seen)) { seen[key] = 1; print key } }' | head -60 >> "$out"
    elif [ "$kind" = members ]; then
      cls=${rest%% *}; re=${rest#* }
      echo "=== $cls ~ $re" >> "$out"
      javap -p -cp "$jar" "$cls" 2>&1 | grep -iE "$re" | head -40 >> "$out"
    elif [ "$kind" = code ]; then
      cls=${rest%% *}; re=${rest#* }
      echo "=== kod $cls ~ $re" >> "$out"
      javap -c -p -cp "$jar" "$cls" 2>&1 | awk -v re="$re" '
        /^  [^ ].*\(.*\).*;$/ { on = ($0 ~ re); if (on) print; next }
        on && /(invoke|getfield|putfield|getstatic|ldc|instanceof)/ { sub(/^ *[0-9]+: */, "    "); sub(/ +\/\/ */, " "); print }' | head -90 >> "$out"
    fi
  done < <(awk '!/^#/ && NF' ../.github/probe.txt)
done
cat "$out"
split -C 3500 "$out" probe_part_
n=0
for f in probe_part_*; do
  n=$((n + 1)); [ "$n" -gt 30 ] && break
  msg=$(sed -e 's/%/%25/g' -e 's/\r/%0D/g' "$f" | awk 'BEGIN{ORS="%0A"} {print}')
  if [ "$n" -le 10 ]; then kind=warning; elif [ "$n" -le 20 ]; then kind=notice; else kind=error; fi
  echo "::$kind title=probe $n::$msg"
done
