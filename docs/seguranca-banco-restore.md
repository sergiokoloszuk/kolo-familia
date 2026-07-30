# Segurança do banco: backup, restauração e a janela para a 0071

> **Nada aqui foi executado.** Este documento é revisão de procedimento. Nenhum
> comando foi rodado contra produção, nenhuma migração aplicada, nenhum chunk
> importado.

## 1. Quais backups existem hoje

Duas camadas, com naturezas muito diferentes:

| Camada | O que é | Confiança |
| --- | --- | --- |
| **Snapshot diário da Hostinger (VPS)** | imagem do servidor inteiro | **provada em campo** — foi o que recuperou o banco no incidente de 08/06, quando um redeploy do stack Supabase zerou o `PGDATA` |
| **Volume/bind do `PGDATA` no Easypanel** | o dado vivo, não um backup | **frágil** — é exatamente o que se perdeu em 08/06 |

**Não há dump lógico (`pg_dump`) agendado.** Isso é a lacuna principal, e é uma
lacuna de natureza, não de frequência: o snapshot da Hostinger restaura *a
máquina*, tudo ou nada. Não dá para extrair uma tabela, comparar dois momentos,
nem montar um banco de teste a partir dele sem levantar um servidor inteiro.

Os três itens abaixo precisam ser confirmados por quem tem acesso ao painel —
não consigo verificar daqui e não vou supor:

- [ ] frequência e retenção reais do snapshot (diário? quantos dias guarda?)
- [ ] horário do snapshot (importa: aplicar migração logo *depois* de um snapshot
      é diferente de aplicar logo antes do próximo)
- [ ] se o `PGDATA` está dentro da área coberta pelo snapshot

## 2. O que dá para verificar sem restaurar

Bastante — e vale fazer tudo isto **antes** de qualquer coisa:

| Verificação | Como | Custo |
| --- | --- | --- |
| O snapshot existe e tem data de hoje | painel Hostinger | segundos |
| O tamanho é plausível (não é um arquivo de 0 byte) | painel | segundos |
| O banco responde e o schema está íntegro | `select count(*) from pg_tables where schemaname='public'` | segundos |
| Quantas migrações a produção conhece | tabela de migrações do Supabase | segundos |
| **Se a 0070 está aplicada** | `select ... from information_schema` | segundos |
| Volumetria por tabela (dimensiona o restore) | `pg_total_relation_size` | segundos |
| **Um dump lógico sai sem erro** | `pg_dump -Fc` para arquivo local no host | minutos |

O último é o mais valioso e o mais barato: **`pg_dump` que completa sem erro já
prova que o banco é legível de ponta a ponta**. Não prova que o restore funciona,
mas elimina a hipótese de corrupção silenciosa — e produz o artefato que torna o
teste de restauração possível.

## 3. Quais passos exigem ambiente separado

| Passo | Precisa de ambiente separado? |
| --- | --- |
| Conferir backup, schema, volumetria | não |
| Gerar `pg_dump` | não (roda no host, só lê) |
| **Restaurar o dump** | **sim, obrigatoriamente** |
| **Aplicar a 0071 pela primeira vez** | **sim** |
| **Importar os 1.120 chunks pela primeira vez** | **sim** |
| Rodar o `explain analyze` do retriever | idealmente no separado; em produção só depois de validado |
| Ligar a flag para teste controlado | produção, com a migração já validada |

A regra é uma só: **nada que escreva roda pela primeira vez em produção.**

## 4. O menor ambiente seguro possível

Em ordem de esforço crescente. A opção 1 resolve.

### Opção 1 — Postgres em container, na sua máquina (recomendada)

```bash
docker run -d --name kolo-restore -e POSTGRES_PASSWORD=teste \
  -p 55432:5432 postgres:15     # a MESMA major version da produção — confirmar antes
```

