-- ============================================================
-- Kolo Família — Migração 0044
--   Acesso CORTESIA (comp) em subscription_accesses.
--   - cortesia = true  → acesso liberado independente de status/trial/Stripe.
--   - cortesia_ate      → quando expira (NULL = vitalícia).
--   Concedida pelo admin por e-mail (ver app/admin/cortesias).
-- ============================================================

alter table public.subscription_accesses
  add column if not exists cortesia boolean not null default false,
  add column if not exists cortesia_ate timestamptz;

-- PostgREST cacheia colunas — recarrega o schema.
notify pgrst, 'reload schema';

-- ============================================================
-- FIM da migração 0044.
-- ============================================================
