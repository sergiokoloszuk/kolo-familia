-- ============================================================
-- Kolo Família — Migração 0082  ·  FASE 2 de 2
--   O TRIAL DEIXA DE NASCER NO CADASTRO.
--
--   ⚠️ APLICAR SOMENTE DEPOIS de a 0081 estar aplicada E o código que chama
--   `iniciar_trial_se_apto` estar NO AR E PROVADO. Antes disso, esta migração
--   deixaria cadastros novos sem teste nenhum.
--
--   Enquanto a 0081 estava sozinha, o sistema seguia com o comportamento
--   antigo e o código novo era um no-op (`ja_existia`). A partir daqui, e só
--   aqui, a ordem muda de verdade.
--
--   MEDIDO EM PRODUÇÃO (20/08/2026), o que isto corrige: 87 famílias tiveram
--   os 7 dias consumidos sem completar o onboarding; 84 delas NUNCA trocaram
--   uma mensagem com a Kolo, e 60 nunca confirmaram o e-mail — nunca
--   conseguiram entrar. O relógio corria para quem não chegou.
--
--   NENHUMA FAMÍLIA EXISTENTE É TOCADA: sem UPDATE, sem backfill, sem DELETE.
--   O gatilho só dispara em INSERT de usuário novo.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  new_family_id uuid;
begin
  insert into public.family_accounts (user_id, whatsapp_e164, onboarding_step)
  values (new.id, null, 1)
  returning id into new_family_id;

  -- ⚠️ `subscription_accesses` NÃO nasce mais aqui. O teste começa em
  -- `iniciar_trial_se_apto` (0081), na conclusão do onboarding, e só com
  -- WhatsApp verificado + consentimento.
  --
  -- A checagem de `teste_ja_usado` também saiu daqui, e MELHOROU de lugar: no
  -- cadastro só existia o e-mail; na conclusão existem e-mail E telefone, que
  -- são os dois lados da regra da 0065. O gatilho de `family_accounts` que
  -- confere o hash do telefone continua intocado.

  insert into public.ayla_preferences (family_account_id, desativada, consentimento_em)
  values (new_family_id, true, null);

  -- Co-acesso: vincula este usuário a convites pendentes com o e-mail dele.
  update public.family_acessos
    set user_id = new.id
    where user_id is null and lower(email) = lower(new.email);

  return new;
end;
$$;

-- ------------------------------------------------------------
-- ROLLBACK: aplicar `0083_rollback_0082.sql`, que traz a definição da função
-- CAPTURADA DO POSTGRES DE PRODUÇÃO em 27/08/2026, e não reconstruída.
--
-- ⚠️ ESTA LINHA JÁ DIZIA "com o corpo da migração 0066", e isso era um convite
-- a errar: quem reconstruísse de memória pegaria o corpo da **0065**, que NÃO
-- tem o `begin/exception` em volta de `teste_ja_usado`. Esse bloco foi
-- acrescentado pela 0066 porque `pgcrypto` vive em `extensions` e um erro ali
-- derrubava o cadastro inteiro. Rollback que perde proteção não é rollback.
--
-- O código da Fase 1 continua funcionando com o gatilho antigo de volta (passa
-- a receber `ja_existia`), então o rollback NÃO exige desfazer deploy.
-- ------------------------------------------------------------
--
-- VERIFICAÇÃO (read-only) — colar logo depois desta migração. Deve dar `false`:
--   select pg_get_functiondef('public.handle_new_user'::regproc)
--            like '%subscription_accesses%' as ainda_cria_trial_no_cadastro;
-- ------------------------------------------------------------
