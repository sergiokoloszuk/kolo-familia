-- ============================================================
-- Black Friday 2026 — infraestrutura DESLIGADA por padrão.
--
-- NÃO APLICAR enquanto a PEND-092 não provar backup + restauração.
-- Aplicar esta migração não ativa a campanha, não envia mensagem e não cobra.
-- ============================================================

insert into public.configuracao_geral (chave, valor, descricao) values
  ('black_friday_2026_estado', 'desligada', 'desligada | ativa | pausada | encerrada'),
  ('black_friday_2026_backup_prova', '', 'Referência da prova de backup restaurado antes da ativação')
on conflict (chave) do nothing;

create table if not exists public.black_friday_2026_participacoes (
  family_account_id uuid primary key
    references public.family_accounts(id) on delete cascade,
  origem text not null check (origem in (
    'novo_cadastro', 'trial_em_curso', 'trial_encerrado', 'ex_assinante'
  )),
  ativado_em timestamptz not null default now(),
  trial_inicio_em timestamptz not null,
  trial_fim_em timestamptz not null,
  oferta_fim_exclusivo timestamptz not null,
  checkout_session_id text unique,
  checkout_iniciado_em timestamptz,
  checkout_expira_em timestamptz,
  checkout_concluido_em timestamptz,
  convertido_em timestamptz,
  stripe_price_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (trial_fim_em > trial_inicio_em),
  check (oferta_fim_exclusivo >= trial_fim_em),
  check (
    (checkout_session_id is null and checkout_iniciado_em is null and checkout_expira_em is null)
    or
    (checkout_session_id is not null and checkout_iniciado_em is not null and checkout_expira_em is not null
      and checkout_expira_em = checkout_iniciado_em + interval '30 minutes')
  )
);

create trigger black_friday_2026_participacoes_updated_at
  before update on public.black_friday_2026_participacoes
  for each row execute function public.set_updated_at();

alter table public.black_friday_2026_participacoes enable row level security;
-- Sem policies de propósito: família acessa apenas pela RPC filtrada; escrita é
-- do banco/service-role. Isso impede alterar o próprio prazo pelo navegador.

create table if not exists public.black_friday_2026_auditoria (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id),
  acao text not null,
  estado_anterior text,
  estado_novo text,
  detalhe jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.black_friday_2026_auditoria enable row level security;

create or replace function public.bf2026_fim_oferta_exclusivo(p_trial_fim timestamptz)
returns timestamptz
language sql
immutable
set search_path = public
as $$
  select greatest(
    '2026-12-01 03:00:00+00'::timestamptz,
    (((p_trial_fim at time zone 'America/Sao_Paulo')::date + 1)::timestamp
      at time zone 'America/Sao_Paulo')
  );
$$;

-- Proteção estrutural: qualquer início de trial ocorrido enquanto a chave está
-- ativa nasce com 15 dias e uma participação única. Dois cliques simultâneos
-- colidem na PK, em vez de somar dias.
create or replace function public.bf2026_proteger_trial()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_estado text;
  v_origem text;
  v_trial_inicio timestamptz;
  v_trial_fim timestamptz;
begin
  select valor into v_estado from public.configuracao_geral
   where chave = 'black_friday_2026_estado';

  if v_estado <> 'ativa'
     or now() < '2026-10-30 03:00:00+00'::timestamptz
     or now() >= '2026-12-01 03:00:00+00'::timestamptz
     or new.status <> 'trialing'
     or (coalesce(new.cortesia, false) = true
         and (new.cortesia_ate is null or new.cortesia_ate > now()))
     or (new.stripe_subscription_id is not null and not (
       case when tg_op = 'UPDATE'
         then old.status = 'canceled' and new.status = 'trialing'
         else false
       end
     ))
     or exists (
       select 1 from public.black_friday_2026_participacoes p
        where p.family_account_id = new.family_account_id
     ) then
    return new;
  end if;

  v_origem := case
    when tg_op = 'INSERT' then 'novo_cadastro'
    when old.stripe_subscription_id is not null then 'ex_assinante'
    else 'trial_encerrado'
  end;
  v_trial_inicio := now();
  v_trial_fim := greatest(coalesce(new.trial_ends_at, now()), now() + interval '15 days');
  new.trial_ends_at := v_trial_fim;

  insert into public.black_friday_2026_participacoes (
    family_account_id, origem, trial_inicio_em, trial_fim_em, oferta_fim_exclusivo
  ) values (
    new.family_account_id, v_origem, v_trial_inicio, v_trial_fim,
    public.bf2026_fim_oferta_exclusivo(v_trial_fim)
  );
  return new;
