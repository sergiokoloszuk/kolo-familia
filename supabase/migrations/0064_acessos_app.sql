-- ============================================================
-- Kolo Família — Migração 0064
--   ACESSO da mãe pelo WhatsApp — token NOSSO, que não se autodestrói.
--
--   Por que: o link da Ayla usava o token de magic-link do Supabase, e o
--   GoTrue guarda UM token por usuário — cada link novo MATAVA todos os
--   anteriores. Na prática, a mãe tocava em qualquer link que não fosse o
--   últimissimo e caía no /login pedindo uma senha que ela não tem.
--   (Caso Jacke, 22–26/07: dois dias trancada fora enquanto brigava com a
--   escola pelos direitos da filha, e o relatório que ela precisava só existe
--   dentro do app.)
--
--   Agora o link leva um token nosso: vários podem valer ao mesmo tempo (mandar
--   um novo não mata o anterior), cada um vale 24h, e ele é trocado por sessão
--   no /auth/wa. O link É a credencial — o que protege é a janela ser curta. Só o servidor
--   (service-role) lê e escreve aqui — nunca o cliente.
-- ============================================================

create table if not exists public.acessos_app (
  id uuid primary key default gen_random_uuid(),
  family_account_id uuid not null references public.family_accounts(id) on delete cascade,
  token text not null unique,                  -- opaco, sorteado (32 bytes base64url)
  next text not null default '/painel',        -- destino interno depois de logar
  expira_em timestamptz not null,              -- validade (padrão: 24h)
  usos int not null default 0,                 -- quantas vezes destravou (auditoria)
  usado_em timestamptz,                        -- primeiro uso
  ultimo_uso_em timestamptz,
  criado_por text not null default 'ayla',     -- ayla | suporte | app
  created_at timestamptz not null default now()
);

create index if not exists idx_acessos_app_token on public.acessos_app (token);
create index if not exists idx_acessos_app_familia
  on public.acessos_app (family_account_id, created_at desc);

alter table public.acessos_app enable row level security;

-- NENHUMA policy pra cliente: isto é segredo de acesso. Só service-role entra
-- (o service-role ignora RLS). Admin também não precisa ler o token.

notify pgrst, 'reload schema';

-- ============================================================
-- FIM da migração 0064.
-- Lembrar: após aplicar, o NOTIFY acima recarrega o schema do PostgREST
-- (senão o INSERT da tabela nova falha com PGRST205).
-- ============================================================
