const { app, BrowserWindow, ipcMain, safeStorage, dialog, screen, clipboard, Notification, utilityProcess } = require('electron');
const { spawn } = require('child_process'), crypto = require('crypto');
const path = require('path'), fs = require('fs');
const { Client } = require('minecraft-launcher-core');
const { autoUpdater } = require('electron-updater');
const { Auth } = require('msmc');
let win, auth = null, launching = false;
const dir = () => app.getPath('userData');
const jf = f => path.join(dir(), f);
const rd = (f, d) => { try { return JSON.parse(fs.readFileSync(jf(f), 'utf8')); } catch { return d; } };
const wr = (f, v) => fs.writeFileSync(jf(f), JSON.stringify(v, null, 2));
const defaults = () => ({ ram: 2048, java: '', width: 1280, height: 720, root: path.join(dir(), 'minecraft'), jvm: '', lang: 'pl', hideUpdates: false, pingHost: '', priority: true });
const logBuf = [];
const san = s => String(s).replace(/(--accessToken\s+)\S+/gi, '$1[ukryte]').replace(/(--uuid\s+)\S+/gi, '$1[ukryte]').replace(/eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}/g, '[token]').replace(/((?:access|refresh)[_-]?token|bearer)(["'=:\s]+)[\w.\-~+\/]{20,}/gi, '$1$2[ukryte]');
const send = (c, d) => { if (c === 'log') { d = san(d); logBuf.push(d); if (logBuf.length > 500) logBuf.shift(); } if (win && !win.isDestroyed()) win.webContents.send(c, d); };

app.whenReady().then(() => {
  win = new BrowserWindow({ width: 1100, height: 680, minWidth: 900, minHeight: 600, frame: false, backgroundColor: '#050007', icon: path.join(__dirname, 'icon.png'),
    webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, 'preload.js') } });
  win.setMenu(null); win.loadFile('index.html');
  win.webContents.once('did-finish-load', () => setTimeout(() => checkUpdate(false), 4000));
});
app.on('window-all-closed', () => app.quit());

ipcMain.on('win', (_, a) => { if (!win) return; a === 'min' ? win.minimize() : a === 'max' ? (win.isMaximized() ? win.unmaximize() : win.maximize()) : win.close(); });
ipcMain.handle('settings:get', () => ({ ...defaults(), ...rd('settings.json', {}) }));
ipcMain.handle('settings:set', (_, s) => { wr('settings.json', s); return true; });
ipcMain.handle('pickdir', async () => { const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'] }); return r.canceled ? null : r.filePaths[0]; });

ipcMain.handle('versions', async () => {
  const m = await (await fetch('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json')).json();
  return m.versions.filter(v => v.type === 'release').map(v => v.id);
});

// Logowanie przez oficjalny mechanizm Microsoft (okno logowania Microsoftu, bez własnego formularza haseł)
const accLoad = () => rd('accounts.json', { active: null, list: [] });
const accSave = a => wr('accounts.json', a);
async function profile(xbox) {
  const mc = await xbox.getMinecraft();
  auth = mc; const p = mc.profile || {}, id = String(p.id || p.name || 'unknown');
  if (safeStorage.isEncryptionAvailable()) {
    const a = accLoad(), rec = { id, name: p.name || 'Gracz', t: safeStorage.encryptString(xbox.save()).toString('base64') }, i = a.list.findIndex(x => x.id === id);
    if (i >= 0) a.list[i] = rec; else a.list.push(rec); a.active = id; accSave(a);
  }
  return { name: p.name || 'Gracz', id };
}
async function switchAccount(id) {
  const rec = accLoad().list.find(x => x.id === id); if (!rec) throw new Error('brak konta');
  return profile(await new Auth('select_account').refresh(safeStorage.decryptString(Buffer.from(rec.t, 'base64'))));
}
ipcMain.handle('login', async () => {
  const mgr = new Auth('select_account');
  return profile(await mgr.launch('electron'));
});
ipcMain.handle('restore', async () => {
  try {
    const a = accLoad(), old = rd('account.json', null);
    if (!a.list.length && old) { const r = await profile(await new Auth('select_account').refresh(safeStorage.decryptString(Buffer.from(old.t, 'base64')))); try { fs.unlinkSync(jf('account.json')); } catch {} return r; }
    return a.active ? await switchAccount(a.active) : null;
  } catch { return null; }
});
ipcMain.handle('logout', () => { auth = null; return true; });
ipcMain.handle('accounts:list', () => { const a = accLoad(); return a.list.map(x => ({ id: x.id, name: x.name, active: x.id === a.active })); });
ipcMain.handle('accounts:switch', async (_, id) => { try { return await switchAccount(id); } catch { return { error: 'Sesja wygasła — dodaj to konto ponownie.' }; } });
ipcMain.handle('accounts:remove', (_, id) => { const a = accLoad(); a.list = a.list.filter(x => x.id !== id); if (a.active === id) { a.active = null; auth = null; } accSave(a); return true; });
// Zmiana konta z menu w grze: Minecraft nie pozwala zmienić sesji w trakcie gry, więc gra jest zamykana i uruchamiana ponownie na nowym koncie
ipcMain.handle('accounts:relaunch', async (_, id) => {
  if (!launching || !gamePid || !lastVersion) return 'Gra nie jest uruchomiona.';
  try { const r = await switchAccount(id); send('account:changed', r); pendingRelaunch = lastVersion; try { process.kill(gamePid); } catch {} return 'Zmieniam konto na ' + r.name + ' — gra uruchomi się ponownie…'; }
  catch { return 'Sesja tego konta wygasła — dodaj je ponownie w launcherze.'; }
});

let worker = null, gamePid = null, lastVersion = null, pendingRelaunch = null;
const notify = (t, b) => { try { if (Notification.isSupported()) new Notification({ title: t, body: b, icon: path.join(__dirname, 'icon.png') }).show(); } catch {} };
ipcMain.handle('launch', (_, arg) => doLaunch(arg.version));
async function doLaunch(version) {
  lastVersion = version;
  if (launching) return 'Już trwa uruchamianie.';
  if (!auth) return 'Najpierw zaloguj się kontem Microsoft (kliknij konto u góry).';
  const s = { ...defaults(), ...rd('settings.json', {}) };
  const root = path.join(s.root, 'instances', version); fs.mkdirSync(root, { recursive: true });
  launching = true;
  try {
    const javaPath = s.java || await ensureJava(await javaMajor(version));
    const opts = { authorization: auth.mclc(), root, version: { number: version, type: 'release' }, javaPath, memory: { max: s.ram + 'M', min: Math.min(512, s.ram) + 'M' },
      window: { width: s.width, height: s.height }, customArgs: s.jvm ? s.jvm.split(/\s+/).filter(Boolean) : [] };
    const loader = instGet(version).loader;
    if (loader === 'fabric') { send('log', 'Przygotowywanie Fabric…'); opts.version.custom = await ensureFabric(root, version); }
    if (loader === 'forge') { send('log', 'Przygotowywanie Forge…'); opts.forge = await ensureForge(root, version); }
    if (!launching) return 'Anulowano.';
    return await new Promise(res => {
      const w = utilityProcess.fork(path.join(__dirname, 'worker.js')); worker = w; let done = false;
      const fin = r => { if (!done) { done = true; res(r); } };
      w.on('message', m => {
        if (m.t === 'log') send('log', m.d); else if (m.t === 'progress') send('progress', m.d);
        else if (m.t === 'spawned') { gamePid = m.pid; startHud(m.pid); try { if (s.priority !== false) require('os').setPriority(m.pid, require('os').constants.priority.PRIORITY_HIGH); } catch {}
          send('started'); notify('MiB Client', 'Pobieranie zakończone — gra się uruchamia.'); win.minimize(); fin('ok'); }
        else if (m.t === 'close') { launching = false; gamePid = null; stopHud(); send('closed', m.c);
          if (pendingRelaunch) { const v = pendingRelaunch; pendingRelaunch = null; send('relaunch'); setTimeout(() => doLaunch(v).then(r => { if (r !== 'ok') { send('log', r); notify('MiB Client', String(r).slice(0, 120)); send('closed', 1); } }), 600); } }
        else if (m.t === 'error') { launching = false; notify('MiB Client — błąd', String(m.d).slice(0, 120)); fin('Błąd: ' + m.d); }
      });
      w.on('exit', () => { const was = launching; launching = false; worker = null; stopHud(); fin(was ? 'Uruchamianie przerwane.' : 'Anulowano.'); });
      w.postMessage(opts);
    });
  } catch (e) { launching = false; notify('MiB Client — błąd', String(e.message).slice(0, 120)); return 'Błąd: ' + e.message; }
}
ipcMain.handle('cancel', () => { launching = false; if (worker) worker.kill(); return true; });

ipcMain.handle('hub', async (_, { q, version, compat, offset }) => {
  try {
    const facets = [['project_type:mod', 'project_type:resourcepack']]; if (compat && version) facets.push(['versions:' + version]);
    const r = await mr('/search?limit=20&index=' + (q ? 'relevance' : 'downloads') + '&offset=' + (offset | 0) + '&query=' + encodeURIComponent(q || '') + '&facets=' + encodeURIComponent(JSON.stringify(facets)));
    return (r.hits || []).map(h => ({ title: h.title, desc: h.description, dl: h.downloads, slug: h.slug, icon: h.icon_url || '', type: h.project_type }));
  } catch { return { error: 'Błąd połączenia z Modrinth.' }; }
});
ipcMain.handle('trending', async () => {
  try { const r = await mr('/search?limit=4&index=follows&facets=' + encodeURIComponent('[["project_type:mod"]]')); return r.hits.map(h => ({ title: h.title, dl: h.downloads, slug: h.slug, icon: h.icon_url || '' })); } catch { return []; }
});

// Aktualizacje launchera (GitHub Releases). Nic nie instaluje się bez zgody użytkownika.
autoUpdater.autoDownload = false;
const txt = n => Array.isArray(n) ? n.map(x => x.note).join('\n') : String(n || '').replace(/<[^>]+>/g, '').trim();
async function checkUpdate(manual) {
  if (!app.isPackaged) { if (manual) send('upd:none', 'Tryb deweloperski: aktualizacje działają tylko w zainstalowanej wersji.'); return; }
  try { const r = await autoUpdater.checkForUpdates();
    if (!r || !r.updateInfo || r.updateInfo.version === app.getVersion()) { if (manual) send('upd:none', 'Masz najnowszą wersję (' + app.getVersion() + ').'); }
  } catch (e) { if (manual) send('upd:none', 'Nie udało się sprawdzić aktualizacji.'); }
}
autoUpdater.on('update-available', i => send('upd:avail', { version: i.version, notes: txt(i.releaseNotes) || 'Brak opisu zmian.', current: app.getVersion() }));
autoUpdater.on('download-progress', p => send('upd:prog', Math.round(p.percent)));
autoUpdater.on('update-downloaded', () => autoUpdater.quitAndInstall());
autoUpdater.on('error', e => send('upd:none', 'Błąd aktualizacji: ' + e.message));
ipcMain.handle('upd:check', () => checkUpdate(true));
ipcMain.handle('upd:install', () => { autoUpdater.downloadUpdate(); return true; });

ipcMain.handle('ver', () => app.getVersion());

ipcMain.handle('skin', async (_, name) => {
  try {
    const p = auth && auth.profile, sk = p && p.name === name && (p.skins || []).find(s => s.state === 'ACTIVE');
    const r = await fetch(sk ? sk.url : 'https://mc-heads.net/skin/' + encodeURIComponent(name));
    return r.ok ? 'data:image/png;base64,' + Buffer.from(await r.arrayBuffer()).toString('base64') : null;
  } catch { return null; }
});

// Java pobierana automatycznie (jednorazowo), żeby gra uruchamiała się bez ręcznej instalacji
async function javaMajor(version) {
  try {
    const m = await (await fetch('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json')).json();
    const j = await (await fetch(m.versions.find(x => x.id === version).url)).json();
    const n = (j.javaVersion && j.javaVersion.majorVersion) || 8; return n === 16 ? 17 : n;
  } catch { return 8; }
}
async function ensureJava(major) {
  const base = path.join(dir(), 'java', String(major));
  const find = () => { try { for (const d of fs.readdirSync(base)) { const p = path.join(base, d, 'bin', 'java.exe'); if (fs.existsSync(p)) return p; } } catch {} return null; };
  let p = find(); if (p) return p;
  send('log', 'Pobieranie Javy ' + major + ' (jednorazowo, ok. 50 MB)…');
  const r = await fetch('https://api.adoptium.net/v3/binary/latest/' + major + '/ga/windows/x64/jre/hotspot/normal/eclipse');
  if (!r.ok) throw new Error('nie udało się pobrać Javy (kod ' + r.status + ')');
  const AdmZip = require('adm-zip'); fs.mkdirSync(base, { recursive: true });
  new AdmZip(Buffer.from(await r.arrayBuffer())).extractAllTo(base, true);
  p = find(); if (!p) throw new Error('nie znaleziono java.exe po rozpakowaniu');
  send('log', 'Java ' + major + ' gotowa.'); return p;
}

// ---- Instalacja dodatków z Modrinth ----
const UA = { headers: { 'User-Agent': 'MiB-Client/' + app.getVersion() } };
const mr = async u => (await fetch('https://api.modrinth.com/v2' + u, UA)).json();
const enc = o => encodeURIComponent(JSON.stringify(o));
const rootDir = () => ({ ...defaults(), ...rd('settings.json', {}) }).root;
const instFile = gv => path.join(rootDir(), 'instances', gv, 'mib-instance.json');
const instGet = gv => { try { return JSON.parse(fs.readFileSync(instFile(gv), 'utf8')); } catch { return {}; } };
const instSet = (gv, o) => { fs.mkdirSync(path.dirname(instFile(gv)), { recursive: true }); fs.writeFileSync(instFile(gv), JSON.stringify({ ...instGet(gv), ...o })); };
const modsDir = gv => path.join(rootDir(), 'instances', gv, 'mods');
ipcMain.handle('hub:versions', async (_, { slug }) => {
  const r = await mr('/project/' + encodeURIComponent(slug));
  return { versions: (r.game_versions || []).filter(v => /^\d+\.\d+(\.\d+)?$/.test(v)).reverse(), loaders: (r.loaders || []).filter(l => ['fabric', 'forge'].includes(l)), type: r.project_type };
});
async function getFile(v, dest, done) {
  const f = v.files.find(x => x.primary) || v.files[0];
  const buf = Buffer.from(await (await fetch(f.url)).arrayBuffer());
  if (f.hashes && f.hashes.sha512 && crypto.createHash('sha512').update(buf).digest('hex') !== f.hashes.sha512) throw new Error('niezgodna suma kontrolna pliku');
  fs.mkdirSync(dest, { recursive: true }); fs.writeFileSync(path.join(dest, path.basename(f.filename)), buf); done.push(path.basename(f.filename));
  for (const d of v.dependencies || []) {
    if (d.dependency_type !== 'required') continue;
    try { const dv = d.version_id ? await mr('/version/' + d.version_id) : (await mr('/project/' + d.project_id + '/version?game_versions=' + enc([done.gv]) + (done.loader ? '&loaders=' + enc([done.loader]) : '')))[0];
      if (dv && !done.includes(path.basename(dv.files[0].filename))) await getFile(dv, dest, done); } catch {}
  }
}
// Loader (Fabric/Forge) wybierany automatycznie przy instalacji pierwszego moda i zapamiętany dla wersji gry
ipcMain.handle('hub:install', async (_, { slug, gv }) => {
  try {
    const p = await mr('/project/' + encodeURIComponent(slug)), pack = p.project_type === 'resourcepack', cur = instGet(gv).loader;
    const vs = await mr('/project/' + encodeURIComponent(slug) + '/version?game_versions=' + enc([gv]) + (pack ? '' : '&loaders=' + enc(cur ? [cur] : ['fabric', 'forge'])));
    if (!vs.length) return cur && !pack ? 'Brak wersji tego moda dla ' + gv + ' z loaderem ' + cur + ' (ta instalacja używa ' + cur + ').' : 'Brak wersji dla ' + gv + ' (Fabric/Forge).';
    const v = vs.find(x => x.loaders.includes('fabric')) || vs[0], loader = pack ? null : (cur || (v.loaders.includes('fabric') ? 'fabric' : 'forge'));
    if (loader && !cur) instSet(gv, { loader });
    const done = []; done.gv = gv; done.loader = loader;
    await getFile(v, path.join(rootDir(), 'instances', gv, pack ? 'resourcepacks' : 'mods'), done);
    return 'Zainstalowano (' + done.length + ' plik/ów)' + (loader ? ', loader: ' + loader : '') + ': ' + done.join(', ');
  } catch (e) { return 'Błąd instalacji: ' + e.message; }
});
// ---- Zarządzanie zainstalowanymi modami ----
const safe = f => f === path.basename(f);
ipcMain.handle('mods:list', (_, gv) => { try { return fs.readdirSync(modsDir(gv)).filter(f => /\.jar(\.disabled)?$/.test(f)).map(f => ({ file: f, on: !f.endsWith('.disabled'), size: fs.statSync(path.join(modsDir(gv), f)).size })); } catch { return []; } });
ipcMain.handle('mods:toggle', (_, { gv, file }) => { if (!safe(file)) return false; const d = modsDir(gv); fs.renameSync(path.join(d, file), path.join(d, file.endsWith('.disabled') ? file.slice(0, -9) : file + '.disabled')); return true; });
ipcMain.handle('mods:delete', (_, { gv, file }) => { if (!safe(file)) return false; fs.unlinkSync(path.join(modsDir(gv), file)); return true; });
ipcMain.handle('mods:updates', async (_, gv) => {
  try {
    const d = modsDir(gv), hs = {}; for (const f of fs.readdirSync(d).filter(x => x.endsWith('.jar'))) hs[crypto.createHash('sha1').update(fs.readFileSync(path.join(d, f))).digest('hex')] = f;
    if (!Object.keys(hs).length) return [];
    const ld = instGet(gv).loader, r = await fetch('https://api.modrinth.com/v2/version_files/update', { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'MiB-Client' }, body: JSON.stringify({ hashes: Object.keys(hs), algorithm: 'sha1', loaders: ld ? [ld] : ['fabric', 'forge'], game_versions: [gv] }) });
    const j = await r.json(), out = [];
    for (const h in j) { const v = j[h], f = v.files.find(x => x.primary) || v.files[0]; if (f.hashes.sha1 !== h) out.push({ file: hs[h], ver: v.version_number, id: v.id }); }
    return out;
  } catch { return []; }
});
ipcMain.handle('mods:update', async (_, { gv, file, id }) => {
  try { if (!safe(file)) return 'błąd'; const v = await mr('/version/' + id), done = []; done.gv = gv; done.loader = instGet(gv).loader;
    await getFile(v, modsDir(gv), done); if (done[0] !== file) fs.unlinkSync(path.join(modsDir(gv), file)); return 'ok'; } catch (e) { return e.message; }
});
ipcMain.handle('repair', (_, gv) => {
  const r = path.join(rootDir(), 'instances', gv); for (const p of ['libraries', 'natives', 'versions']) fs.rmSync(path.join(r, p), { recursive: true, force: true });
  return 'Usunięto pliki gry. Zostaną pobrane ponownie przy następnym kliknięciu GRAJ (światy, mody i ustawienia zostają).';
});
// ---- Raport błędu (bez tokenów i haseł) ----
ipcMain.handle('report:build', (_, ver) => {
  const s = { ...defaults(), ...rd('settings.json', {}) }, os = require('os'); let mods = []; try { mods = fs.readdirSync(modsDir(ver)); } catch {}
  const t = ['MiB Client ' + app.getVersion(), 'System: ' + process.platform + ' ' + os.release() + ' ' + process.arch, 'Wersja gry: ' + ver, 'Loader: ' + (instGet(ver).loader || 'brak'), 'RAM: ' + s.ram + ' MB', 'Java: ' + (s.java || 'automatyczna'), 'JVM: ' + s.jvm, 'Mody (' + mods.length + '): ' + mods.join(', '), '', '--- logi ---', ...logBuf].join('\n');
  return san(t.split(os.homedir()).join('~'));
});
ipcMain.handle('report:save', async (_, txt) => { const r = await dialog.showSaveDialog(win, { defaultPath: 'mib-raport.txt' }); if (r.canceled) return false; fs.writeFileSync(r.filePath, String(txt)); return true; });
ipcMain.handle('pickimg', async () => { const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'Obrazy', extensions: ['png', 'jpg', 'jpeg', 'webp'] }] }); return r.canceled ? null : r.filePaths[0]; });
ipcMain.handle('notify', (_, { t, b }) => { notify(t, b); return true; });
// ---- Loadery ----
async function ensureFabric(root, mc) {
  const list = await (await fetch('https://meta.fabricmc.net/v2/versions/loader/' + mc)).json();
  if (!list.length) throw new Error('Fabric nie obsługuje wersji ' + mc);
  const lv = (list.find(x => x.loader.stable) || list[0]).loader.version;
  const j = await (await fetch('https://meta.fabricmc.net/v2/versions/loader/' + mc + '/' + lv + '/profile/json')).json();
  const d = path.join(root, 'versions', j.id); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, j.id + '.json'), JSON.stringify(j)); return j.id;
}
async function ensureForge(root, mc) {
  const pr = (await (await fetch('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json')).json()).promos || {}, v = pr[mc + '-recommended'] || pr[mc + '-latest'];
  if (!v) throw new Error('Forge nie obsługuje wersji ' + mc);
  const f = path.join(root, 'forge-cache', 'forge-' + mc + '-' + v + '-installer.jar'); if (fs.existsSync(f)) return f;
  fs.mkdirSync(path.dirname(f), { recursive: true });
  for (const n of [mc + '-' + v, mc + '-' + v + '-' + mc]) { const r = await fetch('https://maven.minecraftforge.net/net/minecraftforge/forge/' + n + '/forge-' + n + '-installer.jar'); if (r.ok) { fs.writeFileSync(f, Buffer.from(await r.arrayBuffer())); return f; } }
  throw new Error('nie udało się pobrać instalatora Forge');
}
// ---- Nakładka HUD (Right Shift) ----
let ov = null, fgProc = null, menuOpen = false, fg = true, hooked = false;
function startHud(pid) {
  try {
    const { uIOhook, UiohookKey: K } = require('uiohook-napi');
    const d = screen.getPrimaryDisplay().bounds;
    ov = new BrowserWindow({ x: d.x, y: d.y, width: d.width, height: d.height, transparent: true, frame: false, focusable: false, skipTaskbar: true, hasShadow: false, resizable: false,
      webPreferences: { contextIsolation: true, preload: path.join(__dirname, 'preload.js') } });
    ov.setAlwaysOnTop(true, 'screen-saver'); ov.setIgnoreMouseEvents(true); ov.loadFile('overlay.html');
    uIOhook.on('keydown', e => { if (e.keycode === K.ShiftRight && (fg || menuOpen)) toggleMenu(); });
    uIOhook.start(); hooked = true;
    // Nakładka widoczna tylko gdy okno Minecrafta jest aktywne (jeden proces PowerShell sprawdza okno na pierwszym planie)
    const ps = 'Add-Type -TypeDefinition \'using System;using System.Runtime.InteropServices;public class W{[DllImport("user32.dll")]public static extern IntPtr GetForegroundWindow();[DllImport("user32.dll")]public static extern int GetWindowThreadProcessId(IntPtr h,out int p);}\';while($true){$p=0;[void][W]::GetWindowThreadProcessId([W]::GetForegroundWindow(),[ref]$p);Write-Output $p;Start-Sleep -Milliseconds 400}';
    let got = false; fgProc = spawn('powershell', ['-NoProfile', '-EncodedCommand', Buffer.from(ps, 'utf16le').toString('base64')], { windowsHide: true });
    const setFg = v => { fg = v; if (ov && !ov.isDestroyed()) ov.webContents.send('fg', v || menuOpen); };
    fgProc.stdout.on('data', b => { got = true; setFg(+String(b).trim().split(/\s+/).pop() === pid); });
    fgProc.on('error', () => setFg(true)); setTimeout(() => { if (!got) setFg(true); }, 5000);
    send('log', 'Menu MiB w grze: Right Shift (najpierw Esc) — zmiana konta.');
  } catch (e) { send('log', 'HUD niedostępny: ' + e.message); }
}
function toggleMenu() { menuOpen = !menuOpen; if (!ov || ov.isDestroyed()) return; ov.setIgnoreMouseEvents(!menuOpen); ov.webContents.send('menu', menuOpen); }
function stopHud() {
  try { if (hooked) { require('uiohook-napi').uIOhook.stop(); hooked = false; } } catch {}
  try { if (fgProc) fgProc.kill(); } catch {} fgProc = null; menuOpen = false;
  if (ov && !ov.isDestroyed()) ov.close(); ov = null;
}
ipcMain.handle('hud:close', () => { if (menuOpen) toggleMenu(); return true; });
app.on('before-quit', stopHud);
