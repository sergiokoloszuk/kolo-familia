-- PEND-213 · aprofundamento contextual no WhatsApp.
--
-- A tabela guarda ESTADO OPERACIONAL e referências para falas que já vivem em
-- ayla_messages. Não duplica o texto sensível da conversa.

create table if not exists public.ayla_aprofundamento_ofertas (
  id uuid primary key default gen_random_uuid(),
  family_account_id uuid not null references public.family_accounts(id) on delete cascade,
  membro_atipico_id uuid references public.membros_atipicos(id) on delete set null,
  source_inbound_message_id uuid not null references public.ayla_messages(id) on delete cascade,
  source_outbound_message_id uuid references public.ayla_messages(id) on delete set null,
  offer_message_id uuid references public.ayla_messages(id) on delete set null,
  provider_message_id text,
  opcoes text[] not null,
  canal text not null default 'botao' check (canal in ('botao', 'texto')),
  status text not null default 'preparada'
    check (status in ('preparada', 'oferecida', 'escolhida', 'respondida', 'falhou')),
  ramo_escolhido text,
  inbound_escolha_id uuid references public.ayla_messages(id) on delete set null,
  expira_em timestamptz not null default (now() + interval '72 hours'),
  escolhida_em timestamptz,
  respondida_em timestamptz,
  seguimento_em timestamptz,
  falha_codigo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ayla_aprofundamento_opcoes_quantidade
    check (cardinality(opcoes) between 2 and 3),
  constraint ayla_aprofundamento_opcoes_validas
    check (opcoes <@ array[
      'aprofundar_lidar',
      'aprofundar_brincar',
      'aprofundar_crencas'
    ]::text[]),
  constraint ayla_aprofundamento_ramo_valido
    check (
      ramo_escolhido is null or ramo_escolhido = any(opcoes)
    )
);

create unique index if not exists ayla_aprofundamento_provider_uidx
  on public.ayla_aprofundamento_ofertas(provider_message_id)
  where provider_message_id is not null;

create index if not exists ayla_aprofundamento_family_created_idx
  on public.ayla_aprofundamento_ofertas(family_account_id, created_at desc);

create unique index if not exists ayla_aprofundamento_inbound_escolha_uidx
  on public.ayla_aprofundamento_ofertas(inbound_escolha_id)
  where inbound_escolha_id is not null;

alter table public.ayla_aprofundamento_ofertas enable row level security;

grant select, insert, update, delete
  on table public.ayla_aprofundamento_ofertas
  to service_role;

drop policy if exists ayla_aprofundamento_admin_all
  on public.ayla_aprofundamento_ofertas;
create policy ayla_aprofundamento_admin_all
  on public.ayla_aprofundamento_ofertas
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- O primeiro callback válido ganha. A condição e o UPDATE vivem na mesma
-- instrução para que dois callbacks concorrentes não gerem duas respostas.
create or replace function public.reivindicar_aprofundamento_ayla(
  p_oferta_id uuid,
  p_family_account_id uuid,
  p_ramo text,
  p_inbound_escolha_id uuid,
  p_reference_message_id text default null
)
returns table (
  oferta_id uuid,
  membro_atipico_id uuid,
  source_inbound_message_id uuid,
  source_outbound_message_id uuid,
  opcoes text[],
  criada_em timestamptz
)
language sql
security definer
set search_path = public
as $$
  update public.ayla_aprofundamento_ofertas o
     set status = 'escolhida',
         ramo_escolhido = p_ramo,
         inbound_escolha_id = p_inbound_escolha_id,
         escolhida_em = now(),
         updated_at = now()
   where o.id = p_oferta_id
     and o.family_account_id = p_family_account_id
     and o.status in ('preparada', 'oferecida')
     and o.expira_em > now()
     and p_ramo = any(o.opcoes)
     and (
       o.canal = 'texto'
       or o.provider_message_id is null
       or o.provider_message_id = p_reference_message_id
     )
  returning
    o.id,
    o.membro_atipico_id,
    o.source_inbound_message_id,
    o.source_outbound_message_id,
    o.opcoes,
    o.created_at;
$$;

revoke all on function public.reivindicar_aprofundamento_ayla(uuid, uuid, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.reivindicar_aprofundamento_ayla(uuid, uuid, text, uuid, text)
  to service_role;

comment on table public.ayla_aprofundamento_ofertas is
  'Ofertas contextuais da Ayla; guarda referências e estado, nunca cópia da conversa.';
