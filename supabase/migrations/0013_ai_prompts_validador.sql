-- ============================================================
-- Kolo Família — Migração 0013
--   Adiciona 'validador' ao check do scope em public.ai_prompts pra
--   permitir o prompt do Validador IA (Adendo PRD v1 - Questão 4).
-- ============================================================

alter table public.ai_prompts
  drop constraint if exists ai_prompts_scope_check;

alter table public.ai_prompts
  add constraint ai_prompts_scope_check
  check (scope in ('ayla','relatorio','skills','boas_praticas','validador'));

notify pgrst, 'reload schema';
