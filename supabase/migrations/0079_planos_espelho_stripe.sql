-- ============================================================
-- Kolo Família — Migração 0079
--   O PREÇO PASSA A TER UM DONO SÓ: O STRIPE.
--
--   O que aconteceu (20/08/2026): o plano anual estava no Stripe como
--   `recurring · month × 1` a R$ 603,90 — quem clicasse em "Assinar anual"
--   seria cobrado R$ 603,90 POR MÊS. A tela mostrava "R$ 603,90 / ano" e
--   estava certa em relação à sua fonte (esta tabela); o Stripe cobraria por
--   mês e estava certo em relação à dele. Os dois "funcionavam", e por isso o
--   defeito atravessou meses sem ninguém ver.
--
--   Causa raiz: TRÊS fontes independentes para a mesma informação (Stripe, a
--   env da Vercel, e esta tabela), sem ninguém comparar. Duas fontes para a
--   mesma decisão sempre divergem.
--
--   O que muda: `configuracao_precos` deixa de ser FONTE e vira ESPELHO do
--   Stripe. Só `sincronizarPlanos` (lib/billing/planos.ts) escreve aqui, no
--   monitor diário. Editar à mão volta a criar a segunda verdade que causou
--   isto — por isso as colunas novas guardam DE ONDE o valor veio e QUANDO.
--
--   Reversível: as colunas são aditivas e opcionais. Voltar o código anterior
--   funciona com esta migração aplicada.
-- ============================================================

-- 1) O espelho passa a registrar a procedência do valor.
alter table public.configuracao_precos
  add column if not exists stripe_price_id text,
  add column if not exists intervalo text,
  add column if not exists sincronizado_em timestamptz;

comment on column public.configuracao_precos.stripe_price_id is
  'De qual price do Stripe este valor veio. Escrito por sincronizarPlanos.';
comment on column public.configuracao_precos.intervalo is
  'Recorrência real cobrada pelo Stripe: month | year. NULL = ainda não sincronizado.';
comment on column public.configuracao_precos.sincronizado_em is
  'Quando o espelho foi conferido contra o Stripe pela última vez. NULL ou antigo = desconfiar.';
comment on table public.configuracao_precos is
  'ESPELHO do Stripe, não fonte. Escrito por sincronizarPlanos (lib/billing/planos.ts). Não editar à mão: o Stripe é o dono do preço.';

-- 2) A descrição mentia, e mentira em texto sobrevive a quem a escreveu.
--
--    Dizia "Plano anual com ~20% de desconto (placeholder)". R$ 603,90 são
--    exatamente 11 × R$ 54,90 — 1 mês grátis, 8,33%. Vinte por cento seriam
--    R$ 527,04. O rótulo "placeholder" no mensal também já não valia: o valor
--    confere com o Stripe desde sempre.
--
--    O desconto agora é CALCULADO a partir dos dois preços (economiaAnual /
--    seloEconomiaAnual). Número de desconto não volta a viver em texto.
update public.configuracao_precos
   set descricao = 'Plano mensal. Valor espelhado do Stripe — não editar à mão.'
 where chave = 'plano_mensal';

update public.configuracao_precos
   set descricao = 'Plano anual. Valor espelhado do Stripe — não editar à mão. O desconto é calculado, nunca escrito.'
 where chave = 'plano_anual';

-- ------------------------------------------------------------
-- ROLLBACK (se precisar desfazer):
--
--   alter table public.configuracao_precos
--     drop column if exists stripe_price_id,
--     drop column if exists intervalo,
--     drop column if exists sincronizado_em;
--
--   (as descrições antigas eram placeholders; não vale a pena restaurá-las)
-- ------------------------------------------------------------
