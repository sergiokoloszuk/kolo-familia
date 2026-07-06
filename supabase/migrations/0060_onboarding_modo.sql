-- Chave de troca do onboarding: 'antigo' (wizard de 6 telas, padrão), 'teste'
-- (fluxo novo só pra contas internas) ou 'todos' (fluxo novo pra todo mundo).
-- Flipável na hora pelo admin, sem deploy. Fica na mesma linha singleton.

alter table public.onboarding_copy
  add column if not exists modo text not null default 'antigo';

notify pgrst, 'reload schema';
