-- ============================================================
-- Kolo Família — Migração 0084
--   O DIREITO AO PRIMEIRO TESTE, PARA QUEM O PERDEU SEM USAR.
--
--   A 0082 tirou o teste do cadastro — mas só daqui para a frente. Quem se
--   cadastrou antes ficou com os 7 dias queimados sem nunca ter entrado: o
--   relógio corria enquanto a pessoa não confirmava o e-mail.
--
--   MEDIDO EM 27/08/2026, sobre as 237 contas: **96** estão nesta situação —
--   cadastro anterior à 0082, onboarding incompleto, e **nenhum** dos quatro
--   sinais de uso real (mensagem recebida, diário, plano, check-in). Dessas,
--   71 nunca fizeram login e 71 nunca confirmaram o e-mail.
--
--   ⚠️ ISTO NÃO CONCEDE TESTE A NINGUÉM. A tabela registra um DIREITO FUTURO,
--   consumido só quando a família VOLTA e conclui o onboarding. Sem backfill:
--   conceder 96 testes agora encheria a fila de D1–D7 de gente que não está lá.
--
--   ⚠️ POR QUE A LISTA É EXPLÍCITA, e não uma regra calculada. Duas razões:
--     1. `created_at < data_da_0082` sozinho não distingue quem usou de quem
--        não usou, e conceder a quem já usou seria reabrir a brecha da 0065;
--     2. os quatro sinais MUDAM — uma família que voltar amanhã e mandar uma
--        mensagem deixaria de ser elegível pela regra calculada, mesmo tendo
--        perdido o teste sem usar. A fotografia precisa ser de HOJE, congelada.
--        Recalcular na RPC também custaria varrer 4 tabelas em toda conclusão
--        de onboarding, num banco com piso de ~900 ms por consulta (PEND-117).
--
--   ⚠️ QUEM FICOU DE FORA, e por quê:
--     · 126 concluíram o onboarding      → tiveram o teste que contrataram;
--     · 11 têm acesso hoje                → nada a conceder;
--     · 2 são assinantes ativas           → protegidas;
--     · 2 incompletas COM sinal de uso    → usaram, ainda que pouco.
--   Conferido também, e sem nenhum caso: vínculo Stripe, carimbo de dunning,
--   `past_due`/`canceled`/`paused`, cortesia.
-- ============================================================

create table if not exists public.trial_legado_elegivel (
  -- ⚠️ A PK É A GARANTIA. Uma família não pode ter duas elegibilidades — e
  -- isso é do Postgres, não de lógica de aplicação.
  family_account_id uuid primary key
    references public.family_accounts(id) on delete cascade,
  motivo      text        not null default 'pre_0082_nunca_usou',
  created_at  timestamptz not null default now(),
  -- Nulo = direito vivo. Preenchido = já resgatado, e nunca mais.
  redeemed_at timestamptz null
);

-- Índice parcial: a RPC só pergunta por direito VIVO, e ele encolhe conforme
-- as famílias voltam.
create index if not exists trial_legado_elegivel_vivo_idx
  on public.trial_legado_elegivel (family_account_id)
  where redeemed_at is null;

alter table public.trial_legado_elegivel enable row level security;
-- Sem policy, de propósito: só service-role e a RPC (security definer) leem.
-- Isto não é dado que a família consulta; é registro operacional.

