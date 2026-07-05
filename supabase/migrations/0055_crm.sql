-- ============================================================
-- Kolo Família — Migração 0055
--   CRM de abordagem comercial dos leads no trial (Fase A).
--
--   - crm_leads: estado por lead (em abordagem, aguardando resposta, próximo
--     passo). Uma linha por família que entrou no fluxo de abordagem.
--   - crm_mensagens: a thread da abordagem (enviada por Karina via sistema /
--     recebida do lead). Separada de ayla_messages de propósito — abordagem é
--     comercial, conduzida por humano, não é a Ayla.
--
--   Só admin lê (agência co-acesso vê via app com service-role nas telas). A
--   escrita vem sempre de service-role (sem policy de insert p/ usuário comum).
--
--   IMPORTANTE (PostgREST): depois de aplicar, recarregue o schema cache:
--       NOTIFY pgrst, 'reload schema';
--   (ou reinicie só o container 'rest' — NUNCA o postgres.)
-- ============================================================

create table if not exists public.crm_leads (
  family_account_id   uuid primary key references public.family_accounts(id) on delete cascade,
  em_abordagem        boolean not null default false,
  aguardando_resposta boolean not null default false,
  proximo_passo_em    timestamptz,
  proximo_passo_nota  text,
  updated_at          timestamptz not null default now()
);

create table if not exists public.crm_mensagens (
  id                uuid primary key default gen_random_uuid(),
  family_account_id uuid not null references public.family_accounts(id) on delete cascade,
  direcao           text not null check (direcao in ('enviada','recebida')),
  texto             text not null,
  autor_user_id     uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now()
);

create index if not exists crm_mensagens_family_created_idx
  on public.crm_mensagens (family_account_id, created_at desc);

alter table public.crm_leads enable row level security;
alter table public.crm_mensagens enable row level security;

-- Leitura só admin; escrita via service-role (ignora RLS).
drop policy if exists crm_leads_admin_select on public.crm_leads;
create policy crm_leads_admin_select on public.crm_leads for select
  using (public.is_admin());

drop policy if exists crm_mensagens_admin_select on public.crm_mensagens;
create policy crm_mensagens_admin_select on public.crm_mensagens for select
  using (public.is_admin());
