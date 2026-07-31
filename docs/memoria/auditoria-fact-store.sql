-- KIT DE AUDITORIA DO FACT STORE
-- Somente leitura. Nenhuma consulta aqui altera dado — seguras em produção.
-- Referência: docs/memoria-longitudinal-prompt-mestre.md

-- ============================================================
-- 1. VOLUME
-- ============================================================
select count(*) as total, min(created_at) as primeiro, max(created_at) as ultimo,
       count(distinct membro_atipico_id) as pessoas,
       count(distinct family_account_id) as familias
  from public.perfil_fatos;

select source_channel,      count(*) from public.perfil_fatos group by 1 order by 2 desc;
select source_type,         count(*) from public.perfil_fatos group by 1 order by 2 desc;
select verification_status, count(*) from public.perfil_fatos group by 1 order by 2 desc;
select fact_kind,           count(*) from public.perfil_fatos group by 1 order by 2 desc;
select dominio,             count(*) from public.perfil_fatos group by 1 order by 2 desc;

-- Conceitos mais frequentes e quão heterogêneos são. Muitas afirmações
-- distintas sob um conceito = está agrupando coisas incompatíveis.
select conceito, count(*) as fatos, count(distinct afirmacao) as afirmacoes_distintas
  from public.perfil_fatos group by 1 order by 2 desc limit 40;

-- ============================================================
-- 2. VERSÕES DO EXTRATOR — separar conjuntos antes de comparar qualidade
-- ============================================================
select extractor_version, count(*), min(created_at), max(created_at)
  from public.perfil_fatos group by 1 order by 3;

-- Diferença de comportamento entre versões (rodar depois de haver duas).
select extractor_version,
       round(100.0*count(*) filter (where conceito = dominio)/count(*),1) as pct_conceito_amplo,
       round(100.0*count(*) filter (where verification_status='confirmed')/count(*),1) as pct_confirmed,
       round(100.0*count(*) filter (where verification_status='uncertain')/count(*),1) as pct_uncertain
  from public.perfil_fatos group by 1 order by 1;

-- ============================================================
-- 3. PROVENIÊNCIA — cada número > 0 é defeito
-- ============================================================
select
  count(*) filter (where membro_atipico_id is null)                         as sem_pessoa,
  count(*) filter (where source_channel is null)                            as sem_canal,
  count(*) filter (where source_type is null)                               as sem_tipo_fonte,
  count(*) filter (where observado_em is null)                              as sem_data,
  count(*) filter (where extractor_version is null)                         as sem_versao,
  count(*) filter (where source_channel = 'whatsapp'
                     and source_message_id is null)                         as wpp_sem_mensagem,
  count(*) filter (where source_channel = 'diario'
                     and source_message_id is not null)                     as diario_com_msg_inventada,
  count(*) filter (where source_channel = 'diario'
                     and source_actor_id is null)                           as diario_sem_autor,
  count(*) filter (where source_message_id is null and source_actor_id is null
                     and source_actor_label is null)                        as sem_proveniencia_alguma
  from public.perfil_fatos;

-- Datas: observado_em nunca deve ser futuro, e "tudo hoje" indica que a data
-- histórica do relato não está sendo capturada.
select count(*) filter (where observado_em > current_date)      as data_no_futuro,
       count(*) filter (where observado_em = current_date)      as data_hoje,
       count(*) filter (where observado_em_preciso)             as data_precisa
  from public.perfil_fatos;

-- ============================================================
-- 4. EPISTEMOLOGIA — qualquer linha aqui é bug
-- ============================================================

-- Regra central: a IA deduziu ⇒ inferred. Não há exceção.
select id, conceito, source_channel, verification_status
  from public.perfil_fatos
 where source_type = 'ai_inference' and verification_status <> 'inferred';

-- `confirmed` significa "algo antes incerto foi validado". Enquanto não
-- existir fluxo de validação, ESTE RESULTADO DEVE SER ZERO.
select source_channel, extractor_version, count(*)
  from public.perfil_fatos where verification_status = 'confirmed'
 group by 1,2 order by 3 desc;

