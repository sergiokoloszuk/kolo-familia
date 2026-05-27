-- ============================================================
-- Kolo Família — Migração 0032
--   Campo `genero` em membros_atipicos pra a Ayla saber se usa
--   "o/dele/ele", "a/dela/ela" ou neutro nas mensagens.
--   Default null = "prefiro não dizer" → cai no neutro.
--   Backfill: quem já tem avatar com `generoVisual` definido
--   aproveita esse valor (a mãe já respondeu uma vez quando criou
--   o avatar).
-- ============================================================

alter table public.membros_atipicos
  add column if not exists genero text
    check (genero in ('masculino', 'feminino', 'neutro'));

-- Backfill do avatar pros membros que já existem
update public.membros_atipicos m
set genero = case
    when av.descricao_textual->>'generoVisual' = 'menino' then 'masculino'
    when av.descricao_textual->>'generoVisual' = 'menina' then 'feminino'
    when av.descricao_textual->>'generoVisual' = 'neutro' then 'neutro'
    else null
  end
from public.avatares_membros_atipicos av
where av.membro_atipico_id = m.id
  and m.genero is null
  and av.descricao_textual->>'generoVisual' is not null;

notify pgrst, 'reload schema';

-- ============================================================
-- FIM da migração 0032.
-- ============================================================
