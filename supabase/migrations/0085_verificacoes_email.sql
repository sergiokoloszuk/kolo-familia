-- ============================================================
-- Kolo Família — Migração 0085
--   PROVAR O E-MAIL NOVO, SEM PRECISAR DO ANTIGO.
--
--   PROVEI POR EXECUÇÃO (31/08/2026, produção): `SECURE_EMAIL_CHANGE` está
--   ligado. Pedir a troca por `updateUser({ email })` manda DUAS mensagens —
--   uma para o endereço antigo e outra para o novo — e confirmar só o novo
--   devolve, do próprio GoTrue:
--
--     {"code":"200","msg":"Confirmation link accepted.
--       Please proceed to confirm link sent to the other email"}
--
--   ...com o campo `email` intacto. Ou seja: o caminho nativo exige o endereço
--   antigo, que é EXATAMENTE o que a pessoa não tem quando errou a digitação.
--   O fluxo de correção de e-mail é inalcançável justamente para quem precisa
--   dele. Esta tabela é o que permite provar só o endereço NOVO.
--
--   MEDIDO EM 31/08/2026: 78 de 244 contas nunca confirmaram o e-mail (32%).
--   Desde que o portão de confirmação saiu do cadastro, quem erra o endereço
--   entra normalmente e só descobre o erro no dia em que esquece a senha —
--   quando o link de recuperação vai para um endereço que não é dela.
--
--   POR QUE TABELA NOVA, e não reuso:
--     · `verificacoes_whatsapp` (0080) é chaveada por telefone e por família;
--       enfiar e-mail nela seria dar semântica errada a um mecanismo existente
--       (§4 do protocolo) — reutilizar é usar o PADRÃO, não forçar a tabela.
--       E é este padrão que está sendo reutilizado, linha por linha.
--     · `acessos_app` tem `token` UNIQUE GLOBAL — um código de 6 dígitos
--       colidiria entre contas o tempo todo, e ela não conta tentativas.
--     · `app_metadata` de `auth.users` foi considerada e RECUSADA: ela viaja
--       dentro do JWT, então o hash do código chegaria ao navegador da própria
--       pessoa — e 10^6 possibilidades se quebram offline em segundos.
--
--   ⚠️ CHAVEADA POR `user_id`, não por família. Trocar o e-mail de LOGIN é
--   operação do usuário do Supabase, e uma família pode ter mais de um login
--   (co-acesso, 0045). Chavear por família deixaria um co-acesso trocar o
--   e-mail do dono.
--
--   ⚠️ SOMENTE ADITIVA. Nenhum UPDATE, DELETE ou DROP. Nenhuma tabela
--   existente é alterada, nenhuma conta é tocada. Aplicar isto sozinho não
--   muda comportamento nenhum enquanto o código que a lê não estiver no ar.
-- ============================================================

create table if not exists public.verificacoes_email (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- O endereço NOVO, ainda não provado. Fica AQUI e não em `auth.users` até a
  -- prova chegar: é o que garante que um e-mail não provado nunca vira o
  -- e-mail de login nem o endereço de recuperação.
  email_novo text not null,

  -- NUNCA o código em texto puro. Só o sha256, calculado no servidor.
  codigo_hash text not null,

  expira_em     timestamptz not null,
  tentativas    int not null default 0,
  reenvios      int not null default 0,
  confirmado_em timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- UMA verificação viva por usuário. Reenviar e trocar o endereço ATUALIZAM a
-- linha; nunca criam outra. É o que impede que duplo clique, retry ou
-- reprocessamento gerem dois desafios válidos ao mesmo tempo — e é o mesmo
-- motivo do índice único de 0080.
create unique index if not exists verificacoes_email_user_idx
  on public.verificacoes_email (user_id);

-- Para a limpeza das expiradas, quando ela existir.
create index if not exists verificacoes_email_expira_idx
  on public.verificacoes_email (expira_em);

-- `updated_at` automático, pelo mesmo helper de 0001 que as outras usam.
drop trigger if exists verificacoes_email_set_updated_at
  on public.verificacoes_email;
create trigger verificacoes_email_set_updated_at
  before update on public.verificacoes_email
  for each row execute function public.set_updated_at();

-- RLS ligada e SEM policy: só o service-role lê e escreve. O hash do código
-- não pode chegar ao cliente nem por engano de consulta.
alter table public.verificacoes_email enable row level security;

comment on table public.verificacoes_email is
  'Códigos de prova do e-mail NOVO. Só o hash, nunca o código. Uma linha viva por usuário. Acesso apenas por service-role.';
comment on column public.verificacoes_email.email_novo is
  'Endereço ainda NÃO provado. Só migra para auth.users.email depois que o código é conferido.';

-- ------------------------------------------------------------
-- ROLLBACK:
--   drop table if exists public.verificacoes_email;
-- Aditiva e isolada: nada mais depende dela.
-- ------------------------------------------------------------
