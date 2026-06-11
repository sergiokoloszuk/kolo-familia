-- ============================================================================
-- KOLO FAMÍLIA — aplicar as 3 migrações do Lúdico de uma vez (prod)
--   0039 Rotinas visuais · 0040 "O que o desenho conta?" · 0041 Meditação guiada
--
-- Como rodar: cole TODO este arquivo no SQL Editor do Supabase Studio (ou no
-- psql) e execute. É IDEMPOTENTE (create if not exists / drop policy if exists /
-- add column if not exists) e ATÔMICO (tudo ou nada). Pode rodar mais de uma vez
-- sem problema. Depende de helpers que já existem no banco (set_updated_at,
-- current_family_account_id, is_admin — criados na 0036).
--
-- No fim há uma consulta de verificação: esperado tabelas=4, colunas_rotinas=4,
-- colunas_tarefas=3.
-- ============================================================================

begin;

-- ---------- 0039: Rotinas visuais ----------
create table if not exists public.rotinas (
  id uuid primary key default gen_random_uuid(),
  family_account_id uuid not null references public.family_accounts(id) on delete cascade,
  membro_atipico_id uuid references public.membros_atipicos(id) on delete cascade,
  nome text not null,
  ordem int not null default 0,
  tema text,
  historia text,
  mascote_url text,
  cards_status text not null default 'nenhum',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.rotinas add column if not exists tema text;
alter table public.rotinas add column if not exists historia text;
alter table public.rotinas add column if not exists mascote_url text;
alter table public.rotinas add column if not exists cards_status text not null default 'nenhum';

create index if not exists rotinas_family_idx on public.rotinas(family_account_id, ordem);
create index if not exists rotinas_membro_idx on public.rotinas(membro_atipico_id);

create table if not exists public.rotina_tarefas (
  id uuid primary key default gen_random_uuid(),
  rotina_id uuid not null references public.rotinas(id) on delete cascade,
  texto text not null,
  icone text,
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

create index if not exists rotina_tarefas_rotina_idx on public.rotina_tarefas(rotina_id, ordem);

drop trigger if exists rotinas_set_updated_at on public.rotinas;
create trigger rotinas_set_updated_at before update on public.rotinas
  for each row execute function public.set_updated_at();

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
drop policy if exists rotina_tarefas_select on public.rotina_tarefas;
create policy rotina_tarefas_select on public.rotina_tarefas for select
  using (exists (select 1 from public.rotinas r where r.id = rotina_id
    and (r.family_account_id = public.current_family_account_id() or public.is_admin())));
drop policy if exists rotina_tarefas_insert on public.rotina_tarefas;
create policy rotina_tarefas_insert on public.rotina_tarefas for insert
  with check (exists (select 1 from public.rotinas r where r.id = rotina_id
    and r.family_account_id = public.current_family_account_id()));
drop policy if exists rotina_tarefas_update on public.rotina_tarefas;
create policy rotina_tarefas_update on public.rotina_tarefas for update
  using (exists (select 1 from public.rotinas r where r.id = rotina_id
    and r.family_account_id = public.current_family_account_id()))
  with check (exists (select 1 from public.rotinas r where r.id = rotina_id
    and r.family_account_id = public.current_family_account_id()));
drop policy if exists rotina_tarefas_delete on public.rotina_tarefas;
create policy rotina_tarefas_delete on public.rotina_tarefas for delete
  using (exists (select 1 from public.rotinas r where r.id = rotina_id
    and r.family_account_id = public.current_family_account_id()));

-- ---------- 0040: "O que o desenho conta?" ----------
create table if not exists public.desenhos (
  id uuid primary key default gen_random_uuid(),
  family_account_id uuid not null references public.family_accounts(id) on delete cascade,
  membro_atipico_id uuid references public.membros_atipicos(id) on delete set null,
  imagem_url text not null,
  storage_path text,
  contexto_dia text,
  analise jsonb,
  status text not null default 'analisando',
  resposta_crianca text,
  created_at timestamptz not null default now()
);
create index if not exists desenhos_family_idx on public.desenhos(family_account_id, created_at desc);
create index if not exists desenhos_membro_idx on public.desenhos(membro_atipico_id, created_at desc);

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

-- ---------- 0041: Meditação guiada ----------
create table if not exists public.meditacoes (
  id uuid primary key default gen_random_uuid(),
  family_account_id uuid not null references public.family_accounts(id) on delete cascade,
  membro_atipico_id uuid references public.membros_atipicos(id) on delete set null,
  intencao text not null,
  tema text,
  contexto text,
  titulo text,
  roteiro text,
  created_at timestamptz not null default now()
);
create index if not exists meditacoes_family_idx on public.meditacoes(family_account_id, created_at desc);
create index if not exists meditacoes_membro_idx on public.meditacoes(membro_atipico_id, created_at desc);

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

commit;

notify pgrst, 'reload schema';

-- ---------- VERIFICAÇÃO (esperado: 4 / 4 / 3) ----------
select
  (select count(*) from information_schema.tables
     where table_schema='public'
       and table_name in ('rotinas','rotina_tarefas','desenhos','meditacoes')) as tabelas_criadas,
  (select count(*) from information_schema.columns
     where table_schema='public' and table_name='rotinas'
       and column_name in ('tema','historia','mascote_url','cards_status')) as colunas_rotinas,
  (select count(*) from information_schema.columns
     where table_schema='public' and table_name='rotina_tarefas'
       and column_name in ('nome_tematico','cena','imagem_url')) as colunas_tarefas;
