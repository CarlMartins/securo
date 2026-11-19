# Prompt para o agente — reimplementação reprodutível sobre v0.19.0

Você está trabalhando na atualização das **customizações do Securo** de `v0.16.6-custom` para a base upstream `v0.19.0`. **Não use esta primeira tentativa como fonte de regras**. Seu objetivo é implementar do zero **com base nas especificações persistentes** e fazer a implementação passar nos testes existentes e nos cenários de UI. Não solicite que o usuário repita regras já documentadas.

## Fontes de verdade, em ordem

1. `features/00-contrato-interface-customizada.md` e os cinco arquivos `features/01-transacoes-pendentes.md`, `features/02-detalhamento-receitas-despesas.md`, `features/03-detalhamento-money-map.md`, `features/04-periodos-personalizados.md` e `features/05-filtros-por-conta.md` (ajuste apenas os caminhos ao diretório real do repositório).
2. Testes e matriz de regressão já existentes em `tests/cenarios.md` (se disponíveis no repositório), e `tests/aceite-interface-e-navegacao.md` deste pacote.
3. Capturas em `referencias-locais/` (somente aparência, não valores) e, especialmente para o filtro antigo não capturado, o componente no histórico `v0.16.6-custom`.
4. Código da `v0.19.0` como arquitetura, rotas, componentes e integração de destino.

**Não substituir** a página nativa de Transações por uma nova tela de contribuições. **Não limitar** o detalhamento clicável à Composição: Tendência por Categoria e Money Map possuem critérios específicos. **Não trocar** cores de valores financeiros por texto neutro. **Não usar** a visualização da primeira tentativa como referência positiva.

## Etapa A — Auditoria sem alterar código

- Inspecione `git status`, identifique a base upstream e a versão antiga disponível; não remova trabalho existente. Reporte os hashes e branches encontrados.
- Identifique a rota e os componentes da **página nativa de Transações**. Descubra o contrato real dos filtros existentes e como chips, URL, busca e tabela são sincronizados.
- Mapeie os componentes de Composição, Tendência por Categoria, barras, Money Map e painel de filtros. Encontre o componente antigo do filtro em `v0.16.6-custom` para estabelecer referência visual faltante.
- Identifique o código atual de detalhes, o contexto contábil e a diferença entre as contribuições elegíveis do relatório e os registros gerais de Transações.
- Produza uma tabela de correspondência **requisito → componente/arquivo → teste**. Marque lacunas reais; não invente detalhes ausentes.

## Etapa B — Testes antes da implementação

- Execute os testes de regressão já existentes e registre a linha de base sem alterá-los para facilitar o resultado.
- Crie/amplie e2e e testes de componentes para UI-01 a UI-18; no mínimo, **um teste explícito de clique em Tendência**, **um teste da rota/página nativa ao clicar Ver transações**, **um teste de cores de receitas e despesas com máscara**, **um teste de confirmação/cancelamento de filtros** e **um teste de reconciliação**.
- Falhas iniciais por funcionalidades ausentes são esperadas. Não altere cenários de teste para encobrir deficiência de implementação.

## Etapa C — Implementar por contratos, na arquitetura nova

- Implementar serviços e seletores financeiros conforme as cinco features, preservando decisões históricas e separação entre observado/projetado.
- Reutilizar o **modal de detalhamento compartilhado** nas origens apropriadas; promover alvos acessíveis em Composição/Tendência/Money Map.
- Aplicar **hierarquia visual do modal antigo** com cores semânticas para valores, inclusive mascarados; manter componente nativo de privacidade.
- Integrar **Ver transações** à rota, estado, filtros e apresentação da **página nativa**. Quando filtros dimensionais não reproduzirem contribuições contábeis, evoluir o contexto da página nativa; não criar lista concorrente.
- Aplicar painel de filtros com estado rascunho/aplicado, indicação de dimensões ativas e aparência próxima do componente antigo. Preservar CSS restrito e tema da base nova.

## Etapa D — Provas e entrega

- Rodar testes de unidade, integração e e2e que existirem, além das verificações financeiras da migração.
- Executar as ações manualmente em navegador quando ambiente disponível; comparar lado a lado capturas atual/novo em desktop e tela estreita, com dados **sintéticos**.
- Confirmar que filtros permanecem visíveis e operantes na página nativa de Transações depois do CTA; verificar também o recarregamento.
- Reportar em tabela: **ID do critério, status, teste, evidência, arquivo alterado**. Informar divergências entre interface antiga e nova, incluindo quaisquer lacunas não resolvidas. Não declarar conclusão se os critérios de UI-01 a UI-18 ainda falharem.

## Limites de escopo e segurança operacional

- Não utilizar `git reset --hard`, `git clean -fd`, apagar branches ou descartar implementação anterior sem instrução explícita e confirmação de backup/versionamento. Preferir **worktree separado** para a tentativa limpa.
- Não copiar screenshots sensíveis para commits, issues ou logs públicos. Referências locais podem estar no `.gitignore`.
- Evitar importar commits de lógica da v0.16.6-custom; consultar o código antigo **somente para observar a intenção de UI e as regras documentadas**, salvo decisão técnica explícita registrada.
- Não modificar as features nem as regras financeiras silenciosamente ao encontrar conflito: documentar a dúvida e sua implicação, implementar apenas decisões suportadas por evidência.
