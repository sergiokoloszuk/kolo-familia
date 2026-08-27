-- ============================================================
-- Kolo Família — Migração 0083  ·  ROLLBACK DA 0082
--   DEVOLVE `handle_new_user` AO ESTADO EM QUE ELA ESTAVA NO DIA 27/08/2026.
--
--   ⚠️ ESTE ARQUIVO NÃO É PARA SER APLICADO NO CAMINHO FELIZ. Ele existe para
--   ser colado no banco **se** a 0082 der errado — nada mais. Aplicá-lo sem
--   necessidade faz o trial voltar a nascer no cadastro, que é exatamente o
--   defeito da PEND-155.
--
--   ⚠️ O CORPO ABAIXO FOI CAPTURADO DO POSTGRES DE PRODUÇÃO, não reconstruído
--   a partir das migrações. Isso importa: a 0082 dizia "recriar com o corpo da
--   0066", e reconstruir de memória teria produzido o corpo da **0065** — que
--   NÃO tem o `begin/exception` em volta de `teste_ja_usado`. Esse bloco foi
--   acrescentado pela 0066 (`pgcrypto` vive em `extensions`, e um erro ali
--   estourava dentro do gatilho e derrubava o cadastro inteiro). Um rollback
--   que perdesse essa proteção reintroduziria um incidente já resolvido.
--
--   Fonte, textualmente:
--     select pg_get_functiondef('public.handle_new_user'::regproc);
--   executado no banco de produção em 27/08/2026, antes de a 0082 ser aplicada.
--
--   ⚠️ O ROLLBACK NÃO EXIGE DESFAZER DEPLOY. O código da Fase 1
--   (`iniciarTrial`, no ar desde `e5df51d`) continua funcionando: com o gatilho
--   antigo de volta, a linha já existe quando o onboarding conclui, e a RPC
--   devolve `ja_existia`. Volta a ser o no-op que era antes da 0082.
--
--   ⚠️ NENHUMA FAMÍLIA É TOCADA. Sem UPDATE, sem backfill, sem DELETE. Quem
--   ganhou (ou não ganhou) teste enquanto a 0082 esteve de pé permanece como
--   está — o gatilho só age em INSERT de usuário novo, daqui para a frente.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
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
$function$;

-- ------------------------------------------------------------
-- VERIFICAÇÃO (read-only) — colar logo depois. Deve devolver `true`.
-- ------------------------------------------------------------
-- select pg_get_functiondef('public.handle_new_user'::regproc)
--          like '%subscription_accesses%' as trial_voltou_para_o_cadastro;
