-- ============================================================
-- Kolo Família — Migração 0036
--   Tabela `planos`: o plano completo gerado nas Estratégias (e, depois, o
--   plano de fim de semana). Guardado por seções, pra a tela renderizar e os
--   antigos "botões" virarem só filtros/visões — sem novas chamadas de IA.
-- ============================================================

create table if not exists public.planos (
  id uuid primary key default gen_random_uuid(),
  family_account_id uuid not null references public.family_accounts(id) on delete cascade,
  membro_atipico_id uuid references public.membros_atipicos(id) on delete set null,
  conversa_id uuid references public.conversas(id) on delete set null,
  titulo text not null,
  tema text,
  -- secoes: [{ "tipo": "entender|crencas|brincadeiras|atividades|diferente|frases|rotina|observar",
  --            "titulo": "...", "conteudo_markdown": "..." }]
  secoes jsonb not null default '[]'::jsonb,
  origem text not null default 'estrategias', -- estrategias | fim_de_semana
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists planos_family_idx
  on public.planos(family_account_id, created_at desc);

-- updated_at automático (helper já existe no banco).
drop trigger if exists planos_set_updated_at on public.planos;
create trigger planos_set_updated_at before update on public.planos
  for each row execute function public.set_updated_at();

-- RLS: a família dona lê/escreve; admin lê. Espelha o padrão das outras tabelas.
alter table public.planos enable row level security;

drop policy if exists planos_select on public.planos;
create policy planos_select on public.planos for select
  using (family_account_id = public.current_family_account_id() or public.is_admin());

drop policy if exists planos_insert on public.planos;
create policy planos_insert on public.planos for insert
  with check (family_account_id = public.current_family_account_id());

drop policy if exists planos_update on public.planos;
create policy planos_update on public.planos for update
  using (family_account_id = public.current_family_account_id())
  with check (family_account_id = public.current_family_account_id());

drop policy if exists planos_delete on public.planos;
create policy planos_delete on public.planos for delete
  using (family_account_id = public.current_family_account_id());

notify pgrst, 'reload schema';
