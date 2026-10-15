// Logika profilu MiB bez sieci. Działa w procesie głównym (require) i w interfejsie (<script>, window.MibProfile).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MibProfile = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  // Crockford base32: bez I, L, O, U, żeby kod dało się przepisać z kartki
  const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  // Bez argumentów JVM: z profilu nie mogą przyjść flagi uruchamiające kod na komputerze gracza
  const SYNCED_KEYS = ['ram', 'width', 'height', 'priority', 'hideUpdates', 'lang', 'bg', 'anim', 'fx'];

  function validateNick(nick) {
    const n = String(nick == null ? '' : nick);
    if (n.length < 3 || n.length > 16) return 'nick_length';
    if (!/^[A-Za-z0-9_]+$/.test(n)) return 'nick_chars';
    return null;
  }

  const formatMibId = num => 'MIB-' + String(num).padStart(6, '0');

  function newRecoveryCode(randomBytes) {
    const b = randomBytes(16);
    let s = '';
    for (let i = 0; i < 16; i++) s += ALPHABET[b[i] & 31];
    return s.match(/.{4}/g).join('-');
  }

  const normalizeRecoveryCode = input => String(input || '').toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');

  function pickSynced(obj) {
    const out = {};
    for (const k of SYNCED_KEYS) if (obj && obj[k] !== undefined && !(k === 'bg' && obj[k] === 'custom')) out[k] = obj[k];
    return out;
  }

  // Ustawienia z profilu przepuszczamy tylko w bezpiecznych zakresach i wartościach
  const int = (v, lo, hi) => (Number.isInteger(v) && v >= lo && v <= hi ? v : undefined);
  const oneOf = (v, list) => (list.includes(v) ? v : undefined);
  function sanitizeSynced(x) {
    const o = x || {}, out = {
      ram: int(o.ram, 512, 65536), width: int(o.width, 320, 7680), height: int(o.height, 240, 4320),
      priority: typeof o.priority === 'boolean' ? o.priority : undefined, hideUpdates: typeof o.hideUpdates === 'boolean' ? o.hideUpdates : undefined,
      lang: oneOf(o.lang, ['pl', 'en']), bg: oneOf(o.bg, ['violet', 'black', 'blue']), anim: oneOf(o.anim, ['full', 'short', 'off']), fx: oneOf(o.fx, ['0', '1']),
    };
    for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
    return out;
  }

  // Co zrobić z ustawieniami po zalogowaniu: 'apply' = weź z profilu, 'push' = wyślij lokalne, 'none' = są takie same
  function mergeSettings(localAt, remote) {
    if (!remote) return 'push';
    if (localAt == null) return 'apply';
    if (remote.updatedAt > localAt) return 'apply';
    if (remote.updatedAt < localAt) return 'push';
    return 'none';
  }

  const clampSessionMinutes = ms => Math.min(1440, Math.max(0, Math.round(ms / 60000)));

  function favouriteVersion(stats) {
    let best = null, max = -1;
    for (const [gv, s] of Object.entries(stats || {})) if (s && s.min > max) { max = s.min; best = gv; }
    return best;
  }

  function formatPlaytime(min) {
    const h = Math.floor(min / 60), m = min % 60;
    return h ? h + ' h ' + String(m).padStart(2, '0') + ' min' : m + ' min';
  }

  // Kopii z profilu nie nadpisujemy, dopóki ten komputer jej nie przejrzał (przywrócił albo zastąpił)
  const backupDecision = s => (s.hasRemote && !s.reviewed ? 'hold' : 'push');

  return { SYNCED_KEYS, sanitizeSynced, validateNick, formatMibId, newRecoveryCode, normalizeRecoveryCode, pickSynced, mergeSettings, clampSessionMinutes, favouriteVersion, formatPlaytime, backupDecision };
});
