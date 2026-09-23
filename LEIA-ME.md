# Código-fonte — Simulador de Importação EPIC

Projeto sem framework e sem dependências de terceiros. HTML, CSS e JavaScript puros, versionáveis em
Git. O `build.py` junta tudo num arquivo só quando chega a hora de publicar.

## Estrutura

```
epic-simulador/
├── index.html                 estrutura da página de desenvolvimento
├── css/styles.css             estilos da interface e da impressão
├── js/app.js                  estado, cálculo, telas e eventos
├── img/logo-epic.png          logo escura, usada nas abas e no demonstrativo
├── img/logo-epic-branca.png   logo clara, usada na barra azul do topo
├── build.py                   gera o arquivo único
├── tests/                     testes de regressão, build e navegador
├── REVISAO.md                 diagnóstico, correções e pendências
├── LEIA-ME.md                 instruções deste projeto
├── .gitignore                 ignora caches locais
└── dist/
    ├── index.html             resultado do build — é isto que vai para a AWS
    └── epic-simulador.html    cópia idêntica, para abrir com dois cliques
```

## Qual arquivo abrir

Existem dois `index.html` e eles servem a coisas diferentes.

| Arquivo | Quando usar |
|---|---|
| `dist/index.html` | Funciona sozinho, com tudo embutido. É o arquivo para publicar. |
| `dist/epic-simulador.html` | O mesmo arquivo com nome próprio, para abrir com dois cliques. |
| `index.html` (raiz) | Arquivo de desenvolvimento. Precisa das pastas `css/`, `js/` e `img/` ao lado. |

Se abrir o `index.html` da raiz sozinho, aparece uma mensagem explicando o que faltou.
Qualquer erro de execução também vira mensagem na tela — a página nunca fica em branco
sem explicação.

Abrir `index.html` direto do disco já funciona. Mas alguns navegadores bloqueiam
`localStorage` em `file://`, então os parâmetros podem não ficar salvos. Para desenvolver,
suba um servidor local:

```bash
python -m http.server 8000 --bind 127.0.0.1
# abra em http://127.0.0.1:8000
```

No VS Code, abra esta pasta em **Arquivo → Abrir Pasta**, abra **Terminal → Novo Terminal**
e execute o comando acima. Use `Ctrl+C` no terminal para encerrar. No Windows, `py` pode
substituir `python`; em outros sistemas, pode ser necessário usar `python3`.
Não é necessário instalar extensão, npm ou servidor de aplicação.

Use sempre o mesmo endereço e porta para manter os dados disponíveis. `localhost`,
`127.0.0.1`, outras portas, outro domínio e `file://` têm armazenamentos diferentes.
Mudar a estrutura dos arquivos não transfere dados de uma origem para outra. Se usava
um HTML antigo direto do disco ou uma versão publicada, mantenha essa cópia/origem
até conferir a transferência dos dados. As chaves mantidas são `epic_params`,
`epic_prop`, `epic_forn`, `epic_sim_nuvem` e `epic_num`.

Edite `index.html`, `css/styles.css` e `js/app.js`. Não edite `dist/`: cada build
sobrescreve as duas cópias com o mesmo conteúdo. O projeto recebido não continha
repositório Git inicializado.

Para publicar:

```bash
python build.py
# dist/index.html e dist/epic-simulador.html — CSS, JavaScript e logos embutidos
```

## Mapa do app.js

O arquivo segue esta ordem, e cada bloco tem um comentário de cabeçalho:

| Bloco | O que faz |
|---|---|
| `DEFAULTS`, `PROP_DEF`, `NUVEM_DEF`, `NUMF`, `S` | padrões e precisão definidos antes de carregar o estado |
| `load`, `save` | persistência no `localStorage` do navegador |
| `num`, `brl`, `money`, `perc` | conversão e formatação em pt-BR |
| `compute(p)` | **o motor** — recebe os parâmetros, devolve todos os resultados |
| `sec`, `row`, `fld`, `head` | geradores de HTML reaproveitados pelas telas |
| `viewResumo` … `viewFontes` | uma função por aba, cada uma devolve HTML |
| `FORN_KEYS`, `paramsForn` | variáveis próprias de cada fornecedor e a fusão com os parâmetros de venda |
| `docHTML` | monta o demonstrativo, nas versões cliente e interna |
| `render`, `softRefresh` | desenham a tela; o soft refresh atualiza só os KPIs enquanto se digita |
| eventos | delegação em `document`, sem listener por elemento |
| `printDoc`, `copyDoc` | impressão da própria página e cópia em texto |

