-- 0068 — Configuração geral (chave/valor de texto), editável pelo admin.
--
-- Nasce do número de WhatsApp da Ayla. O app precisa dele pra montar o link
-- "falar com a Ayla" (wa.me) no fim do onboarding, mas nunca soube qual é: quem
-- tem o chip conectado é a Z-API, e o app só manda "envie tal mensagem pra tal
-- pessoa" — o número de origem nunca passa por aqui.
--
-- Podia ser variável de ambiente, mas aí trocar o número exigiria deploy. Segue
-- o padrão que já existe pra preços e vozes (`configuracao_precos`,
-- `configuracao_vozes`): tabela chave/valor que o admin edita na hora.
--
-- RLS igual à de preços: qualquer pessoa autenticada LÊ (o link do WhatsApp
-- aparece pra ela), só admin ESCREVE.

create table if not exists public.configuracao_geral (
  chave text primary key,
  valor text,
  descricao text,
  updated_at timestamptz not null default now()
);

alter table public.configuracao_geral enable row level security;

drop policy if exists configuracao_geral_read on public.configuracao_geral;
create policy configuracao_geral_read on public.configuracao_geral
  for select to authenticated using (true);

drop policy if exists configuracao_geral_admin on public.configuracao_geral;
create policy configuracao_geral_admin on public.configuracao_geral
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Número da Ayla em produção (só dígitos, com país). Se já existir, não
-- sobrescreve — o valor do admin sempre vence o do arquivo.
insert into public.configuracao_geral (chave, valor, descricao) values
  ('ayla_whatsapp', '5511963197032', 'WhatsApp da Ayla — usado no link "falar com a Ayla". Só dígitos, com o 55.')
on conflict (chave) do nothing;
