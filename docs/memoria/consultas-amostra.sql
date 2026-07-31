-- ============================================================
-- CONSULTAS DA AMOSTRA CONTROLADA
-- Protocolo: docs/memoria/amostra-controlada.md
-- Complementa auditoria-fact-store.sql (que é a auditoria geral).
-- Somente leitura, EXCETO o bloco 5, que é explicitamente de escrita.
-- ============================================================


-- ============================================================
-- BLOCO 1 — VALIDAÇÃO PÓS-MIGRAÇÃO
-- Rodar após CADA migração. Parar na primeira divergência.
-- ============================================================

-- 1.1 A tabela existe.
--     Esperado: 1
--     Divergente: 0 = a migração não aplicou. Não avance; leia o erro do psql.
select count(*) as tabela_existe from information_schema.tables
 where table_schema = 'public' and table_name = 'perfil_fatos';

-- 1.2 Contagem de colunas.
--     Esperado: 42
--     Divergente: menos = migração parcial (transação abortada no meio?).
--     Ação: rodar o rollback e reaplicar.
select count(*) as colunas from information_schema.columns
 where table_schema = 'public' and table_name = 'perfil_fatos';

-- 1.3 Índices.
--     Esperado: 11 (inclui a PK).
--     Divergente: falta o unique de idempotência = duplicata passa. PARE.
select count(*) as total, bool_or(indexname = 'perfil_fatos_idempotency_uk') as tem_unique
  from pg_indexes where tablename = 'perfil_fatos';

select indexname from pg_indexes where tablename = 'perfil_fatos' order by 1;

-- 1.4 Policies.
--     Esperado: 3 — select (r), insert (a), all (*).
--     Divergente: sem a de INSERT, diário e web manual falham EM SILÊNCIO.
select polname, polcmd from pg_policy
 where polrelid = 'public.perfil_fatos'::regclass order by 1;

-- 1.5 RLS ativo.
--     Esperado: t
--     Divergente: f = qualquer autenticado lê tudo. PARE.
select relrowsecurity as rls_ativo from pg_class where relname = 'perfil_fatos';

-- 1.6 Constraints CHECK esperadas.
--     Esperado: 8 (fact_kind, escopo_tipo, source_type, source_channel,
--     verification_status, temporal_status, status, sujeito_classificado,
--     quarentena_resolucao, relacao_origem — algumas contam junto).
--     Divergente: menos = valor inválido entra no banco.
select conname from pg_constraint
 where conrelid = 'public.perfil_fatos'::regclass and contype = 'c' order by 1;

-- 1.7 Tabela vazia no início.
--     Esperado: 0
--     Divergente: > 0 = alguém já ligou a flag. Investigue antes de seguir.
select count(*) as fatos from public.perfil_fatos;

-- 1.8 Funções e trigger de que a 0073 depende (vêm da 0001).
--     Esperado: as duas funções presentes.
select proname from pg_proc
 where proname in ('is_admin', 'current_family_account_id') order by 1;

-- 1.9 A 0071 (BIA) e a 0072 aplicaram.
--     Esperado: 1 e 1.
select
  (select count(*) from information_schema.tables
    where table_schema='public' and table_name='bia_chunks')        as bia,
  (select count(*) from information_schema.tables
    where table_schema='public' and table_name='ayla_publicacoes')  as publicacoes;

-- 1.10 A coluna gerada da BIA funciona (o defeito de imutabilidade que a
--      validação contra Postgres encontrou).
--      Esperado: a query roda sem erro.
select count(*) as chunks_com_busca from public.bia_chunks where texto_busca is not null;


-- ============================================================
-- BLOCO 2 — FASE INTERNA: o contrato do PostgREST (H1)
-- Rodar imediatamente após enviar a MESMA mensagem duas vezes.
-- ============================================================

-- 2.1 Quantas linhas existem para a mensagem repetida.
--     Esperado: 1
--     Divergente: 2 = `ignoreDuplicates` NÃO se comporta como assumimos.
--     Ação: DESLIGAR A FLAG. Ver amostra-controlada.md §7.1.
select source_message_id, count(*) as linhas,
       count(distinct idempotency_key) as chaves
  from public.perfil_fatos
 where source_message_id is not null
 group by 1 order by 2 desc;

-- 2.2 Chave de idempotência duplicada.
--     Esperado: vazio (o índice único impede).
--     Divergente: qualquer linha = o índice não existe. PARE.
select idempotency_key, count(*) from public.perfil_fatos
 group by 1 having count(*) > 1;

-- 2.3 A telemetria classificou certo?
--     Esperado: 1 evento `perfil_fato_gravado` e 1 `perfil_fato_duplicado`.
--     Divergente: 2 `gravado` = o serviço leu conflito como inserção nova.
--     É o cenário que corrompe a recorrência sem sintoma visível.
select kind, count(*) from public.eventos_app
 where kind like 'perfil_fato%' and created_at > now() - interval '1 hour'
 group by 1 order by 2 desc;

