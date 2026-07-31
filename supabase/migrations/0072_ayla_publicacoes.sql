-- Idempotência de PUBLICAÇÃO (ADR 0001).
--
-- Só acrescenta: uma tabela nova. Não altera nada existente, não cria extensão,
-- não toca em `handle_new_user`. ⚠️ NÃO APLICADA — ver docs/bia-aplicacao-0071.md
-- para o procedimento e a ordem das migrações pendentes.
--
-- Por que existe: a reconferência de posse (`entrega/posse.ts`) resolve o caso
-- comum, mas duas execuções podem passar por ela no mesmo instante. O índice
-- único em `source_message_id` é o que torna "uma publicação por inbound" uma
-- garantia do banco, e não uma corrida bem-comportada.
--
-- O código DEGRADA em silêncio se esta migração não estiver aplicada: sem a
-- tabela, a posse continua valendo e perdemos só esta trava extra. Mesmo padrão
-- da 0070 (coluna `processada_em`).

create table if not exists public.ayla_publicacoes (
  id uuid primary key default gen_random_uuid(),
  family_account_id uuid not null references public.family_accounts(id) on delete cascade,

  -- A inbound que originou a resposta. UNIQUE: é a trava.
  source_message_id text not null,

  -- Qual execução publicou. Só para auditoria de corrida.
  execution_id text not null,

  response_type text not null check (response_type in ('resposta', 'entrega', 'sistema')),

  created_at timestamptz not null default now()
);

create unique index if not exists ayla_publicacoes_source_uk
  on public.ayla_publicacoes (source_message_id);

create index if not exists ayla_publicacoes_familia_idx
  on public.ayla_publicacoes (family_account_id, created_at desc);

alter table public.ayla_publicacoes enable row level security;

-- Conteúdo operacional: nenhuma família lê isto. Só service role (a Ayla) e
-- admin. Sem policy de select para `authenticated` — é registro de entrega, não
-- dado do usuário.
create policy ayla_publicacoes_admin on public.ayla_publicacoes
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

comment on table public.ayla_publicacoes is
  'Uma linha por publicação entregue à família. O unique em source_message_id garante no máximo uma resposta por mensagem recebida (ADR 0001).';
