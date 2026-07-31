# Ambiente mínimo de teste

Hoje não existe nenhum. Sem Docker, sem WSL, sem staging — o único Supabase é
produção. Isso bloqueia a coleta de fatos reais e, antes disso, o teste de
restauração de backup, que continua sendo a maior pendência de segurança do
projeto.

## Alternativas

### 1. Postgres em container (recomendada)

`docker run -d -e POSTGRES_PASSWORD=... -p 55432:5432 postgres:15`

**Pré-requisitos:** Docker Desktop. **Windows:** exige WSL2 — instalação
elevada e reinicialização. **Proximidade com produção:** boa para o que
importa aqui; a `0073` só depende de `gen_random_uuid`, de duas funções da
`0001` e de tipos nativos. **Custo:** zero. **Risco:** nenhum — descartável,
sem rede com produção. **Manutenção:** mínima.

**O que não cobre:** RLS pela ótica de um usuário autenticado, PostgREST e o
`supabase-js` de verdade. Para a escrita sombra isso não importa (escreve por
service role), mas importará na Fase 10.

### 2. Supabase local (`supabase start`)

Sobe o stack inteiro em containers. Cobre RLS ponta a ponta e o `supabase-js`
real. **Pré-requisitos:** Docker + CLI do Supabase. **Custo:** zero, mas ~2 GB
de imagens e subida lenta. **Risco:** nenhum. **Manutenção:** média — a versão
do CLI precisa acompanhar a do self-hosted.

### 3. Projeto Supabase temporário na nuvem

**Funciona sem Docker** — é a saída se o WSL2 for inviável. **Custo:** free
tier. **Risco: alto**, e é de natureza diferente: é infraestrutura externa. Só
com **dado sintético**; nunca restaurar dump de produção ali. Criar fora da
organização de produção, credenciais em arquivo separado (jamais no
`.env.local`, que aponta para produção), e deletar ao terminar.

### 4. Postgres nativo no Windows

Instalador oficial, sem Docker. **Pré-requisitos:** instalação elevada.
**Proximidade:** igual à opção 1. **Risco:** baixo. **Manutenção: alta** — fica
residente na máquina, atualiza fora de banda, e diverge da versão de produção
com o tempo. Só se Docker for impossível.

### 5. Mocks contratuais (o que existe hoje)

É o que os 70 testes de `lib/kolo-vivo/` já fazem. **Custo e risco:** zero.
**Cobre:** adaptador, serviço, barreiras, idempotência, paridade, integração
dos quatro chamadores. **Não cobre:** que o SQL executa, que os índices são
usados, que o unique de idempotência funciona no Postgres, que o RLS está
correto e a latência real.

### 6. CI com banco efêmero

`services: postgres` no runner, migrações aplicadas a cada execução.
**Pré-requisitos:** pipeline de CI — o repositório não tem uma hoje.
**Proximidade:** boa. **Custo:** minutos de CI. **Manutenção:** média.
**É o destino certo depois que a opção 1 provar o caminho manualmente.**

## Recomendação

**Opção 1 agora, opção 6 depois.** O container Postgres desbloqueia, na mesma
tarde e sem risco, as três coisas que faltam: teste de restauração, validação
da migração e primeira coleta com dado sintético.

Sequência mínima, uma vez que o Docker exista:

1. subir `postgres:15`;
2. aplicar `0001` até `0073` em ordem;
3. `PERFIL_FATOS_SHADOW_WRITE=1` apontando para ele;
4. popular perfis controlados (nenhum dado real);
5. rodar a bateria de `__fixtures__/conversas-benchmark.ts`;
6. rodar `auditoria-fact-store.sql` inteiro;
7. `docker rm -f` — some com tudo.

**O único pré-requisito real de toda esta sequência é instalar o Docker
Desktop.** É uma decisão humana, com reinicialização, e não pode ser feita
daqui.

Nada foi provisionado nesta rodada.

---

## Protocolo executável (Fase 4D)

### Experimento 1 — técnico, dado sintético

```bash
docker run -d --name kolo-teste -e POSTGRES_PASSWORD=teste -p 55432:5432 postgres:15
export DATABASE_URL="postgres://postgres:teste@localhost:55432/postgres"
for f in supabase/migrations/00*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"; done
export PERFIL_FATOS_SHADOW_WRITE=1
# popular perfis controlados e rodar a bateria de __fixtures__/conversas-benchmark.ts
psql "$DATABASE_URL" -f docs/memoria/auditoria-fact-store.sql
docker rm -f kolo-teste
```

Valida SQL, constraints, os 8 índices, o unique de idempotência, quarentena e
linhagem. **Nenhum dado real.** Repetir é recriar o container.

Inspecionar quarentena:

```sql
select quarentena_motivo, sujeito_classificado, count(*)
  from perfil_fatos where status = 'quarentena' group by 1,2 order by 3 desc;
```

Comparar versões:

```sql
select extractor_version, status, count(*) from perfil_fatos group by 1,2 order by 1;
```

### Experimento 2 — linguagem real

Só depois do experimento 1 passar. **1 ou 2 famílias internas, com ciência
explícita**, 72 h, WhatsApp **e** diário — o diário sozinho não testa o risco
maior, que é linguagem natural com sujeito implícito e correferência.

Auditoria diária: seções 3, 4 e 8 do kit.

**Interromper** se aparecer: fato da cuidadora na criança; fato de uma criança
na outra; `confirmed` sem confirmação; `ai_inference` fora de `inferred`;
duplicação descontrolada; perda de proveniência; escopo diferente de `sempre`;
reprocessamento não rastreável; **qualquer leitura do fact store**; ou qualquer
falha que afete a conversa.

**Rollback:** apagar a flag. Preservar os registros — a evidência do erro é o
produto do experimento. Limpeza seletiva só depois de exportar:

```sql
delete from perfil_fatos
 where extractor_version = 'kv-blob-v2' and family_account_id = '<familia>';
```
