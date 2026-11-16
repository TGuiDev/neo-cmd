# Neo CMD

Terminal para Windows com abas estilo navegador e o Claude Code integrado.

## Rodar

```bash
npm install
npm start
```

## Gerar instalador (Windows)

```bash
npm run dist
```

## Recursos

- **Abas como no Chrome**: arrastar para reordenar, fechar com botão do meio, duplo clique para renomear.
- **Atalhos**: `Ctrl+T` nova aba · `Ctrl+W` fechar · `Ctrl+Shift+T` reabrir fechada · `Ctrl+Tab` / `Ctrl+Shift+Tab` alternar · `Ctrl+1..9` ir para a aba.
- **Shells**: cmd (padrão), PowerShell e pwsh pelo menu ▾ (botão direito num item define como padrão).
- **Claude Code embutido**: o comando `claude` funciona em qualquer aba (instalado junto, via npm).
  - Menu ▾ → "Nova aba do Claude".
  - **Sidebar** (`Ctrl+Shift+B` ou botão ✦ Claude): uma sessão do Claude por aba, aberta na pasta atual da aba. Largura ajustável arrastando a divisória.
- Copiar/colar: `Ctrl+C` copia quando há seleção (senão envia interrupção), `Ctrl+Shift+C/V`, botão direito.
