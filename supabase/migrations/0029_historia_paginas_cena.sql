-- ============================================================
-- Kolo Família — Migração 0029
--   historia_paginas.cena — descrição visual da cena que o Sonnet
--   gerou e que o gpt-image-1 usa pra ilustrar. Sem isso não dá pra
--   regerar uma página individual quando a ilustração falha.
-- ============================================================

alter table public.historia_paginas
  add column if not exists cena text;

notify pgrst, 'reload schema';

-- ============================================================
-- FIM da migração 0029.
-- ============================================================
