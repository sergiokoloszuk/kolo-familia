-- ============================================================
-- Kolo Família — Migração 0080
--   VERIFICAÇÃO DO WHATSAPP — a estrutura que hoje não existe.
--
--   MEDIDO EM 20/08/2026: não há OTP, não há campo de telefone verificado e
--   não há rate limit em lugar nenhum do repositório. O único `verifyOtp` é o
--   do Supabase, e é de e-mail.
--
--   POR QUE TABELA NOVA, e não `acessos_app`. Ela foi a primeira candidata e
--   NÃO serve:
--     · `token` é UNIQUE GLOBAL — um código de 6 dígitos colidiria entre
--       famílias o tempo todo;
--     · não tem contador de tentativas nem de reenvios;
--     · não guarda o NÚMERO a que o código se refere — e sem isso "corrigir o
--       telefone" não invalida a confirmação anterior, que é requisito desta
--       frente.
--   Reusá-la seria dar semântica errada a um mecanismo existente (§4 do
--   protocolo): reutilizar é usar o padrão, não forçar a tabela.
--
--   ⚠️ SOMENTE ADITIVA. Nenhum UPDATE, DELETE ou DROP. Nenhuma tabela
--   existente é alterada. Nenhuma família existente é tocada. Aplicar isto
--   sozinho não muda comportamento nenhum: nada no código publicado lê ou
--   escreve nesta tabela ainda.
-- ============================================================

create table if not exists public.verificacoes_whatsapp (
  id uuid primary key default gen_random_uuid(),
  family_account_id uuid not null
    references public.family_accounts(id) on delete cascade,

  -- O número ao qual ESTE código pertence. É o que faz "corrigir número"
  -- invalidar a verificação anterior sem nenhuma lógica extra: mudou o
  -- telefone, a linha não casa mais com `family_accounts.whatsapp_e164`.
  telefone_e164 text not null,

  -- NUNCA o código em texto puro. Só o sha256, calculado no servidor.
  codigo_hash text not null,

  expira_em     timestamptz not null,
  tentativas    int not null default 0,
  reenvios      int not null default 0,
  verificado_em timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- UMA verificação viva por família. Reenviar e corrigir o número ATUALIZAM a
-- linha; nunca criam outra. É o que impede que retry, duplo clique ou
-- reprocessamento gerem duplicidade — e é a mesma razão de o índice ser único.
create unique index if not exists verificacoes_whatsapp_familia_idx
  on public.verificacoes_whatsapp (family_account_id);

-- Para a limpeza das expiradas, quando ela existir.
create index if not exists verificacoes_whatsapp_expira_idx
  on public.verificacoes_whatsapp (expira_em);

-- `updated_at` automático, pelo mesmo helper de 0001 que as outras usam.
drop trigger if exists verificacoes_whatsapp_set_updated_at
  on public.verificacoes_whatsapp;
create trigger verificacoes_whatsapp_set_updated_at
  before update on public.verificacoes_whatsapp
  for each row execute function public.set_updated_at();

-- RLS ligada e SEM policy: só o service-role escreve e lê. O código de
-- verificação nunca pode chegar ao cliente, nem por engano de consulta.
alter table public.verificacoes_whatsapp enable row level security;

comment on table public.verificacoes_whatsapp is
  'Códigos de verificação do WhatsApp. Só o hash, nunca o código. Uma linha viva por família. Acesso apenas por service-role.';
comment on column public.verificacoes_whatsapp.telefone_e164 is
  'Número a que este código se refere. Corrigir o telefone invalida a verificação porque a linha deixa de casar com family_accounts.whatsapp_e164.';
comment on column public.verificacoes_whatsapp.codigo_hash is
  'sha256 do código. O código em texto puro não é persistido em lugar nenhum.';

-- ------------------------------------------------------------
-- ROLLBACK:
--   drop table if exists public.verificacoes_whatsapp;
-- Aditiva e isolada: nada mais depende dela nesta fase.
-- ------------------------------------------------------------
