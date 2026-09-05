# Auditoria — Prompt Mestre da agência × arquitetura real de produção

**Somente investigação.** Nada foi alterado: código, banco, prompts ativos,
feature flags e documentos de produção estão intactos. Levantado em 05/09/2026.

## Procedência do documento auditado

⚠️ **O Prompt Mestre NÃO está no repositório.** Procurei por nome de arquivo,
por PDF e por cinco trechos exclusivos (`"Prompt Mestre"`, `"Não entregue tudo
que você sabe"`, `"classifique silenciosamente a situação"`, `"Eu sou a Ayla da
Kolo Família"`, `"NÍVEL 3 — SITUAÇÃO SÉRIA"`) — **zero ocorrências**. Os únicos
acertos de uma busca ampla vinham da URL do vídeo-guia, que já existe no repo
por outro motivo.

Ele chegou **anexado à conversa**. Esta auditoria o cita a partir do anexo. Até
que o arquivo esteja versionado, **nenhuma conclusão daqui é conferível por
terceiros** — e isso é uma pendência de governança, não um detalhe.

## Estado de produção conferido hoje

`/api/health`, 05/09/2026: `ayla_experimental_todas: true`, `ayla_pos_trial:
true`, commit `d02dca9`, ambiente `production`.

---

# PARTE 1 — O que existe hoje, provado

## A ordem real do prompt

**VI NO CÓDIGO** — `lib/ayla/experimental.ts:1011`, array `system`:

| # | Bloco | Fonte | Sempre? |
|---|---|---|---|
| 1 | Core v9 | banco `ayla_documentos` | **sim** |
| 2 | contexto da família | `experimental-contexto.ts` | sim |
| 3 | `<jornada>` | `trial/jornada.ts` | só em Trial |
| 4 | documento Trial v5 | banco | só quando o bloco 3 entra |
| 5 | repertório (BPs) | `conhecimento/recuperar.ts` | só com skill roteada |
| 6 | pós-Trial | `trial/jornada.ts` | só pós-Trial |
| 7 | comercial | `billing/fatos-comerciais.ts` | só em pergunta comercial |
| 8 | **formato** | `conducao/formas.ts` | **sim** |
| 9 | instrução de fronteira | `conducao/fronteiras.ts` | só em regeneração |

Depois: `messages: [{role:"user", content: mensagem}]` — **só a mensagem atual**.
`maxTokens: 1200`. `cacheSystem: true`.

## O que NÃO existe (e o Prompt Mestre pressupõe)

**PROVEI POR EXECUÇÃO / VI NO CÓDIGO:**

| Pressuposto do Prompt Mestre | Realidade |
|---|---|
| A Ayla tem **ferramentas** (§49 "se uma ferramenta realmente executou") | **Não há tool use.** `grep "tools:\|tool_use\|toolChoice"` em `experimental.ts` e `provider.ts` → **zero**. É uma completion única |
| Base clínica disponível ao raciocínio | Só BPs, **máx. 2 por turno**, e **só com skill roteada** |
| Base2 como apoio de raciocínio | **Não chega ao caminho oficial.** Importada por `responder.ts` (Legacy, 2,6%), `ia/context.ts` e `ia/prompt.ts` (web). `grep base2 experimental.ts` → **vazio** |
| BIA/Compilado | Flag `BIA_PROMPT_ENABLED` desligada, `carregarBlocoBia` **não é chamado por ninguém**, e **`bia_chunks` tem 0 linhas em produção** |
| Material da pós | `docs/documentos-ayla/material-pos-v1-ORIGINAL.md` — 208 linhas, cabeçalho declara "NÃO ATIVA, NÃO IMPORTADA" |

**MEDI (produção, 05/09):** `boas_praticas` = 381 registros, **370 ativos**.
`bia_chunks` = **0**.

---

# PARTE 2 — Classificação regra a regra

Legenda: 🟦 **já existe** · 🟨 **existe diferente** · 🟩 **nova** · 🟥 **conflita**
· ⚙️ **depende de dado/ferramenta** · ⛔ **não executável hoje**

