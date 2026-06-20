-- ============================================================
-- Kolo Família — Migração 0045
--   Co-acesso ("co-parente"): vários logins → UMA família.
--   - Admin autoriza só o E-MAIL; a pessoa se cadastra e define a própria
--     senha no 1º acesso; remover o e-mail = sem acesso.
--   - Resolução de família (RLS) passa a preferir o vínculo ativo.
--   Backward-compatible: usuário sem vínculo resolve a própria família (igual).
-- ============================================================

create table if not exists public.family_acessos (
  id uuid primary key default gen_random_uuid(),
  family_account_id uuid not null references public.family_accounts(id) on delete cascade,
  email text not null,
  user_id uuid references auth.users(id) on delete cascade, -- preenchido no cadastro
  rotulo text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists family_acessos_fam_email_uk
  on public.family_acessos (family_account_id, lower(email));
create index if not exists family_acessos_user_idx
  on public.family_acessos (user_id) where user_id is not null;

-- Tabela trancada: ninguém lê/escreve direto. O admin gerencia via service-role;
-- a resolução usa a função security-definer abaixo (que ignora RLS).
alter table public.family_acessos enable row level security;

-- Resolução de família: prefere o co-acesso ATIVO; senão, a própria família.
create or replace function public.current_family_account_id()
returns uuid language sql stable security definer set search_path = public as $$
  select coalesce(
    (select family_account_id from public.family_acessos
       where user_id = auth.uid() and ativo = true
       order by created_at asc limit 1),
    (select id from public.family_accounts where user_id = auth.uid() limit 1)
  );
$$;
grant execute on function public.current_family_account_id() to authenticated;

-- family_accounts: leitura passa a permitir a família resolvida (co-acesso);
-- escrita continua só do dono.
drop policy if exists family_accounts_self on public.family_accounts;
create policy family_accounts_select on public.family_accounts
  for select to authenticated
  using (user_id = auth.uid() or id = public.current_family_account_id());
create policy family_accounts_modify on public.family_accounts
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- No cadastro, materializa o user_id de co-acessos pendentes com o mesmo e-mail.
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
  values (new_family_id, 'trialing', now() + interval '30 days');

  insert into public.ayla_preferences (family_account_id, desativada, consentimento_em)
  values (new_family_id, true, null);

  -- Co-acesso: vincula este usuário a convites pendentes com o e-mail dele.
  update public.family_acessos
    set user_id = new.id
    where user_id is null and lower(email) = lower(new.email);

  return new;
end;
$$;

-- PostgREST cacheia schema/funcões — recarrega.
notify pgrst, 'reload schema';

-- ============================================================
-- FIM da migração 0045.
-- ============================================================
