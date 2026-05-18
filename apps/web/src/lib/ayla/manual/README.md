# Ayla — Manual Operacional v2 (fundação)

Tradução estrutural do **Manual Operacional da Ayla** (Karina, 18/05/2026)
em TypeScript: tipos, vocabulário controlado, regras como dado, contratos.

> Esta pasta NÃO contém comportamento ativo. Nenhuma chamada LLM, nenhuma
> escrita em banco, nenhum scheduler rodando. Apenas a arquitetura que define
> COMO a Ayla deve se comportar quando os comportamentos forem implementados.

Convive com a Ayla v1 transacional em `../`. Ver `../README.md` pra contexto.

## Arquivos

| Arquivo | §Manual | Conteúdo |
|---|---|---|
| `types.ts` | §1, §4, §7, §11 | Vocabulário central — modos, intents, domínios, intensidades, canais |
| `modes.ts` | §5, §6 | 5 modos operacionais como dado declarativo (ativadores, fazer/não-fazer, objetivo) |
| `classifier.ts` | §7 | Schema do output do classifier + contrato `classifyMessage()` (stub) |
| `guardrails.ts` | §10, §16, §17, §22 | Regras de linguagem + limites + detector stub |
| `memory.ts` | §12, §13, §14, §15 | Tipos pra eventos / padrões / sugestões longitudinais |
| `proactive.ts` | §9, §10 | Política de silêncio + cadência + tipos de check-in proativo |
| `channels.ts` | §11 | Contrato WhatsApp vs app |

## Filosofia desta camada

**Single source of truth**: o vocabulário (modos, intents, domínios) é
declarado uma vez aqui e usado por toda a arquitetura. Se um lugar da app
precisar saber "quais são os modos da Ayla?", importa `MODES` daqui.

**Manual canônico**: cada arquivo referencia explicitamente as seções do
manual (`// §5.1`, `// §10`). Quando o manual evoluir, o código evolui
correspondentemente — não há fontes paralelas de verdade.

**Stubs explícitos**: funções que vão chamar LLM/banco no futuro são stubs
que lançam `Error("NOT_IMPLEMENTED")` com referência à fase em que serão
implementadas. Isso documenta o contrato sem implementação prematura.

## Princípios codificados aqui

1. **5 modos operacionais** (§5) — não 4, não 6. Vocabulário fechado.
2. **Hierarquia operacional** (§6) — Regular > Interpretar > Orientar >
   Aprofundar > Registrar. Cada modo tem `prioridade_hierarquica`.
3. **Mutação silenciosa do perfil é proibida** (§13) — tipos de memória
   distinguem "evento observado" de "sugestão de atualização" de "padrão
   hipotético".
4. **Saber desaparecer** (§10) — política de proatividade tem regras de
   silêncio como dado, não como conduta emergente.
5. **App não é chat** (§11) — `channels.ts` codifica isso como contrato.

## O que NÃO está aqui (intencionalmente)

- Implementação do classifier (vai usar Haiku 4.5 em fase futura)
- Composer / gerador de resposta (Sonnet 4.7 em fase futura)
- Scheduler de proativas (vai herdar do v1 inicialmente)
- Retrieval na base proprietária Kolo (módulo separado)
- Detector de violações de linguagem (regex + LLM-judge em fase futura)
- UI de revisão de padrões emergentes (vai pra `/kolo-vivo`)
