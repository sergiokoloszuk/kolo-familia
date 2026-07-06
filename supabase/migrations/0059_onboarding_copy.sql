-- Copy do onboarding conversacional — uma linha só (rascunho + publicado).
-- Editada por IA no admin; o cadastro real (Fatia 3) lê o "publicado".
-- Acesso só por service-role (as server actions gateiam por admin). RLS ligada
-- sem policies = anon/authenticated não enxergam.

create table if not exists public.onboarding_copy (
  id text primary key default 'atual',
  rascunho jsonb,
  publicado jsonb,
  updated_at timestamptz not null default now()
);

alter table public.onboarding_copy enable row level security;

insert into public.onboarding_copy (id) values ('atual')
on conflict (id) do nothing;

notify pgrst, 'reload schema';
