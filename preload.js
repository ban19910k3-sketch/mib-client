const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('mib', {
  win: a => ipcRenderer.send('win', a), call: (c, a) => ipcRenderer.invoke(c, a),
  on: (c, f) => ipcRenderer.on(c, (_, d) => f(d))
});
