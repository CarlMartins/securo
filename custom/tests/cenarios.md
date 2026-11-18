# Cenários de regressão dos relatórios

Use apenas dados fictícios. Salvo indicação contrária, fixe “hoje” em 12/09/2026 no fuso do espaço, use BRL sem conversão, um espaço pessoal e intervalo diário para casos de API. As referências A, B e C são IDs distintos de contas. Use uma sessão sem filtros prévios quando o cenário não os menciona.

**Evidência.** “Contrato” indica um caso da nova suíte de API. “Interface” indica a nova suíte com consultas simuladas. “Histórico” indica verificações automatizadas existentes, incluindo testes de interface com respostas simuladas. “Roteiro” indica passos reproduzíveis ainda sem teste integrado. O resultado da execução por versão está no [inventário de cobertura](README.md).

## API e aritmética

Dados para C01–C03 e U03:

| Conta | Data | Tipo | Status | BRL | Identidade externa e observações |
| --- | --- | --- | --- | ---: | --- |
| A | 12/09 | Crédito | Lançado | 100 | — |
| A | 12/09 | Débito | Pendente | 65 | operação X |
| A | 12/09 | Débito | Lançado | 75 | operação X |
| A | 12/09 | Débito | Pendente | 15 | sem ID |
| A | 12/09 | Débito | Pendente | 500 | ignorado |
| A | 13/09 | Crédito | Lançado | 200 | futuro |
| B | 12/09 | Débito | Pendente | 20 | operação X, conta diferente |

| ID | Entrada e ação | Resultado esperado | Evidência |
| --- | --- | --- | --- |
| C01 | Período 11–12/09. Consultar A e B sem status, A com lançados, A com pendentes, A e B com ambos, A com ambos invertidos e B com ambos. | Pares receita/despesa, respectivamente 100/75, 100/75, 0/80, 100/110, 100/90 e 0/20. Resultado = receita − despesa. O ponto de 12/09, a composição e a tendência por categoria concordam com o agregado nesse conjunto. Projeções zero. | Contrato |
| C02 | Período 11–20/09, A, ambos. Repetir para 13–20/09. | Primeiro 100/90 e último ponto dia 12. Segundo 0/0 sem tendência, composição nem tendência por categoria. Em ambos, projeções zero. Patrimônio rejeita 12–13/09 com 422. | Contrato e histórico |
| C03 | Enviar status vazio, repetido, com espaço ou desconhecido. | 422 em cada caso. | Contrato e histórico |
| C04 | Um débito pendente de 75 e seu lançamento de 75 possuem a mesma identidade. Variar o lançamento entre ignorado, categoria ignorada, excluído do resultado, abertura ou fora do período. Repetir com lançamento elegível reclassificado para investimento. | No primeiro conjunto, despesa de 75 com ambos e zero só com lançados. Na reclassificação, a composição de investimento recebe 75, e a despesa é zero. Se o registro pendente passar a lançado no mesmo registro, permanece uma ocorrência. | Histórico |
| C05 | Preset mensal com hoje em 12/10: pendente observado de 75, lançamento equivalente em 13/10, outro lançamento de 20 em 13/10. Ambos selecionados. | Despesa observada 75 e projetada 20. Composição e tendência por categoria somam 95. Uma recorrência independente continua elegível quando ambos são enviados ou o status é omitido. Repetir com status único explícito ou datas explícitas, com estimativas zeradas. | Histórico para duplicata e projeção padrão, roteiro para combinar a mesma recorrência com todos os modos |
| C06 | Débito próprio de 100 na conta A com parcela de terceiro de 40, mais débito próprio de 20 em B. Repetir filtrando só A. Em outro espaço, criar pendência com parcela do usuário de 30 e lançamento equivalente com parcela de 40. Variar a presença e elegibilidade desta última parcela. | Sem escopo de contas, as duas despesas próprias somam 80. Com A, somam 100. No cenário isolado de parcela recebida, a despesa é 40 se o lançamento elegível incluir o usuário. Sem parcela elegível na lançada, a despesa fica em 30. Uma conta explícita própria exclui esse ajuste de outro espaço. | Histórico para a parcela recebida. Roteiro para o conjunto completo de conta, rateio e status |
| C07 | Usar 12/09 como ambas as pontas, só uma ponta, intervalo invertido e 12/09/2016–12/09/2026. Recuar o início mais um dia. Pedir 01/01/9990–01/01/9990. | Um dia válido, 422 com ponta ausente, 422 com intervalo invertido, 10 anos aceitos, 10 anos e um dia com 422, data distante futura aceita em Receitas vs Despesas. | Histórico. Caso de 9990 usa simulação do serviço |
| C08 | Fuso do espaço em São Paulo, instante 13/09/2026 01:00 UTC. Em A, lançar compras de 10 e 20 com data contábil em 12 e 13/09. Pedir até 20/09. | O espaço ainda está no dia 12. Apuração e detalhe até 12/09, com valor 10. Repetir após meia-noite no espaço. O corte passa ao dia 13 e o valor a 30. | Roteiro integrado. Há cobertura histórica separada para resolução do fuso |

