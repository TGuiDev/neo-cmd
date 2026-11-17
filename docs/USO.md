# Guia de uso

## Página inicial

O logo **neo** no canto superior esquerdo (ou `Alt+Home`) mostra a página inicial, e o app abre nela. Ela não é uma aba: nada roda até você escolher. Abrir uma pasta, um ambiente ou digitar um comando cria uma aba nova já no lugar certo. `Esc` volta para a aba em que você estava, e fechar a última aba volta para a página inicial.

## Página de nova aba (opcional)

Por padrão, `Ctrl+T` abre direto um terminal. Se preferir que toda aba nova comece na mesma página da página inicial, ligue menu **⋮** → *Página de nova aba*. Ela tem:

- **Prompt:** a linha `❯` funciona como a barra de endereço (veja abaixo). Comece a digitar e as sugestões aparecem.
- **Ambientes:** a lista dos seus ambientes de trabalho, do mais usado para o menos usado.
- **Pastas:** uma prateleira com as favoritas (★) e as mais visitadas. Clique para abrir o terminal ali (sem nenhum `cd` digitado); `Ctrl+clique` ou botão do meio abre em outra aba. O **×** remove uma pasta das mais visitadas.
- **Abrir com:** reinicia a aba com cmd, PowerShell, pwsh ou o Claude Code, na mesma pasta.
- `Esc` vai direto para o terminal.

Para desligar a página, use o menu **⋮** → *Página de nova aba*.

## Ambientes de trabalho

Um ambiente guarda tudo o que você precisa para entrar num projeto:

| Campo | Para quê |
|---|---|
| Nome e cor | aparecem na aba, no botão de ambientes e na página de nova aba |
| Shell | cmd, PowerShell, pwsh ou uma distro do WSL |
| Pasta | onde o terminal abre (no WSL, caminho do Linux, como `/home/voce/projetos/loja` ou `~`) |
| Comandos ao abrir | um por linha; rodam em ordem, cada um quando o anterior termina |
| Sidebar do Claude | abre a sidebar junto, já na pasta do projeto |

**Criar:** botão **Ambientes** → *Novo ambiente*, *+ Novo ambiente* na página de nova aba, `@nome` na barra de endereço, ou *Salvar esta aba como ambiente* (preenche shell e pasta a partir da aba atual).

**Abrir:** clique no ambiente (botão **Ambientes**, `Ctrl+Shift+E`, lista da página de nova aba ou `@nome`). Na página de nova aba ele usa a própria aba; nos outros lugares abre uma aba nova. `Ctrl+clique` ou botão do meio sempre abre em aba nova.

**Editar ou excluir:** *Editar*, que aparece ao passar o mouse no ambiente (na página de nova aba ou no seletor). Excluir pede confirmação.

## WSL

As distros instaladas aparecem como shells (`WSL · Ubuntu`). Dentro do WSL, a barra de endereço acompanha o `cd`, completa as pastas do Linux e mostra a branch do Git. Ir para uma pasta do Windows numa aba WSL digita o caminho equivalente (`/mnt/c/...`); abrir uma pasta do WSL a partir de outra aba abre uma aba WSL.

O aviso da pasta atual vem do `PROMPT_COMMAND`, que o app passa ao Linux pelo `WSLENV`. Se o seu `.bashrc` definir o próprio `PROMPT_COMMAND` (alguns temas fazem isso), acrescente ao final dele:

```bash
PROMPT_COMMAND="${PROMPT_COMMAND:+$PROMPT_COMMAND; }"'printf "\033]9;9;%s\033\\" "$PWD"'
```

## Barra de endereço

Mostra o shell da aba (com um ponto verde quando está livre e pulsando quando um comando roda), a pasta atual como trilha clicável, a branch do Git e a estrela de favorito.

Clique nela (ou `Ctrl+L`, `Alt+D`, `F6`) para digitar:

