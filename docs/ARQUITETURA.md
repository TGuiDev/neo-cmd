# Arquitetura

```
neo-cmd/
├── src/
│   ├── main.js              # processo principal: janela e terminais (PTY)
│   ├── preload.js           # ponte segura entre o app e a interface
│   └── renderer/
│       ├── index.html       # estrutura: barra de abas, terminais, sidebar
│       ├── styles.css       # visual
│       └── renderer.js      # abas, sidebar, atalhos, xterm.js
├── build/bin/claude.cmd     # atalho do `claude` no app empacotado (Windows)
├── docs/                    # documentação e imagens
└── .github/workflows/       # build no Windows e publicação de Releases
```

## Como as partes se conversam

1. A **interface** (`renderer.js`) desenha as abas e usa o [xterm.js](https://xtermjs.org) para exibir cada terminal.
2. Quando uma aba é criada, ela pede ao **processo principal** (`main.js`), via `preload.js`, para abrir um shell de verdade (cmd, PowerShell…) usando [@lydell/node-pty](https://github.com/lydell/node-pty).
3. O que você digita vai da interface para o shell; a saída do shell volta para o xterm.js. Cada terminal tem um identificador, que roteia os dados.
4. O tamanho do terminal (colunas e linhas) é recalculado quando a janela ou a sidebar muda, e enviado ao shell.

## Decisões

- **Segurança:** `contextIsolation` ligado, `nodeIntegration` desligado e CSP restritiva. A interface só enxerga as funções expostas em `preload.js`.
- **Barra de título própria:** `titleBarStyle: hidden` com `titleBarOverlay`, para que as abas ocupem a barra de título (como no Chrome) e os botões de janela do Windows continuem funcionando.
- **Pasta atual da aba:** no cmd, o `PROMPT` é configurado para emitir a sequência `OSC 9;9` (a mesma convenção do Windows Terminal) com a pasta atual; no PowerShell, uma função `prompt` faz o mesmo. O xterm.js a lê e atualiza o nome da aba, a barra de status e a pasta usada pela sidebar.
- **Texto de inicialização do cmd:** o cmd imprime a versão do Windows e, se houver, banners de extensões como o Clink. O app retém a saída do cmd até o primeiro prompt (a primeira sequência `OSC 9;9`) e descarta o que veio antes. Se o prompt não chegar em 2,5 s, tudo é exibido, para nunca esconder informação por engano.
- **Claude Code embutido:** o pacote `@anthropic-ai/claude-code` é dependência do projeto. Na sidebar e nas abas do Claude, o executável do pacote da plataforma (`claude-code-<plataforma>-<arquitetura>`) é iniciado diretamente como processo do terminal, sem passar por um shell. Para o comando `claude` funcionar nos terminais comuns, o diretório com o executável entra no `PATH` (`node_modules/.bin` em desenvolvimento; `resources/bin/claude.cmd` no app empacotado, que aponta para o `claude.exe` descompactado).
- **Interface:** abas em pílula com ícone por shell, terminais em cartões arredondados, barra de status e quatro temas por variáveis CSS (o tema do xterm.js é trocado junto). Tema, zoom e estado da sidebar ficam em `localStorage`. A branch do Git vem de `git rev-parse`, executado no processo principal.
- **Uma sessão do Claude por aba:** criada sob demanda, na primeira vez que a sidebar é aberta naquela aba, e encerrada junto com ela.
- **PTY nativo sem compilação:** `@lydell/node-pty` traz binários pré-compilados por plataforma, o que evita exigir ferramentas de compilação C++ no Windows.

## Limitações conhecidas

- As sessões abertas não são restauradas ao reabrir o app.
- O executável não é assinado e usa o ícone padrão do Electron.
