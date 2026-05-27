-- ============================================================
-- Kolo Família — Migração 0031
--   Balão "Os primeiros passos" no painel — aparece UMA vez,
--   na primeira visita ao painel, explicando que dá pra ir
--   pro Kolo Vivo ou Estratégias. Depois some.
-- ============================================================

alter table public.family_accounts
  add column if not exists painel_balao_visto_at timestamptz;

notify pgrst, 'reload schema';

-- ============================================================
-- FIM da migração 0031.
-- ============================================================
