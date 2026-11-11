// Ikona Minecrafta na pasku zadań / w Docku (od 0.47.0) na prawdziwym systemie (GitHub Actions: Windows, Mac, Linux):
// stara (LWJGL 2), średnia i najnowsza wersja gry uruchomione tak jak w launcherze (MCLC, Java z lib/java.js, na Macu
// -Xdock:icon/-Xdock:name z lib/macupdate.js). Sprawdza okno gry: Windows — ikona okna (WM_GETICON), Linux — _NET_WM_ICON,
// Mac — nazwa aplikacji w Docku (Minecraft zamiast java) i poprawny plik minecraft.icns.
// Uruchom: node test/e2e/icon.e2e.js (Linux: xvfb-run -a; Windows bez karty graficznej: MESA_DIR z bibliotekami Mesa)
const path = require('path'), fs = require('fs'), os = require('os'), { execFileSync, spawnSync } = require('child_process');
const assert = require('node:assert/strict');
const { ensureJava } = require('../../lib/java'), mac = require('../../lib/macupdate');

const OS = process.platform, TMP = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mib-icon-')));
const VERSIONS = (process.env.MIB_ICON_VERSIONS || '1.8.9,1.16.5,1.21.11').split(',').map(s => s.trim()).filter(Boolean);
const ROOT = path.join(TMP, 'mc');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const run = (cmd, args) => { const r = spawnSync(cmd, args, { encoding: 'utf8' }); return (r.stdout || '') + (r.stderr || ''); };

// okno gry i jego ikona; null = okna jeszcze nie ma
function probe(pid) {
  if (OS === 'linux') {
    const tree = run('xwininfo', ['-root', '-tree']);
    const m = tree.split('\n').map(l => /^\s*(0x[0-9a-f]+) "(Minecraft[^"]*)"/i.exec(l)).find(Boolean);
    if (!m) return null;
    // xprop pokazuje ikonę jako „Icon (16 x 16):” z obrazkiem albo „not found”
    const icon = run('xprop', ['-id', m[1], '_NET_WM_ICON']);
    return { title: m[2], icon: /_NET_WM_ICON\(CARDINAL\) = /.test(icon), detail: (icon.match(/Icon \(\d+ x \d+\)/g) || [icon.slice(0, 60)]).join(', ').replace(/\s+/g, ' ') };
  }
  if (OS === 'darwin') {
    // aplikacja z oknem w Launch Services: nazwa w Docku (z -Xdock:name), bez okna jej nie ma
    const list = run('lsappinfo', ['list']), blocks = list.split(/\n(?=\s*\d+\) )/);
    const b = blocks.find(x => new RegExp('pid = ' + pid + '\\b').test(x));
    if (!b) return null;
    const name = (/^\s*\d+\) "([^"]*)"/.exec(b) || [])[1] || '';
    return { title: name, icon: name === 'Minecraft', detail: b.split('\n').slice(0, 3).join(' ').replace(/\s+/g, ' ').slice(0, 160) };
  }
  // Windows: okno procesu Javy z tytułem Minecraft i jego ikona (WM_GETICON — ustawia ją sama gra)
  const ps = `
Add-Type @"
using System; using System.Text; using System.Runtime.InteropServices;
public static class W {
  public delegate bool P(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(P p, IntPtr l);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] public static extern IntPtr SendMessageTimeout(IntPtr h, uint m, IntPtr w, IntPtr l, uint f, uint t, out IntPtr r);
  [DllImport("user32.dll")] public static extern IntPtr GetClassLongPtr(IntPtr h, int i);
}
"@
$out = $null
[W]::EnumWindows({ param($h, $l) $p = 0; [void][W]::GetWindowThreadProcessId($h, [ref]$p)
  $sb = New-Object System.Text.StringBuilder 256; [void][W]::GetWindowText($h, $sb, 256); $t = $sb.ToString()
  if ($p -eq ${pid} -and $t -like 'Minecraft*') { $r = [IntPtr]::Zero
    [void][W]::SendMessageTimeout($h, 0x7F, [IntPtr]1, [IntPtr]0, 2, 5000, [ref]$r); $big = $r
    [void][W]::SendMessageTimeout($h, 0x7F, [IntPtr]0, [IntPtr]0, 2, 5000, [ref]$r); $small = $r
    [void][W]::SendMessageTimeout($h, 0x7F, [IntPtr]2, [IntPtr]0, 2, 5000, [ref]$r); $small2 = $r
    $cls = [W]::GetClassLongPtr($h, -14); $clsSm = [W]::GetClassLongPtr($h, -34)
    # próba kontrolna: gdy gra nie ustawiła ikony, czy w tym środowisku ikonę okna w ogóle da się ustawić i odczytać
    $ctl = ''
    if ($big -eq [IntPtr]::Zero -and $small -eq [IntPtr]::Zero) { Add-Type -AssemblyName System.Drawing
      $ico = [System.Drawing.SystemIcons]::Information.Handle
      [void][W]::SendMessageTimeout($h, 0x80, [IntPtr]1, $ico, 2, 5000, [ref]$r)
      [void][W]::SendMessageTimeout($h, 0x7F, [IntPtr]1, [IntPtr]0, 2, 5000, [ref]$r); $ctl = "kontrola: ustawiona $ico, odczytana $r"
      [void][W]::SendMessageTimeout($h, 0x80, [IntPtr]1, [IntPtr]::Zero, 2, 5000, [ref]$r) }
    $script:out = "$t|$big|$small|$cls|$small2|$clsSm|$ctl" }
  return $true }, [IntPtr]::Zero) | Out-Null
$out`;
  const o = run('powershell', ['-NoProfile', '-Command', ps]).trim().split('\n').pop().trim();
  if (!o || !o.includes('|')) return null;
  const [title, big, small, cls, small2, clsSm, ctl] = o.split('|');
  return { title, icon: big !== '0' || small !== '0', detail: 'WM_GETICON big=' + big + ' small=' + small + ' small2=' + small2 + ', ikona klasy okna=' + cls + '/' + clsSm + (ctl ? ', ' + ctl : '') };
}

