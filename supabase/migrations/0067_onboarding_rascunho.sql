-- 0067 — Rascunho do onboarding conversacional.
--
-- Problema: o fluxo conversacional só grava no banco no 7º passo
-- (`membro_interesses`). Quem desiste antes disso — 2 em cada 3 dos que
-- abandonam — não deixa rastro nenhum: some do funil como um bloco único
-- ("Preenchendo a pessoa") e, se voltar, recomeça da primeira pergunta,
-- porque as respostas só existiam no state do React.
--
-- Esta coluna guarda o rascunho a cada resposta: em que passo a pessoa está
-- e o que ela já respondeu. Serve pra duas coisas:
--   1. retomar de onde parou (recarregou a página, entrou uma ligação);
--   2. ver no CRM em QUAL pergunta ela desistiu, não só "nas 7 primeiras".
--
-- É rascunho, não fonte de verdade: os dados reais continuam indo pras
-- tabelas de sempre (membros_atipicos, family_profiles, perfil_vivo_membro)
-- nos checkpoints. Ao concluir o onboarding, o rascunho é apagado.
--
-- Formato:
--   { "idx": 5, "passoId": "desafios",
--     "answers": {...}, "outros": {...},
--     "aceites": { "termos": true, "ayla": false } }

alter table public.family_accounts
  add column if not exists onboarding_rascunho jsonb;

comment on column public.family_accounts.onboarding_rascunho is
  'Rascunho do onboarding conversacional (passo atual + respostas). Apagado ao concluir. Não é fonte de verdade.';
