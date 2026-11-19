---
name: securo-custom-workflow
description: Desenvolver, corrigir, testar, documentar e reimplementar funcionalidades customizadas do Securo em qualquer versão upstream, incluindo migrações para novas releases. Usar quando o trabalho envolver customizações, especificações persistentes, regressão funcional/visual ou atualização upstream do Securo. Não usar para tarefas de infraestrutura sem relação com customizações.
---

# Securo — fluxo permanente de customizações

## Finalidade

Preservar e evoluir customizações do Securo **sem depender de merge/cherry-pick do código antigo**. As especificações e os testes versionados expressam o contrato; o código de versões anteriores é evidência, não implementação obrigatória. Esta skill é **independente de versão**: nunca assuma que `v0.19.0` é a última versão nem que `v0.16.6-custom` é sempre a referência mais recente aceita.

Use esta skill para: **(A) migrar customizações para novo upstream; (B) implementar uma feature customizada nova; (C) corrigir uma customização ou regressão; (D) consolidar documentação/testes da feature**. Identifique o modo pelo pedido do usuário e pelo repositório. Se o usuário pedir *desenvolvimento/implementação*, execute o fluxo completo, não pare após escrever um plano ou testes, salvo bloqueio real.

## Descoberta e fontes de verdade

1. Inspecione a raiz do repositório, `git status`, branches/tags, a versão upstream de destino e os caminhos reais dos arquivos. Procure as especificações pelo conteúdo e nomes, não assuma um prefixo fixo: `00-contrato-interface-customizada.md`, `01-transacoes-pendentes.md` a `05-filtros-por-conta.md`, `tests/cenarios.md`, `tests/aceite-interface-e-navegacao.md`, `compatibilidade-*.md` e outras features adicionadas posteriormente.
2. Leia o contexto de migração da tarefa, caso exista, e o documento de compatibilidade correspondente ao **destino atual**. Não trate uma matriz de uma versão passada como válida para o novo destino. Se não houver contexto explícito de versão, identifique a base pelo Git e os arquivos do projeto; relate ambiguidades que afetem uma operação destrutiva.
3. Regras de negócio: especificações das features + regressões verificadas. UX e integração: `00-contrato-interface-customizada.md` + critérios de UI. Arquitetura, bibliotecas, rotas e componentes nativos: **versão upstream de destino**. Versões históricas e imagens: evidências para interpretar o contrato, não fonte automática de regras financeiras.
4. Prefira a **implementação customizada aceita mais recente** como referência de experiência; mantenha versões anteriores como evidências históricas. Não promova a tentativa incompleta ou reprovada à condição de referência.
5. Se faltar algum documento, registre sua ausência sem inventar seu conteúdo. Não reescreva decisões documentadas com base na memória do agente ou na aparência de screenshots.

## Invariantes — não negociar silenciosamente

- Preservar regras de elegibilidade, valores, sinais, moeda, período, status, contas efetivas, rateios, deduplicação e conciliação entre agregados e detalhe conforme contratos da feature.
- Preservar UI/UX personalizada: Composição, Tendência por Categoria e Money Map abrem o detalhamento conforme seus próprios alvos; modal com hierarquia clara, receitas verdes, despesas vermelhas e máscara de privacidade.
- **Ver transações** navega para a **página nativa de Transações do upstream de destino**, com toolbar, busca, filtros aplicados, chips e ações funcionais. Não criar listagem paralela, modal de tela cheia ou chips apenas decorativos. Quando os filtros dimensionais forem insuficientes, integrar contexto contábil à página nativa.
- Painéis de filtro têm estado rascunho/aplicado, limpar/confirmar/cancelar, acessibilidade e escopo de contas estrito. Escopo explicitamente vazio não significa ausência de filtro.
- Respeitar componentes, tema, layout configurável, rotas, responsividade e comportamento nativo da **versão alvo**, sem copiar estrutura antiga sem avaliação.
- Não modificar regras de negócio/testes para fazer falhas desaparecerem; não ocultar testes com skip sem justificativa.

## Fluxo obrigatório

### 0. Isolar o experimento

- Verifique alterações não commitadas e tente identificar commits separados de documentação, infraestrutura previamente aprovada e tentativas de customização. Preserve tudo: não use `reset --hard`, `clean -fd`, force push, exclusão de branches ou remoção de dados.
- Em migrações/reimplementações limpas, prefira worktree/branch isolado com upstream de destino + infraestrutura explicitamente aprovada + especificações/testes. **Não inclua a implementação antiga nem a tentativa reprovada como base**. Se a documentação estiver apenas em um working tree, peça que seja preservada/commitada ou transporte-a explicitamente, sem perder o original.
- Não executar deploy, alterações no servidor, banco ou serviços externos sem autorização específica. Dados reais ou screenshots sensíveis não entram em fixtures, commits ou logs.

