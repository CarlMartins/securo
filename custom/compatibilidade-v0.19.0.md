# Compatibilidade das personalizações com a v0.19.0

Comparação entre o fork histórico `47e32251` e o checkout `0a6ac2d8`. A tag oficial `v0.19.0` e o checkout têm a mesma árvore de código da aplicação e de testes. As diferenças locais entre eles são de CI e implantação. A triagem foi conferida contra os pontos de entrada e a saída original de cada caso. Reexecutar os mesmos 17 testes na v0.19.0 reproduziu três controles aprovados e as mesmas 14 falhas. A análise prepara a migração e as novas decisões ainda não têm validação ponta a ponta.

## Matriz de compatibilidade

| Funcionalidade | O que já funciona na v0.19.0 | O que precisa ser implementado | Ponto ainda em revisão |
| --- | --- | --- | --- |
| [Transações pendentes](features/01-transacoes-pendentes.md) | Lançados nos valores observados, projeções de presets, exclusões de resultado, linhas de categoria e apuração por data de referência. A API sem status mantém o contrato nativo. | Modo explícito de status nos dois relatórios, validação, deduplicação de equivalentes elegíveis e prevenção de duplicatas entre observado e projetado. A apuração nova deve usar decimais e taxa verificável. | Tratamento de conversão ausente, política de resíduos e vínculos verificáveis entre fontes de projeção. |
| [Detalhamento em Receitas vs Despesas](features/02-detalhamento-receitas-despesas.md) | Um relatório tabular mensal separado tem diálogo nativo, escopo por conta e detalhe de valores realizados. As séries de Receitas vs Despesas já são exibidas. | Acionar barras e categorias e recuperar as contribuições exatas da seleção, inclusive linhas da transação, parcelas, exclusões, data de referência e valor em moeda do relatório. Manter o mesmo contexto na navegação. | Como apresentar projeções sem transação e como preservar o contexto contábil ao navegar para Transações. |
| [Detalhamento no Money Map](features/03-detalhamento-money-map.md) | Mapa, agrupamento visual por valor, escopo nativo de coleção e composição compartilhada com Receitas vs Despesas. | Ações acessíveis nos nós de categoria, seleção das categorias agrupadas e reutilização do detalhe reconciliado. | Apresentação das parcelas projetadas, em comum com Receitas vs Despesas. A ordem configurável já está decidida. |
| [Períodos personalizados](features/04-periodos-personalizados.md) | Intervalo histórico, validação de pontas e amplitude, calendário por fuso, data manual de referência e exclusão de projeções para datas explícitas. | Permitir pontas futuras somente nos dois relatórios, validar antes do corte, aplicar a mesma janela efetiva ao agregado e ao detalhe e retornar estado vazio em recorte totalmente futuro. | Nenhuma decisão funcional em aberto para o corte. Falta testar a integração entre fuso, ajuste de data e detalhe. |
| [Filtros por conta](features/05-filtros-por-conta.md) | API recorta por IDs de conta. Os relatórios respeitam a coleção ativa e a distinção nativa entre valor integral sob escopo de contas e rateio pessoal. | Seleção local persistida, interseção com a coleção e estado vazio sem alargamento. Usar o mesmo escopo no agregado, detalhe e navegação. | Tratamento de favoritos com IDs inválidos, extintos ou duplicados e comunicação da diferença entre contas selecionadas e efetivas. |

### Pontos de integração observados

