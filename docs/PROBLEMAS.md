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

O app esconde esse texto no cmd, mas isso depende de o prompt chegar logo. Se o seu cmd tiver um prompt que remove a sequência de pasta atual (alguns temas do Clink fazem isso), o texto é exibido depois de 2,5 s. Nesse caso, abra uma issue contando qual extensão você usa. Para desativar o aviso de atualização do Clink, rode `clink set clink.autoupdate off`.

## O Claude da sidebar fica numa tela de login ou de tema

É a primeira execução. Siga as instruções na própria sidebar. Isso só acontece uma vez.

## A sidebar do Claude abriu na pasta errada

A sessão é criada na primeira vez que a sidebar é aberta em cada aba, usando a pasta da aba naquele momento. Use **↻** na sidebar para reiniciar o Claude na pasta atual. No PowerShell, o acompanhamento automático da pasta não existe: vale a pasta de abertura da aba.

## `npm install` falha ao baixar o Electron

O download do Electron vem do GitHub. Em redes com proxy ou firewall, configure as variáveis de proxy do npm ou tente novamente em outra rede.

## O atalho não faz o que eu esperava no meu programa

`Ctrl+T`, `Ctrl+W`, `Ctrl+Tab`, `Ctrl+1…9`, `Ctrl +/-/0` e `Ctrl+Shift+B` são reservados pelo app. Veja [USO.md](USO.md#atalhos-que-o-app-reserva).

## Reportar um problema

Abra uma issue com: versão do Windows, como o app foi obtido (executável ou código), passos para reproduzir e a mensagem de erro.
