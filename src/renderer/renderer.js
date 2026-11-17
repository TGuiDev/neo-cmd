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
    neo:      { label: 'Neo Escuro', bg: '#0f121c', fg: '#dfe3ee', accent: '#7c9cff', sel: '#33406b', bar: '#0a0c12', sym: '#dfe3ee', ansi: ANSI_DARK },
    midnight: { label: 'Meia-noite', bg: '#09111b', fg: '#d4e7f7', accent: '#3dd6f5', sel: '#1d4a63', bar: '#04070c', sym: '#d4e7f7', ansi: ANSI_DARK },
    dracula:  { label: 'Drácula',    bg: '#21222c', fg: '#f8f8f2', accent: '#bd93f9', sel: '#44475a', bar: '#18191f', sym: '#f8f8f2', ansi: ANSI_DARK },
    claro:    { label: 'Claro',      bg: '#ffffff', fg: '#1d2230', accent: '#4f6bed', sel: '#c9d6ff', bar: '#dde2ec', sym: '#1d2230', ansi: ANSI_LIGHT },
  };
  let themeId = THEMES[store.get('neo.theme')] ? store.get('neo.theme') : 'neo';
  const xtermTheme = () => {
    const t = THEMES[themeId];
    return { background: t.bg, foreground: t.fg, cursor: t.accent, cursorAccent: t.bg, selectionBackground: t.sel, ...t.ansi };
  };

  const SHELLS = isWin
    ? [{ id: 'cmd', label: 'Prompt de Comando', sub: 'cmd.exe' }, { id: 'powershell', label: 'Windows PowerShell', sub: 'powershell.exe' },
       { id: 'pwsh', label: 'PowerShell 7', sub: 'pwsh.exe' }]
    : [{ id: 'default', label: 'Shell padrão', sub: 'bash/zsh' }];
  const KIND_LABEL = { cmd: 'cmd', powershell: 'PowerShell', pwsh: 'PowerShell 7', claude: 'Claude', default: 'shell' };
  const KIND_ICON = { cmd: '>_', powershell: 'PS', pwsh: 'PS', claude: '✦', default: '$_' };

  /* =================== estado =================== */
  const tabsEl = $('#tabs'), termsEl = $('#terminals'), claudeStack = $('#claude-stack');
  const sidebar = $('#sidebar'), splitter = $('#splitter'), claudeBtn = $('#toggle-claude');
  let seq = 0, home = '';
  let fontSize = Number(store.get('neo.fontSize', 14)) || 14;
  let defaultShell = store.get('neo.shell', SHELLS[0].id);
  if (!SHELLS.some((s) => s.id === defaultShell)) defaultShell = SHELLS[0].id;
  let ntpEnabled = store.get('neo.ntp', true);
  const tabs = [];
  const byPty = new Map();   // ptyId -> { term, hold, owner }
  const closed = [];
  let active = null;

  /* =================== caminhos =================== */
  const sepOf = (p) => (p && p.includes('\\') ? '\\' : '/');
  const baseName = (p) => (p || '').split(/[\\/]/).filter(Boolean).pop() || p || '';
  const samePath = (a, b) => !!a && !!b && (isWin ? a.toLowerCase() === b.toLowerCase() : a === b);
  const underHome = (p) => home && p && (isWin ? p.toLowerCase().startsWith(home.toLowerCase()) : p.startsWith(home));
  const shortPath = (p) => (underHome(p) ? '~' + p.slice(home.length) : p || '');
  const looksLikePath = (q) => /^([a-zA-Z]:|~|\.{1,2}($|[\\/])|[\\/])/.test(q);
  function hue(str) { let x = 0; for (const c of str || '') x = (x * 31 + c.charCodeAt(0)) >>> 0; return x % 360; }
  const monoBg = (p) => { const a = hue(p); return `linear-gradient(135deg,hsl(${a} 70% 58%),hsl(${(a + 40) % 360} 70% 46%))`; };

  /* ---------- pastas visitadas (para "Mais visitadas") ---------- */
  let visits = store.get('neo.visits', {});
  function recordVisit(p) {
    if (!p) return;
    const v = visits[p] || { n: 0, t: 0 };
    v.n++; v.t = Date.now(); visits[p] = v;
    const keys = Object.keys(visits);
    if (keys.length > 200) keys.sort((a, b) => visits[a].t - visits[b].t).slice(0, keys.length - 200).forEach((k) => delete visits[k]);
    store.set('neo.visits', visits);
  }
  const frecent = () => Object.entries(visits)
    .map(([p, v]) => ({ path: p, score: v.n / (1 + (Date.now() - v.t) / 3.6e6 / 72) }))
    .sort((a, b) => b.score - a.score).map((x) => x.path);

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
      const ico = h('span', 'bm-ico', baseName(p).charAt(0).toUpperCase());
      ico.style.background = monoBg(p);
      b.append(ico, h('span', null, baseName(p)));
      b.title = `${p}\nClique: abrir aqui · Ctrl+clique ou botão do meio: nova aba · Botão direito: remover`;
      b.addEventListener('mousedown', (e) => {
        e.preventDefault(); // não tira o foco do terminal
        if (e.button === 1 || (e.button === 0 && e.ctrlKey)) newTab({ cwd: p, ntp: false });
        else if (e.button === 0) openFolder(p);
      });
      b.addEventListener('contextmenu', (e) => { e.preventDefault(); toggleBookmark(p); });
      bar.appendChild(b);
    });
  }

  /* =================== terminal =================== */
  function makeTerm(container, getId, { onPrompt, onTitle, onInput } = {}) {
    const term = new Terminal({
      theme: xtermTheme(), fontFamily: '"Cascadia Code","Cascadia Mono",Consolas,"Courier New",monospace',
      fontSize, lineHeight: 1.2, cursorBlink: true, cursorStyle: 'bar', cursorWidth: 2, scrollback: 10000, allowProposedApi: true,
    });
    const fit = new FitAddon.FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon.WebLinksAddon((_e, url) => neo.openExternal(url)));
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
    return { term, fit, ro };
  }

  // Inicia (ou reinicia) o processo de um terminal. `hold`: no cmd, esconde o texto de abertura
  // (versão do Windows, Clink...) até o primeiro prompt.
  function spawnPty(owner, kind, cwd, term) {
    owner.gen = (owner.gen || 0) + 1;
    if (owner.ptyId) { neo.kill(owner.ptyId); byPty.delete(owner.ptyId); }
    owner.ptyId = `${owner.id}.${owner.gen}`;
    const entry = { term, owner, hold: null };
    if (isWin && kind === 'cmd') entry.hold = { buf: '', timer: setTimeout(() => release(entry, true), 2500) };
    byPty.set(owner.ptyId, entry);
    owner.startedAt = Date.now();
    neo.create({ id: owner.ptyId, kind, cwd, cols: term.cols, rows: term.rows });
  }
  function release(entry, all) {
    const hd = entry.hold;
    if (!hd) return;
    clearTimeout(hd.timer); entry.hold = null;
    const i = hd.buf.indexOf('\x1b]9;9;');
    entry.term.write(all || i < 0 ? hd.buf : hd.buf.slice(i));
  }
  function feed(id, data) {
    const entry = byPty.get(id);
    if (!entry) return;
    entry.owner.onFirstData?.();
    if (!entry.hold) return entry.term.write(data);
    entry.hold.buf += data;
    if (entry.hold.buf.includes('\x1b]9;9;')) release(entry, false);
    else if (entry.hold.buf.length > 200000) release(entry, true);
  }

  /* =================== abas =================== */
  async function newTab(opts = {}) {
    if (!home) home = await neo.home();
    const kind = opts.kind || defaultShell;
    const cwd = opts.cwd || (active && active.cwd) || home;
    const id = 't' + ++seq;
    const pane = h('div', 'term-pane');
    termsEl.appendChild(pane);
    const tab = {
      id, kind, cwd, pane, title: opts.title || null, custom: !!opts.title, claude: null,
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
    spawnPty(tab, kind, cwd, tab.term);
    if (opts.run) tab.pending.push(opts.run);
    if (kind !== 'claude' && ntpEnabled && opts.ntp !== false) showNtp(tab);
    refreshTab(tab);
    return tab;
  }

  function setKindVisual(tab) {
    tab.el.dataset.kind = tab.kind;
    tab.el.querySelector('.fav').textContent = KIND_ICON[tab.kind] || '$_';
  }

  // Cada prompt novo informa a pasta atual: atualiza aba, histórico, favoritos e visitas.
  function onPrompt(tab, p) {
    const wasBusy = tab.busy;
    clearTimeout(tab.busyTimer);
    tab.atPrompt = true; tab.busy = false;
    if (p && !samePath(p, tab.cwd)) {
      tab.cwd = p;
      if (tab.navFlag) tab.navFlag = false;
      else if (!samePath(tab.history[tab.hIndex], p)) {
        tab.history = tab.history.slice(0, tab.hIndex + 1); tab.history.push(p); tab.hIndex = tab.history.length - 1;
      }
      recordVisit(p);
    } else if (p && !tab.visited) { tab.cwd = p; recordVisit(p); }
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
  const focusActive = () => { if (!active) return; if (active.ntp) $('input', active.ntp)?.focus(); else active.term.focus(); };

  function closeTab(tab) {
    const i = tabs.indexOf(tab);
    if (i < 0) return;
    closed.push({ kind: tab.kind, cwd: tab.cwd, title: tab.title });
    if (closed.length > 25) closed.shift();
    neo.kill(tab.ptyId); byPty.delete(tab.ptyId); tab.ro.disconnect(); tab.term.dispose(); tab.pane.remove();
    if (tab.claude) disposeClaude(tab);
    tab.el.remove(); tabs.splice(i, 1);
    if (!tabs.length) { newTab(); return; }
    if (active === tab) activate(tabs[Math.min(i, tabs.length - 1)]);
  }
  const cycle = (dir) => tabs.length > 1 && activate(tabs[(tabs.indexOf(active) + dir + tabs.length) % tabs.length]);
  function reopenClosed() { const c = closed.pop(); if (c) newTab({ kind: c.kind, cwd: c.cwd, title: c.title, ntp: false }); }

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

  /* =================== navegação =================== */
  const quote = (kind, p) => {
    if (kind === 'cmd') return `cd /d "${p}"`;
    if (kind === 'powershell' || kind === 'pwsh') return `Set-Location -LiteralPath '${p.replace(/'/g, "''")}'`;
    return `cd '${p.replace(/'/g, `'\\''`)}'`;
  };
  // Vai para uma pasta: na aba atual se o shell estiver livre; senão, numa aba nova (como o navegador).
  function openFolder(p, { fromHistory = false, tab = active } = {}) {
    if (!p) return;
    if (tab.ntp) { hideNtp(tab, { respawnIn: p }); return; }
    if (tab.kind === 'claude' || !tab.atPrompt) { newTab({ cwd: p, ntp: false }); return; }
    if (samePath(p, tab.cwd)) { focusActive(); return; }
    tab.navFlag = fromHistory;
    runIn(tab, quote(tab.kind, p));
    focusActive();
  }
  function runIn(tab, cmd) {
    if (tab.ntp) hideNtp(tab);
    if (!tab.atPrompt) { tab.pending.push(cmd); return; }
    neo.write(tab.ptyId, cmd + '\r');
    markBusy(tab);
  }
  function runCommand(cmd) {
    const tab = active;
    if (tab.kind === 'claude') { newTab({ cwd: tab.cwd, run: cmd, ntp: false }); return; }
    if (tab.ntp) { hideNtp(tab); tab.pending.push(cmd); if (tab.atPrompt) onPromptFlush(tab); focusActive(); return; }
    if (!tab.atPrompt && tab.visited) { newTab({ cwd: tab.cwd, run: cmd, ntp: false }); return; }
    runIn(tab, cmd); focusActive();
  }
  const onPromptFlush = (tab) => { const next = tab.pending.shift(); if (next) runIn(tab, next); };
  function goBack() { const t = active; if (t.hIndex > 0 && t.atPrompt) { t.hIndex--; openFolder(t.history[t.hIndex], { fromHistory: true }); updateToolbar(); } }
  function goForward() { const t = active; if (t.hIndex < t.history.length - 1 && t.atPrompt) { t.hIndex++; openFolder(t.history[t.hIndex], { fromHistory: true }); updateToolbar(); } }
  async function goUp() { const p = await neo.parent(active.cwd); if (p) openFolder(p); }

  /* =================== barra de ferramentas =================== */
  const omni = $('#omni'), omniInput = $('#omni-input'), crumbs = $('#omni-crumbs');
  let gitSeq = 0;
  function updateToolbar() {
    const t = active;
    if (!t) return;
    const shellTab = t.kind !== 'claude' && !t.ntp;
    $('#nav-back').disabled = !(shellTab && t.atPrompt && t.hIndex > 0);
    $('#nav-fwd').disabled = !(shellTab && t.atPrompt && t.hIndex < t.history.length - 1);
    $('#nav-up').disabled = !(t.cwd && t.kind !== 'claude');
    $('#nav-clear').disabled = !!t.ntp;
    const chip = $('#omni-chip');
    chip.textContent = t.ntp ? 'Nova aba' : KIND_LABEL[t.kind];
    chip.classList.toggle('busy', !!t.busy);
    $('#omni-star').classList.toggle('on', isBookmarked(t.cwd));
    renderCrumbs(t.cwd);
    $('#sidebar-cwd').textContent = shortPath(t.cwd);
    const my = ++gitSeq, git = $('#omni-git');
    neo.gitBranch(t.cwd).then((b) => { if (my !== gitSeq) return; git.classList.toggle('hidden', !b); git.textContent = b ? '⎇ ' + b : ''; });
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
  const ACTIONS = () => [
    ...SHELLS.map((s) => ({ ico: KIND_ICON[s.id], cls: 'act', title: `Nova aba: ${s.label}`, run: () => newTab({ kind: s.id, ntp: false }) })),
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
    const t = active, out = [];
    const raw = q.trim();
    if (!raw) {
      frecent().filter((p) => !samePath(p, t.cwd)).slice(0, 6)
        .forEach((p) => out.push({ ico: '📁', cls: 'dir', title: baseName(p), sub: shortPath(p), run: () => openFolder(p), alt: () => newTab({ cwd: p, ntp: false }) }));
      return out;
    }
    if (raw.startsWith('>')) {
      const f = raw.slice(1).trim().toLowerCase();
      return ACTIONS().filter((a) => a.title.toLowerCase().includes(f)).slice(0, 8).map((a) => ({ ...a, q: f }));
    }
    if (raw.startsWith('?')) {
      const text = raw.slice(1).trim();
      return [{ ico: '✦', cls: 'ask', title: text ? `Perguntar ao Claude: ${text}` : 'Digite a pergunta para o Claude', run: () => text && askClaude(text) }];
    }
    if (looksLikePath(raw)) {
      const r = await neo.complete(t.cwd, raw);
      if (r.exact) out.push({ ico: '📁', cls: 'dir', title: `Ir para ${baseName(r.exact)}`, sub: r.exact, run: () => openFolder(r.exact), alt: () => newTab({ cwd: r.exact, ntp: false }), fill: r.exact });
      r.items.filter((it) => !samePath(it.path, r.exact))
        .forEach((it) => out.push({ ico: '📁', cls: 'dir', title: it.name, sub: it.path, run: () => openFolder(it.path), alt: () => newTab({ cwd: it.path, ntp: false }), fill: it.path + sepOf(it.path) }));
      if (!out.length) out.push({ ico: '>_', cls: 'run', title: `Executar: ${raw}`, run: () => runCommand(raw) });
      return out;
    }
    out.push({ ico: '>_', cls: 'run', title: `Executar: ${raw}`, sub: t.kind === 'claude' ? 'em uma aba nova' : `em ${shortPath(t.cwd)}`, run: () => runCommand(raw), key: 'Enter' });
    const ql = raw.toLowerCase();
    const dirs = [...new Set([...bookmarks, ...frecent()])].filter((p) => baseName(p).toLowerCase().includes(ql)).slice(0, 4);
    dirs.forEach((p) => out.push({ ico: isBookmarked(p) ? '★' : '📁', cls: 'dir', title: baseName(p), sub: shortPath(p), q: raw, run: () => openFolder(p), alt: () => newTab({ cwd: p, ntp: false }) }));
    out.push({ ico: '✦', cls: 'ask', title: `Perguntar ao Claude: ${raw}`, sub: 'abre a sidebar com a pergunta', run: () => askClaude(raw) });
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
        const ico = h('span', 's-ico ' + (s.cls || ''), s.ico);
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
    omniInput.value = active?.cwd ? shortPath(active.cwd) : '';
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
  function greeting() { const hr = new Date().getHours(); return hr < 5 ? 'Boa madrugada' : hr < 12 ? 'Bom dia' : hr < 18 ? 'Boa tarde' : 'Boa noite'; }
  async function showNtp(tab) {
    const known = await neo.knownDirs();
    const page = h('div', 'ntp');
    page.innerHTML = '<div class="aurora"><i></i><i></i><i></i></div>';
    const inner = h('div', 'ntp-inner');
    const clock = h('div', 'ntp-clock');
    const tick = () => { clock.textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };
    tick(); page._clock = setInterval(tick, 10000);
    const greet = h('div', 'ntp-greet');
    const date = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    greet.append(h('b', null, greeting()), ` — ${date}`);

    const search = h('div', 'ntp-search');
    const box = h('div', 'box');
    box.innerHTML = '<svg class="ico" viewBox="0 0 16 16" width="17" height="17"><circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m10.5 10.5 3.2 3.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
    const input = h('input');
    input.placeholder = 'Ir para uma pasta, rodar um comando ou ?perguntar ao Claude';
    input.spellcheck = false;
    box.appendChild(input);
    const pop = h('div', 'omni-pop hidden');
    search.append(box, pop);
    attachOmni(input, pop, search, { showOnEmpty: false });

    inner.append(clock, greet, search);

    const tileSection = (title, paths) => {
      if (!paths.length) return;
      const sec = h('div', 'ntp-section');
      sec.appendChild(h('h3', null, title));
      const grid = h('div', 'tiles');
      paths.slice(0, 8).forEach((p, i) => {
        const tile = h('div', 'tile');
        tile.style.animationDelay = i * 35 + 'ms';
        const mono = h('div', 'mono', baseName(p).charAt(0).toUpperCase() || '/');
        mono.style.background = monoBg(p);
        tile.append(mono, h('div', 't-name', p === home ? 'Pasta pessoal' : baseName(p)), h('div', 't-path', shortPath(p)));
        tile.title = p;
        if (visits[p]) {
          const x = h('button', 't-x', '✕'); x.title = 'Remover das mais visitadas';
          x.addEventListener('mousedown', (e) => { e.stopPropagation(); delete visits[p]; store.set('neo.visits', visits); tile.remove(); });
          tile.appendChild(x);
        }
        tile.addEventListener('mousedown', (e) => {
          if (e.target.closest('.t-x')) return;
          e.preventDefault(); // não tira o foco do terminal
          if (e.button === 1 || e.ctrlKey) newTab({ cwd: p, ntp: false });
          else if (e.button === 0) hideNtp(tab, { respawnIn: p });
        });
        grid.appendChild(tile);
      });
      sec.appendChild(grid); inner.appendChild(sec);
    };
    if (bookmarks.length) tileSection('Favoritos', bookmarks);
    const most = frecent().filter((p) => !isBookmarked(p));
    tileSection(most.length ? 'Mais visitadas' : 'Comece por aqui', most.length ? most : known);

    const sec = h('div', 'ntp-section');
    sec.appendChild(h('h3', null, 'Abrir com'));
    const starts = h('div', 'starts');
    [...SHELLS.map((s) => ({ kind: s.id, t: s.label, s: s.sub })), { kind: 'claude', t: 'Claude Code', s: 'conversa nesta pasta' }].forEach((it) => {
      const b = h('div', 'start');
      b.dataset.kind = it.kind;
      const fav = h('span', 'fav', KIND_ICON[it.kind]);
      fav.style.background = it.kind === 'claude' ? 'linear-gradient(135deg,var(--accent),var(--accent-2))' : it.kind.startsWith('p') ? 'linear-gradient(135deg,#3b82f6,#1d4ed8)' : 'linear-gradient(135deg,#3a4256,#262c3c)';
      const txt = h('div');
      txt.append(h('div', 'st-t', it.t), h('div', 'st-s', it.s));
      b.append(fav, txt);
      b.addEventListener('mousedown', (e) => { if (e.button !== 0) return; e.preventDefault(); hideNtp(tab, { respawnIn: tab.cwd, kind: it.kind }); });
      starts.appendChild(b);
    });
    sec.appendChild(starts); inner.appendChild(sec);

    const hint = h('div', 'ntp-hint');
    hint.innerHTML = '<span><kbd>Esc</kbd> ir para o terminal</span><span><kbd>Ctrl+L</kbd> barra de endereço</span><span><kbd>Alt+←</kbd> voltar</span><span><kbd>Ctrl+D</kbd> favoritar</span><span><kbd>&gt;</kbd> comandos do app</span>';
    inner.appendChild(hint);
    page.appendChild(inner);
    page.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('.omni-pop:not(.hidden)', page)) hideNtp(tab); });
    tab.ntp = page;
    tab.pane.appendChild(page);
    refreshTab(tab); if (tab === active) { updateToolbar(); setTimeout(() => input.focus(), 30); }
  }
  // Sai da página de nova aba. Se escolheu outra pasta ou shell, reinicia o processo lá:
  // nada foi exibido ainda, então não aparece nenhum "cd" digitado.
  function hideNtp(tab, { respawnIn, kind } = {}) {
    const page = tab.ntp;
    if (!page) return;
    tab.ntp = null;
    clearInterval(page._clock);
    page.classList.add('leaving');
    setTimeout(() => page.remove(), 180);
    const newKind = kind || tab.kind;
    if ((respawnIn && !samePath(respawnIn, tab.cwd)) || newKind !== tab.kind) {
      tab.kind = newKind; setKindVisual(tab);
      tab.cwd = respawnIn || tab.cwd; tab.history = [tab.cwd]; tab.hIndex = 0;
      tab.atPrompt = false; tab.visited = false; tab.term.reset();
      spawnPty(tab, tab.kind, tab.cwd, tab.term);
      if (tab.kind === 'claude') recordVisit(tab.cwd);
    }
    refreshTab(tab); if (tab === active) { updateToolbar(); focusActive(); }
  }

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
    hd('Nova aba');
    SHELLS.forEach((s) => add(s.label, () => newTab({ kind: s.id }), { kbd: s.id === defaultShell ? 'padrão' : '' }));
    add('✦  Claude Code', () => newTab({ kind: 'claude' }));
    add('Reabrir aba fechada', reopenClosed, { kbd: 'Ctrl+Shift+T' });
    if (SHELLS.length > 1) { sep(); hd('Shell padrão'); SHELLS.forEach((s) => add(s.label, () => { defaultShell = s.id; store.set('neo.shell', s.id); }, { check: s.id === defaultShell })); }
    sep(); hd('Tema');
    Object.entries(THEMES).forEach(([id, t]) => add(t.label, () => applyTheme(id), { check: id === themeId, swatch: `linear-gradient(135deg,${t.bar} 50%,${t.accent} 50%)` }));
    sep(); hd('Exibição');
    add('Aumentar a fonte', () => setZoom(fontSize + 1), { kbd: 'Ctrl +' });
    add('Diminuir a fonte', () => setZoom(fontSize - 1), { kbd: 'Ctrl −' });
    add('Restaurar a fonte', () => setZoom(14), { kbd: 'Ctrl 0' });
    add('Página de nova aba', () => { ntpEnabled = !ntpEnabled; store.set('neo.ntp', ntpEnabled); toast(ntpEnabled ? 'Página de nova aba ligada' : 'Página de nova aba desligada'); }, { check: ntpEnabled });
    menu.classList.toggle('hidden');
  }
  $('#menu-btn').onclick = (e) => { e.stopPropagation(); openMenu(); };
  $('#new-tab').onclick = () => newTab();
  document.addEventListener('mousedown', (e) => { if (!e.target.closest('#menu') && !e.target.closest('#menu-btn')) menu.classList.add('hidden'); });

  /* =================== atalhos =================== */
  function isAppShortcut(e) {
    const k = e.key.toLowerCase();
    if (e.altKey && !e.ctrlKey && ['arrowleft', 'arrowright', 'arrowup', 'd'].includes(k)) return true;
    if (!e.ctrlKey) return k === 'f6';
    return ['t', 'w', 'tab', 'l', 'd', '=', '+', '-', '_', '0'].includes(k) || /^[1-9]$/.test(k) || (e.shiftKey && k === 'b');
  }
  window.addEventListener('keydown', (e) => {
    if (!isAppShortcut(e) || e.target.isContentEditable) return;
    const k = e.key.toLowerCase();
    const inField = e.target.tagName === 'INPUT';
    if (inField && !e.ctrlKey && !e.altKey) return;
    e.preventDefault();
    if (e.altKey) { if (k === 'arrowleft') goBack(); else if (k === 'arrowright') goForward(); else if (k === 'arrowup') goUp(); else startEditing(); return; }
    if (k === 'f6' || k === 'l') startEditing();
    else if (k === 't') e.shiftKey ? reopenClosed() : newTab();
    else if (k === 'w') closeTab(active);
    else if (k === 'tab') cycle(e.shiftKey ? -1 : 1);
    else if (k === 'd') toggleBookmark();
    else if (k === 'b') toggleSidebar();
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
  neo.home().then((hm) => { home = hm; return newTab(); }).then(() => { if (store.get('neo.sidebar', false)) toggleSidebar(true); });
})();
