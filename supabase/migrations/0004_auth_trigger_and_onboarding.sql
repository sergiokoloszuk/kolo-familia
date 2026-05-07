-- ============================================================
-- Kolo Família — Migração 0004
--   - Adiciona colunas de onboarding em family_accounts.
--   - Trigger on auth.users insert: cria family_accounts (stub),
--     subscription_accesses (trialing 30d), ayla_preferences (sem
--     consentimento ainda).
-- ============================================================

-- ----- Colunas de onboarding -----
alter table public.family_accounts
  add column if not exists onboarding_step int not null default 1
    check (onboarding_step between 1 and 7),
  add column if not exists onboarding_completed boolean not null default false;

-- whatsapp_e164 vira preenchível depois do cadastro (vem em alguma tela do
-- wizard). Relaxar o NOT NULL para o trigger conseguir criar a row stub.
alter table public.family_accounts
  alter column whatsapp_e164 drop not null;

-- O CHECK constraint do whatsapp_e164 está em '^\+\d{8,15}$'. Como agora pode
-- ser nulo, ajustar pra aceitar nulo.
alter table public.family_accounts
  drop constraint if exists family_accounts_whatsapp_e164_check;
alter table public.family_accounts
  add constraint family_accounts_whatsapp_e164_check
  check (whatsapp_e164 is null or whatsapp_e164 ~ '^\+\d{8,15}$');

-- ----- Trigger function -----
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  new_family_id uuid;
begin
  -- 1. Cria a família stub (será completada via wizard)
  insert into public.family_accounts (user_id, whatsapp_e164, onboarding_step)
  values (new.id, null, 1)
  returning id into new_family_id;

  -- 2. Cria assinatura em trial de 30 dias (PRD §5.2)
  insert into public.subscription_accesses
    (family_account_id, status, trial_ends_at)
  values
    (new_family_id, 'trialing', now() + interval '30 days');

  -- 3. Cria preferências da Ayla — DESATIVADA até consentimento explícito
  --    (PRD §12.13 LGPD). Tela 5 do onboarding pede o opt-in.
  insert into public.ayla_preferences
    (family_account_id, desativada, consentimento_em)
  values
    (new_family_id, true, null);

  return new;
end;
$$;

-- ----- Trigger -----
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- FIM da migração 0004.
-- ============================================================
