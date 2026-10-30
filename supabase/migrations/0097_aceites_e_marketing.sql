-- Aceites jurídicos versionados e consentimento opcional de marketing.
-- AUTORIA SOMENTE: não aplicar antes do backup/restauração da PEND-092.

alter table public.family_accounts
  add column if not exists termos_versao text,
  add column if not exists privacidade_versao text,
  add column if not exists marketing_consentido_em timestamptz,
  add column if not exists marketing_consentimento_versao text,
  add column if not exists marketing_consentimento_revogado_em timestamptz;

create table if not exists public.aceites_documentos (
  id uuid primary key default gen_random_uuid(),
  family_account_id uuid not null references public.family_accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  documento text not null check (documento in ('termos', 'privacidade', 'marketing')),
  versao text not null,
  aceito boolean not null,
  origem text not null check (origem in ('cadastro', 'configuracoes', 'reatualizacao')),
  registrado_em timestamptz not null default now()
);

create index if not exists aceites_documentos_family_idx
  on public.aceites_documentos (family_account_id, documento, registrado_em desc);

alter table public.aceites_documentos enable row level security;

drop policy if exists aceites_documentos_self_select on public.aceites_documentos;
create policy aceites_documentos_self_select on public.aceites_documentos
  for select using (
    exists (
      select 1 from public.family_accounts f
       where f.id = family_account_id and f.user_id = auth.uid()
    )
  );

drop policy if exists aceites_documentos_self_insert on public.aceites_documentos;
create policy aceites_documentos_self_insert on public.aceites_documentos
  for insert with check (
    user_id = auth.uid() and exists (
      select 1 from public.family_accounts f
       where f.id = family_account_id and f.user_id = auth.uid()
    )
  );

grant select, insert on public.aceites_documentos to authenticated;

comment on column public.family_accounts.marketing_consentido_em is
  'Consentimento opcional e revogável para novidades, parcerias e promoções. NULL = não autorizado.';

create table if not exists public.exclusao_conta_solicitacoes (
  family_account_id uuid primary key references public.family_accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  solicitada_em timestamptz not null default now(),
  executar_em timestamptz not null,
  status text not null default 'agendada' check (status in ('agendada', 'processando', 'falhou')),
  tentativas integer not null default 0,
  ultimo_erro text,
  updated_at timestamptz not null default now()
);

alter table public.exclusao_conta_solicitacoes enable row level security;

drop policy if exists exclusao_conta_self_select on public.exclusao_conta_solicitacoes;
create policy exclusao_conta_self_select on public.exclusao_conta_solicitacoes
  for select using (user_id = auth.uid());

drop policy if exists exclusao_conta_self_insert on public.exclusao_conta_solicitacoes;
create policy exclusao_conta_self_insert on public.exclusao_conta_solicitacoes
  for insert with check (user_id = auth.uid());

drop policy if exists exclusao_conta_self_update on public.exclusao_conta_solicitacoes;
create policy exclusao_conta_self_update on public.exclusao_conta_solicitacoes
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update on public.exclusao_conta_solicitacoes to authenticated;

create or replace function public.registrar_meus_aceites_kolo(
  p_aceitos_em timestamptz,
  p_marketing boolean,
  p_marketing_informado boolean
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_family uuid;
begin
  if v_user is null then raise exception 'NAO_AUTENTICADO'; end if;
  select id into v_family from public.family_accounts where user_id = v_user for update;
  if v_family is null then return null; end if;

  update public.family_accounts
     set termos_aceitos_em = coalesce(termos_aceitos_em, p_aceitos_em),
         privacidade_aceita_em = coalesce(privacidade_aceita_em, p_aceitos_em),
         termos_versao = '2026-10-23',
         privacidade_versao = '2026-10-23',
         marketing_consentido_em = case when p_marketing_informado and p_marketing
           then p_aceitos_em when p_marketing_informado then null else marketing_consentido_em end,
         marketing_consentimento_versao = case when p_marketing_informado
           then '2026-10-23' else marketing_consentimento_versao end,
         marketing_consentimento_revogado_em = case when p_marketing_informado and not p_marketing
           then p_aceitos_em when p_marketing_informado then null else marketing_consentimento_revogado_em end
   where id = v_family;

  insert into public.aceites_documentos
    (family_account_id, user_id, documento, versao, aceito, origem, registrado_em)
  values
    (v_family, v_user, 'termos', '2026-10-23', true, 'cadastro', p_aceitos_em),
    (v_family, v_user, 'privacidade', '2026-10-23', true, 'cadastro', p_aceitos_em);

  if p_marketing_informado then
    insert into public.aceites_documentos
      (family_account_id, user_id, documento, versao, aceito, origem, registrado_em)
    values
      (v_family, v_user, 'marketing', '2026-10-23', p_marketing, 'cadastro', p_aceitos_em);
    if p_marketing then
      delete from public.categorias_optout
       where family_account_id = v_family and categoria in ('informacional', 'promocional');
    else
      insert into public.categorias_optout (family_account_id, categoria)
      values (v_family, 'informacional'), (v_family, 'promocional')
      on conflict (family_account_id, categoria) do nothing;
    end if;
  end if;
  return v_family;
end;
$$;

grant execute on function public.registrar_meus_aceites_kolo(timestamptz, boolean, boolean)
  to authenticated;

create or replace function public.alterar_meu_consentimento_marketing(p_aceitar boolean)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_family uuid;
  v_agora timestamptz := now();
begin
  if v_user is null then raise exception 'NAO_AUTENTICADO'; end if;
  select id into v_family from public.family_accounts where user_id = v_user for update;
  if v_family is null then return null; end if;

  update public.family_accounts
     set marketing_consentido_em = case when p_aceitar then v_agora else null end,
         marketing_consentimento_versao = '2026-10-23',
         marketing_consentimento_revogado_em = case when p_aceitar then null else v_agora end
   where id = v_family;

  if p_aceitar then
    delete from public.categorias_optout
     where family_account_id = v_family and categoria in ('informacional', 'promocional');
  else
    insert into public.categorias_optout (family_account_id, categoria)
    values (v_family, 'informacional'), (v_family, 'promocional')
    on conflict (family_account_id, categoria) do nothing;
  end if;

  insert into public.aceites_documentos
    (family_account_id, user_id, documento, versao, aceito, origem, registrado_em)
  values
    (v_family, v_user, 'marketing', '2026-10-23', p_aceitar, 'configuracoes', v_agora);
  return v_family;
end;
$$;

grant execute on function public.alterar_meu_consentimento_marketing(boolean)
  to authenticated;
