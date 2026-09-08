# MATRIZ DE CONFLITOS — O QUE HOJE CONTRADIZ A AYLA QUE QUEREMOS

**Data:** 08/09/2026 · **Modo:** AUDITAR · **Nada foi alterado.**
**Branch:** `feat/reconectar-inteligencia` (zero commits) · `main` = `03786d3`.

## Objetivo canônico auditado

> Família chega com pouco contexto → Ayla entende o problema atual → consulta o
> que já sabe → identifica só o que falta e muda a orientação → uma pergunta de
> alto valor quando necessária → orienta → aprofunda conforme interesse →
> registra → reutiliza → acompanha → aciona artefato quando ele resolve.
>
> Percepção alvo: *"a Ayla está conhecendo meu filho."*

## Resposta em uma frase

O que impede não é falta de regra: é **excesso de donos**. Existem hoje **três
núcleos de identidade** governando a mesma Ayla, e o retrato da criança chega ao
modelo **sem data** — o que torna a personalização verdadeira estruturalmente
indistinguível da inventada.

---

# FASE 1 — AUDITORIA

## 1.1 As fontes que realmente governam o runtime

Medido em `experimental.ts:1093` (array `system`) e `responder.ts:418`.

| # | Fonte | Onde vive | Governa | Tamanho | Alcance real |
|---|---|---|---|---|---|
| A | **Core v11** (= Prompt Mestre) | `ayla_documentos.core`, ativo | conversa viva | 27.994 ch | ~97% dos turnos |
| B | **`nucleoConducao()`** | `lib/conducao/diretrizes.ts` | Legacy **e a Rotina** | ~70.000 ch | Legacy 2,59% + **100% da Rotina** |
| C | **`AYLA_EXPERIMENTAL_PROMPT`** | `lib/ayla/experimental-prompt.ts` | fallback se não houver core ativo | 565 linhas | 0% hoje |
| D | **Trial v5** | `ayla_documentos.trial`, ativo | só em condução comercial | 11.048 ch | famílias em teste |
| E | **`blocoDaJornada()`** | `lib/trial/jornada.ts` | bloco `<jornada>` | determinístico | famílias em teste |
| F | **`blocoPosTrial()`** | `lib/trial/jornada.ts` | bloco `<pos_trial>` | determinístico | teste vencido |
| G | **agência v1** | `docs/documentos-ayla/prompt-mestre-agencia-v1.md` | — | 31.081 ch | **não injetado** |
| H | **cartões v1 / v2** | banco (inativo) e `docs/` | — | — | **não injetado** |

**Core v11 é o documento da agência.** Provado: 47 de 49 seções com corpo
idêntico ao `prompt-mestre-kolo-v2.1-CANDIDATO.md`. As 2 restantes divergem só
por marcador de anexo e porque produção é **mais estrita** (o Nível 2 proíbe
lista numerada). Os 17 títulos "faltantes" são os Anexos A–F, material de
revisão que o próprio documento manda excluir na publicação.

## 1.2 Regra a regra

