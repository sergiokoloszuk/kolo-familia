-- ============================================================
-- Kolo Família — Migração 0065
--   FECHA A BRECHA DO TESTE: apagar a conta e cadastrar de novo dava outros
--   7 dias grátis, quantas vezes a pessoa quisesse.
--
--   Como era: excluir conta chama auth.admin.deleteUser → o usuário sai do
--   auth → ela se cadastra outra vez com o MESMO e-mail → o trigger
--   handle_new_user concede trial_ends_at = now() + 7 dias, sem saber que
--   aquele e-mail já usou. Não havia registro nenhum de teste consumido.
--
--   Como fica: na exclusão, guardamos só o HASH (sha256) do e-mail e do
--   WhatsApp numa tabela de "teste já usado". Hash é irreversível e não
--   identifica ninguém por si — a exclusão continua sendo exclusão de verdade
--   (LGPD), e ainda dá pra reconhecer o retorno.
--
--   Dois pontos de checagem, porque no cadastro a gente só tem o e-mail:
--     1. no signup (trigger handle_new_user) → confere o hash do e-mail;
--     2. quando o WhatsApp é informado (trigger em family_accounts) → confere o
--        hash do número, pegando quem voltou com e-mail novo e telefone igual.
--   Em ambos, o trial nasce/fica VENCIDO (trial_ends_at = now()), então a
--   pessoa cai no paywall que já existe ("seu período grátis acabou") sem
--   precisar de status novo nem de código novo no app.
-- ============================================================

create table if not exists public.testes_usados (
  id uuid primary key default gen_random_uuid(),
  hash_email text,                             -- sha256(lower(trim(email)))
  hash_whatsapp text,                          -- sha256(e164 só com dígitos)
  origem text not null default 'exclusao',     -- exclusao | dunning | admin
  created_at timestamptz not null default now()
);

-- Um registro por e-mail/número (o mesmo retorno não duplica linha).
create unique index if not exists uq_testes_usados_email
  on public.testes_usados (hash_email) where hash_email is not null;
create unique index if not exists uq_testes_usados_whatsapp
  on public.testes_usados (hash_whatsapp) where hash_whatsapp is not null;

alter table public.testes_usados enable row level security;
-- Sem policy: só service-role (que ignora RLS) e as funções security definer.

-- ---------- normalização + hash em UM lugar só ----------
-- Se e-mail e telefone fossem hasheados em lugares diferentes (app e banco),
-- qualquer diferença de trim/caixa criaria hash que nunca casa. Fica aqui.

create or replace function public.hash_identificador(p_valor text, p_tipo text)
returns text
language sql
immutable
as $$
  select case
    when p_valor is null or btrim(p_valor) = '' then null
    when p_tipo = 'email' then encode(digest(lower(btrim(p_valor)), 'sha256'), 'hex')
    else encode(digest(regexp_replace(p_valor, '\D', '', 'g'), 'sha256'), 'hex')
  end;
$$;

/* Registra que aquele e-mail/número já consumiu o teste. Idempotente. */
create or replace function public.registrar_teste_usado(
  p_email text,
  p_whatsapp text,
  p_origem text default 'exclusao'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  h_email text := public.hash_identificador(p_email, 'email');
  h_zap   text := public.hash_identificador(p_whatsapp, 'telefone');
begin
  if h_email is not null then
    insert into public.testes_usados (hash_email, origem)
    values (h_email, p_origem)
    on conflict (hash_email) where hash_email is not null do nothing;
  end if;
  if h_zap is not null then
    insert into public.testes_usados (hash_whatsapp, origem)
    values (h_zap, p_origem)
    on conflict (hash_whatsapp) where hash_whatsapp is not null do nothing;
  end if;
end;
$$;

/* Esse e-mail ou número já usou o teste? */
create or replace function public.teste_ja_usado(p_email text, p_whatsapp text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.testes_usados t
    where (t.hash_email is not null
           and t.hash_email = public.hash_identificador(p_email, 'email'))
       or (t.hash_whatsapp is not null
           and t.hash_whatsapp = public.hash_identificador(p_whatsapp, 'telefone'))
  );
$$;

-- Ninguém além do servidor pode chamar: expor isso pro anon viraria sonda de
-- "esse e-mail existe aqui?" (enumeração).
revoke all on function public.registrar_teste_usado(text, text, text) from public, anon, authenticated;
revoke all on function public.teste_ja_usado(text, text) from public, anon, authenticated;
grant execute on function public.registrar_teste_usado(text, text, text) to service_role;
grant execute on function public.teste_ja_usado(text, text) to service_role;

-- ---------- 1. no signup: e-mail que já usou não ganha trial ----------
-- Mesma função da 0051, com a checagem no meio.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  new_family_id uuid;
  ja_usou boolean;
begin
  insert into public.family_accounts (user_id, whatsapp_e164, onboarding_step)
  values (new.id, null, 1)
  returning id into new_family_id;

  select public.teste_ja_usado(new.email, null) into ja_usou;

  insert into public.subscription_accesses (family_account_id, status, trial_ends_at)
  values (
    new_family_id,
    'trialing',
    case when ja_usou then now() else now() + interval '7 days' end
  );

  insert into public.ayla_preferences (family_account_id, desativada, consentimento_em)
  values (new_family_id, true, null);

  -- Co-acesso: vincula este usuário a convites pendentes com o e-mail dele.
  update public.family_acessos
    set user_id = new.id
    where user_id is null and lower(email) = lower(new.email);

  return new;
end;
$$;

-- ---------- 2. ao informar o WhatsApp: mesmo número, sem trial novo ----------
-- Pega quem voltou com e-mail novo e telefone igual. Roda no banco, então vale
-- pra qualquer caminho que grave o número (onboarding, configurações, admin).
create or replace function public.checar_teste_pelo_whatsapp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.whatsapp_e164 is not null
     and (old.whatsapp_e164 is null or old.whatsapp_e164 <> new.whatsapp_e164)
     and public.teste_ja_usado(null, new.whatsapp_e164)
  then
    update public.subscription_accesses
      set trial_ends_at = now()
      where family_account_id = new.id
        and status = 'trialing'
        and (trial_ends_at is null or trial_ends_at > now());
  end if;
  return new;
end;
$$;

drop trigger if exists family_accounts_checar_teste on public.family_accounts;
create trigger family_accounts_checar_teste
  after update of whatsapp_e164 on public.family_accounts
  for each row execute function public.checar_teste_pelo_whatsapp();

notify pgrst, 'reload schema';

-- ============================================================
-- FIM da migração 0065.
-- Depois de aplicar: o NOTIFY recarrega o schema do PostgREST (senão o
-- rpc/registrar_teste_usado responde PGRST202).
-- ============================================================
