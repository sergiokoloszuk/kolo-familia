-- POR QUE A AYLA NÃO RESPONDE A ESTE NÚMERO — consulta ÚNICA.
--
-- Uma query só, um resultado só: o editor do Supabase mostra apenas o último
-- comando de um lote, e `pg_temp` não sobrevive ao pool de conexões. Por isso
-- nada de função temporária e nada de vários selects.
--
-- SÓ LEITURA. Nenhum insert, update ou delete.
--
-- ⬇️ TROQUE O NÚMERO NA LINHA `select '553484430420'` (só dígitos).

with alvo as (
  select '553484430420'::text as num
),
-- Chave tolerante, a MESMA de lib/telefone.ts (chaveTelefoneBR): tira
-- não-dígitos, tira o 55 quando sobra mais de 11, tira o 9º dígito. Sem isto o
-- banco diria "não cadastrado" para número que ESTÁ cadastrado.
chave_alvo as (
  select case
           when length(d) = 11 and substr(d, 3, 1) = '9'
             then substr(d, 1, 2) || substr(d, 4)
           else d
         end as chave
  from (
    select case when x like '55%' and length(x) > 11 then substr(x, 3) else x end as d
    from (select regexp_replace((select num from alvo), '\D', '', 'g') as x) a
  ) b
),
fam as (
  select
    fa.id,
    fa.user_id,
    fa.whatsapp_e164,
    fa.created_at,
    case
      when length(b.d) = 11 and substr(b.d, 3, 1) = '9'
        then substr(b.d, 1, 2) || substr(b.d, 4)
      else b.d
    end as chave
  from public.family_accounts fa
  cross join lateral (
    select case when x like '55%' and length(x) > 11 then substr(x, 3) else x end as d
    from (select regexp_replace(coalesce(fa.whatsapp_e164, ''), '\D', '', 'g') as x) a
  ) b
),
achadas as (
  select fam.* from fam, chave_alvo where fam.chave = chave_alvo.chave
)

-- 1. O número está cadastrado?
select
  '1. cadastro' as etapa,
  case
    when (select count(*) from achadas) = 0 then 'NAO CADASTRADO — causa provavel'
    when (select count(*) from achadas) > 1 then 'DUPLICADO — numero em mais de uma familia'
    else 'ok — 1 familia'
  end as resultado,
  coalesce(
    (select string_agg(a.id::text || ' (' || coalesce(a.whatsapp_e164, '?') || ', criada ' ||
                       to_char(a.created_at, 'DD/MM') || ')', ' | ') from achadas a),
    'chave procurada: ' || (select chave from chave_alvo)
  ) as detalhe

union all
select
  '1b. nome',
  coalesce((select p.nome_mae from public.family_profiles p
            where p.family_account_id in (select id from achadas) limit 1), '—'),
  coalesce((select p.como_chamar from public.family_profiles p
            where p.family_account_id in (select id from achadas) limit 1), '—')

union all
-- 2. A Ayla foi bloqueada para essa família?
select
  '2. bloqueio',
  coalesce((select case
              when ap.desativada and ap.consentimento_em is not null
                then 'BLOQUEADA (opt-out ou botao do Admin) — E A CAUSA'
              when ap.desativada then 'desativada sem consentimento = padrao de cadastro, nao bloqueia'
              else 'ok — nao bloqueada'
            end
            from public.ayla_preferences ap
            where ap.family_account_id in (select id from achadas) limit 1),
           'sem linha em ayla_preferences'),
  coalesce((select 'consentimento: ' || coalesce(to_char(ap.consentimento_em, 'DD/MM/YYYY'), 'nunca')
            from public.ayla_preferences ap
            where ap.family_account_id in (select id from achadas) limit 1), '—')

union all
-- 3. Lead em abordagem manual? (silêncio POR DESIGN — mensagem foi pro CRM)
select
  '3. abordagem manual',
  coalesce((select case when cl.em_abordagem
                        then 'EM ABORDAGEM — Ayla cala de proposito; mensagem esta no CRM'
                        else 'ok — nao esta em abordagem' end
            from public.crm_leads cl
            where cl.family_account_id in (select id from achadas) limit 1),
           'sem lead no CRM'),
  coalesce((select 'aguardando_resposta: ' || cl.aguardando_resposta::text
            from public.crm_leads cl
            where cl.family_account_id in (select id from achadas) limit 1), '—')

union all
-- 4. As mensagens dela chegaram ao banco?
select
  '4. mensagens (3 dias)',
  (select count(*) filter (where am.direcao = 'inbound')::text || ' recebidas / ' ||
          count(*) filter (where am.direcao = 'outbound')::text || ' enviadas'
   from public.ayla_messages am
   where am.family_account_id in (select id from achadas)
     and am.created_at > now() - interval '3 days'),
  coalesce((select string_agg(left(am.texto, 40) || ' [' || am.direcao || ' ' ||
                              to_char(am.created_at, 'DD/MM HH24:MI') || ']', ' | '
                              order by am.created_at desc)
            from (select * from public.ayla_messages am2
                  where am2.family_account_id in (select id from achadas)
                    and am2.created_at > now() - interval '3 days'
                  order by am2.created_at desc limit 8) am), '—')

union all
-- 5. Turno preso (inbound nunca processado)?
select
  '5. turno preso',
  (select case when count(*) = 0 then 'ok — nada pendente'
               else count(*)::text || ' inbound sem processar — execucao morreu no meio' end
   from public.ayla_messages am
   where am.family_account_id in (select id from achadas)
     and am.direcao = 'inbound' and am.processada_em is null),
  coalesce((select to_char(min(am.created_at), 'DD/MM HH24:MI')
            from public.ayla_messages am
            where am.family_account_id in (select id from achadas)
              and am.direcao = 'inbound' and am.processada_em is null), '—')

union all
-- 6. Assinatura (NÃO cala — expirada recebe convite)
select
  '6. acesso',
  coalesce((select sa.status from public.subscription_accesses sa
            where sa.family_account_id in (select id from achadas) limit 1), 'sem assinatura'),
  coalesce((select 'admin isento: ' || ca.ativo::text from public.controle_acessos ca
            where ca.user_id in (select user_id from achadas) limit 1), 'nao e admin')

union all
-- 7. Se não achou: existe cadastro recente no mesmo DDD? (numero trocado)
select
  '7. DDD 34 recentes',
  (select count(*)::text || ' familias criadas nos ultimos 30 dias com 34 no numero'
   from public.family_accounts fa
   where regexp_replace(coalesce(fa.whatsapp_e164, ''), '\D', '', 'g') like '%34%'
     and fa.created_at > now() - interval '30 days'),
  coalesce((select string_agg(coalesce(fa.whatsapp_e164, '?') || ' (' ||
                              to_char(fa.created_at, 'DD/MM') || ')', ' | ')
            from (select * from public.family_accounts fa2
                  where regexp_replace(coalesce(fa2.whatsapp_e164, ''), '\D', '', 'g') like '%34%'
                    and fa2.created_at > now() - interval '30 days'
                  order by fa2.created_at desc limit 10) fa), '—');
