-- ============================================================
-- Kolo Família — Migração 0030
--   Tela de boas-vindas (Sprint A).
--   `boas_vindas_vista_at` marca quando a mãe passou pela tela
--   de boas-vindas. Diferente de `onboarding_completed`: o
--   onboarding fala da criança, a boas-vindas fala dela.
--   Enquanto for null, /boas-vindas é a próxima parada depois
--   do onboarding.
-- ============================================================

alter table public.family_accounts
  add column if not exists boas_vindas_vista_at timestamptz;

notify pgrst, 'reload schema';

-- ============================================================
-- FIM da migração 0030.
-- ============================================================
