# Detalhamento no Money Map

**Objetivo.** Permitir investigar as transações relacionadas a cada categoria do mapa de entradas, despesas e investimentos, inclusive categorias agrupadas para caber na visualização.

## Comportamento e regras

- O mapa consome a composição do mesmo relatório de Receitas vs Despesas com as datas, status e contas efetivas do Money Map. O comportamento combinado padrão e as projeções seguem [Transações pendentes](01-transacoes-pendentes.md).
- Apenas nós de categoria abrem o detalhamento. A ativação funciona por clique, Enter e Espaço. O nó central, saldo/superávit, déficit e conexões são elementos de visualização. Aplicam-se a janela histórica completa, a distinção entre crédito e débito, a semântica de “Sem categoria” e o [diálogo compartilhado](02-detalhamento-receitas-despesas.md).
- A compactação ordena as categorias positivas por valor dentro de cada grupo e agrega as menores em “Outros” quando necessário. Na referência, o limite é de 9 nós de categoria por grupo, sendo oito categorias individuais e “Outros” se houver mais de nove. O nó “Outros” sintético abre um seletor das categorias dobradas daquele grupo, que pode ser fechado. A escolha de uma delas abre o diálogo com seu próprio tipo e identidade. Uma categoria real chamada “Outros” abre diretamente.
- Se a janela for inteiramente futura, não há categoria observada para abrir. Se o nó inclui estimativas, a apuração detalhada precisa distinguir e reconciliar as parcelas observadas e projetadas. Projeções sem transação associada devem permanecer identificadas como previsões. O mapa mantém a máscara de privacidade dos valores, e o diálogo mantém sua própria máscara.
- A referência histórica abre Receitas vs Despesas no primeiro acesso, com preset de um ano, e posiciona o Money Map logo depois. A versão atual passou a respeitar o layout de relatórios configurável. Preservar o layout configurável, a ordem escolhida pelo usuário e os componentes visuais da v0.19.0.

## Critérios de aceite

- Com contas A e B, filtro A e status Pendente, ativar um nó de despesa com Enter. O diálogo usa débitos pendentes da conta A e o período histórico exibido. Para nó de receita, usa créditos. Para investimento, usa débitos.
- Com onze categorias de despesa de valores distintos, conferir oito nós individuais e “Outros”, cujo valor é a soma das três categorias ocultas. Acionar o nó exibe somente as ocultas desse grupo. Selecionar a menor abre só a categoria escolhida. Testar Espaço e uma categoria real chamada “Outros”.
- Após selecionar 01/09 a 20/09, com hoje em 12/09 no espaço, abrir uma categoria deve consultar até 12/09. A navegação para Transações preserva esse limite e as contribuições exatas do nó ou da categoria escolhida.

**Referências históricas.** `f01be4f8`, `9d5220ca`, `96bf07aa` e `e45a1232`. Na branch atual o mapa e o agrupamento visual continuam nativos, sem ação de detalhamento nos nós.
