# Auditoria do comportamento conversacional da Ayla

**Data:** 30/07/2026 · **Escopo:** como a Ayla conversa, o que ela sabe, o que guarda e por que o
antigo não morre. **Fora do escopo:** o decisor de entrega (gerar/perguntar/conversar), auditado e
reconstruído separadamente hoje mais cedo — aqui ele é tratado como já implementado.

**Nada de código foi alterado nesta auditoria.** Toda afirmação abaixo aponta arquivo e linha.
Onde não houve como provar (produção, banco), está marcado **HIPÓTESE**.

---

## ⚠️ STATUS DOS ACHADOS — leia antes do resto

> **Este documento é um DIAGNÓSTICO datado, não um retrato do código de hoje.**
>
> Em 31/07/2026 o achado nº 1 foi lido como pendente e quase reimplementado — quando já estava
> corrigido havia um dia. Um diagnóstico correto vira orientação errada assim que o código muda.
>
> **Regra para toda auditoria daqui em diante:** cada achado carrega *data do diagnóstico*,
> *estado atual* e *commit que resolveu*. Auditoria sem status caduca em silêncio.

| # | Achado (30/07/2026) | Estado | Commit |
|---|---|---|---|
| 1 | WhatsApp cego para 6 dos 20 domínios | ✅ **RESOLVIDO** | `8e871a3` (leitor único), `cf1a2e9` (resíduos), `#RODADA#` (classe encerrada) |
| 2 | Nada do que tem data chega à conversa | ✅ **RESOLVIDO** | `8e871a3` — `carregarEventosRecentes` e `carregarExperimentos` entram no prompt |
| 3 | Perfil é bolha de texto sem data, origem nem status | 🚧 **BLOQUEADO PELO GATE DE RESTORE** | Fact Store construído (`0073`/`0074`), NÃO aplicado; ver `docs/memoria/` |
| 4 | WhatsApp e web são duas Aylas com memórias diferentes | 🟡 **PARCIALMENTE RESOLVIDO** | Leitura unificada (`8e871a3`, `cf1a2e9`); a memória em si depende do achado 3 |
| 5 | Sem mecanismo de correção, encerramento ou reatribuição | 🚧 **BLOQUEADO PELO GATE DE RESTORE** | Revisão da quarentena existe (`362c2ef`), sem coleta ativa |

### Histórico do achado nº 1, em detalhe

1. **30/07/2026 — diagnóstico.** `carregarKoloVivoResumo` montava o perfil com duas listas
   escritas à mão (5 top-level + 9 extras = 14 de 20). Ficavam invisíveis `aprendizado`, `escola`,
   `saude_geral`, `imitacao`, `tela_midia` e `gostos`.
2. **30/07/2026 — correção principal (`8e871a3`).** Nasce `lib/kolo-vivo/leitura.ts`, leitor único
   sobre `MEMBRO_CAMPOS_TODOS`, usado pelos dois canais. **O texto do achado abaixo deixou de valer
   aqui**, e não foi reescrito — foi o que induziu ao erro de 31/07.
3. **31/07/2026 — resíduos (`cf1a2e9`).** A mesma falha sobrevivia em duas outras regras:
   as *lacunas* decidiam "já tem" com um `temConteudo` próprio (dizia "JÁ TEM: Escola" para um jsonb
   só com `atualizado_em`, enquanto o resumo omitia o domínio); e a *mensagem espontânea* tinha lista
   própria de 10 domínios, lia só `categorias_extras` (ignorando as 5 colunas dedicadas — `sensorial`
   nunca podia virar tema) e só `.texto` (ignorando o onboarding).
4. **31/07/2026 — classe encerrada (`#RODADA#`).** Catorze consumidores repetiam a lista de colunas.
   Dois deles eram cegos de verdade: **o relatório para escola/terapeuta** e **a ficha do CRM** nem
   carregavam `categorias_extras` — 5 de 20 domínios. Todos passaram a usar `PERFIL_MEMBRO_SELECT`.

---

## 0. Contexto do produto (para quem não conhece o app)

Necessário para ler o resto. Quem já conhece pode pular.

**Kolo Família** é um produto para famílias de pessoas neurodivergentes (TEA, TDAH, TDL, dislexia,
TAG, AH/SD). Tem dois canais, e a mesma assistente — **Ayla** — atende nos dois:

- **WhatsApp** (canal principal, onde as mães realmente estão). Webhook Z-API → processamento no
  servidor → resposta em vários balões.
- **Web / app** (Next.js). A área de conversa chama-se **Estratégias**.

