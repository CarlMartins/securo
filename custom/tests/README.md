# Cobertura e execução

## Resultado por versão

| Grupo executado | `custom/v0.16.6` em `47e32251` | `custom/v0.19.0` em `0a6ac2d8` |
| --- | --- | --- |
| Suítes existentes de relatórios no backend | 206 passaram, 12 PostgreSQL pulados | 246 passaram, 12 PostgreSQL pulados |
| Suítes existentes de relatórios no frontend | 89 passaram | 83 passaram |
| [Contrato de API](test_custom_reports_api.py) | 13 passaram | 3 passaram, 10 falharam |
| [Interseção de contas na interface](custom-report-scope.test.tsx) | 4 passaram | 4 falharam |

No checkout atual, passaram os controles de período histórico com lançados, filtro de conta no servidor e rejeição de data futura em Patrimônio. As dez falhas do contrato correspondem a status pendente/combinado sem efeito (quatro), valores inválidos de status ignorados (quatro) e fim futuro rejeitado (dois). As quatro falhas de interface mostram que a consulta usa a coleção inteira onde deveria usar a interseção ou ficar desativada. Os testes novos mantêm as asserções e retornam falha nessas condições. A [triagem individual](../compatibilidade-v0.19.0.md#classificação-das-14-falhas) identifica a causa de cada falha e as limitações de portabilidade.

Os testes rodaram em cópias de `git archive` com ambiente limpo e dependências locais já instaladas (Python 3.14.8, pytest 9.1.1, Node 25.2.1 e Vitest 4.1.8). O frontend usou `NODE_OPTIONS=--no-experimental-webstorage` para evitar conflito entre o Web Storage do Node 25 e o jsdom. Neste sandbox, a conexão SQLite assíncrona não acordava o event loop do Python, então um executor temporário agendou despertares periódicos para a execução do pytest. O agendador não faz parte da aplicação ou da suíte entregue. O sandbox também recusou a criação do socket Unix de um PostgreSQL descartável. Sem `POSTGRES_TEST_URL`, as suítes pularam os 12 testes nativos de PostgreSQL em cada versão. SQLite simula a função de formatação de data com a fixture existente do projeto.

## Inventário dos testes existentes

| Escopo | Cobertura na referência histórica | Cobertura relevante na branch atual |
| --- | --- | --- |
| Serviço e API | `backend/tests/test_report_service.py` verifica validação de status, datas explícitas, limite de 10 anos e limite do calendário. `test_report_service_coverage.py` verifica totais, exclusões, equivalentes de provedor elegíveis e inelegíveis, reclassificação para investimento, parcela recebida, projeção e recorte até hoje. | Os mesmos módulos têm regressão de API, recortes históricos, fuso, cálculos, linhas de categoria e projeções. Foram acrescentados testes nativos de outros relatórios. O contrato novo confirma a falta dos modos de status e de fim futuro no relatório histórico. |
| PostgreSQL | `backend/tests/test_reports_postgres.py` tem contrato de agregação, filtros de exclusão e intervalo de dados. | O módulo também existe e foi coletado. Os resultados das execuções acima se limitam a SQLite e testes sem banco dedicado. |
| Datas e chamada de relatório | `frontend/src/lib/report-period.test.ts` e `api-reports.test.ts` cobrem deslocamento, fim de mês e serialização de datas/status. `pages/reports.test.tsx` cobre período confirmado e navegado, fim futuro, troca para Patrimônio, ordem inicial, filtros, histórico da URL e contas homônimas. | `report-period.test.ts` e `pages/reports.test.tsx` verificam períodos, recortes, estados de erro, Fluxo de Caixa e layout de relatórios. O arquivo `api-reports.test.ts` do fork antigo está ausente. |
| Detalhamento e conta | `frontend/src/lib/report-drilldown.test.ts` valida limites de dia/semana/mês/ano, recorte futuro e filtros. `pages/reports-drilldown.test.tsx` valida barras, cartões, categoria real “Outros”, Money Map por Enter, investimento, agrupamento, paginação, total, nomes de conta e link. A API da interface é simulada. | `frontend/src/components/reports/IncomeExpenseStatement.test.tsx` testa o detalhe tabular mensal nativo, inclusive parcela compartilhada e conta explícita. Os testes do diálogo e dos gráficos do fork não estão nessa árvore. A nova suíte de interseção usa respostas simuladas de API. |

Os números são contagens de casos dos arquivos executados, incluindo controles e relatórios vizinhos. Para critérios específicos e lacunas ponta a ponta, consulte a [matriz de regressão](cenarios.md).

## Reproduzir

Use um checkout ou snapshot descartável com as dependências de teste da versão escolhida. Prepare-o sem arquivos `.env` de implantação, volumes da aplicação ou credenciais. A suíte de API usa as fixtures do Securo e SQLite em memória. Para o grupo PostgreSQL, siga o [procedimento local isolado](postgresql-local.md).

Os testes novos ficam junto às especificações e são copiados para o caminho reconhecido pelos executores da versão de destino. `testes_custom` deve apontar para esta pasta `custom/tests`. Execute a partir da raiz do checkout descartável.

```sh
cp "$testes_custom/test_custom_reports_api.py" backend/tests/
cp "$testes_custom/custom-report-scope.test.tsx" frontend/src/pages/

(cd backend && .venv/bin/python -m pytest -q tests/test_custom_reports_api.py)
(cd frontend && npm test -- src/pages/custom-report-scope.test.tsx)
```

Para repetir as suítes existentes do backend em qualquer uma das versões:

```sh
(cd backend && .venv/bin/python -m pytest -q tests/test_report_service.py \
  tests/test_report_service_coverage.py tests/test_reports_postgres.py)
```

No frontend, executar `npm test --` em `frontend/` com os arquivos comuns `src/pages/reports.test.tsx` e `src/lib/report-period.test.ts`. No fork antigo, incluir `src/pages/reports-drilldown.test.tsx`, `src/lib/report-drilldown.test.ts` e `src/lib/api-reports.test.ts`. Na branch atual, incluir `src/components/reports/IncomeExpenseStatement.test.tsx`.

Os testes de contrato dependem dos pontos de entrada atuais e de fixtures existentes. Em uma arquitetura diferente, adapte o transporte e a preparação de dados. Preserve as entradas e resultados definidos na matriz.

## Painel com período e contas

A suíte portátil [test_dashboard_period_api.py](test_dashboard_period_api.py) executa contra a API real com as fixtures do backend. Na raiz da versão alvo, execute:

```sh
(cd backend && PYTHONPATH=. .venv/bin/python -B -m pytest -c pyproject.toml -p tests.conftest ../custom/tests/test_dashboard_period_api.py)
(cd backend && .venv/bin/python -m pytest tests/test_dashboard_api.py tests/test_dashboard_service.py tests/test_transaction_calendar_service.py tests/test_report_service.py)
(cd frontend && npm test -- src/pages/dashboard.test.tsx src/components/dashboard-widgets.test.tsx src/pages/reports.test.tsx src/pages/report-drilldown.test.tsx src/components/ui/date-range-picker.test.tsx src/lib/calendar-activity.test.ts)
```

Os casos de UI adicionais ficam na regressão da página real. Veja [aceite e evidência visual](aceite-dashboard.md) para testar a mesma experiência em outra versão.
