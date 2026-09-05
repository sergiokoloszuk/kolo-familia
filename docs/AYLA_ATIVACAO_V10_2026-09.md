# Ativação global do Core v10 (Prompt Mestre Kolo v2.1)

**05/09/2026 · EXECUTADO EM PRODUÇÃO · reversível em um passo.**

A Ayla das conversas reativas passou a rodar com o Prompt Mestre Kolo v2.1,
gravado como `core` **v10** em `ayla_documentos`. O Core v9 continua íntegro no
banco, com status `arquivado`, e volta a valer em menos de um minuto.

---

## 1. O que mudou, exatamente

**Um bloco do prompt.** O bloco 1 do array `system` de
`lib/ayla/experimental.ts` — que era o Core v9 (21.395 ch) — passou a ser a v2.1
(27.902 ch). **Nenhuma linha de código foi alterada para isso.** A troca é um
registro de banco, porque `resolverDocumento` lê `status='ativo'`.

Os outros oito blocos (contexto, jornada, Trial v5, repertório, pós-Trial,
comercial, formato, instrução extra), o orquestrador, as fronteiras, o
isolamento entre irmãos, o Trial e a fala espontânea: **intocados**.

## 2. O que foi provado antes de ativar

| Prova | Resultado |
|---|---|
| A v7 (rascunho ocupando o slot) tinha uso operacional? | **Não.** `lerRascunho` é chamado só pelo próprio teste. Arquivada, não descartada — 14.117 ch, sha `440bd82d…` |
| O conteúdo gravado é o candidato, byte a byte? | **Sim.** sha256 `791c6637…` idêntico ao arquivo |
| Só o prompt subiu, sem os anexos de revisão? | **Sim.** 27.883 de 42.747 ch; 12 marcadores de anexo ausentes, 9 âncoras presentes |
| Suíte, tipos e build | **3.228 testes passando · `tsc` limpo · `npm run build` ok** |
| Salvaguardas na v10 (32 execuções) | crise 2/2 · desabafo 2/2 · BPC 2/2 · promessa 2/2 · continuidade 2/2 |
| Turno-só-pergunta (o bloqueador que a v2 tinha) | **0/12** na v2.1, contra 2/12 do próprio Core v9 |

### A prova que faltava: `**` → `*` no funil real

O ponto de risco da v10 é que ela **libera negrito**, e o Core v9 não liberava.
Medido sobre as **32 respostas reais da v10**, passando pelo funil de envio de
produção (`paraWhatsApp`, chamado dentro de `enviarTexto` desde 15/08, `247bb9b`):

```
respostas reais da v10 testadas ....... 32
com ** na ENTRADA (saída do modelo) ... 31
pares **negrito** convertidos ......... 79
com ** na SAÍDA (o que a família vê) .. 0
danos ao conteúdo ..................... 0
```

**Nenhum `**` chega à família, e nada foi corrompido na conversão.**

## 3. A ativação, passo a passo

Replicou `ativarVersao` (`lib/ayla/documentos.ts`): ler o alvo → exigir conteúdo
não vazio e ainda não ativo → exigir exatamente uma ativa → arquivar a vigente →
ativar o alvo → restaurar em caso de falha.

```
ANTES     v7 arquivado · v9 ATIVO (2026-08-17) · v10 rascunho
          1/2  v9  → arquivado   ok
          2/2  v10 → ativo       ok
DEPOIS    v7 arquivado · v9 arquivado · v10 ATIVO (2026-09-05)
          exatamente UMA ativa?  sim → v10
          sha da ativa: 791c6637…  idêntico ao gravado
          v9 preservada: status=arquivado · 21.395 ch
```

## 4. Smoke pós-ativação

`resolverDocumento(supabase, "core")` — **a mesma chamada que
`experimental.ts:759` faz em toda conversa**, sem rascunho:

```
versao=10 · origem=admin · 27.902 ch
piso de utilidade presente ....... sim
limite jurídico presente ......... sim
anexo de revisão presente ........ não (correto)
```

Turno oficial completo com esse conteúdo, em família sintética (nenhuma família
real recebeu mensagem):

| Mensagem | `coreVersao` | provider | `**` modelo → família |
|---|---|---|---|
| "ele grita muito" | **10** | openai / gpt-5.6-luna | 2 → **0** |
| "monta a rotina visual dele e salva no meu perfil" | **10** | openai / gpt-5.6-luna | 6 → **0** |

E o comportamento novo apareceu nos dois: a primeira **orienta e pergunta** no
mesmo turno (o que o Core v9 falhava em 17% dos relatos vagos); a segunda recusa
salvar a rotina **e entrega a sequência mesmo assim**.

---

## 5. ROLLBACK — como voltar ao Core v9

**Efeito em até 60 segundos** (o TTL do cache de `resolverDocumento`). Não exige
deploy, nem migração, nem reinício.

**Caminho de rota:** Admin → `/admin/documentos/core` → ativar a **v9**.

**Caminho manual**, se o Admin não estiver acessível — duas escritas em
`ayla_documentos`, nesta ordem:

1. `chave='core' AND versao=10` → `status='arquivado'`
2. `chave='core' AND versao=9`  → `status='ativo'`

A ordem importa: o índice único parcial da migração 0077 não admite duas ativas.
Conferir depois que **exatamente uma** linha de `chave='core'` está `ativo`.

**Sinal de que voltou:** `ayla_send_log.payload.meta.coreVersao` volta a `9`.

**Se o banco inteiro cair**, o fallback do código
(`experimental-prompt.ts`, `AYLA_EXPERIMENTAL_PROMPT`) assume sozinho — é chão,
não resquício.

---

## 6. ⚠️ Duas coisas que ficam abertas

### 6.1 O bloco 8 harmonizado ainda NÃO está em produção

A v10 permite negrito; o bloco de formato **implantado** (`lib/conducao/formas.ts`)
ainda diz "sem markdown". A harmonização está **commitada, não publicada** — ela
depende de deploy, e deploy não foi autorizado nesta entrega.

**Consequência hoje:** o prompt se contradiz internamente. Na prática o modelo
segue a v10 (produz `**`) e o funil converte — foi o que as 32 execuções
mediram. **Não é um defeito ativo, é uma inconsistência de texto.** Some no
próximo deploy da `main`.

### 6.2 A confirmação em tráfego real ainda não existe

No momento da ativação, os últimos envios registrados eram anteriores a ela
(`coreVersao=9`, 13 turnos, janela 04/09 18:00 → 05/09 15:00). **Nenhuma família
escreveu depois.** A confirmação de que o tráfego real carrega `coreVersao=10`
depende da próxima conversa espontânea de uma família — não foi forçada, por
instrução explícita de não enviar mensagem artificial.

## 7. O que esta ativação não prova

- **Não é validação com família.** 32 execuções sintéticas medem forma,
  segurança e coerência. Não medem se a mãe se sentiu ajudada.
- **Não cobre a fala espontânea.** A proativa não recebe o Core — a v10 não a
  alcança. Ver a frente seguinte.
- **Não cobre a web.** `/conversar` lê o mesmo documento `core`, mas não foi
  exercitada nesta rodada.
- **Um avaliador, não cego**, nas dimensões de julgamento.

---

## 8. Frente seguinte — GPT como cérebro único

Registrada em [PENDENCIAS.md](PENDENCIAS.md). Resumo: a decisão de produto é que
o GPT gera **e interpreta**; Claude não fala com família e não faz leitura
clínica/comportamental cujo resultado a orientação herde. O caminho oficial já é
GPT — `experimental.ts:969` fixa `const provider = "openai" as const` — mas
outros módulos ainda não são.
