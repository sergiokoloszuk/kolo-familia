# Rotina Visual — Nível 2, pipeline real em produção

**07/09/2026.** Prova de que a Rotina Visual vai de `aguardando` a `pronto` em
produção, com geração, storage, assinatura de URL, magic link e página — **sem
WhatsApp e sem tocar em família real**.

Correção validada: `cfd500b` (continuidade, aceite curto, memória que não vira
etapa). Nível 1 (modelo real + banco em memória) em
`scripts/bancada/rotina-nivel1/`.

---

## 1. A conta QA — criada pelo fluxo real, descartada no fim

Criada pela Auth Admin API com `email_confirm: true`; o gatilho
`handle_new_user` montou família, trial e preferências. Nenhuma família foi
inserida por SQL à mão.

| | |
|---|---|
| `whatsapp_e164` | **`NULL`** — a Ayla não tinha para onde enviar |
| `ayla_preferences.desativada` | `true` — segunda trava, redundante de propósito |
| `nome_familia` | `QA NIVEL2 APAGAR 07-09` |
| criança | `Teste QA`, 6 anos, `perfil = Outro`, fictícia |

**IDs temporários** (todos apagados — ver §8):

```
auth.users        206bdb24-48a3-419e-890e-6e112696fda4
family_accounts   5d341a11-9793-4964-ba1c-efabb5524e57
membros_atipicos  2dea0ab8-aa35-4e13-bb4c-db54498dd70c
rotinas           4a84a305-2560-49cd-8017-d10d4637b4b4
acessos_app       1a59cf98-b643-4224-90b7-3661d12e6c49
```

Rotina criada no estado inicial real — `cards_status = 'aguardando'`,
`tema = null` — com **4 tarefas**: Acordar · Café da manhã · Escovar os
dentes · Brincar. Zero imagens.

---

## 2. Como a geração foi disparada sem copiar segredo

O `KOLO_GERACAO_SECRET` vive na Vercel e **não foi copiado para lugar nenhum**.
Uma tentativa direta do endpoint com a cópia local devolveu `HTTP 401` — que é o
fail-closed funcionando.

O caminho usado foi outro: **produção chama o próprio endpoint com o próprio
segredo**. O reconciliador de órfãs (`/api/ayla/cron?tipo=artefatos_orfaos`)
roda dentro da Vercel e invoca `dispararGeracao`. Bastou gravar o tema na rotina
QA e disparar o job escopado.

### Por que disparar a varredura era seguro

A varredura enxerga **todas** as rotinas em `aguardando`, inclusive de famílias
reais. Isso só foi feito depois de provar que o cron agendado **já tinha
avaliado as outras duas às 15:20** do mesmo dia e decidido `perguntar` —
*"nenhuma manifestação explícita de tema após a criação"*. Decisão registrada em
`eventos_app`, não suposta.

Resultado da execução única:

```
{"ok":true,"tipo":"artefatos_orfaos","examinadas":3,"recuperadas":1,"semDado":2,"falhas":0}
```

---

## 3. A transição de estados

```
aguardando   tema=null           mascote=nao   historia=nao   0/4 imagens
   ↓  [tema gravado só na rotina QA]
gerando      tema=dinossauros    mascote=nao   historia=nao   0/4
   ↓  ~77 segundos
pronto       tema=dinossauros    mascote=SIM   historia=SIM   4/4
```

**Exatamente uma geração.** Em `eventos_app`, um único
`artefato_reconciliado · rotina 4a84a305 · cron · resolvida · tema=dinossauros`.
As outras duas linhas do mesmo run são `artefato_faltou_dado` — registro, sem
ação.

---

## 4. Os artefatos gerados

**4 cards + 1 mascote**, todos com `nome_tematico` temático:

| ordem | etapa | nome temático |
|---|---|---|
| 0 | Acordar | HORA DE ACORDAR |
| 1 | Café da manhã | CAFÉ DA MANHÃ |
| 2 | Escovar os dentes | ESCOVAR OS DENTES |
| 3 | Brincar | HORA DE BRINCAR |

