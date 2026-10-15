# MiB Client

Darmowy launcher Minecraft PvP w Electronie (czysty HTML/JS, bez frameworka). Rozmawiaj z właścicielem po polsku.

- `main.js` — proces główny (logowanie msmc, uruchamianie gry, mody z Modrinth, aktualizacje).
- `index.html` + `style.css` + `ui.js` — interfejs. Teksty są po polsku; tłumaczenia angielskie są w słowniku `EN` w `ui.js` (klucz = polski tekst), więc każdy nowy napis w UI dopisz też do `EN`.
- Wygląd: czerń i ametystowy fiolet, pikselowe ramki (`clip-path: var(--px)`), font Pixelify tylko w nagłówkach i na przycisku GRAJ, zawsze `font-weight:400` (pogrubiony Pixelify psuje literę C).

## Wydawanie aktualizacji

1. Podbij `version` w `package.json`.
2. Wypchnij na `main`. Workflow `.github/workflows/release.yml` zbuduje instalator na Windows i utworzy szkic wydania `v<wersja>` z `.exe` i `latest.yml`.
3. Właściciel sam klika „Publish release” — dopiero wtedy launchery graczy pobiorą aktualizację.