## Interface, escopos e navegação

| ID | Entrada e ação | Resultado esperado | Evidência |
| --- | --- | --- | --- |
| U01 | URL inicial sem filtros, duas contas “Corrente” com finais 1234 e 5678. Escolher 5678 e Pendente, fechar sem aplicar, reabrir e depois aplicar. Trocar de aba, recarregar, voltar e avançar no histórico, limpar e aplicar. | Antes de aplicar, ambos os status e nenhuma conta explícita. Depois, a URL e os dois relatórios compartilham a seleção. Os rótulos distinguem as contas e a descrição acessível informa status e uma conta. Limpar e aplicar retorna ao padrão. | Histórico com simulação da API para os fluxos centrais. Roteiro para abandono do rascunho combinado |
| U02 | Coleção A+B, selecionar B+C na URL. Abrir categoria e seguir o link. Repetir só com C e com coleção que contém apenas carteiras. Limpar e alternar Patrimônio e Fluxo de Caixa. | B no agregado, diálogo e link. Nos recortes vazios, mostrar estado vazio, sem dados anteriores e sem consulta com escopo mais amplo. Ao limpar, voltar a A+B. Outros relatórios mantêm somente escopo e controles nativos. | Interface cobre interseção e vazio nos dois relatórios. Roteiro para diálogo, link, limpeza e outras abas |
| U03 | Usar C01 com ambos, conta A e período pedido 11–20/09. Em Receitas vs Despesas, abrir barra diária e depois categoria. Em Money Map, abrir categoria. | Detalhe de barra no dia 12 segundo o tipo. Detalhes de categoria de 11 a 12/09 segundo tipo e categoria. Conta A e combinação de status preservadas. No detalhe da despesa e no link, mostrar só o lançamento elegível de 75 e o pendente elegível de 15. O detalhe assinado soma −90 BRL. A pendência equivalente de 65 e o débito ignorado de 500 ficam fora. | Contrato cobre o agregado e o corte. Histórico cobre mapeamentos isolados. Roteiro ponta a ponta |
| U04 | Janela 12/09–02/10. Acionar barras W37, W40, mensal de setembro, anual de 2026, a diária de 14/09 e uma projetada. | Respectivamente 12–13/09, 28/09–02/10, 12–30/09, janela inteira e somente 14/09. Projetada não abre. Categoria usa janela inteira e a barra mantém somente tipo. | Histórico para recortes e acionamentos representativos. Roteiro para barra projetada |
| U05 | Preparar 21 débitos elegíveis somando 70 BRL e um débito adicional excluído. Incluir nome alternativo da conta, descrição e notas longas. Avançar de página e abrir Transações. Repetir com lista vazia, falha da consulta e privacidade ativada. | 21 itens distribuídos em páginas conforme o componente de destino, total −70 constante, nome de exibição ou fallback, texto legível com prévia, link com o mesmo escopo. Estados distintos de vazio e erro, valores mascarados conforme preferências. | Histórico para a mecânica da paginação, nome e link. Roteiro para total reconciliado, exclusões, vazio, erro e privacidade |
| U06 | Onze despesas de 1 a 11 BRL, uma categoria real “Outros” com 11 BRL e uma categoria “Sem categoria” entre os nós ocultos. Acionar “Outros” sintético com Espaço, escolher a categoria de 1 BRL e fechar. Acionar a real com Enter. | Oito categorias individuais e “Outros” sintético de 6 BRL. O seletor mostra três itens de despesa. O detalhe escolhido reconcilia com a contribuição da categoria e respeita a identidade ou ausência de categoria. A categoria real abre diretamente. Centro, conexões e saldo não abrem. | Histórico para nó real, Enter e seletor. Roteiro para valores, Espaço, ausência e nós inativos |
| U07 | Fixar hoje em 02/11. Aplicar 12/10–02/11 e retroceder. Testar janela que cruza o fim de fevereiro, e mudar de aba com o período 01–20/09 quando hoje é 12/09. Repetir com 13–20/09. | Rótulo, seletor e consulta passam a 12/09–02/10. Datas obedecem o último dia válido em fevereiro. Patrimônio limita a janela transferida a 12/09 ou usa o preset caso comece no futuro, quando não há preferência própria que tenha precedência. | Histórico, com API simulada na interface |

