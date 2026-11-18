# Personalizações de relatórios do Securo

A referência comportamental é `custom/v0.16.6` em `47e32251`, que contém os cinco commits solicitados e o ajuste de nome de conta `e45a1232`. O checkout analisado é `custom/v0.19.0` em `0a6ac2d8`, quatro commits após a tag `v0.19.0`. Os cinco commits históricos não são ancestrais desse checkout. As especificações incorporam as decisões da migração e mantêm o contrato do fork antigo como referência histórica.

| Especificação | Referência original | Estado no checkout analisado |
| --- | --- | --- |
| [Transações pendentes](features/01-transacoes-pendentes.md) | `16a2e7e1` | Lançados nos valores observados. Projeções nativas. Falta o status explícito nos dois relatórios. |
| [Detalhamento em Receitas vs Despesas](features/02-detalhamento-receitas-despesas.md) | `162de6a5` | Existe detalhamento do relatório tabular mensal. Faltam as ações nas barras e categorias de Receitas vs Despesas. |
| [Detalhamento no Money Map](features/03-detalhamento-money-map.md) | `f01be4f8` | Mapa com agrupamento visual nativo. Faltam ação dos nós e seletor para as categorias agrupadas. |
| [Períodos personalizados](features/04-periodos-personalizados.md) | `9d5220ca` | A seleção histórica existe. Fim futuro é rejeitado. |
| [Filtros por conta](features/05-filtros-por-conta.md) | `96bf07aa` | A API aceita contas e o recorte de coleção é nativo. Faltam seleção local, URL e interseção com a coleção. |

A versão atual tem diferenças que afetam a adaptação. A agregação financeira passou a considerar linhas de categoria de uma mesma transação. A data manual do relatório participa da seleção contábil. O layout permite escolher e ordenar relatórios. São comportamentos nativos que precisam ser incluídos na comparação, em especial nos [casos R01–R04](tests/cenarios.md#decisões-para-revisão).

- [Matriz de compatibilidade, triagem das 14 falhas e ordem de implementação](compatibilidade-v0.19.0.md)
- [Inventário e execução dos testes](tests/README.md)
- [Cenários de regressão e decisões](tests/cenarios.md)
- [Prompt para reimplementar em outra versão](prompts/reimplementar-relatorios.md)