## Identidade e voz

| Regra | Classe | Evidência |
|---|---|---|
| §1 "Eu sou a Ayla **da Kolo Família**", nunca só "Ayla" | 🟩 **nova** | Core v9 abre com "Você é AYLA… do Kolo Família", mas **não há regra de apresentação**. Executável: é prompt puro |
| §29 tom (humana, calma, prática…) e o que evitar | 🟨 | Core §15 cobre parte ("textos enormes, interrogatórios, respostas genéricas, elogios artificiais, culpabilização"). **Novos:** sem tom de chatbot/SAC/vendedor, sem infantilização, sem jargão clínico |
| §30 conhecimento técnico por trás, linguagem simples | 🟦 | Core §7 + FORMATO ("Não dê moldura clínica que ela não pediu") |

## Tamanho, negrito e emojis

| Regra | Classe | Evidência |
|---|---|---|
| §8 **"1 a 3 frases" por padrão** | 🟨 | FORMATO já diz "A MENOR RESPOSTA QUE REALMENTE AJUDA VENCE" **e** "PROPORÇÃO COM O QUE FOI PEDIDO… pedido técnico pede o tamanho que o pedido exige — aí encurtar é errar". O número fixo é mais rígido que a regra atual |
| §9 **USO DE NEGRITO** (`**assim**`) | 🟨 **CORRIGIDO EM 05/09 — não é conflito de entrega** | ⚠️ **Esta linha dizia "CONFLITO DIRETO" e estava errada.** Existe um conversor determinístico, `paraWhatsApp` (`lib/ayla/apresentacao.ts`), chamado DENTRO de `enviarTexto` desde 15/08 (`247bb9b`, "a garantia de formatacao muda de lugar — passa a morar no funil"). **PROVEI POR EXECUÇÃO** com o texto literal do §9: `**abraço + frase curta + despedida**` sai como `*abraço + frase curta + despedida*`. O que sobra é contradição INTERNA do prompt (o bloco 8 manda não usar markdown; o §9 manda usar negrito) — custa tokens e confunde o modelo, mas **não chega quebrado à família**. Ver Etapa 4 |
| §10–11 emojis (💛 principal, 🌿 ocasional, 1️⃣2️⃣ em listas) | 🟩 **nova** | **Nem o Core v9 nem o FORMATO dizem uma palavra sobre emojis.** Lacuna real preenchida. Tensão leve: FORMATO proíbe "listas com - / •"; listas com emoji numérico não são a mesma coisa, mas convém explicitar |

## Progressão e perguntas

| Regra | Classe | Evidência |
|---|---|---|
| §4–6 progressão Nível 1 → 2 → passo a passo | 🟨 | Core v9 tem o ritmo ("compreender o suficiente → ajudar → aprofundar quando necessário") mas **não a escada de três degraus com gatilho explícito** ("como?" → nível 2). É a maior contribuição estrutural do documento. ⚠️ Existe um mecanismo antigo parecido em `conducao/angulos.ts`, mas ele é **Legacy** — não é importado por `experimental.ts` |
| §7 não criar suspense artificial | 🟩 | salvaguarda nova e coerente |
| §22 **"pergunte só se a resposta puder mudar a orientação"** | 🟦 **duplicata quase literal** | Core v9 §3 tem a seção com o mesmo nome e a **mesma pergunta silenciosa**: *"Se a resposta para esta informação fosse diferente, eu provavelmente orientaria de outro jeito?"* |
| §22 uma pergunta por vez | 🟦 **triplicata** | Core v9 §15 ("nunca faça muitas perguntas quando uma ou duas forem suficientes") **e** FORMATO ("No máximo UMA pergunta por vez") |
| §23 não interrogatório | 🟦 | Core §15 |
| §24 relato vago → alternativas numeradas | 🟦 **duplicata com o mesmo exemplo** | Core v9 §3 usa o mesmo caso ("fica muito agitado") com 6 opções; o Prompt Mestre usa 4 |
| §25 família responde pouco → ofereça direção | 🟦 | Core v9 (seção "quando a família não souber que ajuda pedir") **e** Trial v5 ("QUANDO A FAMÍLIA FALA POUCO") |

