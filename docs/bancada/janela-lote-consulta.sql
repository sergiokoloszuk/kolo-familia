-- ============================================================================
-- A JANELA DO LOTE VALE 7 SEGUNDOS?  — consulta SOMENTE LEITURA
--
-- `lote-inbound.ts:62` dorme 7 segundos fixos em TODO turno do WhatsApp, pra
-- juntar balões que a mãe manda em sequência. Medido em 13/08/2026: isso é o
-- maior componente isolado da latência percebida — maior que o parser, maior
-- que o classificador, e comparável ao próprio modelo conversacional.
--
-- A pergunta não é "quanto tempo a mãe demora entre duas mensagens". É:
--   "quantos LOTES REAIS a janela de 7s captura que uma de 3s ou 4s perderia?"
--
-- Por isso o recorte é o BURST ANTES DA RESPOSTA DA AYLA — mensagens de entrada
-- consecutivas da mesma família sem nenhuma saída no meio. Duas mensagens
-- separadas por uma resposta da Ayla são dois TURNOS, não um lote fragmentado,
-- e misturá-las inflaria artificialmente o benefício da janela.
--
-- NENHUMA ESCRITA. Só SELECT. Pode rodar em produção.
-- ============================================================================

-- Ajuste a janela de análise se quiser (padrão: últimos 60 dias).
with base as (
  select
    family_account_id,
    created_at,
    direcao,
    texto,
    -- Quantas SAÍDAS já aconteceram até aqui, nesta família. Toda resposta da
    -- Ayla incrementa este contador — então mensagens de entrada que
    -- compartilham o mesmo valor pertencem ao MESMO burst.
    count(*) filter (where direcao = 'outbound')
      over (partition by family_account_id order by created_at
            rows between unbounded preceding and current row) as turno_seq
  from public.ayla_messages
  where created_at >= now() - interval '60 days'
),
entradas as (
  select family_account_id, turno_seq, created_at, texto,
         row_number() over (partition by family_account_id, turno_seq order by created_at) as pos,
         lag(created_at) over (partition by family_account_id, turno_seq order by created_at) as anterior
  from base
  where direcao = 'inbound'
),
lotes as (
  select family_account_id, turno_seq,
         count(*) as baloes,
         -- maior silêncio DENTRO do lote: é ele que a janela precisa cobrir
         max(extract(epoch from (created_at - anterior))) as maior_intervalo_s
  from entradas
  group by family_account_id, turno_seq
)

-- ── 1. DISTRIBUIÇÃO DE BALÕES POR TURNO ───────────────────────────────────
-- Quantos turnos chegam em 1 balão? A janela só serve pros demais.
select
  '1. baloes por turno' as bloco,
  case when baloes >= 4 then '4+' else baloes::text end as baloes,
  count(*) as turnos,
  round(100.0 * count(*) / sum(count(*)) over (), 1) as pct
from lotes
group by 1, 2
order by 2;

-- ── 2. INTERVALO DENTRO DOS LOTES MULTI-BALÃO ─────────────────────────────
-- p50/p75/p90/p95 do MAIOR silêncio dentro de um lote. É o número que decide.
with base as (
  select family_account_id, created_at, direcao,
         count(*) filter (where direcao = 'outbound')
           over (partition by family_account_id order by created_at
                 rows between unbounded preceding and current row) as turno_seq
  from public.ayla_messages where created_at >= now() - interval '60 days'
),
entradas as (
  select family_account_id, turno_seq, created_at,
         lag(created_at) over (partition by family_account_id, turno_seq order by created_at) as anterior
  from base where direcao = 'inbound'
),
gaps as (
  select extract(epoch from (created_at - anterior)) as gap_s
  from entradas where anterior is not null
)
select
  '2. intervalo entre baloes (s)' as bloco,
  count(*) as n,
  round(percentile_cont(0.50) within group (order by gap_s)::numeric, 2) as p50,
  round(percentile_cont(0.75) within group (order by gap_s)::numeric, 2) as p75,
  round(percentile_cont(0.90) within group (order by gap_s)::numeric, 2) as p90,
  round(percentile_cont(0.95) within group (order by gap_s)::numeric, 2) as p95,
  round(max(gap_s)::numeric, 2) as maximo
from gaps;

-- ── 3. COBERTURA POR TAMANHO DE JANELA ────────────────────────────────────
-- ESTE é o bloco que encerra a discussão: que fração dos lotes multi-balão
-- continuaria inteira com 2s, 3s, 4s, 5s, 7s.
with base as (
  select family_account_id, created_at, direcao,
         count(*) filter (where direcao = 'outbound')
           over (partition by family_account_id order by created_at
                 rows between unbounded preceding and current row) as turno_seq
  from public.ayla_messages where created_at >= now() - interval '60 days'
),
entradas as (
  select family_account_id, turno_seq, created_at,
         lag(created_at) over (partition by family_account_id, turno_seq order by created_at) as anterior
  from base where direcao = 'inbound'
),
lotes as (
  select family_account_id, turno_seq, count(*) as baloes,
         max(extract(epoch from (created_at - anterior))) as maior_gap
  from entradas group by 1, 2
),
multi as (select * from lotes where baloes > 1)
select
  '3. cobertura da janela' as bloco,
  (select count(*) from multi) as lotes_multi,
  count(*) filter (where maior_gap <= 2) as ate_2s,
  count(*) filter (where maior_gap <= 3) as ate_3s,
  count(*) filter (where maior_gap <= 4) as ate_4s,
  count(*) filter (where maior_gap <= 5) as ate_5s,
  count(*) filter (where maior_gap <= 7) as ate_7s,
  round(100.0 * count(*) filter (where maior_gap <= 3) / nullif(count(*), 0), 1) as pct_3s,
  round(100.0 * count(*) filter (where maior_gap <= 4) / nullif(count(*), 0), 1) as pct_4s,
  round(100.0 * count(*) filter (where maior_gap <= 7) / nullif(count(*), 0), 1) as pct_7s
from multi;

-- ── 4. A AMOSTRA QUALITATIVA — o que SÓ os 7s capturam ────────────────────
-- Os lotes cujo maior silêncio ficou entre 3s e 7s: são os únicos que uma
-- janela de 3s quebraria. LER O TEXTO importa mais que a estatística: se forem
-- continuações ("...para escola", "...desde ontem"), a janela ganha o pão. Se
-- forem assuntos novos ("e outra coisa, ele não está dormindo"), os 4 segundos
-- extras estão juntando o que nem deveria ser junto.
with base as (
  select id, family_account_id, created_at, direcao, texto,
         count(*) filter (where direcao = 'outbound')
           over (partition by family_account_id order by created_at
                 rows between unbounded preceding and current row) as turno_seq
  from public.ayla_messages where created_at >= now() - interval '60 days'
),
entradas as (
  select family_account_id, turno_seq, created_at, texto,
         lag(created_at) over (partition by family_account_id, turno_seq order by created_at) as anterior
  from base where direcao = 'inbound'
),
alvo as (
  select family_account_id, turno_seq
  from entradas group by 1, 2
  having max(extract(epoch from (created_at - anterior))) between 3 and 7
)
select
  '4. so os 7s capturam' as bloco,
  e.family_account_id,
  e.turno_seq,
  round(extract(epoch from (e.created_at - e.anterior))::numeric, 1) as gap_s,
  left(e.texto, 120) as texto
from entradas e
join alvo a using (family_account_id, turno_seq)
order by e.family_account_id, e.turno_seq, e.created_at
limit 60;
