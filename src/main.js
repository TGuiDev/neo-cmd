const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { execFile } = require('child_process');
const pty = require('@lydell/node-pty');
const { autoUpdater } = require('electron-updater');

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

/* ---------- WSL ---------- */
let wslInfo = null;
// Lista as distros do WSL (a saída do wsl.exe vem em UTF-16).
function listWsl() {
  if (!isWin) return Promise.resolve({ distros: [], def: null });
  if (wslInfo) return Promise.resolve(wslInfo);
  return new Promise((resolve) => {
    execFile('wsl.exe', ['-l', '-v'], { timeout: 5000, windowsHide: true, encoding: 'buffer' }, (err, out) => {
      const info = { distros: [], def: null };
      if (!err && out && out.length) {
        const text = (out.includes(0) ? out.toString('utf16le') : out.toString('utf8')).replace(/\0/g, '');
        text.split(/\r?\n/).slice(1).map((l) => l.trim()).filter(Boolean).forEach((l) => {
          const isDef = l.startsWith('*');
          const name = l.replace(/^\*/, '').trim().split(/\s+/)[0];
          if (!name || /^docker-desktop/i.test(name)) return;
          info.distros.push(name);
          if (isDef) info.def = name;
        });
        if (!info.def) info.def = info.distros[0] || null;
      }
      wslInfo = info;
      resolve(info);
    });
  });
}
const isPosix = (p) => typeof p === 'string' && p.startsWith('/');
// Caminho Linux do WSL visto pelo Windows: \\wsl.localhost\<distro>\home\...
const wslUnc = (distro, p) => `\\\\wsl.localhost\\${distro}${p.replace(/\//g, '\\')}`;

