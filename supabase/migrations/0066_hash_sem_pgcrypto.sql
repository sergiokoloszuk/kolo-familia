-- ============================================================
-- Kolo Família — Migração 0066 (URGENTE — conserta a 0065)
--
--   A 0065 quebrou o CADASTRO: `handle_new_user` passou a chamar
--   `teste_ja_usado` → `hash_identificador` → `digest(...,'sha256')`, e o
--   pgcrypto NÃO está no search_path dessas funções (fixei `public`, mas o
--   pgcrypto vive em `extensions`). Resultado: a função lançava
--   "function digest(text, unknown) does not exist", o trigger de novo usuário
--   abortava e o signup respondia HTTP 500 "Database error creating new user".
--
--   Duas correções:
--   1. Hash sem depender de extensão: `sha256()` + `convert_to()` são
--      built-ins do Postgres (11+), sempre visíveis em pg_catalog. O resultado
--      é IDÊNTICO ao digest (mesmos bytes UTF-8 → mesmo sha256), e a tabela
--      `testes_usados` estava vazia, então não há hash antigo pra migrar.
--   2. O cadastro NUNCA mais pode falhar por causa da checagem antifraude:
--      `handle_new_user` passa a tratar exceção e, na dúvida, CONCEDE o trial.
--      Melhor dar 7 dias a mais pra alguém do que trancar a porta de uma mãe
--      nova na cara.
-- ============================================================

create or replace function public.hash_identificador(p_valor text, p_tipo text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_valor is null or btrim(p_valor) = '' then null
    when p_tipo = 'email'
      then encode(sha256(convert_to(lower(btrim(p_valor)), 'UTF8')), 'hex')
    else encode(sha256(convert_to(regexp_replace(p_valor, '\D', '', 'g'), 'UTF8')), 'hex')
  end;
$$;

-- Cadastro à prova de falha da checagem: se qualquer coisa der errado ao
-- consultar "esse e-mail já usou o teste?", o trial é concedido normalmente.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  new_family_id uuid;
  ja_usou boolean := false;
begin
  insert into public.family_accounts (user_id, whatsapp_e164, onboarding_step)
  values (new.id, null, 1)
  returning id into new_family_id;

  begin
    select public.teste_ja_usado(new.email, null) into ja_usou;
  exception when others then
    -- Nunca bloquear cadastro por causa disto.
    ja_usou := false;
  end;

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

-- Mesma proteção no trigger do WhatsApp: se a checagem falhar, não estoura o
-- update do número (a mãe está só salvando o telefone dela).
create or replace function public.checar_teste_pelo_whatsapp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ja_usou boolean := false;
begin
  if new.whatsapp_e164 is not null
     and (old.whatsapp_e164 is null or old.whatsapp_e164 <> new.whatsapp_e164)
  then
    begin
      select public.teste_ja_usado(null, new.whatsapp_e164) into ja_usou;
    exception when others then
      ja_usou := false;
    end;

    if ja_usou then
      update public.subscription_accesses
        set trial_ends_at = now()
        where family_account_id = new.id
          and status = 'trialing'
          and (trial_ends_at is null or trial_ends_at > now());
    end if;
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';

-- ============================================================
-- FIM da migração 0066.
-- Verificação rápida depois de aplicar (deve devolver um hash, não erro):
--   select public.hash_identificador('teste@example.com', 'email');
-- ============================================================
