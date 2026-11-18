# Filtros por conta em Receitas vs Despesas e Money Map

**Objetivo.** Permitir comparar a movimentação de uma ou várias contas específicas, com seleção compartilhada entre os dois relatórios e propagada ao detalhamento.

## Comportamento e regras

- Usar controles de filtros da v0.19.0 para status e contas, preservando o layout configurável dos relatórios. A lista de contas é ordenada por nome de exibição e usa o rótulo de conta da aplicação para distinguir contas homônimas (por exemplo, pelo identificador final mascarado quando disponível). A referência solicita também contas encerradas. Quando há uma coleção ativa, oferecer apenas as contas pertencentes a ela. Sem opções, indicar lista vazia.
- Ao abrir, o painel restaura os valores aplicados. Alterações e **Limpar** afetam somente o rascunho. **Aplicar** confirma de uma vez. **Limpar**, seguido de **Aplicar**, remove contas explícitas e volta aos dois status. Fechar sem aplicar ou trocar de aba abandona a edição. Exibir indicador por dimensão ativa (contas e status) e descrição acessível com status único e/ou quantidade de contas escolhidas.
- Persistir os identificadores na URL da página para recarregar ou compartilhar o recorte. A referência usa `account_id` com lista separada por vírgula e preserva parâmetros não relacionados. A seleção permanece ao trocar de aba. Os filtros locais dos dois relatórios não são aplicados aos demais relatórios.
- Contas efetivas = seleção explícita intersectada com as contas da coleção ativa. Sem seleção explícita, usar o escopo da coleção ou todo o espaço se não houver coleção. Sem coleção, usar a seleção explícita integralmente. Uma interseção vazia ou uma coleção só de carteiras representa ausência de contas. Exibir um estado vazio nesses casos, sem recuperar dados de um escopo mais amplo nem reaproveitar valores de uma seleção anterior. O contrato admite desativar a consulta ou consultar um escopo explicitamente vazio que o servidor respeite. Ausência de filtro e escopo vazio têm significados distintos.
- Usar o mesmo escopo efetivo para números, gráficos, diálogo de transações e seu link. Reconsultar ao alterar as contas efetivas, o status ou o período. Aplicar autorização de espaço aos IDs recebidos. A consulta histórica depende dos filtros por conta já existentes no servidor. Quando algum escopo explícito de contas chega ao servidor, o relatório usa movimentação integral das contas e deixa de aplicar os ajustes de rateios de grupo. Veja [Transações pendentes](01-transacoes-pendentes.md).

## Critérios de aceite

- Duas contas “Corrente” com finais fictícios 1234 e 5678 são distinguíveis. Selecionar a segunda e status Pendente, fechar sem aplicar e reabrir mantém a seleção aplicada anterior. Aplicar depois de editar limita ambos os relatórios à segunda conta e aos pendentes. Recarregar a URL mantém a seleção.
- Coleção com A e B, seleção B e C: relatório, diálogo e link usam somente B. Seleção C: estado vazio, sem valores anteriores e sem consulta fora do escopo vazio. Limpar e aplicar: ambos os status, escopo A e B. Trocar para Patrimônio ou Fluxo de Caixa: vale o escopo nativo da coleção.
- Em BRL, sem projeções, débito próprio de 100 em A com parcela de terceiro de 40 e débito próprio de 20 em B. Sem filtro, despesa de 80. Filtrando apenas A, despesa de 100 antes de qualquer regra nova de rateio da versão de destino.

## Limite conhecido

A referência divide a URL e remove entradas vazias, mas não normaliza IDs inválidos, repetidos ou extintos. A descrição acessível conta IDs selecionados, inclusive os que a coleção excluiu. O estado vazio é obrigatório na migração. A mensagem, a normalização da URL e a descrição de contas selecionadas versus efetivas ainda precisam de validação.

**Referências históricas.** `96bf07aa` e `e45a1232` para nome de conta no diálogo. Na branch atual, os relatórios recebem o escopo da coleção ativa, e o servidor já aceita recorte por conta. O painel local e a combinação de escopos estão ausentes.