## Continuidade, memória e personalização

| Regra | Classe | Evidência |
|---|---|---|
| §20 continuidade, não repetir perguntas | 🟦 **duplicata** | Core v9 tem "CONTINUIDADE DA CONVERSA" e "NÃO RECOMECE A INVESTIGAÇÃO" |
| §21 correção da família prevalece | 🟦 **duplicata quase literal** | Core v9 tem seção com o **mesmo título** e exemplos equivalentes ("Não foi por causa do barulho", "Ela já fala frases", "Isso não acontece mais") |
| §18 personalização silenciosa ("não diga 'segundo seu perfil'") | 🟨 | Core v9 proíbe inventar, mas **não proíbe anunciar o uso do dado**. Acréscimo útil |
| §18 usar "estratégias já tentadas / o que funcionou / o que não funcionou" | ⚙️ **parcial** | Chega **em parte**, via `experimental-memoria.ts` (eventos), **não** como bloco próprio de estratégias |
| §18 usar "histórico recente" | ⚙️ | Chega — mas **como texto dentro do bloco 2**, não no array `messages`. O modelo lê a conversa narrada, não um diálogo |
| §18 usar "rotina" | ⚙️ **NÃO SEI** | Não confirmei se rotina/plano existentes chegam ao contexto |
| §19 nunca invente personalização | 🟦 **duplicata** | Core v9 §16 |

## Gravidade e segurança

| Regra | Classe | Evidência |
|---|---|---|
| §12–17 escala de gravidade 1/2/3, silenciosa | 🟩 **nova no prompt** | Core v9 não tem triagem por gravidade. ⚠️ **Não substitui a rede determinística**: `fronteiras.ts` inspeciona a resposta pronta, regenera uma vez e, se ainda vazar, entrega um **piso**. Mais `deteccao-clinica.ts`, `deteccao-diagnostico.ts`, `recuperacao-clinica.ts`. Essa rede continua necessária |
| §16 reclassificar durante a conversa | 🟩 | nova |
| §45 limites clínicos (não diagnostica, não prescreve…) | 🟨 **MENOS completo que o atual** | Core v9 §14 cobre saúde **e** uma seção inteira de **jurídico/previdenciário/BPC** que o Prompt Mestre **não tem**. Ver Pergunta 1 |
| §43 crise/desregulação | 🟩 | conteúdo novo |
| §44 mudança súbita → considerar dor/doença | 🟩 | conteúdo novo e clinicamente relevante |

## Artefatos, ferramentas e Kolo

| Regra | Classe | Evidência |
|---|---|---|
| §49 "nunca finja que registrou" | 🟦 **triplicata**, e ⛔ na premissa | Core v9 §16 ("nunca diga que criou, salvou ou gerou Plano ou Cartões se isso não aconteceu") + FORMATO ("Não prometa artefato"). **A premissa "se uma ferramenta executou" nunca se realiza: a Ayla não tem ferramentas** |
| §52 Plano — "Se quiser, **eu organizo** isso com você" | 🟥 **conflita** | FORMATO: *"Não prometa artefato: nada de 'vou montar', 'vou gerar', 'vou te mandar' quando não é você quem entrega."* O Plano nasce de um **decisor determinístico** (`ponte.ts` → `montarPlanoDoRelato`), não de uma decisão do modelo. O modelo não sabe se o decisor vai disparar |
| §53 Sequência Visual — "eu organizo essa sequência pra vocês" | 🟥 **conflita** | Mesma razão. FORMATO: *"ROTINA VISUAL e PLANO completo têm fluxo próprio… não é aqui que a rotina inteira da semana é montada"* (`rotina-guiada.ts`, 2.356 linhas) |
| §51 vídeo da Kolo (URL no texto) | 🟥 **conflita com o mecanismo** | O vídeo é campanha **proativa**, uma vez por família, disparada pelo cron `video_guia` com idempotência pelo próprio link já enviado (`jaRecebeuVideoGuia`). Autorizar o modelo a mandar a URL cria um **segundo caminho sem idempotência** |
| §50 não enviar material grande sem pedido | 🟨 | parcialmente coberto |
| §57 apresentação inicial | ⛔ **inócua no primeiro contato** | A primeira mensagem é **template**, não gerada pelo modelo (`templateBoasVindasComDesafio`). O modelo nunca escreve a apresentação de boas-vindas |