-- ------------------------------------------------------------
-- A FOTOGRAFIA — 96 famílias, auditadas em 27/08/2026.
-- `on conflict do nothing` para a migração ser reexecutável sem estragar
-- resgates que já tenham acontecido.
-- ------------------------------------------------------------
insert into public.trial_legado_elegivel (family_account_id, motivo) values
  ('07b09f79-f379-4505-9eac-44657fc90b14', 'pre_0082_nunca_usou'),
  ('08ddf78d-a5a1-42e2-baf6-910000c20463', 'pre_0082_nunca_usou'),
  ('0ad5fd39-4db8-47f1-ab48-ee52578684d6', 'pre_0082_nunca_usou'),
  ('12ddc9b0-bcc5-41de-b2fd-e8da22becd52', 'pre_0082_nunca_usou'),
  ('19315846-e9ff-4800-974d-01497ef57532', 'pre_0082_nunca_usou'),
  ('1a1a8f81-7c78-4c6b-b92e-b46077fab318', 'pre_0082_nunca_usou'),
  ('1f84a817-ea6b-45c7-aace-cf43a729e73b', 'pre_0082_nunca_usou'),
  ('21c0cdd2-31d6-4f7b-bd9a-ca027e988410', 'pre_0082_nunca_usou'),
  ('238da099-dc5c-4149-bdb1-ddb1b335c713', 'pre_0082_nunca_usou'),
  ('2402a367-59b0-47e3-9787-3b3095857640', 'pre_0082_nunca_usou'),
  ('2446b2a7-96bb-4012-ab94-6417fdf54ba2', 'pre_0082_nunca_usou'),
  ('276eb459-ef1f-4524-9a41-9a366661d9ba', 'pre_0082_nunca_usou'),
  ('295f9f0e-d978-4551-8bb0-328a18546494', 'pre_0082_nunca_usou'),
  ('2ac9877b-c22c-422c-ad49-515dd30c62f8', 'pre_0082_nunca_usou'),
  ('31d5df6a-c6d8-46f2-848f-c9fca12c5ded', 'pre_0082_nunca_usou'),
  ('327e9e28-479e-4ac0-93e2-4ef291a0400f', 'pre_0082_nunca_usou'),
  ('34271696-01f0-4284-83fb-87bee132b8bb', 'pre_0082_nunca_usou'),
  ('34cacc95-2acb-49c1-a1df-2b86a88d96f9', 'pre_0082_nunca_usou'),
  ('364c09a7-e3e1-4dc4-b953-ab2bf9117369', 'pre_0082_nunca_usou'),
  ('490db548-dc7e-4f93-ac7d-5187803d08d0', 'pre_0082_nunca_usou'),
  ('4bc8f67b-2d0c-4cec-99fa-3929c6b0889c', 'pre_0082_nunca_usou'),
  ('507065aa-d82b-4fe1-84eb-1ba7d1090475', 'pre_0082_nunca_usou'),
  ('507ae33a-42e4-4de5-ac6a-79933451e9d1', 'pre_0082_nunca_usou'),
  ('56321822-497a-4d0c-9297-54900583cc2c', 'pre_0082_nunca_usou'),
  ('56dc3901-cd6f-4de1-a76d-7e15c27f3ae8', 'pre_0082_nunca_usou'),
  ('56e8e5ff-c441-4535-8731-cdde2e328bb0', 'pre_0082_nunca_usou'),
  ('599aad09-9843-4d13-a8fc-f238098bafc4', 'pre_0082_nunca_usou'),
  ('5bc29e6c-e977-4f2a-b19e-dffc253d593a', 'pre_0082_nunca_usou'),
  ('637ebcb3-c051-4312-aa44-f7d11169a6c8', 'pre_0082_nunca_usou'),
  ('66d7a10c-eed2-44d5-be0d-1b46901f019c', 'pre_0082_nunca_usou'),
  ('674e1464-bd25-4b8d-ac62-da4cc54782f2', 'pre_0082_nunca_usou'),
  ('6788e248-548b-4410-99e3-1872d016d511', 'pre_0082_nunca_usou'),
  ('6e27cbf9-80d4-4003-8376-34da9dd8bf13', 'pre_0082_nunca_usou'),
  ('7076742a-5983-423f-b216-e7c0cbe13f7b', 'pre_0082_nunca_usou'),
  ('766bc039-ab11-4dc6-ae61-414d9e4e170d', 'pre_0082_nunca_usou'),
  ('790aedb3-5f5e-4d84-8e36-ff3073fd471d', 'pre_0082_nunca_usou'),
  ('7a20f8c0-985b-47fc-bcaa-22890a9ec820', 'pre_0082_nunca_usou'),
  ('7ef4709c-dfbd-46d5-b01e-3e0fac28a179', 'pre_0082_nunca_usou'),
  ('81f9bd7d-4b5f-44e2-880c-0ac64f97ff8d', 'pre_0082_nunca_usou'),
  ('8545d6e4-a2b4-4d19-ba32-1a88c5dfacf8', 'pre_0082_nunca_usou'),
  ('8915b06f-9819-4f0c-a092-562bde3a2c6c', 'pre_0082_nunca_usou'),
  ('89256ee2-d7a8-49a8-82e7-1fdd750321bb', 'pre_0082_nunca_usou'),
  ('8e423516-620b-4eeb-9648-0820970c0d00', 'pre_0082_nunca_usou'),
  ('8e7d24d1-a550-42a8-907e-d55be45664b8', 'pre_0082_nunca_usou'),
  ('905ddaa2-488b-43a7-b3cc-9fdd17cc7802', 'pre_0082_nunca_usou'),
  ('926a62cc-2605-4447-bbd6-a3892e98b4a6', 'pre_0082_nunca_usou'),
  ('92dc482c-04b4-497c-a602-6dfd95482e43', 'pre_0082_nunca_usou'),
  ('a21e236b-3a94-4bba-8924-9e89b7acfa71', 'pre_0082_nunca_usou'),
  ('a2f70c88-c6bf-4636-9462-b32d1137de7c', 'pre_0082_nunca_usou'),
  ('a5e91a2c-ef6e-4684-ab62-715716f89e77', 'pre_0082_nunca_usou'),
  ('a6a374c0-fc33-4cc0-891d-aee7d83aaeae', 'pre_0082_nunca_usou'),
  ('a71325bb-e470-4b9d-aeb7-a62f0157597f', 'pre_0082_nunca_usou'),
  ('aa9c0aab-3ec1-4005-854e-f09cd3f96c75', 'pre_0082_nunca_usou'),
  ('ac8ae3ad-b719-498c-b62b-ce284f3ffb28', 'pre_0082_nunca_usou'),
  ('ad6528fa-ebde-4494-8ebb-375a0ec16a0e', 'pre_0082_nunca_usou'),
  ('adb8a336-79d0-4ea4-b603-2a60355966ac', 'pre_0082_nunca_usou'),
  ('afef71ca-f5a2-4058-b3c2-58872f5e635c', 'pre_0082_nunca_usou'),
  ('b0be70bd-87f5-4836-b149-367d8cfffa86', 'pre_0082_nunca_usou'),
  ('b21c7268-fe2c-4d9b-8571-15e08daec9f1', 'pre_0082_nunca_usou'),
  ('b3399048-9b2b-4d26-9936-559bb6a33f93', 'pre_0082_nunca_usou'),
  ('b7526986-edcd-4ed9-8e03-96764dfe8a28', 'pre_0082_nunca_usou'),
  ('bb68cd10-ddf3-46a3-98bd-c87456c2d51b', 'pre_0082_nunca_usou'),
  ('bec15f45-c485-43c8-a61d-5bfaeb924e05', 'pre_0082_nunca_usou'),
  ('bfccbbd8-0420-48f0-ae1f-71be7471415b', 'pre_0082_nunca_usou'),
  ('bfcd26a2-e957-4699-82ee-969aae3c89d5', 'pre_0082_nunca_usou'),
  ('c079110d-81eb-4d73-9823-0ab45850d75b', 'pre_0082_nunca_usou'),
  ('c39b699a-7ffb-45c8-ab32-60d359cb86d1', 'pre_0082_nunca_usou'),
  ('c7b407bf-2f58-4afa-8357-c03537e17b4d', 'pre_0082_nunca_usou'),
  ('c83e3a37-25d0-4ba3-8481-f2ae6edfbb9d', 'pre_0082_nunca_usou'),
  ('c870ff8f-608b-4ae5-b0a1-1c7327385c03', 'pre_0082_nunca_usou'),
  ('c9dd97e4-03b4-46b4-a723-0f6dec9dfe6b', 'pre_0082_nunca_usou'),
  ('cb892625-a7ec-4d8e-b77b-041d556de823', 'pre_0082_nunca_usou'),
  ('cc08e95c-583f-4180-b16e-6c28d3d247aa', 'pre_0082_nunca_usou'),
  ('cd706fa6-605d-441f-90ec-7f762f798f62', 'pre_0082_nunca_usou'),
  ('cf3840e4-3678-4239-8a94-99a2208bfc1e', 'pre_0082_nunca_usou'),
  ('d084cf17-8396-4361-8e97-2b59d6e76539', 'pre_0082_nunca_usou'),
  ('d14eda87-9965-4e6c-a327-b2251fe77d10', 'pre_0082_nunca_usou'),
  ('d4181f5b-10e5-4ab2-b956-d4939e49d6c2', 'pre_0082_nunca_usou'),
  ('d7ae912e-567c-4be1-9491-e0b7737f5e80', 'pre_0082_nunca_usou'),
  ('d83bfd5e-3e14-4b36-8dee-56dbe6952fa9', 'pre_0082_nunca_usou'),
  ('d9dc2a2a-fec2-4cf5-8c6e-619d70b0bee7', 'pre_0082_nunca_usou'),
  ('e406984f-7291-4c20-88ef-9a7e7298b70a', 'pre_0082_nunca_usou'),
  ('e50447b6-33c8-4c58-b4ca-8a6b9c6c3c42', 'pre_0082_nunca_usou'),
  ('e6258dd5-f3ee-4b93-9e46-eaca80d64a84', 'pre_0082_nunca_usou'),
  ('e6ac48bd-351a-4b2e-89de-bfc9861d06dc', 'pre_0082_nunca_usou'),
  ('e7f6ef50-06d9-460c-93ee-f8b3042fdeae', 'pre_0082_nunca_usou'),
  ('e84dd947-a75f-48f8-9b9b-13bb52cd13b7', 'pre_0082_nunca_usou'),
  ('e93d5143-0c39-43d7-b551-9c5381a66674', 'pre_0082_nunca_usou'),
  ('e9c039d2-24eb-4dd3-8588-0c5d1f2d94e1', 'pre_0082_nunca_usou'),
  ('ea4c899b-00a1-4d46-8652-5300b8e97ecc', 'pre_0082_nunca_usou'),
  ('eff45130-cba2-4ab9-8bfe-8b1f15eeffa7', 'pre_0082_nunca_usou'),
  ('f24d87ed-095c-44a5-8029-e9385cbb7401', 'pre_0082_nunca_usou'),
  ('f3257e65-d63f-4eb9-a9bc-47b55e1c97c5', 'pre_0082_nunca_usou'),
  ('f8013345-1281-4555-9c75-ae561dcb66a5', 'pre_0082_nunca_usou'),
  ('f83a2e6b-1703-4aa4-a7d6-4efcf2055c8c', 'pre_0082_nunca_usou'),
  ('fe41822b-23c2-4e1a-94bd-b90776906abb', 'pre_0082_nunca_usou')
