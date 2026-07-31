# Kit de ativação — escrita sombra do Fact Store

> **Não ativar em produção antes da conclusão da Fase 4A.** Este documento é o
> procedimento; a decisão de executar é humana.

## Pré-requisitos

| Item | Estado |
| --- | --- |
| Migração `0071` (BIA) | não aplicada |
| Migração `0072` (publicações) | não aplicada |
| Migração `0073` (fact store) | não aplicada |
| Ambiente de teste | **não existe** — ver `ambiente-minimo-de-teste.md` |
| Backup verificado | **pendente** — restore nunca testado |
| Flag `PERFIL_FATOS_SHADOW_WRITE` | ausente em todo lugar |

A `0073` depende de `family_accounts`, `membros_atipicos`, `is_admin()` e
`current_family_account_id()` — todas da `0001`. Não depende da `0071` nem da
`0072`, mas se as três forem na mesma janela, aplique em ordem numérica.

## Ordem de ativação

**1. Backup confirmado.** Snapshot do dia existe, com tamanho plausível. Sem
isso, pare aqui.

**2. Aplicar a migração**, em transação:

```sql
begin;
  \i supabase/migrations/0073_perfil_fatos.sql
commit;
```

**3. Verificar antes de ligar qualquer coisa:**

```sql
-- tabela e colunas
select count(*) from information_schema.tables
 where table_schema='public' and table_name='perfil_fatos';           -- 1
select count(*) from information_schema.columns
 where table_schema='public' and table_name='perfil_fatos';           -- 24

-- os 6 índices, incluindo o unique de idempotência
select indexname from pg_indexes where tablename='perfil_fatos' order by 1;
select indexdef from pg_indexes where indexname='perfil_fatos_idempotency_uk';

-- RLS e as 2 policies
select relrowsecurity from pg_class where relname='perfil_fatos';     -- t
select polname from pg_policy where polrelid='public.perfil_fatos'::regclass;

-- vazia
select count(*) from public.perfil_fatos;                             -- 0
```

**4. Confirmar que nada lê o fact store.** Antes de ligar a flag:

```bash
grep -rn "perfil_fatos" apps/web/src --include=*.ts \
  | grep -v "lib/kolo-vivo/fatos/" | grep -v "\.test\."
```

Deve retornar **vazio**. Todo acesso à tabela mora em `lib/kolo-vivo/fatos/`, e
só há escrita. O dia em que essa busca retornar algo fora dali, a leitura
começou — e isso é a Fase 10, não esta.

**5. Ligar a flag** — só então:

```
PERFIL_FATOS_SHADOW_WRITE=1
```

**6. Registrar a ativação.** Sem isto a amostra não é interpretável depois:

| Campo | Onde obter |
| --- | --- |
| ambiente | teste / produção |
| commit | `git rev-parse HEAD` |
| `extractor_version` | `EXTRACTOR_VERSION` em `lib/kolo-vivo/fatos/tipos.ts` |
| data e hora | UTC, no momento de ligar a flag |
| registros iniciais | `select count(*) from perfil_fatos` (esperado: 0) |
| canais ativos | web manual, web automático, WhatsApp, diário |

## Impedir mistura entre versões

A `extractor_version` é a única coisa que separa conjuntos produzidos por
código diferente. **Regra:** incremente a cada mudança que altere sujeito,
domínio, subcampo, conceito, afirmação, natureza, status epistemológico, data,
escopo, idempotência ou critério de aceitação.

Foi exatamente isso que falhou entre `81aa526` e `dfef78b`: os dois gravavam
`kv-blob-v1` apesar de mudanças semânticas, e fatos de antes e depois das
correções seriam indistinguíveis. A Fase 4A subiu para `kv-blob-v2`.

Toda consulta de qualidade deve agrupar por versão antes de comparar — ver
`auditoria-fact-store.sql`, seção 2.

## Verificações pós-ativação

Primeiras horas:

```sql
select extractor_version, source_channel, count(*)
  from public.perfil_fatos group by 1,2 order by 3 desc;
```

Depois, o kit inteiro. Três resultados são **incidente**, não observação:

- `source_type='ai_inference'` com status diferente de `inferred`;
- qualquer `verification_status='confirmed'` (nenhum fluxo atual produz);
- `escopo_tipo <> 'sempre'` (a fonte de participação não existe).

## Rollback

**Apagar a variável de ambiente.** É só isso.

Com a flag ausente, `registrarFatoPerfil` retorna antes de qualquer I/O: não
consulta banco, não escreve, não loga. Os fatos já gravados ficam e ninguém os
lê. Não é preciso derrubar a tabela nem reverter código.

Se for preciso descartar a amostra:

```sql
delete from public.perfil_fatos where extractor_version = 'kv-blob-v2';
```

Nunca `truncate` sem filtro de versão — apagaria conjuntos de outras fases.

## Comportamento em caso de erro

| Falha | O que acontece |
| --- | --- |
| tabela ausente | erro capturado, `perfil_fato_falhou`, turno segue |
| constraint violada | idem |
| idempotência conflita | `perfil_fato_duplicado`, comportamento correto |
| campo obrigatório ausente | `perfil_fato_rejeitado`, com motivo |
| banco indisponível | `perfil_fato_falhou`; o perfil antigo **já foi atualizado** |
| exceção inesperada | contida em três camadas; nunca vira mensagem da Ayla |

A assimetria conhecida: *perfil antigo atualizado + fato não gravado* é
possível; o inverso não, porque a escrita sombra roda depois. É o lado seguro.

Nenhum log carrega a afirmação — só identificadores, conceito, tipos e códigos.