Cinco objetos em `imagens/<family_id>/cena/`, entre 83 e 123 KB.

---

## 5. `imagem_url` canônica ≠ URL assinada — e por que o 400 não é defeito

O `imagem_url` gravado em `rotina_tarefas` tem a forma **pública**
(`/storage/v1/object/public/imagens/…`). Buscá-lo cru devolve:

```
HTTP 400  {"statusCode":"404","error":"Bucket not found"}
```

**Isto não é defeito, e vale também para rotinas de famílias reais** — foi
verificado numa rotina real que ficou `pronto` em 06/09, com o mesmo resultado.
A explicação:

- o bucket `imagens` **existe** e é **privado** (`public = false`) — o caminho
  `/public/` não resolve para bucket privado, e o Supabase responde
  "Bucket not found";
- o valor gravado é o **caminho canônico**, não uma URL de entrega;
- **quem assina é a página, no render**: `assinarImagens` → `pathDeImagem`
  extrai o path da URL canônica → `createSignedUrl`.

O bucket ter deixado de ser público fecha um furo de segurança que estava
registrado. Quem for auditar isto no futuro: **não conclua "imagens quebradas"
a partir de um 400 na URL canônica.** Assine e busque.

Prova nos dois sentidos: assinatura manual do objeto devolveu `HTTP 200
image/jpeg, 104 KB`; e a página serviu **4 URLs assinadas e 0 públicas**.

---

## 6. Magic link e página

```
GET /auth/wa?k=<token>   →  HTTP 307  →  /ludico/rotinas/4a84a305-…
                             cookie de sessão emitido
GET /ludico/rotinas/4a84a305-…  →  HTTP 200, 24 237 bytes
```

O token foi de uso único, de vida curta, e morreu com a limpeza. **Não fica
registrado aqui** — link reutilizável em documento é credencial em documento.

Conteúdo conferido na página: o nome da rotina, os **quatro** passos, o nome
temático e o tema `dinossauros`. As 4 URLs assinadas extraídas do HTML foram
buscadas uma a uma:

```
card 0  HTTP 200  image/jpeg  104 KB
card 1  HTTP 200  image/jpeg  102 KB
card 2  HTTP 200  image/jpeg  123 KB
card 3  HTTP 200  image/jpeg   89 KB
```

Nenhum identificador de outra família apareceu no HTML.

---

## 7. O que não aconteceu

- **Zero outbound em TODA a base** durante a missão — não só na família QA.
- **Zero mensagens** e **zero linhas em `ayla_send_log`** para a família QA.
- A rotina real da Manu (`ec61feee`) terminou a missão com
  `cards_status = 'aguardando'`, `tema = null` e `updated_at` **idêntico** ao de
  antes (`12:55:09`). Intocada.

---

## 8. Limpeza

Storage primeiro — os 5 objetos sob o prefixo da família QA, porque depois do
`DELETE` o `family_id` já não está à mão e o cascade **não** alcança o bucket.
Depois, `DELETE` do usuário de Auth; o `ON DELETE CASCADE` levou o resto.

Verificado depois: `family_accounts`, `membros_atipicos`, `rotinas`,
`rotina_tarefas`, `subscription_accesses`, `ayla_preferences`, `acessos_app`,
`api_calls`, `eventos_app` e storage — **zero linhas** sob os IDs QA.

Contagens de volta ao baseline, exatas:

| tabela | antes | depois |
|---|---|---|
| `family_accounts` | 273 | **273** |
| `membros_atipicos` | 178 | **178** |
| `rotinas` | 88 | **88** |
| `rotina_tarefas` | 490 | **490** |

---

## 9. O que o Nível 2 não prova

O canal. Webhook, inbound pela Z-API, a resposta chegando num aparelho e a ponte
do Plano em tráfego real continuam sem prova — é o **Nível 3**, e o único
pré-requisito que falta é um número de WhatsApp da equipe. Roteiro pronto em
[ROTINA-VISUAL-NIVEL3-ROTEIRO.md](ROTINA-VISUAL-NIVEL3-ROTEIRO.md).
