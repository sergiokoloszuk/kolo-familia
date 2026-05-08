-- ============================================================
-- Kolo Família — Migração 0009
-- Aceite explícito de termos de uso (LGPD/CDC).
--
-- Adiciona termos_aceitos_em em family_accounts. Idempotente.
-- ============================================================

alter table public.family_accounts
  add column if not exists termos_aceitos_em timestamptz;

alter table public.family_accounts
  add column if not exists privacidade_aceita_em timestamptz;

-- ============================================================
-- FIM da migração 0009.
-- ============================================================
