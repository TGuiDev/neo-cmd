(() => {
  const isWin = navigator.platform.toLowerCase().includes('win');
  const store = {
    get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  };

  /* ---------- temas ---------- */
  const ANSI_DARK = {
    black: '#1d212d', red: '#ff6b81', green: '#7ee787', yellow: '#e3b341', blue: '#7c9cff',
    magenta: '#b38cff', cyan: '#56d4dd', white: '#c9d1d9',
    brightBlack: '#7d8590', brightRed: '#ff8fa0', brightGreen: '#9bf0a3', brightYellow: '#f0cb66',
    brightBlue: '#9db4ff', brightMagenta: '#c9a8ff', brightCyan: '#7ae3ea', brightWhite: '#ffffff',
  };
  const ANSI_LIGHT = {
    black: '#2b3040', red: '#d1242f', green: '#1a7f37', yellow: '#9a6700', blue: '#2f55d4',
    magenta: '#8250df', cyan: '#0f7d8c', white: '#6b7389',
    brightBlack: '#57606a', brightRed: '#e5534b', brightGreen: '#2da44e', brightYellow: '#bf8700',
    brightBlue: '#4f6bed', brightMagenta: '#a371f7', brightCyan: '#1b9aaa', brightWhite: '#1f2430',
  };
  const THEMES = {
    neo:      { label: 'Neo Escuro', bg: '#121521', fg: '#d6dbe8', accent: '#7c9cff', sel: '#33406b', bar: '#0b0d14', sym: '#d6dbe8', ansi: ANSI_DARK },
    midnight: { label: 'Meia-noite', bg: '#0b121c', fg: '#cfe3f5', accent: '#3dd6f5', sel: '#1d4a63', bar: '#060a10', sym: '#cfe3f5', ansi: ANSI_DARK },
    dracula:  { label: 'Drácula',    bg: '#282a36', fg: '#f8f8f2', accent: '#bd93f9', sel: '#44475a', bar: '#1b1c26', sym: '#f8f8f2', ansi: ANSI_DARK },
    claro:    { label: 'Claro',      bg: '#ffffff', fg: '#1f2430', accent: '#4f6bed', sel: '#c9d6ff', bar: '#e6e9f1', sym: '#1f2430', ansi: ANSI_LIGHT },
  };
  let themeId = THEMES[store.get('neo.theme')] ? store.get('neo.theme') : 'neo';
  const xtermTheme = () => {
    const t = THEMES[themeId];
    return { background: t.bg, foreground: t.fg, cursor: t.accent, cursorAccent: t.bg, selectionBackground: t.sel, ...t.ansi };
  };

  const SHELLS = isWin
    ? [
        { id: 'cmd', label: 'Prompt de Comando (cmd)' },
        { id: 'powershell', label: 'Windows PowerShell' },
        { id: 'pwsh', label: 'PowerShell 7 (pwsh)' },
      ]
    : [{ id: 'default', label: 'Shell padrão' }];
  const KIND_LABEL = { cmd: 'cmd', powershell: 'PowerShell', pwsh: 'PowerShell 7', claude: 'Claude Code', default: 'Shell' };
  const KIND_ICON = { cmd: '>_', powershell: 'PS', pwsh: 'PS', claude: '✦', default: '$_' };

  const $ = (s) => document.querySelector(s);
  const tabsEl = $('#tabs'), termsEl = $('#terminals'), claudeStack = $('#claude-stack');
  const sidebar = $('#sidebar'), splitter = $('#splitter'), claudeBtn = $('#toggle-claude');

  let seq = 0, home = '';
  let fontSize = Number(store.get('neo.fontSize', 14)) || 14;
  const tabs = [];
  const byPty = new Map();   // ptyId -> { term, hold }
  const closed = [];
  let active = null;
  let defaultShell = SHELLS[0].id;

  /* ---------- terminal ---------- */
  // `hold`: no cmd, esconde o texto de inicialização (versão do Windows, Clink...) até o primeiro prompt.
  function makeTerm(container, ptyId, { onCwd, onTitle, hold } = {}) {
    const term = new Terminal({
      theme: xtermTheme(), fontFamily: '"Cascadia Code","Cascadia Mono",Consolas,"Courier New",monospace',
      fontSize, lineHeight: 1.18, cursorBlink: true, cursorStyle: 'bar', cursorWidth: 2,
      scrollback: 10000, allowProposedApi: true,
    });
    const fit = new FitAddon.FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon.WebLinksAddon((_e, url) => neo.openExternal(url)));
    term.open(container);
    term.onData((d) => neo.write(ptyId, d));
    if (onTitle) term.onTitleChange(onTitle);
    term.parser.registerOscHandler(9, (data) => {
      if (data.startsWith('9;')) { onCwd?.(data.slice(2).replace(/^"|"$/g, '')); return true; }
      return false;
    });
    term.attachCustomKeyEventHandler((e) => {
      if (e.type !== 'keydown') return true;
      if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'c' && term.hasSelection()) {
        navigator.clipboard.writeText(term.getSelection()); term.clearSelection(); return false;
      }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'c') {
        navigator.clipboard.writeText(term.getSelection()); return false;
      }
      return !isAppShortcut(e);
    });
    container.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (term.hasSelection()) { navigator.clipboard.writeText(term.getSelection()); term.clearSelection(); }
      else navigator.clipboard.readText().then((t) => t && term.paste(t));
    });
    const ro = new ResizeObserver(() => {
      if (!container.offsetParent) return;
      try { fit.fit(); neo.resize(ptyId, term.cols, term.rows); } catch {}
    });
    ro.observe(container);

    const entry = { term, hold: null };
    if (hold) {
      entry.hold = { buf: '', timer: setTimeout(() => release(entry, true), 2500) };
    }
    byPty.set(ptyId, entry);
    return { term, fit, ro };
  }

  function release(entry, all) {
    const h = entry.hold;
    if (!h) return;
    clearTimeout(h.timer);
    entry.hold = null;
    const i = h.buf.indexOf('\x1b]9;9;');
    entry.term.write(all || i < 0 ? h.buf : h.buf.slice(i));
  }
  function feed(id, data) {
    const entry = byPty.get(id);
    if (!entry) return;
    if (!entry.hold) return entry.term.write(data);
    entry.hold.buf += data;
    if (entry.hold.buf.includes('\x1b]9;9;')) release(entry, false);
    else if (entry.hold.buf.length > 200000) release(entry, true);
  }

  /* ---------- abas ---------- */
  async function newTab(opts = {}) {
    if (!home) home = await neo.home();
    const id = 't' + ++seq;
    const kind = opts.kind || defaultShell;
    const cwd = opts.cwd || (active ? active.cwd : home);
    const pane = document.createElement('div');
    pane.className = 'term-pane';
    termsEl.appendChild(pane);

    const tab = { id, kind, cwd, title: opts.title || null, custom: !!opts.title, pane, claude: null, startedAt: Date.now() };
    const el = document.createElement('div');
    el.className = 'tab'; el.draggable = true; el.dataset.kind = kind;
    el.innerHTML = '<span class="glow"></span><span class="ico"></span><span class="label"></span><button class="close" title="Fechar (Ctrl+W)">✕</button>';
    el.querySelector('.ico').textContent = KIND_ICON[kind] || '$_';
    tab.el = el;
    el.addEventListener('mousedown', (e) => {
      if (e.target.isContentEditable) return;
      if (e.button === 1) { e.preventDefault(); closeTab(tab); }
      else if (e.button === 0 && !e.target.classList.contains('close')) activate(tab);
    });
    el.querySelector('.close').addEventListener('click', (e) => { e.stopPropagation(); closeTab(tab); });
    el.addEventListener('dblclick', () => renameTab(tab));
    wireDrag(tab);
    tabsEl.appendChild(el);
    tabs.push(tab);

    Object.assign(tab, makeTerm(pane, id, {
      hold: isWin && kind === 'cmd',
      onCwd: (p) => { tab.cwd = p; refresh(tab); if (tab === active) updateStatus(); },
      onTitle: (t) => { if (!tab.custom) { tab.termTitle = t; refresh(tab); } },
    }));
    activate(tab);
    await neo.create({ id, kind, cwd, cols: tab.term.cols, rows: tab.term.rows });
    neo.resize(id, tab.term.cols, tab.term.rows);
    refresh(tab);
    return tab;
  }

  // Duplo clique: edita o nome na própria aba (prompt() não existe no Electron).
  function renameTab(tab) {
    const label = tab.el.querySelector('.label');
    label.contentEditable = 'true'; label.spellcheck = false; label.focus();
    getSelection().selectAllChildren(label);
    const done = (save) => {
      label.contentEditable = 'false';
      label.removeEventListener('blur', onBlur); label.removeEventListener('keydown', onKey);
      if (save) { const v = label.textContent.trim(); tab.title = v || null; tab.custom = !!v; }
      refresh(tab); tab.term.focus();
    };
    const onBlur = () => done(true);
    const onKey = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); done(true); }
      else if (e.key === 'Escape') { e.preventDefault(); done(false); }
      e.stopPropagation();
    };
    label.addEventListener('blur', onBlur); label.addEventListener('keydown', onKey);
  }

  function labelOf(tab) {
    if (tab.title) return tab.title;
    if (tab.kind === 'claude') return 'Claude';
    const base = (tab.cwd || '').split(/[\\/]/).filter(Boolean).pop();
    return base || tab.termTitle || KIND_LABEL[tab.kind] || 'Terminal';
  }
  function refresh(tab) {
    const label = tab.el.querySelector('.label');
    if (!label.isContentEditable) label.textContent = labelOf(tab);
    tab.el.title = tab.cwd || '';
    if (tab === active) document.title = labelOf(tab) + ' — Neo CMD';
  }
  function activate(tab) {
    if (!tab) return;
    active = tab;
    tabs.forEach((t) => {
      t.el.classList.toggle('active', t === tab);
      t.pane.classList.toggle('active', t === tab);
      if (t.claude) t.claude.el.classList.toggle('active', t === tab);
    });
    refresh(tab);
    requestAnimationFrame(() => { try { tab.fit.fit(); } catch {} tab.term.focus(); });
    updateStatus();
    if (!sidebar.classList.contains('hidden')) ensureClaude(tab);
  }
  function closeTab(tab) {
    const i = tabs.indexOf(tab);
    if (i < 0) return;
    closed.push({ kind: tab.kind, cwd: tab.cwd, title: tab.title });
    if (closed.length > 20) closed.shift();
    neo.kill(tab.id); byPty.delete(tab.id); tab.ro.disconnect(); tab.term.dispose(); tab.pane.remove();
    if (tab.claude) disposeClaude(tab);
    tab.el.remove(); tabs.splice(i, 1);
    if (!tabs.length) { newTab(); return; }
    if (active === tab) activate(tabs[Math.min(i, tabs.length - 1)]);
    updateStatus();
  }
  const cycle = (dir) => tabs.length > 1 && activate(tabs[(tabs.indexOf(active) + dir + tabs.length) % tabs.length]);
  function reopenClosed() {
    const c = closed.pop();
    if (c) newTab({ kind: c.kind, cwd: c.cwd, title: c.title });
  }

  let dragged = null;
  function wireDrag(tab) {
    const el = tab.el;
    el.addEventListener('dragstart', (e) => { dragged = tab; el.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
    el.addEventListener('dragend', () => { dragged = null; tabs.forEach((t) => t.el.classList.remove('dragging', 'drop-before', 'drop-after')); });
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

  /* ---------- barra de status ---------- */
  const shortPath = (p) => {
    if (!p) return '';
    if (home && p.toLowerCase().startsWith(home.toLowerCase())) return '~' + p.slice(home.length);
    return p;
  };
  let gitSeq = 0;
  function updateStatus() {
    if (!active) return;
    $('#st-shell').textContent = KIND_LABEL[active.kind] || 'Shell';
    $('#st-cwd').textContent = shortPath(active.cwd);
    $('#st-cwd').title = active.cwd || '';
    $('#st-tabs').textContent = tabs.length + (tabs.length === 1 ? ' aba' : ' abas');
    $('#st-zoom').textContent = fontSize === 14 ? '' : Math.round((fontSize / 14) * 100) + '%';
    $('#sidebar-cwd').textContent = shortPath(active.cwd);
    const my = ++gitSeq, git = $('#st-git');
    neo.gitBranch(active.cwd).then((b) => {
      if (my !== gitSeq) return;
      git.classList.toggle('hidden', !b);
      git.textContent = b ? '⎇ ' + b : '';
    });
  }

  /* ---------- sidebar do Claude (uma sessão por aba) ---------- */
  function ensureClaude(tab) {
    if (tab.claude) { tab.claude.el.classList.add('active'); fitClaude(tab); return; }
    const id = tab.id + '-claude';
    const el = document.createElement('div');
    el.className = 'term-pane active';
    claudeStack.appendChild(el);
    const t = makeTerm(el, id, {});
    tab.claude = { id, el, startedAt: Date.now(), ...t };
    neo.create({ id, kind: 'claude', cwd: tab.cwd, cols: t.term.cols, rows: t.term.rows });
    fitClaude(tab);
  }
  function fitClaude(tab) {
    requestAnimationFrame(() => {
      try { tab.claude.fit.fit(); neo.resize(tab.claude.id, tab.claude.term.cols, tab.claude.term.rows); } catch {}
      tab.claude.term.focus();
    });
  }
  function disposeClaude(tab) {
    neo.kill(tab.claude.id); byPty.delete(tab.claude.id);
    tab.claude.ro.disconnect(); tab.claude.term.dispose(); tab.claude.el.remove(); tab.claude = null;
  }
  function toggleSidebar(force) {
    const show = force ?? sidebar.classList.contains('hidden');
    sidebar.classList.toggle('hidden', !show);
    splitter.classList.toggle('hidden', !show);
    claudeBtn.classList.toggle('on', show);
    store.set('neo.sidebar', show ? '1' : '0');
    if (show && active) ensureClaude(active); else if (active) active.term.focus();
    requestAnimationFrame(() => { try { active.fit.fit(); } catch {} });
  }
  $('#claude-restart').onclick = () => { if (active) { if (active.claude) disposeClaude(active); ensureClaude(active); } };
  $('#claude-close').onclick = () => toggleSidebar(false);
  claudeBtn.onclick = () => toggleSidebar();

  splitter.addEventListener('mousedown', (e) => {
    e.preventDefault(); splitter.classList.add('drag');
    const move = (ev) => {
      const w = Math.min(window.innerWidth * 0.8, Math.max(280, window.innerWidth - ev.clientX - 8));
      sidebar.style.width = w + 'px';
    };
    const up = () => { splitter.classList.remove('drag'); window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  });

  /* ---------- tema e zoom ---------- */
  function applyTheme(id) {
    themeId = id; store.set('neo.theme', id);
    document.documentElement.dataset.theme = id;
    const t = THEMES[id];
    neo.setTitlebar(t.bar, t.sym);
    byPty.forEach(({ term }) => { term.options.theme = xtermTheme(); });
  }
  function setZoom(size) {
    fontSize = Math.min(28, Math.max(9, size)); store.set('neo.fontSize', String(fontSize));
    byPty.forEach(({ term }) => { term.options.fontSize = fontSize; });
    requestAnimationFrame(() => {
      tabs.forEach((t) => { try { t.fit.fit(); } catch {} if (t.claude) try { t.claude.fit.fit(); } catch {} });
      updateStatus();
    });
  }

  /* ---------- menu ---------- */
  const menu = $('#shell-menu');
  function openMenu(anchor) {
    menu.innerHTML = '';
    const add = (text, fn, checked) => {
      const b = document.createElement('button'); b.textContent = text;
      if (checked) { const c = document.createElement('span'); c.className = 'check'; c.textContent = '✓'; b.appendChild(c); }
      b.onclick = () => { menu.classList.add('hidden'); fn(); };
      menu.appendChild(b); return b;
    };
    const hd = (t) => { const d = document.createElement('div'); d.className = 'hd'; d.textContent = t; menu.appendChild(d); };
    const sep = () => { const d = document.createElement('div'); d.className = 'sep'; menu.appendChild(d); };

    hd('Nova aba');
    SHELLS.forEach((s) => {
      const b = add(s.label, () => newTab({ kind: s.id }), s.id === defaultShell);
      b.oncontextmenu = (ev) => { ev.preventDefault(); defaultShell = s.id; menu.classList.add('hidden'); };
    });
    add('✦  Claude Code', () => newTab({ kind: 'claude' }));
    sep(); hd('Tema');
    Object.entries(THEMES).forEach(([id, t]) => add(t.label, () => applyTheme(id), id === themeId));
    sep(); hd('Tamanho da fonte');
    add('Aumentar  (Ctrl +)', () => setZoom(fontSize + 1));
    add('Diminuir  (Ctrl -)', () => setZoom(fontSize - 1));
    add('Restaurar  (Ctrl 0)', () => setZoom(14));
    menu.style.left = Math.min(anchor.getBoundingClientRect().left, window.innerWidth - 250) + 'px';
    menu.classList.toggle('hidden');
  }
  $('#new-tab').onclick = () => newTab();
  $('#shell-menu-btn').onclick = (e) => { e.stopPropagation(); openMenu(e.currentTarget); };
  document.addEventListener('click', () => menu.classList.add('hidden'));

  /* ---------- atalhos ---------- */
  function isAppShortcut(e) {
    if (!e.ctrlKey) return false;
    const k = e.key.toLowerCase();
    return ['t', 'w', 'tab', '=', '+', '-', '_', '0'].includes(k) || /^[1-9]$/.test(k) || (e.shiftKey && k === 'b');
  }
  window.addEventListener('keydown', (e) => {
    if (!isAppShortcut(e)) return;
    if (e.target.isContentEditable) return;
    e.preventDefault();
    const k = e.key.toLowerCase();
    if (k === 't') e.shiftKey ? reopenClosed() : newTab();
    else if (k === 'w') closeTab(active);
    else if (k === 'tab') cycle(e.shiftKey ? -1 : 1);
    else if (k === 'b') toggleSidebar();
    else if (k === '=' || k === '+') setZoom(fontSize + 1);
    else if (k === '-' || k === '_') setZoom(fontSize - 1);
    else if (k === '0') setZoom(14);
    else activate(k === '9' ? tabs[tabs.length - 1] : tabs[Number(k) - 1]);
  }, true);

  /* ---------- eventos do processo principal ---------- */
  neo.onData(feed);
  neo.onExit((id, code) => {
    const tab = tabs.find((t) => t.id === id);
    if (tab) {
      // Claude que fecha logo ao abrir: mantém a aba com o aviso, para o erro não sumir.
      if (tab.kind === 'claude' && Date.now() - tab.startedAt < 4000) {
        byPty.get(id)?.term.write(`\r\n\x1b[31m[O Claude encerrou (código ${code}). Feche a aba com Ctrl+W.]\x1b[0m\r\n`);
        return;
      }
      return closeTab(tab);
    }
    const owner = tabs.find((t) => t.claude && t.claude.id === id);
    if (owner) byPty.get(id)?.term.write('\r\n\x1b[90m[Claude encerrado — use ↻ para reiniciar]\x1b[0m\r\n');
  });

  document.documentElement.dataset.theme = themeId;
  neo.setTitlebar(THEMES[themeId].bar, THEMES[themeId].sym);
  neo.home().then((h) => { home = h; });
  newTab().then(() => { if (store.get('neo.sidebar') === '1') toggleSidebar(true); });
})();
