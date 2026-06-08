# Plano de implementação — Estratégias, Planos e Ayla

> Documento de design + plano de fases. Decidido em conversa (jun/2026).
> Nada aqui foi implementado ainda — é o mapa pra aprovar e priorizar.

## 1. Visão
A mãe traz um desafio (ou uma crise) na Estratégias/WhatsApp. A Kolo entende a
**intenção** e: ou acolhe e investiga (crise), ou monta um **plano completo
personalizado** numa única geração. Planos ficam salvos e imprimíveis. A Ayla
costura WhatsApp↔app, oferece plano de fim de semana na sexta, e **aprende o que
funciona** com cada criança pra melhorar os próximos.

## 2. Princípios (decisões tomadas)
- **A Kolo propõe, a mãe escolhe** (plano? agora ou observar? fim de semana?).
- **Menos chamadas > modelo mais barato** — 1 plano coeso em vez de 8 respostas
  repetidas; mantém Sonnet (qualidade).
- **Crise ≠ desafio** — crise acolhe e investiga; desafio vira plano.
- **WhatsApp = o momento; app = a profundidade** — costurados pela Ayla.
- **A Kolo aprende o que funciona** com a criança (ciclo de feedback).

## 3. O que já existe (reusa, não recria)
| Peça | Onde | Uso |
|---|---|---|
| Engine de IA (skills, contexto, cache, streaming) | `lib/ia/engine.ts`, `context.ts`, `prompt.ts`, `router.ts` | Base do plano + roteamento |
| Modelos Sonnet/Haiku | `lib/ia/anthropic.ts` | Plano=Sonnet; classificador=Haiku |
| Output types (os 7 botões) | `output_types` + `/apoio/[key]` | Viram seções/visões do plano |
| Ayla proativa + regras | `orchestrator.ts`, `rules.ts` (já tem "já conversamos hoje", janela, limites) | Gatilhos sexta + follow-up |
| Voz/responder + parser | `responder.ts`, `parser.ts` | Crise, gostinho, intenção |
| Relatórios / impressão | `relatorios_gerados`, render | Imprimir/baixar plano |
| Kolo Vivo (domínios, `estrategias_ativas`, `marcos`) | `kolo-vivo/*`, `categorias_extras` | Personalização + guardar "o que funciona" |
| Billing | `api_calls` + `/admin/uso-api` | Medir custo por família |

## 4. O que construir (por capacidade)
- **A. Plano completo (1 chamada, por seções):** Entender · Crenças (3 da criança
  + 3 da responsável, hipótese gentil + reenquadro) · Brincadeiras · Atividades ·
  O que fazer diferente · Frases prontas · Rotina · O que observar. A Kolo escolhe
  quais seções entram. Botões viram **visões** dessas seções (0 chamada extra).
- **B. Roteador de intenção + gate de completude:** crise · desafio · dúvida ·
  desabafo. Desafio → "tenho contexto? senão 1 pergunta" → oferece plano.
- **C. Modo crise:** acolher → a mãe escolhe (entender agora / observar) →
  investiga com "suspeitos" do Kolo Vivo → padrão → oferece plano. Limite de risco.
- **D. Meus Planos:** salvar + listar + item de menu condicional + imprimir.
- **E. Ponte WhatsApp↔app:** gostinho (1-2 ideias) + magic-link pro plano logado.
- **F. Ciclo de aprendizado:** Ayla pergunta o que funcionou → guarda por
  estratégia → próximos planos priorizam → Evolução mostra.
- **G. Plano de fim de semana (sexta):** proativa → programação + objetivo →
  plano flexível tecido na rotina real → app/imprimir/Meus Planos → follow-up.
- **Transversal (custo):** `cache_control` no bloco de contexto; afinar thinking.

## 5. Fases (valor primeiro, sem quebrar o que está no ar)
| Fase | Entrega | Tam. |
|---|---|---|
| 0 — Custo | Cache do contexto + afinar thinking | S |
| **1 — Plano + Meus Planos** ⭐ | 1 plano coeso, seções, imprimir, salvar; botões viram visões | L |
| 2 — Intenção + Crise | Diferenciar crise/desafio; crise acolhe + a mãe escolhe | M-L |
| 3 — Ponte WhatsApp | Gostinho + magic-link pro plano | M |
| 4 — Aprendizado | Ayla pergunta o que funcionou; planos melhoram | M |
| 5 — Fim de semana | Sexta: plano do fim de semana | S-M |

## 6. Decisões em aberto
1. Salvar plano: tabela `planos` nova (recomendado) vs reusar `relatorios_gerados`.
2. Magic-link: token de uso único (Supabase) abrindo no plano — Fase 3.
3. Meus Planos: 6º item de menu condicional (recomendado) vs seção em Estratégias.
4. Gostinho: 2 ideias no WhatsApp (combinado).