## Trial

| Regra | Classe | Evidência |
|---|---|---|
| §54 "não transforme em funil explícito" | 🟦 | Trial v5 diz o mesmo |
| §55 fechamento invertido em 5 passos | 🟦 **duplicata do método** | Trial v5 tem os **mesmos 5 passos, na mesma ordem**, com muito mais profundidade |
| §56 após assinatura, não reiniciar | 🟦 **duplicata** | Trial v5 ("DEPOIS QUE A FAMÍLIA ASSINA") e Core v9 |

## Conhecimento clínico (§31–44)

TEA, comunicação, apraxia, sensorial, comportamento, autonomia, alimentação,
alertas alimentares, sono, banheiro/desfralde, escola, socialização, crise,
mudança súbita.

🟩 **Tudo novo como conteúdo no prompt.** O Core v9 §7 **lista as áreas** de
raciocínio, mas não carrega conteúdo clínico. Este é o maior acréscimo em
volume — e o item que mais pesa nas perguntas 4 e 5.

---

# PARTE 3 — Respostas diretas

## 1. O Prompt Mestre pode substituir integralmente o Core v9?

**Não.** Cinco coisas do Core v9 **não têm equivalente** no documento novo e
sumiriam:

1. **Limites jurídicos, previdenciários e de benefícios** (Core §14) — a seção
   inteira sobre BPC, guarda, processos, com a distinção **INFORMAR × AVALIAR**
   e a frase-modelo. O Prompt Mestre cobre só limites de saúde.
2. **A instrução de coleta inicial estruturada** (Core §1–2) — os cinco dados e
   o "por qual deles você quer começar".
3. **Possíveis conflitos de necessidades** (Core §5) — autonomia × ajuda
   excessiva, previsibilidade × mudança, e as outras sete duplas.
4. **Regras de identidade entre irmãos e canais** (Core §16) — *"se nome,
   pronome ou idade indicar outra criança, não use os dados da cadastrada antes
   de esclarecer"*; *"informações de irmãos nunca devem ser salvas como fatos da
   criança acompanhada"*; *"WhatsApp e Web devem usar a mesma identidade"*.
   Isto é a face-prompt do isolamento entre irmãos (`membro-escopo.ts`).
5. **"Boas Práticas são repertório, não limite"** (Core v9) — a regra que
   permite combinar, adaptar e não copiar o acervo. Sem ela, o bloco 5 chega ao
   modelo sem instrução de uso.

Também some a menção a **Joe Dispenza** (Core §7) — registro, não julgo.

## 2. O que do Core v9 deveria sair, se o Prompt Mestre entrar?

Para evitar instrução duplicada — e lembrando que **duas fontes para a mesma
decisão sempre divergem**:

| Sai do Core | Porque o Prompt Mestre cobre |
|---|---|
| §3 "pergunte quando a resposta puder mudar a orientação" | §22, quase literal |
| §3 relato vago com alternativas | §24, mesmo exemplo |
| "CORREÇÃO DA FAMÍLIA PREVALECE" | §21, mesmo título |
| "CONTINUIDADE DA CONVERSA" / "NÃO RECOMECE A INVESTIGAÇÃO" | §20 |
| §13 desabafo | §46, quase literal |
| §15 estilo (parte) | §29 |
| "REGRA DE OURO" | §62 |

