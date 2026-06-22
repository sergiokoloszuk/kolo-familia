-- ============================================================
-- Kolo Família — Migração 0047
--   Trial passa de 30 → 7 dias APENAS para NOVOS cadastros.
--   Contas existentes mantêm o trial_ends_at que já têm (cohort de 30 dias
--   segue intacto). Só redefine o gatilho handle_new_user (mantém tudo da 0045,
--   incl. materialização de co-acesso).
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

  insert into public.subscription_accesses (family_account_id, status, trial_ends_at)
  values (new_family_id, 'trialing', now() + interval '7 days');

  insert into public.ayla_preferences (family_account_id, desativada, consentimento_em)
  values (new_family_id, true, null);

  -- Co-acesso: vincula este usuário a convites pendentes com o e-mail dele.
  update public.family_acessos
    set user_id = new.id
    where user_id is null and lower(email) = lower(new.email);

  return new;
end;
$$;

-- ============================================================
-- FIM da migração 0047.
-- ============================================================
