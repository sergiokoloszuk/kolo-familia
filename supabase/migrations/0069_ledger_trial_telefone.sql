-- ============================================================
-- Kolo Família — Migração 0069
--   LEDGER DE TESTE POR TELEFONE — fecha o que sobrou da 0065/0066.
--
--   Regra de produto (Sérgio, 25/07/2026): 1 número = 1 teste, PARA SEMPRE.
--
--   O que a 0065 já fazia: na EXCLUSÃO da conta, guardava o hash do e-mail e
--   do WhatsApp; quem se recadastrava com o mesmo e-mail/número não ganhava
--   outros 7 dias.
--
--   O buraco que ficou: o ledger só era escrito na exclusão. Quem NÃO exclui a
--   conta — deixa o trial vencer e cria outra com e-mail novo — não deixava
--   rastro nenhum. O índice único de WhatsApp (0038) impede a conta nova de
--   SALVAR o mesmo número, mas ela já nasceu com 7 dias de trial e funciona no
--   app pela web sem nunca informar WhatsApp. Trial ilimitado por e-mail novo.
--
--   O que muda aqui:
--   1. O ledger passa a ser escrito quando o teste é CONSUMIDO (o número entra
--      numa conta), não só quando a conta some. O hash sobrevive à exclusão.
--   2. O ledger passa a saber de QUAL família veio o hash — senão a própria
--      dona do número perderia o trial ao corrigir o telefone (A → B → A).
--      Na exclusão da família, a coluna vira NULL (on delete set null) e o
--      hash passa a bloquear qualquer conta.
--   3. Backfill: todo número já em uso hoje entra no ledger amarrado à própria
--      família. Ninguém em uso é afetado; quem sair fica registrado.
--
--   Continua valendo o princípio da 0066: NADA aqui pode derrubar um cadastro.
--   Toda checagem roda dentro de begin/exception e, na dúvida, LIBERA.
-- ============================================================

-- ---------- 1. de quem é o hash ----------
alter table public.testes_usados
  add column if not exists family_account_id uuid
    references public.family_accounts(id) on delete set null;

comment on column public.testes_usados.family_account_id is
  'Família que consumiu o teste. Vira NULL quando a conta é excluída — e aí o hash bloqueia qualquer cadastro novo.';

create index if not exists idx_testes_usados_family
  on public.testes_usados (family_account_id) where family_account_id is not null;