on conflict (family_account_id) do nothing;

-- ============================================================
-- A RPC PASSA A CONHECER A EXCEÇÃO.
--
-- O fluxo, e a ordem importa:
--
--   já existe subscription_accesses?
--     ├─ NÃO  → fluxo normal, INALTERADO
--     └─ SIM
--          ├─ não está elegível, ou já resgatou → 'ja_existia'
--          └─ elegível e não resgatado
--                → confere WhatsApp
--                → confere verificação
--                → confere consentimento
--                → SÓ ENTÃO consome `redeemed_at`, atomicamente
--                → atualiza a assinatura para trialing + 7 dias
--                → 'legado_iniciado'
--
-- ⚠️ AS CHECAGENS VÊM ANTES DO CONSUMO, e é isso que impede o pior caso: uma
-- família voltar sem consentimento e QUEIMAR o direito sem ganhar nada. O
-- direito só é gasto por quem já passou por tudo.
--
-- ⚠️ A ATOMICIDADE É DO POSTGRES, NÃO DE LÓGICA. O consumo é um
-- `update ... where redeemed_at is null returning`: em duas chamadas
-- simultâneas, a segunda BLOQUEIA na linha até a primeira commitar, relê,
-- não casa mais no `where`, e o `returning` volta vazio. Não existe janela
-- entre conferir e escrever porque são a MESMA instrução (§8). E como tudo
-- roda numa transação, se o update da assinatura falhar depois, o consumo
-- volta atrás junto.
--
-- ⚠️ NENHUMA LINHA NOVA. A assinatura antiga é ATUALIZADA — não se cria
-- segunda `subscription_accesses` nem segunda família.
-- ============================================================