### Onde mexer

**Alterar um cálculo** → só `compute()`. Ela devolve um objeto com os totais da importação
e dois blocos, `direta` e `co`, cada um com custo, resultado da venda e indicadores. Nada
de alíquota fica fixo no código: tudo vem dos campos da aba Parâmetros.

**Adicionar um campo** → inclua a chave em `DEFAULTS`, chame `fldSuf()` ou `fld()` dentro
de `viewParametros()` e use `num(p.chave)` em `compute()`. O `load()` preenche campos novos
com o padrão, então quem já tem dados salvos não quebra.

### A aba Fornecedores

Cada fornecedor guarda sua própria cópia das variáveis listadas em `FORN_KEYS` — câmbio,
carga, FOB, fretes, tributos de nacionalização e despesas locais. Os parâmetros de venda
não entram ali: preço, alíquotas de saída, comissão e IRPJ são os mesmos nos três, porque
o produto entregue ao cliente é o mesmo.

`paramsForn(id)` funde os dois conjuntos e devolve um objeto completo para o `compute()`.
Ou seja, o comparativo usa exatamente o mesmo motor das outras abas, sem cálculo paralelo.

Para acrescentar uma variável ao comparativo, inclua a chave em `FORN_KEYS` e um `ffld()`
no editor. Se for numérica, declare também em `NUMF`.

**Criar uma aba** → acrescente o par em `TABS`, escreva a função `viewAlgo(c)` e registre-a
no objeto de rotas dentro de `render()`.

**Trocar a logo** → substitua os dois PNGs em `img/`, mantendo os nomes, e rode o build. A
versão branca é a mesma arte com os pixels escuros clareados, para contrastar com o azul do
cabeçalho.

## Como os campos numéricos funcionam

Todo campo numérico está declarado em `NUMF`, que diz quantas casas decimais ele aceita.
`qtdPorVolume` e `nVolumes` têm zero, `preco` e `fobUnit` têm quatro, alíquotas e valores em
reais têm duas. Essa declaração é o que resolve a ambiguidade do separador brasileiro:

- Em campo de zero casas, ponto e vírgula só podem ser separador de milhar. `1.309` é 1309.
- Em campo com casas decimais, um separador que aparece uma vez só é o decimal (`0.4` é 0,4;
  `3,525` é 3,525) e um que se repete é milhar (`1.234.567` é 1234567). Havendo os dois, o
  último manda: `1.234,56` é 1234,56.

O estado guarda a forma canônica, com ponto decimal e sem separador de milhar. O campo exibe
a forma brasileira com separador de milhar. Ao sair do campo, o valor é arredondado para a
precisão declarada e reexibido, então o que está na tela é exatamente o que entra na conta.
`fmtNum` força as casas decimais quando o número sairia só com ponto de milhar, senão
`1650` viraria `1.650` e a releitura seguinte devolveria 1,65.

Se acrescentar um campo numérico, declare-o em `NUMF`. Sem isso ele cai no padrão de duas
casas.

## Testar o motor fora do navegador

Os testes usam somente bibliotecas padrão. Python 3 executa o build e seus testes;
Node.js 22 ou superior executa os testes JavaScript e a automação de navegador.
Node não é necessário para usar o simulador.

```powershell
node --test tests/app.test.cjs
python -B -m unittest discover -s tests -p test_build.py -v
python build.py
node tests/browser.mjs
```

O teste de navegador usa Chrome ou Edge instalado, abre um perfil temporário isolado
e não utiliza seus dados pessoais. No Windows, detecta os caminhos usuais; para outro
local, defina `$env:EPIC_BROWSER = "C:\caminho\chrome.exe"`. Os PDFs e a captura de tela
ficam na pasta temporária informada ao terminar. O teste intercepta a cópia e a chamada
à caixa de impressão, e renderiza PDFs pelo próprio Chrome. A interação manual com a
impressora e a área de transferência não é automatizada.

