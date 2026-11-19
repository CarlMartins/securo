# Reimplementar os filtros da tela principal em outra versão do Securo

Use a versão alvo e o cenário de migração indicados pelo usuário. Leia o [contrato financeiro e visual](../features/06-filtros-do-dashboard.md), os [critérios DASH-01 a DASH-07](../tests/aceite-dashboard.md) e as [capturas de referência](../tests/visual/dashboard-capturas/). Use a matriz da versão anterior como apoio para localizar integrações e adaptar a suíte, mantendo o contrato como fonte das regras de negócio.

1. Encontre na versão alvo os pontos que calculam atividade, projeção e saldo, a listagem nativa, o calendário, o filtro de coleção e o layout configurável.
2. Reproduza primeiro a apuração combinada por data e conta. Valide que agregado, detalhes e calendário usam o mesmo escopo de contribuições, incluindo rateios, moedas e deduplicação. Use a data bancária para a série de saldo.
3. Integre os seletores ao cabeçalho e a navegação ao calendário. Valide estado vazio, cancelamento, restauração por URL, foco, privacidade e destino de **Ver transações**.
4. Execute a suíte portátil e as regressões nativas com dados sintéticos. Reproduza os estados visuais, registre compatibilidade e resultados por ID. Preserve as referências históricas e acrescente a nova referência depois da validação.
