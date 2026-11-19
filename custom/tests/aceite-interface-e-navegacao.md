# Aceite de UI, interação e navegação — migração v0.19.0

## Preparação

- Ambiente de desenvolvimento isolado, dados **fictícios**, pelo menos: receita, despesa, duas contas, categoria real “Outros”, categoria sem classificação, transações lançadas/pendentes e período selecionável.
- Comparar modal/relatórios com o histórico `v0.16.6-custom` sem copiar dados pessoais de produção. Confirmar capacidades da página nativa de Transações da `v0.19.0`.
- Testes automatizados podem usar a estrutura de e2e existente (Playwright ou equivalente encontrado no projeto), sem impor uma dependência nova apenas por conveniência.

## Cenários obrigatórios

| ID | Ação | Evidência verificável | Resultado esperado |
| --- | --- | --- | --- |
| UI-01 | Clicar em fatia selecionável na **Composição** | Modal visível com categoria, período, tipo, status, conta | Dados elegíveis; sem rota nova |
| UI-02 | Clicar em item da **legenda/lista da Composição** | Mesmo contexto de UI-01 | Mesma seleção e modalidade |
| UI-03 | Clicar em categoria da **Tendência por Categoria** | Modal aberto, contexto consistente | Não depender de um clique na pizza |
| UI-04 | Ativar barra observada de receitas/despesas | Datas da barra, série e período observados | Intervalo e tipo corretos |
| UI-05 | Ativar nó de categoria no **Money Map** por clique/Enter/Espaço | Mesmo modal compartilhado | Alvo acessível e contexto correto |
| UI-06 | Ativar “Outros” sintético no Money Map | Seletor de categorias ocultas | Seleção de categoria individual leva ao modal; “Outros” real abre diretamente |
| UI-07 | Abrir modal de **receitas** com privacidade ligada/desligada | Valor ou máscara na linha e no resumo | Crédito verde, número não vaza ao mascarar |
| UI-08 | Abrir modal de **despesas** com privacidade ligada/desligada | Valor ou máscara na linha e no resumo | Débito em vermelho mais intenso nos temas claro e escuro, com sinal correto |
| UI-09 | Renderizar modal com 2+ linhas | Título, contexto, linhas agrupadas, barra de resumo, contagem, CTA | Sem substituição por lista genérica; responsivo |
| UI-10 | Acionar **Ver transações** no modal | URL/rota e DOM da **página nativa**: toolbar, busca, filtros e listagem padrão | Não pode abrir “página de contribuições” simplificada |
| UI-11 | Inspecionar filtros depois de UI-10 | Filtros nativos aplicados (categoria, tipo, contas, status, intervalo, exclusões pertinentes) | Consulta e chips/filtros representam seleção real |
| UI-12 | Recarregar destino / alterar um filtro nativo | Estado após reload, consulta e lista | Persistência quando prevista; alteração muda resultados; não é chip decorativo |
| UI-13 | Selecionar só **Pendente** e conta A no painel, cancelar | Valores antes/depois, URL, panel reopen | Sem alterações: rascunho descartado |
| UI-14 | Aplicar só **Pendente** e conta A | Relatórios, modal, Money Map, filtro ativo | Contas e status coerentes em toda navegação |
| UI-15 | Interseção de contas vazia | Relatório, modal, requisições | Estado vazio; sem ampliação involuntária do escopo |
| UI-16 | Período com fim futuro | Rótulos da janela original e detalhe até hoje | Janela selecionada visível; detalhe sem registros futuros |
| UI-17 | Abrir/fechar filtro por teclado, alterar rascunho e aplicar | Foco, semântica, botões e indicador de filtros | Sem perda de interação nem mudança antes de Aplicar |
| UI-18 | Abrir modal com categoria de alocação parcial | Soma do detalhe e valor gráfico, origem ao navegar | Reconciliação contábil, não só filtro dimensional |

## Comparação visual obrigatória

Capturar na mesma largura e zoom, com **dados de teste**: modal receita, modal despesa, painel de filtros aberto, gráfico com Tendência selecionável, página nativa Transações após CTA e viewport estreito. Verificar:

- Hierarquia do modal: título → contexto → lista delimitada → resumo em superfície própria → contagem e botão.
- Alinhamentos dos valores e status, significado de cores mesmo mascaradas, contraste, separadores e área de rolagem.
- Layout e ancoragem do painel de filtros, checkboxes, agrupamentos e ações; comparar com o painel da versão antiga, **que ainda precisa ser capturado**.
- Presença de todos os controles nativos da página Transações após o CTA.

**Reprovar** quando um teste só comprova dados corretos mas a interação, rota, aplicação dos filtros ou apresentação obrigatória foi substituída por outra experiência.

## Condições de conclusão

- [ ] Matriz de regressão financeira existente aprovada, sem mascarar falhas.
- [ ] UI-01 a UI-18 aprovados ou bloqueios documentados com evidência.
- [ ] Comparação visual desktop e mobile concluída, com capturas anônimas.
- [ ] Auditoria da página nativa confirma seleção dimensional + contexto de relatório quando necessário.
- [ ] Nenhum CSS global ou fluxo de outros relatórios sofreu regressão.
