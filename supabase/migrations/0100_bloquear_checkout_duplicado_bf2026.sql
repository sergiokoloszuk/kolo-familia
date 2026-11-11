-- Impede que a reserva de checkout da Black Friday 2026 seja reaberta depois
-- de concluída ou quando a família já possui uma assinatura vinculada.

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

  update public.black_friday_2026_participacoes p
     set checkout_session_id = p_session_id,
         checkout_iniciado_em = p_iniciado_em,
         checkout_expira_em = p_expira_em
   where p.family_account_id = v_family
     and p.checkout_concluido_em is null
     and p_iniciado_em < p.oferta_fim_exclusivo
     and (
       p.checkout_expira_em is null
       or p.checkout_expira_em <= now()
     )
     and not exists (
       select 1
         from public.subscription_accesses s
        where s.family_account_id = v_family
          and s.status <> 'canceled'
          and (
            s.stripe_subscription_id is not null
            or s.status = 'active'
          )
     );

  get diagnostics v_linhas = row_count;
  return v_linhas = 1;
end;
$$;

grant execute on function public.registrar_meu_checkout_black_friday_2026(
  text,
  timestamptz,
  timestamptz
) to authenticated;

notify pgrst, 'reload schema';
