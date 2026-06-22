-- ============================================================
-- Kolo Família — Migração 0046
--   Etiquetagem por ÁREA dos registros do diário (Evolução "X em cada tema").
--   Cada conquista/desafio recebe um domínio do Perfil (sono, alimentação…),
--   classificado pela IA ao salvar. Nullable; backfill dos antigos é à parte.
-- ============================================================

alter table public.diarios
  add column if not exists conquista_area text,
  add column if not exists desafio_area text;

notify pgrst, 'reload schema';

-- ============================================================
-- FIM da migração 0046.
-- ============================================================
