-- QUANTAS FAMÍLIAS MUDAM DE FASE com a régua única de "Ativado".
--
-- SÓ LEITURA. Rodar antes de subir, para a agência não ler a mudança de número
-- como conquista nem como bug: é a mesma realidade, contada de um jeito só.
--
-- Régua ANTIGA (drill-down e CRM): terminou o cadastro E usou o APP.
-- Régua NOVA  (única):             terminou o cadastro E chegou ao valor —
--                                  usou o app, recebeu um plano OU conversou
--                                  com a Ayla.

with uso as (
  select family_account_id, count(*) as usos
  from public.user_events
  where created_at > now() - interval '90 days'
    and evento not in ('tela_visitada', 'checkout_iniciado', 'form_submit')
  group by 1
),
plano as (select distinct family_account_id from public.planos),
ayla as (
  select distinct family_account_id
  from public.ayla_messages where direcao = 'inbound'
),
f as (
  select
    fa.id,
    coalesce(fa.onboarding_completed, false) as concluiu,
    coalesce(u.usos, 0) > 0 as usou_app,
    p.family_account_id is not null as tem_plano,
    a.family_account_id is not null as falou_ayla
  from public.family_accounts fa
  left join uso u on u.family_account_id = fa.id
  left join plano p on p.family_account_id = fa.id
  left join ayla a on a.family_account_id = fa.id
),
classificado as (
  select
    concluiu and usou_app                                as ativado_antes,
    concluiu and (usou_app or tem_plano or falou_ayla)   as ativado_depois,
    falou_ayla, tem_plano, usou_app
  from f
)
select
  count(*)                                                          as familias,
  count(*) filter (where ativado_antes)                             as ativado_antes,
  count(*) filter (where ativado_depois)                            as ativado_depois,
  count(*) filter (where ativado_depois and not ativado_antes)      as passam_a_contar,
  count(*) filter (where ativado_antes and not ativado_depois)      as deixam_de_contar,
  count(*) filter (where ativado_depois and not ativado_antes
                     and falou_ayla and not usou_app)               as so_pela_ayla,
  count(*) filter (where ativado_depois and not ativado_antes
                     and tem_plano and not usou_app and not falou_ayla) as so_pelo_plano
from classificado;