| Fonte | Regra atual | Efeito esperado | Compatível? | Que comportamento pode produzir | Recomendação |
|---|---|---|---|---|---|
| Core v11 §8 | pergunte só o que muda a orientação; uma por vez | pergunta de alto valor | **SIM** | — | manter |
| Core v11 §9 | "se já se sabe… não pergunte de novo" | continuidade | **PARCIAL** | o modelo não recebe *o que* se sabe de forma verificável — só prosa | dar forma consultável |
| Core v11 §10 | personalize sem anunciar; não invente | personalização percebida | **PARCIAL** | sem data no retrato, fato antigo vira fato de hoje | datar o retrato |
| Core v11 §16 | "você **NÃO** cria, salva, registra nem atualiza nada"; "nunca prometa entregar um artefato" | não mentir sobre atos | **CONFLITO** | Ayla nega capacidade que o sistema tem | reescrever como regra de verdade, não de incapacidade |
| Core v11 §16 | "não despeje PDF sem pedido" | não empurrar material | **SIM** | — | manter |
| Core v11 §20 | checklist: "o que eu já sei?" | evita repergunta | **PARCIAL** | mesma lacuna do §9 | idem |
| agência §49 | só diga que registrou **se uma ferramenta executou** | verdade condicional | **SIM** | — | **é esta a formulação correta**; o Core a endureceu demais |
| agência §52/§53 | ofereça pela necessidade; "se quiser, eu organizo" | oferta natural | **SIM** | — | manter |
| Trial v5 | "a necessidade de agora vence sempre" | não vira roteiro | **SIM** | — | manter |
| Trial v5 | "evidência é só o que aconteceu" | não inventa progresso | **SIM** | — | manter |
| Trial v5 | fechamento invertido (5 passos) | conversão após valor | **SIM** | — | manter |
| `jornada.ts` | precedência da necessidade é a **1ª linha** do bloco | protege a conversa | **SIM** | — | manter |
| `jornada.ts` | `INTENCAO_DO_DIA[2]` = "ampliar para outro tema" | amplia repertório | **PARCIAL** | pode sugerir troca de assunto sobre assunto vivo | condicionar a "assunto encerrado" |
| `jornada.ts` | `intencaoDoDia()` comprime a etapa 3 em teste de 7 dias | cabe no prazo | **PARCIAL** (deliberado) | "demonstrar continuidade" nunca dispara sozinha | aceitar, já documentado |
| `experimental.ts:581` | `<o_que_ainda_nao_sei>` = lista de **campos vazios** | evita repergunta | **CONFLITO** | empurra a preencher cadastro — o interrogatório que §8 proíbe | trocar por lacunas que mudam conduta |
| `experimental-contexto.ts:305` | retrato renderiza `rótulo: texto` e **descarta `atualizado_em`** | economia de contexto | **CONFLITO** | **causa raiz do barco** | renderizar com data |
| `diretrizes.ts:121-123` | "você não executa ações… PROIBIDO 'vou gerar e te envio'" | não mentir | **PARCIAL** | correto como verdade, lido como incapacidade | alinhar à agência §49 |
| `diretrizes.ts:336-341` | "só 3 artefatos existem e **são os únicos que você pode prometer**"; Rotina "sai em PDF **E** com link, **sempre os dois**" | evita promessa vaga | **CONFLITO duplo** | contradiz Core §16 (proíbe prometer) e cartões V2 §15 (só link) | um dono só |
| `orchestrator.ts:3617` | `base2` só sob `noPiloto4A` | conhecimento profundo | **NÃO IMPLEMENTADA** | gate inalcançável no WhatsApp vivo → base2 morto | religar fora do piloto |
| `orchestrator.ts:2441` | menu de temas quando a entrada é vaga | ajuda quem não sabe pedir | **SIM** | — | manter |
| cinco portões (`pedidoExplicito`) | artefato só com pedido explícito | não sequestra conversa | **SIM** (0/100 na bancada) | — | manter |
| cartões V2 §13/§14 | "pode gerar" é comando; **geração real** | artefato acontece | **CONFLITO com Core §16** | hoje o Core manda negar | resolver na hierarquia |
| cartões V1 (banco, inativo) | — | — | **OBSOLETA** | nenhum | arquivar |
| `plano-v1.md` | documento de Plano | — | **F: parece ativo, não governa** | nenhum — `plano v1` está **inativo** no banco | arquivar ou ativar |
| `types.ts` | `engajamento_2dias` / `engajamento_5dias` | reengajar silêncio | **NÃO IMPLEMENTADA** | **0 disparos em 3.000 mensagens** (26/07→08/09) | decidir: religar ou remover |

---

# TABELA DE CONFLITOS

## C1 — ARTEFATO: o Core nega a capacidade que o sistema tem

| | |
|---|---|
| **Regra A** | Core v11 §16 — "Você **NÃO** cria, salva, registra nem atualiza nada por conta própria… **nunca** prometa entregar um artefato ('vou montar', 'vou gerar', 'vou te mandar')" |
| **Regra B** | cartões V2 §13/§14 — "'pode gerar' é **comando de execução**… não deve dizer que não consegue gerar… antes de dizer que está gerando, o processo real precisa ter sido iniciado" |
| **Regra C** | `diretrizes.ts:336` — a Rotina Visual é **um dos três artefatos que ela pode prometer** |
| **Comportamento atual** | depende de qual núcleo responde o turno. Na conversa (Core v11) ela nega; dentro do fluxo de Rotina (`nucleoConducao`) ela promete. O caso **Atibaia 08/09** é exatamente isto |
| **Comportamento desejado** | a Ayla nunca afirma um ato que não aconteceu, **e** executa quando o fluxo existe e foi autorizado |
| **Recomendação** | reescrever §16 na formulação **da própria agência (§49): condicional à execução**, não negadora de capacidade. "Só diga que criou se o sistema criou" no lugar de "você não cria". Isso resolve A×B×C de uma vez, sem inventar regra nova |
| **Documentos que mudam** | Core v11 §16 (reescrita); `diretrizes.ts:336-341` (alinhar); cartões V2 — nenhuma mudança, já está correto |