- [Endpoint de Receitas vs Despesas](../backend/app/api/reports.py#L139) recebe conta e datas, e não declara `statuses`. [Serviço de relatório](../backend/app/services/report_service.py#L494) filtra os valores observados por `posted`. A API omissa é um controle a preservar. A UI de destino pode enviar explicitamente sua seleção padrão.
- [Apuração por data e linha de categoria](../backend/app/services/_query_filters.py#L77) resolve a data de referência antes da data da fatura e da base contábil. [Linhas de categoria](../backend/app/services/_query_filters.py#L132) têm valor próprio e identidade vinculada à transação. Um detalhe que filtra apenas a transação inteira não garante o valor da categoria.
- [Detalhe tabular mensal](../frontend/src/components/reports/IncomeExpenseStatement.tsx#L207) oferece uma referência de componentes e de interação. Sua seleção usa o mês, valores realizados e categorias do demonstrativo. Verificar a equivalência da base de apuração antes de reaproveitar seus dados para outro relatório.
- [Projeções nativas](../backend/app/services/report_service.py#L695) já combinam recorrências, transações projetáveis e saldo de faturas. Essa separação deve ser preservada. [Serviço de câmbio](../backend/app/services/fx_rate_service.py#L220) já distingue conversão sem taxa da leitura que admite fallback 1:1. O agregador também tem caminhos que usam valor de origem se faltar valor principal. Nenhum desses fallbacks é uma taxa válida para a apuração reconciliada entre moedas diferentes. Avaliar o impacto do novo cálculo no relatório compartilhado e preservar os outros consumidores nativos.

## Classificação das 14 falhas

A classificação abaixo aponta a causa principal de cada caso. Nos dois casos de datas, a categoria de comportamento oficial se refere à validação deliberada da API histórica oficial, que já existia antes da v0.19.0. O efeito precisa ser estendido para a migração. Nenhuma falha foi atribuída somente ao ambiente de testes ou ficou sem causa identificada.

| Caso | Esperado pela regressão | Observado na v0.19.0 | Classificação |
| --- | --- | --- | --- |
| API `test_actuals_follow_statuses_and_accounts[pending-A]` | Receita 0 e despesa 80 em A | A primeira divergência foi receita 100, de um lançamento. O endpoint ignora o status explícito. | Funcionalidade personalizada ausente |
| API `test_actuals_follow_statuses_and_accounts[both-AB]` | Despesa 110 em A+B, com equivalentes elegíveis consolidados | Despesa 75, somente o lançamento. | Funcionalidade personalizada ausente |
| API `test_actuals_follow_statuses_and_accounts[both-A]` | Despesa 90 em A com `pending,posted` | Despesa 75. A ordem dos status é irrelevante na v0.19.0 porque o parâmetro não é lido. | Funcionalidade personalizada ausente |
| API `test_actuals_follow_statuses_and_accounts[both-B]` | Despesa 20 em B, preservando pendência de outra conta com o mesmo ID externo | Despesa 0. A divergência ocorre antes de qualquer deduplicação. | Funcionalidade personalizada ausente |
| API `test_invalid_statuses_are_rejected[]` | 422 para valor vazio | 200. A API ignora o parâmetro. | Funcionalidade personalizada ausente |
| API `test_invalid_statuses_are_rejected[posted,posted]` | 422 para repetição | 200. A API ignora o parâmetro. | Funcionalidade personalizada ausente |
| API `test_invalid_statuses_are_rejected[pending, posted]` | 422 para espaço depois da vírgula | 200. A API ignora o parâmetro. | Funcionalidade personalizada ausente |
| API `test_invalid_statuses_are_rejected[unknown]` | 422 para status desconhecido | 200. A API ignora o parâmetro. | Funcionalidade personalizada ausente |
| API `test_future_custom_window_stops_at_workspace_today[overlaps-today]` | 200, receita 100, despesa 90 e corte em 12/09 | 422 na validação de fim futuro. Os valores e status do resultado não foram exercitados. | Mudança intencional da arquitetura ou comportamento oficial |
| API `test_future_custom_window_stops_at_workspace_today[future-only]` | 200 com totais zero e séries vazias | 422 na mesma validação, antes da apuração. | Mudança intencional da arquitetura ou comportamento oficial |
| Receitas vs Despesas, `requests the intersection…` | Coleção A+B e filtro B+C consultam B com status Pendente | Consulta A+B. A asserção de conta falha antes da asserção de status. | Funcionalidade personalizada ausente |
| Receitas vs Despesas, `does not fetch…` | Coleção A+B e filtro C resultam em escopo vazio. O teste exige zero chamadas. | Uma chamada com A+B. A consulta amplia o escopo esperado. | Funcionalidade personalizada ausente |
| Money Map, `requests the intersection…` | Coleção A+B e filtro B+C consultam B com status Pendente | Consulta A+B. A asserção de conta falha antes da asserção de status. | Funcionalidade personalizada ausente |
| Money Map, `does not fetch…` | Coleção A+B e filtro C resultam em escopo vazio. O teste exige zero chamadas. | Uma chamada com A+B. A consulta amplia o escopo esperado. | Funcionalidade personalizada ausente |

Os quatro casos de interface observam a [consulta compartilhada dos dois relatórios](../frontend/src/pages/reports.tsx#L443). As duas falhas de vazio comprovam alargamento nessa execução. A exigência de zero chamadas é mais restrita que a decisão funcional atual, que também admite uma consulta explicitamente vazia. Isso limita a portabilidade da asserção, mas não explica a chamada observada com A+B. As falhas de datas mantêm como controle a rejeição de fim futuro em Patrimônio.

## Portabilidade e cobertura dos testes

| Grupo | O que está desacoplado | Acoplamentos e cobertura a acrescentar na implementação |
| --- | --- | --- |
| Contrato de API existente | Exercita entrada HTTP, autorização e valores dos agregados com persistência. Não chama diretamente o serviço antigo. | A rota, os nomes de chaves e 422 são parte do contrato escolhido da API. O arranjo usa modelos ORM, relógio interno e uma fixture particular de SQLite. Se o transporte mudar, adaptar a preparação e a chamada, preservando os cenários. A tolerância de `pytest.approx` com inteiros de BRL não demonstra igualdade decimal de centavos, resíduo ou FX sem taxa. |
| Escopo de contas na UI | A navegação se faz na página real e os testes usam a coleção e o estado da URL como entradas. | `mock.lastCall[2]` e `[5]` dependem da assinatura posicional antiga. Em v0.19.0 o índice 5 é data inicial. As asserções de conta falham primeiro, por isso não registram esse problema. `not.toHaveBeenCalled()` prende o vazio ao mecanismo antigo. Para a migração, observar URL ou requisição HTTP serializada e a interface de vazio com ausência de dados fora do escopo. Uma mudança de transporte não invalida o resultado financeiro esperado. |
| Detalhamento histórico | Os cenários de período, categoria, paginação, teclado e escopo continuam úteis. | Os testes históricos verificam a listagem geral simulada e alguns seletores do gráfico. Seu total assinado baseado em itens excluídos é evidência histórica. A nova aceitação deve conferir IDs e contribuições da apuração real, inclusive link, rateios, centavos, moeda, linhas de categoria e previsões. |
| PostgreSQL | Suíte nativa cobre API, agregação, exclusões e escopo real no PostgreSQL. | A suíte de API personalizada ainda usa SQLite mesmo com `POSTGRES_TEST_URL`. Planejar casos equivalentes em PostgreSQL para as novas agregações, inclusive deduplicação e arredondamento. [Procedimento local](tests/postgresql-local.md). |

As fontes dos 14 casos são [API](tests/test_custom_reports_api.py) e [interface](tests/custom-report-scope.test.tsx). Os testes executáveis permanecem como foram registrados, inclusive as falhas. Os novos critérios de aceitação estão na [matriz de cenários](tests/cenarios.md).

## Dependências e ordem de implementação proposta

1. **Períodos personalizados.** Isolar o recorte efetivo de datas para Receitas vs Despesas e Money Map. É pré-requisito para a deduplicação pela data de referência e para os dois detalhes. Cobrir fuso, pontas futuras e preservação de Patrimônio.
2. **Filtros por conta.** Resolver o escopo efetivo antes da apuração e distinguir ausência de filtro de zero contas. É pré-requisito para o modo pessoal ou integral, a seleção por status e os dois detalhes. A definição de datas e a de contas podem avançar em paralelo.
3. **Transações pendentes.** Consolidar contribuições com identidade, linhas de categoria, rateios, moeda e valores decimais sobre o recorte resolvido. Reconciliar presença no observado e na projeção, mantendo o padrão da API para clientes existentes. Essa base deve poder ser consultada pelos detalhes e constitui o primeiro ponto de verificação financeira em banco real.
4. **Detalhamento em Receitas vs Despesas.** Usar a mesma seleção de contribuições do gráfico e os componentes nativos. Validar as correspondências de valor, quantidade e identidade em barras, categorias e navegação.
5. **Detalhamento no Money Map.** Reaproveitar a seleção, apresentação e apuração validadas em Receitas vs Despesas. Acrescentar os nós acionáveis e as categorias agrupadas, incluindo os casos em que o valor mostrado contém projeções.

As decisões funcionais de correspondência exata, aritmética decimal, preservação de identidade e estado vazio estão fechadas. As [decisões restantes](tests/cenarios.md#decisões-restantes) delimitam as escolhas que ainda afetam valor, rastreabilidade ou apresentação.

## Reimplementação independente

A branch `reimplementacao/v0.19.0` implementa os contratos e mantém a integração com os componentes nativos. A [matriz de aceite da execução](testes-reimplementacao-v0.19.0.md) registra critérios, evidências, compatibilidade da API, comparação visual e comandos de reprodução. Os resultados e a classificação acima continuam sendo a linha de base do upstream.
