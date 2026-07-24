-- ============================================================================
-- FASE DE OBSERVAÇÃO — Perfil Vivo v2
-- Amostragem + extração pra classificação MANUAL. NÃO altera nada no banco.
-- Rodar no Supabase de produção (self-hosted). Sem nomes: use só IDs internos.
-- Domínios: toplevel = essencial, como_e, corpo_rotina, desafios_regulacao,
--   sensorial. extras (em categorias_extras) = comunicacao, socializacao,
--   imitacao, motor, autonomia, aprendizado, foco, sono, nutricional,
--   tela_midia, escola, saude_geral, emocional, rotina.
-- Conflitos: categorias_extras.conflitos = [{chave, campos:[a,b], descricao,
--   data, status}].
-- ============================================================================


-- ----------------------------------------------------------------------------
-- QUERY 1 — ESTRATIFICAÇÃO (escolher a amostra de 30-50, NÃO só alto-conflito).
-- Devolve uma linha por criança ativa com os eixos de estratificação.
-- Escolha manualmente cobrindo: muitos conflitos / poucos / zero; recente / antigo;
-- muita info / pouca; com atualização recente. Anote os membro_id escolhidos.
-- ----------------------------------------------------------------------------
select
  ma.id                                                   as membro_id,
  (extract(epoch from now() - ma.created_at)/86400)::int  as tempo_dias,
  coalesce((
    select count(*) from jsonb_array_elements(
      coalesce(pvm.categorias_extras->'conflitos','[]'::jsonb)) c
    where c->>'status' = 'aberto'
  ), 0)                                                   as conflitos_abertos,
  (
    (case when nullif(trim(pvm.essencial->>'texto'),'') is not null then 1 else 0 end) +
    (case when nullif(trim(pvm.como_e->>'texto'),'') is not null then 1 else 0 end) +
    (case when nullif(trim(pvm.corpo_rotina->>'texto'),'') is not null then 1 else 0 end) +
    (case when nullif(trim(pvm.desafios_regulacao->>'texto'),'') is not null then 1 else 0 end) +
    (case when nullif(trim(pvm.sensorial->>'texto'),'') is not null then 1 else 0 end) +
    coalesce((
      select count(*) from jsonb_each(pvm.categorias_extras) e
      where e.key not in ('conflitos','preferencias')
        and nullif(trim(e.value->>'texto'),'') is not null
    ), 0)
  )                                                       as areas_preenchidas,
  (select count(*) from public.sugestao_perfil_vivos s
     where s.membro_atipico_id = ma.id)                   as sugestoes_ayla,
  (select count(*) from public.eventos_membro ev
     where ev.membro_atipico_id = ma.id)                  as eventos_timeline,
  ma.created_at
from public.membros_atipicos ma
join public.perfil_vivo_membro pvm on pvm.membro_atipico_id = ma.id
where ma.ativo = true
order by conflitos_abertos desc, tempo_dias desc;


