# Reimplementação das cinco customizações na v0.19.0

A branch `reimplementacao/v0.19.0` está no clone isolado `.worktrees/reimplementacao-v0.19.0`. A tag upstream é `f48bdf7`. O ponto de partida `42cac5b` acrescenta infraestrutura, especificações, testes e a skill à árvore upstream. A referência `v0.16.6-custom.6` (`47e3225`) foi consultada e executada para comparação visual. A árvore original `custom/v0.19.0` permanece limpa.

## Auditoria e baseline

| Requisito | Ponto de integração na v0.19.0 | Evidência inicial |
| --- | --- | --- |
| Status, moeda, rateio, deduplicação | `get_income_expenses_report`, data de referência e fontes nativas de projeção | A regressão versionada reproduziu dez falhas da API, com três controles aprovados. |
| Detalhamento e navegação | Gráficos em `pages/reports.tsx`, rota `/transactions`, `TransactionsFilterBar` e serviço nativo de listagem | O demonstrativo mensal tem detalhe próprio. O agregado gráfico precisava expor a seleção contábil usada para produzir cada valor. |
| Money Map | `CashflowSankey`, composição do mesmo relatório | A compactação de nove nós por grupo já existia. O grupo sintético precisava conservar a identidade das categorias ocultas para permitir seleção. |
| Datas explícitas | `DateRangePicker`, `periodWindow`, validação da API e relógio do espaço | O seletor nativo de relatórios recusava fim futuro. Patrimônio conserva essa validação e os presets de Fluxo de Caixa mantêm seus controles. |
| Contas | Coleção ativa, consulta compartilhada e URL de Relatórios | Quatro testes versionados falharam na interseção e no escopo vazio. Os outros 83 testes do recorte inicial do frontend passaram. |

## Apuração e navegação

- A UI informa `statuses` explicitamente e usa a apuração compartilhada. A entrada de API sem `statuses` preserva a compatibilidade da v0.19.0, inclusive sua validação histórica. Com status explícito, a API valida a janela pedida e limita a apuração à data local do espaço.
- As linhas elegíveis são quantizadas em centavos por transação e escopo. Usa-se arredondamento para o par mais próximo no empate, com distribuição por maior resíduo e desempate pelo ID estável da linha. O valor principal gravado tem precedência quando pertence ao titular na moeda do relatório. A busca de taxa usa a data bancária e as taxas armazenadas. Movimentos sem conversão continuam no livro-razão e geram um aviso de apuração incompleta no relatório.
- Rateios recebidos de outro espaço são agrupados em **Sem categoria**. O contexto pessoal usa apenas a parcela do usuário e aplica a autorização nativa de compartilhamento. A seleção explícita de contas usa os valores integrais das contas autorizadas. O aviso de câmbio conta movimentos observados. Projeções usam as fontes nativas de recorrência, operações futuras e saldos de faturas. O equivalente de provedor já observado é suprimido nas projeções transacionais; recorrências materializadas e faturas alocadas mantêm a lógica nativa.
- A categoria selecionada pode combinar observado e projetado. O modal mostra as duas parcelas e o total e pagina apenas movimentos observados. Para barras, o detalhe usa a interseção do intervalo da barra com a janela histórica.
- O CTA abre `/transactions` com os filtros nativos e três chaves adicionais na URL, `report_group`, `report_from` e `report_to`. O servidor resolve as contribuições novamente, usa as mesmas regras de elegibilidade e entrega o valor contextual à tabela, ao rodapé e ao CSV. O usuário pode pesquisar, alterar filtros e remover o contexto pelo chip. O dado original continua disponível para edição. A seleção de calendário encerra o contexto de contribuições e abre o calendário nativo.
- IDs repetidos da URL de Relatórios são consolidados. A coleção restringe o escopo por interseção. Sem coleção, a API valida UUIDs malformados e a consulta restringe IDs válidos ao espaço autorizado. O botão descreve as dimensões escolhidas; o modal e a navegação usam contas efetivas.

## Matriz de aceite