**Não sai:** os cinco itens da pergunta 1, mais §4 (hipóteses numeradas), §7
(base de raciocínio, incluindo TCC e TO) e §9 (comunicação) — que o Prompt
Mestre reorganiza mas não cobre igual.

**Também precisa sair do Prompt Mestre, ou reescrever:** §9 (negrito markdown) e
§52/§53 (promessa de artefato). Os dois conflitam com o bloco 8, que é
**sempre** injetado e nasceu de medição.

## 3. O Trial v5 deve continuar separado?

**Sim, e a separação atual está certa.**

**O que o Prompt Mestre trata genericamente:** que o Trial não vire funil (§54);
os 5 passos do fechamento invertido (§55); não reiniciar após assinar (§56).

**O que continua dependendo do Trial v5 + `jornada.ts`:**

- `INTENCAO_DO_DIA` — a intenção disponível em cada dia D0–D7
- `intencaoDoDia(dia, diasRestantes)` — **ancorada no fim** do teste, com a
  compressão da etapa 3 quando são 7 dias
- `DIAS_DE_FECHAMENTO = {4,5,6,7}` — quando a conversa **pode** ter função comercial
- `nivelDeEvidencia` (A/B/C) e a distinção **fato × relato × inferência**
- o tratamento de "família fala pouco" dentro do teste
- as regras de preço, link canônico `/precos` e o telefone de suporte
- `blocoPosTrial` e o que acontece se o teste terminar sem assinatura

Arquitetonicamente: o `<jornada>` é o **quando/o quê**, o Trial v5 é o **como**,
e o documento entra exatamente quando o bloco entra — um dono só para a decisão.
O Prompt Mestre não tem, e não deveria ter, um calendário próprio.

## 4. Como está o conhecimento clínico hoje

**Provado, não estimado:**

| Pergunta | Resposta |
|---|---|
| Quais BPs chegam | as de `boas_praticas` com `status=ativo` que casam por `skills_relacionadas` **ou** `tags`, ordenadas por `peso_relevancia` |
| Quando chegam | **só quando há skill roteada no turno**. Sem skill e sem tag, `recuperarBoasPraticas` retorna `[]` na primeira linha |
| Limite por turno | **2** (`limite: 2` em `experimental.ts`) |
| Acervo | **381 registros, 370 ativos** |
| Base da pós conectada? | **Não.** Arquivo de auditoria, cabeçalho declara "NÃO ATIVA, NÃO IMPORTADA" |
| BIA/Base2 ativa? | **Não.** BIA: flag off, `carregarBlocoBia` sem chamador, **`bia_chunks` = 0 linhas em produção**. Base2: existe e é usada pela **web** e pelo **Legacy**, mas **não** pelo caminho oficial do WhatsApp |

**Frequência:** um comentário em `experimental-contexto.ts` registra que
**`skills = []` em 55% dos turnos** (MEDIDO). Ou seja: **na maioria das
conversas, nenhuma Boa Prática chega ao modelo.**

### Se trocássemos Core v9 pelo Prompt Mestre sem mais nada

O conteúdo clínico disponível **aumentaria** — e essa é a mudança mais
substantiva do documento. Passaria a haver, em **todo** turno, conteúdo sobre
TEA, comunicação, apraxia, sensorial, análise de comportamento (antes →
comportamento → depois), autonomia, alimentação com alertas, sono, desfralde,
escola, socialização, crise e mudança súbita.

Hoje isso não existe em lugar nenhum do prompt oficial: o Core v9 **lista as
áreas** sem carregar o conteúdo, e as BPs chegam em 45% dos turnos, no máximo
duas.

**Contrapartida:** esse conteúdo entraria **em todos os turnos**, inclusive nos
que não têm nada a ver com o tema — que é exatamente a pergunta 5.

## 5. A base da pós — é possível recuperar por tema?

