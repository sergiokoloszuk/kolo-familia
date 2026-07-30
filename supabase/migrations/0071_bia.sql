-- ============================================================
-- Kolo Família — Migração 0071
--   BIA — Biblioteca de Inteligência da Ayla.
--
--   INFRAESTRUTURA APENAS. Nada nesta migração é lido por prompt, resposta,
--   plano ou PDF. A tabela nasce vazia e desconectada de propósito: o objetivo
--   desta etapa é ter ONDE guardar o conhecimento, não usá-lo ainda.
--
--   O que a BIA é (e o que ela NÃO é):
--   - NÃO é um segundo banco de práticas. `boas_praticas` (368 curadas pela
--     Karina) continua sendo a fonte da verdade do "O QUE FAZER". A BIA guarda
--     o "COMO PENSAR ANTES de escolher o que fazer" — perguntas investigativas,
--     cadeias de hipótese, regras SE/ENTÃO, sinais de alerta, fronteiras.
--   - NÃO substitui o perfil da criança, a memória da conversa, o contexto
--     familiar nem o PISO de segurança do Core (lib/conducao/diretrizes.ts).
--
--   Granularidade: 1 linha = 1 UNIDADE DE RACIOCÍNIO, não 1 parágrafo. Uma
--   regra SE/ENTÃO é uma linha. Uma pergunta investigativa vem SEMPRE junto da
--   sua interpretação (separadas, viram interrogatório — que é exatamente o que
--   o FREIO ANTI-ANAMNESE do Core proíbe).
--
--   Busca: `texto_busca` (tsvector português) + filtros de metadado. NÃO há
--   embedding aqui de propósito — pgvector é extensão nova neste Supabase
--   self-hosted (histórico de fragilidade) e a recuperação determinística das
--   BPs mostrou que filtro + pontuação textual já resolve. Quando/se a busca
--   semântica for aprovada, entra numa migração própria, de uma coluna.
-- ============================================================