-- ---------- 2. registrar sabendo a origem ----------
-- Assinatura nova com 4º parâmetro DEFAULT: as chamadas existentes do app
-- (p_email, p_whatsapp, p_origem) seguem funcionando sem mudança.
create or replace function public.registrar_teste_usado(
  p_email text,
  p_whatsapp text,
  p_origem text default 'exclusao',
  p_family_account_id uuid default null
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
    insert into public.testes_usados (hash_email, origem, family_account_id)
    values (h_email, p_origem, p_family_account_id)
    on conflict (hash_email) where hash_email is not null do nothing;
  end if;
  if h_zap is not null then
    insert into public.testes_usados (hash_whatsapp, origem, family_account_id)
    values (h_zap, p_origem, p_family_account_id)
    on conflict (hash_whatsapp) where hash_whatsapp is not null do nothing;
  end if;
end;
$$;

/* Esse e-mail/número já usou o teste em OUTRA conta?
   Passar p_family_account_id evita o falso positivo mais óbvio: a própria dona
   do número trocando/corrigindo o telefone dela. Sem o parâmetro, comporta-se
   igual à teste_ja_usado antiga. */
create or replace function public.teste_ja_usado_por_outro(
  p_email text,
  p_whatsapp text,
  p_family_account_id uuid default null
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.testes_usados t
    where (
            (t.hash_email is not null
             and t.hash_email = public.hash_identificador(p_email, 'email'))
         or (t.hash_whatsapp is not null
             and t.hash_whatsapp = public.hash_identificador(p_whatsapp, 'telefone'))
          )
      and (p_family_account_id is null
           or t.family_account_id is null
           or t.family_account_id <> p_family_account_id)
  );
$$;

-- A versão de 3 argumentos da 0065 tem que SAIR: com o 4º parâmetro tendo
-- default, uma chamada de 3 args casaria com as duas e o Postgres recusa por
-- ambiguidade ("function is not unique"). O app chama por nome (p_email,
-- p_whatsapp, p_origem) e passa a resolver nesta aqui.
drop function if exists public.registrar_teste_usado(text, text, text);

revoke all on function public.registrar_teste_usado(text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.teste_ja_usado_por_outro(text, text, uuid) from public, anon, authenticated;
grant execute on function public.registrar_teste_usado(text, text, text, uuid) to service_role;
grant execute on function public.teste_ja_usado_por_outro(text, text, uuid) to service_role;

-- ---------- 3. o número entrou numa conta: checa E registra ----------
-- Ordem importa: PRIMEIRO checar (senão o próprio registro se auto-bloqueia),
-- depois gravar. Vale pra insert e update, porque o número pode chegar por
-- qualquer caminho (onboarding, configurações, admin, importação).
create or replace function public.checar_teste_pelo_whatsapp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ja_usou boolean := false;
  mudou boolean;
begin
  if new.whatsapp_e164 is null then
    return new;
  end if;

  mudou := (tg_op = 'INSERT')
        or (old.whatsapp_e164 is null)
        or (old.whatsapp_e164 <> new.whatsapp_e164);
  if not mudou then
    return new;
  end if;

  begin
    select public.teste_ja_usado_por_outro(null, new.whatsapp_e164, new.id) into ja_usou;
  exception when others then
    ja_usou := false;  -- nunca travar quem só está salvando o telefone
  end;

  if ja_usou then
    update public.subscription_accesses
      set trial_ends_at = now()
      where family_account_id = new.id
        and status = 'trialing'
        and (trial_ends_at is null or trial_ends_at > now());
  end if;

  -- O teste deste número passa a estar registrado a partir de agora, mesmo que
  -- a conta nunca seja excluída. É isto que faz "1 número = 1 teste" valer.
  begin
    perform public.registrar_teste_usado(null, new.whatsapp_e164, 'trial', new.id);
  exception when others then
    null;
  end;

  return new;
end;
$$;

drop trigger if exists family_accounts_checar_teste on public.family_accounts;
create trigger family_accounts_checar_teste
  after insert or update of whatsapp_e164 on public.family_accounts
  for each row execute function public.checar_teste_pelo_whatsapp();

-- ---------- 4. backfill: os números que já estão em uso ----------
-- Amarrados à própria família → ninguém em uso perde nada agora. Quando a
-- conta for excluída, o vínculo vira NULL e o hash passa a bloquear.
insert into public.testes_usados (hash_whatsapp, origem, family_account_id)
select distinct on (public.hash_identificador(f.whatsapp_e164, 'telefone'))
       public.hash_identificador(f.whatsapp_e164, 'telefone'),
       'backfill',
       f.id
  from public.family_accounts f
 where f.whatsapp_e164 is not null
   and btrim(f.whatsapp_e164) <> ''
 order by public.hash_identificador(f.whatsapp_e164, 'telefone'), f.created_at
on conflict (hash_whatsapp) where hash_whatsapp is not null do nothing;

notify pgrst, 'reload schema';

-- ============================================================
-- FIM da migração 0069.
--
-- Verificação depois de aplicar:
--   -- quantos números o ledger conhece (deve bater com as famílias com WhatsApp)
--   select origem, count(*) from public.testes_usados group by origem;
--   -- ninguém em uso pode ter sido bloqueado pelo backfill:
--   select count(*) from public.subscription_accesses
--    where status = 'trialing' and trial_ends_at <= now();
--   -- (compare com o valor de ANTES; o backfill não roda o trigger, então
--   --  este número não deve mudar por causa desta migração)
-- ============================================================
