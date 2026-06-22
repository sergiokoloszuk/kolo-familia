-- ============================================================
-- Kolo Família — Migração 0048
--   Modo de exibição da rotina: "cartoes" (imagem) ou "lista".
--   A pessoa escolhe; persiste por rotina. Default = cartoes (imagem não é
--   impeditiva; quem preferir troca pra lista). A historinha só acompanha
--   no modo cartoes.
-- ============================================================

alter table public.rotinas
  add column if not exists modo_exibicao text not null default 'cartoes';

notify pgrst, 'reload schema';

-- ============================================================
-- FIM da migração 0048.
-- ============================================================
