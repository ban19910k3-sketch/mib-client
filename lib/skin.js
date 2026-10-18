// Skin konta Minecraft: obecny skin, zmiana i powrót do domyślnego przez API Mojanga.
// Token Minecrafta trafia tylko do Mojanga (api.minecraftservices.com), nigdzie indziej.
const { pngInfo } = require('./profile');

const API = () => process.env.MIB_MC_API || 'https://api.minecraftservices.com';
const MAX_BYTES = 256 * 1024;

// Plik skina: PNG 64×64 albo stary format 64×32; zwraca kod błędu albo null
function checkSkin(buf) {
  const info = pngInfo(buf);
  if (!info) return 'skin_not_png';
  if (buf.length > MAX_BYTES) return 'skin_too_big';
  if (info.width !== 64 || (info.height !== 64 && info.height !== 32)) return 'skin_size';
  return null;
}

// Model postaci z pikseli skina 64×64 (bgra: bufor BGRA, jak toBitmap() w Electronie): przy „smukłym” piksele
// prawego ramienia na x = 54–55 (wiersze 20–31) są przezroczyste
function guessVariant(bgra, width, height) {
  if (!bgra || width !== 64 || height !== 64) return 'classic';
  for (let y = 20; y < 32; y++) for (let x = 54; x < 56; x++) if (bgra[(y * 64 + x) * 4 + 3] !== 0) return 'classic';
  return 'slim';
}

async function call(fetch, token, path, init = {}) {
  const r = await fetch(API() + path, { ...init, headers: { Authorization: 'Bearer ' + token, ...(init.headers || {}) }, signal: AbortSignal.timeout(15000) });
  if (r.status === 401) throw Object.assign(new Error('skin_auth'), { code: 'skin_auth' });
  if (r.status === 429) throw Object.assign(new Error('skin_rate'), { code: 'skin_rate' });
  if (!r.ok) throw Object.assign(new Error('skin_failed ' + r.status), { code: 'skin_failed' });
  return r.status === 204 ? null : r.json().catch(() => null);
}

// Aktywny skin z profilu Minecrafta: { url, variant } albo null (domyślny skin)
async function currentSkin({ fetch, token }) {
  const p = await call(fetch, token, '/minecraft/profile');
  const s = ((p && p.skins) || []).find(x => x.state === 'ACTIVE');
  return s ? { url: s.url, variant: String(s.variant || 'CLASSIC').toLowerCase() === 'slim' ? 'slim' : 'classic', skins: p.skins } : null;
}

// Nowy skin (PNG) z modelem classic albo slim; zwraca profil od Mojanga
function uploadSkin({ fetch, token, png, variant }) {
  const bad = checkSkin(png);
  if (bad) return Promise.reject(Object.assign(new Error(bad), { code: bad }));
  const form = new FormData();
  form.append('variant', variant === 'slim' ? 'slim' : 'classic');
  form.append('file', new Blob([png], { type: 'image/png' }), 'skin.png');
  return call(fetch, token, '/minecraft/profile/skins', { method: 'POST', body: form });
}

// Powrót do domyślnego skina (Steve/Alex)
const resetSkin = ({ fetch, token }) => call(fetch, token, '/minecraft/profile/skins/active', { method: 'DELETE' });

module.exports = { checkSkin, guessVariant, currentSkin, uploadSkin, resetSkin, MAX_BYTES };
