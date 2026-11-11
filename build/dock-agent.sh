#!/usr/bin/env bash
# Buduje mib-dock.jar (build/DockAgent.java, Java 8) do podanego folderu — w wydaniu na Maca do mod-dist (resources/mod)
set -euo pipefail
out="${1:?folder docelowy}"; tmp="$(mktemp -d)"
mkdir -p "$tmp/c" "$out"
javac --release 8 -nowarn -d "$tmp/c" "$(dirname "$0")/DockAgent.java"
printf 'Premain-Class: pl.mibclient.dock.DockAgent\n' > "$tmp/m.txt"
jar cfm "$out/mib-dock.jar" "$tmp/m.txt" -C "$tmp/c" .
echo "mib-dock.jar → $out"
