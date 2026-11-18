# Detalhamento em Receitas vs Despesas

**Objetivo.** Abrir as transações relacionadas a um ponto do relatório sem abandonar o contexto, com opção de continuar na página de Transações.

## Comportamento e regras

- Clicar numa barra observada de receitas abre créditos. Clicar numa de despesas abre débitos. O recorte é o intervalo da barra limitado ao período histórico ativo, sem filtro de categoria. A barra diária corresponde a um dia, a semanal à semana ISO de segunda a domingo, a mensal ao mês civil e a anual ao ano civil. Barras projetadas, rótulos ausentes ou com formato incompatível e intervalos sem interseção não abrem o diálogo.
- Acionar uma categoria na composição (fatia, legenda ou lista) ou no cartão de tendência abre o período histórico inteiro do relatório. Receitas usam créditos, despesas e investimentos usam débitos. Usar a identidade da categoria. Uma categoria real chamada “Outros” continua selecionável. “Sem categoria” usa a condição de ausência de categoria. O agrupamento sintético da tendência “Outros” não abre a lista.
- O gráfico e o detalhe usam a mesma base de contribuições elegíveis. O detalhe de uma categoria usa só a parte de cada transação atribuída à seleção, inclusive linhas de categoria e a parcela pertinente ao escopo de contas e rateio. Excluir equivalentes suprimidos, transferências, ignorados e outros registros que não contribuíram para o valor selecionado. Em investimentos, aplicar a elegibilidade específica de investimentos.
- Capturar ao abrir as datas, o tipo, a categoria quando aplicável, os status e as contas efetivas. O período inclui a janela navegada, o recorte de dias ou o início do ano fiscal aplicável. O limite histórico é hoje no fuso efetivo. Uma seleção inteiramente futura não produz detalhamento.
- Usar componentes e padrões da v0.19.0. Mostrar período, status, categoria quando aplicável, descrição, conta, data de referência e valor efetivamente atribuído, com a respectiva moeda. Se exibir o valor original ou a data bancária, identificá-los separadamente. Respeitar privacidade, autorização e os estados de carregamento, erro e vazio.
- O total assinado de toda a seleção corresponde exatamente ao valor do gráfico, após aplicar o sinal da série e a precisão exibida. Paginar sem alterar o total. Preservar a identidade e contar transações distintas quando o indicador disser “transações”, ainda que algumas tenham mais de uma contribuição.
- A navegação para Transações precisa manter a seleção contábil, inclusive os dois status quando aplicáveis, e os mesmos valores elegíveis. Se a página geral só conseguir reproduzir filtros dimensionais, é necessário um contexto de relatório que preserve a seleção antes de usar esse destino como equivalente.
- Quando uma categoria exibir observado e projeção, identificar os dois componentes e reconciliar o valor exibido. Uma previsão sem transação associada deve ser identificada como previsão, sem criar uma transação fictícia ou somá-la aos registros observados. A apresentação da parte projetada ainda precisa de revisão.

## Critérios de aceite

- Período 12/09/2026 a 02/10/2026. Barra de despesa da semana `2026-W37` lista débitos de 12 a 13/09. Barra da semana `2026-W40` termina em 02/10. Uma categoria aberta no mesmo relatório usa 12/09 a 02/10.
- Para 21 débitos elegíveis que contribuíram 70 BRL, o total é −70 BRL em todas as páginas. Um débito excluído adicional fica fora da seleção e do total. Para uma categoria que recebeu 40 BRL de um débito de 100 BRL dividido entre despesa e investimento, o detalhe de despesa mostra contribuição de −40 BRL e preserva a identidade da transação. O destino de Transações mantém o mesmo recorte.
- Abrir “Outros” real, “Sem categoria” e um agrupamento sintético produz, respectivamente, um filtro por ID, uma condição de ausência e nenhuma abertura. Conferir também erro, carregamento, lista vazia e máscara com transações fictícias.

## Diferença em relação à referência histórica

A implementação histórica usa o serviço geral de transações. Os filtros dimensionais coincidem, mas a lista pode incluir linhas excluídas do P&L, equivalentes de provedor e valores de rateio diferentes dos usados no agregado. Estimativas incorporadas a categorias também podem não ter linhas observadas correspondentes. Essa diferença passa a ser uma falha no contrato da migração. Consulte [Cenários de regressão](../tests/cenarios.md).

**Referências históricas.** `162de6a5`, `9d5220ca`, `96bf07aa` e `e45a1232` (nome de exibição). Na branch atual há um detalhamento nativo no relatório tabular de resultado mensal, separado das barras e categorias de Receitas vs Despesas.
