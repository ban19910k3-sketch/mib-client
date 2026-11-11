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

// mody, które Fabric / raport awarii wskazuje jako winne (nazwy do pokazania graczowi, najwyżej 3)
const SKIP_MOD = /^(minecraft|java|fabric ?loader|fabricloader|fabric-loader|mixinextras|none|unknown)$/i;
function crashMods(text) {
  const t = String(text || ''), out = [];
  const add = n => { n = String(n || '').replace(/\s*\([\w.-]+\)\s*$/, '').trim(); if (n && !SKIP_MOD.test(n) && !out.includes(n)) out.push(n); };
  for (const m of t.matchAll(/Mod '([^'\n]+)' \([\w.-]+\)[^\n]*?(?:requires|is incompatible|conflicts|breaks)/g)) add(m[1]);
  for (const m of t.matchAll(/Mixin apply for mod ([\w.-]+) failed/g)) add(m[1]);
  for (const m of t.matchAll(/Suspected Mods?: ([^\n]+)/g)) for (const n of m[1].split(/,\s*/)) add(n);
  return out.slice(0, 3);
}

module.exports = { diagnoseCrash, crashMods };
