-- ============================================================
-- Kolo Família — Migração 0027
--   Afiliados Fase 1: variáveis configuráveis por afiliado,
--   atribuição na family_account e rastreio de cliques.
--   Fase 2 (comissão calculada + desconto no checkout) depende do Stripe.
-- ============================================================

-- 1. afiliados: comissão e desconto totalmente configuráveis por afiliado
alter table public.afiliados
  add column if not exists comissao_tipo text not null default 'pct_primeira_mensalidade'
    check (comissao_tipo in ('pct_primeira_mensalidade','pct_recorrente','valor_fixo','nenhuma')),
  add column if not exists comissao_valor numeric not null default 0,   -- % (0-100) ou centavos (valor_fixo)
  add column if not exists comissao_meses int not null default 1,       -- p/ pct_recorrente: quantos meses paga
  add column if not exists desconto_tipo text not null default 'nenhum'
    check (desconto_tipo in ('nenhum','pct','valor')),
  add column if not exists desconto_valor numeric not null default 0,   -- % (0-100) ou centavos
  add column if not exists desconto_duracao text not null default 'primeira'
    check (desconto_duracao in ('primeira','sempre')),
  add column if not exists janela_atribuicao_dias int not null default 30,
  add column if not exists observacoes text;

-- migra o comissao_pct legado pro novo campo, se houver
update public.afiliados
  set comissao_valor = comissao_pct
  where comissao_pct > 0 and comissao_valor = 0;

-- 2. atribuição: qual afiliado trouxe a família
alter table public.family_accounts
  add column if not exists afiliado_id uuid references public.afiliados(id) on delete set null,
  add column if not exists ref_codigo text,
  add column if not exists atribuido_em timestamptz;
create index if not exists family_accounts_afiliado_idx on public.family_accounts(afiliado_id);

-- 3. cliques do link de indicação (topo do funil)
create table if not exists public.afiliado_cliques (
  id uuid primary key default gen_random_uuid(),
  afiliado_id uuid not null references public.afiliados(id) on delete cascade,
  codigo text not null,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists afiliado_cliques_afiliado_idx
  on public.afiliado_cliques(afiliado_id, created_at desc);

-- RLS: cliques são admin-only. Os inserts vêm pelo /i/[codigo] via service-role.
alter table public.afiliado_cliques enable row level security;
create policy afiliado_cliques_admin on public.afiliado_cliques
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

notify pgrst, 'reload schema';

-- ============================================================
-- FIM da migração 0027.
-- ============================================================