| ID | Estado | Evidência | Arquivos de implementação |
| --- | --- | --- | --- |
| UI-01, UI-02 | Aprovados | Vitest compara a seleção disparada pela fatia e pela legenda da composição. | `pages/reports.tsx` |
| UI-03 | Aprovado | O cartão da Tendência inicia a consulta da categoria e abre o modal pelo próprio alvo. | `pages/reports.tsx` |
| UI-04 | Aprovado | Ativação com Enter, série de despesa e recorte contábil; barras projetadas sem ação. | `pages/reports.tsx`, `lib/report-selection.ts` |
| UI-05 | Aprovado | Clique e Enter em nós do Money Map, com o mesmo modal dos outros alvos. | `components/reports/CashflowSankey.tsx` |
| UI-06 | Aprovado | Espaço abre o seletor com três categorias ocultas. **Outros** real abre o próprio detalhe. | `components/reports/CashflowSankey.tsx` |
| UI-07, UI-08 | Aprovados | Testes de créditos e débitos com privacidade ligada e desligada. Cores verificadas no DOM e nas capturas. | `components/reports/ReportTransactionsDialog.tsx` |
| UI-09 | Aprovado | Modal de duas linhas e teste de 21 transações em duas páginas, com total constante. Capturas desktop e mobile. | `components/reports/ReportTransactionsDialog.tsx` |
| UI-10 | Aprovado | Navegação para o componente real da página nativa com toolbar, busca e tabela. | `components/reports/ReportTransactionsDialog.tsx`, `pages/transactions.tsx` |
| UI-11 | Aprovado | Filtros e chips nativos com conta, tipo, categoria, intervalo e elegibilidade. Requisição real da página testada com adaptador HTTP sintético. | `pages/transactions.tsx`, `components/transactions-filter-bar.tsx` |
| UI-12 | Aprovado | Abertura por URL, alteração do status nativo, pesquisa e remoção do contexto reconsultam a tabela. | `pages/transactions.tsx`, `api/transactions.py` |
| UI-13, UI-14 | Aprovados | Teclado descarta o rascunho. Aplicar conserva filtro na URL e propaga às duas telas, ao modal e ao CTA. | `components/reports/ReportFilters.tsx`, `pages/reports.tsx` |
| UI-15 | Aprovado | Os dois relatórios desativam a consulta com interseção vazia; há validação do estado renderizado. | `pages/reports.tsx` |
| UI-16 | Aprovado | A janela pedida fica no seletor após confirmação e navegação. API e detalhe usam o corte do espaço, inclusive ao cruzar a meia-noite. | `pages/reports.tsx`, `components/ui/date-range-picker.tsx`, `api/reports.py` |
| UI-17 | Aprovado | Abrir e sair com Enter/Escape, retorno do foco, bloqueio do último status e indicador acessível. | `components/reports/ReportFilters.tsx` |
| UI-18 | Aprovado | Débito de 100 com contribuição de 40 no gráfico, detalhe, tabela e CSV. O valor original permanece 100. | `services/report_contributions.py`, `api/transactions.py`, `services/transaction_service.py` |

| Matriz financeira | Evidência executável |
| --- | --- |
| C01–C04 | Agregações por status/conta, janela futura, entradas inválidas e preferência por lançamento elegível, inclusive ao mudar para investimento. |
| C05–C06 | A projeção mantém a operação futura independente e a recorrência; o rateio próprio e a parcela recebida alteram o agregado e o detalhe no escopo pessoal. |
| C07–C08 | Validação das duas pontas, limite de dez anos, data futura distante e mudança do dia contábil no fuso do espaço. |
| U01–U07 | Testes de rascunho, conta efetiva, navegação, barra, paginação, agrupamento e período. Os componentes foram executados com respostas sintéticas e a API testada separadamente com persistência. |
| M01–M05 | Rateios por categoria, resíduos em centavos, câmbio ausente, data de referência e distinção entre observado e projetado. |

## Comparação visual

As 20 capturas sintéticas estão em `tmp/validation/capturas/`. Cada versão tem cinco cenas em desktop (1366 × 814) e cinco em viewport móvel (500 × 758), no Firefox headless. Foram examinados popover, modal de despesa, modal de receita com máscara no tema escuro, Tendência por Categoria e página de Transações após o CTA. A versão anterior usa a própria UI e o mesmo conjunto de dados sintéticos.