É descartável, não tem rede com produção, e some com `docker rm -f`. Hoje **não
há Docker nesta máquina** — instalar o Docker Desktop é o único pré-requisito
real de toda esta sequência.

Limite honesto: um Postgres puro não tem `auth`, `storage`, PostgREST nem as
roles do Supabase. Para validar a 0071 isso **basta** — ela só depende de
`to_tsvector`, de `public.set_updated_at()` e de `public.is_admin()`, e as duas
funções vêm na 0001, que está no dump. O que um Postgres puro **não** valida é o
RLS pela ótica de um usuário autenticado de verdade (item que fica para a opção
2 ou para a verificação controlada em produção).

### Opção 2 — Supabase local (`supabase start`)

Sobe o stack inteiro (auth, PostgREST, storage) em containers. Valida também o
RLS ponta a ponta e o `supabase-js` de verdade — que é onde vive o bug de
`textSearch`. Custa mais disco e mais tempo de subida. Ainda depende de Docker.

### Opção 3 — projeto Supabase temporário na nuvem

**Sim, é possível, e é a alternativa se o Docker não for viável.** Um projeto
novo no Supabase Cloud (free tier), usado como banco de restauração e depois
deletado. Cuidados que não são opcionais:

- é um provedor **externo**: subir um dump de produção ali é uma transferência
  de dados de saúde de criança para fora da infraestrutura atual — não faça isso
  com dado real (ver seção 5);
- criar **fora** da organização de produção, para não haver chance de confundir
  os painéis;
- credenciais em arquivo separado, **nunca** no `.env.local` (é ele que aponta
  para produção — trocar por engano é o modo de falha mais provável desta
  operação inteira);
- deletar o projeto ao terminar, e conferir que foi deletado.

**Recomendação:** opção 1 para validar a 0071 e a importação; opção 2 se quiser
validar RLS e `supabase-js` antes de ligar a flag. A opção 3 só se as duas
primeiras estiverem bloqueadas — e sempre com dado sintético.

## 5. O que anonimizar ou simplesmente não levar

O teste de restauração tem dois objetivos separados, e só um deles precisa de
dado real:

**(a) Provar que o backup restaura.** Precisa do dump real. Então: restaure
**apenas na opção 1 ou 2, na sua máquina**, nunca num provedor externo. O dado
não sai do lugar. Ao terminar, `docker rm -f` e o container some com tudo.

**(b) Validar a 0071 e a importação.** **Não precisa de dado de família nenhum.**
A 0071 cria uma tabela isolada, que não referencia família, criança nem
cuidador. Um banco vazio com as migrações 0001→0070 aplicadas já serve.

Se por algum motivo for necessário levar dado para fora da máquina, o que **não
pode ir**:

| Tabela / campo | Por quê |
| --- | --- |
| `membros_atipicos` (nome, diagnóstico, perfil) | dado de saúde de criança |
| `kolo_vivo` / fatos do perfil | idem, e é o mais sensível do produto |
| `registros`, diários, DASS-21 | saúde mental do cuidador |
| conversas da Ayla (WhatsApp e web) | relato íntimo de família |
| `whatsapp_e164`, e-mails, `auth.users` | identificação direta |
| tokens de `acessos_app`, chaves Stripe | credenciais vivas |

A regra prática: **para validar a BIA, leve o schema e zero linhas.** O único
dado que a BIA precisa é o dela própria, que vem do `.docx` e é conteúdo
editorial, não dado pessoal.

## 6. Sequência segura

Cada passo tem um critério de parada. Se ele não for atendido, **pare ali** — não
avance "para ver se resolve".

### Passo 0 — pré-requisitos (fora de produção)

Instalar Docker. Confirmar a versão major do Postgres de produção
(`select version()`), para que o container seja a mesma.

### Passo 1 — testar a restauração

```bash
# no host de produção — só leitura
pg_dump -Fc -d "$DATABASE_URL" -f kolo-$(date +%F).dump
```

