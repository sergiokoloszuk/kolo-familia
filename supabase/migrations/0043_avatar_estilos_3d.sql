-- ============================================================
-- Kolo Família — Migração 0043
--   Estilos de avatar 3D/boneco (Disney/Playmobil/massinha…).
--   Solta DE VEZ o CHECK de avatares_membros_atipicos.estilo: a validação
--   passa a ser só no app (zod AVATAR_ESTILO_VALUES). Assim, mudar a lista de
--   estilos vira SÓ código/deploy — nunca mais precisa migrar o banco.
--   Avatares antigos (estilo 'cartoon', 'aquarela'…) seguem válidos.
--   Fonte única dos estilos: apps/web/src/lib/imagem/avatar-prompt.ts
-- ============================================================

alter table public.avatares_membros_atipicos
  drop constraint if exists avatares_membros_atipicos_estilo_check;

-- PostgREST cacheia constraints/colunas — recarrega o schema.
notify pgrst, 'reload schema';

-- ============================================================
-- FIM da migração 0043.
-- ============================================================
