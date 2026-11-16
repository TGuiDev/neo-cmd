# Compilar e publicar

## Pré-requisitos

- [Node.js](https://nodejs.org) 22 ou superior.
- Para o instalador (`.exe` com assistente), compile **no Windows**.

## Rodar em desenvolvimento

```bash
npm install
npm start
```

## Gerar os executáveis

```bash
npm run dist
```

Cria em `dist/`:

- `NeoCMD-portable.exe`: arquivo único, sem instalação;
- `Neo CMD-<versão>-win.zip`: a pasta do app compactada.

```bash
npm run dist:installer
```

Cria o instalador `Neo CMD Setup <versão>.exe`.

> Compilar no Linux ou macOS funciona para o executável portátil e o zip, mas o instalador exige o Wine. Quando compilar fora do Windows, instale antes os binários do Windows:
> ```bash
> npm install --no-save --force --os=win32 --cpu=x64 @lydell/node-pty-win32-x64 @anthropic-ai/claude-code-win32-x64
> ```

Os arquivos de `dist/` têm mais de 300 MB (o app inclui o Chromium e o Claude Code) e **não são versionados** no Git.

## Publicar um Release (automático)

O workflow [`build.yml`](../.github/workflows/build.yml) compila no Windows e anexa os arquivos a um Release do GitHub.

1. Atualize a versão em `package.json`.
2. Crie e envie uma tag que comece com `v`:

```bash
git tag v0.1.0
git push origin v0.1.0
```

3. Acompanhe a execução na aba **Actions**. Ao terminar, o Release aparece em **Releases** com o `.exe` portátil, o instalador e o zip.

Também é possível rodar o workflow manualmente (**Actions → Build (Windows) → Run workflow**); nesse caso os arquivos ficam como *artifact* da execução, sem criar Release.

## Observações

- Sem certificado de assinatura, o Windows SmartScreen mostra um aviso na primeira execução.
- Para usar um ícone próprio, adicione `build/icon.ico` (256×256) e configure `build.win.icon` em `package.json`; remova também `signAndEditExecutable: false` ao compilar no Windows.
