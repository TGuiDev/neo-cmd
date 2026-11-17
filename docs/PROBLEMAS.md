# Solução de problemas

## O Windows avisa "editor desconhecido" (SmartScreen)

O executável não é assinado digitalmente. Clique em **Mais informações → Executar assim mesmo**.

## O antivírus bloqueou o executável

Programas empacotados com Electron e que abrem terminais às vezes geram falsos positivos. Se confiar no arquivo, adicione-o às exceções, ou compile você mesmo a partir do código ([COMPILAR.md](COMPILAR.md)).

## `claude` não é reconhecido numa aba

- Confira se o terminal foi aberto pelo Neo CMD (o `PATH` é ajustado apenas nos terminais dele).
- Rode `where claude` no cmd. O caminho deve apontar para a pasta do app.
- Se o problema persistir, abra uma issue com o resultado do comando.

## Apareceu o texto de versão do Windows ou do Clink ao abrir uma aba

O app esconde esse texto no cmd até o primeiro prompt avisar a pasta atual (com o Clink, pelo script `neo-cmd.lua`). Se esse aviso não chegar em 2,5 s, o texto é exibido para não esconder nada por engano. Nesse caso, abra uma issue contando qual extensão ou tema você usa. Para desativar o aviso de atualização do Clink, rode `clink set clink.autoupdate off`.

## O Claude da sidebar fica numa tela de login ou de tema

É a primeira execução. Siga as instruções na própria sidebar. Isso só acontece uma vez.

## A sidebar do Claude abriu na pasta errada

A sessão é criada na primeira vez que a sidebar é aberta em cada aba, usando a pasta da aba naquele momento. Use **↻** na sidebar para reiniciar o Claude na pasta atual.

## `npm install` falha ao baixar o Electron

O download do Electron vem do GitHub. Em redes com proxy ou firewall, configure as variáveis de proxy do npm ou tente novamente em outra rede.

## O atalho não faz o que eu esperava no meu programa

Alguns atalhos de navegador são reservados pelo app, incluindo `Ctrl+L` (barra de endereço) e `Ctrl+D` (favoritar). Para limpar a tela, use o botão ↻ ou `cls`. Veja [USO.md](USO.md#atalhos-que-o-app-reserva).

## Aparecem quadrados no lugar de ícones do prompt

Prompts do Clink, oh-my-posh e Starship usam ícones de Nerd Font. O Neo CMD já inclui uma fonte só com esses ícones (Symbols Nerd Font), usada quando a fonte principal não tem o ícone. Se você tem uma Nerd Font instalada (por exemplo, CaskaydiaCove Nerd Font ou Cascadia Code NF), ela é usada primeiro. Se ainda aparecer algum quadrado, abra uma issue com uma captura de tela.

## A barra de endereço não acompanha o `cd` / voltar fica desativado

O app depende de o shell avisar a pasta atual a cada prompt. Isso é configurado automaticamente no cmd, no PowerShell e no bash. Com o Clink, o app carrega um script próprio (`neo-cmd.lua`, via `CLINK_PATH`) que faz esse aviso mesmo com prompts personalizados. Se o seu prompt ainda assim não avisar, o app trata a aba como sempre livre: a navegação continua funcionando, mas sem o indicador de comando rodando. Abra uma issue informando qual prompt você usa.

## Ir para uma pasta abriu uma aba nova em vez de usar a atual

É intencional: se a aba atual está rodando um comando, o app não digita nada por cima dele e abre a pasta numa aba nova, como o navegador faz com um link.

## Reportar um problema

Abra uma issue com: versão do Windows, como o app foi obtido (executável ou código), passos para reproduzir e a mensagem de erro.
