-- ============================================================
-- Kolo Família — Migração 0035
--   Schema pra dashboard de uso de API (/admin/uso-api).
--
--   3 tabelas:
--
--   1. api_calls — uma linha por chamada de LLM/imagem (instrumentação
--      ponto-a-ponto). Permite agregar custo por família, por feature,
--      por modelo. Idealmente cobre 100% das chamadas do app pra dar
--      base à projeção de custo médio por usuário.
--
--   2. api_provider_snapshots — snapshot diário do gasto reportado pelo
--      próprio provider (Anthropic Admin API + OpenAI Admin API).
--      Serve de truth global pra cross-check vs nossa soma de api_calls.
--      Detecta call site não-instrumentado ou bug de preço se divergir.
--
--   3. api_budgets — orçamento mensal por provider, editável via UI.
--      "Saldo restante" = budget - sum(provider_snapshots.gasto_usd do mês).
--      Providers não expõem saldo real por API estável; este é o caminho
--      honesto.
--
--   RLS: 3 tabelas restritas a admin (is_admin()). Service role escreve
--   livre (helper logarUsoApi roda server-side com service role).
-- ============================================================

create table if not exists public.api_calls (
  id uuid primary key default gen_random_uuid(),
  family_account_id uuid references public.family_accounts(id) on delete set null,
  provider text not null check (provider in ('anthropic','openai')),
  model text not null,
  feature text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  custo_usd numeric(10,6) not null default 0,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists api_calls_created_idx
  on public.api_calls (created_at desc);
create index if not exists api_calls_family_created_idx
  on public.api_calls (family_account_id, created_at desc);
create index if not exists api_calls_provider_model_created_idx
  on public.api_calls (provider, model, created_at desc);
create index if not exists api_calls_feature_created_idx
  on public.api_calls (feature, created_at desc);

alter table public.api_calls enable row level security;

create policy api_calls_admin_read on public.api_calls
  for select to authenticated
  using (public.is_admin());

-- service_role bypassa RLS por default; logarUsoApi escreve com service.

create table if not exists public.api_provider_snapshots (
  provider text not null check (provider in ('anthropic','openai')),
  date date not null,
  gasto_usd numeric(10,4) not null,
  raw jsonb,
  fetched_at timestamptz not null default now(),
  primary key (provider, date)
);

alter table public.api_provider_snapshots enable row level security;

create policy api_provider_snapshots_admin_all on public.api_provider_snapshots
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create table if not exists public.api_budgets (
  provider text not null check (provider in ('anthropic','openai')),
  mes date not null,  -- 1º dia do mês de referência
  valor_usd numeric(10,2) not null check (valor_usd >= 0),
  updated_at timestamptz not null default now(),
  primary key (provider, mes)
);

create trigger api_budgets_set_updated_at
  before update on public.api_budgets
  for each row execute function public.set_updated_at();

alter table public.api_budgets enable row level security;

create policy api_budgets_admin_all on public.api_budgets
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