create or replace function public.iniciar_trial_se_apto(p_family_id uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
declare
  v_whatsapp   text;
  v_verificado boolean := false;
  v_consentiu  boolean := false;
  v_elegivel   boolean := false;
  v_consumido  uuid;
begin
  if p_family_id is null then
    return 'familia_inexistente';
  end if;

  select f.whatsapp_e164 into v_whatsapp
    from public.family_accounts f
   where f.id = p_family_id;
  if not found then
    return 'familia_inexistente';
  end if;

  -- ── JÁ EXISTE ASSINATURA? ───────────────────────────────────────────────
  if exists (select 1 from public.subscription_accesses
              where family_account_id = p_family_id) then

    -- Direito de legado vivo? (leitura barata: índice parcial, 96 linhas)
    select exists (
      select 1 from public.trial_legado_elegivel
       where family_account_id = p_family_id
         and redeemed_at is null
    ) into v_elegivel;

    if not v_elegivel then
      return 'ja_existia';
    end if;

    -- ⚠️ PROTEÇÕES DE ÚLTIMA HORA. A fotografia é de 27/08; entre lá e o
    -- resgate a família pode ter assinado ou ganhado cortesia. Conferimos de
    -- novo, contra o estado de AGORA — a lista congelada não manda sozinha.
    if exists (
      select 1 from public.subscription_accesses
       where family_account_id = p_family_id
         and (status = 'active'
              or stripe_customer_id is not null
              or stripe_subscription_id is not null
              or cortesia = true)
    ) then
      return 'ja_existia';
    end if;

    -- Os MESMOS critérios do caminho normal, na mesma ordem.
    if v_whatsapp is null or btrim(v_whatsapp) = '' then
      return 'sem_whatsapp';
    end if;
    select exists (
      select 1 from public.verificacoes_whatsapp
       where family_account_id = p_family_id
         and verificado_em is not null
         and telefone_e164 = v_whatsapp
    ) into v_verificado;
    if not v_verificado then
      return 'nao_verificado';
    end if;
    select exists (
      select 1 from public.ayla_preferences
       where family_account_id = p_family_id
         and consentimento_em is not null
         and desativada = false
    ) into v_consentiu;
    if not v_consentiu then
      return 'sem_consentimento';
    end if;

    -- ── CONSUMO ATÔMICO. Quem perder a corrida sai por 'ja_existia'. ──
    update public.trial_legado_elegivel
       set redeemed_at = now()
     where family_account_id = p_family_id
       and redeemed_at is null
    returning family_account_id into v_consumido;

    if v_consumido is null then
      return 'ja_existia';
    end if;

    update public.subscription_accesses
       set status = 'trialing',
           trial_ends_at = now() + interval '7 days',
           pagamento_falhou_em = null,
           updated_at = now()
     where family_account_id = p_family_id;

    return 'legado_iniciado';
  end if;

  -- ── FLUXO NORMAL — daqui para baixo, idêntico à 0081 ────────────────────
  if v_whatsapp is null or btrim(v_whatsapp) = '' then
    return 'sem_whatsapp';
  end if;

  select exists (
    select 1 from public.verificacoes_whatsapp
     where family_account_id = p_family_id
       and verificado_em is not null
       and telefone_e164 = v_whatsapp
  ) into v_verificado;
  if not v_verificado then
    return 'nao_verificado';
  end if;

  select exists (
    select 1 from public.ayla_preferences
     where family_account_id = p_family_id
       and consentimento_em is not null
       and desativada = false
  ) into v_consentiu;
  if not v_consentiu then
    return 'sem_consentimento';
  end if;

  insert into public.subscription_accesses (family_account_id, status, trial_ends_at)
  values (p_family_id, 'trialing', now() + interval '7 days');

  return 'iniciado';
end;
$$;

-- ------------------------------------------------------------
-- VERIFICAÇÃO (read-only) — colar logo depois. Esperado: 96 e 0.
-- ------------------------------------------------------------
-- select count(*) as elegiveis,
--        count(*) filter (where redeemed_at is not null) as ja_resgatados
--   from public.trial_legado_elegivel;
--
-- ROLLBACK, do mais leve ao mais pesado:
--   1) desligar sem migração (reversível):
--      update public.trial_legado_elegivel set redeemed_at = now()
--       where redeemed_at is null;
--   2) reverter a RPC: reaplicar o corpo da 0081 (o TypeScript não muda —
--      'legado_iniciado' vira um motivo que nunca chega);
--   3) último recurso: drop table public.trial_legado_elegivel;
--      ⚠️ isto PERDE a fotografia, que não é reconstruível — os quatro sinais
--      mudam conforme as famílias voltam a usar a Kolo.
--   ⚠️ Nenhum rollback tira os 7 dias de quem já resgatou. É correto: é uma
--   família usando o produto.
