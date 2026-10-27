// Gracze MiB w grze: logo MiB przed nickiem i kosmetyki (peleryny, czapki, skrzydła) innych graczy MiB.
// Launcher zgłasza, że to konto Minecrafta gra w MiB, a konto potwierdza Mojang tak jak przy wejściu na serwer:
// join z losowym serverId tutaj, hasJoined po stronie bazy. Token Minecrafta idzie tylko do Mojanga.
// Potem launcher co kilka minut odświeża obecność i pyta bazę, którzy gracze z listy Tab grają w MiB.
const path = require('path');

const JOIN_URL = 'https://sessionserver.mojang.com/session/minecraft/join';
const NAME = /^[A-Za-z0-9_]{1,16}$/;
const CAPE_ID = /^[a-z0-9_]{2,32}$/;

function createMibPresence({ fetch, api, randomBytes, fs = require('fs'), now = Date.now, pingMs = 4 * 60000, capeMaxAgeMs = 3600000, timeoutMs = 8000 }) {
  let me = null, timer = null, gen = 0;
  const offline = m => Promise.resolve(api.mibPing({ uuid: m.uuid, token: m.token, online: false })).catch(() => {});

  // mc: { access_token, uuid, name } z msmc. Zwraca true, gdy baza potwierdziła konto; błąd sieci lub Mojanga rzuca dalej.
  async function start(mc) {
    await stop();
    const my = gen;
    if (!mc || !mc.access_token || !mc.uuid || !NAME.test(String(mc.name || ''))) return false;
    const serverId = randomBytes(16).toString('hex');
    const r = await fetch(JOIN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken: mc.access_token, selectedProfile: String(mc.uuid).replace(/-/g, ''), serverId }), signal: AbortSignal.timeout(timeoutMs) });
    if (r.status !== 204 && !r.ok) throw new Error('Mojang ' + r.status);
    const res = await api.mibHello({ name: mc.name, serverId });
    if (!res || res.error || typeof res.token !== 'string') throw new Error((res && res.error) || 'brak odpowiedzi');
    // w międzyczasie gra się zamknęła albo ruszyło nowe zgłoszenie: to zgłoszenie od razu się wylogowuje
    if (my !== gen) { await offline(res); return false; }
    me = { uuid: res.uuid, token: res.token };
    timer = setInterval(() => {
      const m = me;
      if (!m) return;
      // false = konto zgłoszone od nowa gdzie indziej (inny komputer): ten launcher przestaje odświeżać obecność
      Promise.resolve(api.mibPing({ uuid: m.uuid, token: m.token, online: true })).then(ok => { if (ok === false && me === m) { me = null; clearInterval(timer); timer = null; } }, () => {});
    }, pingMs);
    if (timer.unref) timer.unref();
    return true;
  }

  // Gra zamknięta albo uruchamianie przerwane: gracz przestaje być widoczny jako grający w MiB
  async function stop() {
    gen++;
    if (timer) clearInterval(timer);
    timer = null;
    const m = me; me = null;
    if (m) await offline(m);
  }

  // Gracze MiB spośród żądanych ({ ids, names }) i tekstury ich kosmetyków w capesDir/<id>.png; null = nie udało się zapytać
  async function players(req, capesDir) {
    if (!req.ids.length && !req.names.length) return [];
    const rows = await api.mibWho({ ids: req.ids, names: req.names });
    if (!Array.isArray(rows)) return null;
    const stale = id => { try { return now() - fs.statSync(path.join(capesDir, id + '.png')).mtimeMs > capeMaxAgeMs; } catch { return true; } };
    // tekstury założonych kosmetyków (peleryna, czapka, maska, skrzydła, aura) — wszystkie w tym samym folderze
    const need = [...new Set(rows.flatMap(r => [r.cape, r.hat, r.mask, r.wings, r.aura]).filter(c => typeof c === 'string' && CAPE_ID.test(c)))].filter(stale);
    if (need.length) {
      // bez tekstur (np. chwilowy brak sieci) lista graczy i tak trafia do gry; peleryny dojdą przy następnym pytaniu
      let tex = null; try { tex = await api.capeTextures({ ids: need }); } catch {}
      if (Array.isArray(tex)) {
        fs.mkdirSync(capesDir, { recursive: true });
        for (const t of tex) {
          if (!t || !CAPE_ID.test(String(t.id)) || typeof t.texture !== 'string' || !t.texture.startsWith('data:image/png;base64,')) continue;
          const f = path.join(capesDir, t.id + '.png');
          fs.writeFileSync(f + '.tmp', Buffer.from(t.texture.slice(22), 'base64'));
          fs.renameSync(f + '.tmp', f);
        }
      }
    }
    return rows;
  }

  return { start, stop, players, get active() { return !!me; } };
}

// Komunikat w logu launchera po zgłoszeniu konta: czy inni gracze MiB zobaczą logo i kosmetyki gracza.
// ok = wynik start(); err = kod albo treść błędu (brak = konto bez Microsoft, start() zwrócił false)
const HELLO_ERR = { not_verified: 'Mojang nie potwierdził konta', mojang_unavailable: 'Mojang nie odpowiada', busy: 'serwer MiB jest zajęty' };
function helloMessage(ok, err) {
  if (ok) return 'Logo MiB i kosmetyki: widzą je inni gracze MiB na tym samym serwerze. Gracze bez MiB ich nie widzą.';
  if (err === undefined) return 'Logo MiB i kosmetyki widać tylko u Ciebie: to konto nie jest kontem Microsoft.';
  return 'Inni gracze MiB nie zobaczą teraz Twojego logo i kosmetyków (' + (HELLO_ERR[err] || err) + '). Spróbuj uruchomić grę jeszcze raz.';
}

module.exports = { createMibPresence, JOIN_URL, helloMessage };
