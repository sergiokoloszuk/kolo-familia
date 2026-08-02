# `comportamento_e_limites` — desativada em 02/08/2026

**Estado:** executado em produção. `ativo` passou de `true` para `false`.
Nada foi apagado. A linha continua na tabela.

---

## Por que

A decisão de desativar é de **2026-05-17** (devolutiva da Karina), registrada em
`docs/cowork-frente-1-skills.md`:

> `comportamento_e_limites` foi **desativada** (cobertura pulverizada nas outras)

E, na mesma página, como se já tivesse acontecido:

> Obs: `comportamento_e_limites` continua na tabela como `ativo=false` por
> compatibilidade histórica. **Não reescrever**.

**O documento afirmava um fato que não era verdade.** O lote de 2026-05-23 que
aplicou os renames do mesmo pacote (`regulacao_emocional`→`emocional`,
`transicoes`→`rotina` — esses sim aplicados) **não aplicou a desativação**.
Nenhuma migração toca a linha. A decisão foi tomada, documentada como feita, e
nunca executada. Descoberto em 02/08/2026, ao alinhar o vocabulário de temas.

## O que ela fazia enquanto esteve ativa

Chegava a três fluxos — conversa da web, os 7 botões de apoio e o **gerador de
Plano** — via `loadActiveSkills` (`lib/ia/router.ts`). Nunca chegou ao WhatsApp,
que não carrega skill nenhuma.

**27 de 239 turnos analisados (11%)** rotearam para ela; o mais recente em
31/07/2026. Não era linha morta.

O escopo dela incluía **"reforço positivo"** — e o PISO do núcleo proíbe
explicitamente essa lógica ("isso é reforço estilo ABA, não é o método Kolo").
Era instrução de skill competindo com instrução de núcleo dentro do mesmo system
prompt: a assinatura exata da causa raiz investigada durante todo este ciclo.

## Impacto verificado ANTES de escrever

| Verificação | Resultado |
|---|---|
| Boas Práticas que citam a skill | **1** de 371 |
| …dessa 1, tem outra skill? | sim, `comunicacao` |
| …tem tags? | sim, 3 (`limite`, `acolhimento`, `frase_pronta`) |
| **Órfãs** | **0** — o filtro de BP é `skills OU tags` |
| Fallback do roteador | sem risco: `routeSkills` sempre devolve do pool ativo |
| Território descoberto | nenhum: `emocional` cobre o escopo, com os mesmos `kolo_vivo_fields` |

## Verificação DEPOIS

- `ativo = false`, `updated_at = 2026-08-02T17:00:46Z`
- **1 linha afetada**; 13 das 14 mantêm o `updated_at` original de 2026-05-23
- skills ativas: 7 → **6**
- `boas_praticas`: 371 → **371**

---

## SQL

### Leitura (rodar antes de qualquer coisa)

```sql
SELECT id, name, ativo, routing_priority, updated_at
FROM public.specialist_prompt_templates
WHERE name = 'comportamento_e_limites';

SELECT id, titulo, skills_relacionadas, tags
FROM public.boas_praticas
WHERE skills_relacionadas ? 'comportamento_e_limites';
```

### O que foi executado

```sql
UPDATE public.specialist_prompt_templates
SET ativo = false, updated_at = now()
WHERE name = 'comportamento_e_limites' AND ativo = true;
```

### ROLLBACK

Restaura o estado exato de antes (`ativo=true`, `routing_priority=70`):

```sql
UPDATE public.specialist_prompt_templates
SET ativo = true, routing_priority = 70, updated_at = now()
WHERE name = 'comportamento_e_limites';
```

Nada foi apagado, então o rollback é completo — só o `updated_at` não volta ao
valor original (`2026-05-23T15:08:06.126888Z`), o que não afeta comportamento.

---

## Nota para quem mexer nisso depois

Não há migração para esta mudança, de propósito: `specialist_prompt_templates` é
conteúdo editável pelo Admin, não schema. Uma migração que forçasse `ativo=false`
brigaria com a tela de Admin na próxima vez que alguém reativasse a skill de
verdade. Se um dia o conteúdo dela for reescrito e o tema voltar a fazer sentido
como skill própria, reative pelo Admin — e atualize
`docs/cowork-frente-1-skills.md`, que hoje diz "não reescrever".
