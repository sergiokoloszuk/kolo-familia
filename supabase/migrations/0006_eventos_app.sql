-- ============================================================
-- Kolo Família — Migração 0006
-- Observabilidade: tabela eventos_app + RLS.
--
-- Principais usos (PRD §13.5):
--   - Erros de cliente (window.onerror, unhandledrejection)
--   - Eventos críticos do servidor (cron, webhook stripe, ayla)
--   - Audit trail mínimo de ações sensíveis
--
-- Idempotente: pode rodar múltiplas vezes.
-- ============================================================

create table if not exists public.eventos_app (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  -- 'client_error', 'server_error', 'cron_run', 'stripe_webhook',
  -- 'ayla_inbound', 'ayla_send', 'admin_action', 'auth_event'
  severity text not null default 'info'
    check (severity in ('debug','info','warn','error','fatal')),
  family_account_id uuid references public.family_accounts(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  message text,
  payload jsonb not null default '{}'::jsonb,
  url text,
  user_agent text,
  -- Stack trace só pra erros de cliente; servidor já vai pro logger stdout
  stack text,
  created_at timestamptz not null default now()
);

create index if not exists eventos_app_kind_idx on public.eventos_app(kind, created_at desc);
create index if not exists eventos_app_severity_idx on public.eventos_app(severity, created_at desc) where severity in ('warn','error','fatal');
create index if not exists eventos_app_family_idx on public.eventos_app(family_account_id, created_at desc) where family_account_id is not null;
create index if not exists eventos_app_created_idx on public.eventos_app(created_at desc);

-- TTL automático: eventos info/debug com mais de 30 dias e
-- warn/error/fatal com mais de 180 dias podem ser purgados.
-- A purga real fica num cron (?tipo=cleanup), não num trigger.

alter table public.eventos_app enable row level security;

-- Admin lê e escreve livremente.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'eventos_app'
      and policyname = 'eventos_app_admin'
  ) then
    create policy eventos_app_admin on public.eventos_app
      for all to authenticated
      using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

-- Famílias podem inserir os próprios eventos (client_error). Não podem ler.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'eventos_app'
      and policyname = 'eventos_app_self_insert'
  ) then
    create policy eventos_app_self_insert on public.eventos_app
      for insert to authenticated
      with check (
        kind = 'client_error'
        and (user_id is null or user_id = auth.uid())
        and (
          family_account_id is null
          or family_account_id = public.current_family_account_id()
        )
      );
  end if;
end $$;

-- ============================================================
-- FIM da migração 0006.
-- ============================================================
