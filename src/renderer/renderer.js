(() => {
  const isWin = navigator.platform.toLowerCase().includes('win');
  const $ = (s, el = document) => el.querySelector(s);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const store = {
    get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };

  /* =================== temas =================== */
  const ANSI_DARK = {
    black: '#1d212d', red: '#ff6b81', green: '#7ee787', yellow: '#e3b341', blue: '#7c9cff', magenta: '#b38cff', cyan: '#56d4dd', white: '#c9d1d9',
    brightBlack: '#7d8590', brightRed: '#ff8fa0', brightGreen: '#9bf0a3', brightYellow: '#f0cb66', brightBlue: '#9db4ff',
    brightMagenta: '#c9a8ff', brightCyan: '#7ae3ea', brightWhite: '#ffffff',
  };
  const ANSI_LIGHT = {
    black: '#2b3040', red: '#d1242f', green: '#1a7f37', yellow: '#9a6700', blue: '#2f55d4', magenta: '#8250df', cyan: '#0f7d8c', white: '#6b7389',
    brightBlack: '#57606a', brightRed: '#e5534b', brightGreen: '#2da44e', brightYellow: '#bf8700', brightBlue: '#4f6bed',
    brightMagenta: '#a371f7', brightCyan: '#1b9aaa', brightWhite: '#1f2430',
  };
  const THEMES = {
    neo:      { label: 'Grafite',    bg: '#131317', fg: '#ecebf0', accent: '#8457e6', sel: '#3a2f5c', bar: '#0e0e11', sym: '#ecebf0', ansi: ANSI_DARK },
    midnight: { label: 'Meia-noite', bg: '#0d121c', fg: '#e3e9f4', accent: '#8b6cf0', sel: '#2c3352', bar: '#0a0d14', sym: '#e3e9f4', ansi: ANSI_DARK },
    dracula:  { label: 'Drácula',    bg: '#21222c', fg: '#f8f8f2', accent: '#bd93f9', sel: '#44475a', bar: '#18191f', sym: '#f8f8f2', ansi: ANSI_DARK },
    claro:    { label: 'Claro',      bg: '#ffffff', fg: '#1b1a21', accent: '#7446dc', sel: '#dccffb', bar: '#e9e9ee', sym: '#1b1a21', ansi: ANSI_LIGHT },
  };
  let themeId = THEMES[store.get('neo.theme')] ? store.get('neo.theme') : 'neo';
  const xtermTheme = () => {
    const t = THEMES[themeId];
    return { background: t.bg, foreground: t.fg, cursor: t.accent, cursorAccent: t.bg, selectionBackground: t.sel, ...t.ansi };
  };

  // Cada shell tem uma chave: 'cmd', 'powershell', 'pwsh', 'default' ou 'wsl:<distro>'.
  const SHELLS = isWin
    ? [{ key: 'cmd', kind: 'cmd', label: 'Prompt de Comando', sub: 'cmd.exe' },
       { key: 'powershell', kind: 'powershell', label: 'Windows PowerShell', sub: 'powershell.exe' },
       { key: 'pwsh', kind: 'pwsh', label: 'PowerShell 7', sub: 'pwsh.exe' }]
    : [{ key: 'default', kind: 'default', label: 'Shell padrão', sub: 'bash/zsh' }];
  let wslDefault = null;
  const KIND_LABEL = { cmd: 'cmd', powershell: 'PowerShell', pwsh: 'PowerShell 7', claude: 'Claude', default: 'shell', wsl: 'WSL' };
  const KIND_ICON = { cmd: '>_', powershell: 'PS', pwsh: 'PS', claude: '✦', default: '$_', wsl: '$' };
  const shellOf = (key) => {
    const found = SHELLS.find((x) => x.key === key);
    if (found) return { kind: found.kind, distro: found.distro };
    if (key && key.startsWith('wsl:')) return { kind: 'wsl', distro: key.slice(4) };
    return { kind: SHELLS[0].kind, distro: undefined };
  };
  const shellKey = (kind, distro) => (kind === 'wsl' ? `wsl:${distro || wslDefault || ''}` : kind);
  const kindLabel = (kind, distro) => (kind === 'wsl' ? distro || wslDefault || 'WSL' : KIND_LABEL[kind] || 'shell');

  /* =================== estado =================== */
  const tabsEl = $('#tabs'), termsEl = $('#terminals'), claudeStack = $('#claude-stack');
  const sidebar = $('#sidebar'), splitter = $('#splitter'), claudeBtn = $('#toggle-claude');
  let seq = 0, home = '';
  // Prefixo desta janela nos ids dos terminais: uma aba movida de outra janela nunca colide com as daqui.
  const WIN_TAG = Math.random().toString(36).slice(2, 7);
  let fontSize = Number(store.get('neo.fontSize', 14)) || 14;
  let defaultShell = store.get('neo.shell', SHELLS[0].key);
  // Com a página inicial (logo), abas novas abrem direto no terminal; a página de nova aba fica opcional.
  let ntpEnabled = store.get('neo.ntp', false);
  let homeVisible = false, homeEl = null;
  const tabs = [];
  const byPty = new Map();   // ptyId -> { term, hold, owner }
  const closed = [];
  let active = null;

  /* =================== caminhos =================== */
  const sepOf = (p) => (p && p.includes('\\') ? '\\' : '/');
  const baseName = (p) => (p || '').split(/[\\/]/).filter(Boolean).pop() || p || '';
  const samePath = (a, b) => !!a && !!b && (isWin ? a.toLowerCase() === b.toLowerCase() : a === b);
  const underHome = (p) => home && p && (isWin ? p.toLowerCase().startsWith(home.toLowerCase()) : p.startsWith(home));
  const isPosixPath = (p) => typeof p === 'string' && p.startsWith('/');
  // No Windows, caminhos Linux (/home/...) são do WSL.
  const isWslPath = (p) => isWin && isPosixPath(p);
  const winToWsl = (p) => p.replace(/^([a-zA-Z]):[\\/]?/, (_, d) => `/mnt/${d.toLowerCase()}/`).replace(/\\/g, '/');
  const shortPath = (p) => {
    if (underHome(p)) return '~' + p.slice(home.length);
    if (isWslPath(p)) return p.replace(/^\/home\/[^/]+/, '~');
    return p || '';
  };
  const looksLikePath = (q) => /^([a-zA-Z]:|~|\.{1,2}($|[\\/])|[\\/])/.test(q);
  function hue(str) { let x = 0; for (const c of str || '') x = (x * 31 + c.charCodeAt(0)) >>> 0; return x % 360; }
  const monoBg = (p) => { const a = hue(p); return `linear-gradient(135deg,hsl(${a} 70% 58%),hsl(${(a + 40) % 360} 70% 46%))`; };

  /* ---------- pastas visitadas (para "Mais visitadas") ---------- */
  let visits = store.get('neo.visits', {});
  function recordVisit(p, distro) {
    if (!p) return;
    const v = visits[p] || { n: 0, t: 0 };
    v.n++; v.t = Date.now(); if (distro) v.d = distro; visits[p] = v;
    const keys = Object.keys(visits);
    if (keys.length > 200) keys.sort((a, b) => visits[a].t - visits[b].t).slice(0, keys.length - 200).forEach((k) => delete visits[k]);
    store.set('neo.visits', visits);
  }
  const frecent = () => Object.entries(visits)
    .map(([p, v]) => ({ path: p, score: v.n / (1 + (Date.now() - v.t) / 3.6e6 / 72) }))
    .sort((a, b) => b.score - a.score).map((x) => x.path);

  /* ---------- ambientes de trabalho ---------- */
  // Um ambiente guarda shell, pasta, comandos ao abrir e cor de um projeto, para abrir com um clique.
  const ENV_COLORS = ['#7c9cff', '#b38cff', '#ff79c6', '#ff6b81', '#ff9a4d', '#f5c451', '#4fd08a', '#3dd6f5'];
  let envs = store.get('neo.envs', []);
  const saveEnvs = () => { store.set('neo.envs', envs); renderEnvButton(); };
  const envById = (id) => envs.find((e) => e.id === id);
  const envSub = (env) => { const sh = shellOf(env.shell); return `${kindLabel(sh.kind, sh.distro)} · ${shortPath(env.cwd)}`; };

  /* ---------- pasta 3D ---------- */
  // Pastas têm uma cor só (âmbar); a cor fica reservada para o que tem significado, como os ambientes.
  const folderColor = () => '#e2a336';
  function folder3d(color, glyph = '') {
    const f = h('div', 'folder3d');
    f.style.setProperty('--c', color);
    f.append(h('div', 'back'), h('div', 'paper'), h('div', 'front', glyph));
    return f;
  }
  const miniFolder = (color) => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 16 16'); s.setAttribute('width', '15'); s.setAttribute('height', '15');
    s.innerHTML = `<path d="M1.5 4a1 1 0 0 1 1-1h3.6l1.4 1.5h6a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1Z" fill="${color}" opacity=".55"/><path d="M1.5 6.2a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1Z" fill="${color}"/>`;
    return s;
  };

  /* ---------- favoritos ---------- */
  let bookmarks = store.get('neo.bookmarks', []);
  const isBookmarked = (p) => bookmarks.some((b) => samePath(b, p));
  function toggleBookmark(p = active?.cwd) {
    if (!p) return;
    bookmarks = isBookmarked(p) ? bookmarks.filter((b) => !samePath(b, p)) : [...bookmarks, p];
    store.set('neo.bookmarks', bookmarks);
    renderBookmarks(); updateToolbar();
    toast(isBookmarked(p) ? `★ ${baseName(p)} adicionada aos favoritos` : `${baseName(p)} removida dos favoritos`);
  }
  function renderBookmarks() {
    const bar = $('#bookmarks');
    bar.innerHTML = '';
    bar.classList.toggle('hidden', bookmarks.length === 0);
    bookmarks.forEach((p) => {
      const b = h('div', 'bm');
      b.append(miniFolder(folderColor(p)), h('span', null, baseName(p)));
      b.title = `${p}\nClique: abrir aqui · Ctrl+clique ou botão do meio: nova aba · Botão direito: remover`;
      b.addEventListener('mousedown', (e) => {
        e.preventDefault(); // não tira o foco do terminal
        if (e.button === 0 && e.shiftKey) openInNewWindow({ cwd: p });
        else if (e.button === 1 || (e.button === 0 && e.ctrlKey)) newTab({ cwd: p, ntp: false });
        else if (e.button === 0) openFolder(p);
      });
      b.addEventListener('contextmenu', (e) => { e.preventDefault(); toggleBookmark(p); });
      bar.appendChild(b);
    });
  }

  /* =================== terminal =================== */
  // A fonte escolhida pela pessoa vem primeiro; depois Nerd Fonts comuns; por fim as fontes de ícones
  // embutidas (atual e antiga), que cobrem os ícones de prompt que faltarem.
  let userFont = store.get('neo.termFont', '');
  const termFont = () => [userFont && `"${userFont}"`, '"CaskaydiaCove Nerd Font Mono"', '"CaskaydiaMono Nerd Font Mono"', '"Cascadia Code NF"',
    '"Cascadia Mono NF"', '"Cascadia Code"', '"Cascadia Mono"', '"JetBrains Mono"', 'Consolas', '"Symbols Nerd Font Mono"',
    '"Symbols Nerd Font Legacy"', '"Courier New"', 'monospace'].filter(Boolean).join(',');
  function applyTermFont() {
    const f = termFont();
    byPty.forEach(({ term }) => { term.options.fontFamily = f; try { term.refresh(0, term.rows - 1); } catch {} });
    requestAnimationFrame(() => tabs.forEach((t) => { try { t.fit.fit(); } catch {} if (t.claude) try { t.claude.fit.fit(); } catch {} }));
  }
  // Quando as fontes embutidas terminam de carregar, redesenha os terminais já abertos.
  Promise.all([document.fonts.load('14px "Symbols Nerd Font Mono"', '\ue0b0'), document.fonts.load('14px "Symbols Nerd Font Legacy"', '\uf7a1'),
    document.fonts.load('14px "JetBrains Mono"')]).then(applyTermFont).catch(() => {});
  function makeTerm(container, getId, { onPrompt, onTitle, onInput } = {}) {
    const term = new Terminal({
      theme: xtermTheme(), fontFamily: termFont(),
      // Altura de linha 1: as faixas e setas dos prompts (powerline) encostam umas nas outras, como no Windows Terminal.
      fontSize, lineHeight: 1, cursorBlink: true, cursorStyle: 'bar', cursorWidth: 2, scrollback: 10000, allowProposedApi: true,
    });
    const fit = new FitAddon.FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon.WebLinksAddon((_e, url) => neo.openExternal(url)));
    // Larguras de caracteres do Unicode 11 (emoji, ícones), as mesmas que o Windows usa: evita prompt desalinhado.
    term.loadAddon(new Unicode11Addon.Unicode11Addon());
    const serializer = new SerializeAddon.SerializeAddon(); // permite levar a tela junto ao mover a aba de janela
    term.loadAddon(serializer);
    term.unicode.activeVersion = '11';
    term.open(container);
    term.onData((d) => { onInput?.(d); neo.write(getId(), d); });
    if (onTitle) term.onTitleChange(onTitle);
    term.parser.registerOscHandler(9, (data) => {
      if (data.startsWith('9;')) { onPrompt?.(data.slice(2).replace(/^"|"$/g, '')); return true; }
      return false;
    });
    term.attachCustomKeyEventHandler((e) => {
      if (e.type !== 'keydown') return true;
      const k = e.key.toLowerCase();
      if (e.ctrlKey && !e.shiftKey && k === 'c' && term.hasSelection()) { navigator.clipboard.writeText(term.getSelection()); term.clearSelection(); return false; }
      if (e.ctrlKey && e.shiftKey && k === 'c') { navigator.clipboard.writeText(term.getSelection()); return false; }
      return !isAppShortcut(e);
    });
    container.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (term.hasSelection()) { navigator.clipboard.writeText(term.getSelection()); term.clearSelection(); }
      else navigator.clipboard.readText().then((t) => t && term.paste(t));
    });
    const ro = new ResizeObserver(() => {
      if (!container.offsetParent) return;
      try { fit.fit(); neo.resize(getId(), term.cols, term.rows); } catch {}
    });
    ro.observe(container);
    return { term, fit, ro, serializer };
  }

  // Inicia (ou reinicia) o processo de um terminal. `hold`: no cmd, esconde o texto de abertura
  // (versão do Windows, Clink...) até o primeiro prompt.
  function spawnPty(owner, kind, cwd, term, distro) {
    owner.gen = (owner.gen || 0) + 1;
    if (owner.ptyId) { neo.kill(owner.ptyId); byPty.delete(owner.ptyId); }
    owner.ptyId = `${WIN_TAG}-${owner.id}.${owner.gen}`;
    const entry = { term, owner, hold: null };
    if ((isWin && kind === 'cmd') || (kind !== 'claude' && store.get('neo.debugHold', false))) {
      entry.hold = { buf: '', timer: setTimeout(() => (entry.hold?.clink ? clinkRedraw(entry) : release(entry, true)), 2500) };
    }
    byPty.set(owner.ptyId, entry);
    owner.startedAt = Date.now();
    neo.create({ id: owner.ptyId, kind, cwd, distro, cols: term.cols, rows: term.rows });
  }
  function release(entry, all) {
    const hd = entry.hold;
    if (!hd) return;
    clearTimeout(hd.timer); entry.hold = null;
    const i = hd.buf.indexOf('\x1b]9;9;');
    entry.term.write(all || i < 0 ? hd.buf : hd.buf.slice(i));
  }
  // Com o Clink: espera ele terminar de imprimir a abertura (logo, aviso de atualização), descarta tudo
  // e pede ao Clink para limpar a tela (Ctrl+L). Ele redesenha o prompt no topo, sem espaço vazio antes.
  function clinkRedraw(entry) {
    const hd = entry.hold;
    if (!hd) return;
    clearTimeout(hd.timer); clearTimeout(hd.quiet);
    entry.hold = null;
    const cwds = [...hd.buf.matchAll(/\x1b\]9;9;([^\x07\x1b]*)/g)];
    entry.term.reset();
    if (cwds.length) entry.term.write(`\x1b]9;9;${cwds[cwds.length - 1][1]}\x1b\\`); // mantém a pasta atual
    neo.write(entry.owner.ptyId, '\x0c');
  }
  function feed(id, data) {
    const entry = byPty.get(id);
    if (!entry) return;
    entry.owner.onFirstData?.();
    if (!entry.hold) return entry.term.write(data);
    const hd = entry.hold;
    hd.buf += data;
    if (hd.clink || hd.buf.includes('\x1b]9;9999;clink')) {
      hd.clink = true;
      clearTimeout(hd.quiet);
      hd.quiet = setTimeout(() => clinkRedraw(entry), 250); // 250 ms sem saída = Clink terminou a abertura
      return;
    }
    if (hd.buf.includes('\x1b]9;9;')) release(entry, false);
    else if (hd.buf.length > 200000) release(entry, true);
  }

  /* =================== abas =================== */
  async function newTab(opts = {}) {
    if (!home) home = await neo.home();
    const sh = opts.kind ? { kind: opts.kind, distro: opts.distro } : shellOf(defaultShell);
    const kind = sh.kind, distro = sh.distro;
    let cwd = opts.cwd || (active && active.cwd) || home;
    // Caminho do WSL numa aba que não é WSL (ou vice-versa): começa na pasta pessoal.
    if (kind !== 'wsl' && kind !== 'claude' && isWslPath(cwd)) cwd = home;
    const id = 't' + ++seq;
    const pane = h('div', 'term-pane');
    termsEl.appendChild(pane);
    const tab = {
      id, kind, distro, cwd, pane, title: opts.title || null, custom: !!opts.title, claude: null,
      history: [cwd], hIndex: 0, atPrompt: false, busy: false, pending: [], navFlag: false,
    };
    const el = h('div', 'tab');
    el.draggable = true; el.dataset.kind = kind;
    el.innerHTML = '<span class="fav"></span><span class="label"></span><button class="close" title="Fechar (Ctrl+W)"><svg viewBox="0 0 16 16" width="12" height="12"><path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></button><span class="curve-r"></span>';
    tab.el = el;
    el.addEventListener('mousedown', (e) => {
      if (e.target.isContentEditable) return;
      if (e.button === 1) { e.preventDefault(); closeTab(tab); }
      else if (e.button === 0 && !e.target.closest('.close')) activate(tab);
    });
    el.querySelector('.close').addEventListener('click', (e) => { e.stopPropagation(); closeTab(tab); });
    el.addEventListener('dblclick', (e) => { if (!e.target.closest('.close')) renameTab(tab); });
    wireDrag(tab);
    tabsEl.appendChild(el);
    tabs.push(tab);

    Object.assign(tab, makeTerm(pane, () => tab.ptyId, {
      onPrompt: (p) => onPrompt(tab, p),
      onTitle: (t) => { if (!tab.custom) { tab.termTitle = t; refreshTab(tab); } },
      onInput: (d) => { if (d.includes('\r') && tab.kind !== 'claude') markBusy(tab); },
    }));
    setKindVisual(tab);
    activate(tab);
    if (opts.adopt) { adoptPty(tab, opts.adopt); return tab; }
    spawnPty(tab, kind, cwd, tab.term, distro);
    if (opts.run) tab.pending.push(opts.run);
    if (opts.env) applyEnv(tab, opts.env);
    if (kind !== 'claude' && ntpEnabled && opts.ntp !== false) showNtp(tab);
    refreshTab(tab);
    return tab;
  }

  function setKindVisual(tab) {
    tab.el.dataset.kind = tab.kind;
    tab.el.querySelector('.fav').textContent = KIND_ICON[tab.kind] || '$_';
    const env = envById(tab.envId);
    tab.el.classList.toggle('env', !!env);
    if (env) tab.el.style.setProperty('--env', env.color);
  }

  // Cada prompt novo informa a pasta atual: atualiza aba, histórico, favoritos e visitas.
  function onPrompt(tab, p) {
    const wasBusy = tab.busy;
    clearTimeout(tab.busyTimer);
    tab.atPrompt = true; tab.busy = false; tab.promptAware = true;
    if (p && !samePath(p, tab.cwd)) {
      tab.cwd = p;
      if (tab.navFlag) tab.navFlag = false;
      else if (!samePath(tab.history[tab.hIndex], p)) {
        tab.history = tab.history.slice(0, tab.hIndex + 1); tab.history.push(p); tab.hIndex = tab.history.length - 1;
      }
      recordVisit(p, tab.distro);
    } else if (p && !tab.visited) { tab.cwd = p; recordVisit(p, tab.distro); }
    tab.visited = true;
    tab.el.classList.remove('busy');
    if (wasBusy && tab !== active) tab.el.classList.add('done');
    refreshTab(tab);
    if (tab === active) updateToolbar();
    const next = tab.pending.shift();
    if (next) setTimeout(() => runIn(tab, next), 30);
  }
  function markBusy(tab) {
    tab.atPrompt = false;
    if (!tab.promptAware) return; // sem aviso de prompt, não há como saber quando o comando termina
    clearTimeout(tab.busyTimer);
    tab.busyTimer = setTimeout(() => {
      if (tab.atPrompt) return;
      tab.busy = true; tab.el.classList.add('busy');
      if (tab === active) updateToolbar();
    }, 450);
    if (tab === active) updateToolbar();
  }

  function renameTab(tab) {
    const label = tab.el.querySelector('.label');
    label.contentEditable = 'true'; label.spellcheck = false; label.focus();
    getSelection().selectAllChildren(label);
    const done = (save) => {
      label.contentEditable = 'false';
      label.removeEventListener('blur', onBlur); label.removeEventListener('keydown', onKey);
      if (save) { const v = label.textContent.trim(); tab.title = v || null; tab.custom = !!v; }
      refreshTab(tab); focusActive();
    };
    const onBlur = () => done(true);
    const onKey = (e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); done(true); } else if (e.key === 'Escape') { e.preventDefault(); done(false); } };
    label.addEventListener('blur', onBlur); label.addEventListener('keydown', onKey);
  }

  function labelOf(tab) {
    if (tab.title) return tab.title;
    if (tab.ntp) return 'Nova aba';
    const env = envById(tab.envId);
    if (env) return env.name;
    if (tab.kind === 'claude') return 'Claude';
    return baseName(tab.cwd) || tab.termTitle || KIND_LABEL[tab.kind];
  }
  function refreshTab(tab) {
    const label = tab.el.querySelector('.label');
    if (!label.isContentEditable) label.textContent = labelOf(tab);
    tab.el.title = `${labelOf(tab)}\n${tab.cwd || ''}`;
    if (tab === active) document.title = labelOf(tab) + ' — Neo CMD';
  }
  function activate(tab) {
    if (!tab) return;
    hideHome();
    active = tab;
    tab.el.classList.remove('done');
    tabs.forEach((t) => {
      t.el.classList.toggle('active', t === tab);
      t.pane.classList.toggle('active', t === tab);
      if (t.claude) t.claude.el.classList.toggle('active', t === tab);
    });
    refreshTab(tab); updateToolbar();
    requestAnimationFrame(() => { try { tab.fit.fit(); } catch {} focusActive(); });
    if (!sidebar.classList.contains('hidden')) ensureClaude(tab);
  }
  const focusActive = () => { if (homeVisible) { $('input', homeEl || document.createElement('div'))?.focus(); return; } if (!active) return; if (active.ntp) $('input', active.ntp)?.focus(); else active.term.focus(); };

  function closeTab(tab, { keepPty = false } = {}) {
    const i = tabs.indexOf(tab);
    if (i < 0) return;
    if (!keepPty) {
      closed.push({ kind: tab.kind, distro: tab.distro, cwd: tab.cwd, title: tab.title, envId: tab.envId });
      if (closed.length > 25) closed.shift();
      neo.kill(tab.ptyId);
    }
    byPty.delete(tab.ptyId); tab.ro.disconnect(); tab.term.dispose(); tab.pane.remove();
    if (tab.claude) disposeClaude(tab);
    tab.el.remove(); tabs.splice(i, 1);
    if (!tabs.length) { if (keepPty) window.close(); else { active = null; showHome(); } return; }
    if (active === tab) activate(tabs[Math.min(i, tabs.length - 1)]);
  }
  const cycle = (dir) => tabs.length > 1 && activate(tabs[(tabs.indexOf(active) + dir + tabs.length) % tabs.length]);
  function reopenClosed() {
    const c = closed.pop();
    if (c) newTab({ kind: c.kind, distro: c.distro, cwd: c.cwd, title: c.title, ntp: false }).then((t) => { if (c.envId && envById(c.envId)) { t.envId = c.envId; setKindVisual(t); refreshTab(t); } });
  }

  /* ---------- menus sempre dentro da janela ---------- */
  // Limita a altura (com rolagem) e empurra o menu para dentro da tela quando a janela é pequena.
  function fitMenu(el) {
    if (el.classList.contains('hidden')) return;
    el.style.maxHeight = '';
    const r = el.getBoundingClientRect();
    const margin = 8;
    if (r.right > window.innerWidth - margin) el.style.left = Math.max(margin, window.innerWidth - margin - r.width) + 'px';
    const top = el.getBoundingClientRect().top;
    el.style.maxHeight = Math.max(120, window.innerHeight - top - margin) + 'px';
  }
  window.addEventListener('resize', () => document.querySelectorAll('.menu').forEach((m) => m.classList.add('hidden')));

  /* ---------- várias janelas ---------- */
  // Move a aba para uma janela nova: o terminal continua rodando e a tela vai junto.
  async function moveToNewWindow(tab, bounds) {
    if (tab.ntp) hideNtp(tab);
    const payload = {
      ptyId: tab.ptyId, kind: tab.kind, distro: tab.distro, cwd: tab.cwd, title: tab.title, custom: tab.custom, envId: tab.envId,
      history: tab.history, hIndex: tab.hIndex, atPrompt: tab.atPrompt, promptAware: tab.promptAware, visited: tab.visited,
      buffer: (() => { try { return tab.serializer.serialize({ scrollback: 2000 }); } catch { return ''; } })(), bounds,
    };
    const ok = await neo.moveTab(payload);
    if (!ok) { toast('Não foi possível mover esta aba.'); return; }
    if (tab.claude) disposeClaude(tab);
    closeTab(tab, { keepPty: true });
  }
  // A janela nova assume o terminal de uma aba movida.
  function adoptPty(tab, a) {
    tab.ptyId = a.ptyId; tab.gen = 0;
    byPty.set(tab.ptyId, { term: tab.term, owner: tab, hold: null });
    Object.assign(tab, { title: a.title || null, custom: !!a.custom, envId: a.envId || null, history: a.history || [tab.cwd],
      hIndex: a.hIndex || 0, atPrompt: !!a.atPrompt, promptAware: !!a.promptAware, visited: !!a.visited });
    if (a.buffer) tab.term.write(a.buffer);
    if (a.pending) tab.term.write(a.pending);
    setKindVisual(tab); refreshTab(tab); updateToolbar();
    requestAnimationFrame(() => { try { tab.fit.fit(); neo.resize(tab.ptyId, tab.term.cols, tab.term.rows); } catch {} });
  }
  const duplicateTab = (tab) => newTab({ kind: tab.kind, distro: tab.distro, cwd: tab.cwd, ntp: false }).then((t) => {
    const env = envById(tab.envId); if (env) { t.envId = env.id; setKindVisual(t); refreshTab(t); }
  });
  const closeOthers = (tab) => tabs.filter((t) => t !== tab).forEach((t) => closeTab(t));
  // Shift+clique: abrir numa janela nova (como num link do navegador).
  const openInNewWindow = (open) => neo.newWindow(open);

  const tabMenu = h('div', 'menu tab-menu hidden');
  document.body.appendChild(tabMenu);
  function openTabMenu(tab, x, y) {
    tabMenu.innerHTML = '';
    const add = (label, fn, kbd) => {
      const b = h('button'); b.appendChild(h('span', null, label));
      if (kbd) b.appendChild(h('span', 'kbd', kbd));
      b.onclick = () => { tabMenu.classList.add('hidden'); fn(); };
      tabMenu.appendChild(b);
    };
    add('Mover para nova janela', () => moveToNewWindow(tab));
    add('Duplicar aba', () => duplicateTab(tab));
    add('Renomear', () => renameTab(tab), 'duplo clique');
    tabMenu.appendChild(h('div', 'sep'));
    if (tabs.length > 1) add('Fechar as outras abas', () => closeOthers(tab));
    add('Fechar aba', () => closeTab(tab), 'Ctrl+W');
    tabMenu.style.left = Math.min(x, window.innerWidth - 250) + 'px';
    tabMenu.style.top = y + 'px';
    tabMenu.style.right = 'auto';
    tabMenu.classList.remove('hidden');
    fitMenu(tabMenu);
  }
  document.addEventListener('mousedown', (e) => { if (!e.target.closest('.tab-menu')) tabMenu.classList.add('hidden'); });

  let dragged = null;
  function wireDrag(tab) {
    const el = tab.el;
    el.addEventListener('dragstart', (e) => { dragged = tab; el.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
    el.addEventListener('dragend', (e) => {
      dragged = null; tabs.forEach((t) => t.el.classList.remove('dragging', 'drop-before', 'drop-after'));
      // Soltou fora da janela: a aba vai para uma janela nova, onde foi solta (como no Chrome).
      const out = e.screenX < window.screenX || e.screenX > window.screenX + window.outerWidth ||
        e.screenY < window.screenY || e.screenY > window.screenY + window.outerHeight;
      if (out && (e.screenX || e.screenY)) moveToNewWindow(tab, { x: e.screenX - 120, y: e.screenY - 20 });
    });
    el.addEventListener('contextmenu', (e) => { e.preventDefault(); activate(tab); openTabMenu(tab, e.clientX, e.clientY); });
    el.addEventListener('dragover', (e) => {
      if (!dragged || dragged === tab) return;
      e.preventDefault();
      const before = e.clientX < el.getBoundingClientRect().left + el.offsetWidth / 2;
      el.classList.toggle('drop-before', before); el.classList.toggle('drop-after', !before);
    });
    el.addEventListener('dragleave', () => el.classList.remove('drop-before', 'drop-after'));
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      if (!dragged || dragged === tab) return;
      const before = el.classList.contains('drop-before');
      tabs.splice(tabs.indexOf(dragged), 1);
      tabs.splice(tabs.indexOf(tab) + (before ? 0 : 1), 0, dragged);
      tabs.forEach((t) => tabsEl.appendChild(t.el));
    });
  }

  /* =================== navegação =================== */
  // Livre = no prompt. Se o shell nunca avisou o prompt (prompt personalizado sem suporte), assume livre.
  const isFree = (tab) => tab.atPrompt || !tab.promptAware;
  const quote = (kind, p) => {
    if (kind === 'wsl') { const lp = isPosixPath(p) ? p : winToWsl(p); return `cd '${lp.replace(/'/g, `'\\''`)}'`; }
    if (kind === 'cmd') return `cd /d "${p}"`;
    if (kind === 'powershell' || kind === 'pwsh') return `Set-Location -LiteralPath '${p.replace(/'/g, "''")}'`;
    return `cd '${p.replace(/'/g, `'\\''`)}'`;
  };
  // Vai para uma pasta: na aba atual se o shell estiver livre; senão, numa aba nova (como o navegador).
  function openFolder(p, { fromHistory = false, tab = active } = {}) {
    if (!p) return;
    // Pasta do WSL fora de uma aba WSL: abre como WSL (na distro em que ela foi visitada).
    if (isWslPath(p) && tab.kind !== 'wsl') {
      const distro = visits[p]?.d;
      if (tab.ntp) hideNtp(tab, { respawnIn: p, kind: 'wsl', distro });
      else newTab({ kind: 'wsl', distro, cwd: p, ntp: false });
      return;
    }
    if (tab.ntp) { hideNtp(tab, { respawnIn: p }); return; }
    if (tab.kind === 'claude' || !isFree(tab)) { newTab({ cwd: p, ntp: false }); return; }
    if (samePath(p, tab.cwd)) { focusActive(); return; }
    tab.navFlag = fromHistory;
    runIn(tab, quote(tab.kind, p));
    focusActive();
  }
  function runIn(tab, cmd) {
    if (tab.ntp) hideNtp(tab);
    if (!isFree(tab)) { tab.pending.push(cmd); return; }
    neo.write(tab.ptyId, cmd + '\r');
    markBusy(tab);
  }
  function runCommand(cmd) {
    const tab = active;
    if (tab.kind === 'claude') { newTab({ cwd: tab.cwd, run: cmd, ntp: false }); return; }
    if (!isFree(tab) && tab.visited) { newTab({ kind: tab.kind, distro: tab.distro, cwd: tab.cwd, run: cmd, ntp: false }); return; }
    if (tab.ntp) { hideNtp(tab); tab.pending.push(cmd); if (isFree(tab)) onPromptFlush(tab); focusActive(); return; }
    runIn(tab, cmd); focusActive();
  }
  const onPromptFlush = (tab) => { const next = tab.pending.shift(); if (next) runIn(tab, next); };
  function goBack() { const t = active; if (!t || homeVisible) return; if (t.hIndex > 0 && isFree(t)) { t.hIndex--; openFolder(t.history[t.hIndex], { fromHistory: true }); updateToolbar(); } }
  function goForward() { const t = active; if (!t || homeVisible) return; if (t.hIndex < t.history.length - 1 && isFree(t)) { t.hIndex++; openFolder(t.history[t.hIndex], { fromHistory: true }); updateToolbar(); } }
  async function goUp() { if (!active || homeVisible) return; const p = await neo.parent(active.cwd); if (p) openFolder(p); }

  /* =================== barra de ferramentas =================== */
  const omni = $('#omni'), omniInput = $('#omni-input'), crumbs = $('#omni-crumbs');
  let gitSeq = 0;
  function updateToolbar() {
    const t = active;
    $('#brand').classList.toggle('on', homeVisible);
    if (homeVisible || !t) {
      ['#nav-back', '#nav-fwd', '#nav-up', '#nav-clear'].forEach((sel) => { $(sel).disabled = true; });
      const chip = $('#omni-chip'); chip.textContent = 'Início'; chip.classList.remove('busy');
      $('#omni-star').classList.toggle('on', isBookmarked(home));
      renderCrumbs(home); renderEnvButton();
      $('#omni-git').classList.add('hidden');
      document.title = 'Neo CMD';
      return;
    }
    const shellTab = t.kind !== 'claude' && !t.ntp;
    $('#nav-back').disabled = !(shellTab && isFree(t) && t.hIndex > 0);
    $('#nav-fwd').disabled = !(shellTab && isFree(t) && t.hIndex < t.history.length - 1);
    $('#nav-up').disabled = !(t.cwd && t.kind !== 'claude');
    $('#nav-clear').disabled = !!t.ntp;
    const chip = $('#omni-chip');
    chip.textContent = t.ntp ? 'Nova aba' : kindLabel(t.kind, t.distro);
    chip.classList.toggle('busy', !!t.busy);
    $('#omni-star').classList.toggle('on', isBookmarked(t.cwd));
    renderCrumbs(t.cwd);
    renderEnvButton();
    // Na pasta pessoal, o Claude abre numa pasta própria de conversas gerais (ele nunca grava a confiança na pasta pessoal).
    $('#sidebar-cwd').textContent = samePath(t.cwd, home) ? 'conversa geral' : shortPath(t.cwd);
    const my = ++gitSeq, git = $('#omni-git');
    neo.gitBranch(t.cwd, t.distro).then((b) => { if (my !== gitSeq) return; git.classList.toggle('hidden', !b); git.textContent = b ? '⎇ ' + b : ''; });
  }
  function renderCrumbs(p) {
    crumbs.innerHTML = '';
    const inner = h('div', 'crumbs-inner');
    crumbs.appendChild(inner);
    if (!p) return;
    const sep = sepOf(p);
    const items = [];
    if (underHome(p)) {
      items.push({ label: '~', path: home });
      const rest = p.slice(home.length).split(/[\\/]/).filter(Boolean);
      let acc = home;
      rest.forEach((s) => { acc = acc.replace(/[\\/]$/, '') + sep + s; items.push({ label: s, path: acc }); });
    } else {
      const parts = p.split(/[\\/]/).filter(Boolean);
      if (p.startsWith('/')) items.push({ label: '/', path: '/' });
      let acc = p.startsWith('/') ? '' : null;
      parts.forEach((s, i) => {
        if (acc === null) { acc = s + (/:$/.test(s) ? sep : ''); items.push({ label: s, path: acc }); return; }
        acc = acc.replace(/[\\/]$/, '') + sep + s; items.push({ label: s, path: i === 0 && acc === '' ? '/' : acc });
      });
    }
    items.forEach((it, i) => {
      if (i > 0) inner.appendChild(h('span', 'crumb-sep', '›'));
      const c = h('span', 'crumb' + (i === items.length - 1 ? ' last' : ''), it.label);
      c.title = it.path;
      c.addEventListener('mousedown', (e) => {
        e.stopPropagation(); e.preventDefault();
        if (e.button === 1 || e.ctrlKey) newTab({ cwd: it.path, ntp: false }); else openFolder(it.path);
      });
      inner.appendChild(c);
    });
    requestAnimationFrame(() => crumbs.classList.toggle('overflow', inner.scrollWidth > crumbs.clientWidth));
  }

  /* ---------- sugestões (barra de endereço e página de nova aba) ---------- */
  // Na página inicial (ou sem abas), abrir algo cria uma aba nova; numa aba, a ação acontece nela.
  const atHome = () => homeVisible || !active;
  const homeCtx = () => { const sh = shellOf(defaultShell); return { cwd: home, kind: sh.kind, distro: sh.distro }; };
  const homeOpen = (p) => newTab({ cwd: p, ntp: false, ...(isWslPath(p) ? { kind: 'wsl', distro: visits[p]?.d } : {}) });
  const OPS = () => (atHome()
    ? { open: homeOpen, run: (cmd) => newTab({ cwd: home, run: cmd, ntp: false }), ask: (q) => newTab({ ntp: false }).then(() => askClaude(q)), env: (e) => openEnv(e, { forceNew: true }) }
    : { open: (p) => openFolder(p), run: runCommand, ask: askClaude, env: (e) => openEnv(e) });
  const envSug = (env, q) => ({ ico: '◆', cls: 'env', color: env.color, title: env.name, sub: `Ambiente · ${envSub(env)}`, q,
    run: () => OPS().env(env), alt: () => openEnv(env, { forceNew: true }) });
  const ACTIONS = () => [
    ...envs.map((e) => ({ ...envSug(e), title: `Ambiente: ${e.name}` })),
    { ico: '+', cls: 'act', title: 'Novo ambiente de trabalho', run: () => editEnv() },
    { ico: '◆', cls: 'act', title: 'Salvar esta aba como ambiente', run: () => editEnv(null, { fromTab: active }) },
    ...SHELLS.map((x) => ({ ico: KIND_ICON[x.kind], cls: 'act', title: `Nova aba: ${x.label}`, run: () => newTab({ kind: x.kind, distro: x.distro, ntp: false }) })),
    { ico: '✦', cls: 'ask', title: 'Nova aba do Claude Code', run: () => newTab({ kind: 'claude' }) },
    { ico: '◐', cls: 'act', title: 'Abrir/fechar a sidebar do Claude', run: () => toggleSidebar() },
    ...Object.entries(THEMES).map(([id, t]) => ({ ico: '●', cls: 'act', title: `Tema: ${t.label}`, run: () => applyTheme(id) })),
    { ico: '★', cls: 'act', title: 'Favoritar/desfavoritar esta pasta', run: () => toggleBookmark() },
    { ico: '↺', cls: 'act', title: 'Reabrir aba fechada', run: () => reopenClosed() },
    { ico: 'A+', cls: 'act', title: 'Aumentar a fonte', run: () => setZoom(fontSize + 1) },
    { ico: 'A−', cls: 'act', title: 'Diminuir a fonte', run: () => setZoom(fontSize - 1) },
  ];
  const mark = (text, q) => {
    const i = text.toLowerCase().indexOf(q.toLowerCase());
    const span = h('span', 's-title');
    if (!q || i < 0) { span.textContent = text; return span; }
    span.append(text.slice(0, i), h('b', null, text.slice(i, i + q.length)), text.slice(i + q.length));
    return span;
  };
  async function suggest(q) {
    const t = atHome() ? homeCtx() : active, out = [], ops = OPS();
    const raw = q.trim();
    if (!raw) {
      frecent().filter((p) => !samePath(p, t.cwd)).slice(0, 6)
        .forEach((p) => out.push({ ico: '', cls: 'dir', folder: p, title: baseName(p), sub: shortPath(p), run: () => ops.open(p), alt: () => newTab({ cwd: p, ntp: false }) }));
      return out;
    }
    if (raw.startsWith('@')) {
      const f = raw.slice(1).trim().toLowerCase();
      const list = envs.filter((e) => e.name.toLowerCase().includes(f)).map((e) => envSug(e, f));
      list.push({ ico: '+', cls: 'act', title: f ? `Novo ambiente "${raw.slice(1).trim()}"` : 'Novo ambiente de trabalho', run: () => editEnv(null, { name: raw.slice(1).trim(), fromTab: active }) });
      return list;
    }
    if (raw.startsWith('>')) {
      const f = raw.slice(1).trim().toLowerCase();
      return ACTIONS().filter((a) => a.title.toLowerCase().includes(f)).slice(0, 8).map((a) => ({ ...a, q: f }));
    }
    if (raw.startsWith('?')) {
      const text = raw.slice(1).trim();
      return [{ ico: '✦', cls: 'ask', title: text ? `Perguntar ao Claude: ${text}` : 'Digite a pergunta para o Claude', run: () => text && ops.ask(text) }];
    }
    if (looksLikePath(raw)) {
      const r = await neo.complete(t.cwd, raw, t.kind === 'wsl' ? t.distro || wslDefault : undefined);
      if (r.exact) out.push({ ico: '', cls: 'dir', folder: r.exact, title: `Ir para ${baseName(r.exact)}`, sub: r.exact, run: () => ops.open(r.exact), alt: () => newTab({ cwd: r.exact, ntp: false }), fill: r.exact });
      r.items.filter((it) => !samePath(it.path, r.exact))
        .forEach((it) => out.push({ ico: '', cls: 'dir', folder: it.path, title: it.name, sub: it.path, run: () => ops.open(it.path), alt: () => newTab({ cwd: it.path, ntp: false }), fill: it.path + sepOf(it.path) }));
      if (!out.length) out.push({ ico: '>_', cls: 'run', title: `Executar: ${raw}`, run: () => ops.run(raw) });
      return out;
    }
    out.push({ ico: '>_', cls: 'run', title: `Executar: ${raw}`, sub: atHome() || t.kind === 'claude' ? 'em uma aba nova' : `em ${shortPath(t.cwd)}`, run: () => ops.run(raw), key: 'Enter' });
    const ql = raw.toLowerCase();
    envs.filter((e) => e.name.toLowerCase().includes(ql)).slice(0, 3).forEach((e) => out.push(envSug(e, raw)));
    const dirs = [...new Set([...bookmarks, ...frecent()])].filter((p) => baseName(p).toLowerCase().includes(ql)).slice(0, 4);
    dirs.forEach((p) => out.push({ ico: '', cls: 'dir', folder: p, title: baseName(p), sub: shortPath(p), q: raw, run: () => ops.open(p), alt: () => newTab({ cwd: p, ntp: false }) }));
    out.push({ ico: '✦', cls: 'ask', title: `Perguntar ao Claude: ${raw}`, sub: 'abre a sidebar com a pergunta', run: () => ops.ask(raw) });
    return out;
  }

  // Liga um campo de texto ao motor de sugestões.
  function attachOmni(input, pop, container, { onDone, showOnEmpty = true } = {}) {
    let list = [], sel = 0, reqId = 0;
    const close = () => { pop.classList.add('hidden'); container.classList.remove('has-pop'); list = []; };
    const render = () => {
      pop.innerHTML = '';
      if (!list.length) { close(); return; }
      list.forEach((s, i) => {
        const row = h('div', 'sug' + (i === sel ? ' sel' : ''));
        const ico = h('span', 's-ico ' + (s.cls || ''), s.folder ? '' : s.ico);
        if (s.folder) ico.appendChild(miniFolder(folderColor(s.folder)));
        if (s.color) ico.style.color = s.color;
        const main = h('div', 's-main');
        main.appendChild(mark(s.title, s.q || ''));
        if (s.sub) main.appendChild(h('span', 's-sub', s.sub));
        row.append(ico, main);
        if (i === sel && s.key) row.appendChild(h('span', 's-key', s.key));
        row.addEventListener('mousedown', (e) => { e.preventDefault(); pick(s, e.button === 1 || e.ctrlKey); });
        row.addEventListener('mousemove', () => { if (sel !== i) { sel = i; render(); } });
        pop.appendChild(row);
      });
      pop.classList.remove('hidden'); container.classList.add('has-pop');
    };
    const refresh = async () => {
      if (!showOnEmpty && !input.value.trim()) { ++reqId; close(); return; }
      const my = ++reqId; const r = await suggest(input.value); if (my !== reqId) return; list = r; sel = 0; render(); };
    const pick = (s, alt) => { close(); onDone?.(); (alt && s.alt ? s.alt : s.run)(); };
    input.addEventListener('input', refresh);
    input.addEventListener('focus', refresh);
    input.addEventListener('blur', () => setTimeout(close, 120));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' && list.length) { e.preventDefault(); sel = (sel + 1) % list.length; render(); }
      else if (e.key === 'ArrowUp' && list.length) { e.preventDefault(); sel = (sel - 1 + list.length) % list.length; render(); }
      else if (e.key === 'Tab' && list[sel]?.fill) { e.preventDefault(); input.value = list[sel].fill; refresh(); }
      else if (e.key === 'Enter') { e.preventDefault(); if (list[sel]) pick(list[sel], e.ctrlKey); else if (!input.value.trim()) { onDone?.(); focusActive(); } }
      else if (e.key === 'Escape') { e.preventDefault(); close(); onDone?.(); input.blur(); focusActive(); }
    });
    return { refresh, close };
  }

  function startEditing() {
    omni.classList.add('editing');
    omniInput.value = !homeVisible && active?.cwd ? shortPath(active.cwd) : '';
    omniInput.focus(); omniInput.select();
  }
  const stopEditing = () => omni.classList.remove('editing');
  attachOmni(omniInput, $('#omni-pop'), omni, { onDone: stopEditing });
  omniInput.addEventListener('blur', () => setTimeout(stopEditing, 130));
  omni.addEventListener('mousedown', (e) => {
    if (e.target.closest('.omni-star') || e.target.closest('.omni-pop') || omni.classList.contains('editing')) return;
    e.preventDefault(); startEditing();
  });
  $('#omni-star').onclick = () => toggleBookmark();
  $('#nav-back').onclick = goBack;
  $('#nav-fwd').onclick = goForward;
  $('#nav-up').onclick = goUp;
  $('#nav-clear').onclick = () => { if (active && !active.ntp) { active.term.clear(); focusActive(); } };

  /* =================== página de nova aba =================== */
  async function showNtp(tab) {
    const page = await buildStart(tab);
    tab.ntp = page;
    tab.pane.appendChild(page);
    refreshTab(tab); if (tab === active) { updateToolbar(); setTimeout(() => $('input', page)?.focus(), 30); }
  }
  // Página inicial (logo): mesma página, mas sem aba; abrir qualquer coisa cria uma aba nova.
  async function showHome() {
    homeVisible = true;
    document.body.classList.add('at-home');
    updateToolbar();
    const page = await buildStart(null);
    if (!homeVisible) return;
    page.classList.add('home');
    if (homeEl) homeEl.remove();
    homeEl = page;
    termsEl.appendChild(page);
    setTimeout(() => $('input', page)?.focus(), 30);
  }
  function hideHome() {
    if (!homeVisible) return;
    homeVisible = false;
    document.body.classList.remove('at-home');
    if (homeEl) homeEl.remove();
    homeEl = null;
    updateToolbar();
  }
  // tab = aba da página de nova aba; null = página inicial.
  async function buildStart(tab) {
    const T = tab || homeCtx();
    const known = await neo.knownDirs();
    const page = h('div', 'ntp');
    const inner = h('div', 'ntp-inner');

    // Onde você está, como numa linha de prompt.
    const where = h('div', 'ntp-where');
    where.append(h('span', 'w-shell', tab ? kindLabel(T.kind, T.distro) : 'início'), h('span', 'w-path', shortPath(T.cwd)));
    neo.gitBranch(T.cwd, T.distro).then((b) => { if (b) where.appendChild(h('span', 'w-git', b)); });

    const search = h('div', 'ntp-search');
    const box = h('div', 'box');
    const input = h('input');
    input.placeholder = 'pasta, comando, @ambiente ou ?pergunta';
    input.spellcheck = false;
    box.append(h('span', 'sign', '❯'), input);
    const pop = h('div', 'omni-pop hidden');
    search.append(box, pop);
    attachOmni(input, pop, search, { showOnEmpty: false });
    inner.append(where, search);

    const section = (title, kbd) => {
      const sec = h('section', 'ntp-section');
      const head = h('div', 'sec-head');
      head.appendChild(h('h3', null, title));
      if (kbd) head.appendChild(h('kbd', null, kbd));
      sec.appendChild(head);
      inner.appendChild(sec);
      return sec;
    };

    // Ambientes: uma lista, do mais usado para o menos usado.
    const envSec = section('Ambientes', 'Ctrl+Shift+E');
    const list = h('div', 'env-list');
    [...envs].sort((a, b) => (b.used || 0) - (a.used || 0)).slice(0, 6).forEach((env) => {
      const sh = shellOf(env.shell);
      const row = h('div', 'env-item');
      row.style.setProperty('--env', env.color);
      const name = h('div', 'ei-name');
      name.append(h('span', 'ei-dot'), h('span', null, env.name));
      const edit = h('button', 'ei-edit', 'Editar'); edit.title = 'Editar ambiente';
      edit.addEventListener('mousedown', (e) => { e.stopPropagation(); e.preventDefault(); editEnv(env); });
      row.append(name, h('div', 'ei-shell', kindLabel(sh.kind, sh.distro)), h('div', 'ei-path', shortPath(env.cwd)), edit);
      row.title = env.startup ? `Ao abrir:\n${env.startup}` : env.cwd;
      row.addEventListener('mousedown', (e) => {
        if (e.target.closest('.ei-edit')) return;
        e.preventDefault();
        if (e.button === 0 && e.shiftKey) openInNewWindow({ envId: env.id });
        else if (e.button === 1 || e.ctrlKey) openEnv(env, { forceNew: true });
        else if (e.button === 0) tab ? openEnv(env, { tab }) : openEnv(env, { forceNew: true });
      });
      list.appendChild(row);
    });
    const add = h('div', 'env-item add');
    add.append(h('div', 'ei-name', '+ Novo ambiente'), h('div', 'ei-path', envs.length ? '' : 'Salve pasta, shell e comandos de um projeto para abrir com um clique.'));
    add.addEventListener('mousedown', (e) => { if (e.button !== 0) return; e.preventDefault(); editEnv(null, { fromTab: tab }); });
    list.appendChild(add);
    envSec.appendChild(list);

    // Pastas: favoritas primeiro, depois as mais visitadas, numa prateleira.
    const most = frecent().filter((p) => !isBookmarked(p));
    const paths = [...bookmarks, ...(most.length ? most : known.filter((p) => !isBookmarked(p)))].slice(0, 8);
    if (paths.length) {
      const sec = section(most.length || bookmarks.length ? 'Pastas' : 'Comece por aqui');
      const shelf = h('div', 'shelf');
      paths.forEach((p) => {
        const item = h('div', 'shelf-item');
        const glyph = samePath(p, home) ? '⌂' : isBookmarked(p) ? '★' : isWslPath(p) ? '$' : '';
        item.append(folder3d(folderColor(p), glyph), h('div', 'si-name', samePath(p, home) ? 'Pasta pessoal' : baseName(p) || p));
        item.title = p;
        if (visits[p] && !isBookmarked(p)) {
          const x = h('button', 'si-x', '×'); x.title = 'Remover das mais visitadas';
          x.addEventListener('mousedown', (e) => { e.stopPropagation(); e.preventDefault(); delete visits[p]; store.set('neo.visits', visits); item.remove(); });
          item.appendChild(x);
        }
        item.addEventListener('mousedown', (e) => {
          if (e.target.closest('.si-x')) return;
          e.preventDefault(); // não tira o foco do terminal
          if (e.button === 0 && e.shiftKey) openInNewWindow({ cwd: p, ...(isWslPath(p) ? { kind: 'wsl', distro: visits[p]?.d } : {}) });
          else if (e.button === 1 || e.ctrlKey) newTab({ cwd: p, ntp: false, ...(isWslPath(p) ? { kind: 'wsl', distro: visits[p]?.d } : {}) });
          else if (e.button === 0) tab ? openFolder(p, { tab }) : homeOpen(p);
        });
        shelf.appendChild(item);
      });
      sec.appendChild(shelf);
    }

    // Abrir esta aba com outro shell.
    const starts = h('div', 'starts');
    starts.appendChild(h('span', 'st-label', 'Abrir com'));
    [...SHELLS.map((x) => ({ kind: x.kind, distro: x.distro, t: x.label })), { kind: 'claude', t: 'Claude Code' }].forEach((it) => {
      const b = h('button', 'start', it.t);
      b.type = 'button';
      b.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return; e.preventDefault();
        const cwd = it.kind === 'wsl' ? (isWslPath(T.cwd) ? T.cwd : '~') : isWslPath(T.cwd) ? home : T.cwd;
        if (tab) hideNtp(tab, { respawnIn: cwd, kind: it.kind, distro: it.distro });
        else newTab({ cwd, kind: it.kind, distro: it.distro, ntp: false });
      });
      starts.appendChild(b);
    });
    inner.appendChild(starts);

    const hint = h('div', 'ntp-hint');
    hint.innerHTML = '<span><kbd>Esc</kbd> terminal</span><span><kbd>Ctrl+L</kbd> barra de endereço</span><span><kbd>Alt+←</kbd> voltar</span><span><kbd>Ctrl+D</kbd> favoritar</span><span><kbd>&gt;</kbd> ações</span>';
    inner.appendChild(hint);
    page.appendChild(inner);
    page.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || $('.omni-pop:not(.hidden)', page)) return;
      if (tab) hideNtp(tab); else if (active) { hideHome(); focusActive(); }
    });
    return page;
  }
  // Sai da página de nova aba. Se escolheu outra pasta ou shell, reinicia o processo lá:
  // nada foi exibido ainda, então não aparece nenhum "cd" digitado.
  function hideNtp(tab, { respawnIn, kind, distro } = {}) {
    const page = tab.ntp;
    if (!page) return;
    tab.ntp = null;
        page.classList.add('leaving');
    setTimeout(() => page.remove(), 180);
    const newKind = kind || tab.kind;
    const newDistro = kind ? distro : tab.distro;
    if ((respawnIn && !samePath(respawnIn, tab.cwd)) || newKind !== tab.kind || newDistro !== tab.distro) {
      tab.kind = newKind; tab.distro = newDistro; setKindVisual(tab);
      tab.cwd = respawnIn || tab.cwd; tab.history = [tab.cwd]; tab.hIndex = 0;
      tab.atPrompt = false; tab.visited = false; tab.promptAware = false; tab.term.reset();
      spawnPty(tab, tab.kind, tab.cwd, tab.term, tab.distro);
      if (tab.kind === 'claude') recordVisit(tab.cwd);
      // A conversa do Claude criada na página de nova aba estava na pasta antiga: recomeça na nova.
      if (tab.claude) { disposeClaude(tab); if (!sidebar.classList.contains('hidden')) ensureClaude(tab); }
    }
    refreshTab(tab); if (tab === active) { updateToolbar(); focusActive(); }
  }

  /* =================== ambientes de trabalho =================== */
  // Marca a aba com o ambiente e enfileira os comandos de abertura (um por prompt, na ordem).
  function applyEnv(tab, env) {
    tab.envId = env.id;
    setKindVisual(tab); refreshTab(tab);
    const lines = (env.startup || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    tab.pending.push(...lines);
    if (lines.length && tab.atPrompt) onPromptFlush(tab);
    // Shell que não avisa o prompt: manda tudo de uma vez depois que ele abrir.
    setTimeout(() => { if (!tab.promptAware && tab.pending.length) tab.pending.splice(0).forEach((l) => neo.write(tab.ptyId, l + '\r')); }, 3500);
    env.used = Date.now(); saveEnvs();
    if (env.claude) toggleSidebar(true);
    if (tab === active) updateToolbar();
  }
  // Abre um ambiente: na página de nova aba atual, se houver; senão, numa aba nova.
  async function openEnv(env, { forceNew = false, tab = active } = {}) {
    const sh = shellOf(env.shell);
    if (!forceNew && tab && tab.ntp) {
      hideNtp(tab, { respawnIn: env.cwd, kind: sh.kind, distro: sh.distro });
      applyEnv(tab, env);
      return tab;
    }
    return newTab({ kind: sh.kind, distro: sh.distro, cwd: env.cwd, env, ntp: false });
  }

  // Formulário de criar/editar ambiente.
  function editEnv(env = null, { fromTab = null, name = '' } = {}) {
    closeEnvPop();
    const isNew = !env;
    const src = fromTab && !fromTab.ntp ? fromTab : null;
    const draft = env ? { ...env } : {
      id: 'e' + Date.now().toString(36), name: name || (src ? baseName(src.cwd) : ''),
      color: ENV_COLORS[envs.length % ENV_COLORS.length],
      shell: src && src.kind !== 'claude' ? shellKey(src.kind, src.distro) : defaultShell,
      cwd: src ? src.cwd : (fromTab?.cwd || home), startup: '', claude: false,
    };
    const bg = h('div', 'modal-bg');
    const m = h('div', 'modal');
    const head = h('div', 'modal-head');
    const preview = folder3d(draft.color, '');
    const titles = h('div');
    titles.append(h('div', 'm-title', isNew ? 'Novo ambiente de trabalho' : 'Editar ambiente'),
      h('div', 'm-sub', 'Pasta, shell e comandos de um projeto, para abrir com um clique.'));
    head.append(preview, titles);

    const field = (label, control, hint) => {
      const f = h('label', 'field');
      f.append(h('span', 'f-label', label), control);
      if (hint) f.appendChild(h('span', 'f-hint', hint));
      return f;
    };
    const nameIn = h('input'); nameIn.value = draft.name; nameIn.placeholder = 'Ex.: Loja (Rails)'; nameIn.spellcheck = false;

    const colors = h('div', 'swatches');
    ENV_COLORS.forEach((c) => {
      const sw = h('button', 'sw' + (c === draft.color ? ' on' : ''));
      sw.type = 'button'; sw.style.background = c; sw.title = c;
      sw.onclick = () => { draft.color = c; colors.querySelectorAll('.sw').forEach((x) => x.classList.toggle('on', x === sw)); preview.style.setProperty('--c', c); };
      colors.appendChild(sw);
    });

    const shellSel = h('select');
    const keys = SHELLS.map((x) => x.key);
    if (!keys.includes(draft.shell)) { const o = h('option', null, draft.shell.startsWith('wsl:') ? `WSL · ${draft.shell.slice(4)}` : draft.shell); o.value = draft.shell; shellSel.appendChild(o); }
    SHELLS.forEach((x) => { const o = h('option', null, x.label); o.value = x.key; shellSel.appendChild(o); });
    shellSel.value = draft.shell;

    const cwdRow = h('div', 'row');
    const cwdIn = h('input'); cwdIn.value = draft.cwd; cwdIn.spellcheck = false;
    const useCur = h('button', 'btn ghost', 'Usar a pasta atual'); useCur.type = 'button';
    useCur.onclick = () => { const t = tabs.find((x) => x === fromTab) || active; if (t?.cwd) cwdIn.value = t.cwd; };
    cwdRow.append(cwdIn, useCur);
    const cwdHint = () => (shellOf(shellSel.value).kind === 'wsl' ? 'No WSL, use o caminho do Linux, por exemplo /home/voce/projetos/loja (ou ~).' : 'Por exemplo C:\\projetos\\loja.');
    const hintEl = h('span', 'f-hint', cwdHint());
    shellSel.onchange = () => { hintEl.textContent = cwdHint(); };

    const startIn = h('textarea'); startIn.value = draft.startup || ''; startIn.rows = 4; startIn.spellcheck = false;
    startIn.placeholder = 'Um comando por linha. Ex.:\nrbenv shell 3.3.0\nbundle install\ngit pull';

    const claudeChk = h('label', 'check-row');
    const chk = h('input'); chk.type = 'checkbox'; chk.checked = !!draft.claude;
    claudeChk.append(chk, h('span', null, 'Abrir a sidebar do Claude junto'));

    const cwdField = field('Pasta', cwdRow); cwdField.appendChild(hintEl);
    const body = h('div', 'modal-body');
    body.append(field('Nome', nameIn), field('Cor', colors), field('Shell', shellSel), cwdField,
      field('Comandos ao abrir', startIn, 'Rodam em ordem, um depois do outro, quando o terminal fica pronto.'), claudeChk);

    const foot = h('div', 'modal-foot');
    const del = h('button', 'btn danger', 'Excluir'); del.type = 'button';
    const cancel = h('button', 'btn ghost', 'Cancelar'); cancel.type = 'button';
    const save = h('button', 'btn', 'Salvar'); save.type = 'button';
    const saveOpen = h('button', 'btn primary', 'Salvar e abrir'); saveOpen.type = 'button';
    if (!isNew) foot.appendChild(del);
    foot.append(h('span', 'grow'), cancel, save, saveOpen);
    m.append(head, body, foot);
    bg.appendChild(m);
    document.body.appendChild(bg);
    setTimeout(() => (isNew && !draft.name ? nameIn : nameIn).focus(), 30);

    const close = () => { bg.classList.add('leaving'); setTimeout(() => bg.remove(), 150); focusActive(); };
    const commit = (andOpen) => {
      const nm = nameIn.value.trim(), cwd = cwdIn.value.trim();
      if (!nm) { nameIn.classList.add('bad'); nameIn.focus(); return; }
      if (!cwd) { cwdIn.classList.add('bad'); cwdIn.focus(); return; }
      Object.assign(draft, { name: nm, cwd, shell: shellSel.value, startup: startIn.value.replace(/\s+$/, ''), claude: chk.checked });
      const i = envs.findIndex((e) => e.id === draft.id);
      if (i >= 0) envs[i] = draft; else envs.push(draft);
      saveEnvs();
      tabs.forEach((t) => { if (t.envId === draft.id) { setKindVisual(t); refreshTab(t); } });
      close();
      toast(isNew ? `Ambiente "${nm}" criado` : `Ambiente "${nm}" salvo`);
      // Abre antes de atualizar as páginas de nova aba, para usar a página atual em vez de abrir outra aba.
      if (andOpen) openEnv(draft, { tab: tabs.find((x) => x === fromTab) || active });
      refreshNtps();
    };
    save.onclick = () => commit(false);
    saveOpen.onclick = () => commit(true);
    cancel.onclick = close;
    del.onclick = () => {
      if (del.dataset.confirm !== '1') { del.dataset.confirm = '1'; del.textContent = 'Confirmar exclusão'; return; }
      envs = envs.filter((e) => e.id !== draft.id); saveEnvs();
      tabs.forEach((t) => { if (t.envId === draft.id) { t.envId = null; setKindVisual(t); refreshTab(t); } });
      refreshNtps(); close(); toast(`Ambiente "${draft.name}" excluído`);
    };
    bg.addEventListener('mousedown', (e) => { if (e.target === bg) close(); });
    m.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'Enter' && (e.ctrlKey || e.target.tagName === 'INPUT')) { e.preventDefault(); commit(e.ctrlKey || e.shiftKey); }
    });
  }
  // Recria as páginas de nova aba abertas (para mostrar ambientes novos ou editados).
  function refreshNtps() {
    tabs.forEach((t) => {
      if (!t.ntp || $('input', t.ntp)?.value) return; // não apaga o que a pessoa está digitando
      const old = t.ntp; t.ntp = null; old.remove(); showNtp(t);
    });
  }

  // Botão de ambientes na barra de ferramentas.
  const envPop = $('#env-pop');
  function renderEnvButton() {
    const b = $('#env-btn');
    const env = envById(homeVisible ? null : active?.envId);
    b.classList.toggle('has-env', !!env);
    b.style.setProperty('--env', env ? env.color : 'var(--muted)');
    $('#env-btn-label').textContent = env ? env.name : 'Ambientes';
  }
  const closeEnvPop = () => envPop.classList.add('hidden');
  function openEnvPop() {
    envPop.innerHTML = '';
    envPop.appendChild(h('div', 'hd', 'Ambientes de trabalho'));
    if (!envs.length) envPop.appendChild(h('div', 'empty', 'Nenhum ambiente ainda. Crie um para abrir pasta, shell e comandos de um projeto com um clique.'));
    [...envs].sort((a, b) => (b.used || 0) - (a.used || 0)).forEach((env) => {
      const row = h('div', 'env-row' + (active?.envId === env.id ? ' current' : ''));
      const dot = h('span', 'env-dot'); dot.style.background = env.color;
      const txt = h('div', 'env-txt');
      txt.append(h('div', 'env-name', env.name), h('div', 'env-sub', envSub(env)));
      const edit = h('button', 'env-edit', '✎'); edit.title = 'Editar';
      edit.addEventListener('mousedown', (e) => { e.stopPropagation(); e.preventDefault(); editEnv(env); });
      row.append(dot, txt, edit);
      row.title = 'Clique: abrir · Ctrl+clique: nova aba · Shift+clique: nova janela';
      row.addEventListener('mousedown', (e) => {
        if (e.target.closest('.env-edit')) return;
        e.preventDefault(); closeEnvPop();
        if (e.button === 0 && e.shiftKey) openInNewWindow({ envId: env.id });
        else openEnv(env, { forceNew: e.button === 1 || e.ctrlKey });
      });
      envPop.appendChild(row);
    });
    envPop.appendChild(h('div', 'sep'));
    const act = (label, fn) => { const b = h('button', null, label); b.onclick = () => { closeEnvPop(); fn(); }; envPop.appendChild(b); };
    act('+  Novo ambiente', () => editEnv(null, { fromTab: active }));
    if (active && !active.ntp && active.kind !== 'claude') act('◆  Salvar esta aba como ambiente', () => editEnv(null, { fromTab: active }));
    envPop.classList.toggle('hidden');
    fitMenu(envPop);
  }
  $('#env-btn').onclick = (e) => { e.stopPropagation(); if (envPop.classList.contains('hidden')) openEnvPop(); else closeEnvPop(); };
  document.addEventListener('mousedown', (e) => { if (!e.target.closest('#env-pop') && !e.target.closest('#env-btn')) closeEnvPop(); });

  /* =================== Claude =================== */
  function ensureClaude(tab, focus = false) {
    if (tab.claude) { tab.claude.el.classList.add('active'); fitClaude(tab, focus); return tab.claude; }
    const el = h('div', 'term-pane active');
    claudeStack.appendChild(el);
    const c = { id: tab.id + 'c', el, ready: false, queue: [] };
    Object.assign(c, makeTerm(el, () => c.ptyId, {}));
    c.onFirstData = () => {
      if (c.ready || c.readyTimer) return;
      c.readyTimer = setTimeout(() => { c.ready = true; c.queue.splice(0).forEach((q) => sendToClaude(c, q)); }, 1500);
    };
    tab.claude = c;
    spawnPty(c, 'claude', tab.cwd, c.term);
    fitClaude(tab, focus);
    return c;
  }
  // Só leva o foco para o Claude quando pedido (abrir a sidebar, perguntar); trocar de aba mantém o foco no terminal.
  function fitClaude(tab, focus) {
    requestAnimationFrame(() => {
      if (!tab.claude) return;
      try { tab.claude.fit.fit(); neo.resize(tab.claude.ptyId, tab.claude.term.cols, tab.claude.term.rows); } catch {}
      if (focus) tab.claude.term.focus();
    });
  }
  function disposeClaude(tab) {
    const c = tab.claude;
    neo.kill(c.ptyId); byPty.delete(c.ptyId); clearTimeout(c.readyTimer);
    c.ro.disconnect(); c.term.dispose(); c.el.remove(); tab.claude = null;
  }
  function sendToClaude(c, text) {
    if (!c.ready) { c.queue.push(text); return; }
    neo.write(c.ptyId, text);
    setTimeout(() => neo.write(c.ptyId, '\r'), 120);
  }
  function askClaude(text) {
    toggleSidebar(true);
    const c = ensureClaude(active, true);
    sendToClaude(c, text);
  }
  function toggleSidebar(force) {
    const show = force ?? sidebar.classList.contains('hidden');
    if (show && !active) { newTab({ ntp: false }).then(() => toggleSidebar(true)); return; }
    sidebar.classList.toggle('hidden', !show);
    splitter.classList.toggle('hidden', !show);
    claudeBtn.classList.toggle('on', show);
    store.set('neo.sidebar', show);
    if (show && active) ensureClaude(active, force === undefined); else focusActive();
    requestAnimationFrame(() => { try { active.fit.fit(); } catch {} });
  }
  $('#claude-restart').onclick = () => { if (active) { if (active.claude) disposeClaude(active); ensureClaude(active, true); } };
  $('#claude-close').onclick = () => toggleSidebar(false);
  claudeBtn.onclick = () => toggleSidebar();
  splitter.addEventListener('mousedown', (e) => {
    e.preventDefault(); splitter.classList.add('drag');
    const move = (ev) => { sidebar.style.width = Math.min(window.innerWidth * 0.8, Math.max(280, window.innerWidth - ev.clientX - 3)) + 'px'; };
    const up = () => { splitter.classList.remove('drag'); window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  });

  /* =================== fonte do terminal =================== */
  const MONO_HINT = /mono|code|consol|courier|nerd|\bnf\b|cascadia|caskaydia|fira|hack|meslo|iosevka|menlo|source code|terminal|fixed|lucida console|inconsolata|victor|jetbrains|ubuntu mono|dejavu sans mono|roboto mono|sf mono|monaspace|geist mono/i;
  const NERD = /nerd|\bnf\b/i;
  async function openFontPicker() {
    const all = await neo.listFonts();
    const bg = h('div', 'modal-bg');
    const m = h('div', 'modal');
    const head = h('div', 'modal-head');
    const titles = h('div');
    titles.append(h('div', 'm-title', 'Fonte do terminal'),
      h('div', 'm-sub', 'Use a mesma Nerd Font do seu Windows Terminal para os ícones do prompt aparecerem iguais.'));
    head.appendChild(titles);
    const body = h('div', 'modal-body');
    const search = h('input', 'font-search'); search.placeholder = 'Procurar fonte instalada'; search.spellcheck = false;
    const showAll = h('label', 'check-row');
    const chk = h('input'); chk.type = 'checkbox';
    showAll.append(chk, h('span', null, 'Mostrar todas as fontes, não só as monoespaçadas'));
    const list = h('div', 'font-list');
    const sample = 'neo \ue0b0 ~/projetos \ue0a0 main \uf00c 12:30';
    const render = () => {
      list.innerHTML = '';
      const q = search.value.trim().toLowerCase();
      const fonts = all.filter((f) => (chk.checked || MONO_HINT.test(f)) && f.toLowerCase().includes(q))
        .sort((a, b) => (NERD.test(b) - NERD.test(a)) || a.localeCompare(b));
      const rows = [{ name: '', label: 'Padrão do Neo CMD' }, ...fonts.map((f) => ({ name: f, label: f }))];
      rows.forEach(({ name, label }) => {
        const row = h('div', 'font-row' + (name === userFont ? ' on' : ''));
        const smp = h('div', 'fr-sample', sample);
        smp.style.fontFamily = [name && `"${name}"`, '"Symbols Nerd Font Mono"', '"Symbols Nerd Font Legacy"', 'monospace'].filter(Boolean).join(',');
        row.append(h('div', 'fr-name', label), smp);
        if (NERD.test(name)) row.appendChild(h('span', 'fr-tag', 'Nerd Font'));
        row.addEventListener('click', () => {
          userFont = name; store.set('neo.termFont', name); applyTermFont();
          list.querySelectorAll('.font-row').forEach((r) => r.classList.toggle('on', r === row));
        });
        list.appendChild(row);
      });
      if (!fonts.length) list.appendChild(h('div', 'font-empty', q ? `Nenhuma fonte instalada com "${search.value.trim()}".` : 'Nenhuma fonte monoespaçada encontrada. Marque "Mostrar todas as fontes".'));
    };
    search.addEventListener('input', render);
    chk.addEventListener('change', render);
    body.append(search, showAll, list);
    const foot = h('div', 'modal-foot');
    const done = h('button', 'btn primary', 'Concluir'); done.type = 'button';
    foot.append(h('span', 'grow'), done);
    m.append(head, body, foot);
    bg.appendChild(m);
    document.body.appendChild(bg);
    render();
    setTimeout(() => search.focus(), 30);
    const close = () => { bg.classList.add('leaving'); setTimeout(() => bg.remove(), 150); focusActive(); };
    done.onclick = close;
    bg.addEventListener('mousedown', (e) => { if (e.target === bg) close(); });
    m.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); close(); } });
  }

  /* =================== atualizações =================== */
  let update = { state: 'idle' };
  const updateBtn = $('#update-btn');
  function renderUpdate(st) {
    const was = update.state;
    update = st || update;
    updateBtn.classList.toggle('hidden', update.state !== 'ready');
    if (update.state === 'ready') {
      updateBtn.textContent = `Atualizar para ${update.version}`;
      if (was !== 'ready') toast(`Versão ${update.version} baixada. Clique em "Atualizar para ${update.version}" para reiniciar nela.`);
    }
  }
  function confirmUpdate() {
    const bg = h('div', 'modal-bg');
    const m = h('div', 'modal');
    const head = h('div', 'modal-head');
    const titles = h('div');
    titles.append(h('div', 'm-title', `Atualizar para a versão ${update.version}?`),
      h('div', 'm-sub', 'O Neo CMD fecha, instala a versão nova e abre de novo. Os terminais abertos serão encerrados.'));
    head.appendChild(titles);
    const foot = h('div', 'modal-foot');
    const later = h('button', 'btn ghost', 'Depois'); later.type = 'button';
    const now = h('button', 'btn primary', 'Reiniciar e atualizar'); now.type = 'button';
    foot.append(h('span', 'grow'), later, now);
    m.append(head, foot); bg.appendChild(m); document.body.appendChild(bg);
    const close = () => { bg.remove(); focusActive(); };
    later.onclick = close;
    now.onclick = () => neo.updateInstall();
    bg.addEventListener('mousedown', (e) => { if (e.target === bg) close(); });
    m.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') close(); });
    setTimeout(() => now.focus(), 30);
  }
  async function checkUpdates() {
    const st = await neo.updateCheck();
    renderUpdate(st);
    const msg = {
      dev: 'As atualizações automáticas só funcionam no app instalado.',
      latest: `Você já está na versão mais recente (${st.current}).`,
      downloading: `Baixando a versão ${st.version}…`,
      ready: `A versão ${st.version} está pronta para instalar.`,
      checking: 'Procurando atualizações…',
      error: `Não foi possível procurar atualizações: ${st.message || 'erro desconhecido'}`,
    }[st.state];
    if (msg) toast(msg);
  }
  updateBtn.onclick = confirmUpdate;
  neo.onUpdate(renderUpdate);
  neo.updateGet().then(renderUpdate).catch(() => {});

  /* =================== tema, fonte, menu =================== */
  function applyTheme(id) {
    themeId = id; store.set('neo.theme', id);
    document.documentElement.dataset.theme = id;
    neo.setTitlebar(THEMES[id].bar, THEMES[id].sym);
    byPty.forEach(({ term }) => { term.options.theme = xtermTheme(); });
  }
  function setZoom(size) {
    fontSize = Math.min(28, Math.max(9, size)); store.set('neo.fontSize', fontSize);
    byPty.forEach(({ term }) => { term.options.fontSize = fontSize; });
    requestAnimationFrame(() => tabs.forEach((t) => { try { t.fit.fit(); } catch {} if (t.claude) try { t.claude.fit.fit(); } catch {} }));
    toast(`Fonte: ${Math.round((fontSize / 14) * 100)}%`);
  }
  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg; el.classList.remove('hidden');
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.add('hidden'), 1800);
  }

  const menu = $('#menu');
  function openMenu() {
    menu.innerHTML = '';
    const add = (label, fn, { check, kbd, swatch } = {}) => {
      const b = h('button');
      if (swatch) { const s = h('span', 'swatch'); s.style.background = swatch; b.appendChild(s); }
      b.appendChild(h('span', null, label));
      if (check) b.appendChild(h('span', 'check', '✓'));
      else if (kbd) b.appendChild(h('span', 'kbd', kbd));
      b.onclick = () => { menu.classList.add('hidden'); fn(); };
      menu.appendChild(b);
    };
    const hd = (t) => menu.appendChild(h('div', 'hd', t));
    const sep = () => menu.appendChild(h('div', 'sep'));
    if (envs.length) {
      hd('Ambientes');
      [...envs].sort((a, b) => (b.used || 0) - (a.used || 0)).slice(0, 6).forEach((env) => add(env.name, () => openEnv(env, { forceNew: true }), { swatch: env.color }));
      add('Novo ambiente…', () => editEnv(null, { fromTab: active }), { kbd: 'Ctrl+Shift+E' });
      sep();
    }
    add('Nova janela', () => openInNewWindow(), { kbd: 'Ctrl+Shift+N' });
    sep();
    hd('Nova aba');
    SHELLS.forEach((x) => add(x.label, () => newTab({ kind: x.kind, distro: x.distro }), { kbd: x.key === defaultShell ? 'padrão' : '' }));
    add('✦  Claude Code', () => newTab({ kind: 'claude' }));
    add('Reabrir aba fechada', reopenClosed, { kbd: 'Ctrl+Shift+T' });
    if (SHELLS.length > 1) { sep(); hd('Shell padrão'); SHELLS.forEach((x) => add(x.label, () => { defaultShell = x.key; store.set('neo.shell', x.key); }, { check: x.key === defaultShell })); }
    sep(); hd('Tema');
    Object.entries(THEMES).forEach(([id, t]) => add(t.label, () => applyTheme(id), { check: id === themeId, swatch: `linear-gradient(135deg,${t.bar} 50%,${t.accent} 50%)` }));
    sep(); hd('Exibição');
    add('Aumentar a fonte', () => setZoom(fontSize + 1), { kbd: 'Ctrl +' });
    add('Diminuir a fonte', () => setZoom(fontSize - 1), { kbd: 'Ctrl −' });
    add('Restaurar a fonte', () => setZoom(14), { kbd: 'Ctrl 0' });
    add('Fonte do terminal…', openFontPicker, { kbd: userFont ? userFont.slice(0, 18) : 'padrão' });
    add('Página de nova aba', () => { ntpEnabled = !ntpEnabled; store.set('neo.ntp', ntpEnabled); toast(ntpEnabled ? 'Página de nova aba ligada' : 'Página de nova aba desligada'); }, { check: ntpEnabled });
    sep();
    const ver = h('div', 'ver', `Neo CMD ${update.current || ''}` + (update.state === 'downloading' ? ` · baixando ${update.version} (${update.percent || 0}%)` : ''));
    menu.appendChild(ver);
    if (update.state === 'ready') add(`Atualizar para ${update.version}`, confirmUpdate);
    else add('Procurar atualizações', checkUpdates);
    menu.classList.toggle('hidden');
    fitMenu(menu);
  }
  $('#brand').addEventListener('click', () => showHome());
  $('#menu-btn').onclick = (e) => { e.stopPropagation(); openMenu(); };
  $('#new-tab').onclick = () => newTab();
  document.addEventListener('mousedown', (e) => { if (!e.target.closest('#menu') && !e.target.closest('#menu-btn')) menu.classList.add('hidden'); });

  /* =================== atalhos =================== */
  function isAppShortcut(e) {
    const k = e.key.toLowerCase();
    if (e.altKey && !e.ctrlKey && ['arrowleft', 'arrowright', 'arrowup', 'd', 'home'].includes(k)) return true;
    if (!e.ctrlKey) return k === 'f6';
    return ['t', 'w', 'tab', 'l', 'd', '=', '+', '-', '_', '0'].includes(k) || /^[1-9]$/.test(k) || (e.shiftKey && (k === 'b' || k === 'e' || k === 'n'));
  }
  window.addEventListener('keydown', (e) => {
    if (!isAppShortcut(e) || e.target.isContentEditable) return;
    const k = e.key.toLowerCase();
    if (e.target.closest && e.target.closest('.modal')) return;
    const inField = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName);
    if (inField && !e.ctrlKey && !e.altKey) return;
    e.preventDefault();
    if (e.altKey) { if (k === 'home') { showHome(); return; } if (k === 'arrowleft') goBack(); else if (k === 'arrowright') goForward(); else if (k === 'arrowup') goUp(); else startEditing(); return; }
    if (k === 'f6' || k === 'l') startEditing();
    else if (k === 't') e.shiftKey ? reopenClosed() : newTab();
    else if (k === 'w') closeTab(active);
    else if (k === 'tab') cycle(e.shiftKey ? -1 : 1);
    else if (k === 'd') toggleBookmark();
    else if (k === 'b') toggleSidebar();
    else if (k === 'e') { if (envPop.classList.contains('hidden')) openEnvPop(); else closeEnvPop(); }
    else if (k === 'n') openInNewWindow();
    else if (k === '=' || k === '+') setZoom(fontSize + 1);
    else if (k === '-' || k === '_') setZoom(fontSize - 1);
    else if (k === '0') setZoom(14);
    else activate(k === '9' ? tabs[tabs.length - 1] : tabs[Number(k) - 1]);
  }, true);

  /* =================== eventos do processo principal =================== */
  neo.onData(feed);
  neo.onExit((id, code) => {
    const entry = byPty.get(id);
    if (!entry) return; // processo antigo, já substituído
    const owner = entry.owner;
    const tab = tabs.find((t) => t === owner);
    if (tab) {
      if (tab.kind === 'claude' && Date.now() - tab.startedAt < 4000) {
        entry.term.write(`\r\n\x1b[31m[O Claude encerrou (código ${code}). Feche a aba com Ctrl+W.]\x1b[0m\r\n`);
        return;
      }
      closeTab(tab); return;
    }
    entry.term.write('\r\n\x1b[90m[Claude encerrado — use o botão de nova conversa para reiniciar]\x1b[0m\r\n');
  });

  /* =================== início =================== */
  document.documentElement.dataset.theme = themeId;
  neo.setTitlebar(THEMES[themeId].bar, THEMES[themeId].sym);
  renderBookmarks();
  renderEnvButton();
  neo.wslList().then(({ distros, def }) => {
    wslDefault = def;
    distros.forEach((d) => SHELLS.push({ key: `wsl:${d}`, kind: 'wsl', distro: d, label: `WSL · ${d}`, sub: `wsl.exe -d ${d}` }));
    if (distros.length) refreshNtps();
  }).catch(() => {});
  neo.home().then(async (hm) => {
    home = hm;
    // Janela aberta para receber uma aba movida, ou para abrir uma pasta/ambiente (Shift+clique).
    const init = await neo.winInit().catch(() => null);
    if (init && init.type === 'move') await newTab({ kind: init.kind, distro: init.distro, cwd: init.cwd, ntp: false, adopt: init });
    else if (init && init.type === 'open') {
      const env = init.envId && envById(init.envId);
      if (env) await openEnv(env, { forceNew: true });
      else await newTab({ kind: init.kind, distro: init.distro, cwd: init.cwd, ntp: !init.cwd });
    } else await showHome(); // a janela abre na página inicial, sem iniciar nenhum terminal
  }).then(() => { if (active && store.get('neo.sidebar', false)) toggleSidebar(true); });
})();
