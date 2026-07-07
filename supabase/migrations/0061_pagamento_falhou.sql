-- Dunning: carimbo da 1ª falha de pagamento. A partir daqui contam os 2 dias de
-- graça (acesso) e os 7 dias de retenção (dados) — depois o cron apaga.
-- Limpo quando o pagamento é regularizado (webhook).

alter table public.subscription_accesses
  add column if not exists pagamento_falhou_em timestamptz;

notify pgrst, 'reload schema';
