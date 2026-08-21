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
-- ROLLBACK: recriar `handle_new_user` com o corpo da migração 0066, que volta
-- a inserir `subscription_accesses` no cadastro. O código novo continua
-- funcionando (passa a receber `ja_existia`), então o rollback é seguro e não
-- exige desfazer deploy.
-- ------------------------------------------------------------