-- Extração automática da web gravada como relato direto.
select count(*) as automatico_como_reported from public.perfil_fatos
 where source_channel = 'web' and source_conversation_id is not null
   and verification_status in ('reported','confirmed');

-- ============================================================
-- 5. CONCEITO
-- ============================================================
select round(100.0*count(*) filter (where conceito = dominio)/nullif(count(*),0),1)
         as pct_conceito_igual_dominio from public.perfil_fatos;

select dominio, source_channel, count(*) as total,
       count(*) filter (where conceito = dominio) as amplos,
       round(100.0*count(*) filter (where conceito = dominio)/count(*),1) as pct
  from public.perfil_fatos group by 1,2 order by 5 desc;

select id, conceito from public.perfil_fatos
 where conceito is null or btrim(conceito) = '' or length(conceito) < 3;

-- Mesma afirmação com conceitos diferentes: quebra de paridade entre canais.
select afirmacao, count(distinct conceito) as conceitos,
       array_agg(distinct source_channel) as canais
  from public.perfil_fatos group by 1 having count(distinct conceito) > 1;

-- ============================================================
-- 6. IDEMPOTÊNCIA
-- ============================================================

-- Deve ser vazio: o unique index impede. Se aparecer, o índice não existe.
select idempotency_key, count(*) from public.perfil_fatos
 group by 1 having count(*) > 1;

-- Repetição legítima (mensagens diferentes) NÃO é defeito: é a matéria-prima
-- da recorrência. Só medir volume.
select membro_atipico_id, conceito, afirmacao, count(*) as evidencias,
       count(distinct source_message_id) as mensagens, min(observado_em), max(observado_em)
  from public.perfil_fatos group by 1,2,3 having count(*) > 1 order by 4 desc limit 30;

-- Uma mensagem gerando muitos fatos: extração fragmentada demais.
select source_message_id, count(*) from public.perfil_fatos
 where source_message_id is not null group by 1 having count(*) > 4 order by 2 desc;

-- ============================================================
-- 7. ESCOPO
-- ============================================================
select escopo_tipo, escopo_id, count(*) from public.perfil_fatos group by 1,2 order by 3 desc;

-- Enquanto a Fase 8 não criar a fonte de participação, TUDO deve estar em
-- 'sempre'. Outra coisa veio de teste com resolvedor injetado.
select count(*) as fora_do_padrao from public.perfil_fatos where escopo_tipo <> 'sempre';

-- ============================================================
-- 8. PESSOA — o risco que continua bloqueador
-- ============================================================

-- Distribuição por membro. Concentração de 100% num membro, em família com
-- mais de um filho, é sinal de foco preso.
select family_account_id, membro_atipico_id, count(*)
  from public.perfil_fatos group by 1,2 order by 1, 3 desc;

-- TRIAGEM para leitura humana. A barreira de sujeito deveria ter barrado estes
-- casos; qualquer resultado aqui é um falso negativo da barreira.
select id, membro_atipico_id, conceito, left(afirmacao, 120) as trecho
  from public.perfil_fatos
 where afirmacao ~* '(irm[ãa]o?|primo|prima|meu outro filho|minha outra filha|os dois|as duas)'
 order by created_at desc limit 50;

select id, conceito, left(afirmacao, 120) as trecho
  from public.perfil_fatos
 where afirmacao ~* '(eu (estou|t[oô]|n[ãa]o)|me sinto|n[ãa]o aguento)'
 order by created_at desc limit 50;

-- ============================================================
-- 9. AMOSTRA PARA LEITURA HUMANA
-- ============================================================
select id, source_channel, source_type, verification_status, fact_kind,
       dominio, conceito, contexto, observado_em, escopo_tipo, extractor_version,
       left(afirmacao, 160) as afirmacao
  from public.perfil_fatos order by random() limit 30;
