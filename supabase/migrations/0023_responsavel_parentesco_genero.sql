-- ============================================================
-- Kolo Família — Migração 0023
--   Identificação do cuidador além de "mãe": grau de parentesco livre
--   (quando "Outro responsável") e gênero do responsável, pra a Ayla
--   tratar de forma humanizada (não presumir mãe nem gênero).
--
--   `papel` já existe em family_profiles (mae/pai/avo/outro). Aqui só
--   acrescentamos os dois campos de detalhe do "Outro responsável".
-- ============================================================

alter table public.family_profiles
  add column if not exists papel_outro text,
  add column if not exists genero_responsavel text
    check (genero_responsavel in ('masculino', 'feminino', 'neutro'));

comment on column public.family_profiles.papel_outro is
  'Grau de parentesco livre quando papel = ''outro'' (ex.: avó, tia, madrinha, tutor).';
comment on column public.family_profiles.genero_responsavel is
  'Gênero do responsável quando papel = ''outro'' (ou ''avo''): masculino|feminino|neutro. Usado pela Ayla pra concordância ao se dirigir ao cuidador.';

notify pgrst, 'reload schema';
