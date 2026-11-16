# Guia de uso

## Abas

- **Nova aba:** `Ctrl+T` ou o botão **+**. A nova aba abre na mesma pasta da aba ativa.
- **Fechar:** `Ctrl+W`, o **✕** da aba ou clique com o botão do meio do mouse. Se você fechar a última aba, uma nova é aberta.
- **Reabrir:** `Ctrl+Shift+T` reabre as últimas abas fechadas (até 20), na mesma pasta e com o mesmo shell.
- **Alternar:** `Ctrl+Tab` avança, `Ctrl+Shift+Tab` volta. `Ctrl+1` a `Ctrl+8` vão direto para a aba pelo número; `Ctrl+9` vai para a última.
- **Reordenar:** arraste a aba. Uma marca azul indica onde ela será solta.
- **Renomear:** duplo clique. Deixar o nome vazio volta ao nome automático.
- **Nome automático:** é o nome da pasta atual. No cmd, o terminal acompanha as mudanças de pasta; nos outros shells, vale a pasta de abertura ou o título definido pelo shell.
- Se um shell terminar (`exit`), a aba fecha sozinha.

## Shells

O botão **▾**, ao lado do **+**, abre o menu:

| Item | Observação |
|---|---|
| Prompt de Comando (cmd) | Padrão no Windows |
| Windows PowerShell | `powershell.exe` |
| PowerShell 7 (pwsh) | Precisa estar instalado |
| ✦ Nova aba do Claude | Abre uma aba rodando o `claude` |

Clique com o botão direito num shell do menu para torná-lo o padrão das próximas abas (vale até fechar o app).

## Claude Code

O comando `claude` funciona em qualquer aba, porque o app já o inclui e o adiciona ao `PATH` dos terminais que abre.

### Sidebar

- Abra com o botão **✦ Claude** ou `Ctrl+Shift+B`; feche com o **✕** da sidebar ou repetindo o atalho.
- Cada aba tem a sua própria sessão. Ao trocar de aba, a sidebar mostra a sessão daquela aba, e a conversa não se perde.
- A sessão começa na pasta em que a aba estava quando a sidebar foi aberta pela primeira vez. O caminho aparece no topo da sidebar.
- **↻** reinicia o Claude da aba ativa (útil depois de encerrá-lo ou para começar do zero).
- Arraste a divisória para mudar a largura.

### Primeira execução

O Claude Code pede para escolher um tema e fazer login. Isso acontece uma vez e vale para o app inteiro.

## Copiar e colar

- `Ctrl+C` copia quando há texto selecionado. Sem seleção, envia a interrupção normal (cancela o comando).
- `Ctrl+Shift+C` copia e `Ctrl+Shift+V` cola.
- Botão direito: copia a seleção ou, sem seleção, cola o conteúdo da área de transferência.
- Links (`http://` e `https://`) abrem no navegador padrão ao clicar.

## Atalhos que o app reserva

`Ctrl+T`, `Ctrl+W`, `Ctrl+Tab`, `Ctrl+1…9` e `Ctrl+Shift+B` são tratados pelo app e **não chegam ao programa que estiver rodando no terminal**. Se você usa algum deles em editores de terminal (por exemplo, `Ctrl+W` no vim), eles serão interceptados.
