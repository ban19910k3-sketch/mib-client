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

module.exports = { diagnoseCrash, crashMods };
