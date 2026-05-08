-- ============================================================
-- Kolo Família — Migração 0007
-- Rules Engine: alertas + adaptações reversíveis com salvaguardas.
--
-- Princípios (PRD §12.10):
--   - Alertas têm histerese (condição de disparo ≠ condição de resolução).
--   - Cooldown: depois de resolver, fica X dias sem disparar de novo.
--   - Override: família pode silenciar tipo de regra (ou alerta específico).
--   - Adaptações são reversíveis — guardam snapshot pré + pós.
--   - Engine NUNCA aplica adaptação sozinho. Sempre propõe; mãe aceita.
--   - Tudo auditável.
-- ============================================================

-- ----- Catálogo (alimentado por seed; admin pode editar) -----
create table if not exists public.regras_definicoes (
  key text primary key,
  display_name text not null,
  descricao text not null,
  categoria text not null check (categoria in ('emocional','engajamento','padrao','clinico')),
  severidade_default text not null default 'info'
    check (severidade_default in ('info','warn','high')),
  cooldown_dias int not null default 7 check (cooldown_dias >= 0),
  parametros jsonb not null default '{}'::jsonb,
  ativa boolean not null default true,
  versao int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger regras_definicoes_set_updated_at before update on public.regras_definicoes
  for each row execute function public.set_updated_at();

-- ----- Alertas instanciados -----
create table if not exists public.alertas (
  id uuid primary key default gen_random_uuid(),
  family_account_id uuid not null references public.family_accounts(id) on delete cascade,
  membro_atipico_id uuid references public.membros_atipicos(id) on delete set null,
  regra_key text not null references public.regras_definicoes(key) on delete cascade,
  severidade text not null check (severidade in ('info','warn','high')),
  estado text not null default 'open'
    check (estado in ('open','snoozed','resolvido','descartado')),
  -- Histerese: condições serializadas por evaluate da regra
  contexto jsonb not null default '{}'::jsonb,
  -- Mensagem amigável que aparece pro usuário
  mensagem text not null,
  -- Quando snoozed: até quando ficar oculto
  snoozed_ate timestamptz,
  -- Quando resolvido: quando voltar a poder disparar
  cooldown_ate timestamptz,
  first_disparo_em timestamptz not null default now(),
  last_avaliacao_em timestamptz not null default now(),
  resolvido_em timestamptz,
  resolvido_por_user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists alertas_family_estado_idx
  on public.alertas(family_account_id, estado, created_at desc);
-- Garante apenas 1 alerta open por (família, regra, membro) — engine usa pra idempotência
create unique index if not exists alertas_open_unique
  on public.alertas(family_account_id, regra_key, coalesce(membro_atipico_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where estado = 'open';

-- ----- Overrides (silenciamento por família) -----
create table if not exists public.regras_overrides (
  id uuid primary key default gen_random_uuid(),
  family_account_id uuid not null references public.family_accounts(id) on delete cascade,
  regra_key text not null references public.regras_definicoes(key) on delete cascade,
  silenciada_ate timestamptz,    -- null = permanente até remoção
  motivo text,
  created_by_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique(family_account_id, regra_key)
);
create index if not exists regras_overrides_family_idx on public.regras_overrides(family_account_id);

-- ----- Adaptações sugeridas (reversíveis) -----
create table if not exists public.adaptacoes_sugeridas (
  id uuid primary key default gen_random_uuid(),
  family_account_id uuid not null references public.family_accounts(id) on delete cascade,
  membro_atipico_id uuid references public.membros_atipicos(id) on delete set null,
  alerta_id uuid references public.alertas(id) on delete set null,
  -- Tipo determina o handler em lib/regras/adaptacoes.ts
  tipo text not null check (tipo in (
    'adicionar_kolo_vivo_desafio',
    'ajustar_ayla_horario',
    'sugerir_boa_pratica'
  )),
  titulo text not null,
  descricao text not null,
  -- O que fazer quando aceita
  payload_proposto jsonb not null,
  -- Snapshots pra rollback
  payload_pre jsonb,    -- preenchido na aplicação
  payload_pos jsonb,    -- preenchido na aplicação
  estado text not null default 'pendente' check (estado in (
    'pendente','aplicada','descartada','revertida'
  )),
  aplicada_em timestamptz,
  aplicada_por_user_id uuid references auth.users(id),
  revertida_em timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists adaptacoes_family_estado_idx
  on public.adaptacoes_sugeridas(family_account_id, estado, created_at desc);

-- ----- Auditoria -----
create table if not exists public.regras_eventos_log (
  id uuid primary key default gen_random_uuid(),
  family_account_id uuid not null references public.family_accounts(id) on delete cascade,
  regra_key text references public.regras_definicoes(key) on delete set null,
  alerta_id uuid references public.alertas(id) on delete set null,
  adaptacao_id uuid references public.adaptacoes_sugeridas(id) on delete set null,
  acao text not null check (acao in (
    'disparou','resolveu','snoozed','descartou_alerta','silenciou','dessilenciou',
    'adaptacao_proposta','adaptacao_aplicada','adaptacao_descartada','adaptacao_revertida'
  )),
  detalhe jsonb not null default '{}'::jsonb,
  user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists regras_eventos_log_family_idx
  on public.regras_eventos_log(family_account_id, created_at desc);

-- ============================================================
-- RLS
-- ============================================================

alter table public.regras_definicoes enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='regras_definicoes' and policyname='regras_definicoes_read') then
    create policy regras_definicoes_read on public.regras_definicoes
      for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='regras_definicoes' and policyname='regras_definicoes_admin') then
    create policy regras_definicoes_admin on public.regras_definicoes
      for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

alter table public.alertas enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='alertas' and policyname='alertas_self') then
    create policy alertas_self on public.alertas
      for all to authenticated
      using (family_account_id = public.current_family_account_id())
      with check (family_account_id = public.current_family_account_id());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='alertas' and policyname='alertas_admin') then
    create policy alertas_admin on public.alertas
      for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

alter table public.regras_overrides enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='regras_overrides' and policyname='regras_overrides_self') then
    create policy regras_overrides_self on public.regras_overrides
      for all to authenticated
      using (family_account_id = public.current_family_account_id())
      with check (family_account_id = public.current_family_account_id());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='regras_overrides' and policyname='regras_overrides_admin') then
    create policy regras_overrides_admin on public.regras_overrides
      for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