-- 2.4 Estado geral após a fase interna.
select status, verification_status, count(*)
  from public.perfil_fatos group by 1,2 order by 3 desc;


-- ============================================================
-- BLOCO 3 — AUDITORIA DIÁRIA (5 minutos)
-- Cada consulta traz a classificação do resultado.
-- ============================================================

-- 3.1 Volume do dia.  [normal — só contexto]
select date(created_at) as dia, source_channel, status, count(*)
  from public.perfil_fatos
 where created_at >= current_date - 1
 group by 1,2,3 order by 1 desc, 4 desc;

-- 3.2 Os três incidentes epistemológicos.
--     Qualquer valor > 0 → INTERROMPER IMEDIATAMENTE.
select
  count(*) filter (where source_type = 'ai_inference'
                     and verification_status <> 'inferred')  as ia_desalinhada,
  count(*) filter (where verification_status = 'confirmed')  as confirmed_indevido,
  count(*) filter (where escopo_tipo <> 'sempre')            as escopo_fora_do_padrao
  from public.perfil_fatos;

-- 3.3 Proveniência e evidência.
--     sem_proveniencia > 0 → INTERROMPER.  sem_evidencia > 0 → PAUSAR.
select
  count(*) filter (where source_message_id is null
                     and source_actor_id is null
                     and source_actor_label is null)  as sem_proveniencia,
  count(*) filter (where source_content_id is null)   as sem_evidencia,
  count(*) filter (where extraction_run_id is null)   as sem_execucao
  from public.perfil_fatos;

-- 3.4 Duplicação técnica.  [> 0 → PAUSAR]
select count(*) as chaves_duplicadas from (
  select idempotency_key from public.perfil_fatos group by 1 having count(*) > 1
) t;

-- 3.5 Quarentena sobre ativos.
--     < 15% normal · 15–40% investigar · > 40% PAUSAR
select
  count(*) filter (where status = 'ativo')       as ativos,
  count(*) filter (where status = 'quarentena')  as quarentena,
  round(100.0 * count(*) filter (where status='quarentena')
        / nullif(count(*) filter (where status='ativo'), 0), 1) as pct
  from public.perfil_fatos;

-- 3.6 Falhas registradas hoje.  [> 0 → investigar hoje]
select kind, count(*) from public.eventos_app
 where kind in ('perfil_fato_falhou','perfil_fato_rejeitado')
   and created_at >= current_date
 group by 1;

-- 3.7 TRIAGEM: menção à cuidadora.
--     Qualquer linha ATIVA aqui é falso negativo da barreira de sujeito.
--     → INTERROMPER IMEDIATAMENTE e ler o fato.
select id, status, membro_atipico_id, left(afirmacao, 120) as trecho
  from public.perfil_fatos
 where status = 'ativo'
   and afirmacao ~* '(eu (estou|t[oô]|n[ãa]o)|me sinto|n[ãa]o aguento|minha vida)'
 order by created_at desc;

-- 3.8 TRIAGEM: menção a irmão ou outra criança.  [ativa → INTERROMPER]
select id, status, membro_atipico_id, left(afirmacao, 120) as trecho
  from public.perfil_fatos
 where status = 'ativo'
   and afirmacao ~* '(irm[ãa]o?|primo|prima|meu outro filho|minha outra filha|os dois|as duas)'
 order by created_at desc;

-- 3.9 TRIAGEM: menção a terceira pessoa.  [ativa → investigar hoje]
select id, status, left(afirmacao, 120) as trecho
  from public.perfil_fatos
 where status = 'ativo'
   and afirmacao ~* '(a professora|o professor|a terapeuta|a fono|o m[ée]dico|meu marido)'
 order by created_at desc;

-- 3.10 Domínios sensíveis marcados.  [normal — acompanhar]
select unnest(dominios_sensiveis) as dominio, count(*)
  from public.perfil_fatos where cardinality(dominios_sensiveis) > 0
 group by 1 order by 2 desc;

-- 3.11 Conceito amplo demais.
--      < 30% normal · 30–50% investigar · > 50% decisão arquitetural
select count(*) as total,
       count(*) filter (where conceito = dominio) as amplos,
       round(100.0*count(*) filter (where conceito = dominio)/nullif(count(*),0),1) as pct
  from public.perfil_fatos where status = 'ativo';

-- 3.12 Vazamento de texto em log.
--      Esperado: 0. Qualquer linha → INTERROMPER IMEDIATAMENTE.
--      (Compara o início de afirmações com o payload dos eventos.)
select count(*) as eventos_com_texto from public.eventos_app e
 where e.kind like 'perfil_fato%'
   and exists (
     select 1 from public.perfil_fatos f
      where e.payload::text like '%' || left(f.afirmacao, 25) || '%'
   );

