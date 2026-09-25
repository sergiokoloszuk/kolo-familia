-- PEND-216 · objetivo da história antes da entrega no WhatsApp.
--
-- Estado próprio: uma escolha de objetivo não pode ser confundida com os
-- ramos de aprofundamento. A tabela guarda referências e chaves operacionais;
-- o tema sensível continua somente em ayla_messages.

create table if not exists public.ayla_historia_objetivo_ofertas (
  id uuid primary key default gen_random_uuid(),
  family_account_id uuid not null references public.family_accounts(id) on delete cascade,
  membro_atipico_id uuid references public.membros_atipicos(id) on delete set null,
  source_inbound_message_id uuid not null references public.ayla_messages(id) on delete cascade,
  offer_message_id uuid references public.ayla_messages(id) on delete set null,
  provider_message_id text,
  opcoes text[] not null default array[
    'historia_compreender',
    'historia_agir',
    'historia_agencia'
  ]::text[],
  skills text[] not null default '{}'::text[],
  skills_avaliadas boolean not null default true,
  canal text not null default 'botao' check (canal in ('botao', 'texto')),
  status text not null default 'preparada'
    check (status in ('preparada', 'oferecida', 'escolhida', 'respondida', 'falhou')),
  objetivo_escolhido text,
  inbound_escolha_id uuid references public.ayla_messages(id) on delete set null,
  expira_em timestamptz not null default (now() + interval '72 hours'),
  escolhida_em timestamptz,
  respondida_em timestamptz,
  falha_codigo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ayla_historia_objetivos_exatos
    check (
      cardinality(opcoes) = 3
      and opcoes <@ array[
        'historia_compreender',
        'historia_agir',
        'historia_agencia'
      ]::text[]
    ),
  constraint ayla_historia_objetivo_escolhido_valido
    check (
      objetivo_escolhido is null
      or objetivo_escolhido = any(opcoes)
      or objetivo_escolhido = 'historia_escolha_ayla'
    )
);

create unique index if not exists ayla_historia_objetivo_provider_uidx
  on public.ayla_historia_objetivo_ofertas(provider_message_id)
  where provider_message_id is not null;

create index if not exists ayla_historia_objetivo_family_created_idx
  on public.ayla_historia_objetivo_ofertas(family_account_id, created_at desc);

create unique index if not exists ayla_historia_objetivo_inbound_uidx
  on public.ayla_historia_objetivo_ofertas(inbound_escolha_id)
  where inbound_escolha_id is not null;

alter table public.ayla_historia_objetivo_ofertas enable row level security;

grant select, insert, update, delete
  on table public.ayla_historia_objetivo_ofertas
  to service_role;

drop policy if exists ayla_historia_objetivo_admin_all
  on public.ayla_historia_objetivo_ofertas;
create policy ayla_historia_objetivo_admin_all
  on public.ayla_historia_objetivo_ofertas
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- O primeiro clique válido ganha e consome o inbound no mesmo statement.
-- `referenceMessageId` prende o clique à bolha que realmente mostrou os botões.
create or replace function public.reivindicar_objetivo_historia_ayla(
  p_oferta_id uuid,
  p_family_account_id uuid,
  p_objetivo text,
  p_inbound_escolha_id uuid,
  p_reference_message_id text default null
)
returns table (
  oferta_id uuid,
  membro_atipico_id uuid,
  source_inbound_message_id uuid,
  opcoes text[],
  skills text[],
  skills_avaliadas boolean,
  criada_em timestamptz
)
language sql
security definer
set search_path = public
as $$
  with interacao_consumida as (
    update public.ayla_messages m
       set processada_em = coalesce(m.processada_em, now())
     where m.id = p_inbound_escolha_id
       and m.family_account_id = p_family_account_id
       and m.direcao = 'inbound'
    returning m.id
  )
  update public.ayla_historia_objetivo_ofertas o
     set status = 'escolhida',
         objetivo_escolhido = p_objetivo,
         inbound_escolha_id = p_inbound_escolha_id,
         escolhida_em = now(),
         updated_at = now()
    from interacao_consumida i
   where o.id = p_oferta_id
     and o.family_account_id = p_family_account_id
     and o.status in ('preparada', 'oferecida')
     and o.expira_em > now()
     and (
       p_objetivo = any(o.opcoes)
       or p_objetivo = 'historia_escolha_ayla'
     )
     and (
       o.canal = 'texto'
       or p_objetivo = 'historia_escolha_ayla'
       or o.provider_message_id is null
       or o.provider_message_id = p_reference_message_id
     )
  returning
    o.id,
    o.membro_atipico_id,
    o.source_inbound_message_id,
    o.opcoes,
    o.skills,
    o.skills_avaliadas,
    o.created_at;
$$;

revoke all on function public.reivindicar_objetivo_historia_ayla(uuid, uuid, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.reivindicar_objetivo_historia_ayla(uuid, uuid, text, uuid, text)
  to service_role;

notify pgrst, 'reload schema';
