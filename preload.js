const { contextBridge, ipcRenderer, webUtils } = require('electron');
contextBridge.exposeInMainWorld('mib', {
  win: a => ipcRenderer.send('win', a), call: (c, a) => ipcRenderer.invoke(c, a),
  on: (c, f) => ipcRenderer.on(c, (_, d) => f(d)),
  // ścieżka pliku przeciągniętego do okna (np. mod do „Moje mody”)
  filePath: f => { try { return webUtils.getPathForFile(f); } catch { return ''; } }
});