(async () => {
  const { Client, Authenticator } = require('minecraft-launcher-core');
  const manifest = await (await fetch('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json')).json();
  for (const ver of VERSIONS) {
    try {
      const meta = await (await fetch(manifest.versions.find(x => x.id === ver).url)).json();
      let major = (meta.javaVersion && meta.javaVersion.majorVersion) || 8; if (major === 16) major = 17;
      const javaPath = await ensureJava({ base: path.join(TMP, 'java', String(major)), major, fetch, log: () => {} });
      // Windows bez karty graficznej: OpenGL z Mesa obok javaw.exe
      if (OS === 'win32' && process.env.MESA_DIR) for (const f of fs.readdirSync(process.env.MESA_DIR).filter(f => f.endsWith('.dll'))) fs.copyFileSync(path.join(process.env.MESA_DIR, f), path.join(path.dirname(javaPath), f));
      // maszyna testowa z Windows bez karty graficznej: LWJGL 2 (stare wersje) przyjmuje wtedy tylko programowy OpenGL
      const args = OS === 'win32' ? ['-Dorg.lwjgl.opengl.Display.allowSoftwareOpenGL=true'] : [];
      if (OS === 'darwin') {
        const icon = await mac.dockIcon({ dir: path.join(TMP, 'launcher'), roots: [ROOT], fetch });
        assert.ok(icon && fs.readFileSync(icon).subarray(0, 4).toString('latin1') === 'icns', 'minecraft.icns z zasobów Mojanga');
        args.push(...mac.dockArgs(icon));
      }
      const c = new Client(), log = [];
      c.on('data', d => log.push(String(d).trim()));
      const proc = await c.launch({ authorization: await Authenticator.getAuth('MiBTest'), root: ROOT, version: { number: ver, type: 'release' }, javaPath,
        memory: { max: '2G', min: '512M' }, window: { width: 854, height: 480 }, customArgs: args });
      assert.ok(proc, 'MCLC nie uruchomił gry');
      let closed = null; proc.on('close', code => { closed = code; });
      // czekamy na okno, potem do 40 s na ikonę (gra ustawia ją zaraz po utworzeniu okna)
      let res = null, seenAt = 0;
      for (const end = Date.now() + 12 * 60000; Date.now() < end && closed === null; await sleep(3000)) {
        const r = probe(proc.pid);
        if (!r) continue;
        res = r; seenAt = seenAt || Date.now();
        if (r.icon || Date.now() - seenAt > 40000) break;
      }
      try { proc.kill('SIGKILL'); } catch {}
      if (OS === 'win32') try { execFileSync('taskkill', ['/F', '/T', '/PID', String(proc.pid)]); } catch {}
      if (!res) {
        const crash = (() => { try { const d = path.join(ROOT, 'crash-reports'), f = fs.readdirSync(d).sort().pop(); return f ? fs.readFileSync(path.join(d, f), 'utf8').split('\n').slice(0, 30).join('\n') : ''; } catch { return ''; } })();
        const hs = (() => { try { const f = fs.readdirSync(ROOT).filter(x => /^hs_err/.test(x)).pop(); return f ? fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n').slice(0, 15).join('\n') : ''; } catch { return ''; } })();
        throw new Error('okno gry się nie pojawiło' + (closed !== null ? ' (gra zamknięta, kod ' + closed + ')' : '') + ':\n' + log.slice(-30).join('\n') + (crash ? '\n--- raport ---\n' + crash : '') + (hs ? '\n--- hs_err ---\n' + hs : ''));
      }
      console.log('::notice::' + OS + ' ' + ver + ': okno „' + res.title + '”, ikona: ' + (res.icon ? 'tak' : 'NIE') + ' — ' + res.detail
        + (res.icon ? '' : '%0Alog gry (ikona/okno): ' + log.filter(l => /icon|GLFW|platform|Backend|OpenGL|LWJGL/i.test(l)).slice(0, 12).join('%0A')));
      assert.ok(res.icon, OS + ' ' + ver + ': brak ikony Minecrafta (' + res.detail + ')');
      console.log('::notice::PASS ikona Minecrafta ' + OS + ' ' + ver);
    } catch (e) {
      console.log('::error::ikona ' + OS + ' ' + ver + ': ' + String((e && e.stack) || e).replace(/\n/g, '%0A'));
      process.exitCode = 1;
    }
    await sleep(3000);
  }
})();
