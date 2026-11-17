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

O app esconde esse texto no cmd. Com o Clink, o script `neo-cmd.lua` avisa o app; ele espera o Clink terminar de imprimir a abertura (logo, aviso de atualização) e manda `Ctrl+L`, o comando de limpar a tela do Clink, que redesenha o prompt no topo. Sem o Clink, o texto antes do primeiro prompt é descartado. Se nenhum aviso chegar em 2,5 s, o texto é exibido para não esconder nada por engano. Se você mudou o atalho `Ctrl+L` do Clink, a tela pode não ser limpa. Nesse caso, abra uma issue contando qual extensão ou tema você usa. Para desativar o aviso de atualização do Clink, rode `clink set clink.autoupdate off`.

## O Claude da sidebar fica numa tela de login ou de tema

É a primeira execução. Siga as instruções na própria sidebar. Isso só acontece uma vez.

## O Claude pergunta "Accessing workspace… Is this a project you trust?"

O Claude Code pergunta uma vez por pasta e lembra a resposta. A exceção é a pasta pessoal, cuja confiança ele nunca grava; por isso, na pasta pessoal o Neo CMD abre o Claude na pasta de conversas gerais (`~\.neo-cmd\claude`), que só pergunta na primeira vez. Escolha *Yes, I trust this folder* nas pastas em que você confia.

## A sidebar do Claude abriu na pasta errada

A sessão é criada na primeira vez que a sidebar é aberta em cada aba, usando a pasta da aba naquele momento. Use **↻** na sidebar para reiniciar o Claude na pasta atual.

## `npm install` falha ao baixar o Electron

O download do Electron vem do GitHub. Em redes com proxy ou firewall, configure as variáveis de proxy do npm ou tente novamente em outra rede.

## O atalho não faz o que eu esperava no meu programa

Alguns atalhos de navegador são reservados pelo app, incluindo `Ctrl+L` (barra de endereço) e `Ctrl+D` (favoritar). Para limpar a tela, use o botão ↻ ou `cls`. Veja [USO.md](USO.md#atalhos-que-o-app-reserva).

## Aparecem quadrados no lugar de ícones do prompt

Prompts do Clink, oh-my-posh e Starship usam ícones de Nerd Font. O Neo CMD inclui as fontes de ícones da Nerd Font (a atual e a antiga, 2.x, cujos ícones muitos temas ainda usam) como reserva. Para o prompt ficar idêntico ao do Windows Terminal, escolha a mesma fonte em menu **⋮** → *Fonte do terminal…*.

## O prompt aparece desalinhado ou com faixas cortadas

O terminal usa altura de linha 1 e as larguras de caracteres do Unicode 11 (as mesmas do Windows), para as faixas e setas do powerline encostarem umas nas outras. Se ainda houver desalinhamento, escolha a fonte do seu Windows Terminal em *Fonte do terminal…* e abra uma issue com uma captura de tela se o problema continuar.

## A tela fica bagunçada ao rolar (linhas repetidas, partes sobrepostas)

O terminal se ajusta ao ConPTY do Windows (`windowsPty`) e desenha pela placa de vídeo (WebGL), como o VS Code, o que evita a maior parte desses problemas, inclusive com programas que redesenham a tela, como o Claude Code. Se a placa de vídeo não estiver disponível, o app volta sozinho ao desenho comum. Se ainda acontecer, abra uma issue com uma captura de tela e o programa que estava rodando.

## A atualização automática não aparece

Ela só funciona no app instalado pelo `NeoCMD-Setup-x.y.z.exe` (não ao rodar com `npm start`). Use menu **⋮** → *Procurar atualizações* para ver a mensagem de erro, se houver.

## A barra de endereço não acompanha o `cd` / voltar fica desativado

O app depende de o shell avisar a pasta atual a cada prompt. Isso é configurado automaticamente no cmd, no PowerShell e no bash. Com o Clink, o app carrega um script próprio (`neo-cmd.lua`, via `CLINK_PATH`) que faz esse aviso mesmo com prompts personalizados. Se o seu prompt ainda assim não avisar, o app trata a aba como sempre livre: a navegação continua funcionando, mas sem o indicador de comando rodando. Abra uma issue informando qual prompt você usa.

## Ir para uma pasta abriu uma aba nova em vez de usar a atual

É intencional: se a aba atual está rodando um comando, o app não digita nada por cima dele e abre a pasta numa aba nova, como o navegador faz com um link.

## Reportar um problema

Abra uma issue com: versão do Windows, como o app foi obtido (executável ou código), passos para reproduzir e a mensagem de erro.
