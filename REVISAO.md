# Revisão técnica — 23/09/2026

## Diagnóstico antes das alterações

Foram lidos os sete arquivos entregues. Os dois HTMLs completos foram comparados:
eram idênticos, e seu HTML, CSS e JavaScript correspondiam aos arquivos separados
após desfazer o empacotamento das imagens. Não foram encontrados pacotes npm,
frameworks, backend, configuração Git, instruções AGENTS.md ou dependências externas
necessárias à interface local.

O fluxo é: `index.html` carrega o CSS e o JavaScript; o JavaScript lê o `localStorage`,
monta o estado `S`, chama `compute(p)` e renderiza uma das nove abas. Os eventos
atualizam o estado, recalculam indicadores e salvam os dados. Os três fornecedores
usam o mesmo motor. A proposta tem versão do cliente, versão interna, impressão/PDF,
cópia em texto, numeração e histórico. A integração AWS é opcional.

Problemas confirmados:

- `app.js` e `styles.css` estavam na raiz, mas HTML e build esperavam `js/` e `css/`.
- Os PNGs não estavam presentes; as logos existiam embutidas nos HTMLs completos.
- `mnt/user-data/outputs/epic-simulador-src/dist/index.html` era uma cópia gerada,
  sem referências no sistema, dentro de uma estrutura do ambiente anterior.
- `S` era criado antes de `NUVEM_DEF` e `NUMF`: a configuração da nuvem carregava
  vazia e era sobrescrita no primeiro render; a normalização inicial era ignorada.
- O temporizador de backup descartava uma alteração quando o intervalo mínimo
  ainda não havia passado, e desligar o automático não cancelava o temporizador.
- A atualização de fornecedores substituía o campo em edição e perdia o foco.
- Um histórico salvo com tipo incorreto podia interromper a inicialização.
- O build dependia de substituições silenciosas e a documentação continha exemplo
  de teste incompleto, tamanhos antigos e referências a infraestrutura AWS ausente.

## Alterações realizadas

- Fontes movidos para os caminhos já previstos, sem dividir o aplicativo ou trocar
  sua arquitetura. O `index.html` e o conteúdo do CSS foram preservados.
- Logos originais extraídas das data URIs, sem recriação ou edição visual.
- Carregamento do estado movido para depois das definições necessárias. Mantidas
  todas as chaves de armazenamento e os formatos do backup.
- Backup pendente reagendado para respeitar o intervalo; desativação cancela o
  agendamento. Envios manuais também passam a contar para esse intervalo.
- Foco, texto em edição e seleção preservados ao atualizar fornecedores.
- Histórico com estrutura inválida tratado sem bloquear a aplicação, e mensagem
  de erro escapada antes de inserção no HTML.
- Removidos apenas trechos sem uso: `FORN_DEF`, `NUM_DEF`, `cssText`, `cssLink`, um
  listener `change` sem ação e uma expressão que sempre retornava texto vazio.
- Build valida as referências esperadas e informa falhas antes de gerar a saída.
- Gerados `dist/index.html` e `dist/epic-simulador.html`, idênticos e autossuficientes.
  As duas cópias antigas fora de `dist/` foram removidas após confirmar a equivalência
  dos fontes e testar a nova distribuição. A cadeia de pastas `mnt/` ficou vazia e
  foi removida. As cópias em `dist/` são intencionais e geradas juntas pelo build.
- Documentação corrigida e testes sem dependências adicionados.

## Validação executada

- Sete testes Node: paridade integral do resultado de seis cenários do código
  original; hashes das fórmulas, padrões, CSS e contas dos documentos; persistência;
  carregamento sem armazenamento; temporizadores; backup, listagem, restauração e
  tratamento de erro HTTP com respostas simuladas.
- Três testes Python: referências e conteúdo gerado, imagens idênticas aos PNGs,
  build executado de outro diretório e falhas por imagem ou referência ausente.
- Chrome com perfil temporário: nove abas nas duas modalidades para o fonte e os
  dois HTMLs gerados; imagens e CSS; edição e reabertura; fornecedores; fluxo da
  proposta, histórico, texto para cópia e geração de dois PDFs pelo Chrome.
- Verificação de layout móvel e abertura autônoma por `file://`. Nenhum erro de
  JavaScript ou recurso local ausente no teste.
- O teste intercepta a área de transferência e a chamada ao diálogo de impressão.
  Os PDFs são renderizados pelo Chrome; impressão física, escolha manual de destino
  e acesso real à área de transferência ainda dependem da verificação manual.

## Pontos preservados que precisam de decisão

1. **Totais da trading no demonstrativo.** Em conta e ordem, com taxa paga pela
   empresa, `docHTML()` define `totalOperacao = totalCliente + servTrading`, mas
   alguns totais de desembolso usam `totalCliente + porForaTotal`. Já `copyDoc()`
   inclui também `servT`. Exemplo: taxa de R$ 1.000 e frete do cliente de R$ 500
   produzem diferença de R$ 1.000 entre o desembolso do HTML e o texto copiado.
   Também é necessário confirmar se a taxa paga pela empresa deve ser acrescentada
   ao preço apresentado ao cliente, pois já integra o custo no motor. Nada disso
   foi alterado: depende da regra comercial pretendida.
2. **Numeração e emissão.** O sequencial é reservado ao abrir/criar proposta, e a
   emissão é registrada antes do diálogo de impressão; cancelar o diálogo ainda
   deixa o registro no histórico. O texto da interface sugere que só PDFs emitidos
   consomem números. Comportamento original mantido para evitar mudar essa regra.
3. **Alcance do backup.** O pacote original não inclui `epic_num` (histórico e
   sequencial). Ele restaura parâmetros, proposta e fornecedores. Não existe fluxo
   de importação/exportação local de arquivos de dados.
4. **AWS.** A infraestrutura citada no documento original não foi entregue. O
   contrato do frontend foi testado com respostas simuladas; endpoint, autenticação,
   CORS e armazenamento real precisam ser verificados quando estiverem disponíveis.
5. **Premissas tributárias.** Fórmulas, alíquotas, regras, textos fiscais e cálculos
   dos documentos foram mantidos. Esta revisão verifica o software e não valida a
   legislação. As limitações já descritas na aba Fontes continuam aplicáveis.
6. **Dados existentes.** As chaves do `localStorage` foram preservadas, mas mudar
   domínio, porta ou de `file://` para HTTP não transfere o armazenamento. Configuração
   da nuvem que já tenha sido apagada pela versão antiga precisa ser informada
   novamente; a correção impede novas perdas, mas não recupera valores apagados.

Consulte [LEIA-ME.md](LEIA-ME.md) para executar no VS Code, testar e gerar a distribuição.