## C2 — TRÊS NÚCLEOS PARA UMA AYLA

| | |
|---|---|
| **Regra A** | `experimental.ts:1093` — `system: [core.conteudo, …]` → Core v11 |
| **Regra B** | `rotina-guiada.ts:1553` — `system: nucleoConducao() + CONTRATO_ROTINA` → núcleo Legacy de ~70k |
| **Comportamento atual** | a conversa sobre a Rotina é conduzida por **uma Ayla diferente** da que conduz a conversa. Dois documentos, duas éticas de artefato, dois tons |
| **Comportamento desejado** | uma Ayla em todo canal e em todo fluxo |
| **Recomendação** | `rotina-guiada` passa a compor `core.conteudo` + `CONTRATO_ROTINA`. Provar por bancada antes: o núcleo Legacy carrega proteções (a lista de artefatos, as fronteiras clínicas) que precisam continuar existindo em algum lugar |
| **Documentos que mudam** | nenhum — é **código** (categoria E) |

## C3 — O RETRATO CHEGA SEM DATA

| | |
|---|---|
| **Regra A** | Core v11 §10 / agência §19 — "nunca invente… memória, rotina, preferência" |
| **Regra B** | `experimental-contexto.ts:305` — o retrato renderiza `rótulo: texto`; `atualizado_em` é lido na linha 297, usado só para ordenar, e **descartado** |
| **Comportamento atual** | um fato datado de `categorias_extras.transicoes` chega indistinguível de um fato de hoje → **barco da Manu**, **Sudoku do Mario** |
| **Comportamento desejado** | o modelo distingue fato atual · preferência estável · informação histórica |
| **Recomendação** | renderizar `rótulo (dd/mm): texto`. Custo: ~8 caracteres por domínio. É a correção de maior retorno por linha de toda esta auditoria |
| **Documentos que mudam** | nenhum — é **código** |

## C4 — LACUNA ≠ CAMPO VAZIO

| | |
|---|---|
| **Regra A** | Core v11 §8 / agência §22 — "pergunte apenas se a resposta puder mudar a orientação"; §23 "não faça interrogatório" |
| **Regra B** | `experimental.ts:581` — `<o_que_ainda_nao_sei>` lista os campos não preenchidos: nome do responsável · data de nascimento · como a criança se comunica · interesses · desafios atuais |
| **Comportamento atual** | o modelo recebe uma lista de buracos de cadastro e, junto, a instrução de não interrogar. As duas competem — e a lista é mais concreta |
| **Comportamento desejado** | receber só a lacuna que muda a próxima orientação, **dado o assunto deste turno** |
| **Recomendação** | filtrar as lacunas pelo tema do turno antes de injetar, e rotular o bloco como "o que ainda não sei **e que mudaria minha orientação**" |
| **Documentos que mudam** | nenhum — é **código** |

## C5 — PDF: TRÊS REGRAS INCOMPATÍVEIS

| | |
|---|---|
| **Regra A** | `diretrizes.ts:339` — a Rotina "sai em PDF no WhatsApp **E** com link, **sempre os dois**" |
| **Regra B** | Core v11 §16 / agência §50 — "não despeje PDF… sem pedido" |
| **Regra C** | cartões V2 §15 — "o WhatsApp entrega **link**, não precisa entregar PDF" |
| **Comportamento atual** | governado por A dentro do fluxo de Rotina |
| **Comportamento desejado** | link por padrão; PDF só a pedido |
| **Recomendação** | adotar C; corrigir A |
| **Documentos que mudam** | `diretrizes.ts:339` |

## C6 — CONHECIMENTO PROFUNDO DESLIGADO

| | |
|---|---|
| **Regra A** | Core v11 §19 "O REPERTÓRIO DA KOLO" pressupõe acervo disponível |
| **Regra B** | `orchestrator.ts:3617` — `base2` só entra sob `noPiloto4A`, gate **inalcançável** no WhatsApp vivo (provado no mapa) |
| **Comportamento atual** | o caminho vivo recebe `recuperarBoasPraticas(limite: 2)`; **base2 não chega nunca** |
| **Comportamento desejado** | conhecimento aumenta a qualidade do raciocínio, sem virar texto nem questionário |
| **Recomendação** | religar base2 no caminho vivo com o mesmo enquadramento do Legacy (`<como_compreender_este_tema>`: material **interno**, no máximo UMA pergunta) |
| **Documentos que mudam** | nenhum — é **código** |

## C7 — INICIATIVA ESPONTÂNEA (o conflito que **não** existe)

Auditei e **não confirmei** o risco. Prova:

