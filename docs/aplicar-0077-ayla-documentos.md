# Aplicar a migração 0077 em produção — prompt auto-contido

Cole o bloco abaixo numa sessão de Claude **com acesso ao Supabase de produção**
(Easypanel → SQL Editor, ou a sessão do Chrome que já opera o banco).

> ⚠️ **Não dê Deploy no stack do Supabase.** Um redeploy já zerou o banco em
> 08/06/2026. Esta operação é só SQL.

Depois de aplicar, rodar aqui no repositório:

```
node scripts/seed-core-ayla.mjs
```

O seed lê o Core de `apps/web/src/lib/ayla/experimental-prompt.ts` — não há
texto duplicado a manter — e **nunca sobrescreve uma versão já publicada**.
Rodar duas vezes é seguro.

Rastreada como **PEND-069**.

---

## O prompt

```
Preciso aplicar uma migração no Supabase de PRODUÇÃO do Kolo Família.

É ADITIVA e ISOLADA: cria UMA tabela nova, `ayla_documentos`, que hoje não
existe. Nenhuma tabela existente é alterada. Nenhuma linha existente muda.
Nenhum código em produção lê essa tabela ainda — e mesmo depois do deploy, se
ela estiver vazia ou fora do ar, a Ayla continua funcionando com o texto que
está no código. Aplicar antes do deploy é seguro.

CONTEXTO: o CORE da Ayla — o texto que define quem ela é e vai junto de toda
conversa — mora hoje só no código, então mudar uma vírgula exige deploy. Esta
tabela guarda esse texto com rascunho, versão ativa, histórico e rollback, para
que ele possa ser editado pelo Admin. O conteúdo NÃO muda: a primeira versão
semeada é byte a byte o Core já aprovado em QA.

⚠️ NÃO mexa em `ai_prompts`. Ela tem `key` como chave primária, o que impede
histórico, e é lida pelo parser da Ayla legacy. Foi por isso que criamos uma
tabela ao lado em vez de estender aquela.

PASSO 1 — rode exatamente este SQL:

create table if not exists public.ayla_documentos (
  id uuid primary key default gen_random_uuid(),
  chave text not null,
  versao int not null,
  status text not null check (status in ('rascunho', 'ativo', 'arquivado')),
  conteudo text not null,
  publicado_por uuid references auth.users(id) on delete set null,
  publicado_em timestamptz,
  nota text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ayla_documentos_chave_versao_idx
  on public.ayla_documentos (chave, versao);

create unique index if not exists ayla_documentos_um_ativo_idx
  on public.ayla_documentos (chave) where status = 'ativo';

create unique index if not exists ayla_documentos_um_rascunho_idx
  on public.ayla_documentos (chave) where status = 'rascunho';

create index if not exists ayla_documentos_ativos_idx
  on public.ayla_documentos (status, chave) where status = 'ativo';

drop trigger if exists ayla_documentos_set_updated_at on public.ayla_documentos;
create trigger ayla_documentos_set_updated_at
  before update on public.ayla_documentos
  for each row execute function public.set_updated_at();

alter table public.ayla_documentos enable row level security;

drop policy if exists ayla_documentos_admin_all on public.ayla_documentos;
create policy ayla_documentos_admin_all on public.ayla_documentos
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

notify pgrst, 'reload schema';

PASSO 2 — prove que funcionou, rodando esta verificação e me devolvendo a
saída INTEIRA (as três consultas):

select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'ayla_documentos'
order by ordinal_position;

select indexname, indexdef
from pg_indexes
where schemaname = 'public' and tablename = 'ayla_documentos'
order by indexname;

select count(*) as linhas from public.ayla_documentos;

PASSO 3 — prove que o índice de "um ativo por chave" MORDE. Esta é a garantia
mais importante da migração: sem ela, uma publicação que falhe no meio deixa
duas versões ativas e o sistema escolhe no chute. O segundo insert TEM que
falhar com 23505. Rode e me diga o que aconteceu:

insert into public.ayla_documentos (chave, versao, status, conteudo)
values ('teste_indice', 1, 'ativo', 'a');

insert into public.ayla_documentos (chave, versao, status, conteudo)
values ('teste_indice', 2, 'ativo', 'b');

-- Se o segundo insert NÃO falhar, PARE e me avise: o índice não pegou.

PASSO 4 — limpe o teste (não deixe lixo no banco):

delete from public.ayla_documentos where chave = 'teste_indice';

select count(*) as deve_ser_zero from public.ayla_documentos;

Me devolva a saída de todos os passos. Não rode mais nada além disto.
```

---

## O que esperar

- **Passo 2:** 10 colunas; 4 índices (`..._chave_versao_idx`,
  `..._um_ativo_idx`, `..._um_rascunho_idx`, `..._ativos_idx`) mais o
  `..._pkey`; `linhas = 0`.
- **Passo 3:** o **primeiro** insert passa, o **segundo falha** com
  `23505 duplicate key value violates unique constraint
  "ayla_documentos_um_ativo_idx"`. **Falha aqui é sucesso.**
- **Passo 4:** `deve_ser_zero = 0`.

## Se der errado

`drop table public.ayla_documentos;` — nada depende dela. O carregador do Core
volta ao texto do código, que é o mesmo conteúdo aprovado. Nenhuma família
percebe.

Se `public.set_updated_at()` ou `public.is_admin()` não existirem (não deveria
acontecer — são de 0012 e anteriores), o `create table` já terá passado; me
avise antes de tentar contornar.
