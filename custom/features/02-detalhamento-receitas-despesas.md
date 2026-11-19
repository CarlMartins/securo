# Detalhamento em Receitas vs Despesas

**Objetivo.** Abrir as transações relacionadas a um ponto do relatório sem abandonar o contexto, com opção de continuar na página de Transações.

## Comportamento e regras

- Clicar numa barra observada de receitas abre créditos. Clicar numa de despesas abre débitos. O recorte é o intervalo da barra limitado ao período histórico ativo, sem filtro de categoria. A barra diária corresponde a um dia, a semanal à semana ISO de segunda a domingo, a mensal ao mês civil e a anual ao ano civil. Barras projetadas, rótulos ausentes ou com formato incompatível e intervalos sem interseção não abrem o diálogo.
- Acionar uma categoria na composição (fatia, legenda ou lista) ou no cartão de tendência abre o período histórico inteiro do relatório. Se a composição estiver mostrando o recorte de um ponto do gráfico na interface nativa, a categoria usa esse mesmo recorte para reconciliar com o valor exibido. Receitas usam créditos, despesas e investimentos usam débitos. Usar a identidade da categoria. Uma categoria real chamada “Outros” continua selecionável. “Sem categoria” usa a condição de ausência de categoria. O agrupamento sintético da tendência “Outros” não abre a lista.
- O gráfico e o detalhe usam a mesma base de contribuições elegíveis. O detalhe de uma categoria usa só a parte de cada transação atribuída à seleção, inclusive linhas de categoria e a parcela pertinente ao escopo de contas e rateio. Excluir equivalentes suprimidos, transferências, ignorados e outros registros que não contribuíram para o valor selecionado. Em investimentos, aplicar a elegibilidade específica de investimentos.
- Capturar ao abrir as datas, o tipo, a categoria quando aplicável, os status e as contas efetivas. O período inclui a janela navegada, o recorte de dias ou o início do ano fiscal aplicável. O limite histórico é hoje no fuso efetivo. Uma seleção inteiramente futura não produz detalhamento.
- Respeitar o [contrato visual compartilhado](00-contrato-interface-customizada.md): preservar a experiência customizada da v0.16.6-custom, implementando-a com os componentes e padrões técnicos da v0.19.0. Mostrar período, status, categoria quando aplicável, descrição, conta, data de referência e valor efetivamente atribuído, com a respectiva moeda. Se exibir o valor original ou a data bancária, identificá-los separadamente. Respeitar privacidade, autorização e os estados de carregamento, erro e vazio.
- O total assinado de toda a seleção corresponde exatamente ao valor do gráfico, após aplicar o sinal da série e a precisão exibida. Paginar sem alterar o total. Preservar a identidade e contar transações distintas quando o indicador disser “transações”, ainda que algumas tenham mais de uma contribuição.
- **Ver transações** deve navegar para a **página nativa de Transações da v0.19.0**, com sua listagem real, cabeçalho, barra de pesquisa, filtros, controles e ações normais — não para uma página de detalhamento em tela cheia, modal convertido em página ou lista paralela. A seleção precisa ser materializada nos filtros nativos aplicados ao abrir (contas, categoria, tipo, status, data e exclusões quando cabíveis). A navegação mantém a seleção contábil, inclusive ambos os status quando aplicáveis, e os mesmos valores elegíveis; se os filtros dimensionais nativos não reproduzirem exatamente as contribuições, introduzir um **contexto de relatório** na página nativa, sem sacrificar a interface. Não apresentar a listagem geral como reconciliada se não estiver. O agente deve investigar a rota e o modelo de filtros existentes na versão de destino, sem inventar rota ou criar outra página.
- Quando uma categoria exibir observado e projeção, identificar os dois componentes e reconciliar o valor exibido. Uma previsão sem transação associada deve ser identificada como previsão, sem criar uma transação fictícia ou somá-la aos registros observados. A apresentação da parte projetada ainda precisa de revisão.

## Contrato específico de interação e apresentação

### Pontos clicáveis

- **Receitas vs Despesas — barras:** ativar uma barra observada deve abrir o modal para o tipo e período daquela barra. As exceções (barras de projeção, sem período válido) continuam as definidas acima.
- **Composição — gráfico de pizza:** ativar a **fatia**, seu item de **legenda** ou a **linha de lista** da categoria deve abrir o modal filtrado. Os três acessos precisam ser equivalentes para uma categoria selecionável.
- **Tendência por Categoria:** cada **cartão/item de categoria real e selecionável**, e seu alvo visual correspondente quando interativo, deve abrir o **mesmo modal compartilhado** e com os filtros corretos. A existência de clique no gráfico de composição não satisfaz este critério. Agrupamento sintético “Outros” continua não selecionável nesta visualização, conforme regra acima.
- Em cada alvo selecionável, fornecer semântica interativa, foco visível, acionamento por teclado (Enter/Espaço quando aplicável), indicativo de interatividade (hover/cursor) e comportamento consistente em dispositivos de toque. Não criar clique em títulos, divisórias ou agrupamentos não selecionáveis.

### Modal de transações — referência visual: v0.16.6-custom