### 1. Auditar sem editar comportamento

- Detecte versão, linguagem, ferramentas, testes, navegação e componentes efetivos da base de destino.
- Crie uma matriz sucinta `requisito → componente/serviço → teste → estado`, com itens funcionais, de navegação, acessibilidade e visuais.
- Identifique diferenças do upstream (API, modelo, rotas, UI, dados) e riscos de compatibilidade. Separe: contrato permanente da feature × adaptação específica da versão.
- Para referência visual ausente, busque o código/tela da última release aceita e explique a lacuna se a comparação não for possível.

### 2. Testar o contrato primeiro

- Execute a regressão existente para levantar baseline. Preserve resultados e condições do teste.
- Acrescente testes apropriados para as alterações, utilizando a infraestrutura de testes existente: unidade, integração, componentes e e2e. Se não for possível automatizar fielmente o aspecto visual, combine testes de interação/DOM com checklist visual e captura sintética.
- Para migrações envolvendo os relatórios, cubra `UI-01` a `UI-18` do arquivo de aceite, além da matriz financeira. Para features novas, crie cenários análogos com identificadores próprios.
- Diferencie falha preexistente, divergência de especificação e regressão introduzida. Não edite critérios para adequá-los ao comportamento errado.

### 3. Implementar até cumprir o contrato

- Use arquitetura e componentes do upstream de destino, preservando as customizações em módulos apropriados.
- Trabalhe em incrementos verificáveis: serviço/seletores → UI/interações → navegação/filtros → acessibilidade/privacidade → comparação visual.
- Uma funcionalidade só está pronta quando comportamento, navegação e apresentação exigida estão corretos; valores corretos, isoladamente, não bastam.
- Não pare após a auditoria ou um plano se o pedido for implementar. Continue de forma autônoma dentro dos limites de segurança; apresente bloqueios apenas quando uma decisão ausente for realmente material.

### 4. Validar e entregar

- Execute os testes disponíveis e informe resultados e comandos. Faça verificação manual da UI quando tiver ambiente/browser acessível, com dados sintéticos. Não declare uma validação visual que não ocorreu.
- Confira rota/página nativa real após CTA, filtros presentes e editáveis, reload quando especificado, estados vazios, máscara de valores, desktop/mobile e regressões em outras telas.
- Registre por critério: `ID | aprovado/falhou/bloqueado | evidência | arquivos modificados` e explique ressalvas. Não considere concluído enquanto critérios mandatórios falharem sem bloqueio explícito.
- Separe documentação/testes de implementação em commits quando possível; **não crie commits automaticamente** a menos que solicitado ou que a convenção existente do projeto autorize.

### 5. Manter a documentação reprodutível

**Ao criar ou alterar uma feature**, no mesmo trabalho:

1. Crie/atualize a especificação: propósito, entradas, regras, exclusões, casos-limite, UI/UX, navegação, acessibilidade, critérios de aceite, exemplos e relações com outras features.
2. Crie/atualize os testes executáveis e a matriz de regressão; documente lacunas não automatizadas sem chamá-las de aprovadas.
3. Registre no documento de compatibilidade **da versão alvo** somente adaptações técnicas, APIs/rotas e decisões ligadas ao upstream. Não incorpore essas peculiaridades como regra permanente sem justificativa.
4. Atualize evidências visuais com dados sintéticos, quando relevantes. Preserve evidência histórica sem publicar dados financeiros pessoais.
5. Depois de uma release customizada validada, marque-a como a **referência aceita mais recente**, mantendo referências anteriores para auditoria. Evite nomenclatura ambígua como “atual” e “novo” sem versões.

## Como interpretar versões futuras

- Para migrar `custom-A → upstream-B`, **B é variável** informada na tarefa ou identificada na branch/tag; a versão técnica válida sempre é B. O último `custom` validado é a referência comportamental primária, enquanto especificações continuam com precedência sobre código antigo.
- Um documento escrito “Na v0.19.0 ...” descreve **aquela versão**, não uma regra universal. Verifique se permanece verdadeiro em B antes de reaproveitar.
- A matriz `compatibilidade-v0.19.0.md` é evidência da migração para 0.19.0; crie uma nova `compatibilidade-vX.Y.Z.md` para o novo destino, sem sobrescrever a anterior.
- A migração não deve exigir que o usuário reescreva regras conhecidas: recupere-as das specs e testes versionados.

## Forma de entrega

Relate de maneira objetiva: base/target detectados, escopo implementado, testes aprovados/falhos/bloqueados, discrepâncias visuais, decisões de compatibilidade, arquivos modificados e instruções para reprodução. Se houver lacuna factual, não a preencha inventando comportamento.
