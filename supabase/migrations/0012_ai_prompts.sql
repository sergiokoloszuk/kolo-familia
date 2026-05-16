-- ============================================================
-- Kolo Família — Migração 0012
--   Tabela public.ai_prompts: armazena os system prompts da IA do
--   projeto (parser da Ayla, narrativa relatório, curador skills,
--   extrator boas práticas). Permite admin editar sem deploy.
--
--   Padrão idêntico ao 0011 (ayla_message_templates): fallback
--   hardcoded no código + DB como fonte editável.
-- ============================================================

create table if not exists public.ai_prompts (
  key text primary key,
  label text not null,
  description text,
  scope text not null check (scope in ('ayla','relatorio','skills','boas_praticas')),
  system_text text not null,
  ativo boolean not null default true,
  versao int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger ai_prompts_set_updated_at
  before update on public.ai_prompts
  for each row execute function public.set_updated_at();

alter table public.ai_prompts enable row level security;

create policy ai_prompts_admin_all on public.ai_prompts
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Seed populado por scripts/seed-ai-prompts.mjs (evita escapes
-- frágeis com strings multi-linhas em SQL inline).

notify pgrst, 'reload schema';