- **Cabeçalho:** título direto `Transações - <categoria>` ou título equivalente da barra; abaixo, uma linha legível com **período · tipo (Receitas/Despesas/Investimentos) · status selecionados**. Não substituir esta hierarquia por subtítulos genéricos redundantes como “Contribuições para o valor selecionado no relatório”.
- **Corpo:** uma superfície agrupada com borda e separadores discretos entre linhas. Cada linha apresenta **descrição em destaque** e metadados em segundo plano (**data de referência · categoria · nome de exibição da conta**); valores alinhados à direita; **status** identificado por texto próximo ao valor ou na linha de metadados, sem ambiguidade.
- **Cores financeiras:** crédito/receita em **verde semântico**; débito/despesa em **vermelho semântico**. A cor deve aparecer tanto com o valor revelado quanto com a **máscara de privacidade**, sem expor o número. Investimentos seguem a convenção semântica já adotada no relatório, sem inferir sinal pelo nome da categoria. O total/saldo usa a semântica da métrica apresentada, e o sinal não pode ser alterado por estética.
- **Resumo:** apresentar total/saldo observado em uma região visual **separada** da lista (como a faixa delineada da referência antiga), com rótulo de domínio adequado à seleção. Exibir componente projetado separadamente caso exista, sem misturá-lo silenciosamente ao observado. Respeitar os pontos de revisão de projeção existentes nesta feature.
- **Rodapé:** contagem de transações à esquerda e o botão primário **Ver transações** à direita, na mesma área de ações em desktop; adaptação responsiva em telas estreitas. Botão de fechar evidente no canto superior; lista com rolagem quando longa; evitar que rodapé fique inacessível.
- **Identidade visual:** adotar espaçamentos, hierarquia, bordas, contraste, arredondamentos e alinhamentos próximos à referência antiga, sem codificar valores rígidos de pixel que comprometam responsividade. Usar tokens e componentes compatíveis com a v0.19.0; restringir CSS a esta feature e evitar regressões globais. Padrões devem ser comparados lado a lado com as capturas de referência.
- **Nome de conta:** utilizar o nome de exibição contextual da aplicação, não substituir por nome de instituição financeira como atalho; distinguir contas homônimas com o padrão nativo. Respeitar a máscara de privacidade.

### Navegação nativa: “Ver transações”

1. Ao abrir o detalhe, capturar o contexto efetivo do relatório (data solicitada, limite histórico, tipo, categoria por identidade, status, contas efetivas, coleção, origem, supressões e eventual contexto de contribuição), sem reconstruí-lo a partir de texto do modal.
2. Ao acionar **Ver transações**, navegar usando o mecanismo de roteamento existente para a **página oficial de Transações**, em sua visualização nativa (lista/calendário conforme padrão de destino). **Proibido** renderizar só as linhas do modal em uma nova rota e chamá-las de “Transações”.
3. A página de destino deve exibir os filtros como **aplicados e inspecionáveis** na interface existente (por exemplo, chips de conta, categoria, tipo, status, período e exclusões quando pertinentes). O mesmo contexto deve alimentar a consulta; não basta mostrar chips decorativos.
4. Preservar estado durante navegação e recarregamento/compartilhamento quando aplicável, por URL ou mecanismo de estado serializável e persistente apropriado ao destino. Limpar um filtro na página de Transações deve atualizar a listagem nativa e o contexto correspondente.
5. A reconciliação dos valores elegíveis é obrigatória conforme a regra anterior: caso o modelo nativo não suporte escopo de relatório, estendê-lo com contexto explícito **dentro da página nativa**. Não usar dados de uma lista paralela como substituto e não declarar equivalência se houver diferenças.

### Aceite visual adicional

- Comparar lado a lado com a referência v0.16.6-custom: posição de título/período, agrupamento de linhas, alinhamento de valores e status, barra do resumo, rodapé, botões e comportamento com máscara ativa.
- Testar ao menos 1 receita, 1 despesa, múltiplas linhas e estado vazio; usar **dados fictícios**, preservando a privacidade de valores de produção.
- Testar **Composição** e **Tendência** separadamente; o teste de um gráfico não cobre o outro.
- Após o clique em **Ver transações**, verificar a presença de **componentes próprios da página nativa** (barra de busca, filtros, tabela ou lista habitual e ferramentas existentes), além de confirmar os filtros e os valores. Uma página que somente replica os registros do modal deve reprovar, ainda que o número de registros esteja correto.

Consulte também [Aceite de interface e navegação](../tests/aceite-interface-e-navegacao.md).

## Critérios de aceite

- Período 12/09/2026 a 02/10/2026. Barra de despesa da semana `2026-W37` lista débitos de 12 a 13/09. Barra da semana `2026-W40` termina em 02/10. Uma categoria aberta no mesmo relatório usa 12/09 a 02/10.
- Para 21 débitos elegíveis que contribuíram 70 BRL, o total é −70 BRL em todas as páginas. Um débito excluído adicional fica fora da seleção e do total. Para uma categoria que recebeu 40 BRL de um débito de 100 BRL dividido entre despesa e investimento, o detalhe de despesa mostra contribuição de −40 BRL e preserva a identidade da transação. O destino de Transações mantém o mesmo recorte.
- Abrir “Outros” real, “Sem categoria” e um agrupamento sintético produz, respectivamente, um filtro por ID, uma condição de ausência e nenhuma abertura. Conferir também erro, carregamento, lista vazia e máscara com transações fictícias.

## Diferença em relação à referência histórica

A implementação histórica usa o serviço geral de transações. Os filtros dimensionais coincidem, mas a lista pode incluir linhas excluídas do P&L, equivalentes de provedor e valores de rateio diferentes dos usados no agregado. Estimativas incorporadas a categorias também podem não ter linhas observadas correspondentes. Essa diferença passa a ser uma falha no contrato da migração. Consulte [Cenários de regressão](../tests/cenarios.md).

**Referências históricas.** `162de6a5`, `9d5220ca`, `96bf07aa` e `e45a1232` (nome de exibição). Veja a [matriz da migração](../compatibilidade-v0.19.0.md) para a implementação na v0.19.0.
