<p align="center">
  <img src="docs/images/banner.svg" alt="Neo CMD" width="100%" />
</p>

<p align="center">
  <b>Um terminal para Windows que navega como o seu navegador.</b><br/>
  Abas, barra de endereço, voltar e avançar, favoritos, página de nova aba e o Claude Code embutido.
</p>

<p align="center">
  <img alt="Plataforma" src="https://img.shields.io/badge/plataforma-Windows%2010%2F11-0078D6?logo=windows&logoColor=white" />
  <img alt="Electron" src="https://img.shields.io/badge/Electron-45-47848F?logo=electron&logoColor=white" />
  <img alt="Licença" src="https://img.shields.io/badge/licen%C3%A7a-MIT-green" />
</p>

---

## A ideia

Você já sabe usar um navegador. O Neo CMD leva esse jeito de navegar para o terminal: cada aba é um terminal, a barra de endereço mostra onde você está, e voltar, avançar e favoritar funcionam como no Chrome. O cmd e o PowerShell continuam lá, de verdade; o Neo CMD só muda a forma de chegar até eles.

## Página de nova aba

<p align="center"><img src="docs/images/ntp.png" alt="Página de nova aba com relógio, busca, favoritos e pastas mais visitadas" width="900" /></p>

Toda aba nova começa aqui, como no navegador: suas pastas **favoritas** e as **mais visitadas** em blocos, uma busca que entende pastas, comandos e perguntas, e atalhos para abrir com cmd, PowerShell ou o Claude. Clique num bloco e o terminal já abre naquela pasta, sem nenhum `cd` digitado.

## Barra de endereço

<p align="center"><img src="docs/images/omnibox.png" alt="Barra de endereço sugerindo subpastas enquanto você digita" width="900" /></p>

A pasta atual aparece como uma trilha clicável (`~ › projetos › api`): clique em qualquer parte para subir até ela. Clique na barra (ou `Ctrl+L`) e digite:

| Você digita | O que acontece |
|---|---|
| um caminho (`C:\projetos`, `..\site`, `~\Downloads`) | vai até a pasta, com autocompletar de subpastas (`Tab` completa) |
| um comando (`npm test`) | executa na aba atual (ou numa aba nova, se a atual estiver ocupada) |
| `?` + pergunta (`?por que esse build falha`) | abre a sidebar e manda a pergunta para o Claude Code |
| `>` + ação (`>tema`) | ações do app: temas, shells, fonte, favoritos |

## Navegue como no navegador

<p align="center"><img src="docs/images/browser.png" alt="Terminal com barra de endereço, botões de navegação, favoritos e branch do Git" width="900" /></p>

- **Voltar, avançar e subir** (`Alt+←`, `Alt+→`, `Alt+↑`): cada aba guarda o histórico das pastas por onde passou.
- **Favoritos** (`Ctrl+D` ou ★): as pastas favoritas ganham uma barra própria. Clique para ir, `Ctrl+clique` para abrir em nova aba, botão direito para remover.
- **Abas que avisam**: enquanto um comando roda, o ícone da aba vira um indicador de carregamento; quando um comando termina numa aba em segundo plano, aparece um ponto, como uma notificação.
- **Branch do Git** e **shell da aba** sempre visíveis na barra de endereço.
- Abas que se arrastam, fecham com o botão do meio, renomeiam com duplo clique e reabrem com `Ctrl+Shift+T`.

## Claude Code embutido

<p align="center"><img src="docs/images/claude-sidebar.png" alt="Sidebar do Claude Code ao lado do terminal" width="900" /></p>

O Claude Code vem dentro do app. Abra a sidebar com **✦ Claude** (`Ctrl+Shift+B`): cada aba tem a sua própria conversa, aberta na pasta daquela aba. Ele também funciona como aba própria e como o comando `claude` em qualquer terminal. Na primeira vez, o Claude Code pede para confirmar a pasta e fazer login.

## Temas

<p align="center">
  <img src="docs/images/theme-claro.png" alt="Tema Claro" width="49%" />
  <img src="docs/images/theme-dracula.png" alt="Tema Drácula" width="49%" />
</p>

Neo Escuro, Meia-noite, Drácula e Claro, no menu **⋮**. Tema, fonte, favoritos e pastas visitadas ficam salvos.

> Todas as imagens são capturas reais do app, feitas no Linux. No Windows, os shells são cmd, PowerShell e pwsh.

## Atalhos

| Ação | Atalho |
|---|---|
| Nova aba / fechar / reabrir fechada | `Ctrl+T` / `Ctrl+W` / `Ctrl+Shift+T` |
| Alternar abas / ir para a aba N | `Ctrl+Tab` / `Ctrl+1…9` |
| Barra de endereço | `Ctrl+L`, `Alt+D` ou `F6` |
| Voltar / avançar / pasta acima | `Alt+←` / `Alt+→` / `Alt+↑` |
| Favoritar a pasta | `Ctrl+D` |
| Sidebar do Claude | `Ctrl+Shift+B` |
| Fonte maior / menor / padrão | `Ctrl +` / `Ctrl -` / `Ctrl 0` |
| Copiar / colar | `Ctrl+C` com seleção, `Ctrl+Shift+C/V`, botão direito |

Detalhes em [docs/USO.md](docs/USO.md).

## Instalação

Baixe o `NeoCMD-Setup-<versão>.exe` em [**Releases**](../../releases) e execute. A instalação é só para o seu usuário (não pede administrador), cria atalhos no menu Iniciar e na área de trabalho e tem desinstalador.

> O instalador não é assinado digitalmente, então o Windows SmartScreen pode avisar "editor desconhecido". Clique em **Mais informações → Executar assim mesmo**.

### A partir do código

Requisitos: [Node.js](https://nodejs.org) 22 ou superior.

```bash
git clone https://github.com/TGuiDev/neo-cmd.git
cd neo-cmd
npm install
npm start
```

Para gerar o instalador: `npm run dist` (no Windows). Veja [docs/COMPILAR.md](docs/COMPILAR.md).

## Documentação

- [Guia de uso](docs/USO.md)
- [Arquitetura](docs/ARQUITETURA.md)
- [Compilar e publicar](docs/COMPILAR.md)
- [Solução de problemas](docs/PROBLEMAS.md)

## Status

Projeto em fase inicial, desenvolvido e testado em Linux; o instalador para Windows é gerado automaticamente, mas ainda precisa de mais testes em máquinas Windows. Encontrou algo errado? Abra uma issue com a mensagem de erro.

## Tecnologias

[Electron](https://www.electronjs.org) · [xterm.js](https://xtermjs.org) · [@lydell/node-pty](https://github.com/lydell/node-pty) · [Claude Code](https://claude.com/claude-code)

## Licença

[MIT](LICENSE)