end;
$$;

drop trigger if exists subscription_accesses_bf2026 on public.subscription_accesses;
create trigger subscription_accesses_bf2026
  before insert or update of status, trial_ends_at on public.subscription_accesses
  for each row execute function public.bf2026_proteger_trial();

-- A própria pessoa pede o benefício. Não existe lista disparando reativação.
create or replace function public.ativar_meu_trial_black_friday_2026()
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_family uuid;
  v_sub public.subscription_accesses%rowtype;
  v_estado text;
begin
  select id into v_family from public.family_accounts where user_id = auth.uid();
  if v_family is null then return 'familia_inexistente'; end if;

  select valor into v_estado from public.configuracao_geral
   where chave = 'black_friday_2026_estado';
  if v_estado <> 'ativa' then return 'campanha_inativa'; end if;
  if now() < '2026-10-30 03:00:00+00'::timestamptz
     or now() >= '2026-12-01 03:00:00+00'::timestamptz then
    return 'fora_da_janela';
  end if;
  if exists (select 1 from public.black_friday_2026_participacoes
              where family_account_id = v_family) then
    return 'ja_utilizou';
  end if;

  select * into v_sub from public.subscription_accesses
   where family_account_id = v_family for update;
  if not found then return 'sem_historico'; end if;
  if v_sub.status = 'active'
     or (coalesce(v_sub.cortesia, false) = true
         and (v_sub.cortesia_ate is null or v_sub.cortesia_ate > now()))
     or (v_sub.current_period_end is not null and v_sub.current_period_end > now())
     or (v_sub.status = 'past_due' and v_sub.pagamento_falhou_em is not null) then
    return 'acesso_atual_nao_elegivel';
  end if;
  if v_sub.status = 'trialing' and v_sub.trial_ends_at > now() then
    return 'trial_ja_em_curso';
  end if;

  update public.subscription_accesses
     set status = 'trialing', trial_ends_at = now() + interval '15 days',
         pagamento_falhou_em = null, updated_at = now()
   where family_account_id = v_family;

  if not exists (select 1 from public.black_friday_2026_participacoes
                  where family_account_id = v_family) then
    raise exception 'BF2026_PARTICIPACAO_NAO_REGISTRADA';
  end if;
  return 'ativado';
end;
$$;

grant execute on function public.ativar_meu_trial_black_friday_2026() to authenticated;

create or replace function public.minha_oferta_black_friday_2026()
returns table (
  participa boolean,
  trial_fim_em timestamptz,
  oferta_fim_exclusivo timestamptz,
  checkout_expira_em timestamptz
)
language sql
security definer
set search_path = public, auth
as $$
  select true, p.trial_fim_em, p.oferta_fim_exclusivo, p.checkout_expira_em
    from public.black_friday_2026_participacoes p
    join public.family_accounts f on f.id = p.family_account_id
   where f.user_id = auth.uid();
$$;

grant execute on function public.minha_oferta_black_friday_2026() to authenticated;

