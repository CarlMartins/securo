# Aceite do painel com período e contas

Base funcional [06 — Filtros do dashboard](../features/06-filtros-do-dashboard.md). Use espaço, contas e transações fictícias. Reavalie estes cenários na versão de destino, com os componentes que ela oferece.

| ID | Exercício | Resultado esperado | Cobertura |
| --- | --- | --- | --- |
| DASH-01 | Aplicar um dia, um intervalo entre meses/anos e uma data final futura. Testar datas invertidas ou incompletas. | Recorte inclusivo e visível na URL. Apuração até hoje pelo fuso do espaço. Datas inválidas são rejeitadas. | API personalizada e teste da página |
| DASH-02 | Criar pendência de 30, lançamento de 70 e pendência equivalente ao lançamento em outro dia do mesmo período. Adicionar lançamento de 50 com data de referência ajustada. | Despesas totalizam 150. O destaque informa 30. Distribuição, modal e Transações reconciliam o mesmo valor e IDs. | API personalizada e teste da página |
| DASH-03 | Usar coleção A+B. Selecionar B+C, depois somente C. Limpar e aplicar. Fechar o painel após editar um rascunho. | Primeiro escopo B, depois estado vazio e por fim escopo A+B. Fechar sem aplicar conserva a consulta anterior. Contas homônimas são distinguíveis. | Teste da página, regressão do painel compartilhado e captura de contas |
| DASH-04 | Comparar a variação de um intervalo entre meses com o anterior de mesma duração. Mover um lançamento entre datas contábeis e deixar outro pendente. | Mesmo número de dias e datas corretas na legenda. Curva varia pela data bancária do lançamento efetivado. Dias futuros ficam sem valores observados. | API personalizada e captura do período |
| DASH-05 | Abrir o calendário de um intervalo entre meses. Avançar ao fim e tentar passar dos limites. | Consulta usa apenas o mês visível e mantém as datas aplicadas. Dias fora do mês, intervalo ou no futuro aparecem sem valores. Pendente elegível mantém o marcador. | API personalizada, teste da página e captura do calendário |
| DASH-06 | Abrir despesa ou categoria por teclado. Fechar e conferir o foco. Reabrir em tela estreita, tema escuro e privacidade ativa. Usar **Ver transações**. | Foco retorna ao acionador. Modal permanece legível, com valores mascarados. O destino é a página nativa e mantém contas e datas. | Teste da página, regressão de relatórios e captura móvel |
| DASH-07 | Reabrir a visão mensal e acionar navegação mensal e comparações de saldo. Alternar widgets no layout. | O modo mensal mantém navegação, projeções e layout configurável. Previsões adicionais não repetem pendências observadas. | Regressões do painel e teste de API |

| DASH-08 | Aplicar 12/11–12/12, sair do painel e voltar. Acionar a seta anterior. | Retorna com as datas selecionadas e desloca para 12/10–12/11. | Teste da página |
| DASH-09 | Selecionar uma conta e usar 30/03–03/04. Definir limites de 310 em março e 600 em abril. Registrar gasto de 40 na conta. | Limite integral de março de 310 e consumo de 13% para os 40 gastos no intervalo inteiro. | Teste do widget de gastos |

## Evidência visual

- [Período e gráfico de saldo no desktop](visual/dashboard-capturas/desktop-periodo.png)
- [Popover de contas no desktop](visual/dashboard-capturas/desktop-contas.png)
- [Calendário com dias desabilitados](visual/dashboard-capturas/desktop-calendario.png)
- [Detalhamento em tela estreita com privacidade ativa](visual/dashboard-capturas/mobile-detalhe-privado.png)

O [gerador do Firefox](visual/README.md#painel-com-período-e-contas) abre a página real e injeta respostas HTTP sintéticas. Verifique o recorte no cabeçalho, a linha de pendentes abaixo do total e a legenda do intervalo anterior. No painel de contas, confirme rótulos completos, separação entre contas homônimas, foco no acionador e ações visíveis. No calendário, compare os dias que exibem valores e os desabilitados. No modal móvel, confirme moeda mascarada, cores semânticas, status legível e acesso à página nativa.

Capturas versionadas ficam em [capturas do painel](visual/dashboard-capturas/). O fixture representa o intervalo 28/09–04/10/2026 com observações até 02/10, despesa de 1.250 e pendência de 300.

## Registro de validação na v0.19.0

- O frontend aprovou 167 testes nas seis suítes selecionadas, além da checagem de tipos.
- A suíte portátil de API aprovou 8 cenários, incluindo valores reconciliados, paginação, datas de referência, projeções e exclusão de pendências da curva de saldo.
- A conferência no Firefox aprovou os quatro estados sintéticos acima. O viewport estreito mediu 500 × 758 px. Os casos visuais cobrem o painel e o modal com respostas controladas. A navegação e a integridade dos dados são exercitadas também pelas suítes automatizadas.
- No backend, 258 regressões passaram na rodada ampla. O teste `test_spending_and_trend_keep_closed_account_history` falhou com `no such function: to_char` no SQLite. A mesma falha foi reproduzida isoladamente na árvore base `d8dfe6c8`. A rodada final das suítes de API do painel e serviço de calendário aprovou 37 casos.
- Na revisão dos widgets e da persistência, a checagem de tipos e os 69 testes do painel e dos widgets passaram.
