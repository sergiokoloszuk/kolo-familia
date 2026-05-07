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

**Fase 3 — Páginas core** em andamento:
- Onboarding wizard 6 telas com state machine ([apps/web/src/app/onboarding/](apps/web/src/app/onboarding/))
- Painel básico em `/painel` (será expandido nas próximas fases)
- Roteamento da home: deslogada → landing; logada+onboarding pendente → wizard; logada+completo → painel
- Falta: Kolo Vivo page (visualizar/editar Camada 1+2), painel completo (cards de conquistas/desafios/Ayla diz)

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