- não existe cadência D1–D7. Só `trial_d0` (20) e `trial_d3` (27) em 3.000
  mensagens (26/07→08/09). A jornada é **bloco de contexto** em turno reativo,
  não mensagem espontânea;
- `blocoDaJornada()` põe a precedência da necessidade **na primeira linha**,
  antes da intenção do dia;
- `JANELA_CONVERSA_ATIVA_MS = 30 min` silencia proativa em conversa viva;
- `fechamentoReativoRecente()` cala a proativa por 20h depois de um fechamento
  reativo;
- `engajamento_2dias` / `engajamento_5dias`: **0 disparos** no período.

**Único resíduo:** `INTENCAO_DO_DIA[2]` ("ampliar para outro tema") pode sugerir
troca de assunto. Mitigado pela precedência, não eliminado.

## C8 — TRIAL × LONGITUDINAL (também **não** confirmado)

O Trial v5 não contém nenhuma instrução "pergunte X". É explícito no oposto:
*"Se a família já trouxe um problema, atenda o problema primeiro e colete depois,
só o necessário"*, e *"nada disso é roteiro"*. O Trial **não** pode perguntar algo
já respondido — quem pode é o `<o_que_ainda_nao_sei>` (C4), que é do caminho
vivo, não do Trial.

---

# TABELA — EXPERIÊNCIA DA AGÊNCIA × TRIAL ATUAL

| # | Objetivo | Trial atual | Prova |
|---|---|---|---|
| 1 | mãe pode começar com relato pobre | **FAVORECE** | "atenda o problema primeiro e colete depois"; menu de temas em entrada vaga (`orchestrator.ts:2441`) |
| 2 | Ayla ajuda a contextualizar | **FAVORECE** | Core §24 (alternativas reconhecíveis); Trial "quanto menos ela fala, mais direção" |
| 3 | uma pergunta importante por vez | **FAVORECE** | Trial: "uma pergunta de cada vez. Nada de formulário" |
| 4 | não pergunta o que já sabe | **IMPEDIDO** | não pelo Trial — por `<o_que_ainda_nao_sei>` (C4) e pela ausência de interface consultável (Core §9) |
| 5 | define/acompanha uma dor real | **FAVORECE** | `INTENCAO_DO_DIA[1]`; `plano_seguimento` (58) e `rotina_seguimento` existem |
| 6 | personaliza com fatos verdadeiros | **IMPEDIDO** | retrato sem data (C3) — não dá para saber se o fato é atual |
| 7 | orienta antes de coletar por coletar | **FAVORECE** | Trial: "uma conversa que só coleta não entrega valor nenhum" |
| 8 | aprofundamento progressivo N1→N2→N3 | **FAVORECE** | Core §4; produção é mais estrita que o candidato (N2 em prosa) |
| 9 | família testa algo | **FAVORECE** | `INTENCAO_DO_DIA[1]`, entrega prática |
| 10 | Ayla pergunta/descobre resultado | **PARCIAL** | `plano_seguimento` e `rotina_seguimento` existem; a etapa 3 ("retomar") é **comprimida** em teste de 7 dias |
| 11 | aprendizado é registrado | **FAVORECE** | `eventos_membro` só é escrito do que a família contou |
| 12 | aprendizado é reutilizado | **IMPEDIDO** | é lido (`lerEventos`) e vira prosa sem data — C3 + C4 |
| 13 | artefato aparece quando resolve necessidade | **IMPEDIDO** | C1 — o Core manda negar |
| 14 | D1–D7 não interrompe assunto importante | **FAVORECE** | precedência na 1ª linha; janela de 30 min; C7 |
| 15 | D1–D7 não repete pergunta | **PARCIAL** | nada no Trial repete; o risco vem de C4 |
| 16 | conversão depois de valor percebido | **FAVORECE** | fechamento invertido, 5 passos, "quem fala primeiro é ela" |

**Leitura:** o Trial **não é o obstáculo**. Dos 4 objetivos impedidos, nenhum é
causado pelo Trial. Três causas explicam os quatro: **retrato sem data (C3)**,
**lacuna como campo vazio (C4)** e **Core §16 (C1)**.

---

# FASE 2 — HIERARQUIA CANÔNICA PROPOSTA

```
1.  SEGURANÇA
2.  NECESSIDADE DE AGORA da família
3.  FATOS ATUAIS + correção da família        (a correção vence a inferência)
4.  PERFIL DATADO                             (histórico nunca vira presente)
5.  CONTINUIDADE                              (não repergunte o que já se sabe)
6.  LACUNA QUE MUDA CONDUTA                   (e só ela)
7.  CONHECIMENTO                              (raciocínio, não texto)
8.  ORIENTAÇÃO                                (N1 → N2 → N3, conforme interesse)
9.  ARTEFATO                                  (quando resolve, com pedido, e real)
10. JORNADA DO TRIAL
11. CONVERSÃO
```

