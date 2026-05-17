-- ============================================================
-- Kolo Família — Migração 0015
--   Tabela public.ai_validator_vetos: lista de vetos absolutos
--   (regex) que o Validador rejeita em qualquer resposta de skill.
--   Permite admin editar tom sem precisar de deploy.
--
--   validators.ts continua tendo fallback hardcoded — se DB falhar/
--   estiver vazio, usa o fallback.
-- ============================================================

create table if not exists public.ai_validator_vetos (
  id uuid primary key default gen_random_uuid(),
  categoria text not null,
  padrao text not null,
  flags text not null default 'i',
  descricao text,
  sugestao text not null default 'Reescreva sem essa expressão. O acolhimento mora na precisão da informação.',
  ativo boolean not null default true,
  origem text not null default 'sistema' check (origem in ('sistema','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_validator_vetos_ativo_idx on public.ai_validator_vetos(ativo);
create index if not exists ai_validator_vetos_categoria_idx on public.ai_validator_vetos(categoria);

create trigger ai_validator_vetos_set_updated_at
  before update on public.ai_validator_vetos
  for each row execute function public.set_updated_at();

alter table public.ai_validator_vetos enable row level security;

create policy ai_validator_vetos_admin_all on public.ai_validator_vetos
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

notify pgrst, 'reload schema';
