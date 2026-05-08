# Kolo Família

Estratégia personalizada pro dia a dia da família atípica. Acolhimento e
orientação no WhatsApp + app PWA com conteúdo personalizado + relatórios
para terapeutas e escola.

## Documentação

- **PRD do produto pleno:** [docs/PRD_Kolo_Familia_v3.1.md](docs/PRD_Kolo_Familia_v3.1.md)
- **Roadmap de implantação:** [docs/Roadmap_Implantacao_v2.md](docs/Roadmap_Implantacao_v2.md) — 15 fases.
- **Explicação das funcionalidades:** [docs/Explicacao_Funcionalidades.md](docs/Explicacao_Funcionalidades.md)
- **Aplicar migrações no Supabase Studio:** [docs/migracoes-chrome-prompt.md](docs/migracoes-chrome-prompt.md)

## Stack

- **App:** Next.js 16 (App Router) + TypeScript + Tailwind v4 + shadcn/ui
- **Auth + DB + Storage:** Supabase self-hosted (Easypanel)
- **IA:** Anthropic (Claude Opus/Sonnet/Haiku) + OpenAI (DALL-E 3 pra imagem)
- **Pagamento:** Stripe (Checkout + Portal + Webhook)
- **WhatsApp:** Z-API (REST + webhook)
- **PWA:** service worker próprio (network-first em HTML, cache-first em assets)
- **Observabilidade:** logger próprio + tabela `eventos_app` + `/admin/observabilidade`

## Estrutura

```
.
├── apps/web/                # Next.js 16 — todo o produto
├── packages/shared/         # Tipos/schemas comuns (ainda enxuto)
├── supabase/migrations/     # 0001 → 0009 (idempotentes)
└── docs/                    # PRD + Roadmap + Explicações + Prompt Chrome
```

## Rodar local

```bash
# 1. Dependências (raiz)
npm install

# 2. Variáveis de ambiente
cp .env.example apps/web/.env.local
# Preencher conforme tabela abaixo. Sem ANTHROPIC/STRIPE/ZAPI dá pra
# subir o app, mas as features dependentes ficam off.

# 3. Dev server
npm run dev
```

App em `http://localhost:3000`. Login: `/login` (precisa migrações
aplicadas no Supabase + primeiro admin via `/admin/setup`).

> **Windows + caminho com `í`:** os scripts já usam `next dev --webpack`
> e `next build --webpack` porque o Turbopack crasha em paths com
> caracteres não-ASCII. Não trocar.

## Variáveis de ambiente

Em `apps/web/.env.local`:

| Variável | Onde usa | Obrigatória? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Cliente + servidor Supabase | sim |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente Supabase | sim |
| `SUPABASE_SERVICE_ROLE_KEY` | Webhooks, cron, gate Beta | sim |
| `NEXT_PUBLIC_APP_URL` | Sitemap, Open Graph, redirects | sim |
| `ANTHROPIC_API_KEY` | Skills + Ayla parser + curadoria | sim em prod |
| `OPENAI_API_KEY` | Geração de imagem (DALL-E 3) | só pra galeria |
| `STRIPE_SECRET_KEY` | Stripe SDK | só pra Stripe |
| `STRIPE_WEBHOOK_SECRET` | Verifica assinatura do webhook | só pra Stripe |
| `STRIPE_PRICE_ID_MENSAL` | Preço mensal | só pra Stripe |
| `STRIPE_PRICE_ID_ANUAL` | Preço anual | só pra Stripe |
| `ZAPI_INSTANCE_ID` | URL Z-API | só pra Ayla |
| `ZAPI_TOKEN` | Token Z-API | só pra Ayla |
| `ZAPI_CLIENT_TOKEN` | Token de cliente Z-API | só pra Ayla |
| `AYLA_WEBHOOK_SECRET` | Header `x-ayla-secret` no webhook | só pra Ayla |
| `CRON_SECRET` | `Authorization: Bearer` em `/api/ayla/cron` | só pra cron |
| `BETA_GATE_ENABLED` | `true` exige convite no signup | opcional |
| `NEXT_PUBLIC_BETA_GATE_ENABLED` | Mesmo valor, exposto ao client | opcional |

