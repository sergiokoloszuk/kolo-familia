-- ============================================================
-- Kolo Família — Migração 0050
--   user_events: eventos de COMPORTAMENTO de uso do app (telas visitadas,
--   features usadas, frequência). Base dos dashboards de comportamento e do
--   funil de ativação (trial → pago) e do painel do parceiro de tráfego.
--
--   IMPORTANTE — padrão de segurança deste projeto:
--   - A família NÃO é auth.uid(): é uma linha em family_accounts. Filtragem
--     por família usa public.current_family_account_id(), nunca auth.uid().
--   - Escrita é SÓ via service-role (a rota /api/track carimba a família no
--     servidor). Sem policy de insert pro client — evento não se forja.
--   - Leitura é só admin (is_admin()). Dashboards são admin-only por ora.
-- ============================================================

create table if not exists public.user_events (
  id                uuid        primary key default gen_random_uuid(),
  family_account_id uuid        references public.family_accounts(id) on delete cascade,
  user_id           uuid        references auth.users(id) on delete set null,
  evento            text        not null,                       -- 'tela_visitada', 'ludico_gerado', ...
  detalhe           jsonb       not null default '{}'::jsonb,   -- { tela, path, tipo, ... }
  created_at        timestamptz not null default now()
);

create index if not exists idx_user_events_family_created
  on public.user_events (family_account_id, created_at desc);
create index if not exists idx_user_events_evento_created
  on public.user_events (evento, created_at desc);
create index if not exists idx_user_events_created
  on public.user_events (created_at desc);
create index if not exists idx_user_events_detalhe
  on public.user_events using gin (detalhe);

alter table public.user_events enable row level security;

-- Leitura: só admin. Escrita: service-role (ignora RLS) — sem policy de insert.
drop policy if exists user_events_admin_select on public.user_events;
create policy user_events_admin_select on public.user_events for select
  using (public.is_admin());

notify pgrst, 'reload schema';

-- ============================================================
-- FIM da migração 0050.
-- ============================================================
