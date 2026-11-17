# Arquitetura

```
neo-cmd/
├── src/
│   ├── main.js              # processo principal: janela e terminais (PTY)
│   ├── preload.js           # ponte segura entre o app e a interface
│   └── renderer/
│       ├── index.html       # estrutura: abas, barra de ferramentas, favoritos, terminais, sidebar
│       ├── styles.css       # visual
│       └── renderer.js      # abas, navegação, barra de endereço, nova aba, sidebar, atalhos
├── src/clink/neo-cmd.lua    # avisa a pasta atual quando o Clink usa prompt personalizado
├── src/renderer/fonts/      # fonte de ícones Nerd Font (reserva)
├── build/icon.svg, icon.png # logo do app (ícone do executável e do instalador)
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
- **Linguagem visual:** um único destaque (o roxo do logo), superfícies neutras, sem gradientes nem brilhos; âmbar só para "comando rodando". A interface usa a fonte do Windows (Segoe UI) e tudo o que é do terminal (caminhos, shells, atalhos) usa JetBrains Mono, embutida em `src/renderer/fonts/` (licença OFL).
- **Interface de navegador:** barra de abas, barra de ferramentas (voltar, avançar, subir, limpar), barra de endereço, barra de favoritos e página de nova aba. Quatro temas por variáveis CSS; o tema do xterm.js é trocado junto. A branch do Git vem de `git rev-parse`, executado no processo principal.
- **Prompt como sinal:** cada shell emite `OSC 9;9` no prompt (cmd via `PROMPT`, Clink via o script `src/clink/neo-cmd.lua` carregado por `CLINK_PATH`, PowerShell via função `prompt`, bash via `PROMPT_COMMAND`). Uma aba cujo shell nunca emitiu o sinal é tratada como sempre livre, sem indicador de ocupada. Esse sinal diz ao app que o shell está livre e em qual pasta está. Com ele o app atualiza a trilha da barra de endereço, o histórico de voltar e avançar e as pastas visitadas, decide se pode digitar um `cd` na aba ou se precisa abrir outra, e mostra os indicadores de aba ocupada e concluída.
- **Barra de endereço:** um único motor de sugestões atende a barra e a busca da página de nova aba. Caminhos são completados no processo principal (`fs:complete`, que lista subpastas); comandos vão para o terminal; `?` envia ao Claude; `>` lista ações do app.
- **Página de nova aba sem `cd` visível:** o shell da aba já nasce por trás da página. Ao escolher uma pasta ou um shell, o processo é reiniciado direto lá, antes de qualquer saída aparecer. Cada processo tem um id próprio (`aba.geração`), então eventos de processos antigos são ignorados.
- **Ícones de prompt:** a fonte `Symbols Nerd Font Mono` (licença MIT, em `src/renderer/fonts/`) entra no fim da lista de fontes do terminal e cobre os ícones que a fonte principal não tem.
- **Ambientes de trabalho:** guardados em `localStorage` (`neo.envs`) com nome, cor, chave do shell (`cmd`, `powershell`, `pwsh` ou `wsl:<distro>`), pasta e comandos ao abrir. Abrir um ambiente cria (ou reaproveita, na página de nova aba) uma aba com esse shell e pasta e enfileira os comandos, que são enviados um a cada prompt.
- **WSL:** o processo principal lista as distros com `wsl.exe -l -v` (saída em UTF-16) e abre cada aba com `wsl.exe -d <distro> --cd <pasta>`. O `PROMPT_COMMAND` que emite `OSC 9;9` chega ao Linux pelo `WSLENV`. Pastas do Linux são lidas pelo Windows em `\\wsl.localhost\<distro>\...`, para autocompletar e para a branch do Git.
- **Dados locais:** tema, fonte, shell padrão, favoritos, pastas visitadas (com pontuação por frequência e recência) e estado da sidebar ficam em `localStorage`.
- **Uma sessão do Claude por aba:** criada sob demanda, na primeira vez que a sidebar é aberta naquela aba, e encerrada junto com ela.
- **PTY nativo sem compilação:** `@lydell/node-pty` traz binários pré-compilados por plataforma, o que evita exigir ferramentas de compilação C++ no Windows.

## Limitações conhecidas

- As sessões abertas não são restauradas ao reabrir o app.
- O executável não é assinado digitalmente.