## 7. Custo
- Maior economia: 1 plano em vez de 8 botões + cache de contexto. Mantém Sonnet.
- Crise é barata (conversa curta); plano é a chamada "cara" → por isso a confirmação antes.
- Medir no `/admin/uso-api`.

---

# Fase 1 — detalhamento (Plano completo + Meus Planos)

**Objetivo:** substituir os 7 botões (cada um uma chamada, repetitivos) por **um
plano coeso** gerado numa chamada; salvar; ver; imprimir; listar em "Meus Planos".

## 1.1 Schema — tabela `planos` (migração nova → aplicar no prod)
```sql
create table if not exists public.planos (
  id uuid primary key default gen_random_uuid(),
  family_account_id uuid not null references public.family_accounts(id) on delete cascade,
  membro_atipico_id uuid references public.membros_atipicos(id) on delete set null,
  conversa_id uuid references public.conversas(id) on delete set null,
  titulo text not null,
  tema text,
  -- secoes: [{ tipo, titulo, conteudo_markdown }]
  secoes jsonb not null default '[]'::jsonb,
  origem text not null default 'estrategias', -- estrategias | fim_de_semana
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists planos_family_idx on public.planos(family_account_id, created_at desc);
-- RLS: família dona lê/escreve (espelhar policies das outras tabelas)
-- trigger set_updated_at
```
`tipo` da seção ∈ `entender | crencas | brincadeiras | atividades | diferente | frases | rotina | observar`.

## 1.2 Geração — `lib/ia/plano.ts`
- `gerarPlano({ supabase, familyId, membroId, desafio })`:
  1. `buildContext(...)` (reusa: Kolo Vivo + perfil + boas práticas).
  2. Monta prompt do plano (voz Kolo + estrutura por seções + crenças 3+3 gentis
     + "escolha só as seções relevantes ao desafio").
  3. **1 chamada Sonnet** com `cache_control` no contexto, **saída estruturada**
     (JSON via schema/tool: `{ secoes: [{ tipo, titulo, conteudo_markdown }] }`) →
     parsing confiável.
  4. Persiste em `planos` e devolve o `id`.
- Streaming por seção: **fica pro fim da fase** (primeiro ship não-streaming; a
  geração roda e redireciona pro plano pronto).

## 1.3 UI
- **Gerar:** na conversa da Estratégias, CTA **"Montar plano completo sobre isso"**
  (em `ConversaAcoes`) → chama `gerarPlano` → redireciona pra `/planos/[id]`.
  (No fase 1 é botão explícito; o roteador de intenção é a Fase 2.)
- **Ver:** `/planos/[id]` — renderiza as seções; uma barra de filtro/abas
  ("Tudo · Brincadeiras · Frases · …") = os antigos 7 botões, agora **filtram**
  as seções (0 geração). Botão **Imprimir/Baixar**.
- **Listar:** `/planos` — lista (título, criança, data).
- **Menu:** item **"Meus Planos" condicional** (passar `planosCount` pro
  `Sidebar`, como já é feito com `sugestoesPendentes`; renderiza se > 0).

## 1.4 Botões → visões (sem quebrar)
- Hoje `/apoio/[key]` + `ConversaAcoes` **geram** cada output type (chamadas
  separadas). Na Fase 1, no contexto do plano eles viram **abas que filtram** as
  seções. O `/apoio/[key]` legado continua respondendo até ser aposentado.

## 1.5 Impressão
- Primeiro: **print do navegador** (CSS `@media print`) numa view limpa
  (espelhando o HTML autocontido da Kolo Escola). PDF no servidor fica pra depois.

## 1.6 Ordem de execução
1. Migração `planos` (+ RLS + trigger) → aplicar no prod.
2. `lib/ia/plano.ts` (gerarPlano não-streaming + persistência).
3. `/planos/[id]` (render seções + abas/filtro + print CSS).
4. CTA "Montar plano" na conversa → gera → redireciona.
5. `/planos` + item de menu condicional.
6. Streaming por seção.

## 1.7 Riscos / não quebra
- Migração no prod precisa ser aplicada (fluxo Easypanel/sessão dedicada).
- Fluxo dos 7 botões continua até a troca; o plano entra ao lado e depois aposenta.
- Custo: 1 chamada Sonnet por plano (vs até 7) + contexto em cache.

## 1.8 Decisões da Fase 1 a confirmar
- Saída estruturada **JSON via schema** (recomendado) vs markdown com delimitador.
- Impressão **navegador primeiro** (recomendado) vs PDF no servidor.
- Gatilho na Fase 1 = **botão "Montar plano"** (roteador automático é Fase 2).