create table if not exists public.bia_chunks (
  id uuid primary key default gen_random_uuid(),

  -- ----- Procedência (rastreabilidade pro painel admin e pra reimportação) -----
  documento_origem text not null,
  versao_documento text not null,
  pagina_origem int,
  -- Posição no documento. Preserva a ordem narrativa quando o chunk é exibido
  -- em sequência (ex.: revisão da Karina) e é o desempate estável na ordenação.
  ordem int not null default 0,

  -- ----- Onde este conhecimento mora -----
  titulo text,
  -- Os 12 núcleos + o capítulo transversal + a Parte I. NÃO inventar núcleos na
  -- importação: se um trecho não couber, ele entra em revisão, não num núcleo novo.
  nucleo text not null check (nucleo in (
    'fundamentos',            -- Parte I — inteligência de condução
    'regulacao_emocional',    -- Núcleo 1
    'sono',                   -- Núcleo 2
    'alimentacao',            -- Núcleo 3
    'rotina',                 -- Núcleo 4
    'sensorial',              -- Núcleo 5
    'comunicacao',            -- Núcleo 6
    'imitacao',               -- Núcleo 7
    'socializacao',           -- Núcleo 8
    'motor',                  -- Núcleo 9
    'autonomia',              -- Núcleo 10
    'aprendizagem',           -- Núcleo 11
    'foco_executivas',        -- Núcleo 12
    'pensamentos_crencas',    -- Capítulo transversal
    'brincadeiras_atividades' -- Anexo (catálogo)
  )),
  subnucleo text,
  -- Seção dentro do núcleo, nas palavras do próprio documento
  -- ("14. Conhecimento para IA", "7. Estratégias práticas", "TEMA 3 · A Luz e o Escuro").
  secao text,

  -- ----- Natureza do conhecimento -----
  -- Os 15 tipos da especificação. Um tipo a mais é um CHECK a mais — mudar isto
  -- é uma migração de uma linha, então não há motivo pra inventar agora.
  -- NOTA: crenças limitantes e "erros comuns dos adultos" entram hoje como
  -- 'interpretacao' (são reenquadres). Se virarem tipo próprio, é aqui.
  tipo_conhecimento text not null check (tipo_conhecimento in (
    'fundamento',
    'conceito',
    'pergunta_investigativa',
    'interpretacao',
    'estrategia',
    'regra_operacional',
    'principio_de_ouro',
    'explicacao_para_familia',
    'orientacao_para_escola',
    'sinal_de_alerta',
    'encaminhamento',
    'brincadeira',
    'atividade',
    'ferramenta',
    'cautela_cientifica'
  )),

  -- ----- Faixa etária -----
  -- Em MESES, porque a BIA mistura granularidades ("6-9 meses", "0-2 anos") e
  -- o perfil da criança guarda data de nascimento. `faixa_rotulo` preserva o
  -- rótulo original do documento ("3-5 anos") pra exibição e conferência.
  faixa_etaria_min_meses int check (faixa_etaria_min_meses >= 0),
  faixa_etaria_max_meses int check (faixa_etaria_max_meses >= 0),
  faixa_rotulo text,
  constraint bia_faixa_coerente check (
    faixa_etaria_min_meses is null
    or faixa_etaria_max_meses is null
    or faixa_etaria_min_meses <= faixa_etaria_max_meses
  ),

  -- ----- Recuperação (arrays = filtro por sobreposição, igual às tags da BP) -----
  publico text[] not null default '{}',                   -- familia | escola | terapeuta
  situacoes_relacionadas text[] not null default '{}',    -- banho, refeicao, escola, festa...
  habilidades_relacionadas text[] not null default '{}',
  diagnosticos_relacionados text[] not null default '{}',
  nucleos_relacionados text[] not null default '{}',

  -- ----- Conteúdo estruturado (o que a BIA tem de melhor) -----
  perguntas_investigativas text[] not null default '{}',
  hipoteses text[] not null default '{}',
  estrategias text[] not null default '{}',
  o_que_evitar text[] not null default '{}',
  quando_encaminhar text,

  -- ----- Segurança -----
  nivel_de_cautela text not null default 'baixo' check (nivel_de_cautela in (
    'baixo',
    'moderado',
    'alto',
    'nao_usar_sem_contexto',
    'requer_encaminhamento'
  )),
  -- Só para perguntas: a resposta muda a conduta? É o mesmo critério que o
  -- decisor de entrega já usa (lib/ayla/prontidao-plano.ts) e o freio
  -- anti-anamnese do Core. Pergunta que não muda conduta não deve ser feita.
  muda_conduta boolean,

  -- ----- Texto -----
  texto_original text not null,
  -- Full-text em português. Sem extensão, sem dependência: só o dicionário
  -- padrão do Postgres. É o índice que um retriever futuro usaria primeiro.
  texto_busca tsvector generated always as (
    to_tsvector(
      'portuguese',
      coalesce(titulo, '') || ' ' ||
      coalesce(secao, '') || ' ' ||
      coalesce(subnucleo, '') || ' ' ||
      coalesce(array_to_string(situacoes_relacionadas, ' '), '') || ' ' ||
      coalesce(array_to_string(habilidades_relacionadas, ' '), '') || ' ' ||
      texto_original
    )
  ) stored,

  -- ----- Controle de importação -----
  -- sha256 do conteúdo + procedência. Reimportar o mesmo documento não duplica:
  -- o ON CONFLICT do importer bate aqui.
  hash text not null,
  ativo boolean not null default true,
  -- O importer NÃO adivinha. Quando não consegue classificar com segurança,
  -- marca revisão em vez de chutar um tipo. Nada com revisao_pendente deveria
  -- chegar a um prompt sem passar pela Karina.
  revisao_pendente boolean not null default false,
  revisao_motivo text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Idempotência da importação.
create unique index if not exists bia_chunks_hash_idx
  on public.bia_chunks(hash);

-- Busca textual.
create index if not exists bia_chunks_busca_idx
  on public.bia_chunks using gin(texto_busca);

-- Filtros de recuperação por sobreposição de arrays.
create index if not exists bia_chunks_situacoes_idx
  on public.bia_chunks using gin(situacoes_relacionadas);
create index if not exists bia_chunks_habilidades_idx
  on public.bia_chunks using gin(habilidades_relacionadas);

-- O corte mais comum: núcleo + tipo, só o que está ativo.
create index if not exists bia_chunks_nucleo_tipo_idx
  on public.bia_chunks(nucleo, tipo_conhecimento)
  where ativo;

-- Ordem narrativa dentro do documento (revisão, exibição sequencial).
create index if not exists bia_chunks_ordem_idx
  on public.bia_chunks(documento_origem, ordem);

-- updated_at automático (helper já existe no banco desde 0001).
drop trigger if exists bia_chunks_set_updated_at on public.bia_chunks;
create trigger bia_chunks_set_updated_at before update on public.bia_chunks
  for each row execute function public.set_updated_at();

-- ----- RLS -----
-- Conteúdo CURADO, não dado de família: espelha exatamente boas_praticas/aulas
-- (0002_rls.sql) — leitura para autenticados só do que está ativo, escrita só
-- admin. O importer roda com service role, que passa por cima de RLS.
alter table public.bia_chunks enable row level security;

drop policy if exists bia_chunks_read on public.bia_chunks;
create policy bia_chunks_read on public.bia_chunks
  for select to authenticated using (ativo);

drop policy if exists bia_chunks_admin on public.bia_chunks;
create policy bia_chunks_admin on public.bia_chunks
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

comment on table public.bia_chunks is
  'BIA — Biblioteca de Inteligência da Ayla. Unidades de RACIOCÍNIO clínico (como pensar), complementares às boas_praticas (o que fazer). Migração 0071: infraestrutura apenas, nenhum consumidor.';
