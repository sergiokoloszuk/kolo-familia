# Kolo Família

Estratégia personalizada para o dia a dia da família atípica, com mais clareza e leveza, em qualquer hora do dia — porque a orientação para a inclusão acontece onde a família já está: no WhatsApp.

## Documentação

- **PRD do produto pleno:** [docs/PRD_Kolo_Familia_v3.1.md](docs/PRD_Kolo_Familia_v3.1.md) — visão, escopo, requisitos por área, especificação da Ayla, arquitetura.
- **Roadmap de implantação:** [docs/Roadmap_Implantacao_v2.md](docs/Roadmap_Implantacao_v2.md) — sequência das 15 fases, sem datas. Não pular fases.
- **Explicação das funcionalidades:** [docs/Explicacao_Funcionalidades.md](docs/Explicacao_Funcionalidades.md) — companion não-técnico.

## Stack

- **Frontend / PWA:** Next.js 16 (App Router) + TypeScript + Tailwind v4 + shadcn/ui
- **Backend / API:** API Routes do Next.js
- **Auth + DB + Storage:** Supabase
- **IA:** Anthropic (Claude Sonnet 4.6 / Haiku 4.5)
- **Pagamento:** Stripe
- **WhatsApp:** Z-API (com plano de migração para Cloud API)
- **Orquestração:** n8n (self-hosted)
- **Áudio:** ElevenLabs · **Imagem:** OpenAI/Replicate
- **Hospedagem:** VPS Hostinger + CapRover/Coolify
- **Observabilidade:** Sentry + PostHog

## Estrutura do monorepo

```
.
├── apps/
│   └── web/                  # Next.js 16 (App Router)
├── packages/
│   └── shared/               # Tipos e schemas Zod compartilhados
├── supabase/
│   └── migrations/           # SQL versionado
├── n8n/
│   └── workflows/            # Workflows versionados em JSON
└── docs/
    ├── PRD_Kolo_Familia_v3.1.md
    ├── Roadmap_Implantacao_v2.md
    └── Explicacao_Funcionalidades.md
```

## Como rodar local

```bash
# 1. Instalar dependências (na raiz)
npm install

# 2. Copiar variáveis de ambiente
cp .env.example apps/web/.env.local
# Preencher conforme a fase atual do roadmap.

# 3. Subir o app
npm run dev
```

App em `http://localhost:3000`.

## Status atual

**Fase 1 — Setup do ambiente** concluída:
- Next.js 16 + Tailwind v4 + shadcn/ui scaffolded
- Monorepo workspaces (`apps/web`, `packages/shared`)
- Dependências base instaladas

**Fase 2 — Banco e Autenticação** em andamento:
- Migrações SQL escritas em [supabase/migrations/](supabase/migrations/) (4 arquivos)
- `lib/supabase/{client,server,proxy}.ts` wired
- `proxy.ts` (Next 16) refresca sessão antes de cada SSR
- Supabase self-hosted no Easypanel (`api-supabase.4oydba.easypanel.host`)
- Auth UI: login (e-mail/senha + Google), signup, callback OAuth, logout
- Aguardando: aplicar migrações via Studio + Google OAuth setup

**Fase 3 — Páginas core** concluída (UI):
- Onboarding wizard 6 telas com state machine ([apps/web/src/app/onboarding/](apps/web/src/app/onboarding/))
- Route group `(app)/` com layout compartilhado (nav: Painel | Conversar | Kolo Vivo)
- `/painel` cheio: 3 cards topo + sugestões count + Ayla diz placeholder + banner trial/past_due/paused
- `/kolo-vivo`: abas por membro + família + sugestões. Editor por seção. Server actions pra salvar e aprovar/rejeitar sugestão.

**Fase 4 — SpecialistPromptEngine + skills** ✅ código pronto:
- [lib/ia/engine.ts](apps/web/src/lib/ia/engine.ts) orquestra router → context → prompt → Claude (streaming + adaptive thinking) → validators
- Modo conversa (template 7 partes) e modo output_type (formato dos botões de apoio)
- `/conversar` + `/conversar/[id]` UI

**Fase 5 — Aulas, Trilhas, Botões de apoio, Aprender** ✅ código pronto:
- `respondAsOutputType()` no engine + `/apoio` (7 tipos) com form e resposta in-place
- Admin: bootstrap em `/admin/setup` (primeiro usuário vira admin), nav próprio
- `/admin/aulas`: CRUD com transição de status (rascunho/ativo/arquivado)
- `/admin/trilhas`: CRUD com lista de aulas vinculadas
- `/admin/boas-praticas`: lista filtrada por status, edit/aprovar/arquivar com versionamento
- **Extração automática de Boas Práticas:** ao publicar aula (status→ativo), `lib/ia/extract-boas-praticas.ts` processa a transcrição via Claude Sonnet, extrai até 10 candidatas estruturadas (titulo, texto_original, skills_relacionadas, tags, nivel) e insere com status=rascunho/origem=aula
- `/aprender` user-facing: trilhas em destaque + aulas avulsas, player de iframe, transcrição lateral, navegação dentro da trilha

**Pendente para testar Fases 4 e 5:** `ANTHROPIC_API_KEY` no `.env.local`; aplicar migrações 0001-0004 no Studio. Após login, visite `/admin/setup` pra virar admin.