-- ----------------------------------------------------------------------------
-- QUERY 2 — EXTRAÇÃO dos conflitos da amostra (1 linha por conflito aberto).
-- Cole os membro_id escolhidos na Query 1 no array abaixo.
-- Traz os DOIS lados (área + texto consolidado + data de atualização) + o alerta.
-- ----------------------------------------------------------------------------
with amostra as (
  select unnest(array[
    -- COLE AQUI os IDs escolhidos, ex.:
    -- '11111111-1111-1111-1111-111111111111',
    -- '22222222-2222-2222-2222-222222222222'
  ]::uuid[]) as membro_id
),
base as (
  select
    ma.id as membro_id,
    (extract(epoch from now() - ma.created_at)/86400)::int as tempo_dias,
    c->>'chave'          as conflito_chave,
    c->'campos'->>0      as campo_a,
    c->'campos'->>1      as campo_b,
    c->>'descricao'      as alerta_atual,
    c->>'data'           as conflito_data,
    pvm.categorias_extras as extras,
    pvm.essencial, pvm.como_e, pvm.corpo_rotina,
    pvm.desafios_regulacao, pvm.sensorial
  from amostra a
  join public.membros_atipicos ma on ma.id = a.membro_id
  join public.perfil_vivo_membro pvm on pvm.membro_atipico_id = ma.id
  cross join lateral jsonb_array_elements(
    coalesce(pvm.categorias_extras->'conflitos','[]'::jsonb)) c
  where c->>'status' = 'aberto'
),
lado as (
  -- helper inline: pega texto/data de um campo (toplevel OU extras)
  select b.*,
    (case campo_a
       when 'essencial' then essencial->>'texto'
       when 'como_e' then como_e->>'texto'
       when 'corpo_rotina' then corpo_rotina->>'texto'
       when 'desafios_regulacao' then desafios_regulacao->>'texto'
       when 'sensorial' then sensorial->>'texto'
       else extras->campo_a->>'texto' end)              as texto_a,
    (case campo_a
       when 'essencial' then essencial->>'atualizado_em'
       when 'como_e' then como_e->>'atualizado_em'
       when 'corpo_rotina' then corpo_rotina->>'atualizado_em'
       when 'desafios_regulacao' then desafios_regulacao->>'atualizado_em'
       when 'sensorial' then sensorial->>'atualizado_em'
       else extras->campo_a->>'atualizado_em' end)      as data_a,
    (case campo_b
       when 'essencial' then essencial->>'texto'
       when 'como_e' then como_e->>'texto'
       when 'corpo_rotina' then corpo_rotina->>'texto'
       when 'desafios_regulacao' then desafios_regulacao->>'texto'
       when 'sensorial' then sensorial->>'texto'
       else extras->campo_b->>'texto' end)              as texto_b,
    (case campo_b
       when 'essencial' then essencial->>'atualizado_em'
       when 'como_e' then como_e->>'atualizado_em'
       when 'corpo_rotina' then corpo_rotina->>'atualizado_em'
       when 'desafios_regulacao' then desafios_regulacao->>'atualizado_em'
       when 'sensorial' then sensorial->>'atualizado_em'
       else extras->campo_b->>'atualizado_em' end)      as data_b
  from base b
)
select
  membro_id, tempo_dias, conflito_chave,
  campo_a, texto_a, data_a,
  campo_b, texto_b, data_b,
  alerta_atual, conflito_data
from lado
order by membro_id, conflito_chave;


-- ----------------------------------------------------------------------------
-- QUERY 3 — FATOS DE ORIGEM (audit da Ayla WhatsApp) pra os campos em conflito.
-- Mostra o que a IA extraiu, com confiança/operação/status — ajuda a ver se o
-- problema veio da EXTRAÇÃO, da CONSOLIDAÇÃO ou do DETECTOR.
-- ATENÇÃO: só cobre fatos vindos do WhatsApp (a web não grava sugestao_perfil_vivos
-- — limitação conhecida do audit atual, que o fact-store v2 resolve).
-- ----------------------------------------------------------------------------
with amostra as (
  select unnest(array[
    -- MESMOS IDs da Query 2
  ]::uuid[]) as membro_id
)
select
  s.membro_atipico_id                 as membro_id,
  s.campo,
  s.texto_sugerido,
  s.origem,                            -- 'ayla'
  s.origem_detalhe->>'confianca'       as confianca,
  s.origem_detalhe->>'operacao'        as operacao,
  s.origem_detalhe->>'auto'            as auto,
  s.status,                            -- aprovada | rejeitada | pendente
  s.created_at
from public.sugestao_perfil_vivos s
join amostra a on a.membro_id = s.membro_atipico_id
order by s.membro_atipico_id, s.campo, s.created_at desc;


-- ----------------------------------------------------------------------------
-- QUERY 4 — RESUMO QUANTITATIVO da amostra (pra o relatório da fase).
-- ----------------------------------------------------------------------------
with amostra as (
  select unnest(array[
    -- MESMOS IDs
  ]::uuid[]) as membro_id
),
conf as (
  select ma.id as membro_id,
    coalesce((select count(*) from jsonb_array_elements(
      coalesce(pvm.categorias_extras->'conflitos','[]'::jsonb)) c
      where c->>'status'='aberto'),0) as n
  from amostra a
  join public.membros_atipicos ma on ma.id=a.membro_id
  join public.perfil_vivo_membro pvm on pvm.membro_atipico_id=ma.id
)
select
  count(*)                                   as criancas_na_amostra,
  sum(n)                                     as total_conflitos_abertos,
  round(avg(n),2)                            as media_conflitos_por_crianca,
  count(*) filter (where n=0)                as criancas_sem_conflito,
  count(*) filter (where n between 1 and 3)  as criancas_1_a_3,
  count(*) filter (where n >= 4)             as criancas_4_ou_mais
from conf;