`tests/baseline.json` registra resultados e hashes do código original recebido. Os testes
comparam seis cenários, as fórmulas, os valores padrão, o CSS e as contas dos documentos.
Isso verifica preservação de comportamento, não validade fiscal das premissas.

Referência de paridade: com `cofinsImp: '10,25'`, `adicCofins: '0'` e `tema69: '0'`, o motor
reproduz a planilha original — custo líquido de R$ 571.482,05 e LAIR de R$ 260,52 na
importação direta, R$ 566.535,02 e R$ 5.207,55 em conta e ordem. Com os valores padrão
corrigidos, R$ 574.125,40 e R$ 55,73.

## Backup automático na AWS

A interface de backup já existe, mas **os arquivos de infraestrutura AWS não foram
entregues neste projeto**. Não há pasta `aws/`, Lambda ou template CloudFormation.
O simulador local funciona sem essa integração; o backup automático vem desligado.

Para usar um endpoint existente, configure a aba **Parâmetros**, seção 7. O contrato
esperado pelo código é:

- `POST /backup`: recebe `{ formato: "epic-simulador-1", empresa, geradoEm, resumo, dados }`;
  `dados` contém `p`, `prop` e `forn`. A resposta pode informar `arquivo`.
- `GET /backups?empresa=...`: retorna `{ itens: [{ arquivo, data, tamanho }] }`.
- `GET /backup?arquivo=...`: retorna o pacote, ou diretamente `{ p, prop, forn }`.
- As chamadas usam o cabeçalho `X-Epic-Token`. O serviço precisa permitir a origem local
  em sua configuração de CORS para os testes pelo navegador.

O automático aguarda a digitação parar, respeita o intervalo mínimo e mantém o envio
pendente até esse intervalo terminar. Dados idênticos não são reenviados. Desligar o
automático cancela o envio agendado. URL e token não entram no pacote.

O histórico e o sequencial de propostas (`epic_num`) continuam exclusivos do navegador;
não fazem parte do pacote original de backup. Não há importação/exportação local de
JSON, CSV ou planilhas. As saídas existentes são PDF e texto copiado; a restauração é
feita pela integração AWS. O teste de integração usa respostas simuladas, sem enviar
dados a um serviço real.

## Publicar na AWS

```bash
python build.py

aws s3 cp dist/index.html s3://SEU-BUCKET/index.html \
  --content-type "text/html; charset=utf-8" \
  --cache-control "public, max-age=300"

aws cloudfront create-invalidation --distribution-id SEU_ID --paths "/index.html"
```

Envie só o `dist/index.html`. Não suba a pasta de código-fonte: o `index.html` da raiz
sobrescreveria o arquivo bom e o site sairia em branco.

Três erros que fazem a página não abrir depois de publicada:

- **Content-Type errado.** Sem o `--content-type`, o S3 marca como
  `application/octet-stream` e o navegador baixa o arquivo em vez de exibir. É a causa mais
  comum.
- **Default root object vazio.** No CloudFront, o campo *Default root object* precisa ser
  `index.html`, senão a raiz do domínio devolve erro.
- **Cache antigo.** Depois de atualizar, invalide `/index.html`, ou o CloudFront continua
  servindo a versão anterior por até o tempo do `max-age`.

Bucket privado, servido pelo CloudFront com Origin Access Control. Como a versão interna do
demonstrativo mostra custo e margem, proteja a URL antes de divulgá-la — WAF por faixa de IP
ou autenticação básica em Lambda@Edge resolvem sem escrever backend.

Alternativa mais rápida: zipar a pasta `dist` e arrastar no Amplify Hosting, em *Deploy
without Git provider*.

## Licença e responsabilidade

Ferramenta de apoio à decisão. Os resultados dependem inteiramente dos parâmetros
informados e das premissas listadas na aba Fontes. Não substitui apuração fiscal nem
parecer contábil.
