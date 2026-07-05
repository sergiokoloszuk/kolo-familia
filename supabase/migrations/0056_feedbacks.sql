-- ============================================================
-- Kolo Família — Migração 0056
--   feedbacks: elogios, sugestões e reclamações capturados no botão de dúvidas
--   (/ajuda) e, depois, na Ayla. Dúvida de uso a IA resolve sozinha; o que é
--   feedback fica aqui pra a Karina responder e decidir implementar.
--
--   Leitura só admin (a aba de Feedback nos dashboards lê via service-role, e o
--   acesso à área já é gateado por admin/co-acesso). Escrita via service-role.
--
--   IMPORTANTE (PostgREST): depois de aplicar, recarregue o schema cache:
--       NOTIFY pgrst, 'reload schema';
--   (ou reinicie só o container 'rest' — NUNCA o postgres.)
-- ============================================================

create table if not exists public.feedbacks (
  id                uuid primary key default gen_random_uuid(),
  family_account_id uuid references public.family_accounts(id) on delete set null,
  user_id           uuid references auth.users(id) on delete set null,
  origem            text not null check (origem in ('ajuda','ayla')),
  tipo              text not null check (tipo in ('elogio','sugestao','reclamacao','duvida')),
  texto             text not null,
  status            text not null default 'nova' check (status in ('nova','respondida','implementar','arquivada')),
  created_at        timestamptz not null default now(),
  atualizado_em     timestamptz
);

create index if not exists feedbacks_tipo_created_idx on public.feedbacks (tipo, created_at desc);
create index if not exists feedbacks_status_idx on public.feedbacks (status);

alter table public.feedbacks enable row level security;

drop policy if exists feedbacks_admin_select on public.feedbacks;
create policy feedbacks_admin_select on public.feedbacks for select
  using (public.is_admin());
