-- ============================================================
-- Kolo Família — Migração 0014
--   Adiciona campos jsonb 'categorias_extras' em perfil_vivo_membro e
--   perfil_vivo_familia pra cobrir as 26 categorias do Adendo PRD v1 §6
--   sem reestruturar o schema existente.
--
--   As 12 categorias-espelho das skills (Comunicação, Socialização,
--   Imitação, Motor, Autonomia, Aprendizado, Foco, Sono, Nutricional,
--   Tela/mídia, Escola, Saúde geral, Terapias) viram chaves dentro de
--   perfil_vivo_membro.categorias_extras.
--
--   As 7 transversais que vão no nível família (apoio_comunitario,
--   marcos_conquistas, estrategias_ativas, tela_midia, escola, saude_geral,
--   terapias) ficam em perfil_vivo_familia.categorias_extras quando fizer
--   sentido coletar no nível família.
--
--   Os 9 campos jsonb existentes (essencial, como_e, corpo_rotina,
--   desafios_regulacao, sensorial em membro; composicao, rotina, recursos,
--   dinamica em familia) seguem intactos.
-- ============================================================

alter table public.perfil_vivo_membro
  add column if not exists categorias_extras jsonb not null default '{}'::jsonb;

alter table public.perfil_vivo_familia
  add column if not exists categorias_extras jsonb not null default '{}'::jsonb;

notify pgrst, 'reload schema';