-- 3.13 Foco frágil por família.
--      Alta concentração numa família multi-membro → `ctx.membros[0]`.
select family_account_id,
       count(*) filter (where status='quarentena'
                          and quarentena_motivo = 'foco_fragil') as foco_fragil,
       count(*) as total
  from public.perfil_fatos group by 1 order by 2 desc;


-- ============================================================
-- BLOCO 4 — REVISÃO HUMANA (listagens de apoio)
-- ============================================================

-- 4.1 Fatos ativos para revisão de PESSOA (meta: 100%).
select id, source_channel, membro_atipico_id, dominio, conceito,
       observado_em::text as data, left(afirmacao, 200) as afirmacao
  from public.perfil_fatos where status = 'ativo' order by created_at;

-- 4.2 Amostra aleatória para fidelidade e atomicidade (meta: ≥ 50).
select id, source_channel, dominio, conceito, fact_kind,
       verification_status, source_content_id,
       left(afirmacao, 200) as afirmacao
  from public.perfil_fatos where status = 'ativo' order by random() limit 60;

-- 4.3 Fila de quarentena ainda não resolvida.
select id, quarentena_motivo, sujeito_classificado, source_channel,
       membro_atipico_id, left(afirmacao, 160) as afirmacao, created_at
  from public.perfil_fatos
 where status = 'quarentena' and quarentena_resolucao is null
 order by created_at;

-- 4.4 Evidência não recuperável — o fato existe, a origem não.
--     Confere apenas o WhatsApp; os outros canais exigem join próprio.
select f.id, f.source_content_id
  from public.perfil_fatos f
 where f.source_content_id like 'whatsapp_turn:%'
   and not exists (
     select 1 from public.ayla_messages m
      where m.zaap_message_id = split_part(f.source_content_id, ':', 2)
   );


-- ============================================================
-- BLOCO 5 — ESCRITA CONTROLADA (quarentena)
-- ⚠️ ÚNICO bloco que altera dado. Uma linha por vez, com id explícito.
-- Ver amostra-controlada.md §13 para o que NÃO pode ser feito.
-- ============================================================

-- 5.1 LIBERAR — o fato era legítimo e o sujeito estava certo.
update public.perfil_fatos
   set status = 'ativo',
       quarentena_resolucao = 'liberado',
       quarentena_resolvido_em = now(),
       quarentena_resolvido_por = '<uuid-do-revisor>'
 where id = '<uuid-do-fato>' and status = 'quarentena';

-- 5.2 DESCARTAR — não deveria ter virado fato.
--     `invalidado`, NÃO delete: apagar destrói a evidência do erro.
update public.perfil_fatos
   set status = 'invalidado',
       quarentena_resolucao = 'descartado',
       quarentena_resolvido_em = now(),
       quarentena_resolvido_por = '<uuid-do-revisor>',
       relacao_motivo = '<motivo curto>'
 where id = '<uuid-do-fato>' and status = 'quarentena';

-- 5.3 EXPIRAR — ninguém revisou a tempo e o contexto se perdeu.
update public.perfil_fatos
   set quarentena_resolucao = 'expirado',
       quarentena_resolvido_em = now(),
       quarentena_resolvido_por = '<uuid-do-revisor>'
 where id = '<uuid-do-fato>' and status = 'quarentena';

-- 5.4 REATRIBUIR — BLOQUEADO nesta amostra.
--     Mudar `membro_atipico_id` reescreveria história. O correto é invalidar e
--     criar um fato novo com `invalidates_fact_id`, e esse serviço não existe.
--     Registre a CONTAGEM de casos; ela é resultado da amostra.
select count(*) as casos_que_pediriam_reatribuicao
  from public.perfil_fatos
 where status = 'quarentena' and quarentena_motivo = 'conflito_de_nome';


-- ============================================================
-- BLOCO 6 — EXPORTAÇÃO E EXCLUSÃO
-- Quatro finalidades diferentes. Não confundir.
-- ============================================================

-- 6.1 EXPORTAR antes de qualquer remoção. Sempre.
copy (
  select * from public.perfil_fatos
   where extractor_version = 'kv-blob-v2'
) to stdout with (format csv, header);

-- 6.2 EXCLUSÃO a pedido da família — só APÓS exportar (6.1).
--     Único uso legítimo de DELETE nesta operação.
delete from public.perfil_fatos
 where family_account_id = '<uuid-da-familia>'
   and extractor_version = 'kv-blob-v2';

-- 6.3 ENCERRAR a amostra descartando o acervo — só após exportar e relatar.
--     NUNCA sem o filtro de versão: apagaria conjuntos de outras fases.
delete from public.perfil_fatos where extractor_version = 'kv-blob-v2';
