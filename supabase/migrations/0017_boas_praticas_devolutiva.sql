-- ============================================================
-- Kolo Família — Migração 0017
--   Ajusta `boas_praticas` para o import do XLSX de 349 BPs
--   curadas pela Karina (devolutiva 17/05/2026).
--
--   Mudanças:
--   1. Adiciona `crencas_adulto` (text)
--      — prosa livre da crença limitante que a BP ajuda a derrubar.
--   2. Adiciona `atividades_praticas` (jsonb, default '[]')
--      — array opcional de 0-3 atividades concretas.
--   3. Converte `erros_comuns` de jsonb → text
--      — frase única em prosa em vez de array. Coerência com
--      `crencas_adulto` (prosa) e elimina formatação JSON-em-célula
--      no XLSX da Karina.
--
--   Pré-condição: as 3 linhas existentes têm erros_comuns IS NULL
--   (verificado em 17/05/2026), então a conversão de tipo não
--   precisa de coerção de dados.
-- ============================================================

alter table public.boas_praticas
  add column if not exists crencas_adulto text,
  add column if not exists atividades_praticas jsonb not null default '[]'::jsonb;

-- Nota: PG15 rejeita subquery em transform expression do ALTER COLUMN ... USING
-- (`cannot use subquery in transform expression`). Como em 17/05/2026 todas as
-- linhas existentes tinham erros_comuns IS NULL (verificado antes de rodar),
-- o cast direto ::text é seguro. Se um dia rodar isto num DB com arrays jsonb
-- de verdade, faça antes um UPDATE manual normalizando os arrays para prosa.
alter table public.boas_praticas
  alter column erros_comuns type text
  using erros_comuns::text;

notify pgrst, 'reload schema';
