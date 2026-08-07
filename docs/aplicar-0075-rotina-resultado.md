# Aplicar a migração 0075 em produção — prompt auto-contido

Cole o bloco abaixo numa sessão de Claude **com acesso ao Supabase de produção**
(Easypanel → SQL Editor, ou a sessão do Chrome que já opera o banco).

> ⚠️ **Não dê Deploy no stack do Supabase.** Um redeploy já zerou o banco em
> 08/06/2026. Esta operação é só SQL.

---

## O prompt

```
Preciso aplicar uma migração no Supabase de PRODUÇÃO do Kolo Família.

É ADITIVA: quatro colunas anuláveis e um índice parcial na tabela `rotinas`.
Nenhuma linha existente muda. Nenhum código em produção lê essas colunas hoje,
então aplicar antes do deploy é seguro.

CONTEXTO: a rotina visual não tinha como registrar se ajudou a família, nem se
já perguntamos isso uma vez. São as MESMAS colunas que `planos` tem desde a
0037 — mesmo vocabulário de propósito.

PASSO 1 — rode exatamente este SQL:

alter table public.rotinas
  add column if not exists resultado text
    check (resultado in ('funcionou', 'parcial', 'nao_funcionou', 'nao_testou')),
  add column if not exists resultado_nota text,
  add column if not exists resultado_em timestamptz,
  add column if not exists seguimento_enviado_em timestamptz;

create index if not exists rotinas_seguimento_idx
  on public.rotinas (family_account_id, created_at)
  where resultado is null and seguimento_enviado_em is null;

notify pgrst, 'reload schema';

PASSO 2 — prove que funcionou, rodando esta verificação e me devolvendo a
saída INTEIRA:

select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'rotinas'
  and column_name in ('resultado','resultado_nota','resultado_em','seguimento_enviado_em')
order by column_name;

select indexname from pg_indexes
where schemaname = 'public' and tablename = 'rotinas'
  and indexname = 'rotinas_seguimento_idx';

select count(*) as rotinas_totais,
       count(resultado) as com_resultado
from public.rotinas;

ESPERADO no passo 2:
- 4 linhas de colunas, todas is_nullable = YES;
- 1 linha com rotinas_seguimento_idx;
- com_resultado = 0 (nenhuma rotina antiga foi tocada).

Se qualquer coisa divergir, PARE e me diga o que veio — não tente corrigir.
```

---

## Rollback

Só se algo der errado. As colunas são anuláveis e ninguém as lê ainda, então o
custo de deixá-las é zero — o rollback existe por completude, não por
necessidade.

```sql
drop index if exists public.rotinas_seguimento_idx;
alter table public.rotinas
  drop column if exists resultado,
  drop column if exists resultado_nota,
  drop column if exists resultado_em,
  drop column if exists seguimento_enviado_em;
notify pgrst, 'reload schema';
```

---

## Por que 0075 e não 0071

A migração nasceu numerada 0071 e foi renumerada. Os números **0071 a 0074 já
estão reivindicados por branches que ainda não entraram na `main`**:

| número | branch | aplicada em prod |
|---|---|---|
| 0071, 0072 | `bia/ciclo-tecnico` | não |
| 0073, 0074 | Memória Viva 5C | não |

Pegar 0071 criaria duas migrações com o mesmo número dependendo da ordem de
merge. 0075 fica acima de todas e é seguro em qualquer ordem.

---

## O que vem depois

Esta migração é **pré-requisito do deploy** do commit `0e53a91`
(`sendRotinaSeguimento` escreve em `seguimento_enviado_em`). A ordem é:

1. aplicar a 0075 e conferir o passo 2;
2. só então fazer o merge/deploy da Rotina.

Deployar antes faz o follow-up da rotina falhar silenciosamente — a coluna não
existiria e o `update` erraria sem quebrar o envio, então a Ayla poderia
perguntar duas vezes.