- **Caminho** (`C:\projetos`, `..`, `~\Downloads`, `.\src`): sugere as subpastas enquanto você digita; `Tab` completa a sugestão selecionada; `Enter` vai até a pasta.
- **Comando:** `Enter` executa na aba atual. Se a aba estiver ocupada com outro comando, ele roda numa aba nova, na mesma pasta.
- **`?pergunta`:** abre a sidebar do Claude nesta aba e envia a pergunta.
- **`@nome`:** abre um ambiente de trabalho (ou cria um com esse nome).
- **`>ação`:** ações do app (novas abas, ambientes, temas, fonte, favoritos, reabrir aba).
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

## Janelas

- **Nova janela:** `Ctrl+Shift+N` ou menu **⋮** → *Nova janela*. Cada janela tem as próprias abas; favoritos, ambientes, tema e pastas visitadas são os mesmos em todas.
- **Shift+clique** num ambiente, numa pasta da página de nova aba ou num favorito abre numa janela nova.
- **Mover uma aba para outra janela:** arraste a aba para fora da janela (ela abre onde você soltar) ou use o botão direito na aba → *Mover para nova janela*. O terminal continua rodando e o conteúdo da tela vai junto. A conversa do Claude da sidebar daquela aba não é levada.

## Abas

- **Nova:** `Ctrl+T` ou **+**. **Fechar:** `Ctrl+W`, **✕** ou botão do meio. **Reabrir:** `Ctrl+Shift+T` (até 25).
- **Alternar:** `Ctrl+Tab` / `Ctrl+Shift+Tab`; `Ctrl+1…8` pelo número, `Ctrl+9` a última.
- **Botão direito na aba:** mover para nova janela, duplicar, renomear, fechar as outras abas ou fechar.
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

O Claude Code pede para confirmar se você confia na pasta, escolher um tema e fazer login. Ele lembra a confiança de cada pasta de projeto, então pergunta uma vez só por pasta.

**Pasta pessoal:** o Claude Code nunca grava a confiança na pasta pessoal (`C:\Users\voce`) e perguntaria toda vez. Por isso, quando a aba está na pasta pessoal, a sidebar abre o Claude numa pasta própria de conversas gerais (`~\.neo-cmd\claude`, mostrada como *conversa geral*), onde a confiança fica gravada. Para o Claude trabalhar num projeto, abra a pasta do projeto antes.

## Temas e fonte

- Menu **⋮** → *Tema*: Grafite (padrão), Meia-noite, Drácula e Claro.
- `Ctrl +`, `Ctrl -` e `Ctrl 0` mudam a fonte.
- Tema, fonte, shell padrão, favoritos, pastas visitadas e o estado da sidebar ficam salvos.

## Fonte do terminal

Menu **⋮** → *Fonte do terminal…* lista as fontes instaladas no seu computador (as monoespaçadas primeiro, com as Nerd Fonts marcadas), cada uma com uma prévia dos ícones de prompt. Escolha a mesma fonte do seu Windows Terminal para o prompt ficar idêntico. Mesmo sem Nerd Font instalada, o app inclui as fontes de ícones (atual e antiga) como reserva.

## Atualizações

O app instalado procura versões novas nos Releases do GitHub ao abrir e a cada 4 horas, e baixa em segundo plano. Quando a versão nova está pronta, aparece o botão **Atualizar para x.y.z** na barra de ferramentas; ao clicar, o Neo CMD fecha, instala e abre de novo. Se você não clicar, ela é instalada na próxima vez que fechar o app. Para procurar na hora: menu **⋮** → *Procurar atualizações* (o menu também mostra a versão atual).

## Copiar e colar

- `Ctrl+C` copia quando há seleção; sem seleção, interrompe o comando.
- `Ctrl+Shift+C` copia e `Ctrl+Shift+V` cola.
- Botão direito: copia a seleção ou, sem seleção, cola.
- Links abrem no navegador ao clicar.

## Atalhos que o app reserva

`Ctrl+T`, `Ctrl+W`, `Ctrl+Tab`, `Ctrl+1…9`, `Ctrl+L`, `Ctrl+D`, `Ctrl +/-/0`, `Ctrl+Shift+B`, `Ctrl+Shift+E`, `Ctrl+Shift+N`, `Alt+←/→/↑`, `Alt+D` e `F6` são do app e **não chegam ao programa no terminal**. Isso inclui o `Ctrl+L` de limpar a tela do Clink e do bash: use o botão ↻ ou `cls`.