alter table public.adaptacoes_sugeridas enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='adaptacoes_sugeridas' and policyname='adaptacoes_self') then
    create policy adaptacoes_self on public.adaptacoes_sugeridas
      for all to authenticated
      using (family_account_id = public.current_family_account_id())
      with check (family_account_id = public.current_family_account_id());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='adaptacoes_sugeridas' and policyname='adaptacoes_admin') then
    create policy adaptacoes_admin on public.adaptacoes_sugeridas
      for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

alter table public.regras_eventos_log enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='regras_eventos_log' and policyname='regras_eventos_log_self_read') then
    create policy regras_eventos_log_self_read on public.regras_eventos_log
      for select to authenticated using (family_account_id = public.current_family_account_id());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='regras_eventos_log' and policyname='regras_eventos_log_admin') then
    create policy regras_eventos_log_admin on public.regras_eventos_log
      for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

-- ============================================================
-- Seed do catálogo de regras
-- ============================================================

insert into public.regras_definicoes (key, display_name, descricao, categoria, severidade_default, cooldown_dias, parametros)
values
  (
    'mae_emocional_baixa_3em7',
    'Mãe cansada/triste em vários dias',
    'Disparado quando emocao_mae cai em cansada/triste/ansiosa em ao menos 3 dos últimos 7 check-ins. Resolve quando ≤1 nesses estados em 7 dias.',
    'emocional',
    'warn',
    7,
    '{"limiar_disparo": 3, "limiar_resolucao": 1, "janela_dias": 7}'
  ),
  (
    'dass21_moderado_ou_severo',
    'DASS-21 com pelo menos 1 dimensão moderada/severa',
    'Última aplicação de DASS-21 mostra moderado ou pior em depressão/ansiedade/estresse. Resolve quando próxima aplicação volta a leve.',
    'clinico',
    'high',
    14,
    '{}'
  ),
  (
    'inatividade_diarios_5d',
    'Sem registros há 5+ dias',
    'Família parou de registrar há 5 ou mais dias. Resolve assim que voltar a registrar.',
    'engajamento',
    'info',
    5,
    '{"dias": 5}'
  ),
  (
    'gatilho_recorrente',
    'Mesmo gatilho aparecendo com frequência',
    'O mesmo possivel_gatilho aparece em ≥3 diários nos últimos 14 dias. Sugere adicionar ao Kolo Vivo.',
    'padrao',
    'info',
    14,
    '{"limiar": 3, "janela_dias": 14}'
  )
on conflict (key) do update set
  display_name = excluded.display_name,
  descricao = excluded.descricao,
  categoria = excluded.categoria,
  severidade_default = excluded.severidade_default,
  cooldown_dias = excluded.cooldown_dias,
  parametros = excluded.parametros,
  versao = public.regras_definicoes.versao + 1;

-- ============================================================
-- FIM da migração 0007.
-- ============================================================
