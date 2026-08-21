-- ============================================================
-- Kolo Família — Migração 0081  ·  FASE 1 de 2
--   Cria a função que passa a ser o ÚNICO ponto de início do teste.
--
--   ⚠️ ESTA MIGRAÇÃO NÃO MUDA O GATILHO. De propósito.
--
--   `handle_new_user` continua criando o teste no cadastro, exatamente como
--   hoje. Logo esta migração é **inócua** enquanto o código novo não subir:
--   a função existe, e para toda família que já tem assinatura ela devolve
--   `ja_existia` sem escrever nada.
--
--   É o que torna o rollout seguro. A troca do gatilho vem na 0082, DEPOIS de
--   o código estar no ar e provado — e assim não existe nenhum instante em que
--   uma família nova fique sem teste por incompatibilidade entre banco e app.
--
--   NENHUMA FAMÍLIA EXISTENTE É TOCADA: sem UPDATE, sem backfill, sem DELETE.
-- ============================================================

-- ------------------------------------------------------------
-- O evento único que inicia o teste
-- ------------------------------------------------------------
--
-- Por que a regra mora em SQL e não só no TypeScript: "não começa sem WhatsApp
-- verificado" precisa ser impossível de furar — inclusive por um chamador novo
-- que alguém esqueça de proteger. Aqui a condição e a escrita acontecem na
-- MESMA instrução; não há janela entre conferir e gravar.
--
-- Nunca lança. Devolve o motivo, e quem decide o que fazer com ele é o app:
--
--   'iniciado'            → criou agora
--   'ja_existia'          → idempotente; não fez nada
--   'trial_ja_utilizado'  → o E-MAIL já consumiu um teste (o telefone é
--                            coberto pelo gatilho da 0065; ver nota abaixo)
--   'sem_whatsapp'        → família sem número
--   'nao_verificado'      → número não confirmado, ou confirmado para OUTRO número
--   'sem_consentimento'   → consentimento ausente ou Ayla desativada
--   'familia_inexistente'

create or replace function public.iniciar_trial_se_apto(p_family_id uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
declare
  v_whatsapp   text;
  v_email      text;
  v_verificado boolean := false;
  v_consentiu  boolean := false;
  v_ja_usou    boolean := false;
begin
  if p_family_id is null then
    return 'familia_inexistente';
  end if;

  -- IDEMPOTÊNCIA PRIMEIRO. Retry de rede, duplo clique e reprocessamento não
  -- podem gerar um segundo teste nem esticar o prazo do primeiro.
  if exists (select 1 from public.subscription_accesses
              where family_account_id = p_family_id) then
    return 'ja_existia';
  end if;

  select f.whatsapp_e164, u.email into v_whatsapp, v_email
    from public.family_accounts f
    left join auth.users u on u.id = f.user_id
   where f.id = p_family_id;

  if not found then
    return 'familia_inexistente';
  end if;
  if v_whatsapp is null or btrim(v_whatsapp) = '' then
    return 'sem_whatsapp';
  end if;

  -- ⚠️ A VERIFICAÇÃO É AMARRADA AO NÚMERO, não à família. É isto que faz
  -- "corrigir o telefone" invalidar a confirmação anterior sem nenhuma lógica
  -- extra: mudou o número, a linha de verificação não casa mais.
  select exists (
    select 1 from public.verificacoes_whatsapp
     where family_account_id = p_family_id
       and verificado_em is not null
       and telefone_e164 = v_whatsapp
  ) into v_verificado;

  if not v_verificado then
    return 'nao_verificado';
  end if;

  select exists (
    select 1 from public.ayla_preferences
     where family_account_id = p_family_id
       and consentimento_em is not null
       and desativada = false
  ) into v_consentiu;

  if not v_consentiu then
    return 'sem_consentimento';
  end if;

  -- ⚠️ TESTE JÁ USADO NÃO VIRA MAIS UM TESTE NASCIDO VENCIDO (21/08/2026).
  --
  -- A migração 0065 criava a linha com `trial_ends_at = now()` para a pessoa
  -- cair no paywall que já existia, "sem status novo nem código novo". O custo
  -- disso é uma linha que MENTE: a família aparece como `trialing` nas
  -- contagens, entra na varredura de retenção e no motor de exclusão como se
  -- tivesse feito um teste que nunca existiu.
  --
  -- Agora a resposta é honesta: não há teste, e o app conduz para os Planos.
  -- Ver a nota da 0082 sobre `testeJaUsadoAntes`, que dependia daquele efeito
  -- colateral e passa a ter uma fonte de verdade.
  begin
    -- ⚠️ SÓ O E-MAIL. NÃO passar o telefone aqui — PROVADO EM PRODUÇÃO em
    -- 21/08/2026: gravar `whatsapp_e164` em `family_accounts` dispara o gatilho
    -- da 0065, que REGISTRA o número em `testes_usados`. Como esta função roda
    -- DEPOIS de o onboarding gravar o número, passar o telefone faria toda
    -- família nova responder `trial_ja_utilizado` — ninguém receberia teste.
    -- O lado do telefone já é coberto por aquele gatilho, no fluxo real.
    select public.teste_ja_usado(v_email, null) into v_ja_usou;
  exception when others then
    -- Falha ao consultar NUNCA nega o teste a quem tem direito: o custo de um
    -- falso positivo aqui é tirar de alguém o produto inteiro.
    v_ja_usou := false;
  end;

  if v_ja_usou then
    return 'trial_ja_utilizado';
  end if;

  insert into public.subscription_accesses (family_account_id, status, trial_ends_at)
  values (p_family_id, 'trialing', now() + interval '7 days')
  on conflict (family_account_id) do nothing;

  return 'iniciado';
end;
$$;

revoke all on function public.iniciar_trial_se_apto(uuid) from public, anon, authenticated;
grant execute on function public.iniciar_trial_se_apto(uuid) to service_role;

comment on function public.iniciar_trial_se_apto(uuid) is
  'Único ponto que inicia o teste de 7 dias. Exige WhatsApp verificado para o número ATUAL + consentimento. Idempotente. Não concede teste a quem já usou.';

-- ------------------------------------------------------------
-- ROLLBACK: drop function if exists public.iniciar_trial_se_apto(uuid);
-- Como o gatilho não foi tocado, remover a função devolve o sistema ao estado
-- anterior por completo.
-- ------------------------------------------------------------