| Área | Divergência observada na v0.19.0 |
| --- | --- |
| Modal | Mesmo agrupamento, bordas, resumo e rodapé. A nota passou para uma linha separada e o nome da conta permanece legível no móvel. O contexto indica o tipo e o status com a terminologia nativa. |
| Filtros | Popover ancorado com duas seções, indicador por dimensão e botões nativos. O rodapé inclui **Cancelar**. As duas contas homônimas exibem finais diferentes, inclusive quando têm o mesmo nome alternativo. |
| Relatórios | A ordem do layout configurável, a aba **Demonstrativo** e o botão **Gerenciar** vêm da v0.19.0. A composição oferece **Investimentos** quando existe essa categoria de movimentos. |
| Transações | A página usa controles, chips, tabela e cartões móveis da v0.19.0. O chip de contribuições deixa explícita a apuração de origem e o contexto dos dois status. A tabela mostra os valores da contribuição. |

## Arquivos modificados

| Área | Caminhos |
| --- | --- |
| Relatórios no backend | `backend/app/api/reports.py`, `backend/app/schemas/report.py`, `backend/app/services/report_service.py`, `backend/app/services/custom_income_expenses.py`, `backend/app/services/report_contributions.py` |
| Listagem e CSV nativos | `backend/app/api/transactions.py`, `backend/app/schemas/transaction.py`, `backend/app/services/transaction_service.py` |
| Relatórios na interface | `frontend/src/pages/reports.tsx`, `frontend/src/components/reports/{CashflowSankey,ReportFilters,ReportTransactionsDialog}.tsx`, `frontend/src/components/ui/date-range-picker.tsx`, `frontend/src/lib/report-selection.ts` |
| Transações na interface | `frontend/src/pages/transactions.tsx`, `frontend/src/components/{transactions-filter-bar,mobile-transaction-row}.tsx` |
| Tipos, transporte e idiomas | `frontend/src/lib/api.ts`, `frontend/src/types/index.ts`, os 17 catálogos em `frontend/src/locales/` |
| Testes e documentação | `frontend/src/pages/report-drilldown.test.tsx`, `custom/tests/test_report_contributions*.py`, `custom/tests/visual/`, `custom/compatibilidade-v0.19.0.md` e esta matriz |

## Testes e reprodução

| Execução | Resultado |
| --- | --- |
| API e serviços na linha de base SQLite | 249 aprovados, dez falhas conhecidas, 12 PostgreSQL pulados na execução SQLite. |
| Frontend na linha de base | 83 aprovados e quatro falhas conhecidas. |
| SQLite após a implementação | 296 aprovados, incluindo relatórios nativos, linhas de categoria e data de referência. |
| PostgreSQL local 18 | 54 aprovados, incluindo as duas suítes nativas e os contratos customizados. |
| Frontend, incluindo catálogos de tradução | 213 aprovados em 11 suítes. |
| Typecheck, bundle Vite e ESLint | Build de produção e lint dos arquivos TypeScript alterados aprovados. |
| Firefox | 20 capturas em 10 pares de cenas. |

Para rodar os testes versionados nos executores nativos, copie os contratos para a árvore descartável antes da execução.

```sh
cp custom/tests/test_custom_reports_api.py custom/tests/test_report_contributions*.py backend/tests/
cp custom/tests/custom-report-scope.test.tsx frontend/src/pages/
(cd backend && .venv/bin/python -m pytest -q \
  tests/test_custom_reports_api.py tests/test_report_contributions.py \
  tests/test_report_service.py tests/test_report_service_coverage.py \
  tests/test_category_lines_reports.py tests/test_reporting_date_override.py)
(cd frontend && NODE_OPTIONS=--no-experimental-webstorage npm test -- \
  src/pages/report-drilldown.test.tsx src/pages/custom-report-scope.test.tsx \
  src/pages/reports.test.tsx src/lib/report-period.test.ts \
  src/components/reports/IncomeExpenseStatement.test.tsx \
  src/components/ui/date-range-picker.test.tsx src/components/mobile-transaction-row.test.tsx \
  src/pages/transactions-description-badges.test.tsx src/pages/transactions-transfer-badge.test.tsx \
  src/pages/transactions-transfer-category-prompt.test.tsx src/locales/i18n.test.ts)
(cd frontend && npm run build)
```

Para PostgreSQL, configure `POSTGRES_TEST_URL` apontando para um banco descartável e execute `tests/test_reports_postgres.py`, `tests/test_category_lines_reports_postgres.py` e `tests/test_report_contributions_postgres.py` no backend. A fixture nativa cria um esquema por caso. O SQLite precisou do agendador local de despertares em `tmp/validation/run-sqlite.py`, de acordo com a limitação registrada na baseline. O [roteiro visual](tests/visual/README.md) usa Firefox, Vite e dados sintéticos.
