-- ============================================================
-- Kolo Família — Migração 0039
--   Seção "Lúdico" → Rotinas visuais. Uma rotina por membro, com tarefas em
--   sequência (reordenáveis, marca→cinza). A tela renderiza por idade: criança
--   = cartões visuais com avatar; adolescente/adulto = checklist.
-- ============================================================

create table if not exists public.rotinas (
  id uuid primary key default gen_random_uuid(),
  family_account_id uuid not null references public.family_accounts(id) on delete cascade,
  membro_atipico_id uuid references public.membros_atipicos(id) on delete cascade,
  nome text not null,
  ordem int not null default 0,
  -- Cards visuais (gerador): tema escolhido, história lúdica gerada, mascote
  -- de referência (mantém o personagem consistente) e status da geração.
  tema text,
  historia text,
  mascote_url text,
  cards_status text not null default 'nenhum', -- nenhum | gerando | pronto | erro
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Colunas idempotentes (caso a tabela já existisse de uma aplicação anterior).
alter table public.rotinas add column if not exists tema text;
alter table public.rotinas add column if not exists historia text;
alter table public.rotinas add column if not exists mascote_url text;
alter table public.rotinas add column if not exists cards_status text not null default 'nenhum';

create index if not exists rotinas_family_idx
  on public.rotinas(family_account_id, ordem);
create index if not exists rotinas_membro_idx
  on public.rotinas(membro_atipico_id);

create table if not exists public.rotina_tarefas (
  id uuid primary key default gen_random_uuid(),
  rotina_id uuid not null references public.rotinas(id) on delete cascade,
  texto text not null,
  icone text, -- chave do ícone (curado) ou null
  -- Cards visuais: nome temático (ex.: "Posto dos Campeões"), descrição da
  -- cena pro ilustrador, e a imagem gerada do card.
  nome_tematico text,
  cena text,
  imagem_url text,
  ordem int not null default 0,
  concluida boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.rotina_tarefas add column if not exists nome_tematico text;
alter table public.rotina_tarefas add column if not exists cena text;
alter table public.rotina_tarefas add column if not exists imagem_url text;

create index if not exists rotina_tarefas_rotina_idx
  on public.rotina_tarefas(rotina_id, ordem);

-- updated_at automático (helper já existe no banco).
drop trigger if exists rotinas_set_updated_at on public.rotinas;
create trigger rotinas_set_updated_at before update on public.rotinas
  for each row execute function public.set_updated_at();

-- ---------- RLS ----------
alter table public.rotinas enable row level security;

drop policy if exists rotinas_select on public.rotinas;
create policy rotinas_select on public.rotinas for select
  using (family_account_id = public.current_family_account_id() or public.is_admin());

drop policy if exists rotinas_insert on public.rotinas;
create policy rotinas_insert on public.rotinas for insert
  with check (family_account_id = public.current_family_account_id());

drop policy if exists rotinas_update on public.rotinas;
create policy rotinas_update on public.rotinas for update
  using (family_account_id = public.current_family_account_id())
  with check (family_account_id = public.current_family_account_id());

drop policy if exists rotinas_delete on public.rotinas;
create policy rotinas_delete on public.rotinas for delete
  using (family_account_id = public.current_family_account_id());

alter table public.rotina_tarefas enable row level security;

-- tarefas herdam o escopo da rotina dona.
drop policy if exists rotina_tarefas_select on public.rotina_tarefas;
create policy rotina_tarefas_select on public.rotina_tarefas for select
  using (
    exists (
      select 1 from public.rotinas r
      where r.id = rotina_id
        and (r.family_account_id = public.current_family_account_id() or public.is_admin())
    )
  );

drop policy if exists rotina_tarefas_insert on public.rotina_tarefas;
create policy rotina_tarefas_insert on public.rotina_tarefas for insert
  with check (
    exists (
      select 1 from public.rotinas r
      where r.id = rotina_id
        and r.family_account_id = public.current_family_account_id()
    )
  );

drop policy if exists rotina_tarefas_update on public.rotina_tarefas;
create policy rotina_tarefas_update on public.rotina_tarefas for update
  using (
    exists (
      select 1 from public.rotinas r
      where r.id = rotina_id
        and r.family_account_id = public.current_family_account_id()
    )
  )
  with check (
    exists (
      select 1 from public.rotinas r
      where r.id = rotina_id
        and r.family_account_id = public.current_family_account_id()
    )
  );

drop policy if exists rotina_tarefas_delete on public.rotina_tarefas;
create policy rotina_tarefas_delete on public.rotina_tarefas for delete
  using (
    exists (
      select 1 from public.rotinas r
      where r.id = rotina_id
        and r.family_account_id = public.current_family_account_id()
    )
  );

notify pgrst, 'reload schema';
