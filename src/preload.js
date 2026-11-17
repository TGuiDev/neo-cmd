const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('neo', {
  create: (opts) => ipcRenderer.invoke('pty:create', opts),
  write: (id, data) => ipcRenderer.send('pty:write', id, data),
  resize: (id, cols, rows) => ipcRenderer.send('pty:resize', id, cols, rows),
  kill: (id) => ipcRenderer.send('pty:kill', id),
  home: () => ipcRenderer.invoke('app:home'),
  gitBranch: (cwd, distro) => ipcRenderer.invoke('app:git-branch', cwd, distro),
  complete: (cwd, input, distro) => ipcRenderer.invoke('fs:complete', cwd, input, distro),
  wslList: () => ipcRenderer.invoke('wsl:list'),
  parent: (p) => ipcRenderer.invoke('fs:parent', p),
  knownDirs: () => ipcRenderer.invoke('fs:known'),
  isDir: (p) => ipcRenderer.invoke('fs:isdir', p),
  setTitlebar: (color, symbolColor) => ipcRenderer.send('app:titlebar', color, symbolColor),
  openExternal: (url) => ipcRenderer.send('app:open-external', url),
  listFonts: () => ipcRenderer.invoke('fonts:list'),
  updateGet: () => ipcRenderer.invoke('update:get'),
  updateCheck: () => ipcRenderer.invoke('update:check'),
  updateInstall: () => ipcRenderer.send('update:install'),
  onUpdate: (cb) => ipcRenderer.on('update:state', (_e, st) => cb(st)),
  onData: (cb) => ipcRenderer.on('pty:data', (_e, id, data) => cb(id, data)),
  onExit: (cb) => ipcRenderer.on('pty:exit', (_e, id, code) => cb(id, code)),
});
