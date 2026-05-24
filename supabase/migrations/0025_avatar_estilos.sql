-- ============================================================
-- Kolo Família — Migração 0025
--   Mais estilos de avatar além de cartoon/aquarela.
--   Solta o CHECK de avatares_membros_atipicos.estilo.
--   Fonte única dos estilos: apps/web/src/lib/imagem/avatar-prompt.ts
-- ============================================================

alter table public.avatares_membros_atipicos
  drop constraint if exists avatares_membros_atipicos_estilo_check;

alter table public.avatares_membros_atipicos
  add constraint avatares_membros_atipicos_estilo_check
  check (estilo in (
    'cartoon',
    'aquarela',
    'livro_infantil',
    'lapis_cor',
    'massinha_3d',
    'papel_recortado',
    'line_art'
  ));

-- ============================================================
-- FIM da migração 0025.
-- Lembrar: após aplicar, rodar NOTIFY pgrst, 'reload schema'
-- (PostgREST cacheia constraints/colunas).
-- ============================================================
