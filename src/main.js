const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const pty = require('@lydell/node-pty');

const isWin = process.platform === 'win32';
const terminals = new Map(); // id -> { proc, win }
let win;

// Deixa o `claude` (instalado junto, via npm) disponível em qualquer aba.
function binDirs() {
  const root = app.getAppPath().replace('app.asar', 'app.asar.unpacked');
  return [
    path.join(app.getAppPath(), 'node_modules', '.bin'),
    path.join(root, 'node_modules', '.bin'),
  ].filter((d) => fs.existsSync(d));
}

function shellFor(kind) {
  if (!isWin) {
    return { file: process.env.SHELL || '/bin/bash', args: [] };
  }
  switch (kind) {
    case 'powershell':
      return { file: 'powershell.exe', args: ['-NoLogo'] };
    case 'pwsh':
      return { file: 'pwsh.exe', args: ['-NoLogo'] };
    default:
      return { file: process.env.ComSpec || 'cmd.exe', args: [] };
  }
}

function buildEnv() {
  const env = { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' };
  const key = Object.keys(env).find((k) => k.toLowerCase() === 'path') || 'PATH';
  env[key] = [...binDirs(), env[key] || ''].join(path.delimiter);
  // cmd: informa o diretório atual ao terminal (OSC 9;9), usado pela sidebar do Claude.
  if (isWin) env.PROMPT = '$E]9;9;$P$E\\$P$G';
  return env;
}

function spawnTerminal({ id, kind, cwd, command, cols, rows }) {
  const { file, args } = shellFor(kind);
  const startDir = cwd && fs.existsSync(cwd) ? cwd : os.homedir();
  const proc = pty.spawn(file, args, {
    name: 'xterm-256color',
    cols: cols || 100,
    rows: rows || 30,
    cwd: startDir,
    env: buildEnv(),
  });
  terminals.set(id, proc);
  proc.onData((data) => win && !win.isDestroyed() && win.webContents.send('pty:data', id, data));
  proc.onExit(({ exitCode }) => {
    terminals.delete(id);
    if (win && !win.isDestroyed()) win.webContents.send('pty:exit', id, exitCode);
  });
  if (command) setTimeout(() => proc.write(command + '\r'), 150);
}

ipcMain.handle('pty:create', (_e, opts) => {
  spawnTerminal(opts);
  return true;
});
ipcMain.on('pty:write', (_e, id, data) => terminals.get(id)?.write(data));
ipcMain.on('pty:resize', (_e, id, cols, rows) => {
  try { terminals.get(id)?.resize(Math.max(cols, 2), Math.max(rows, 1)); } catch {}
});
ipcMain.on('pty:kill', (_e, id) => {
  try { terminals.get(id)?.kill(); } catch {}
  terminals.delete(id);
});
ipcMain.handle('app:home', () => os.homedir());
ipcMain.on('app:open-external', (_e, url) => {
  if (/^https?:\/\//.test(url)) shell.openExternal(url);
});

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 780,
    minWidth: 640,
    minHeight: 400,
    backgroundColor: '#0f1117',
    title: 'Neo CMD',
    // Barra de abas ocupa a barra de título (como no Chrome).
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#0f1117', symbolColor: '#c9d1d9', height: 40 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.on('closed', () => {
    for (const p of terminals.values()) try { p.kill(); } catch {}
    terminals.clear();
    win = null;
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
