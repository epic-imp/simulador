# Revisão técnica — 23/09/2026

## Estado atual

O projeto é uma aplicação web estática. `index.html` carrega os arquivos locais,
`js/app.js` lê o `localStorage`, monta o estado, chama `compute(p)` e renderiza uma
das nove abas. Os três fornecedores usam o mesmo motor. A proposta mantém versões
do cliente e interna, impressão/PDF, cópia em texto, numeração e histórico.

Não há backend obrigatório, chamadas de rede, credenciais, configuração de
infraestrutura ou dependências de terceiros em execução. O build gera um único HTML
com CSS, JavaScript e imagens embutidos.

## Correções e organização já realizadas

- Fontes organizados em `css/`, `js/` e `img/`, nos caminhos esperados pelo HTML.
- Logos originais recuperadas das versões entregues, sem alteração visual.
- Cópias geradas antigas removidas após comparação; distribuição concentrada em
  `dist/`.
- Inicialização e validação do histórico corrigidas sem mudar seus formatos.
- Foco e seleção preservados durante a atualização do editor de fornecedores.
- Build passou a validar referências e falhar antes de gerar uma saída incompleta.
- Persistência limitada aos parâmetros, proposta, fornecedores, numeração e histórico
  no navegador.
- Integrações remotas, sua interface e sua configuração foram retiradas por completo.
- Documentação e testes atualizados para o funcionamento exclusivamente estático.

## Validação

- Regressão integral dos resultados em seis cenários do motor original.
- Comparação das fórmulas, valores padrão, CSS e contas dos documentos com a base
  recebida.
- Testes de persistência, valores iniciais e armazenamento indisponível.
- Testes do build, referências locais, imagens embutidas e falhas por ativo ausente.
- Teste no Chrome das nove abas nas duas modalidades, fornecedores, reabertura dos
  dados, texto para cópia, fluxo de impressão, dois PDFs, layout móvel e abertura
  direta do HTML de produção.
- Verificação estática de ausência de APIs e endereços de rede no código da aplicação.

## Pontos preservados que precisam de decisão

1. **Totais da trading no demonstrativo.** Em conta e ordem, com taxa paga pela
   empresa, `docHTML()` acrescenta a taxa em alguns totais, enquanto outros totais
   de desembolso não a incluem. `copyDoc()` também pode divergir do HTML. É preciso
   confirmar se essa taxa deve ser acrescentada ao preço apresentado ao cliente,
   pois ela já integra o custo no motor. A regra permanece inalterada.
2. **Numeração e emissão.** O sequencial é reservado ao abrir ou criar uma proposta,
   e a emissão é registrada antes do diálogo de impressão. Cancelar o diálogo ainda
   deixa o registro no histórico. O comportamento original foi mantido.
3. **Arquivos de dados.** Não existe importação ou exportação local de JSON, CSV ou
   planilhas. Parâmetros, proposta, fornecedores, numeração e histórico ficam no
   `localStorage` da origem atual.
4. **Premissas tributárias.** Fórmulas, alíquotas, regras, textos fiscais e cálculos
   dos documentos foram mantidos. Esta revisão verifica o software e não valida a
   legislação. As limitações da aba Fontes continuam aplicáveis.
5. **Origem do armazenamento.** Mudar domínio, porta ou alternar entre `file://` e
   HTTP não transfere os dados existentes do navegador.

Consulte [LEIA-ME.md](LEIA-ME.md) para executar, testar e publicar a aplicação.
