-- ============================================================
-- Kolo Família — Migração 0051
--   Trial de 30 → 7 dias. O trigger handle_new_user (recriado por último na
--   0045, com a lógica de co-acesso) gravava trial_ends_at = now() + 30 dias.
--   Decisão 2026-06-23: trial é de 7 dias. Recria a função idêntica à 0045,
--   trocando só o intervalo. Vale só pra cadastros NOVOS (não mexe em quem já
--   está em trial).
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
-- FIM da migração 0051.
-- ============================================================