**O que a Ayla pode entregar** — catálogo fechado, definido em
[diretrizes.ts:104-116](../apps/web/src/lib/conducao/diretrizes.ts#L104-L116). Só existem três
artefatos, e ela é proibida de prometer qualquer outro ("panorama", "dossiê", "apostila"):

1. **Plano estratégico com atividades** — para um desafio específico. Seções: crenças, o que fazer
   diferente, brincadeiras, atividades, frases prontas, e — quando o tema pede — rotina e história
   social. Gerado por multi-call (uma chamada por seção,
   [plano.ts:263-265](../apps/web/src/lib/ia/plano.ts#L263-L265)). Sai **em PDF pelo WhatsApp + link
   mágico** que abre o app já logado. Na web, sai por um **botão** "Montar plano completo" que
   aparece quando o modelo escreve um marcador invisível no fim da resposta
   ([prompt.ts:93](../apps/web/src/lib/ia/prompt.ts#L93)).
2. **Rotina visual** — a sequência do dia em cartões ilustrados, em PDF + link. No WhatsApp é um
   fluxo guiado próprio, disparado quando o classificador de intenção devolve `rotina_criar`
   ([orchestrator.ts:1470](../apps/web/src/lib/ayla/orchestrator.ts#L1470)).
3. **Relatório para escola/terapeuta** — descreve como a criança aprende, o que facilita e o que
   trava. **Só existe na web** (Evolução → Relatório); pelo WhatsApp a Ayla manda o link e diz que é
   por lá.

**O "Kolo Vivo"** é o perfil vivo da criança: 20 domínios (essencial, como é/interesses, sensorial,
comunicação, socialização, imitação, motor, autonomia, aprendizado, foco, sono, alimentação,
tela/mídia, escola, saúde geral, emocional, rotina, gostos, corpo/rotina e desafios — legados).
Lista canônica em [campos.ts:12-46](../apps/web/src/lib/kolo-vivo/campos.ts#L12-L46). Fisicamente:
5 colunas `jsonb` dedicadas em `perfil_vivo_membro` (legado) + as outras 15 dentro de
`categorias_extras`.

**Princípio de produto declarado:** a Ayla conduz a jornada da família — não é um respondedor de
perguntas. Acolhe brevemente, explica o que acontece no cérebro, dá direção prática, usa o perfil
para escolher a estratégia, e atualiza sua compreensão da criança ao longo do tempo.

---

## 1. Resumo executivo — os cinco problemas mais importantes

### #1 — A Ayla do WhatsApp está cega para 6 dos 20 domínios do perfil, e é informada de que os conhece

> ✅ **RESOLVIDO.** Diagnóstico de 30/07/2026; corrigido em `8e871a3`, resíduos em `cf1a2e9`,
> classe encerrada em `#RODADA#`. **O texto abaixo descreve o código de 30/07, não o de hoje.**

`carregarKoloVivoResumo` ([orchestrator.ts:2762-2807](../apps/web/src/lib/ayla/orchestrator.ts#L2762-L2807))
monta o bloco de perfil com uma lista **hardcoded** de 5 domínios top-level + 9 extras = **14**.
Ficam de fora: **`aprendizado`, `escola`, `saude_geral`, `imitacao`, `tela_midia`, `gostos`**.

O agravante: `carregarLacunasKoloVivo`
([orchestrator.ts:1047-1073](../apps/web/src/lib/ayla/orchestrator.ts#L1047-L1073)) varre
`MEMBRO_CAMPOS_TODOS` — os **20** — e injeta no prompt a frase *"JÁ TEM no perfil: …, Aprendizado,
Escola, Gostos e interesses…"*, com a instrução *"pergunte só o pertinente (não re-pergunte o que já
tem)"*.

Resultado combinado: a Ayla é informada de que já sabe sobre aprendizado, escola e gostos — e é
instruída a não perguntar — mas o conteúdo desses domínios **nunca entra no prompt**. Ela não sabe
e não pergunta.

Isto atinge em cheio o caso que originou a auditoria: "a criança não liga os pontos" é
literalmente o domínio `aprendizado`, e "a escola não dá suporte" é `escola`.

### #2 — Nada do que tem data chega à conversa

> ✅ **RESOLVIDO** em `8e871a3`: eventos datados e experimentos passaram a entrar no prompt.


Três estruturas guardam informação **com data**, e nenhuma delas é lida na hora de responder:

| Estrutura | Tem data? | Quem escreve | Quem lê |
|---|---|---|---|
| `eventos_membro` (linha do tempo: troca de professora, férias, medicação, marcos) | sim, `data` + `fonte` | Ayla, em `after()` ([eventos.ts:107](../apps/web/src/lib/ayla/eventos.ts#L107)) | **só o relatório** ([relatorio/gerar.ts:218](../apps/web/src/lib/relatorio/gerar.ts#L218)) |
| `categorias_extras.preferencias.experimentos` (estratégias tentadas + resultado) | sim, `{item, resultado, data}` | Ayla ([orchestrator.ts:2397](../apps/web/src/lib/ayla/orchestrator.ts#L2397)) | **só o cron semanal de repertório** |
| `categorias_extras.conflitos` (contradições detectadas) | sim, `data` + `status` | Ayla ([orchestrator.ts:2372](../apps/web/src/lib/ayla/orchestrator.ts#L2372)) | **só a tela Kolo Vivo** ([membro-editor.tsx:176](../apps/web/src/app/(app)/kolo-vivo/membro-editor.tsx#L176)) |

O que **de fato** chega à conversa é o perfil — que é **texto corrido sem data nenhuma**. Ver #3.

### #3 — O perfil é uma bolha de texto sem data, sem origem e sem status

> 🚧 **BLOQUEADO PELO GATE DE RESTORE.** O Fact Store existe (migrações `0073`/`0074`, revisão em
> `362c2ef`) mas NÃO foi aplicado em produção. Diagnóstico de 30/07/2026 segue válido.


Cada domínio é um `jsonb` com uma string: `{ texto: "..." }`. A escrita é `appendFato`
([orchestrator.ts:2454-2459](../apps/web/src/lib/ayla/orchestrator.ts#L2454-L2459)) — concatena com
`\n`. Não existe campo de data, de proveniência (quem disse, quando), de confiança, de validade nem
de status.

Consequência direta e comprovável: **um fato escrito uma vez é enviado ao modelo em toda resposta,
para sempre, indistinguível de um fato de ontem.** É essa a causa mecânica de "Copa", viagens
antigas e interesses que já passaram continuarem aparecendo. Não é o modelo alucinando — é o
contexto afirmando.

(Existe um redesenho completo já decidido para isso — fatos datados com proveniência e visão
derivada, padrão FHIR — desenhado em `docs/` e **não construído**.)

### #4 — WhatsApp e web são duas Aylas com a mesma cabeça e memórias diferentes

> 🟡 **PARCIALMENTE RESOLVIDO.** A LEITURA é a mesma nos dois canais desde `8e871a3`/`cf1a2e9`.
> A memória compartilhada depende do achado nº 3.


O **Core** (identidade, princípios, sequência, piso, tom) é genuinamente compartilhado:
`nucleoConducao()` em [diretrizes.ts:126](../apps/web/src/lib/conducao/diretrizes.ts#L126), importado
pelos dois ([responder.ts:197](../apps/web/src/lib/ayla/responder.ts#L197) e
[prompt.ts:105](../apps/web/src/lib/ia/prompt.ts#L105)). Isso está certo e deve ser preservado.

Mas **tudo em volta diverge**: contexto carregado, classificador de intenção, critério de entrega,
validadores e — o mais grave — **o que cada canal aprende da conversa**. Detalhe na seção 8.

O item mais assimétrico: **a web não aprende nada sozinha.** No WhatsApp a incorporação ao perfil é
automática ([orchestrator.ts:2194-2202](../apps/web/src/lib/ayla/orchestrator.ts#L2194-L2202)). Na
web, só se a pessoa clicar em "Guardar no Perfil" → `proporAtualizacao` → preview →
`confirmarAtualizacao` ([conversar/actions.ts:434 e 549](../apps/web/src/app/(app)/conversar/actions.ts#L434)).
A rota de streaming ([api/conversar/stream/route.ts](../apps/web/src/app/api/conversar/stream/route.ts))
grava a mensagem e **nada mais** — sem extração de fatos, sem eventos, sem marcos.

### #5 — Não existe mecanismo de correção, encerramento ou reatribuição

> 🚧 **BLOQUEADO PELO GATE DE RESTORE.** A revisão da quarentena existe (`362c2ef`), mas sem
> coleta ativa não há o que corrigir. Diagnóstico de 30/07/2026 segue válido.


- **"isso mudou / não é mais assim"** → há *instrução de prompt* para atualizar
  ([diretrizes.ts:86](../apps/web/src/lib/conducao/diretrizes.ts#L86)) e há *lógica de reescrita* no
  dedup ([dedup-kolo-vivo.ts:32](../apps/web/src/lib/ayla/dedup-kolo-vivo.ts#L32)) — mas **só
  disparam se o parser tiver marcado `sugestao_kolo_vivo` naquela mensagem**. "Aquela viagem já
  acabou" dificilmente vira uma sugestão de perfil, então nada é reescrito.
- **"já passou / acabou"** → não existe encerramento. Grep por `encerrad|status.*ativo|validade`
  nos domínios do perfil: nenhum resultado.
- **"eu estava falando da outra criança"** → o nome citado corrige o foco *da mensagem atual*
  ([orchestrator.ts:1576](../apps/web/src/lib/ayla/orchestrator.ts#L1576)), mas **nada reatribui um
  fato já gravado na criança errada**. Uma vez escrito no irmão, fica no irmão.

---

## 2. Fluxo atual do WhatsApp

Arquivo de entrada: [api/ayla/webhook/route.ts](../apps/web/src/app/api/ayla/webhook/route.ts) →
`after(processInbound)` em [orchestrator.ts](../apps/web/src/lib/ayla/orchestrator.ts).

```
mensagem da mãe (Z-API)
→ identificação da família        por whatsapp_e164  ⚠️ campo NÃO é único (pendência conhecida)
→ persistência + idempotência     upsert por zaap_message_id            orchestrator.ts:1198-1216
→ comando? (PAUSAR/SAIR)          detectarComando — não espera silêncio  :1225
→ CONTROLE DE TURNO               aguardarTurnoDaMae — 7s + claim atômico :1238
                                  ⚠️ depende da migração 0070 (ver §12)
→ gate de assinatura              aylaServicoLiberado                     :1290
→ handlers de estado              oferta de fim de semana, acesso ao app,
                                  criança pendente                        :1315-1398
→ classificação de intenção       classificarIntencao (Haiku)             :1406
                                  taxonomia: rotina_criar | rotina_ver |
                                  rotina_editar | plano | outro
→ criança da conversa             criancaDaConversa — última msg com
                                  membro nas últimas 2h                   :1021
→ rotas de rotina visual          :1415 / :1441 / :1470
→ parser IA (Haiku + fallback)    parser.ts — extrai conquista, desafio,
                                  emoção, gatilho, sugestão de perfil
→ CARREGAMENTO DE CONTEXTO        Promise.all                             :1646-1670
     · koloVivoResumo             14 de 20 domínios       ⚠️ #1
     · koloVivoLacunas            20 de 20 (só os nomes)  ⚠️ #1
     · estrategiasRecentes        títulos das 3 últimas conversas da web
     · historico                  6 últimos turnos, DA FAMÍLIA INTEIRA
                                  (sem filtro por criança)  ⚠️
     · 5 magic links do Lúdico    só se a pessoa em foco tem ≤12 anos
→ DECISOR DE ENTREGA              decidirEntrega (Haiku)   ← novo, hoje
→ montagem do prompt              nucleoConducao() + FORMATO_WHATSAPP +
                                  DIRETRIZ_IDIOMA          responder.ts:197
→ resposta                        Sonnet 4.6, max_tokens 900, SEM thinking,
                                  streaming por parágrafo → 1 balão cada
→ ponte                           entrega do plano + PDF + link, se "gerar"
→ gravação                        ayla_messages (outbound) + ayla_send_log
→ pós-resposta (não bloqueia)     persistirRegistro: check-in diário,
                                  diário com dedup, experimento,
                                  AUTO-INCORPORAÇÃO no Kolo Vivo,
                                  detecção de conflito cross-campo
→ eventos                         extrairESalvarEventos → eventos_membro
                                  (write-only ⚠️ #2)
```

**Fallback:** 1 retentativa curta, depois `fallbackSimples` + `logServerError`.
**Validadores de tom/conteúdo: NÃO EXISTEM neste canal.**

## 3. Fluxo atual da web (Estratégias)

Entrada: [conversar/actions.ts](../apps/web/src/app/(app)/conversar/actions.ts) +
[api/conversar/stream/route.ts](../apps/web/src/app/api/conversar/stream/route.ts).
Orquestrador: [lib/ia/engine.ts](../apps/web/src/lib/ia/engine.ts).

```
mensagem na caixa
→ família                         resolveFamily (sessão autenticada)
→ criança                         conversa.membro_atipico_id — FIXA na conversa
                                  (escolhida ao criar; não muda no meio)
→ gate de assinatura              requireActiveWrite
→ router de skills                routeSkillsAI (Haiku) — escolhe até 2 das
                                  skills ATIVAS DO BANCO           router.ts
→ classificação de intenção       classificarIntencao — OUTRA taxonomia:
                                  crise | desabafo | duvida | desafio
                                                              ia/intencao.ts
→ buildContext                    ia/context.ts:112
     · perfil da criança          ⚠️ SÓ os domínios que as skills roteadas
                                  declararam em kolo_vivo_fields + essencial
                                  (context.ts:124-133) — o perfil visível
                                  MUDA conforme o roteador
     · elenco da família          todos os membros, com idade e perfil
     · perfil da família          composição, rotina, recursos, dinâmica
     · diários (7 dias, máx 5)    ← WhatsApp NÃO tem
     · último check-in emocional  ← WhatsApp NÃO tem
     · top-3 boas práticas        ← WhatsApp NÃO tem
     · histórico                  6 mensagens DESTA conversa (isolada)
→ montagem do prompt              nucleoConducao() + skills do banco +
                                  VOZ_E_LIMITES + blocoIntencao +
                                  formato web + tamanho          prompt.ts:105
→ resposta                        Sonnet 4.6, max_tokens 2048
                                  streaming: thinking DESLIGADO
                                  não-streaming: thinking 1024 tokens
→ validadores                     tom (regex) → estrutural → validador IA
                                  ⚠️ SÓ no caminho respond(), que a rota de
                                  streaming NÃO usa
→ gravação                        mensagens_skill
→ aprendizado                     ⚠️ NENHUM automático. Só se a pessoa
                                  clicar em "Guardar no Perfil"
→ entregáveis                     plano por BOTÃO (marcador no texto);
                                  7 "output types" de apoio;
                                  relatório em outra tela
```

## 4. Voz e identidade

**O que está certo e deve ser preservado:** o Core é fonte única real. `nucleoConducao()` monta
identidade → princípios → regra de sequência → exemplos → mapa funcional → piso → catálogo → tom, e
os dois canais o importam. A identidade saiu do banco (não há mais `voz_ayla` no seed:
[seed-prompts-data.ts](../apps/web/src/lib/ai/seed-prompts-data.ts) tem 6 chaves, nenhuma de voz).

**Conflitos e duplicações encontrados:**

| # | Achado | Evidência |
|---|---|---|
| V1 | **`VOZ_E_LIMITES` é um segundo bloco de voz, só na web**, anterior ao Core e nunca reconciliado. Repete o que o Core já diz (hipótese≠causa, anti-ABA, materiais seguros, não inventar dono de fato) e acrescenta um tom próprio: *"amiga experiente, não terapeuta"*. O Core diz "consultora estratégica que recomenda com convicção". São direções diferentes. | [prompt.ts:39-60](../apps/web/src/lib/ia/prompt.ts#L39-L60) |
| V2 | **Identidade parcial no banco:** cada skill tem `tone`, `objective`, `scope`, `limits`, editáveis, e entram no system prompt da web. São 14 skills (7 ativas). O WhatsApp não as usa. Logo, um mesmo pedido produz vozes diferentes por canal — e a voz da web muda conforme qual skill o roteador escolheu. | [router.ts:7-20](../apps/web/src/lib/ia/router.ts#L7-L20), [prompt.ts:23-33](../apps/web/src/lib/ia/prompt.ts#L23-L33) |
| V3 | **Duas taxonomias de intenção que não se falam.** Web: crise/desabafo/dúvida/desafio. WhatsApp: rotina_criar/rotina_ver/rotina_editar/plano/outro. Não há tradução entre elas. | [ia/intencao.ts:14](../apps/web/src/lib/ia/intencao.ts#L14) × [ayla/intent.ts:11](../apps/web/src/lib/ayla/intent.ts#L11) |
| V4 | **`blocoIntencao("desabafo")` contradiz o Core.** Diz *"Ela quer ser ouvida, não necessariamente resolvida… Não force uma ideia prática"* e manda terminar perguntando. O Core diz o oposto: acolher é começo breve, o prato principal é compreensão e direção, e "sofrimento não anula pedido" (regra do novo decisor). No caso 2 desta auditoria, este bloco é o que faria a web só acolher. | [prompt.ts:78-82](../apps/web/src/lib/ia/prompt.ts#L78-L82) |
| V5 | **`blocoIntencao("desafio")` tem um critério de entrega próprio**, escrito em prosa ("assim que tiver contexto suficiente… FECHE assim"), completamente independente do decisor por pontuação que agora rege o WhatsApp. | [prompt.ts:87-94](../apps/web/src/lib/ia/prompt.ts#L87-L94) |
| V6 | **Instrução de "não termine sempre com pergunta" existe em três lugares** com formulações diferentes (Core/TOM, `blocoIntencao`, `FORMATO_WHATSAPP`) — e, empiricamente, não bastou: a conversa auditada terminou em pergunta em 100% dos turnos. Só o fechador determinístico resolveu. | [diretrizes.ts:120](../apps/web/src/lib/conducao/diretrizes.ts#L120) |
| V7 | **6 prompts ainda são editáveis no banco** com fallback no código: `parser_ayla`, `relatorio_narrativa`, `skill_suggestion`, `validador_ai`, `extract_boas_praticas`, `repertorio_ayla`. Não é identidade, mas `parser_ayla` decide o que vira memória — uma edição ruim ali corrompe o perfil silenciosamente. | [seed-prompts-data.ts](../apps/web/src/lib/ai/seed-prompts-data.ts) |

**Separação pedida (identidade × regras × critérios × canal × contexto × memória × turno) — como está hoje:**

| Camada | Onde vive | Compartilhada? |
|---|---|---|
| Identidade da Ayla | `diretrizes.ts` → `IDENTIDADE_NORTE`, `PRINCIPIOS` | ✅ sim |
| Regras permanentes (piso, catálogo) | `diretrizes.ts` → `PISO`, `CATALOGO` | ✅ sim |
| Critérios de decisão | ❌ **espalhados**: `prontidao-plano.ts` (WhatsApp), `blocoIntencao` (web), `REGRA_SEQUENCIA` (prosa, ambos) | ❌ não |
| Regras de canal | `FORMATO_WHATSAPP` × "Como responder (formato da web)" | correto |
| Contexto da criança | `carregarKoloVivoResumo` × `buildContext` | ❌ não |
| Memória da família | ❌ **não existe como camada** — é o mesmo blob de perfil | ❌ não |
| Instrução do turno | `notas[]` em `responder.ts` × `blocoIntencao` | ❌ não |

## 5. Memória — o que é lido, o que é salvo, o que não é salvo

**Legenda:** WA = WhatsApp · WEB = app.

| Categoria | Onde grava | Quem grava | Tem data? | Origem? | Confiança? | Encerrável? | Lida na conversa? |
|---|---|---|---|---|---|---|---|
| Dados da criança (nome, nascimento, gênero, perfil) | `membros_atipicos` | onboarding | criação | — | — | `ativo` | ✅ ambos |
| Dados do responsável | `family_profiles` | onboarding | — | — | — | — | ✅ ambos |
| Diagnóstico | `membros_atipicos.perfil` + KV `essencial` | onboarding/Ayla | ❌ | ❌ | ❌ | ❌ | ✅ ambos |
| Comunicação, socialização, motor, autonomia, foco, sono, alimentação, emocional, rotina | KV (9 domínios) | Ayla auto / web manual | ❌ | ❌ | ❌ | ❌ | ✅ ambos |
| Sensorial, essencial, como é, corpo/rotina, desafios | KV top-level | idem | ❌ | ❌ | ❌ | ❌ | ✅ ambos |
| **Aprendizado, escola, saúde, imitação, tela/mídia** | KV extras | Ayla auto | ❌ | ❌ | ❌ | ❌ | ❌ **WA cego** · WEB só se a skill pedir |
| **Gostos** | KV `gostos` | — | ❌ | ❌ | ❌ | ❌ | ❌ **nenhum canal lê** |
| Interesses | fragmentado: `como_e.interesses`, `gostos`, `preferencias.temas` | vários | ❌ | ❌ | ❌ | ❌ | parcial |
| **Estratégias tentadas + resultado** | `preferencias.experimentos` | Ayla | ✅ | ✅ | ❌ | ❌ | ❌ **só o cron semanal** |
| Gatilhos | `emocional` (sub-campo) | Ayla | ❌ | ❌ | ❌ | ❌ | ✅ WA |
| Conquista / desafio do dia | `diarios`, `ayla_daily_checkins` | Ayla + web | ✅ | ✅ `origem` | ✅ `confianca_parser` | ❌ | ❌ **WA não lê** · ✅ WEB (7 dias) |
| **Eventos temporários** (férias, troca de professora, mudança) | `eventos_membro` | Ayla | ✅ | ✅ | ❌ | ❌ | ❌ **só o relatório** |
| Marcos / evoluções / regressões | `eventos_membro` tipo `marco`/`regressao` | Ayla | ✅ | ✅ | ❌ | ❌ | ❌ idem |
| **Contradições detectadas** | `categorias_extras.conflitos` | Ayla | ✅ | — | — | `status` | ❌ **só a tela** |
| Objetivos da família | ❌ **não existe** | — | — | — | — | — | — |
| Hipóteses da Ayla | ❌ **não existe** — se viram fato, viram fato | — | — | — | — | — | — |
| Planos gerados | `planos` | ambos | ✅ | `origem` | — | — | ❌ (só o dedup) |
| Relatórios | `relatorios` | web | ✅ | — | — | — | ❌ |
| Resumo de conversa | `conversas.titulo` | web | ✅ | — | — | — | ✅ WA (só o título) |
| Memória livre | `observacao_livre` no check-in | Ayla | ✅ | — | — | — | ❌ |

**O que simplesmente não é salvo:** objetivos da família (ativos/concluídos/abandonados), o
resultado de um plano entregue, se a mãe usou o material, distinção entre "não sabemos" e "nunca
perguntamos", e qualquer marcação de hipótese × fato.

## 6. Temporalidade — por que Copa, viagens e temas antigos continuam aparecendo

Causa mecânica, em três camadas:

**(a) O perfil não tem tempo.** `{texto: "..."}` concatenado por `appendFato`. Sem data, um fato de
seis meses atrás e um de ontem entram no prompt com o mesmo peso, na mesma linha, sem marcador.

**(b) A camada que TEM tempo não é lida.** `eventos_membro` guarda "férias" com data e tipo — e
serve exclusivamente ao relatório. A Ayla que conversa nunca a vê. Ou seja: o sistema *sabe* que as
férias foram em janeiro e mesmo assim não consegue usar isso.

**(c) Não há encerramento nem contradição resolvida.** O dedup sabe reescrever quando o fato novo
supera o antigo ([dedup-kolo-vivo.ts:32](../apps/web/src/lib/ayla/dedup-kolo-vivo.ts#L32)) — mas só
roda quando o parser marcou uma sugestão de perfil naquela mensagem. "Aquela viagem já acabou" não
é um fato novo sobre a criança; o parser não marca; nada é reescrito. O texto antigo continua indo
ao modelo amanhã.

**Contenção atual — é só instrução de prompt.** O princípio 6
([diretrizes.ts:41](../apps/web/src/lib/conducao/diretrizes.ts#L41)) manda: *"o perfil e o histórico
são FUNDO e podem estar DESATUALIZADOS — não puxe por conta própria um interesse, passeio ou evento
guardado que ninguém trouxe agora"*, e há uma nota equivalente em
[responder.ts:264](../apps/web/src/lib/ayla/responder.ts#L264). Isso reduz a frequência; não pode
eliminar, porque o dado continua sendo afirmado como presente.

**Sobre campanhas:** auditado e **descartado como causa**. `campanha_*` são tipos de mensagem
proativa ([types.ts:28-31](../apps/web/src/lib/ayla/types.ts#L28-L31)) e `utm_campaign` é analytics.
Nenhum entra no contexto da conversa. Se "Neuro Copa" reaparece, veio do **perfil** (alguém contou,
virou fato permanente) ou do **histórico** — não de um sistema de campanha.

**Sobre busca vetorial:** **não existe**. Não há embeddings em nenhum lugar do fluxo conversacional.
O histórico é `order by created_at desc limit 9`. Isso descarta metade das hipóteses da sua lista —
o problema não é recência mal ponderada em busca semântica, é ausência total de dimensão temporal
no dado.

**Mistura entre crianças:** `carregarHistorico`
([orchestrator.ts:2853-2879](../apps/web/src/lib/ayla/orchestrator.ts#L2853-L2879)) filtra só por
`family_account_id`. Numa família com dois filhos, os 6 últimos turnos podem ser sobre o outro. O
decisor de entrega tem o mesmo padrão. **HIPÓTESE** (plausível, não medida): é o vetor mais provável
de "informação de outra criança aparecendo".

## 7. Atualização e correção — o que acontece hoje

| A mãe diz | O que acontece | Atualiza o banco? |
|---|---|---|
| "agora ela consegue X" | Se o parser marcar sugestão → dedup decide `reescrever` → estado novo substitui o antigo. Se não marcar → nada. | às vezes |
| "isso não acontece mais" | Idem, e menos provável de virar sugestão (é negação, não fato novo) | raramente |
| "foi só naquela semana / já passou" | **Nada.** Não há encerramento. | ❌ |
| "essa estratégia não funcionou" | Só se o parser preencher `experimentou` + `experimentou_resultado` → grava em `experimentos`. Que a conversa não lê. | parcial, inútil |
| "isso ajudou bastante" | Idem | parcial, inútil |
| "eu estava falando da outra criança" | Corrige o foco da mensagem atual. **Não reatribui nada já gravado.** | ❌ |
| "não foi bem isso" | Nada específico. | ❌ |

**O mecanismo "Então mudou?":** existe como **instrução**, não como código.
[diretrizes.ts:86](../apps/web/src/lib/conducao/diretrizes.ts#L86): *"quando a mãe disser que algo
mudou ou evoluiu, CHEQUE e ATUALIZE o mapa ('então agora ele já consegue X? como tá sendo?')"*. A
Ayla vai *dizer* a frase. A atualização do banco depende de um caminho separado que pode não
disparar — e quando não dispara, **falha em silêncio**: ninguém, nem a mãe nem nós, percebe que a
frase foi dita e o dado ficou velho. Classificação: **implementado como prompt, desconectado do
armazenamento.**

## 8. WhatsApp × web

| Critério | WhatsApp | Web | Origem técnica | Impacto | Recomendação |
|---|---|---|---|---|---|
| Identidade / princípios / piso | `nucleoConducao()` | `nucleoConducao()` | fonte única | ✅ coerente | preservar |
| Bloco de voz extra | nenhum | `VOZ_E_LIMITES` + `tone` de cada skill | prompt.ts:39; router.ts | voz diverge por canal e por skill roteada | fundir no Core; manter só escopo técnico nas skills |
| Domínios do perfil visíveis | 14 fixos de 20 | 19 possíveis, filtrados pelas skills | listas hardcoded diferentes | **a Ayla "não sabe" coisas que sabe** | uma função única de contexto |
| Diários / check-in emocional | ❌ | ✅ 7 dias | `buildContext` | WA não vê a semana da família | levar ao WA |
| Boas práticas (metodologia) | ❌ | ✅ top-3 | `buildContext` | WA responde sem a metodologia curada | avaliar levar ao WA |
| Histórico | 6 turnos, família toda | 6 mensagens, conversa isolada | consultas diferentes | WA mistura irmãos; web perde continuidade entre conversas | filtrar por criança no WA; dar continuidade à web |
| Sabe o que acontece no outro canal | parcial (títulos das conversas) | ❌ nada | `carregarEstrategiasRecentes` | a mãe repete a mesma história | contexto compartilhado |
| Classificador de intenção | rotina_*/plano/outro | crise/desabafo/dúvida/desafio | dois arquivos | decisões incomparáveis | taxonomia única |
| Critério de entrega | decisor por pontuação + fechador | prosa em `blocoIntencao` + botão | divergiram hoje | mesma conversa, respostas diferentes | levar o decisor à web |
| Como o plano sai | automático: PDF + link | botão que a mãe clica | por design | aceitável, mas o gatilho deveria ser o mesmo | unificar o gatilho, manter a entrega |
| Relatório | só manda link | gera na tela | por design | ok | manter |
| Aprendizado automático | ✅ auto-incorporação | ❌ só por botão | rota de streaming não extrai | **a web não faz a Ayla evoluir** | rodar extração em `after()` na web |
| Eventos com data | ✅ grava (ninguém lê) | ❌ nem grava | só WA chama | linha do tempo perde metade | chamar na web também |
| Validadores de tom | ❌ nenhum | ✅ 3 camadas (fora do streaming) | engine.ts | risco de tom no canal principal | levar ao menos os de regex ao WA |
| Modelo | Sonnet 4.6, 900 tok, sem thinking | Sonnet 4.6, 2048 tok, thinking off no streaming | — | WA mais curto (correto p/ o canal) | manter |

**Resposta técnica à pergunta final:** hoje existe **uma Ayla com uma cabeça compartilhada e dois
corpos diferentes**. O raciocínio (Core) é genuinamente um só — o que é uma conquista real e recente.
Mas *o que ela sabe*, *o que ela decide entregar*, *o que ela aprende* e *como é fiscalizada* são
implementações paralelas. Na prática, para a família, são **duas Aylas**: a do WhatsApp aprende e
não vê metade do perfil; a da web vê o perfil por recortes, tem a metodologia curada e não aprende.

## 8b. Os seis casos, canal a canal

Simulação **por leitura de código**, não execução ao vivo (executar exigiria dois números de teste e
produção estável — e, com a 0070 pendente, o WhatsApp responderia duas vezes e invalidaria a
comparação). Cada linha é rastreável às funções da §2 e §3. Onde é inferência, está marcado.

Cenário base: família com duas crianças cadastradas, perfil já preenchido pelo onboarding.

---

**Caso 1 — "Minha filha não consegue ligar os pontos entre uma coisa e outra. Queria exercitar isso com ela."**

| | WhatsApp | Web |
|---|---|---|
| Contexto | 14 domínios — **`aprendizado` fora** | os domínios da skill roteada + `essencial`; `aprendizado` entra **se** a skill declarar |
| Movimento | decisor: habilidade (2) + objetivo (2) + criança (1) + perfil (1) = **6 → gerar** | `intencao=desafio` → `blocoIntencao` manda dar 1 ideia e, se houver contexto, escrever o marcador do botão |
| Resposta provável | 1-2 frases + plano em PDF e link | explicação + 1 ideia + botão "Montar plano completo" |
| Diferença | quem decide: pontuação × prosa; quem dispara: sistema × mãe | |
| Origem | `prontidao-plano.ts` × `prompt.ts:87-94` | |
| Impacto | no WA a mãe recebe; na web ela precisa clicar — e pode não clicar | |

**Nos dois canais, o conteúdo do plano sai sem o domínio `aprendizado` do perfil.** No WA porque
está cego; na web porque depende do sorteio do roteador. O plano sobre "ligar os pontos" ignora o
que já sabemos sobre como a criança aprende. É o caso mais grave desta tabela.

---

**Caso 2 — "Estou achando que ela não aprende nada. Não sei mais como ensinar."**

| | WhatsApp | Web |
|---|---|---|
| Movimento | rubrica: habilidade (2) + criança (1) + perfil (1) = 4, **pedido explícito** → `perguntar`: UMA pergunta cirúrgica + aviso de que já monta em seguida | `classificarIntencao` → **`desabafo`** (é o padrão para "não sei mais", "estou achando") → `blocoIntencao("desabafo")`: *"não force uma ideia prática"* + terminar perguntando |
| Resposta provável | acolhe em 1 frase, faz 1 pergunta fechada, promete a entrega | acolhe, valida, pergunta se ela quer pensar em algo concreto |
| Diferença | **direta e material** | |
| Origem | regra "sofrimento não anula pedido" existe **só** no decisor do WA; na web o bloco de desabafo diz o contrário | |
| Impacto | mesma mãe, mesma frase: no WA sai com direção; na web sai acolhida e sem nada | |

Este é o caso que mais separa os dois canais hoje — e a divergência **aumentou** com a correção de
hoje, porque só o WhatsApp foi corrigido.

---

**Caso 3 — "O barulho da sala está incomodando muito ela."** (perfil já registra hipersensibilidade auditiva)

| | WhatsApp | Web |
|---|---|---|
| Contexto | `sensorial` é top-level → **entra sempre** ✅ | entra se a skill roteada pedir `sensorial` — provável neste texto |
| Movimento | provavelmente `conversar` ou `perguntar` | `desafio` |
| Risco | re-perguntar o que já sabe: **baixo** neste domínio | idem |
| Diferença | pequena | |

O único caso dos seis em que os dois canais se comportam bem. Vale registrar por quê: `sensorial` é
um dos 5 campos legados com coluna própria, e por isso escapou do buraco do #1.

---

**Caso 4 — "Antes ela não falava 'mamãe', mas agora voltou a falar."**

| | WhatsApp | Web |
|---|---|---|
| Reconhece a evolução na fala | ✅ (Core, `MAPA_FUNCIONAL`: "cheque e atualize") | ✅ mesmo Core |
| Atualiza `comunicacao` no banco | **só se** o parser marcar `sugestao_kolo_vivo`; aí o dedup reescreve para o estado novo | **só se** a mãe clicar em "Guardar no Perfil" |
| Grava marco datado | ✅ `GATILHOS_MARCO` casa "voltou a" → `eventos_membro` tipo `marco` com data | ❌ a web não chama `extrairESalvarEventos` |
| Volta à conversa depois | ❌ o marco é write-only | ❌ |
| Impacto | o avanço é celebrado hoje e esquecido amanhã, nos dois canais | |

Se a atualização não disparar, o perfil segue dizendo "não fala mamãe" — e a Ayla vai repetir isso
como verdade presente na semana que vem. **Falha silenciosa:** ninguém é notificado.

---

**Caso 5 — "Não estou falando do Mario. Estou falando da Manu."**

| | WhatsApp | Web |
|---|---|---|
| Corrige o foco | ✅ nome citado vence o palpite do parser ([orchestrator.ts:1576](../apps/web/src/lib/ayla/orchestrator.ts#L1576)) | parcial — a criança é **fixa na conversa** (`conversa.membro_atipico_id`); a Ayla vê o elenco e entende, mas o contexto carregado continua o da criança errada |
| Corrige o histórico do turno | ❌ os 6 turnos continuam misturando as duas | ✅ conversa isolada |
| Reatribui o que já foi gravado no irmão | ❌ | ❌ |
| Impacto | o fato errado fica no irmão para sempre; a única saída é a mãe editar à mão no Kolo Vivo | |

---

**Caso 6 — "Aquela viagem já aconteceu. Já voltamos e ela está de novo na rotina da escola."**

| | WhatsApp | Web |
|---|---|---|
| Entende na hora | ✅ | ✅ |
| Marca a viagem como encerrada | ❌ **não existe encerramento** | ❌ |
| A viagem continua no perfil | ✅ como texto sem data, indistinguível de algo atual | ✅ |
| Existe evento datado de férias? | talvez (`GATILHOS` casa "férias") — mas ninguém lê | ❌ nem grava |
| Risco de reaparecer | **alto** — depende só da instrução "não puxe assunto guardado" | alto |

Este é o caso 100% não resolvido, e é exatamente o mecanismo por trás de "Copa" e "viagem antiga".
Nenhuma das duas Aylas tem como saber que aquilo acabou, porque o dado nunca teve começo nem fim.

## 9. Pendências

| Pendência | Status | Evidência | Impacto | Ação | Prio |
|---|---|---|---|---|---|
| 1. Mesma identidade nos 2 canais | **parcialmente resolvida** | Core compartilhado; `VOZ_E_LIMITES` + tone das skills só na web | médio | fundir V1/V2 | 2 |
| 2. Identidade no código, sem editor antigo do banco | **resolvida** | sem `voz_ayla` no seed; 6 prompts operacionais restam | baixo | proteger `parser_ayla` | 4 |
| 3. Perfil decide estratégia | **não implementada** | perfil entra como texto no prompt; nenhuma ramificação de código lê idade/diagnóstico/autonomia para escolher rota | **alto** | ver §10 | 1 |
| 4. Memória deixar de ser passiva | **não implementada** | nada do que é gravado com data volta ao prompt | **alto** | ler `eventos_membro` e `experimentos` | 1 |
| 5. Atualizar evolução quando algo muda | **implementada, desconectada** | instrução em diretrizes.ts:86; escrita depende do parser marcar sugestão | alto | gatilho próprio de "mudou" | 1 |
| 6. Marcos do WhatsApp com data | **implementada só no WhatsApp** | `eventos.ts` grava com data; a web nem grava | médio | chamar na web | 2 |
| 7. Domínio de leitura e escrita | **parcialmente** | `aprendizado` existe; **invisível ao WA** | médio | corrigir #1 | 1 |
| 8. Perguntas funcionais por diagnóstico | **implementada como prompt** | `MAPA_FUNCIONAL` lista onde olhar por diagnóstico | médio | — (fora do escopo pedido) | — |
| 9. Perguntar sem virar anamnese | **implementada** | freio anti-anamnese, diretrizes.ts:85 | ok | preservar | — |
| 10. Distinguir "ausente" de "nunca perguntado" | **não implementada** | `carregarLacunasKoloVivo` só sabe vazio × cheio | médio | 3º estado | 3 |
| 11. Não repetir perguntas respondidas | **parcialmente** | lacunas evita re-perguntar — mas mente sobre 6 domínios (#1) | alto | corrigir #1 | 1 |
| 12. Guardar estratégias tentadas | **implementada, desconectada** | `experimentos` com data e resultado; conversa não lê | alto | injetar no contexto | 1 |
| 13. Guardar o resultado | **implementada, desconectada** | idem | alto | idem | 1 |
| 14. Acompanhar pendências anteriores | **não implementada** | não há tabela de objetivo/pendência | médio | decisão de produto | 3 |
| 15. Objetivos ativos/concluídos/abandonados | **não implementada** | nenhuma tabela | médio | decisão de produto | 3 |
| 16. Evento atual × encerrado | **não implementada** | sem status/validade | **alto** | ver §10 | 1 |
| 17. Não misturar duas crianças | **parcialmente** | perfil e diário são por criança; **histórico e decisor são da família** | alto | filtrar por criança | 2 |
| 18. Corrigir associação à criança errada | **não implementada** | corrige o foco atual; não reatribui o gravado | médio | ação no Kolo Vivo | 3 |
| 19. Não usar campanha antiga como contexto | **resolvida por ausência** | campanhas não entram no contexto | — | — | — |
| 20. Histórico sem tratar tudo como presente | **não implementada** | é o problema #3 | **alto** | perfil datado | 1 |

## 10. Mudanças recomendadas

**Correção técnica (sem migração, sem decisão de produto):**
1. `carregarKoloVivoResumo` passa a iterar `MEMBRO_CAMPOS_TODOS` + `MEMBRO_CAMPO_LABEL` em vez da
   lista hardcoded. Mata #1 e as pendências 7 e 11. É a maior relação impacto/esforço da auditoria.
2. Injetar `eventos_membro` dos últimos ~90 dias no contexto conversacional, **com a data escrita**
   e uma nota de que evento datado é passado até prova em contrário.
3. Injetar `experimentos` (últimos ~15, com resultado e data) no contexto. Mata as pendências 12 e 13.
4. Filtrar `carregarHistorico` pela criança em foco quando a família tem 2+ membros.
5. Rodar `extrairESalvarEventos` também na web, em `after()`.

**Ajuste de prompt:**
6. Fundir `VOZ_E_LIMITES` no Core; manter na web só o que é técnico da skill.
7. Reescrever `blocoIntencao("desabafo")` para não contradizer "sofrimento não anula pedido".
8. Unificar a taxonomia de intenção.

**Alteração de banco:**
9. Perfil com fatos datados + proveniência + status (`ativo`/`encerrado`/`superado`) e visão
   derivada. É o redesenho já desenhado e não construído. Resolve #3, #5 e as pendências 16 e 20 de
   uma vez. É a mudança grande — não deve ser a primeira.
10. Tabela de objetivos/pendências (pendências 14 e 15). Depende de decisão de produto.

**Mudança de produto:**
11. A web aprende sozinha? (hoje é opt-in por botão)
12. O decisor de entrega passa a valer na web?

**Observabilidade:** hoje há `[ayla:entrega]`, `[ayla:ponte]`, `[ayla:turno]`, `[ayla:eventos]`,
`[conflito-kv]`. Falta um log único por turno com: canal, criança identificada, domínios de perfil
efetivamente injetados, quantos eventos/experimentos entraram, quantos foram descartados por idade,
intenção, movimento escolhido, se houve pergunta, se o perfil mudou algo na decisão, e o que foi
gravado depois. Sem dados pessoais — só chaves, contagens e ids.

**Testes:** os 6 casos desta auditoria como fixtures nos dois canais, cobrindo especialmente
"informação já conhecida", "atualização" e "evento encerrado".

## 11. Ordem recomendada

1. **Verificar a 0070** (§12) — sem isso, qualquer teste de voz é inválido.
2. **Correções sem migração:** itens 1-5 acima. Semana 1. Resolvem sozinhas boa parte de #1, #2 e
   das pendências 7, 11, 12, 13, 17.
3. **Unificação de voz e critério:** itens 6-8 + levar o decisor à web.
4. **Memória temporal:** item 9 (o redesenho de fatos datados). É onde mora a solução real de "Copa"
   e "viagem antiga".
5. **Acompanhamento de resultado:** objetivos, pendências e "o plano funcionou?".
6. **Testes e observabilidade** acompanhando cada etapa, não no fim.

## 12. ⚠️ Migração 0070 — verificar ANTES de qualquer teste de voz

**Não foi possível verificar daqui** (sem acesso a produção). O arquivo existe no repositório
([0070_inbound_processada.sql](../supabase/migrations/0070_inbound_processada.sql)) e o prompt de
aplicação está em [aplicar-0070-controle-turno.md](aplicar-0070-controle-turno.md).

**Por que isto bloqueia a auditoria de conversa:** sem a coluna `processada_em`, o claim atômico
falha e o código degrada de propósito para "responde só esta mensagem"
([lote-inbound.ts:92-97](../apps/web/src/lib/ayla/lote-inbound.ts#L92-L97)) — **uma Ayla por
mensagem, em paralelo, cada uma cega às outras**. A conversa de 30/07 mostra exatamente isso: duas
respostas completas ao mesmo assunto, às 07:35 e 07:36, repetindo a mesma explicação.

Com duas execuções concorrentes, **qualquer teste de voz mede a coisa errada**: repetição, tom
inconsistente e "ela não me ouviu" podem ser o paralelismo, não a Ayla. Resolver primeiro.

## 13. Decisões que dependem da Karina

Só o que **precisa** de decisão de produto antes de implementar:

1. **A web deve aprender sozinha**, como o WhatsApp, ou o "Guardar no Perfil" é uma escolha
   deliberada de dar controle à mãe? (Muda a pendência 4 e a #4.)
2. **Quando um fato do perfil deve ser considerado velho?** Um interesse de 8 meses atrás ainda
   vale? Uma dificuldade de 6 meses? Precisamos de um número para cada tipo, ou a Ayla pergunta
   ("isso ainda é assim?") quando for usar algo antigo?
3. **A Ayla pode marcar sozinha um fato como encerrado** quando a mãe disser "já passou", ou isso
   sempre pede confirmação? (Apagar dado de saúde de criança no automático é a razão de o detector
   de conflito hoje só sinalizar.)
4. **Objetivos da família viram entidade explícita?** ("trabalhar associação com a criança" como
   objetivo ativo, com status.) É o que permite acompanhar resultado — e é uma feature nova, não
   uma correção.
5. **O critério de entrega passa a ser o mesmo nos dois canais?** Hoje a web oferece por botão e o
   WhatsApp decide por pontuação.
6. **As boas práticas e o diário devem chegar ao WhatsApp?** Aumentam o custo por mensagem e o
   tamanho do prompt no canal mais usado.

## 14. Arquivos relevantes

| Arquivo | Função | Linhas | Responsabilidade | Problema |
|---|---|---|---|---|
| `lib/conducao/diretrizes.ts` | `nucleoConducao` | 126-137 | Core compartilhado | ✅ nenhum — preservar |
| `lib/ayla/orchestrator.ts` | `carregarKoloVivoResumo` | 2762-2807 | perfil → prompt (WA) | **lista hardcoded: 14 de 20 domínios** |
| `lib/ayla/orchestrator.ts` | `carregarLacunasKoloVivo` | 1047-1073 | o que tem × falta | varre 20; diz "já tem" de domínios que a resposta não vê |
| `lib/ayla/orchestrator.ts` | `carregarHistorico` | 2853-2879 | 6 turnos | sem filtro por criança |
| `lib/ayla/orchestrator.ts` | `persistirRegistro` | 2055-2318 | auto-incorporação | grava sem data/origem/status |
| `lib/ayla/orchestrator.ts` | `registrarExperimento` | 2397-2430 | estratégias tentadas | grava com data; ninguém lê |
| `lib/ayla/orchestrator.ts` | `sinalizarConflitoCrossCampo` | 2326-2389 | contradições | só a tela lê |
| `lib/ayla/eventos.ts` | `extrairESalvarEventos` | 68-119 | linha do tempo | write-only; não roda na web |
| `lib/ayla/responder.ts` | `gerarRespostaAyla` | 190-500 | voz WA | sem validadores |
| `lib/ia/context.ts` | `buildContext` | 112-320 | contexto web | perfil filtrado pelas skills |
| `lib/ia/prompt.ts` | `VOZ_E_LIMITES` | 39-60 | voz web | duplica e contradiz o Core |
| `lib/ia/prompt.ts` | `blocoIntencao` | 67-96 | critério web | critério de entrega paralelo |
| `lib/ia/router.ts` | `SkillRow` | 7-20 | skills do banco | `tone` por skill só na web |
| `lib/ia/intencao.ts` | `classificarIntencao` | 25-90 | intenção web | taxonomia diferente |
| `lib/ayla/intent.ts` | `classificarIntencao` | 35-71 | intenção WA | taxonomia diferente |
| `lib/ayla/dedup-kolo-vivo.ts` | `decidirDedup` | 50+ | evolução do fato | só roda se o parser marcar sugestão |
| `api/conversar/stream/route.ts` | `POST` | 13-133 | chat web | não extrai nada; sem validadores |
| `app/(app)/conversar/actions.ts` | `proporAtualizacao` | 434 | memória web | manual, por botão |
| `lib/kolo-vivo/campos.ts` | `MEMBRO_CAMPOS_TODOS` | 43-46 | lista canônica | ✅ existe — só não é usada por quem devia |
