-- Dados fiscais ficam fora de Perfil Vivo, Ayla e telemetria comportamental.
-- Esta tabela guarda somente referências Stripe e tokens administrativos;
-- nome, CPF e endereço permanecem no Customer Stripe.
create table if not exists public.fiscal_alertas (
  id uuid primary key default gen_random_uuid(),
  stripe_invoice_id text not null unique,
  stripe_customer_id text not null,
  stripe_subscription_id text,
  family_account_id uuid references public.family_accounts(id) on delete set null,
  status text not null default 'pendente' check (status in ('pendente', 'reservado', 'enviado', 'falha')),
  token_hash text,
  token_expira_em timestamptz,
  reserva_ate timestamptz,
  acessado_em timestamptz,
  provider_message_id text,
  enviada_em timestamptz,
  ultimo_erro text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fiscal_alertas_pendentes_idx
  on public.fiscal_alertas (status, created_at);

alter table public.fiscal_alertas enable row level security;
-- Sem policy: somente service-role acessa alertas e tokens administrativos.

notify pgrst, 'reload schema';
