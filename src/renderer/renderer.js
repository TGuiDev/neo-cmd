(() => {
  const isWin = navigator.platform.toLowerCase().includes('win');
  const THEME = {
    background: '#161922', foreground: '#c9d1d9', cursor: '#7c9cff', selectionBackground: '#33406b',
    black: '#1d212d', red: '#ff6b81', green: '#7ee787', yellow: '#e3b341', blue: '#7c9cff',
    magenta: '#b38cff', cyan: '#56d4dd', white: '#c9d1d9',
    brightBlack: '#7d8590', brightRed: '#ff8fa0', brightGreen: '#9bf0a3', brightYellow: '#f0cb66',
    brightBlue: '#9db4ff', brightMagenta: '#c9a8ff', brightCyan: '#7ae3ea', brightWhite: '#ffffff',
  };
  const SHELLS = isWin
    ? [
        { id: 'cmd', label: 'Prompt de Comando (cmd)' },
        { id: 'powershell', label: 'Windows PowerShell' },
        { id: 'pwsh', label: 'PowerShell 7 (pwsh)' },
      ]
    : [{ id: 'default', label: 'Shell padrão' }];

  const $ = (s) => document.querySelector(s);
  const tabsEl = $('#tabs'), termsEl = $('#terminals'), claudeStack = $('#claude-stack');
  const sidebar = $('#sidebar'), splitter = $('#splitter'), claudeBtn = $('#toggle-claude');

  let seq = 0;
  const tabs = [];          // ordem visual
  const byPty = new Map();  // ptyId -> { term }
  const closed = [];        // pilha para Ctrl+Shift+T
  let active = null;
  let defaultShell = SHELLS[0].id;

  /* ---------- terminal helper ---------- */
  function makeTerm(container, ptyId, { onCwd, onTitle } = {}) {
    const term = new Terminal({
      theme: THEME, fontFamily: '"Cascadia Code", Consolas, "Courier New", monospace',
      fontSize: 14, cursorBlink: true, scrollback: 10000, allowProposedApi: true,
    });
    const fit = new FitAddon.FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon.WebLinksAddon((_e, url) => neo.openExternal(url)));
    term.open(container);
    term.onData((d) => neo.write(ptyId, d));
    if (onTitle) term.onTitleChange(onTitle);
    if (onCwd) {
      term.parser.registerOscHandler(9, (data) => {
        if (data.startsWith('9;')) { onCwd(data.slice(2).replace(/^"|"$/g, '')); return true; }
        return false;
      });
    }
    term.attachCustomKeyEventHandler((e) => {
      if (e.type !== 'keydown') return true;
      if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'c' && term.hasSelection()) {
        navigator.clipboard.writeText(term.getSelection()); term.clearSelection(); return false;
      }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'c') {
        navigator.clipboard.writeText(term.getSelection()); return false;
      }
      return !isAppShortcut(e); // atalhos do app não chegam ao shell
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
    byPty.set(ptyId, { term });
    return { term, fit, ro };
  }

  /* ---------- abas ---------- */
  async function newTab(opts = {}) {
    const id = 't' + ++seq;
    const kind = opts.kind || defaultShell;
    const cwd = opts.cwd || (active ? active.cwd : await neo.home());
    const pane = document.createElement('div');
    pane.className = 'term-pane';
    termsEl.appendChild(pane);

    const tab = {
      id, kind, cwd, command: opts.command || null, claudeTab: !!opts.command,
      title: opts.title || null, custom: !!opts.title, pane, claude: null,
    };
    const tEl = document.createElement('div');
    tEl.className = 'tab'; tEl.draggable = true;
    tEl.innerHTML = '<span class="badge"></span><span class="label"></span><button class="close" title="Fechar (Ctrl+W)">✕</button>';
    tab.el = tEl;
    tEl.addEventListener('mousedown', (e) => {
      if (e.button === 1) { e.preventDefault(); closeTab(tab); }
      else if (e.button === 0 && !e.target.classList.contains('close')) activate(tab);
    });
    tEl.querySelector('.close').addEventListener('click', (e) => { e.stopPropagation(); closeTab(tab); });
    tEl.addEventListener('dblclick', () => {
      const name = prompt('Nome da aba:', labelOf(tab));
      if (name !== null) { tab.title = name.trim() || null; tab.custom = !!tab.title; refresh(tab); }
    });
    wireDrag(tab);
    tabsEl.appendChild(tEl);
    tabs.push(tab);

    Object.assign(tab, makeTerm(pane, id, {
      onCwd: (p) => { tab.cwd = p; refresh(tab); if (tab === active) syncSidebarCwd(); },
      onTitle: (t) => { if (!tab.custom) { tab.termTitle = t; refresh(tab); } },
    }));
    activate(tab);
    await neo.create({ id, kind, cwd, command: tab.command, cols: tab.term.cols, rows: tab.term.rows });
    neo.resize(id, tab.term.cols, tab.term.rows);
    refresh(tab);
    return tab;
  }

  function labelOf(tab) {
    if (tab.title) return tab.title;
    if (tab.claudeTab) return 'Claude';
    const base = (tab.cwd || '').split(/[\\/]/).filter(Boolean).pop();
    return base || tab.termTitle || 'Terminal';
  }
  function refresh(tab) {
    tab.el.querySelector('.label').textContent = labelOf(tab);
    tab.el.querySelector('.badge').textContent = tab.claudeTab ? '✦' : '';
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
    syncSidebarCwd();
    if (!sidebar.classList.contains('hidden')) ensureClaude(tab);
  }
  function closeTab(tab) {
    const i = tabs.indexOf(tab);
    if (i < 0) return;
    closed.push({ kind: tab.kind, cwd: tab.cwd, command: tab.command, title: tab.title });
    if (closed.length > 20) closed.shift();
    neo.kill(tab.id); byPty.delete(tab.id); tab.ro.disconnect(); tab.term.dispose(); tab.pane.remove();
    if (tab.claude) disposeClaude(tab);
    tab.el.remove(); tabs.splice(i, 1);
    if (!tabs.length) { newTab(); return; }
    if (active === tab) activate(tabs[Math.min(i, tabs.length - 1)]);
  }
  function cycle(dir) {
    if (tabs.length < 2) return;
    activate(tabs[(tabs.indexOf(active) + dir + tabs.length) % tabs.length]);
  }
  function reopenClosed() {
    const c = closed.pop();
    if (c) newTab({ kind: c.kind, cwd: c.cwd, command: c.command, title: c.title });
  }

  // arrastar para reordenar
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

  /* ---------- sidebar do Claude (uma sessão por aba) ---------- */
  function ensureClaude(tab) {
    if (tab.claude) { tab.claude.el.classList.add('active'); fitClaude(tab); return; }
    const id = tab.id + '-claude';
    const el = document.createElement('div');
    el.className = 'term-pane active';
    claudeStack.appendChild(el);
    const t = makeTerm(el, id, {});
    tab.claude = { id, el, ...t };
    neo.create({ id, kind: tab.kind, cwd: tab.cwd, command: 'claude', cols: t.term.cols, rows: t.term.rows });
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
  function syncSidebarCwd() {
    const el = $('#sidebar-cwd');
    el.textContent = active ? active.cwd : ''; el.title = el.textContent;
  }
  function toggleSidebar(force) {
    const show = force ?? sidebar.classList.contains('hidden');
    sidebar.classList.toggle('hidden', !show);
    splitter.classList.toggle('hidden', !show);
    claudeBtn.classList.toggle('on', show);
    if (show && active) ensureClaude(active); else if (active) active.term.focus();
    requestAnimationFrame(() => { try { active.fit.fit(); } catch {} });
  }
  $('#claude-restart').onclick = () => {
    if (!active) return;
    if (active.claude) disposeClaude(active);
    ensureClaude(active);
  };
  $('#claude-close').onclick = () => toggleSidebar(false);
  claudeBtn.onclick = () => toggleSidebar();

  splitter.addEventListener('mousedown', (e) => {
    e.preventDefault(); splitter.classList.add('drag');
    const move = (ev) => { sidebar.style.width = Math.max(280, window.innerWidth - ev.clientX) + 'px'; };
    const up = () => { splitter.classList.remove('drag'); window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  });

  /* ---------- menu de shells / Claude ---------- */
  const menu = $('#shell-menu');
  $('#new-tab').onclick = () => newTab();
  $('#shell-menu-btn').onclick = (e) => {
    e.stopPropagation();
    menu.innerHTML = '';
    SHELLS.forEach((s) => {
      const b = document.createElement('button'); b.textContent = s.label;
      b.onclick = () => { menu.classList.add('hidden'); newTab({ kind: s.id }); };
      b.oncontextmenu = (ev) => { ev.preventDefault(); defaultShell = s.id; b.textContent = s.label + ' ✓ padrão'; };
      menu.appendChild(b);
    });
    const c = document.createElement('button'); c.textContent = '✦ Nova aba do Claude';
    c.onclick = () => { menu.classList.add('hidden'); newTab({ command: 'claude' }); };
    menu.appendChild(c);
    const r = e.currentTarget.getBoundingClientRect();
    menu.style.left = r.left + 'px';
    menu.classList.toggle('hidden');
  };
  document.addEventListener('click', () => menu.classList.add('hidden'));

  /* ---------- atalhos ---------- */
  function isAppShortcut(e) {
    if (!e.ctrlKey) return false;
    const k = e.key.toLowerCase();
    return k === 't' || k === 'w' || k === 'tab' || /^[1-9]$/.test(k) || (e.shiftKey && k === 'b');
  }
  window.addEventListener('keydown', (e) => {
    if (!isAppShortcut(e)) return;
    e.preventDefault();
    const k = e.key.toLowerCase();
    if (k === 't') e.shiftKey ? reopenClosed() : newTab();
    else if (k === 'w') closeTab(active);
    else if (k === 'tab') cycle(e.shiftKey ? -1 : 1);
    else if (k === 'b') toggleSidebar();
    else activate(k === '9' ? tabs[tabs.length - 1] : tabs[Number(k) - 1]);
  }, true);

  /* ---------- eventos do processo principal ---------- */
  neo.onData((id, data) => byPty.get(id)?.term.write(data));
  neo.onExit((id) => {
    const tab = tabs.find((t) => t.id === id);
    if (tab) return closeTab(tab); // shell terminou (exit) -> fecha a aba
    const owner = tabs.find((t) => t.claude && t.claude.id === id);
    if (owner) byPty.get(id)?.term.write('\r\n\x1b[90m[Claude encerrado — use ↻ para reiniciar]\x1b[0m\r\n');
  });

  newTab();
})();
