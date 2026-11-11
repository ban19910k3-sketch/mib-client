// Rozpoznawanie najczęstszych przyczyn awarii gry z logu / raportu awarii Minecrafta.
const RULES = [
  ['memory', /OutOfMemoryError|GC overhead limit exceeded/i],
  ['java', /UnsupportedClassVersionError|compiled by a more recent version of the Java|requires Java \d+/i],
  ['jvm', /Could not create the Java Virtual Machine|Invalid maximum heap size|Unrecognized VM option|Error occurred during initialization of VM/i],
  ['mods', /incompatible mod set|Mod resolution|MissingModsException|DuplicateModsFoundException|requires (?:mod |version )?\S+ (?:of|which is missing)|Mixin apply failed|ModLoadingException/i],
  ['gpu', /Pixel format not accelerated|does not appear to support OpenGL|GLFW error|No OpenGL context|OpenGL 3\.2/i],
];

function diagnoseCrash(text) {
  const t = String(text || '');
  for (const [key, re] of RULES) if (re.test(t)) return key;
  return 'unknown';
}

// mody, które Fabric / raport awarii wskazuje jako winne: [{id, name}] (id z nawiasu albo komunikatu; najwyżej 3)
const SKIP_MOD = /^(minecraft|java|fabric ?loader|fabricloader|fabric-loader|mixinextras|none|unknown)$/i;
function crashMods(text) {
  const t = String(text || ''), out = [];
  const add = (name, id) => {
    const m = /^(.*?)\s*\(([\w.-]+)\)\s*$/.exec(String(name || '').trim());
    if (m) { name = m[1]; id = id || m[2]; }
    name = String(name || '').trim() || id;
    if (!name || SKIP_MOD.test(name) || (id && SKIP_MOD.test(id)) || out.some(x => x.name === name || (id && x.id === id))) return;
    out.push({ id: id || null, name });
  };
  for (const m of t.matchAll(/Mod '([^'\n]+)' \(([\w.-]+)\)[^\n]*?(?:requires|is incompatible|conflicts|breaks)/g)) add(m[1], m[2]);
  for (const m of t.matchAll(/Mixin apply for mod ([\w.-]+) failed/g)) add(m[1], m[1]);
  for (const m of t.matchAll(/Suspected Mods?: ([^\n]+)/g)) for (const n of m[1].split(/,\s*/)) add(n);
  if (!out.length) for (const m of t.matchAll(/due to errors, provided by '([\w.-]+)'/g)) add(m[1], m[1]);
  return out.slice(0, 3);
}

// Błąd launchera do zgłoszenia twórcy (od 0.47.3, main.js reportError → panel admina „Błędy”). Bez danych osobowych:
// ścieżki z nazwą użytkownika (Windows, Mac, Linux), adresy e-mail, tokeny i długie identyfikatory wycięte, ścieżki plików
// launchera skrócone do nazwy pliku. hash: ten sam błąd (bez liczb i numerów linii, które się zmieniają) = ten sam wiersz w bazie.
function cleanErr(t) {
  return String(t || '')
    .replace(/file:\/\/[^\s'"()]*[\\/]([^\\/\s'"()]+\.(?:js|html|css))/gi, '$1')
    .replace(/[^\s'"()]*app\.asar(?:\.unpacked)?[\\/](?:[^\s'"()]*[\\/])?([^\\/\s'"()]+)/gi, '$1')
    .replace(/[A-Za-z]:[\\/]+(?:Users|Documents and Settings)[\\/]+[^\\/'"\n]+/gi, '~')
    .replace(/\/(?:Users|home)\/[^/'"\n]+/g, '~')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[e-mail]')
    .replace(/eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}/g, '[token]')
    .replace(/\b[0-9a-f]{32,}\b/gi, '[id]')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[id]');
}
const ERR_KINDS = ['ui', 'promise', 'main', 'gl'];
function errReport(kind, message, stack) {
  if (!ERR_KINDS.includes(kind)) return null;
  const m = cleanErr(message).trim().slice(0, 500), st = stack ? cleanErr(stack).trim().slice(0, 2000) || null : null;
  if (!m) return null;
  const frame = st ? (st.split('\n').find(l => /^\s*at\s/.test(l)) || st.split('\n')[0]).replace(/:\d+(:\d+)?/g, '').trim() : '';
  const key = kind + '|' + m.replace(/\d+/g, '#') + '|' + frame;
  return { kind, message: m, stack: st, hash: require('crypto').createHash('sha1').update(key).digest('hex').slice(0, 16) };
}

module.exports = { diagnoseCrash, crashMods, cleanErr, errReport };
