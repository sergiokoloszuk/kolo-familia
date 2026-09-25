-- PEND-213 · “Quero os dois” e clique que não sequestra mensagem textual.
--
-- A interação é consumida no mesmo statement que reivindica a oferta. Assim,
-- uma mensagem comum recebida imediatamente antes do clique continua dona do
-- seu próprio turno e não cede para um callback que retorna pelo atalho.

alter table public.ayla_aprofundamento_ofertas
  drop constraint if exists ayla_aprofundamento_ramo_valido;

alter table public.ayla_aprofundamento_ofertas
  add constraint ayla_aprofundamento_ramo_valido
  check (
    ramo_escolhido is null
    or ramo_escolhido = any(opcoes)
    or (
      ramo_escolhido = 'aprofundar_ambos'
      and cardinality(opcoes) = 2
    )
  );

create or replace function public.reivindicar_aprofundamento_ayla(
  p_oferta_id uuid,
  p_family_account_id uuid,
  p_ramo text,
  p_inbound_escolha_id uuid,
  p_reference_message_id text default null
)
returns table (
  oferta_id uuid,
  membro_atipico_id uuid,
  source_inbound_message_id uuid,
  source_outbound_message_id uuid,
  opcoes text[],
  criada_em timestamptz
)
language sql
security definer
set search_path = public
as $$
  with interacao_consumida as (
    update public.ayla_messages m
       set processada_em = coalesce(m.processada_em, now())
     where m.id = p_inbound_escolha_id
       and m.family_account_id = p_family_account_id
       and m.direcao = 'inbound'
    returning m.id
  )
  update public.ayla_aprofundamento_ofertas o
     set status = 'escolhida',
         ramo_escolhido = p_ramo,
         inbound_escolha_id = p_inbound_escolha_id,
         escolhida_em = now(),
         updated_at = now()
    from interacao_consumida i
   where o.id = p_oferta_id
     and o.family_account_id = p_family_account_id
     and o.status in ('preparada', 'oferecida')
     and o.expira_em > now()
     and (
       p_ramo = any(o.opcoes)
       or (p_ramo = 'aprofundar_ambos' and cardinality(o.opcoes) = 2)
     )
     and (
       o.canal = 'texto'
       or o.provider_message_id is null
       or o.provider_message_id = p_reference_message_id
     )
  returning
    o.id,
    o.membro_atipico_id,
    o.source_inbound_message_id,
    o.source_outbound_message_id,
    o.opcoes,
    o.created_at;
$$;

revoke all on function public.reivindicar_aprofundamento_ayla(uuid, uuid, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.reivindicar_aprofundamento_ayla(uuid, uuid, text, uuid, text)
  to service_role;

notify pgrst, 'reload schema';
