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

module.exports = { diagnoseCrash };
