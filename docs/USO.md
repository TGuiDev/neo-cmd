# Guia de uso

## Página de nova aba

Toda aba nova abre numa página como a do navegador:

- **Busca:** o mesmo campo da barra de endereço (veja abaixo). Comece a digitar e as sugestões aparecem.
- **Favoritos** e **Mais visitadas:** blocos com as suas pastas. Clique para abrir o terminal ali (sem nenhum `cd` digitado); `Ctrl+clique` ou botão do meio abre em outra aba. O **✕** de um bloco o remove das mais visitadas.
- **Abrir com:** reinicia a aba com cmd, PowerShell, pwsh ou o Claude Code, na mesma pasta.
- `Esc` vai direto para o terminal.

Para desligar a página, use o menu **⋮** → *Página de nova aba*.

## Barra de endereço

Mostra o shell da aba (com um ponto verde quando está livre e pulsando quando um comando roda), a pasta atual como trilha clicável, a branch do Git e a estrela de favorito.

Clique nela (ou `Ctrl+L`, `Alt+D`, `F6`) para digitar:

- **Caminho** (`C:\projetos`, `..`, `~\Downloads`, `.\src`): sugere as subpastas enquanto você digita; `Tab` completa a sugestão selecionada; `Enter` vai até a pasta.
- **Comando:** `Enter` executa na aba atual. Se a aba estiver ocupada com outro comando, ele roda numa aba nova, na mesma pasta.
- **`?pergunta`:** abre a sidebar do Claude nesta aba e envia a pergunta.
- **`>ação`:** ações do app (novas abas, temas, fonte, favoritos, reabrir aba).
- Com o campo vazio, ele sugere as pastas mais visitadas.

`↑`/`↓` escolhem a sugestão, `Ctrl+Enter` abre a pasta sugerida numa aba nova e `Esc` cancela.

Ir para uma pasta digita o `cd` correspondente no terminal (`cd /d` no cmd, `Set-Location` no PowerShell), para que você veja o que aconteceu. Se o terminal estiver ocupado, a pasta abre numa aba nova.

## Navegação

- **Voltar / avançar** (`Alt+←` / `Alt+→`): percorrem o histórico de pastas da aba. Ficam desativados enquanto um comando roda.
- **Pasta acima** (`Alt+↑`).
- **Limpar a tela:** o botão ↻ ao lado limpa o terminal.

## Favoritos

- `Ctrl+D` ou a estrela marcam a pasta atual.
- A barra de favoritos aparece abaixo da barra de endereço quando há pelo menos um.
- Clique: vai até a pasta. `Ctrl+clique` ou botão do meio: nova aba. Botão direito: remover.

## Abas

- **Nova:** `Ctrl+T` ou **+**. **Fechar:** `Ctrl+W`, **✕** ou botão do meio. **Reabrir:** `Ctrl+Shift+T` (até 25).
- **Alternar:** `Ctrl+Tab` / `Ctrl+Shift+Tab`; `Ctrl+1…8` pelo número, `Ctrl+9` a última.
- **Reordenar:** arraste. **Renomear:** duplo clique (vazio volta ao nome automático, que é o nome da pasta).
- **Ocupada:** o ícone vira um indicador de carregamento enquanto um comando roda.
- **Concluída:** um ponto aparece quando um comando termina numa aba em segundo plano; some ao abrir a aba.
- Se o shell terminar (`exit`), a aba fecha.
- O texto de abertura do cmd (versão do Windows, Clink) fica escondido; a aba mostra só o prompt.

## Shells

Menu **⋮** → *Nova aba*: cmd, Windows PowerShell, PowerShell 7 (se instalado) ou Claude Code. Em *Shell padrão* você escolhe o shell das abas novas (fica salvo). O cmd e o PowerShell informam a pasta atual ao app, então a barra de endereço acompanha o `cd`.

## Claude Code

O comando `claude` funciona em qualquer aba, porque o app já o inclui.

### Sidebar

- `Ctrl+Shift+B` ou o botão **✦ Claude**.
- Cada aba tem a sua conversa, que não se perde ao trocar de aba. Ela começa na pasta em que a aba estava ao abrir a sidebar pela primeira vez.
- O botão ↻ da sidebar começa uma conversa nova na aba ativa.
- `?pergunta` na barra de endereço envia a pergunta direto para a sidebar.
- O Claude é aberto direto, sem shell no meio. Trocar de aba não move o foco para ele.
- Arraste a divisória para mudar a largura.

### Primeira execução

O Claude Code pede para confirmar se você confia na pasta, escolher um tema e fazer login.

## Temas e fonte

- Menu **⋮** → *Tema*: Neo Escuro, Meia-noite, Drácula e Claro.
- `Ctrl +`, `Ctrl -` e `Ctrl 0` mudam a fonte.
- Tema, fonte, shell padrão, favoritos, pastas visitadas e o estado da sidebar ficam salvos.

## Copiar e colar

- `Ctrl+C` copia quando há seleção; sem seleção, interrompe o comando.
- `Ctrl+Shift+C` copia e `Ctrl+Shift+V` cola.
- Botão direito: copia a seleção ou, sem seleção, cola.
- Links abrem no navegador ao clicar.

## Atalhos que o app reserva

`Ctrl+T`, `Ctrl+W`, `Ctrl+Tab`, `Ctrl+1…9`, `Ctrl+L`, `Ctrl+D`, `Ctrl +/-/0`, `Ctrl+Shift+B`, `Alt+←/→/↑`, `Alt+D` e `F6` são do app e **não chegam ao programa no terminal**. Isso inclui o `Ctrl+L` de limpar a tela do Clink e do bash: use o botão ↻ ou `cls`.
