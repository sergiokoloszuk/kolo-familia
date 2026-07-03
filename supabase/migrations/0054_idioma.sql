-- ============================================================
-- Kolo Família — Migração 0054
--   Idioma da família (pt/es/en). Define a língua da plataforma e das
--   mensagens PROATIVAS da Ayla, e serve de dica para a transcrição de áudio.
--
--   Padrão 'pt' — o Brasil não muda em nada. A ORIGEM define o padrão no
--   cadastro (landing PT → pt; landing ES → es via ?lang=es), a pessoa valida
--   no onboarding e pode trocar em Configurações a qualquer momento.
--
--   IMPORTANTE (PostgREST): depois de aplicar, RECARREGUE o schema cache —
--   senão a API acusa "Could not find the 'idioma' column ... in the schema
--   cache" (foi o que quebrou a atribuição de UTM na 0052):
--       NOTIFY pgrst, 'reload schema';
--   (ou reinicie SÓ o container 'rest' — NUNCA o postgres.)
-- ============================================================

alter table public.family_accounts
  add column if not exists idioma text not null default 'pt'
    check (idioma in ('pt', 'es', 'en'));
