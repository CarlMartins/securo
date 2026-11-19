# Contrato compartilhado de interface das customizações

## Objetivo e precedência

Estas especificações documentam **características personalizadas** do Securo, que devem ser reproduzidas em novas versões do projeto upstream sem depender da incorporação do código legado por merge/cherry-pick.

**Autoridade das referências, por dimensão:**

1. **Regras de negócio e elegibilidade de dados:** os cinco documentos de feature e a matriz de regressão têm prioridade. Não inferir regras financeiras a partir de uma captura de tela.
2. **Experiência e comportamento das personalizações:** a versão customizada **mais recente aprovada** é a referência prioritária para interações, hierarquia, estados, agrupamentos, cores financeiras e navegação. Na migração inicial para v0.19.0, a referência é v0.16.6-custom; depois da aprovação de versões customizadas posteriores, elas passam a ser as referências primárias. As anteriores permanecem como evidência histórica.
3. **Arquitetura, componentes técnicos, rotas e compatibilidade:** a **versão upstream de destino** tem prioridade para integração e manutenção (v0.19.0 somente na migração atual). Adaptar a experiência aceita à arquitetura nova; não transportar código antigo sem avaliar o novo desenho.
4. **Não regressão do restante do produto:** manter componentes nativos, responsividade, acessibilidade, tema, preferências do usuário e navegação padrão fora da área customizada.

Quando houver conflito entre visual antigo e componentes modernos, registrar a adaptação no relatório final, preservando a intenção do fluxo anterior. Não rebaixar um requisito funcional para satisfazer semelhança visual.

## Invariantes de UI/UX

- Composição (pizza), Tendência por Categoria e nós acionáveis do Money Map abrem a **mesma experiência de modal** para suas categorias selecionáveis.
- O modal é legível e estruturado: **título e contexto → itens delimitados → resumo separado → contagem e ação de navegação**.
- Valores têm semântica de cor consistente: **receitas/créditos verdes; despesas/débitos vermelhos**, inclusive em visualização mascarada, sem expor números indevidamente.
- **Ver transações** deve acessar a **página nativa de Transações**, não uma página isolada que lista as contribuições. Os filtros reais precisam estar visíveis, aplicados e atualizáveis.
- Filtros do relatório têm **rascunho + Aplicar**. Cancelar/fechar não altera seleção aplicada; Limpar restaura padrão do rascunho. Exibir indicador das dimensões efetivamente restritas.
- Nome de conta exibido é o nome contextual usado pelo Securo; não simplificar para o banco se isso prejudicar distinção.
- Suportar teclado, foco, leitura, contraste e tamanhos de tela; respeitar preferências e privacidade. Não alterar CSS global para obter fidelidade local.
- O modal e a página nativa têm de refletir o **mesmo contexto efetivo** e as contribuições elegíveis do agregado. O número da captura é evidência de aparência, **não** dado de teste de negócio.

## Referências visuais disponibilizadas com este pacote

As imagens anexadas estão em `../referencias-locais/`, **ignoradas pelo Git** por conterem elementos de informação financeira pessoal, apesar da máscara. São referências visuais, não fixtures de teste. Para commits públicos, substituir por **capturas sintéticas/anônimas**.

| Captura | Conteúdo | Interpretação |
| --- | --- | --- |
| `atual-modal.png` | Modal da v0.16.6-custom | Referência de hierarquia, cores, agrupamento e botão |
| `novo-modal.png` | Modal da primeira tentativa sobre v0.19.0 | Contraexemplo visual a corrigir |
| `atual-transacoes.png` | Página nativa de Transações com filtros | Referência obrigatória do destino de navegação |
| `novo-pagina-paralela.png` | Página de contribuições criada na tentativa | Contraexemplo de navegação, não é destino aceitável |
| `novo-filtros.png` | Filtro da primeira tentativa | Estado observado; **não** é a referência visual desejada |

**Lacuna conhecida:** este conjunto não inclui uma captura suficientemente completa do **painel de filtros antigo**. Capturar o componente original ou inspecioná-lo no Git da v0.16.6-custom antes de avaliar fidelidade estética do painel.

## Verificação

- Executar os [testes de interação, navegação e visual](../tests/aceite-interface-e-navegacao.md), além dos testes financeiros da matriz já existente no projeto.
- Realizar comparações lado a lado em uma resolução desktop equivalente e outra mobile. Não usar snapshots cegos: validar **DOM/rota/filtros/dados** junto à semelhança visual.
- Documentar as divergências intencionais entre a **referência customizada aprovada** e o **upstream de destino**, com justificativa, sem esconder comportamento faltante sob rótulos como “funcional”.

## Aplicação em versões futuras

Este contrato é **permanente** e não se limita à v0.19.0. Em cada nova atualização, a skill `securo-custom-workflow` deve identificar a nova base upstream, consultar as especificações e seus testes, criar a matriz de compatibilidade própria da versão de destino e implementar a experiência customizada aceita com os componentes nativos novos.

As menções específicas a `v0.16.6-custom` e `v0.19.0` nos documentos antigos identificam **evidência histórica** ou **comportamento técnico daquela versão**; não significam que toda migração futura deva partir da v0.16.6 nem que a arquitetura da v0.19.0 prevaleça sobre versões mais novas. Decisões específicas da versão de destino devem ficar na respectiva matriz `compatibilidade-vX.Y.Z.md`, quando possível, para não contaminar contratos de negócio permanentes.

O prompt `prompts/reimplementacao-limpa.md` foi escrito para o experimento da v0.19.0. Novos trabalhos devem preferir invocar a skill permanente em vez de reutilizar literalmente esse prompt histórico.
