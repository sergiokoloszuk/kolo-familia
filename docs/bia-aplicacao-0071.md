# Aplicação da migração 0071 (BIA) — procedimento

> **Status: NÃO APLICADA.** Nem em produção nem em qualquer outro lugar. Este
> documento é o procedimento pedido; a execução exige uma pessoa com acesso ao
> host. Nada aqui deve ser rodado no automático.

## Por que parou aqui

A instrução da etapa foi: *"Não aplique a migração diretamente no banco de
produção sem antes verificar backup, compatibilidade e possibilidade de
reversão. Caso não exista ambiente seguro, gere o procedimento e pare antes da
aplicação."*

**Não existe ambiente seguro neste projeto.** Verificado, não suposto:

| O que se procurou | Resultado |
| --- | --- |
| Postgres local | não instalado |
| Docker / docker-compose | não disponível |
| `psql` no PATH | ausente |
| Projeto Supabase de staging | não existe — há um único, o de produção |
| `SUPABASE_URL` em `.env.local` | aponta para **produção** |

Some isso ao histórico do stack: um redeploy do Supabase **zerou o banco em
08/06**, recuperado por backup diário da Hostinger. O bind do `PGDATA` continua
frágil. Aplicar uma migração nova sem rede de segurança, nesse cenário, seria
trocar um ganho opcional (conhecimento de apoio) por um risco de dado de
família.

Consequência prática para a Etapa 3: os itens **1 (validar a migração em
ambiente seguro)**, **2 (importar os chunks)** e **3 (rodar o retriever contra o
Postgres real)** ficam pendentes de uma janela com acesso ao host. Os itens 4, 5
e 6 estão feitos e verificados — ver `docs/bia-infraestrutura.md`.

## O que a 0071 faz (análise de compatibilidade)

Ela **só acrescenta**. Nenhuma tabela existente é alterada, nenhuma coluna é
removida, nenhuma função é substituída.

- cria `public.bia_chunks`
- cria 5 índices dela (1 GIN de full-text, 2 GIN de array, 2 btree)
- cria o trigger `bia_chunks_set_updated_at`
- habilita RLS e cria 2 policies (leitura para autenticado com `ativo`;
  escrita só para `public.is_admin()`)

Riscos verificados, um a um:

| Risco | Situação |
| --- | --- |
| Extensão nova (`pgcrypto`, `vector`…) | **nenhuma.** `to_tsvector('portuguese', …)` é nativo. Isto importa: já houve incidente com `pgcrypto` fora do schema esperado |
| Toca em `handle_new_user` | não |
| Toca em tabela de família | não |
| Roda dentro de trigger de signup | não |
| Reescreve tabela existente (lock) | não — tabela nova, sem lock em nada em uso |
| RLS | segue o padrão de `boas_praticas`/`aulas`, conteúdo curado |
| Reversível | sim — `supabase/migrations/0071_rollback.sql` |

O único custo permanente é espaço: a coluna gerada `texto_busca` e o índice GIN.
Para os 1.120 chunks do Volume 1, algo na casa de poucos MB.

## Antes de aplicar — checklist

1. **Backup do dia existe e é legível.** Não basta o job ter rodado: confirme
   tamanho plausível e data de hoje.
2. **Teste de restore.** Continua pendente no projeto (ver
   `docs/`/memória de segurança). Se ninguém nunca restaurou esse backup, o
   backup é uma hipótese, não uma garantia. Esta é a maior pendência humana
   antes de qualquer migração — não só desta.
3. **Janela de baixo tráfego.** A migração é rápida, mas a importação são ~1.120
   inserts.
4. **NÃO usar o botão Deploy do Easypanel no stack Supabase.** Foi o que zerou o
   banco em 08/06. A aplicação é por sessão SQL no host, e só.

## Aplicação

```sql
-- 1. conferir que ainda não existe
select count(*) from information_schema.tables
 where table_schema = 'public' and table_name = 'bia_chunks';   -- espera 0

-- 2. aplicar (conteúdo de supabase/migrations/0071_bia.sql)
--    dentro de uma transação: ou entra inteira, ou não entra
begin;
  \i 0071_bia.sql
commit;
```

Verificação imediata:

```sql
select count(*) from public.bia_chunks;                     -- 0
select indexname from pg_indexes
 where tablename = 'bia_chunks';                            -- 5 índices
select polname from pg_policy
 where polrelid = 'public.bia_chunks'::regclass;            -- 2 policies
```

## Importação dos chunks

```bash
# gera o SQL a partir do .docx (não escreve em banco nenhum)
node scripts/bia/importar-bia.mjs \
  --arquivo "BIA-Volume-1.docx" --versao 2026-07-30 --sql bia.sql
```

Números do corpus atual, medidos:

- **1.120** chunks gerados
- **298** com `revisao_pendente = true` (27%) — importados, mas o retriever
  **nunca** os devolve (filtro em SQL e no módulo puro)
- **822** efetivamente recuperáveis
- o arquivo `bia.sql` tem ~1,8 MB, com `on conflict (hash) do nothing` — rodar
  duas vezes não duplica

Distribuição por tipo (o que explica as cotas do bloco):

| tipo | n |
| --- | --- |
| conceito | 495 |
| regra_operacional | 285 |
| interpretacao | 102 |
| principio_de_ouro | 66 |
| estrategia | 48 |
| pergunta_investigativa | 44 |
| fundamento | 34 |
| explicacao_para_familia | 24 |
| encaminhamento | 9 |
| orientacao_para_escola | 5 |
| ferramenta | 3 |
| brincadeira | 2 |
| sinal_de_alerta | 2 |
| atividade | 1 |

Verificação pós-importação:

```sql
select count(*) from public.bia_chunks;                              -- 1120
select count(*) from public.bia_chunks where revisao_pendente;       -- 298
select count(*) from public.bia_chunks where texto_busca is null;    -- 0
select nucleo, count(*) from public.bia_chunks group by 1 order by 2 desc;
-- a marca tem de estar correta em todo o acervo:
select count(*) from public.bia_chunks where texto_original ilike '%materno%';  -- 0
```

## O que só o banco real pode responder

Isto continua sem verificação e precisa ser feito na mesma janela:

1. **A consulta roda.** Os testes de contrato
   (`retriever.integracao.test.ts`) provam que as colunas existem e que a
   sintaxe é a que o Postgres aceita — não que a consulta executa. Rodar:

   ```sql
   explain analyze
   select id, nucleo, tipo_conhecimento from public.bia_chunks
    where ativo and not revisao_pendente
      and texto_busca @@ websearch_to_tsquery('portuguese', 'madrugada or acorda or dormir')
    limit 120;
   ```

   Confirmar duas coisas: que usa `bia_chunks_busca_idx` (e não Seq Scan) e o
   tempo real. **A latência da BIA é hoje o único número do relatório que não
   temos** — em memória a seleção custa <5 ms, mas o custo real é a ida ao
   banco.

2. **`websearch_to_tsquery` com a palavra "or".** A consulta do retriever junta
   termos com `" or "`. Isto foi um bug real, corrigido antes de existir:
   sem `type: "websearch"` o supabase-js usa `to_tsquery`, que rejeitaria a
   consulta inteira com erro de sintaxe.

3. **RLS pela ótica da mãe.** Autenticada como usuária comum: `select` devolve
   só `ativo = true`; `insert`/`update` são negados.

## Se der errado

```sql
\i supabase/migrations/0071_rollback.sql
```

Derruba a tabela e, com ela, índices, trigger e policies. Não toca em
`set_updated_at()` nem em `is_admin()` — são da 0001 e outras tabelas dependem.
Nenhum dado de família é afetado em nenhuma hipótese: a 0071 não os conhece.

## Depois de aplicar, a BIA ainda fica desligada

Aplicar a migração e importar **não muda nada na Ayla**. A inserção no prompt
depende da variável `BIA_PROMPT_ENABLED`, que precisa valer `1` ou `true`. Sem
ela, `carregarBlocoBia` retorna antes de qualquer I/O — nem consulta o banco.

Ordem recomendada: aplicar → importar → conferir → rodar as consultas de
validação com a flag **desligada** → só então ligar, e olhar
`eventos_app`/stdout com `kind = "bia_recuperacao"` antes de deixar ligado.
