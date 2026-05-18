# Ayla — Manual Operacional v2 (fundação)

Tradução estrutural do **Manual Operacional da Ayla** (Karina, 18/05/2026)
em TypeScript: tipos, vocabulário controlado, regras como dado, contratos.

> Esta pasta NÃO contém comportamento ativo. Nenhuma chamada LLM, nenhuma
> escrita em banco, nenhum scheduler rodando. Apenas a arquitetura que define
> COMO a Ayla deve se comportar quando os comportamentos forem implementados.

Convive com a Ayla v1 transacional em `../`. Ver `../README.md` pra contexto.

## Princípio condutor

> A Ayla precisa evoluir para **"especialista acompanhando continuamente
> a criança"**, e NÃO "chatbot que responde perguntas".
>
> Tudo nesta camada serve a esse princípio. Quando houver dúvida sobre uma
> decisão de design, a pergunta é: *isso me move pra acompanhamento
> longitudinal contextual ou pra chat reativo?*

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
| `chips.ts` | §11 (continuidade contextual) | Chips contextuais — sugestões conversacionais por domínio |
| `checkin-templates.ts` | §9, §16 | Templates de check-in proativo natural (não-formulário) |
| `kolo-vivo.ts` | §12, §13 | Consolidação do Kolo Vivo derivada da memória longitudinal |
| `longitudinal.ts` | §13, §14, §19 | Tipos do motor analítico — padrões, mudanças de fase, efeito de estratégias |
| `pattern-language.ts` | §13, §16, §17 | Linguagem observacional pra descrição de padrões |
| `avaliar-padroes.ts` | §13, §14 | Motor real (não-stub) de detecção de padrões — heurísticas determinísticas |
| `strategies.ts` | §20, §21 | Schema de eventos `estrategia_testada` + resumo derivado |
| `bridge.ts` | (integração) | Adapter v1↔v2 — herda regras duras da v1 sem duplicar |

## ETL longitudinal (já em produção)

Em `supabase/migrations/0020_ayla_eventos_etl.sql`: triggers AFTER INSERT
em `ayla_messages`, `diarios` e `check_ins_diarios` populam
`ayla_eventos_longitudinais` automaticamente. Sem LLM, sem alterar v1.

Em `supabase/migrations/0021_ayla_tipos_eventos_extra.sql`: amplia o
CHECK constraint pra incluir os tipos `melhora_relatada`, `regressao_observada`,
`sensibilidade_evidenciada`, `hiperfoco_evidenciado`, `preferencia_revelada`,
`mudanca_fase`.

Backfill histórico: `apps/web/scripts/ayla-eventos-backfill.mjs`.

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