**Fase 6 — Pagamento Stripe** ✅ código pronto:
- `lib/stripe/client.ts` singleton com lazy init e helper de price IDs
- `/api/stripe/checkout` cria session com `client_reference_id` + metadata
- `/api/stripe/portal` Customer Portal
- `/api/stripe/webhook` verifica assinatura, trata `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_{succeeded,failed}`. Atualiza `subscription_accesses` via service role e audita em `assinaturas`.
- `/assinatura` page com estado atual + CTAs (Assinar mensal/anual, Gerenciar)
- `lib/auth/require-active-write.ts` bloqueia escrita em paused/canceled (aplicado em `enviarMensagem` como PoC; resto na próxima sessão)
- Painel banner virou acionável (link pra `/assinatura`)
- Nav: "Assinatura" como último item

**Pendente para testar Fase 6:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_MENSAL`, `STRIPE_PRICE_ID_ANUAL` no `.env.local`. Em dev local, usar `stripe listen --forward-to localhost:3000/api/stripe/webhook` pra capturar webhooks.

**Fase 7 — Ayla v1** ✅ código pronto (DASS-21 fica pra Fase 8; TTS pra Fase 9):
- `lib/ayla/` totalmente isolada de `lib/ia/` (PRD §12.3 — fronteira rígida; comunicação só via banco; Anthropic client próprio)
- `whatsappSender.ts` — Z-API REST + parser de webhook (Z-API/n8n)
- `messageTemplates.ts` — rotina, engajamento 2d/5d, clarificações, comandos, **trial D-3/D-0**, **emocional streak**, **insight**. Variações round-robin
- `rules.ts` — não-colisão completa
- `parser.ts` — Haiku parser com schema Zod, detector de comandos
- `orchestrator.ts` — `sendRotinaDiaria()`, `sendEngajamento()`, **`sendTrial()`**, **`sendEmocionalStreak()`**, **`sendProximoInsight()`**, `processInbound()`
- **`insightEngine.ts`** — detecta exaustão da mãe, queda emocional sustentada do membro, queda de energia. Persiste em `ayla_insights` com idempotência 7d
- **`metrics.ts`** — 9 KPIs do PRD §12.11 (taxa de resposta, tempo mediano, streak médio, famílias ativas, conversões, taxa de pausa)
- `/api/ayla/webhook` — recebe Z-API/n8n com `x-ayla-secret`
- `/api/ayla/cron?tipo=rotina|inatividade|comercial|emocional|insights` — protegido por `CRON_SECRET` Bearer
- **`/admin/ayla`** — dashboard de KPIs com últimos envios e insights detectados
- **`/configuracoes`** — toggle Ayla, horário/frequência, opt-in granular por categoria de campanha (informacional/promocional/avaliacao)

**Pendente para testar Fase 7:** `ZAPI_INSTANCE_ID`, `ZAPI_TOKEN`, `ZAPI_CLIENT_TOKEN`, `AYLA_WEBHOOK_SECRET`, `CRON_SECRET` no `.env.local`. Configurar n8n: webhook Z-API → `https://app/api/ayla/webhook` com header `x-ayla-secret`. Cron externo chamando `POST /api/ayla/cron?tipo=...`:
- `rotina` a cada 30min
- `inatividade` 1×/dia (manhã)
- `comercial` 1×/dia (manhã)
- `emocional` 1×/dia (noite)
- `insights` 1×/semana

## Aplicar migrações no Supabase self-hosted

O Supabase está hospedado em Easypanel — porta `5432` não exposta externamente,
então o caminho é colar SQL no **Studio**:

1. Abrir https://painel.4oydba.easypanel.host/ → SQL Editor
2. Em ordem, colar e executar o conteúdo de:
   1. [supabase/migrations/0001_init.sql](supabase/migrations/0001_init.sql) — tabelas, índices, helpers
   2. [supabase/migrations/0002_rls.sql](supabase/migrations/0002_rls.sql) — RLS + políticas
   3. [supabase/migrations/0003_seed.sql](supabase/migrations/0003_seed.sql) — output_types, skills iniciais, boas_praticas exemplares
3. Verificar: tabelas em `public.*`, RLS habilitado, `select count(*) from output_types` retorna 7.
4. Em seguida, aplicar [supabase/migrations/0004_auth_trigger_and_onboarding.sql](supabase/migrations/0004_auth_trigger_and_onboarding.sql) — adiciona `onboarding_step`/`onboarding_completed` e o trigger que cria `family_accounts` + `subscription_accesses` + `ayla_preferences` automaticamente quando um usuário se cadastra.

> **Para automatizar depois:** expor porta `5432` (ou usar pgbouncer 6543) no
> Easypanel e configurar `supabase` CLI com `--db-url`. Não recomendado expor
> publicamente — use IP allow-list ou tunnel SSH.

**Próxima fase:** Fase 3 — Páginas core (landing, cadastro 6 telas, painel, Kolo Vivo).

## Notas conhecidas

- **Turbopack** crasha no Windows quando o caminho do projeto contém caracteres
  não-ASCII (o `í` em `Família` quebra o spawn de processos do PostCSS — exit
  `0xc0000142`). Por isso `dev`/`build` usam `--webpack`. Voltar pra Turbopack
  quando: (a) renomear pasta sem acento, ou (b) Turbopack consertar.
- **`zod` pinned via override** para `^3.25.76` na raiz porque `eslint-config-next@16`
  puxa transitivamente `zod@4` que quebra `@hookform/resolvers ^3.x`.

## Princípios

- Não pular fases. A ordem é uma escolha técnica.
- Critério de saída de cada fase é não-negociável.
- Ayla é produto separado (`lib/ayla/`). Fronteira rígida com `lib/ia/`.
- Hipóteses, não causas afirmadas (PRD §6.1).
- Sem reaproveitamento de código Base44. Apenas conteúdo dos prompts iniciais.
