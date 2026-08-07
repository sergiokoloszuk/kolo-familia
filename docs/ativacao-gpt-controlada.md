# Ativação controlada do GPT — operação

Como colocar UMA família no GPT sem tocar em nenhuma outra, e como voltar tudo
atrás. Duas variáveis de ambiente, zero mudança de código, zero migração.

Referência: commit `ada8129` (Fase A + B) e a liberação controlada.

---

## Os três estados

| `IA_PROVIDER` | `OPENAI_TEST_FAMILY_IDS` | quem usa GPT |
|---|---|---|
| ausente, `anthropic`, ou qualquer outro valor | irrelevante | **ninguém** |
| `openai_teste` | lista de `family_account_id` | **só quem está na lista** |
| `openai_teste` | vazia ou ausente | **ninguém** |
| `openai` | irrelevante | **todas as famílias** |

A regra vale igual no WhatsApp e nas Estratégias — é a mesma função
(`providerConversacionalParaFamilia`), não duas implementações.

### Por que o estado de teste é um valor próprio

A alternativa natural seria `IA_PROVIDER=openai` + uma lista que *restringe*.
Nessa forma, a lista é o que segura o rollout — e apagar a variável por engano
(renomear, um deploy que não a carrega, um copiar-colar) promove **todas as
famílias** para o GPT em silêncio. O acidente mais provável vira o resultado
mais perigoso.

Aqui é o contrário: sob `openai_teste`, lista vazia = ninguém. Chegar a 100%
exige alguém digitar `openai`, que é uma decisão e não um descuido.

---

## Colocar uma família de teste no GPT

### PASSO 1 — descobrir o `family_account_id` certo

Precisa ser o id **estrutural**, não o nome nem o telefone. No SQL do Supabase
de produção, buscando pelo WhatsApp da testadora (o mais confiável, porque é o
que a Ayla usa pra achar a família):

```sql
select fa.id                     as family_account_id,
       fa.whatsapp_e164,
       fp.nome_mae,
       fp.como_chamar,
       fa.created_at
from   family_accounts fa
left   join family_profiles fp on fp.family_account_id = fa.id
where  fa.whatsapp_e164 = '+55DDDNUMERO';
```

⚠️ **Confira o retorno antes de copiar o id.** Duas armadilhas conhecidas:

1. `whatsapp_e164` **não é único** (pendência aberta) — se voltar mais de uma
   linha, você tem duas famílias com o mesmo número e precisa desempatar por
   `nome_mae`/`created_at` antes de escolher. Na dúvida, não escolha.
2. Busca por nome erra fácil: nome se repete e o campo aceita frase inteira.
   Use o número, e confirme o nome no resultado.

Se a conta for a sua própria (admin), o mesmo `select` com o seu número serve —
e é o teste mais seguro pra fazer primeiro.

### PASSO 2 — configurar o ambiente

```
IA_PROVIDER = openai_teste
OPENAI_TEST_FAMILY_IDS = <family_account_id do passo 1>
```

Mais de uma testadora: separe por vírgula. Espaço em volta é tolerado.

```
OPENAI_TEST_FAMILY_IDS = <id-1>, <id-2>, <id-3>
```

### PASSO 3 — redeploy

As variáveis são lidas no servidor. Na Vercel, mudar env exige **redeploy** pra
valer (não é hot-reload).

### PASSO 4 — conferir antes de conversar

Logado como admin, em produção:

```
GET /api/admin/provider-check?p=openai
```

O que precisa vir:

```jsonc
{
  "modo_de_rollout": "openai_teste",
  "provider_ativo_no_ambiente": "anthropic",   // quem está FORA da lista
  "familias_autorizadas_no_teste": 1,          // confere com o que você pôs
  "ok": true,
  "custo_usd": 0.0000xx                        // > 0
}
```

`familias_autorizadas_no_teste: 0` com `IA_PROVIDER=openai_teste` significa que
**ninguém está no GPT** — a variável não chegou ao servidor. Se `ok` for
`false`, o campo `falha` distingue chave inválida (401), modelo fora do projeto
(404) e quota (429).

### PASSO 5 — verificar pelos FATOS, depois de conversar

O provider-check prova a chave e a configuração. Ele **não** prova que as
famílias certas foram atendidas — isso só o banco responde, e só depois de
alguém conversar:

```
node scripts/bancada/migracao/verificar-rollout.mjs --horas 24
```

Read-only sobre `api_calls`. Procura os dois erros que importam:

- **VAZAMENTO** — família fora da lista atendida pelo GPT. Grave: alguém que não
  pediu para testar está testando. Ação imediata: `IA_PROVIDER=anthropic` +
  redeploy, investigar depois.
- **NÃO CHEGOU** — família autorizada recebendo Claude. Quase sempre é env não
  aplicada, deploy anterior à variável, ou id diferente do que se pensa.

"Ainda não conversou" **não é erro** — é ausência de dado. O relatório separa as
duas coisas, porque confundi-las leva a mexer no que não está quebrado.

A allowlist é lida da mesma `OPENAI_TEST_FAMILY_IDS` que o produto lê. Comparar
contra uma lista digitada dentro do script provaria que duas cópias batem entre
si, não que a produção está certa.

---

## Voltar TODOS ao Claude

```
IA_PROVIDER = anthropic
```

(ou remover a variável — mesmo efeito). Redeploy. Não precisa mexer na lista:
sob `anthropic`, ela não vale nada.

## Liberar para 100% das famílias — depois, não agora

```
IA_PROVIDER = openai
```

A partir daí `OPENAI_TEST_FAMILY_IDS` deixa de importar e pode ser removida.

---

## Como saber depois quem respondeu

Sem tabela nova, sem mecanismo novo:

- **`api_calls`** — `provider`, `model`, `family_account_id`, `feature`
  (`ayla_responder` no WhatsApp, `conversa_web` nas Estratégias), tokens e
  `custo_usd`. Responde "quanto o GPT custou nesta família, neste período".
- **`mensagens_skill.metadata`** (web) — `provider` e `model` **por mensagem**.

Limite conhecido: no WhatsApp, `ayla_messages` não guarda o provider por
mensagem — a atribuição por lá é via `api_calls`, no par família + horário. Foi
decisão de não criar mecanismo novo pra isso.
