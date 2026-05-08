-- ============================================================
-- Kolo Família — Migração 0008
-- Beta: convites + feedback NPS in-app.
--
-- Princípios (PRD §13):
--   - Convites têm código de uso único (max_uses=1) ou multi-uso.
--   - Convites podem expirar e ser revogados.
--   - Famílias que entraram via convite ficam vinculadas ao código
--     pra rastrear coortes.
--   - Feedback NPS coletado in-app fica auditável e por-família.
--
-- Idempotente: pode rodar múltiplas vezes.
-- ============================================================

create table if not exists public.beta_invites (
  id uuid primary key default gen_random_uuid(),
  codigo text unique not null,
  rotulo text,                                  -- ex: 'lote_jan26', 'indicacao_psicopedagoga'
  max_uses int not null default 1 check (max_uses >= 1),
  uses_count int not null default 0,
  expira_em timestamptz,
  revogado boolean not null default false,
  criado_por_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  notas text
);
create index if not exists beta_invites_codigo_idx on public.beta_invites(codigo) where revogado = false;

-- Quais famílias entraram com qual código (1:1 com family_accounts)
create table if not exists public.beta_invite_uses (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.beta_invites(id) on delete cascade,
  family_account_id uuid not null references public.family_accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(family_account_id)
);
create index if not exists beta_invite_uses_invite_idx on public.beta_invite_uses(invite_id);

-- Feedback in-app (NPS + comentário curto)
create table if not exists public.feedback_beta (
  id uuid primary key default gen_random_uuid(),
  family_account_id uuid not null references public.family_accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nps int not null check (nps between 0 and 10),
  comentario text,                              -- até 1000 chars
  contexto text,                                -- 'd7','d30','manual'
  created_at timestamptz not null default now()
);
create index if not exists feedback_beta_family_idx on public.feedback_beta(family_account_id, created_at desc);
create index if not exists feedback_beta_nps_idx on public.feedback_beta(nps, created_at desc);

-- ============================================================
-- RLS
-- ============================================================

alter table public.beta_invites enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='beta_invites' and policyname='beta_invites_admin') then
    create policy beta_invites_admin on public.beta_invites
      for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

alter table public.beta_invite_uses enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='beta_invite_uses' and policyname='beta_invite_uses_admin') then
    create policy beta_invite_uses_admin on public.beta_invite_uses
      for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='beta_invite_uses' and policyname='beta_invite_uses_self_read') then
    create policy beta_invite_uses_self_read on public.beta_invite_uses
      for select to authenticated using (family_account_id = public.current_family_account_id());
  end if;
end $$;

alter table public.feedback_beta enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='feedback_beta' and policyname='feedback_beta_self_insert') then
    create policy feedback_beta_self_insert on public.feedback_beta
      for insert to authenticated
      with check (
        user_id = auth.uid()
        and family_account_id = public.current_family_account_id()
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='feedback_beta' and policyname='feedback_beta_self_read') then
    create policy feedback_beta_self_read on public.feedback_beta
      for select to authenticated using (family_account_id = public.current_family_account_id());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='feedback_beta' and policyname='feedback_beta_admin') then
    create policy feedback_beta_admin on public.feedback_beta
      for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

-- ============================================================
-- RPC para incremento atômico de uses_count
-- ============================================================

create or replace function public.increment_invite_uses(p_invite_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.beta_invites
  set uses_count = uses_count + 1
  where id = p_invite_id;
$$;

-- Service role e authenticated podem invocar (gate roda como service role,
-- mas deixamos open pra debug)
grant execute on function public.increment_invite_uses(uuid) to authenticated, service_role;

-- ============================================================
-- FIM da migração 0008.
-- ============================================================
