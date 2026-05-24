-- ============================================================
-- Kolo Família — Migração 0026
--   Fix do Storage (RLS 403 fantasma).
--
--   Sintoma: upload via service role falhava com
--   "new row violates row-level security policy" (403), mesmo com
--   keys e JWT_SECRET corretos e policies permissivas.
--
--   Causa real (visível só no log do storage-api): erro 42501
--   (insufficient_privilege) em guc.c/call_string_check_hook ao
--   executar set_config('role', 'service_role', ...). O storage-api
--   conecta como supabase_storage_admin e faz SET ROLE para o role do
--   JWT; como supabase_storage_admin NÃO era membro de anon/
--   authenticated/service_role, o SET ROLE era negado — e o storage-api
--   mascarava o 42501 como violação de RLS.
--
--   Fix: dar a supabase_storage_admin a permissão de assumir esses
--   roles. Com isso, SET ROLE service_role passa, service_role bypassa
--   a RLS (BYPASSRLS) e o upload (objects + trigger em prefixes)
--   funciona. NENHUMA policy de storage precisou mudar.
-- ============================================================

grant anon, authenticated, service_role to supabase_storage_admin;

-- ============================================================
-- FIM da migração 0026.
-- ============================================================