## Migrações (Supabase)

Aplicadas em ordem **0001 → 0009** via Supabase Studio. Todas idempotentes.

Resumo:

| # | Arquivo | O que faz |
|---|---|---|
| 0001 | `0001_init.sql` | 44 tabelas + índices + triggers |
| 0002 | `0002_rls.sql` | Row Level Security + `is_admin()` + `current_family_account_id()` |
| 0003 | `0003_seed.sql` | 7 output_types + 7 skills + 3 boas práticas + configs |
| 0004 | `0004_auth_trigger_and_onboarding.sql` | trigger `on_auth_user_created` |
| 0005 | `0005_storage_imagens.sql` | bucket `imagens` |
| 0006 | `0006_eventos_app.sql` | observabilidade + RLS |
| 0007 | `0007_rules_engine.sql` | regras + alertas + adaptações |
| 0008 | `0008_beta.sql` | convites Beta + NPS + RPC `increment_invite_uses` |
| 0009 | `0009_termos_aceite.sql` | colunas de aceite LGPD em `family_accounts` |

Total esperado: **50 tabelas em `public`**.

Aplicar: ver [docs/migracoes-chrome-prompt.md](docs/migracoes-chrome-prompt.md)
ou colar manualmente no Studio em ordem. Após aplicar, criar conta em
`/signup` e visitar `/admin/setup` (primeiro usuário vira superadmin).

## Stripe

1. **Dashboard Stripe → Products** — criar 1 produto "Kolo Família" com 2 preços (mensal + anual).
2. Copiar IDs dos preços para `STRIPE_PRICE_ID_MENSAL` e `STRIPE_PRICE_ID_ANUAL`.
3. **Developers → Webhooks** — endpoint apontando pra `https://<seu-dominio>/api/stripe/webhook`. Eventos:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copiar **Signing secret** para `STRIPE_WEBHOOK_SECRET`.

Em dev: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

## Z-API (WhatsApp)

1. Criar instância na Z-API e copiar `Instance ID` + `Token` + `Client-Token`.
2. Configurar webhook no painel Z-API apontando pra `https://<seu-dominio>/api/ayla/webhook`.
3. **Adicionar header customizado** `x-ayla-secret: <AYLA_WEBHOOK_SECRET>`.

## Cron externo

Scheduler (n8n / Vercel Cron / GitHub Actions) chama `POST` em
`/api/ayla/cron?tipo=...` com `Authorization: Bearer $CRON_SECRET`:

| Tipo | Cadência | O que faz |
|---|---|---|
| `rotina` | a cada 30min | pergunta diária da Ayla na janela horária da família |
| `inatividade` | 1×/dia | engajamento 2/5 dias |
| `comercial` | 1×/dia | trial D-3 e D-0 |
| `emocional` | 1×/dia | streak 7 dias |
| `insights` | 1×/semana | detecção de padrões + envia próximo pendente |
| `campanhas` | 1×/hora | drena destinatários pendentes |
| `regras` | 1×/dia | Rules Engine |
| `cleanup` | 1×/dia | purga eventos antigos, links vivos expirados, etc. |

## Status atual

Roadmap fechado da fase 1 à fase 14. Fase 15 (migração WhatsApp Cloud
API) não vai acontecer — mantemos Z-API.

Lacunas conhecidas (não bloqueiam o produto):

- Conteúdo real precisa ser populado pela fundadora (aulas, trilhas,
  boas práticas, depoimentos, vídeos).
- Stripe + Z-API + cron precisam ser configurados no ambiente de prod.

## Princípios

- Não pular fases. A ordem é uma escolha técnica.
- Ayla é produto separado (`lib/ayla/`). Fronteira rígida com `lib/ia/`.
- Hipóteses, não causas afirmadas (PRD §6.1).
- Adaptações automáticas só entram com OK explícito da mãe e são
  reversíveis.

## Notas conhecidas

- Turbopack crasha em paths com não-ASCII no Windows; `dev`/`build`
  usam `--webpack`.
- `zod` pinned para `^3.25.76` via override na raiz por causa de
  conflito transitivo com `eslint-config-next@16`.
