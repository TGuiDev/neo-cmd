# Compilar e publicar

## Pré-requisitos

- [Node.js](https://nodejs.org) 22 ou superior.
- O instalador é gerado com NSIS e deve ser compilado **no Windows** (fora dele exige o Wine).

## Rodar em desenvolvimento

```bash
npm install
npm start
```

## Gerar os executáveis

```bash
npm run dist
```

Cria em `dist/` o instalador `NeoCMD-Setup-<versão>.exe`. Ele instala só para o usuário atual (sem administrador), cria atalhos no menu Iniciar e na área de trabalho e registra um desinstalador.

> Para testar sem gerar o instalador, `npx electron-builder --win --dir --x64` cria só a pasta do app em `dist/win-unpacked` (leva menos de um minuto). Fora do Windows, instale antes os binários do Windows:
> ```bash
> npm install --no-save --force --os=win32 --cpu=x64 @lydell/node-pty-win32-x64 @anthropic-ai/claude-code-win32-x64
> ```

Os arquivos de `dist/` têm centenas de MB (o app inclui o Chromium e o Claude Code, que sozinho tem uns 350 MB) e **não são versionados** no Git.

### Por que o build demora

Quase todo o tempo vai para compactar o app (mais de 600 MB antes de compactar) com LZMA, que é lenta; cada formato gerado compacta tudo de novo. Por isso o projeto gera **um único formato**, o instalador. O que já foi feito para reduzir:

- o executável do Claude Code entrava duas vezes no pacote e agora entra uma só (o app ficou 40% menor);
- só os idiomas pt-BR e en-US do Chromium são incluídos;
- o download do Electron fica em cache entre execuções.

## Publicar um Release (automático)

O workflow [`build.yml`](../.github/workflows/build.yml) compila no Windows e anexa os arquivos a um Release do GitHub.

1. Atualize a versão em `package.json`.
2. Crie e envie uma tag que comece com `v`:

```bash
git tag v0.1.0
git push origin v0.1.0
```

3. Acompanhe a execução na aba **Actions**. A tag precisa ser igual à versão do `package.json` (`v` + versão); o workflow confere isso, porque o app instalado compara essa versão para decidir se há atualização. O Release recebe também o `latest.yml`, que o atualizador automático lê. Ao terminar, o Release aparece em **Releases** com o instalador.

Também é possível rodar o workflow manualmente (**Actions → Build (Windows) → Run workflow**). Se preencher o campo *release_tag* (ex.: `v0.1.3`), o Release é criado com essa tag; se deixar em branco, os arquivos ficam como *artifact* da execução.

## Observações

- Sem certificado de assinatura, o Windows SmartScreen mostra um aviso na primeira execução.
- O ícone do app vem de `build/icon.svg` (desenho original) e `build/icon.png` (512×512, usado pelo electron-builder no executável e no instalador). Ao mudar o SVG, gere o PNG de novo.
- Gravar o ícone no executável exige o Windows (ou o Wine). Compilando no Linux sem Wine, use `--dir` para testar.
