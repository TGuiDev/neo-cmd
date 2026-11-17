const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { execFile } = require('child_process');
const pty = require('@lydell/node-pty');

const isWin = process.platform === 'win32';
const terminals = new Map(); // id -> pty
let win;

/* ---------- Claude Code embutido ---------- */
function appRoots() {
  const p = app.getAppPath();
  return [p.replace('app.asar', 'app.asar.unpacked'), p];
}

// Caminho do executável do Claude Code que acompanha o app.
function claudeBinary() {
  const exe = isWin ? 'claude.exe' : 'claude';
  const pkg = `claude-code-${process.platform}-${process.arch}`;
  for (const root of appRoots()) {
    const f = path.join(root, 'node_modules', '@anthropic-ai', pkg, exe);
    if (fs.existsSync(f)) return f;
  }
  return null;
}

// Deixa o `claude` disponível no PATH dos terminais comuns.
function binDirs() {
  const dirs = appRoots().map((r) => path.join(r, 'node_modules', '.bin'));
  dirs.push(path.join(process.resourcesPath || '', 'bin')); // claude.cmd quando empacotado
  return dirs.filter((d) => fs.existsSync(d));
}

/* ---------- shells ---------- */
// PowerShell: informa a pasta atual ao terminal (OSC 9;9), usada na aba e na sidebar.
const PS_PROMPT =
  "function prompt { $p = $executionContext.SessionState.Path.CurrentLocation.Path; " +
  "\"$([char]27)]9;9;$p$([char]27)\\PS $p> \" }";

function shellFor(kind) {
  if (!isWin) return { file: process.env.SHELL || '/bin/bash', args: [] };
  switch (kind) {
    case 'powershell':
      return { file: 'powershell.exe', args: ['-NoLogo', '-NoExit', '-Command', PS_PROMPT] };
    case 'pwsh':
      return { file: 'pwsh.exe', args: ['-NoLogo', '-NoExit', '-Command', PS_PROMPT] };
    default:
      return { file: process.env.ComSpec || 'cmd.exe', args: [] };
  }
}

function buildEnv() {
  const env = { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' };
  const key = Object.keys(env).find((k) => k.toLowerCase() === 'path') || 'PATH';
  env[key] = [...binDirs(), env[key] || ''].join(path.delimiter);
  // Informa o diretório atual ao terminal (OSC 9;9) a cada prompt.
  if (isWin) env.PROMPT = '$E]9;9;$P$E\\$P$G';
  else env.PROMPT_COMMAND = 'printf "\\033]9;9;%s\\033\\\\" "$PWD"';
  return env;
}

function spawnTerminal({ id, kind, cwd, cols, rows }) {
  const startDir = cwd && fs.existsSync(cwd) ? cwd : os.homedir();
  let file, args = [], typed = null;

  if (kind === 'claude') {
    // O Claude é o próprio processo do terminal: nada de shell nem de "claude" digitado.
    const bin = claudeBinary();
    if (bin) file = bin;
    else ({ file, args } = shellFor('default')), (typed = 'claude');
  } else {
    ({ file, args } = shellFor(kind));
  }

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
  if (typed) setTimeout(() => proc.write(typed + '\r'), 150);
}

ipcMain.handle('pty:create', (_e, opts) => { spawnTerminal(opts); return true; });
ipcMain.on('pty:write', (_e, id, data) => terminals.get(id)?.write(data));
ipcMain.on('pty:resize', (_e, id, cols, rows) => {
  try { terminals.get(id)?.resize(Math.max(cols, 2), Math.max(rows, 1)); } catch {}
});
ipcMain.on('pty:kill', (_e, id) => {
  try { terminals.get(id)?.kill(); } catch {}
  terminals.delete(id);
});
ipcMain.handle('app:home', () => os.homedir());
ipcMain.handle('app:git-branch', (_e, cwd) => new Promise((resolve) => {
  if (!cwd || !fs.existsSync(cwd)) return resolve('');
  execFile('git', ['-C', cwd, 'rev-parse', '--abbrev-ref', 'HEAD'],
    { timeout: 1500, windowsHide: true }, (err, out) => resolve(err ? '' : String(out).trim()));
}));
/* ---------- pastas (barra de endereço e página de nova aba) ---------- */
const expand = (p) => (p === '~' || p.startsWith('~/') || p.startsWith('~\\') ? path.join(os.homedir(), p.slice(1)) : p);
const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };

// Completa um caminho digitado: devolve a pasta exata (se existir) e subpastas que combinam.
ipcMain.handle('fs:complete', (_e, cwd, input) => {
  const raw = expand(String(input || '').trim());
  const full = path.resolve(cwd && isDir(cwd) ? cwd : os.homedir(), raw || '.');
  const endsWithSep = /[\\/]$/.test(raw);
  const base = endsWithSep || isDir(full) && raw.endsWith('.') ? full : path.dirname(full);
  const prefix = endsWithSep ? '' : path.basename(full).toLowerCase();
  let items = [];
  try {
    items = fs.readdirSync(base, { withFileTypes: true })
      .filter((d) => { try { return d.isDirectory() || (d.isSymbolicLink() && isDir(path.join(base, d.name))); } catch { return false; } })
      .map((d) => d.name)
      .filter((n) => n.toLowerCase().startsWith(prefix) && (prefix.startsWith('.') || !n.startsWith('.')))
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 8)
      .map((name) => ({ name, path: path.join(base, name) }));
  } catch {}
  return { exact: isDir(full) ? full : null, items };
});
ipcMain.handle('fs:parent', (_e, p) => { const d = path.dirname(p); return d === p ? null : d; });
ipcMain.handle('fs:known', () => {
  const h = os.homedir();
  return [h, ...['Desktop', 'Documents', 'Downloads', 'Projects', 'projetos', 'source/repos'].map((n) => path.join(h, n))].filter(isDir);
});
ipcMain.handle('fs:isdir', (_e, p) => isDir(expand(p)));

ipcMain.on('app:open-external', (_e, url) => { if (/^https?:\/\//.test(url)) shell.openExternal(url); });
ipcMain.on('app:titlebar', (_e, color, symbolColor) => {
  try { win?.setTitleBarOverlay({ color, symbolColor, height: 44 }); } catch {}
});

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 780, minWidth: 640, minHeight: 400,
    backgroundColor: '#0b0d14',
    title: 'Neo CMD',
    titleBarStyle: 'hidden', // as abas ocupam a barra de título (como no Chrome)
    titleBarOverlay: { color: '#0b0d14', symbolColor: '#d6dbe8', height: 44 },
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
