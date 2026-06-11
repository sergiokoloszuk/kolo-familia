-- ============================================================
-- Kolo Família — Migração 0041
--   Meditação guiada (Lúdico) — a mãe escolhe uma INTENÇÃO (acalmar, visualizar
--   um momento futuro, dormir, coragem, segurança…), a Kolo sugere temas
--   pertinentes ao que está acontecendo com a criança e gera um roteiro de
--   meditação pra ler em voz alta. Guardada pra reusar (ex.: a mesma toda noite).
-- ============================================================

create table if not exists public.meditacoes (
  id uuid primary key default gen_random_uuid(),
  family_account_id uuid not null references public.family_accounts(id) on delete cascade,
  membro_atipico_id uuid references public.membros_atipicos(id) on delete set null,
  intencao text not null, -- acalmar | visualizar | dormir | coragem | seguranca | outra
  tema text,              -- foco específico (ex.: "primeiro dia de escola")
  contexto text,          -- o que está acontecendo (input da mãe)
  titulo text,
  roteiro text,
  created_at timestamptz not null default now()
);

create index if not exists meditacoes_family_idx
  on public.meditacoes(family_account_id, created_at desc);
create index if not exists meditacoes_membro_idx
  on public.meditacoes(membro_atipico_id, created_at desc);

-- ---------- RLS ----------
alter table public.meditacoes enable row level security;

drop policy if exists meditacoes_select on public.meditacoes;
create policy meditacoes_select on public.meditacoes for select
  using (family_account_id = public.current_family_account_id() or public.is_admin());

drop policy if exists meditacoes_insert on public.meditacoes;
create policy meditacoes_insert on public.meditacoes for insert
  with check (family_account_id = public.current_family_account_id());

drop policy if exists meditacoes_update on public.meditacoes;
create policy meditacoes_update on public.meditacoes for update
  using (family_account_id = public.current_family_account_id())
  with check (family_account_id = public.current_family_account_id());

drop policy if exists meditacoes_delete on public.meditacoes;
create policy meditacoes_delete on public.meditacoes for delete
  using (family_account_id = public.current_family_account_id());

notify pgrst, 'reload schema';