create or replace function public.registrar_meu_checkout_black_friday_2026(
  p_session_id text,
  p_iniciado_em timestamptz,
  p_expira_em timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_family uuid;
  v_estado text;
  v_linhas integer;
begin
  if coalesce(btrim(p_session_id), '') = ''
     or p_expira_em <> p_iniciado_em + interval '30 minutes'
     or abs(extract(epoch from (now() - p_iniciado_em))) > 120 then
    return false;
  end if;
  select id into v_family from public.family_accounts where user_id = auth.uid();
  if v_family is null then return false; end if;
  select valor into v_estado from public.configuracao_geral
   where chave = 'black_friday_2026_estado';
  if v_estado not in ('ativa', 'pausada') then return false; end if;

  update public.black_friday_2026_participacoes
     set checkout_session_id = p_session_id,
         checkout_iniciado_em = p_iniciado_em,
         checkout_expira_em = p_expira_em
   where family_account_id = v_family
     and p_iniciado_em < oferta_fim_exclusivo
     and (checkout_expira_em is null or checkout_expira_em <= now());
  get diagnostics v_linhas = row_count;
  return v_linhas = 1;
end;
$$;

grant execute on function public.registrar_meu_checkout_black_friday_2026(text, timestamptz, timestamptz)
  to authenticated;

-- Liga a chave e, na mesma transação, completa os trials que já estavam em
-- curso. Se qualquer escrita falhar, nada fica meio ligado.
create or replace function public.ativar_black_friday_2026()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_admin uuid := auth.uid();
  v_estado text;
  v_prova text;
  v_afetadas integer := 0;
begin
  if v_admin is null or not public.is_admin() then
    raise exception 'BF2026_ADMIN_OBRIGATORIO';
  end if;
  if now() < '2026-10-30 03:00:00+00'::timestamptz
     or now() >= '2026-12-01 03:00:00+00'::timestamptz then
    raise exception 'BF2026_FORA_DA_JANELA';
  end if;
  select valor into v_prova from public.configuracao_geral
   where chave = 'black_friday_2026_backup_prova';
  if coalesce(btrim(v_prova), '') = '' then
    raise exception 'BF2026_BACKUP_RESTAURADO_NAO_PROVADO';
  end if;
  select valor into v_estado from public.configuracao_geral
   where chave = 'black_friday_2026_estado' for update;
  if v_estado = 'encerrada' then raise exception 'BF2026_JA_ENCERRADA'; end if;

  with candidatas as (
    select s.family_account_id, s.trial_ends_at as fim_anterior,
           s.trial_ends_at + interval '8 days' as fim_novo
      from public.subscription_accesses s
     where s.status = 'trialing' and s.trial_ends_at > now()
       and s.stripe_subscription_id is null
       and not (coalesce(s.cortesia, false) = true
                and (s.cortesia_ate is null or s.cortesia_ate > now()))
       and not exists (select 1 from public.black_friday_2026_participacoes p
                        where p.family_account_id = s.family_account_id)
     for update
  ), inseridas as (
    insert into public.black_friday_2026_participacoes (
      family_account_id, origem, trial_inicio_em, trial_fim_em, oferta_fim_exclusivo
    )
    select family_account_id, 'trial_em_curso', fim_anterior - interval '7 days',
           fim_novo, public.bf2026_fim_oferta_exclusivo(fim_novo)
      from candidatas
    on conflict (family_account_id) do nothing
    returning family_account_id, trial_fim_em
  )
  update public.subscription_accesses s
     set trial_ends_at = i.trial_fim_em, updated_at = now()
    from inseridas i where s.family_account_id = i.family_account_id;
  get diagnostics v_afetadas = row_count;

  insert into public.configuracao_geral (chave, valor, descricao, updated_at)
  values ('black_friday_2026_estado', 'ativa', 'desligada | ativa | pausada | encerrada', now())
  on conflict (chave) do update set valor = excluded.valor, updated_at = excluded.updated_at;

  insert into public.black_friday_2026_auditoria (
    admin_user_id, acao, estado_anterior, estado_novo, detalhe
  ) values (v_admin, 'ativar', v_estado, 'ativa', jsonb_build_object(
    'trials_em_curso_completados', v_afetadas,
    'backup_prova', v_prova
  ));
  return jsonb_build_object('estado', 'ativa', 'trials_em_curso_completados', v_afetadas);
end;
$$;

create or replace function public.pausar_black_friday_2026()
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_admin uuid := auth.uid();
  v_estado text;
begin
  if v_admin is null or not public.is_admin() then
    raise exception 'BF2026_ADMIN_OBRIGATORIO';
  end if;
  select valor into v_estado from public.configuracao_geral
   where chave = 'black_friday_2026_estado' for update;
  if v_estado <> 'ativa' then return coalesce(v_estado, 'desligada'); end if;
  update public.configuracao_geral set valor = 'pausada', updated_at = now()
   where chave = 'black_friday_2026_estado';
  insert into public.black_friday_2026_auditoria
    (admin_user_id, acao, estado_anterior, estado_novo)
  values (v_admin, 'pausar', v_estado, 'pausada');
  return 'pausada';
end;
$$;

grant execute on function public.ativar_black_friday_2026() to authenticated;
grant execute on function public.pausar_black_friday_2026() to authenticated;

-- Verificação pós-aplicação (somente leitura):
-- select chave, valor from configuracao_geral where chave like 'black_friday_2026_%';
-- select count(*) from black_friday_2026_participacoes; -- esperado antes da ativação: 0
