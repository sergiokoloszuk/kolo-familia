-- PEND-218 · preserva a intenção do WhatsApp durante a criação do avatar.
--
-- A tabela guarda o mínimo operacional para retomar história/rotina depois da
-- aprovação humana. Conteúdo infantil não vai na URL; o link transporta apenas
-- o UUID e toda leitura é escopada por família + membro.

create table if not exists public.ludico_intencoes (
  id uuid primary key default gen_random_uuid(),
  family_account_id uuid not null references public.family_accounts(id) on delete cascade,
  membro_atipico_id uuid not null references public.membros_atipicos(id) on delete cascade,
  origem text not null default 'whatsapp' check (origem in ('whatsapp', 'trial', 'app')),
  artefato text not null check (artefato in ('avatar', 'historia', 'rotina')),
  etapa text not null default 'revisar'
    check (etapa in ('revisar', 'aguardando_avatar', 'avatar_aprovado', 'gerando', 'concluida', 'erro', 'cancelada')),
  payload jsonb not null default '{}'::jsonb,
  avatar_id uuid references public.avatares_membros_atipicos(id) on delete set null,
  artefato_id uuid,
  source_message_id uuid references public.ayla_messages(id) on delete set null,
  expira_em timestamptz not null default (now() + interval '30 days'),
  consumida_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ludico_intencoes_family_member_idx
  on public.ludico_intencoes(family_account_id, membro_atipico_id, created_at desc);

create unique index if not exists ludico_intencoes_source_artefato_uidx
  on public.ludico_intencoes(source_message_id, artefato)
  where source_message_id is not null and etapa not in ('cancelada', 'erro');

alter table public.ludico_intencoes enable row level security;

drop policy if exists ludico_intencoes_self on public.ludico_intencoes;
create policy ludico_intencoes_self on public.ludico_intencoes
  for all to authenticated
  using (family_account_id = public.current_family_account_id())
  with check (
    family_account_id = public.current_family_account_id()
    and exists (
      select 1 from public.membros_atipicos m
      where m.id = membro_atipico_id
        and m.family_account_id = public.current_family_account_id()
    )
  );

grant select, insert, update, delete on table public.ludico_intencoes
  to authenticated, service_role;

notify pgrst, 'reload schema';
