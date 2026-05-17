-- ============================================================
-- Kolo Família — Migração 0016
--   Mapa Familiar estruturado (Adendo PRD v1 §1 — dívida R1).
--
--   - pessoas_familia: pessoas da família/rede (mãe, pai, avó, padrasto,
--     babá, professor, etc) com identidade própria, papel, coabitação,
--     frequência de contato.
--   - papeis_cuidado: relação N:M entre pessoa e membro atípico. Captura
--     "quem cuida de quem" e como.
--
--   relacoes_familiares (pessoa-a-pessoa) fica pra R1 — não é crítico
--   pro MVP. O diarios.quem_estava enum continua funcionando em paralelo
--   por compatibilidade.
-- ============================================================

create table if not exists public.pessoas_familia (
  id uuid primary key default gen_random_uuid(),
  family_account_id uuid not null references public.family_accounts(id) on delete cascade,
  nome text not null,
  apelido text,
  papel text not null check (papel in (
    'mae','pai','avo_a','avo_o','irmao_a','padrasto','madrasta',
    'tio_a','baba','professor_a','terapeuta','medico','amigo_da_familia','outro'
  )),
  papel_livre text,
  observacoes text,
  coabitante boolean not null default false,
  frequencia_contato text check (frequencia_contato in (
    'diaria','semanal','mensal','rara','unica'
  )),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pessoas_familia_family_idx
  on public.pessoas_familia(family_account_id, ativo);

create trigger pessoas_familia_set_updated_at
  before update on public.pessoas_familia
  for each row execute function public.set_updated_at();

alter table public.pessoas_familia enable row level security;

create policy pessoas_familia_self on public.pessoas_familia
  for all to authenticated
  using (family_account_id = public.current_family_account_id())
  with check (family_account_id = public.current_family_account_id());

create policy pessoas_familia_admin on public.pessoas_familia
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ----- Papéis de cuidado: pessoa → criança atípica → tipo -----

create table if not exists public.papeis_cuidado (
  id uuid primary key default gen_random_uuid(),
  pessoa_familia_id uuid not null references public.pessoas_familia(id) on delete cascade,
  membro_atipico_id uuid not null references public.membros_atipicos(id) on delete cascade,
  tipo_cuidado text not null check (tipo_cuidado in (
    'principal','apoio_frequente','apoio_esporadico','neutro','tira_de_cena','opositor'
  )),
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pessoa_familia_id, membro_atipico_id)
);

create index if not exists papeis_cuidado_membro_idx
  on public.papeis_cuidado(membro_atipico_id);

create trigger papeis_cuidado_set_updated_at
  before update on public.papeis_cuidado
  for each row execute function public.set_updated_at();

alter table public.papeis_cuidado enable row level security;

-- RLS via pessoa_familia (que já tem FK pra family_account)
create policy papeis_cuidado_self on public.papeis_cuidado
  for all to authenticated
  using (
    exists (
      select 1 from public.pessoas_familia pf
      where pf.id = papeis_cuidado.pessoa_familia_id
        and pf.family_account_id = public.current_family_account_id()
    )
  )
  with check (
    exists (
      select 1 from public.pessoas_familia pf
      where pf.id = papeis_cuidado.pessoa_familia_id
        and pf.family_account_id = public.current_family_account_id()
    )
  );

create policy papeis_cuidado_admin on public.papeis_cuidado
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

notify pgrst, 'reload schema';
