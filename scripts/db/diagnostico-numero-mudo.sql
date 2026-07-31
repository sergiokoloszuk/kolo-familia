-- POR QUE A AYLA NÃO RESPONDE A ESTE NÚMERO
--
-- Rodar no SQL editor do Supabase de produção. SÓ LEITURA — nenhum update,
-- nenhum insert. Trocar o número na primeira linha e executar tudo.
--
-- Cada bloco corresponde a um ponto do código onde `processInbound` sai calada
-- (lib/ayla/orchestrator.ts). O primeiro bloco que der resultado "problema" é a
-- causa.

-- ⬇️ TROQUE O NÚMERO NA FUNÇÃO `alvo()` ABAIXO (só dígitos, como a Z-API manda).
-- `\set` do psql NÃO funciona no editor do Supabase — por isso vai como função.

-- Chave tolerante, a MESMA de lib/telefone.ts (chaveTelefoneBR):
-- tira não-dígitos → tira o 55 quando há mais de 11 dígitos → tira o 9º dígito.
create or replace function pg_temp.alvo() returns text language sql immutable as $$
  select '553484430420'
$$;

create or replace function pg_temp.chave_tel(p text) returns text language sql immutable as $$
  select case
           when length(d) = 11 and substr(d, 3, 1) = '9'
             then substr(d, 1, 2) || substr(d, 4)
           else d
         end
  from (
    select case when x like '55%' and length(x) > 11 then substr(x, 3) else x end as d
    from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as x) a
  ) b
$$;

-- ============================================================
-- 1. O NÚMERO ESTÁ CADASTRADO? (silêncio nº 1: "inbound de número não cadastrado")
-- ============================================================
select
  '1. familia encontrada' as etapa,
  fa.id                   as family_id,
  fa.whatsapp_e164,
  fa.created_at,
  p.nome_mae,
  p.como_chamar
from public.family_accounts fa
left join public.family_profiles p on p.family_account_id = fa.id
where pg_temp.chave_tel(fa.whatsapp_e164) = pg_temp.chave_tel(pg_temp.alvo());
-- ZERO LINHAS = ela nunca se cadastrou com este número (ou cadastrou outro).
-- A Ayla está certa em não responder: é um LEAD, não uma usuária.
-- MAIS DE UMA LINHA = o incidente do número duplicado: o `.find()` do código
-- pega a PRIMEIRA, que pode ser a família errada.

-- ============================================================
-- 2. A AYLA FOI BLOQUEADA PARA ESSA FAMÍLIA? (silêncio nº 2)
-- ============================================================
select
  '2. bloqueio' as etapa,
  ap.family_account_id,
  ap.desativada,
  ap.consentimento_em,
  case
    when ap.desativada and ap.consentimento_em is not null
      then 'BLOQUEADA — opt-out "sair" ou botão do Admin. É a causa.'
    when ap.desativada then 'desativada sem consentimento = padrão de cadastro, NÃO bloqueia'
    else 'ok'
  end as veredito
from public.ayla_preferences ap
join public.family_accounts fa on fa.id = ap.family_account_id
where pg_temp.chave_tel(fa.whatsapp_e164) = pg_temp.chave_tel(pg_temp.alvo());

-- ============================================================
-- 3. O LEAD ESTÁ EM ABORDAGEM MANUAL? (silêncio POR DESIGN)
-- ============================================================
-- Com `em_abordagem`, a Ayla NÃO responde de propósito: registra na thread do
-- CRM e avisa a admin. Se for este o caso, a mensagem dela está no CRM
-- esperando resposta HUMANA — e o silêncio no WhatsApp é o comportamento certo,
-- mas ninguém respondeu.
select
  '3. abordagem manual' as etapa,
  cl.family_account_id,
  cl.em_abordagem,
  cl.aguardando_resposta,
  cl.proximo_passo_nota,
  cl.updated_at
from public.crm_leads cl
join public.family_accounts fa on fa.id = cl.family_account_id
where pg_temp.chave_tel(fa.whatsapp_e164) = pg_temp.chave_tel(pg_temp.alvo());

-- ============================================================
-- 4. AS MENSAGENS DELA CHEGARAM AO BANCO?
-- ============================================================
-- Se não houver linha `inbound`, o webhook não chegou (Z-API, secret, parser).
-- Se houver inbound e nenhum outbound depois, o problema é DENTRO do processInbound.
select
  '4. mensagens' as etapa,
  am.direcao,
  am.texto,
  am.created_at,
  am.processada_em,
  am.zaap_message_id
from public.ayla_messages am
join public.family_accounts fa on fa.id = am.family_account_id
where pg_temp.chave_tel(fa.whatsapp_e164) = pg_temp.chave_tel(pg_temp.alvo())
  and am.created_at > now() - interval '3 days'
order by am.created_at desc
limit 40;

-- ============================================================
-- 5. TURNO PRESO? (silêncio nº 5: lote nunca fechou)
-- ============================================================
-- `processada_em` nulo em mensagem antiga = o claim do turno não completou.
-- A execução que deveria responder morreu no meio (timeout, deploy, erro).
select
  '5. inbound pendente' as etapa,
  count(*) as pendentes,
  min(am.created_at) as mais_antiga
from public.ayla_messages am
join public.family_accounts fa on fa.id = am.family_account_id
where pg_temp.chave_tel(fa.whatsapp_e164) = pg_temp.chave_tel(pg_temp.alvo())
  and am.direcao = 'inbound'
  and am.processada_em is null;

-- ============================================================
-- 6. ASSINATURA (não causa silêncio — expirada recebe CONVITE, não nada)
-- ============================================================
-- Se aparecer expirada e ela não recebeu nem o convite, o problema é outro:
-- o gating manda mensagem, não cala.
select
  '6. acesso' as etapa,
  sa.status,
  sa.trial_ends_at,
  ca.ativo as admin_isento
from public.family_accounts fa
left join public.subscription_accesses sa on sa.family_account_id = fa.id
left join public.controle_acessos ca on ca.user_id = fa.user_id
where pg_temp.chave_tel(fa.whatsapp_e164) = pg_temp.chave_tel(pg_temp.alvo());

-- ============================================================
-- 7. ELA EXISTE COM OUTRO NÚMERO? (se o bloco 1 veio vazio)
-- ============================================================
-- Cadastro com número diferente do que ela usa no WhatsApp é a causa mais
-- comum de "não recebe": o app tem um número, ela escreve de outro.
select
  '7. mesmo DDD' as etapa,
  fa.id,
  fa.whatsapp_e164,
  p.nome_mae,
  fa.created_at
from public.family_accounts fa
left join public.family_profiles p on p.family_account_id = fa.id
where regexp_replace(coalesce(fa.whatsapp_e164, ''), '\D', '', 'g') like '%34%'
  and fa.created_at > now() - interval '30 days'
order by fa.created_at desc
limit 20;
