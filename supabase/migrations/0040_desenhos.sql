-- ============================================================
-- Kolo Família — Migração 0040
--   "O que o desenho conta?" (Lúdico) — a mãe envia a foto de um desenho e
--   recebe uma LEITURA observacional (NÃO diagnóstica): o que se observa,
--   possíveis leituras (hipóteses), perguntas pra explorar e o que registrar.
--   Guardamos pra montar o "Diário Simbólico" e, depois, a leitura longitudinal.
-- ============================================================

create table if not exists public.desenhos (
  id uuid primary key default gen_random_uuid(),
  family_account_id uuid not null references public.family_accounts(id) on delete cascade,
  membro_atipico_id uuid references public.membros_atipicos(id) on delete set null,
  imagem_url text not null,
  storage_path text,
  contexto_dia text,
  -- analise: { "observamos": [], "leituras": [], "perguntas": [], "registro": "" }
  analise jsonb,
  status text not null default 'analisando', -- analisando | pronto | erro
  resposta_crianca text,
  created_at timestamptz not null default now()
);

create index if not exists desenhos_family_idx
  on public.desenhos(family_account_id, created_at desc);
create index if not exists desenhos_membro_idx
  on public.desenhos(membro_atipico_id, created_at desc);

-- ---------- RLS (espelha o padrão das outras tabelas) ----------
alter table public.desenhos enable row level security;

drop policy if exists desenhos_select on public.desenhos;
create policy desenhos_select on public.desenhos for select
  using (family_account_id = public.current_family_account_id() or public.is_admin());

drop policy if exists desenhos_insert on public.desenhos;
create policy desenhos_insert on public.desenhos for insert
  with check (family_account_id = public.current_family_account_id());

drop policy if exists desenhos_update on public.desenhos;
create policy desenhos_update on public.desenhos for update
  using (family_account_id = public.current_family_account_id())
  with check (family_account_id = public.current_family_account_id());

drop policy if exists desenhos_delete on public.desenhos;
create policy desenhos_delete on public.desenhos for delete
  using (family_account_id = public.current_family_account_id());

notify pgrst, 'reload schema';