**Tecnicamente sim, e o mecanismo já existe.** `lib/conhecimento/recuperar.ts`
faz filtro estruturado em SQL + ranking lexical determinístico, sem embedding e
sem LLM. `lib/bia/pontuacao.ts` **diz por escrito** que copiou essa abordagem.
Adicionar um acervo é alimentar a mesma máquina.

**Mas a decisão não é técnica**, e a PEND-104 já registra por quê. Reproduzo os
achados medidos, sem julgá-los de novo:

- **A cobertura do Compilado não acompanha a demanda.** Regras SE→ENTÃO por
  núcleo: `autonomia` 70, `aprendizagem` 81 — e `regulacao_emocional` **0**,
  `foco_executivas` **0**, `rotina` **0**, `sono` **0**, `alimentacao` **0**.
  Cruzado com o que as famílias escrevem (499 turnos): emocional 102 pedidos / 0
  regras. **Spearman demanda × regras = 0,042.** O material da pós cobre
  exatamente esses buracos.
- **⚠️ Há um conflito clínico direto registrado.** A §3.B do material manda
  *"espere até 5 segundos pelo contato visual antes de entregar"* — o que
  contradiz o **princípio 17 do próprio documento** e contradiz uma conversa real
  de 17/08, em que a Ayla respondeu corretamente *"não é preciso obrigar"*.
  **Recuperar aquela seção naquele turno teria piorado a resposta.** Somam-se 3
  BPs que já prescrevem contato visual e aguardam correção.
- Outras marcações: a abertura promete *"precisão diagnóstica indireta"*,
  incompatível com o §14 do Core v9; série epidemiológica usada como argumento
  de urgência; "90% a 99%" sem fonte.

### Comparação das três opções (sem implementar)

| | Só BPs (hoje) | Pós por recuperação temática | BPs + pós temática |
|---|---|---|---|
| **Contexto/tokens** | baixo — máx. 2 BPs, e só em 45% dos turnos | baixo se recuperado; **alto se injetado inteiro** | o maior dos três, mas ainda proporcional ao turno |
| **Latência** | já embutida — `recuperarBoasPraticas` roda em `Promise.all` com o Core, não soma espera em série | mesma máquina, mesmo padrão → custo semelhante | uma consulta a mais no mesmo paralelo |
| **Cobertura clínica** | desigual; zero em emocional/foco/rotina/sono | cobre os buracos medidos | melhor cobertura possível hoje |
| **Risco de conflito** | conhecido (3 BPs com contato visual) | **alto se importado como está** — o conflito da §3.B é o caso concreto | acumula os dois riscos |
| **Bloqueio** | — | PEND-104 exige revisão por seção; PEND-106 (rastro do conhecimento não cobre o WhatsApp desde 17/08) significa **ligar às cegas** | idem |

Uma nota de arquitetura: **injetar a base inteira em todo turno é o oposto do
que o repositório já decidiu.** As BPs são recuperadas, não injetadas, e o teto
de 2 existe de propósito. O conteúdo clínico do Prompt Mestre (§31–44) seria
injeção permanente — vale saber que isso inverte o padrão vigente.

## 6. Mapa do prompt real depois da mudança

**Não adotei a ordem que você sugeriu.** Derivei da arquitetura, e três
restrições do código a determinam:

1. **O bloco 1 não pode variar** — `cache_control` casa por **prefixo**, e o
   comentário em `experimental.ts:1007` registra que o prefixo é `core.conteudo`.
   Identidade/condução tem de ser o primeiro bloco, estável entre turnos.
2. **O formato tem de ser o último** — `experimental.ts:825`: *"o documento core
   é escrito EM markdown… o modelo imita o que o próprio documento demonstra.
   Regra de formato colocada antes competiria com o exemplo; colocada por
   último, é a última coisa lida."* ⚠️ **Isto vale em dobro para o Prompt
   Mestre, que usa `**negrito**` nos exemplos.**
3. **A fronteira vem depois de tudo** — é correção de resposta já emitida.