Regras de arbitragem que decorrem dela:

- **um documento de artefato não governa conversa comum** — cartões V2 só manda
  dentro do fluxo de Rotina;
- **histórico não vence informação atual** — nível 4 abaixo do 3;
- **o Trial não vence necessidade real** — nível 10 abaixo do 2, que é
  exatamente o que `blocoDaJornada()` já faz na primeira linha;
- **pós/base2 não vence segurança** — nível 7 abaixo do 1;
- **um dono por decisão** — hoje "posso gerar?" tem três donos (C1).

---

# FASE 3 — O QUE PRECISA MUDAR

| Fonte | Manter | Alterar | Retirar | Externalizar | Motivo |
|---|---|---|---|---|---|
| Core v11 §1–§15, §17–§21 | ✔ | | | | é o documento da agência, verbatim |
| Core v11 §16 | | ✔ | | | negar capacidade ≠ não mentir (C1) |
| Trial v5 | ✔ | | | | nenhum conflito encontrado |
| `jornada.ts` precedência | ✔ | | | | protege a conversa |
| `jornada.ts` `INTENCAO_DO_DIA[2]` | | ✔ | | | condicionar a assunto encerrado |
| `experimental-contexto.ts` retrato | | ✔ | | | renderizar a data (C3) |
| `experimental.ts` `<o_que_ainda_nao_sei>` | | ✔ | | | filtrar por conduta (C4) |
| `rotina-guiada.ts` system | | ✔ | | | usar Core v11, não `nucleoConducao()` (C2) |
| `diretrizes.ts:336-341` | | ✔ | | | "sempre PDF" contradiz V2 e Core (C5) |
| `orchestrator.ts` base2 | | ✔ | | | religar fora do gate 4A (C6) |
| `AYLA_EXPERIMENTAL_PROMPT` | ✔ (fallback) | | | | é rede de segurança, não regra viva |
| cartões v1 (banco) | | | ✔ | | superado por V2 |
| `plano-v1.md` | | | | ✔ | inativo no banco; decidir se vira spec |
| `engajamento_2dias/5dias` | | | ✔ | | 0 disparos em 3.000 mensagens |
| `prompt-mestre-agencia-v1.md` | ✔ | | | | genealogia; não injetar |

### A. Regras já corretas

Core v11 §1–§15 e §17–§21 · Trial v5 inteiro · precedência da jornada ·
fechamento invertido · cinco portões de `pedidoExplicito` · menu de entrada
vaga · evidência-só-o-que-aconteceu · isolamento entre irmãos.

### B. Regras conflitantes

C1 (artefato) · C2 (três núcleos) · C5 (PDF).

### C. Regras obsoletas

cartões v1 no banco · `engajamento_2dias` / `engajamento_5dias` ·
`AYLA_EXPERIMENTAL_PROMPT` como fonte de comportamento — segue válido como
fallback.

### D. Regras ausentes

Nenhuma regra de produto ausente: o Core cobre o objetivo canônico inteiro.
Falta **mecanismo** — `sabemos(domínio, campo)` e data no retrato.

### E. Código que contradiz produto

`experimental-contexto.ts:305` (data descartada) ·
`experimental.ts:581` (lacuna = campo vazio) ·
`rotina-guiada.ts:1553` (núcleo divergente) ·
`diretrizes.ts:339` (PDF sempre) ·
`orchestrator.ts:3617` (base2 atrás de gate morto).

### F. Documentos que parecem ativos mas não governam runtime

`prompt-mestre-agencia-v1.md` · `prompt-mestre-kolo-v2*-CANDIDATO.md` ·
`cartoes-visuais-v1` e `cartoes-visuais-v2` (nenhum é injetado) · `plano-v1.md` ·
`core v1–v10` e `trial v1–v4` no banco · `docs/specs/rotina-visual.md`.

---

## Ordem sugerida (não executada)

1. **C3** — data no retrato. Menor mudança, maior retorno; desarma barco e Sudoku.
2. **C4** — lacuna que muda conduta.
3. **C1** — reescrita do §16 na formulação da agência.
4. **C2** — um núcleo só para a Rotina.
5. **C5** e **C6**.

Só depois disso a missão de reconexão continua — senão ela carrega as
contradições para dentro do código novo.