## Regressões adicionais para o contrato da migração

| ID | Entrada e ação | Invariante verificável |
| --- | --- | --- |
| M01 | Débito de 100 BRL com duas linhas, 40 de despesa e 60 de investimento, sem rateio ou outro débito. Abrir o detalhe da despesa e depois o nó de investimento. | Gráfico de despesa 40 e contribuição detalhada −40. Nó de investimento 60 e contribuição −60. A identidade original é a mesma. |
| M02 | Preparar parcelas elegíveis cuja distribuição em moeda do relatório produz frações de centavo, com taxa fictícia conhecida. Repetir a consulta, mudar ordem e página e trocar entre escopo pessoal e de conta. | Agregado e contribuições reconciliam exatamente na precisão da moeda. A política atribui o resíduo de forma estável em cada escopo. O total da seleção independe da página. |
| M03 | Valor estrangeiro sem valor principal gravado e sem taxa elegível. Incluir uma transação em BRL no mesmo período. | A transação estrangeira permanece identificável no dado original. O relatório não soma valor estrangeiro bruto como BRL nem supõe taxa 1:1 ou zero. A forma de sinalizar incompletude ainda requer decisão. |
| M04 | Compra bancária em 13/09 com referência manual em 12/09, mesmo identificador original. Consultar 12/09, depois 13/09. Repetir com equivalentes elegíveis e uma projeção vinculada. | Somente a janela de referência contém a contribuição observada. Identidade e data bancária permanecem. Quando houver vínculo verificável, a parte já contabilizada não se repete nas projeções. |
| M05 | Categoria com 75 BRL de despesa observada e 20 BRL de projeção elegível sem transação associada. Abrir o detalhe e paginar. | Se o gráfico mostra 95 BRL, o detalhe reconcilia 75 observados e 20 projetados em parcelas identificadas. A previsão não vira uma transação fictícia. |

Os casos acima são roteiros de aceitação. As suítes executadas anteriormente não verificam essas combinações ponta a ponta.

## Decisões restantes

- **R01 · Apresentação e navegação.** A lista deve reconciliar com o gráfico. Definir como mostrar projeções sem transação e como manter a seleção contábil na página de Transações se a listagem nativa não conseguir reconstituí-la. O cenário U03 fixa o resultado de 90 BRL.
- **R02 · Política de cálculo.** A apuração usa decimais, reconcilia parcelas e não presume câmbio. Falta definir o modo e a etapa de quantização, o desempate do resíduo, a data de busca da taxa na ausência de valor gravado e a apresentação quando nenhuma taxa se resolve. Revisar a atribuição de parcelas de grupo recebidas por categoria, inclusive crédito, onde os agregados históricos divergem.
- **R03 · Vínculos entre projeções.** A data de referência governa a apuração, com identidade e data bancária preservadas. Falta confirmar quais chaves ou vínculos nativos permitem relacionar com segurança uma operação a recorrência ou previsão de fatura, inclusive em pagamentos parciais. Usar os vínculos nativos comprovados e preservar previsões independentes.
- **R04 · Favoritos e escopo.** O layout configurável e o estado vazio estão definidos. Falta decidir como sinalizar ou normalizar IDs inválidos, extintos ou duplicados e como distinguir contas selecionadas das efetivamente aplicadas. Links com IDs de outro espaço nunca devem revelar dados nem ampliar a seleção.
