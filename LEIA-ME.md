# Código-fonte — Simulador de Importação EPIC

Aplicação web estática, sem framework, backend ou dependências de terceiros em
execução. O navegador carrega HTML, CSS, JavaScript e imagens; os dados ficam no
`localStorage` da própria origem. O `build.py` reúne os arquivos em um HTML único
para publicação.

## Estrutura

```text
epic-simulador/
├── index.html                 página de desenvolvimento
├── css/styles.css             interface e impressão
├── js/app.js                  estado, cálculo, telas e eventos
├── img/                       logos usadas pela interface
├── build.py                   gera a distribuição autossuficiente
├── tests/                     regressão, build e navegador
├── REVISAO.md                 revisão técnica e pontos pendentes
└── dist/
    ├── index.html             arquivo de produção
    └── epic-simulador.html    cópia idêntica para uso local
```

Não edite os arquivos de `dist/`: eles são sobrescritos pelo build. Trabalhe em
`index.html`, `css/styles.css` e `js/app.js`.

## Executar localmente no VS Code

Abra esta pasta no VS Code, escolha **Terminal → Novo Terminal** e execute:

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

Abra `http://127.0.0.1:8000` e use `Ctrl+C` para encerrar o servidor. No Windows,
`py` pode substituir `python`; em outros sistemas, pode ser necessário usar
`python3`. Não é necessário instalar npm, extensão ou servidor de aplicação.

Use sempre o mesmo endereço e porta. O armazenamento do navegador é separado por
origem: `localhost`, `127.0.0.1`, outras portas, outro domínio e `file://` não
compartilham os mesmos dados. As chaves usadas atualmente são:

- `epic_params`: parâmetros da simulação;
- `epic_prop`: dados da proposta;
- `epic_forn`: cenários dos três fornecedores;
- `epic_num`: sequencial e histórico de propostas.

O simulador não envia esses dados pela rede. PDF e cópia em texto continuam
disponíveis no navegador. Não existe importação ou exportação local de arquivos de
dados nesta versão.

## Gerar a versão de produção

```powershell
python build.py
```

O comando gera dois arquivos idênticos:

- `dist/index.html`: entrada para hospedagem;
- `dist/epic-simulador.html`: versão conveniente para abrir diretamente.

CSS, JavaScript e logos ficam embutidos. O resultado não faz requisições externas
e também funciona aberto diretamente por `file://`, embora um servidor local seja
mais confiável para persistência.

## Publicação estática

Use `dist/` como diretório de saída e `dist/index.html` como arquivo inicial.

- Vercel ou Cloudflare Pages: configure `python build.py` como comando de build,
  quando o ambiente disponibilizar Python, e `dist` como diretório de publicação.
  Também é possível publicar a pasta `dist` já gerada, sem comando de build.
- GitHub Pages: publique o conteúdo de `dist` na raiz da origem configurada para o
  Pages. O `index.html` deve ficar na raiz publicada.

Não há rotas de servidor, variáveis secretas ou serviços externos obrigatórios.

## Organização do JavaScript

| Bloco | Responsabilidade |
|---|---|
| `DEFAULTS`, `PROP_DEF`, `NUMF`, `S` | padrões, precisão e estado da aplicação |
| `load`, `save`, `carregarNum`, `salvarNum` | persistência no navegador |
| `num`, `brl`, `money`, `perc` | conversão e formatação em pt-BR |
| `compute(p)` | motor de cálculo usado por todas as telas |
| `sec`, `row`, `fld`, `head` | geradores de HTML reutilizados |
| `viewResumo` … `viewFontes` | conteúdo das nove abas |
| `FORN_KEYS`, `paramsForn` | cenários e comparação de fornecedores |
| `docHTML` | demonstrativos do cliente e interno |
| `render`, `softRefresh` | atualização da tela e indicadores |
| `printDoc`, `copyDoc` | impressão/PDF e cópia em texto |

As fórmulas ficam em `compute()`. Os fornecedores usam esse mesmo motor; não existe
um cálculo paralelo. Campos numéricos devem constar em `NUMF`, que define sua
precisão e permite interpretar corretamente ponto e vírgula.

## Testes

Os testes usam apenas Python 3, Node.js 22 ou superior e Chrome ou Edge instalado:

```powershell
node --test tests/app.test.cjs
python -B -m unittest discover -s tests -p test_build.py -v
python build.py
node tests/browser.mjs
```

O teste de navegador abre um perfil temporário isolado, percorre as nove abas nas
duas modalidades, valida persistência, fornecedores, documentos, PDFs, layout móvel
e a versão autossuficiente. No Windows, ele detecta os caminhos usuais. Para outro
local, defina `$env:EPIC_BROWSER = "C:\caminho\chrome.exe"`.

`tests/baseline.json` registra resultados e hashes do código originalmente recebido.
Os testes comparam seis cenários, as fórmulas, os valores padrão, o CSS e as contas
dos documentos. Isso verifica preservação do comportamento do software; não valida
as premissas fiscais.

Referência de paridade: com `cofinsImp: '10,25'`, `adicCofins: '0'` e
`tema69: '0'`, o motor produz custo líquido de R$ 571.482,05 e LAIR de
R$ 260,52 na importação direta, além de R$ 566.535,02 e R$ 5.207,55 em
conta e ordem. Com os valores padrão, produz R$ 574.125,40 e R$ 55,73.

## Responsabilidade

Esta é uma ferramenta de apoio à decisão. Os resultados dependem dos parâmetros
informados e das premissas descritas na aba Fontes. Ela não substitui apuração fiscal
ou parecer contábil.
