// Aktualizacje launchera na Macu (od 0.42.0). Bez konta Apple Developer launcher nie jest podpisany, więc wbudowany
// mechanizm Electrona (Squirrel.Mac) go nie podmieni. Zamiast tego: najnowsze wydanie z GitHuba (tylko opublikowane),
// gracz klika „Aktualizuj”, launcher pobiera zip z nową aplikacją, rozpakowuje (ditto, zachowuje dowiązania w .app),
// a mały skrypt po zamknięciu launchera podmienia „MiB Client.app” i uruchamia nową wersję. Pliki pobrane przez sam
// launcher nie dostają flagi kwarantanny, więc macOS nie pyta drugi raz.
const path = require('path');

const REPO = 'ban19910k3-sketch/mib-client';
// Stały link do instalatora na Maca (najnowsze wydanie) — do strony MiB
const DMG_URL = 'https://github.com/' + REPO + '/releases/latest/download/MiB-Client-mac.dmg';
const zipUrl = v => 'https://github.com/' + REPO + '/releases/download/v' + v + '/MiB-Client-' + v + '-mac.zip';

// Czy wersja a jest nowsza od b (liczby oddzielone kropkami)
function newer(a, b) {
  const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] || 0) - (y[i] || 0);
    if (d) return d > 0;
  }
  return false;
}

// Najnowsze opublikowane wydanie z plikiem dla Maca: { version, notes, zip } albo null (wydanie bez zipa na Maca —
// np. opublikowane, zanim Mac się zbudował — nie jest jeszcze aktualizacją)
async function latest(fetch) {
  const r = await fetch('https://api.github.com/repos/' + REPO + '/releases/latest', { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'MiB-Client' } });
  if (!r.ok) throw new Error('kod ' + r.status);
  const j = await r.json();
  const v = String(j.tag_name || '').replace(/^v/, '');
  if (!/^\d+\.\d+\.\d+$/.test(v)) return null;
  const has = (j.assets || []).some(a => a && a.name === 'MiB-Client-' + v + '-mac.zip');
  return has ? { version: v, notes: String(j.body || ''), zip: zipUrl(v) } : null;
}

// Katalog „MiB Client.app” z ścieżki pliku wykonywalnego (…/MiB Client.app/Contents/MacOS/MiB Client)
function appBundle(execPath) {
  const p = path.resolve(execPath, '..', '..', '..');
  return p.endsWith('.app') ? p : null;
}

// Czy launcher może sam się podmienić: zwykły folder z prawem zapisu (nie uruchomiony prosto z obrazu dmg ani z
// „AppTranslocation” — to macOS robi z aplikacjami nieprzeniesionymi do Aplikacji)
function canSelfUpdate(app, fs = require('fs')) {
  if (!app || app.includes('/AppTranslocation/') || app.startsWith('/Volumes/')) return false;
  try { fs.accessSync(path.dirname(app), fs.constants.W_OK); return true; } catch { return false; }
}

const q = s => "'" + String(s).replace(/'/g, "'\\''") + "'";

// Skrypt podmiany: czeka na koniec launchera (pid), zamienia aplikację (przy błędzie wraca stara), zdejmuje
// kwarantannę i uruchamia launcher
function swapScript({ pid, app, fresh }) {
  return [
    '#!/bin/sh',
    'APP=' + q(app), 'NEW=' + q(fresh),
    'i=0; while kill -0 ' + Number(pid) + ' 2>/dev/null && [ $i -lt 300 ]; do sleep 0.2; i=$((i+1)); done',
    'rm -rf "$APP.old"',
    'if mv "$APP" "$APP.old"; then',
    '  if mv "$NEW" "$APP"; then rm -rf "$APP.old"; else rm -rf "$APP"; mv "$APP.old" "$APP"; fi',
    'fi',
    'xattr -dr com.apple.quarantine "$APP" 2>/dev/null',
    'open "$APP"',
    '',
  ].join('\n');
}

// Pobiera url do pliku z postępem w procentach (onProgress)
async function download({ url, file, fetch, onProgress = () => {}, fs = require('fs') }) {
  const r = await fetch(url);
  if (!r.ok || !r.body) throw new Error('nie udało się pobrać aktualizacji (kod ' + r.status + ')');
  const total = Number(r.headers.get('content-length')) || 0, out = fs.createWriteStream(file);
  let got = 0, last = -1;
  try {
    for await (const chunk of r.body) {
      got += chunk.length;
      if (!out.write(Buffer.from(chunk))) await new Promise(ok => out.once('drain', ok));
      const pct = total ? Math.floor((got / total) * 100) : 0;
      if (pct !== last) { last = pct; onProgress(pct); }
    }
  } finally { await new Promise(ok => out.end(ok)); }
  if (total && got !== total) throw new Error('pobieranie przerwane');
  return got;
}

module.exports = { REPO, DMG_URL, zipUrl, newer, latest, appBundle, canSelfUpdate, swapScript, download };
