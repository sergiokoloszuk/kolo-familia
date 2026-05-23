-- ============================================================
-- Kolo Família — Migração 0024
--   Papel do responsável que se cadastrou (sair da presunção "mãe").
--   family_profiles.papel: mae | pai | avo | outro
--   Colunas *_mae continuam (legado) — papel é a relação real.
-- ============================================================

alter table public.family_profiles
  add column if not exists papel text
  check (papel is null or papel in ('mae', 'pai', 'avo', 'outro'));

-- ============================================================
-- FIM da migração 0024.
-- Lembrar: após aplicar, rodar NOTIFY pgrst, 'reload schema'
-- (senão INSERT/UPSERT da coluna nova falha com PGRST204).
-- ============================================================
