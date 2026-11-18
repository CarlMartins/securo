# Datas futuras em períodos personalizados

**Objetivo.** Permitir selecionar um período de calendário ainda em curso ou futuro em Receitas vs Despesas e Money Map, consultando as movimentações observadas até hoje.

## Comportamento e regras

- O seletor aceita início e fim futuros. A interface conserva as datas escolhidas, solicita o recorte somente após confirmar as duas pontas e envia o intervalo selecionado. O limite da consulta e do detalhamento é hoje no fuso efetivo do espaço, inclusive. A data usada no corte, no agrupamento e no detalhe é a data de referência da v0.19.0, com override manual, override de fatura e base do regime de caixa ou competência nessa ordem. A data bancária e a identidade originais permanecem preservadas.
- O período explícito tem prioridade sobre presets, dias e meses. Início e fim são inclusivos. Os dois são obrigatórios em conjunto. Fim anterior ao início e amplitude superior a 10 anos civis produzem 422. Verificar a amplitude das datas pedidas antes de truncar ao presente. Ao somar anos, ajustar 29/02 para 28/02 se necessário e limitar ao último dia representável quando houver transbordamento.
- Quando início é hoje ou anterior, apurar de início até o menor entre fim e hoje. Quando início está no futuro, a consulta é válida e devolve zero no resumo, sem tendência observada nem composição. O período explícito fica sem estimativas, mesmo quando inclui hoje. O detalhe usa o mesmo recorte histórico e não abre para uma janela inteira futura.
- Em períodos personalizados navegados, mostrar no seletor as mesmas pontas enviadas à consulta. Preservar a referência original para voltar. Janelas alinhadas a meses inteiros avançam ou retrocedem em blocos da mesma quantidade de meses. Para outras janelas a referência usa a amplitude em meses de 30 dias arredondada para cima, com mínimo de um mês, e desloca as duas datas com ajuste ao último dia válido.
- Patrimônio mantém o limite hoje. Ao trocar para essa aba, respeitar seu período lembrado, se houver. Se a janela que seria usada lá termina no futuro mas começa até hoje, limitar o fim a hoje. Se começa no futuro, usar o preset de fallback da aba. Fluxo de Caixa mantém seus controles de previsão.

## Critérios de aceite

| Hoje no espaço | Pedido | Resultado |
| --- | --- | --- |
| 12/09/2026 | 01/09 a 20/09/2026 | Rótulo até 20/09, apuração e detalhe até 12/09 |
| 12/09/2026 | 13/09 a 20/09/2026 | Sucesso com resumo zero, composição e tendência vazias |
| 12/09/2026 | 12/09 a 12/09/2026 | Apenas registros de 12/09 |
| 12/09/2026 | 01/09 sem fim, fim invertido ou intervalo acima de 10 anos | 422 |
| 02/11/2026 | 12/10 a 02/11/2026, um passo para trás | 12/09 a 02/10 na interface e na consulta |

Em 12/09/2026, se houver receitas de 100 no próprio dia e de 200 no dia seguinte, a primeira linha da tabela gera 100. Trocar para Patrimônio sem período lembrado compatível deve limitar a primeira seleção a 12/09 e usar o fallback para a segunda. Uma compra bancária de 13/09 com referência ajustada para 12/09 participa do gráfico e do detalhe do dia 12, preservando a data bancária de 13/09.

**Referências históricas.** `9d5220ca` e sincronização da navegação em `16a2e7e1`. O corte foi implementado na entrada da API. Testar o contrato pela entrada pública. Na branch atual já existem recortes explícitos históricos e navegação por meses, mas o seletor e a API de Receitas vs Despesas rejeitam fim futuro.
