-- ============================================================
-- Kolo Família — Migração 0049
--   Snapshots mensais da Evolução (a "máquina do tempo").
--   Toda mês, uma FOTO resumida de como a pessoa esteve em cada área —
--   pra a Evolução longa (régua de meses) e pro Relatório narrar o arco
--   ("há um ano… hoje…") lendo poucas fotos em vez de anos de registros.
--   Gerado por cron mensal + backfill retroativo (admin). 1 por (membro, mês).
-- ============================================================

create table if not exists public.evolucao_snapshots (
  id uuid primary key default gen_random_uuid(),
  family_account_id uuid not null references public.family_accounts(id) on delete cascade,
  membro_atipico_id uuid not null references public.membros_atipicos(id) on delete cascade,
  periodo date not null,                       -- 1º dia do mês que a foto resume
  periodo_tipo text not null default 'mensal',
  resumo text,                                 -- frase do mês (IA leve; pode ser null)
  areas jsonb not null default '{}'::jsonb,    -- { area: {conquistas,desafios,resumo} }
  sinais jsonb not null default '{}'::jsonb,   -- { humor, perfil_pct, padroes }
  gerado_em timestamptz not null default now(),
  gerado_por text not null default 'cron',     -- cron | backfill | manual
  unique (membro_atipico_id, periodo, periodo_tipo)
);

create index if not exists idx_evolucao_snapshots_membro_periodo
  on public.evolucao_snapshots (membro_atipico_id, periodo desc);

alter table public.evolucao_snapshots enable row level security;

-- Leitura: a família vê as fotos dela; admin vê tudo. Escrita é só via
-- service-role (cron/backfill), que ignora RLS — sem policy de insert/update.
drop policy if exists evolucao_snapshots_select on public.evolucao_snapshots;
create policy evolucao_snapshots_select on public.evolucao_snapshots for select
  using (family_account_id = public.current_family_account_id() or public.is_admin());

notify pgrst, 'reload schema';

-- ============================================================
-- FIM da migração 0049.
-- ============================================================
