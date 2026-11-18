# Migração das personalizações do Securo

Implemente as funcionalidades personalizadas documentadas em `custom/` sobre a versão atual do Securo.

## Fontes de verdade

- `custom/features/`: especificações funcionais, regras de negócio e critérios de aceite.
- `custom/tests/`: contratos de comportamento e testes de regressão.
- `custom/`: documentação complementar e matrizes de compatibilidade existentes.
- `custom/prompts/`: procedimentos de migração já estabelecidos.

Leia esses materiais antes de modificar a aplicação.

As especificações funcionais e os critérios de aceite são a referência principal para determinar o comportamento esperado. Os testes devem verificá-los, mas não substituem as especificações.

Os commits históricos podem ser consultados para esclarecer decisões anteriores, mas não devem ser reaplicados automaticamente.

## Processo

1. Analise a arquitetura e as funcionalidades disponíveis na versão atual.
2. Compare o comportamento nativo da aplicação com os requisitos documentados.
3. Identifique quais requisitos já são atendidos e quais precisam ser implementados ou adaptados.
4. Reutilize os recursos e os padrões arquiteturais da versão atual.
5. Implemente os comportamentos ausentes, organizando as mudanças por funcionalidade e respeitando suas dependências.
6. Execute os testes de regressão e os testes existentes afetados.
7. Verifique se a implementação preserva as funcionalidades nativas e não introduz regressões.
8. Atualize a matriz de compatibilidade e registre decisões técnicas, limitações e diferenças relevantes.

## Restrições

- Não solicite novamente regras de negócio que já estejam documentadas.
- Não reproduza automaticamente a implementação antiga.
- Não execute `cherry-pick` dos commits funcionais.
- Não altere regras de negócio apenas para simplificar a implementação.
- Não modifique testes para mascarar comportamentos incorretos.
- Não introduza migrations ou mudanças estruturais desnecessárias.
- Não utilize dados financeiros reais.
- Não altere configurações ou credenciais de produção.
- Não realize commits ou deploy automaticamente.

Se encontrar uma ambiguidade, procure primeiro esclarecê-la pela documentação, testes, código histórico e comportamento da aplicação de referência.

Somente solicite uma decisão quando existir uma contradição ou lacuna relevante que não possa ser resolvida com essas fontes. Registre a questão e continue nas partes independentes.

## Entrega

Ao finalizar, apresente:

- Funcionalidades implementadas e reutilizadas nativamente.
- Arquivos e componentes modificados.
- Resultado dos testes e critérios de aceite.
- Decisões arquiteturais relevantes.
- Comportamentos que não puderam ser validados.
- Pendências que exigem intervenção humana.

O objetivo é reproduzir o comportamento funcional documentado, adaptando a implementação à arquitetura da versão atual, sem depender de instruções manuais adicionais.