function shellFor(kind, { distro, cwd } = {}) {
  if (!isWin) return { file: process.env.SHELL || '/bin/bash', args: [] };
  switch (kind) {
    case 'wsl':
      return { file: 'wsl.exe', args: [...(distro ? ['-d', distro] : []), '--cd', cwd || '~'] };
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
  if (isWin) {
    env.PROMPT = '$E]9;9;$P$E\\$P$G';
    // WSL: o bash do Linux recebe o PROMPT_COMMAND pelo WSLENV e também avisa a pasta atual.
    env.PROMPT_COMMAND = 'printf "\\033]9;9;%s\\033\\\\" "$PWD"';
    env.WSLENV = [env.WSLENV, 'PROMPT_COMMAND/u'].filter(Boolean).join(':');
    // Clink com prompt personalizado ignora o PROMPT acima: o script neo-cmd.lua faz o mesmo aviso.
    env.NEO_CMD = '1';
    const clinkDir = [path.join(process.resourcesPath || '', 'clink'), path.join(__dirname, 'clink')].find((d) => fs.existsSync(d));
    if (clinkDir) env.CLINK_PATH = [clinkDir, env.CLINK_PATH].filter(Boolean).join(';');
  }
  else env.PROMPT_COMMAND = 'printf "\\033]9;9;%s\\033\\\\" "$PWD"';
  return env;
}

function spawnTerminal({ id, kind, cwd, distro, cols, rows }) {
  const startDir = kind !== 'wsl' && cwd && fs.existsSync(cwd) ? cwd : os.homedir();
  let file, args = [], typed = null;

  if (kind === 'claude') {
    // O Claude é o próprio processo do terminal: nada de shell nem de "claude" digitado.
    const bin = claudeBinary();
    if (bin) file = bin;
    else ({ file, args } = shellFor('default')), (typed = 'claude');
  } else {
    ({ file, args } = shellFor(kind, { distro, cwd }));
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
ipcMain.handle('wsl:list', () => listWsl());
ipcMain.handle('app:git-branch', async (_e, cwd, distro) => {
  if (isWin && isPosix(cwd)) { const d = distro || (await listWsl()).def; if (!d) return ''; cwd = wslUnc(d, cwd); }
  return gitBranch(cwd);
});
const gitBranch = (cwd) => new Promise((resolve) => {
  if (!cwd || !fs.existsSync(cwd)) return resolve('');
  execFile('git', ['-C', cwd, 'rev-parse', '--abbrev-ref', 'HEAD'],
    { timeout: 1500, windowsHide: true }, (err, out) => resolve(err ? '' : String(out).trim()));
});
/* ---------- pastas (barra de endereço e página de nova aba) ---------- */
const expand = (p) => (p === '~' || p.startsWith('~/') || p.startsWith('~\\') ? path.join(os.homedir(), p.slice(1)) : p);
const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };

// Completa um caminho digitado: devolve a pasta exata (se existir) e subpastas que combinam.
ipcMain.handle('fs:complete', async (_e, cwd, input, distro) => {
  // Abas do WSL (ou caminhos Linux no Windows): completa dentro da distro via \\wsl.localhost.
  if (isWin && (distro || isPosix(input) || isPosix(cwd))) {
    const d = distro || (await listWsl()).def;
    if (!d) return { exact: null, items: [] };
    const raw = String(input || '').trim();
    const full = path.posix.resolve(isPosix(cwd) ? cwd : '/', raw || '.');
    const endsWithSep = raw.endsWith('/');
    const base = endsWithSep ? full : path.posix.dirname(full);
    const prefix = endsWithSep ? '' : path.posix.basename(full).toLowerCase();
    let items = [];
    try {
      items = fs.readdirSync(wslUnc(d, base), { withFileTypes: true })
        .filter((e) => e.isDirectory() && e.name.toLowerCase().startsWith(prefix) && (prefix.startsWith('.') || !e.name.startsWith('.')))
        .map((e) => e.name).sort((a, b) => a.localeCompare(b)).slice(0, 8)
        .map((name) => ({ name, path: path.posix.join(base, name) }));
    } catch {}
    return { exact: isDir(wslUnc(d, full)) ? full : null, items };
  }
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

/* ---------- fontes instaladas (para escolher a fonte do terminal) ---------- */
const FONT_STYLE = /\s+(Regular|Bold|Italic|Oblique|Light|ExtraLight|Extra Light|UltraLight|Thin|Medium|SemiBold|Semi Bold|DemiBold|ExtraBold|Extra Bold|Black|Heavy|Condensed|SemiCondensed|Book|Retina)\b/gi;
const cleanFamily = (n) => n.replace(FONT_STYLE, '').replace(/\s+/g, ' ').trim();
ipcMain.handle('fonts:list', () => new Promise((resolve) => {
  const names = new Set();
  if (isWin) {
    // Fontes do sistema (HKLM) e as instaladas só para o usuário (HKCU), onde costumam ficar as Nerd Fonts.
    const keys = ['HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts', 'HKCU\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts'];
    let pending = keys.length;
    keys.forEach((k) => execFile('reg', ['query', k], { windowsHide: true, timeout: 6000, maxBuffer: 16e6 }, (err, out) => {
      if (!err) String(out).split(/\r?\n/).forEach((line) => {
        const m = line.match(/^\s+(.+?)\s{4}REG_(?:SZ|EXPAND_SZ)\s{4}/);
        if (m) m[1].replace(/\s*\((TrueType|OpenType|All res)\)\s*$/i, '').split(/\s*&\s*/).forEach((n) => names.add(cleanFamily(n)));
      });
      if (--pending === 0) resolve([...names].filter(Boolean).sort((a, b) => a.localeCompare(b)));
    }));
  } else {
    execFile('fc-list', [':', 'family'], { timeout: 6000, maxBuffer: 16e6 }, (err, out) => {
      if (!err) String(out).split('\n').forEach((l) => { const n = l.split(',')[0].trim(); if (n) names.add(n); });
      resolve([...names].sort((a, b) => a.localeCompare(b)));
    });
  }
}));

/* ---------- atualizações (Releases do GitHub) ---------- */
let updateState = { state: 'idle' };
function sendUpdate(patch) {
  updateState = { ...updateState, ...patch, current: app.getVersion() };
  if (win && !win.isDestroyed()) win.webContents.send('update:state', updateState);
}
function setupUpdates() {
  if (!app.isPackaged) { updateState = { state: 'dev' }; return; } // só no app instalado
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => sendUpdate({ state: 'checking' }));
  autoUpdater.on('update-not-available', () => sendUpdate({ state: 'latest' }));
  autoUpdater.on('update-available', (i) => sendUpdate({ state: 'downloading', version: i.version, percent: 0 }));
  autoUpdater.on('download-progress', (p) => sendUpdate({ state: 'downloading', percent: Math.round(p.percent || 0) }));
  autoUpdater.on('update-downloaded', (i) => sendUpdate({ state: 'ready', version: i.version }));
  autoUpdater.on('error', (e) => sendUpdate({ state: 'error', message: String((e && e.message) || e).split('\n')[0].slice(0, 200) }));
  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  setTimeout(check, 8000);
  setInterval(check, 4 * 60 * 60 * 1000);
}
ipcMain.handle('update:get', () => ({ ...updateState, current: app.getVersion() }));
ipcMain.handle('update:check', async () => {
  if (!app.isPackaged) return { state: 'dev', current: app.getVersion() };
  if (updateState.state === 'downloading' || updateState.state === 'ready') return { ...updateState, current: app.getVersion() };
  try { await autoUpdater.checkForUpdates(); } catch (e) { sendUpdate({ state: 'error', message: String((e && e.message) || e).split('\n')[0].slice(0, 200) }); }
  return { ...updateState, current: app.getVersion() };
});
ipcMain.on('update:install', () => { if (updateState.state === 'ready') autoUpdater.quitAndInstall(false, true); });

ipcMain.on('app:open-external', (_e, url) => { if (/^https?:\/\//.test(url)) shell.openExternal(url); });
ipcMain.on('app:titlebar', (_e, color, symbolColor) => {
  try { win?.setTitleBarOverlay({ color, symbolColor, height: 40 }); } catch {}
});

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 780, minWidth: 640, minHeight: 400,
    backgroundColor: '#0e0e11',
    title: 'Neo CMD',
    icon: path.join(__dirname, 'renderer', 'icon.png'),
    titleBarStyle: 'hidden', // as abas ocupam a barra de título (como no Chrome)
    titleBarOverlay: { color: '#0e0e11', symbolColor: '#ecebf0', height: 40 },
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

app.whenReady().then(() => { createWindow(); setupUpdates(); });
app.on('window-all-closed', () => app.quit());
