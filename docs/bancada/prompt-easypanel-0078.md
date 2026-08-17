# Prompt para o Claude no Chrome — aplicar a migração 0078 em produção

Copie tudo abaixo da linha e cole numa sessão do Claude com acesso ao navegador.
É autocontido: tem o SQL, a verificação e os avisos que já custaram caro aqui.

---

Você vai aplicar **uma** migração no Postgres de produção da Kolo Família,
hospedado no Easypanel, e depois verificar o resultado. Não faça mais nada além
disto.

## ⚠️ AVISOS QUE NÃO SÃO OPCIONAIS

1. **NÃO clique em "Deploy" no stack do Supabase.** Em 08/06/2026 um redeploy
   desse stack **zerou o banco inteiro** (o bind do PGDATA é frágil); a
   recuperação veio de um backup diário da Hostinger. Você só precisa de um
   terminal/console SQL — nunca de um redeploy.
2. **Não altere variáveis de ambiente**, não reinicie serviços, não mexa em
   backup.
3. Se qualquer passo der erro que você não entenda, **pare e relate**. Não
   tente contornar.

## O que aplicar, e por quê

A tabela `public.ayla_daily_checkins` tem **zero linhas desde que o produto
existe**. O código grava com

```
.upsert({...}, { onConflict: "family_account_id,membro_atipico_id,date" })
```

e a tabela nasceu (migração 0001) com um índice **não-único**. O Postgres
responde `42P10` — *"there is no unique or exclusion constraint matching the ON
CONFLICT specification"* — e o PostgREST devolve **400**. Falhava em toda
execução, e ninguém via porque a escrita não conferia o próprio resultado.

A migração cria a unicidade que o `onConflict` sempre pressupôs. A tabela está
vazia, então não há duplicata para resolver antes.

## Passo 1 — abrir um console SQL

No Easypanel, abra o **terminal do serviço do banco** (o container do Postgres)
e entre no psql:

```
psql -U postgres -d postgres
```

Se o Easypanel oferecer um console SQL direto do Supabase Studio, também serve.

## Passo 2 — conferir o estado ANTES (não altera nada)

```sql
select count(*) as linhas_hoje from public.ayla_daily_checkins;

select indexname, indexdef
from pg_indexes
where tablename = 'ayla_daily_checkins';
```

**Esperado antes:** `linhas_hoje = 0`, e nenhum índice `UNIQUE` na lista —
só `ayla_daily_checkins_family_date_idx`, que é comum.

Se já existir um índice único cobrindo `(family_account_id, membro_atipico_id,
date)`, **pare**: a migração já foi aplicada e não há o que fazer.

## Passo 3 — aplicar

```sql
create unique index if not exists ayla_daily_checkins_familia_membro_dia
  on public.ayla_daily_checkins (family_account_id, membro_atipico_id, date);
```

## Passo 4 — verificar DEPOIS

```sql
select indexname, indexdef
from pg_indexes
where tablename = 'ayla_daily_checkins'
  and indexname = 'ayla_daily_checkins_familia_membro_dia';
```

**Esperado:** exatamente uma linha, e o `indexdef` contendo `UNIQUE` e as três
colunas `family_account_id, membro_atipico_id, date`.

## Passo 5 — prova de que o upsert passou a funcionar

Esta é a prova real; sem ela a migração é só uma linha no banco. Rode o mesmo
`ON CONFLICT` que o código usa, **dentro de uma transação que você desfaz**, de
modo que nada fica gravado:

```sql
begin;

insert into public.ayla_daily_checkins
  (family_account_id, membro_atipico_id, date, observacao_livre, respondeu)
select f.id, m.id, current_date, 'prova da 0078', true
from public.family_accounts f
join public.membros_atipicos m on m.family_account_id = f.id
limit 1
on conflict (family_account_id, membro_atipico_id, date) do update
  set observacao_livre = excluded.observacao_livre
returning family_account_id, date;

rollback;
```

**Esperado:** o `INSERT ... ON CONFLICT` **não** dá erro e devolve uma linha. Se
voltar `42P10`, a migração não pegou — relate.

O `rollback` desfaz tudo: confirme depois que continua zero:

```sql
select count(*) from public.ayla_daily_checkins;
```

## O que me devolver

1. A saída do Passo 2 (estado antes).
2. A saída do Passo 4 (o índice criado).
3. Se o Passo 5 rodou sem `42P10`, e a contagem final.
4. Qualquer erro, na íntegra.