```
1  IDENTIDADE + CONDUÇÃO          ← Prompt Mestre (revisado)   estável, cacheável
2  CONTEXTO DA FAMÍLIA            ← experimental-contexto.ts
3  MEMÓRIA / HISTÓRICO            ← (hoje dentro do bloco 2)
4  JORNADA DO TRIAL               ← jornada.ts        só em Trial
5  CONDUÇÃO DO TRIAL              ← Trial v5          amarrado ao 4
6  CONHECIMENTO RECUPERADO        ← BPs (+ pós, se um dia)
7  PÓS-TRIAL                      ← jornada.ts
8  COMERCIAL                      ← fatos-comerciais.ts
9  FORMATO E CANAL                ← formas.ts          SEMPRE, e por último
10 FRONTEIRA (regeneração)        ← fronteiras.ts      só quando vaza
```

**É a ordem que já existe.** O Prompt Mestre entra no lugar do bloco 1 — não
cria camada nova. Os blocos 3 e 4 poderiam se separar (memória saindo do bloco
2), mas isso é outra frente.

## 7. Regras do Prompt Mestre que podem piorar algo que hoje funciona

Sinalizo, não corrijo:

1. **§9 negrito em markdown — RETIFICADO EM 05/09.** O risco NÃO é a família
   ver asteriscos: `paraWhatsApp` converte `**` em `*` no funil de envio desde
   15/08, e isso foi provado por execução. Os 65,2% foram medidos em
   `ayla_messages.texto`, que guarda a saída do MODELO — não o que foi entregue.
   O que resta é uma contradição interna entre o §9 e o bloco 8. Ver Etapa 4.
2. **§52/§53 "eu organizo isso com você".** O modelo não decide se o artefato
   sai; quem decide é o decisor determinístico. Prometer é o defeito que a regra
   "não prometa artefato" veio corrigir.
3. **§51 vídeo.** Cria um segundo caminho de envio, sem a idempotência do cron.
4. **§8 "1 a 3 frases" como padrão.** Tensiona com "NUNCA corte o que decide: a
   orientação principal, a ressalva de segurança ou incerteza". Um piso de
   tamanho pode cortar a ressalva antes do enfeite.
5. **§26–27 CTA ao fim.** Core v9 diz *"não termine automaticamente com uma
   pergunta"*. O Prompt Mestre incentiva CTA na maioria das respostas — e um CTA
   é, quase sempre, uma pergunta.
6. **§31–44 conteúdo clínico em todo turno.** Aumenta o prompt de forma
   permanente e injeta tema clínico em conversas que não pediram — o oposto do
   padrão de recuperação vigente.
7. **§57 apresentação inicial.** Inócua (a boas-vindas é template), mas pode
   fazer o modelo se reapresentar no meio da relação.
8. **§45 mais curto que o Core §14.** Perder a seção jurídica/BPC é regressão de
   segurança, não de estilo.
9. **§18 "estratégias já tentadas / o que funcionou".** Mandar usar dado que
   chega só em parte tende a produzir invenção — exatamente o que §19 proíbe.

---

# As três listas

## MANTER

| Componente | Por quê |
|---|---|
| `formas.ts` — bloco 8 (formato/canal) | nasceu de medição; contém a proibição de markdown, "uma pergunta por vez" e "não prometa artefato" |
| `fronteiras.ts` + `fronteiras-forma.ts` | rede determinística na saída, com regeneração e piso. Nenhum prompt substitui |
| `deteccao-clinica.ts`, `deteccao-diagnostico.ts`, `recuperacao-*` | idem |
| **Core v9 §14 (jurídico/previdenciário)** | não tem equivalente no documento novo |
| **Core v9 §16 (irmãos, canais, identidade)** | face-prompt do isolamento entre irmãos |
| **Core v9 "BPs são repertório, não limite"** | sem ela o bloco 5 chega sem instrução de uso |
| Core v9 §1–2, §4, §5, §7, §9 | coleta inicial, hipóteses, conflitos de necessidade, base de raciocínio, comunicação |
| **Trial v5 + `jornada.ts`** | o Prompt Mestre trata o Trial só genericamente |
| `experimental-contexto.ts` e o bloco 2 | define o que o modelo enxerga |
| `recuperar.ts` + as 370 BPs ativas | único conhecimento conectado hoje |
| A ordem dos blocos (Core primeiro, formato por último) | cache por prefixo e imitação de exemplo |

