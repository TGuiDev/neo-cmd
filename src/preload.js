const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('neo', {
  create: (opts) => ipcRenderer.invoke('pty:create', opts),
  write: (id, data) => ipcRenderer.send('pty:write', id, data),
  resize: (id, cols, rows) => ipcRenderer.send('pty:resize', id, cols, rows),
  kill: (id) => ipcRenderer.send('pty:kill', id),
  home: () => ipcRenderer.invoke('app:home'),
  gitBranch: (cwd) => ipcRenderer.invoke('app:git-branch', cwd),
  setTitlebar: (color, symbolColor) => ipcRenderer.send('app:titlebar', color, symbolColor),
  openExternal: (url) => ipcRenderer.send('app:open-external', url),
  onData: (cb) => ipcRenderer.on('pty:data', (_e, id, data) => cb(id, data)),
  onExit: (cb) => ipcRenderer.on('pty:exit', (_e, id, code) => cb(id, code)),
});
