# Aplicar 0070 em produção — controle de turno da Ayla

> **Por que agora (30/07/2026):** na conversa da Karina desta manhã a Ayla
> respondeu **duas vezes** o mesmo assunto, em balões cruzados (07:35 e 07:36),
> repetindo a mesma explicação. Essa é a assinatura exata do controle de turno
> falhando: se a coluna `processada_em` não existe, o claim atômico dá erro e o
> código degrada de propósito pra "responde só esta mensagem"
> (`lib/ayla/lote-inbound.ts:92-97`) — ou seja, **uma Ayla por mensagem, em
> paralelo**, que é o bug que a 0070 existe pra matar.
>
> A migração é idempotente (`add column if not exists`, `create index if not
> exists`, backfill condicionado a `is null`). Rodar em cima de uma base já
> aplicada não quebra nada.

## Como usar

1. Abra o **Supabase Studio** do projeto (Easypanel) e faça login.
2. **SQL Editor → New query**.
3. Cole o prompt completo abaixo (do `===` ao `===`) na extensão do Claude no
   Chrome, com o Studio na aba ativa.

---

```text
===
Você está no SQL Editor do Supabase Studio do projeto Kolo Família (produção).
Execute os passos na ordem. Não pule a verificação inicial — ela decide se há
trabalho a fazer.

PASSO 1 — Diagnóstico. Rode:

select count(*) as tem_coluna
  from information_schema.columns
 where table_schema = 'public'
   and table_name  = 'ayla_messages'
   and column_name = 'processada_em';

Se devolver 1, a migração JÁ está aplicada: pule direto pro PASSO 3 e relate
que nada foi alterado. Se devolver 0, siga pro PASSO 2.

PASSO 2 — Aplique a migração. Rode o bloco inteiro de uma vez:

alter table public.ayla_messages
  add column if not exists processada_em timestamptz;

comment on column public.ayla_messages.processada_em is
  'Quando esta mensagem recebida entrou num lote já respondido. NULL = ainda aguardando resposta. Usado como claim atômico do controle de turno.';

create index if not exists idx_ayla_messages_inbound_pendente
  on public.ayla_messages (family_account_id, created_at)
  where direcao = 'inbound' and processada_em is null;

update public.ayla_messages
   set processada_em = coalesce(recebida_em, created_at)
 where direcao = 'inbound'
   and processada_em is null;

notify pgrst, 'reload schema';

PASSO 3 — Verificação. Rode as três consultas e relate os três números:

-- (a) deve ser 1
select count(*) from information_schema.columns
 where table_schema='public' and table_name='ayla_messages'
   and column_name='processada_em';

-- (b) deve ser 0 — nada pendente de antes do deploy
select count(*) from public.ayla_messages
 where direcao='inbound' and processada_em is null;

-- (c) deve ser 1 — o índice parcial existe
select count(*) from pg_indexes
 where schemaname='public' and indexname='idx_ayla_messages_inbound_pendente';

PASSO 4 — Relate: os três números do passo 3, e se o passo 2 chegou a rodar ou
se a coluna já existia. Se qualquer número vier diferente do esperado, mostre a
mensagem de erro exata em vez de tentar consertar por conta própria.
===
```

## Depois de aplicar

Nos logs do Vercel, `[ayla:turno]` deve passar a mostrar `agrupando N mensagens
num turno só` quando a mãe escreve em rajada — e **nunca mais** `claim falhou,
seguindo sem agrupar`. Essa linha de warning é o sinal de que a coluna sumiu.