## SUBSTITUIR

| O que o Prompt Mestre pode assumir | Observação |
|---|---|
| Core v9 §3 (perguntar quando muda a orientação; relato vago) | duplicata quase literal |
| Core v9 "correção da família prevalece" | mesmo título, mesmo conteúdo |
| Core v9 "continuidade" / "não recomece a investigação" | §20 |
| Core v9 §13 (desabafo) | §46 |
| Core v9 §15 (estilo), parte | §29 é mais específico |
| Core v9 "regra de ouro" | §62 |
| **Lacuna preenchida:** política de emojis | não existia em lugar nenhum |
| **Lacuna preenchida:** identidade "da Kolo Família" | não existia |
| **Lacuna preenchida:** progressão em 3 níveis com gatilho | o ritmo existia; a escada não |
| **Lacuna preenchida:** triagem de gravidade 1/2/3 | no prompt; **não** substitui a rede determinística |
| **Lacuna preenchida:** exemplos few-shot | o Core v9 não tem nenhum |

⚠️ Os itens acima valem **com §9, §52 e §53 reescritos**. Como estão, entram em
conflito com o bloco 8.

## INVESTIGAR / DECIDIR

1. **Onde o Prompt Mestre vai viver.** Não está no repositório. Enquanto for
   anexo de conversa, nenhuma conclusão é conferível — e o repo já foi mordido
   por isso (`trial-v4-VIGENTE.md` não é o vigente).
2. **Tamanho e custo.** **NÃO MEDI** o volume exato do Prompt Mestre. Pela
   extensão (23 páginas), **INFERI** porte comparável ou maior que o Core v9
   (21.395 caracteres). Precisa ser medido antes de decidir, porque ele é o
   bloco cacheado.
3. **§31–44 no prompt ou no acervo?** Se virarem chunks recuperáveis em vez de
   injeção permanente, seguem o padrão vigente. Decisão de produto.
4. **Material da pós — PEND-104 aberta.** Revisão por seção pendente; conflito
   da §3.B documentado; PEND-106 significa ligar sem rastro.
5. **BIA.** `bia_chunks` está **vazia em produção**. Mesmo ligando a flag, não
   há o que recuperar. **NÃO SEI** se os 1.120 chunks medidos em agosto vivem em
   outro ambiente.
6. **Base2 no caminho oficial.** Chega à web e ao Legacy, não ao WhatsApp
   oficial. **NÃO SEI** se a ausência foi decisão ou lacuna.
7. **Rotina e Plano existentes chegam ao contexto?** Não confirmei. §18 depende
   disso.
8. **CTA × "não termine com pergunta".** Conflito de doutrina a resolver por
   decisão, não por código.
9. **Ferramentas.** A Ayla não tem nenhuma. Se §49 deve continuar escrito como
   está, ou se a arquitetura deveria ganhar ferramentas, é decisão aberta.
10. **Web × WhatsApp.** A web (`lib/ia/prompt.ts`) tem outro montador, usa Base2
    e não recebe o bloco 8. **NÃO SEI** o que acontece com ela se o Core mudar —
    e os dois canais leem o mesmo documento `core`.

---

### Sobre esta auditoria

Somente leitura. Nenhum código, prompt, flag, documento de produção ou registro
de banco foi alterado. As afirmações marcadas **VI NO CÓDIGO**, **MEDI** e
**PROVEI POR EXECUÇÃO** têm caminho de arquivo ou consulta de produção citados;
as marcadas **INFERI** e **NÃO SEI** não devem ser tratadas como verificadas.
