-- ============================================================
-- Kolo Família — Migração 0077
--   `ayla_documentos`: os documentos de inteligência da Ayla — o Core hoje,
--   e no Passo 2 o Trial e os Artefatos — com rascunho, versão ativa,
--   histórico e rollback.
--
--   ⚠️ POR QUE UMA TABELA NOVA, e não `ai_prompts`.
--   PROVEI POR EXECUÇÃO em 15/08/2026: `ai_prompts` tem `key text primary key`,
--   e um segundo INSERT com a mesma chave devolve
--   `23505 duplicate key value violates unique constraint "ai_prompts_pkey"`.
--   Ou seja: uma linha por chave, e a coluna `versao` é um contador — não há
--   como coexistirem rascunho, ativo e histórico.
--
--   Trocar o PK de `ai_prompts` resolveria, mas ela é lida por
--   `getSystemPrompt`, que está no caminho do PARSER da Ayla legacy e usa
--   `.maybeSingle()` — duas linhas ativas para a mesma chave fariam essa
--   leitura LANÇAR, quebrando o parser de todas as famílias. Não vale ampliar
--   o raio de alcance para economizar uma tabela.
--
--   `ai_prompts` fica INTOCADA por esta migração.
-- ============================================================

create table if not exists public.ayla_documentos (
  id uuid primary key default gen_random_uuid(),
  -- Qual documento: 'core' hoje; 'trial' e 'artefato_*' no Passo 2.
  chave text not null,
  versao int not null,
  -- ⚠️ TRÊS ESTADOS, e só um 'ativo' por chave (índice parcial abaixo).
  -- 'rascunho' é o que o simulador usa; 'ativo' é o que a Ayla usa;
  -- 'arquivado' é o histórico, de onde sai o rollback.
  status text not null check (status in ('rascunho', 'ativo', 'arquivado')),
  conteudo text not null,
  -- Quem publicou. Publicar um Core novo é operação de alto impacto e
  -- precisa de dono — mas `null` é aceito porque o seed inicial não tem autor.
  publicado_por uuid references auth.users(id) on delete set null,
  publicado_em timestamptz,
  nota text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Uma versão é única dentro da chave: é isso que dá histórico.
create unique index if not exists ayla_documentos_chave_versao_idx
  on public.ayla_documentos (chave, versao);

-- ⚠️ O ÍNDICE QUE SUSTENTA A LEITURA. No máximo UM 'ativo' por chave, e o
-- banco garante — não o código. Sem ele, uma publicação com falha no meio
-- deixaria duas versões ativas e o carregador teria de escolher no chute.
create unique index if not exists ayla_documentos_um_ativo_idx
  on public.ayla_documentos (chave) where status = 'ativo';

-- Idem para rascunho: um por chave, senão "o rascunho" deixa de ter sentido.
create unique index if not exists ayla_documentos_um_rascunho_idx
  on public.ayla_documentos (chave) where status = 'rascunho';

-- A leitura da conversa é sempre "os ativos" — índice para ela.
create index if not exists ayla_documentos_ativos_idx
  on public.ayla_documentos (status, chave) where status = 'ativo';

drop trigger if exists ayla_documentos_set_updated_at on public.ayla_documentos;
create trigger ayla_documentos_set_updated_at
  before update on public.ayla_documentos
  for each row execute function public.set_updated_at();

-- RLS: só admin. Mesmo padrão de `ai_prompts` (0012). A Ayla lê pelo
-- service-role, que não passa por RLS.
alter table public.ayla_documentos enable row level security;

drop policy if exists ayla_documentos_admin_all on public.ayla_documentos;
create policy ayla_documentos_admin_all on public.ayla_documentos
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ⚠️ SEM SEED AQUI. O conteúdo do Core é uma string de 13 mil caracteres com
-- crases, aspas e cifrões — escapá-la em SQL inline é frágil e já quebrou
-- neste repositório. O seed vive em `scripts/seed-core-ayla.mjs`, e enquanto
-- ele não roda o fallback do código responde. Que é exatamente o
-- comportamento que queremos provar.

-- ROLLBACK:
--   drop table public.ayla_documentos;
-- Nada mais depende dela: o carregador cai no Core do código.

notify pgrst, 'reload schema';
