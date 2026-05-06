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
- Monorepo workspaces configurado (`apps/web`, `packages/shared`)
- Dependências base instaladas
- Smoke test renderizando componentes shadcn

**Próxima fase:** Fase 2 — Banco de dados e Autenticação Supabase.

## Princípios

- Não pular fases. A ordem é uma escolha técnica.
- Critério de saída de cada fase é não-negociável.
- Ayla é produto separado (`lib/ayla/`). Fronteira rígida com `lib/ia/`.
- Hipóteses, não causas afirmadas (PRD §6.1).
- Sem reaproveitamento de código Base44. Apenas conteúdo dos prompts iniciais.