Traga o arquivo para a sua máquina e restaure no container:

```bash
pg_restore -d "postgres://postgres:teste@localhost:55432/postgres" \
  --no-owner --no-privileges kolo-AAAA-MM-DD.dump
```

**Critério de parada:** `pg_restore` termina sem erro; contagens das tabelas
principais batem com produção; `auth.users` tem o número esperado de linhas.

Este passo, sozinho, **fecha a maior pendência de segurança do projeto** — o
backup deixa de ser hipótese. Vale mesmo que a BIA seja adiada.

### Passo 2 — aplicar a 0071 no restaurado

```sql
begin;
  \i supabase/migrations/0071_bia.sql
commit;
```

Depois, ensaie a reversão e reaplique — é o teste do rollback:

```sql
\i supabase/migrations/0071_rollback.sql
\i supabase/migrations/0071_bia.sql
```

**Critério de parada:** as duas rodam limpas; 5 índices e 2 policies presentes;
nenhuma tabela existente alterada.

### Passo 3 — importar os chunks no restaurado

```bash
node scripts/bia/importar-bia.mjs --arquivo "BIA-Volume-1.docx" \
  --versao 2026-07-30 --sql bia.sql
psql "postgres://postgres:teste@localhost:55432/postgres" -f bia.sql
```

**Critério de parada:** 1.120 linhas; 298 com `revisao_pendente`; zero
`texto_busca` nulo; zero ocorrência de "materno" no acervo. Rodar o `bia.sql`
duas vezes tem de continuar dando 1.120 (o `on conflict (hash) do nothing`).

### Passo 4 — verificar o retriever contra Postgres

```sql
explain analyze
select id from public.bia_chunks
 where ativo and not revisao_pendente
   and texto_busca @@ websearch_to_tsquery('portuguese','madrugada or acorda or dormir')
 limit 120;
```

**Critério de parada:** usa `bia_chunks_busca_idx` (não Seq Scan) e o tempo é
aceitável. **É aqui que a latência real aparece pela primeira vez** — é o número
que falta em todo o relatório da Etapa 3.

Rodar também as 10 consultas da bancada contra este banco, comparando com a
saída atual do corpus JSON. Divergência grande = a busca textual do Postgres
seleciona candidatos diferentes do que a aproximação em memória sugeria, e a
calibração precisa de outra olhada antes de ligar qualquer coisa.

### Passo 5 — produção, em duas etapas separadas

**5a. Aplicar e importar, com a flag DESLIGADA.**
Janela de baixo tráfego, logo após um snapshot confirmado. Aplicar a 0071,
importar, rodar as verificações do passo 3. Nada muda para ninguém: sem
`BIA_PROMPT_ENABLED`, `carregarBlocoBia` retorna antes de qualquer I/O.

Deixe assim por alguns dias. Se algo estiver errado no schema, aparece sem custo
nenhum para as famílias.

**5b. Ligar a flag para teste controlado.**
`BIA_PROMPT_ENABLED=1`. Observar `eventos_app` e o stdout com
`kind = "bia_recuperacao"`: quantas consultas, quantas vazias, quantos tokens,
quantos ms, quantos conflitos. Nenhum desses registros contém conversa.

Desligar é instantâneo e não exige deploy de código — é variável de ambiente.

> ⚠️ **NÃO usar o botão Deploy do Easypanel no stack Supabase em nenhum destes
> passos.** Foi o que zerou o banco em 08/06. A aplicação é por sessão SQL.

## 7. O que continua sendo decisão humana

1. **Instalar Docker** — sem isso, nada da sequência acima acontece.
2. **Agendar `pg_dump` diário**, separado do snapshot da VPS. É o que permite
   repetir o teste de restauração sem levantar um servidor inteiro, e é a
   diferença entre "temos backup" e "temos backup verificável".
3. **Criptografia em repouso** continua pendente e é anterior a tudo isto: são
   dados de saúde de criança.
