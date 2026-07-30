# Estado da plataforma depois da Fase 1

**Data:** 30/07/2026 · **Retrato do estado atual.** Nenhuma alteração de código nesta auditoria,
nenhuma proposta de melhoria. Verificado: `tsc` limpo, build compila, 63 testes passam.

---

## ⚠️ Duas correções de fato, antes de tudo

Esta auditoria encontrou duas afirmações erradas circulando — uma sua, uma minha. As duas mudam a
base do Prompt 2, então vêm primeiro.

### Correção 1 — **eu errei** na auditoria da jornada de 7 dias

Afirmei que "não existe `dia_do_trial` em consulta nenhuma" e que o check-in diário é "a mesma
pergunta genérica". **As duas afirmações estão erradas.**

O check-in diário **não** é um template estático. `sendRotinaDiaria`
([orchestrator.ts:299](../apps/web/src/lib/ayla/orchestrator.ts#L299)) chama
`gerarMensagemEspontanea` — um gerador por IA com **9 intenções** diferentes, que:

- **calcula o dia do trial** ([mensagemEspontanea.ts:220-223](../apps/web/src/lib/ayla/mensagemEspontanea.ts#L220-L223)):
  `Math.min(7, floor((agora − criado)/dia) + 1)`;
- lê os **temas** do perfil e separa em `temasComInfo` (já contou algo) × `temasSemInfo` (ainda não
  sabemos);
- lê os **interesses** da criança;
- tem intenções de continuidade: `aprofundar_tema`, `explorar_temas`, `feedback_plano`,
  `menu_do_dia`.

O template estático (`templateRotinaDiaria`) existe **só como rede de segurança** quando a chamada de
IA falha. Eu li a função de baixo (o fallback) e concluí sobre o caminho principal. Erro meu, e ele
subestimou o que já está construído.

**O que continua verdade, e é a parte que importa:** `diaTrial` é usado em **um único lugar** — uma
ramificação do sorteio de intenção ([linha 289](../apps/web/src/lib/ayla/mensagemEspontanea.ts#L289):
`if (!interagiu && diaTrial >= 2)`). **Ele nunca entra em nenhum prompt.** A Ayla sabe internamente
que é o dia 4 e não tem como dizer isso, nem adaptar o conteúdo ao dia. Não existe roteiro dia a dia
— existe um sorteio ponderado que roda igual no dia 2 e no dia 6.

### Correção 2 — os check-ins **não** usam os temas priorizados do onboarding

Você escreveu: *"Hoje sei que eles utilizam os temas priorizados no onboarding."* Não é o que o
código faz, e a diferença é sutil o suficiente para valer o detalhe:

O onboarding grava os desafios marcados em `desafios_onboarding` **e cria uma seção vazia**
`{texto: ""}` para cada um ([salvar-conversacional.ts:149-151](../apps/web/src/lib/onboarding/salvar-conversacional.ts#L149-L151)).

O check-in classifica temas por `textoDe(k)` — se a seção tem **texto**
([mensagemEspontanea.ts:229-233](../apps/web/src/lib/ayla/mensagemEspontanea.ts#L229-L233)). Como a
seção nasce vazia:

| | O que contém | O que a Ayla faz |
|---|---|---|
| `temasComInfo` | domínios com texto no perfil | `aprofundar_tema` — retoma o tema |
| `temasSemInfo` | domínios vazios, filtrados por `DOMINIOS_CRIANCA` (lista **fixa** de 7) | `explorar_temas` — pergunta sobre o assunto |

Logo, na família recém-cadastrada **todos os temas marcados caem em `temasSemInfo`** — e são
misturados aos não marcados, porque `DOMINIOS_CRIANCA` é uma lista fixa (`comunicacao`,
`socializacao`, `foco`, `escola`, `sono`, `autonomia`, `emocional`) que **ignora o que ela marcou**.

Uma mãe que marcou "sono, alimentação, autonomia" pode receber um check-in perguntando sobre
socialização, que ela não marcou. E `nutricional` (alimentação) **não está** em `DOMINIOS_CRIANCA` —
não entra na exploração nunca.

**Resumo honesto:** a máquina de temas existe e é boa. A **priorização** que você descreveu não
existe. Os temas marcados só se tornam "tema para aprofundar" depois que a mãe falar sobre eles
espontaneamente numa conversa.

---

## 1. Resumo executivo

A Fase 1 não mudou nada do que a família vê ou de como a Ayla fala. Mudou **o que ela sabe no momento
de falar**.

Antes, cada canal tinha sua própria lista de coisas para carregar, escrita à mão, e as duas estavam
incompletas de formas diferentes: o WhatsApp via 14 dos 20 domínios do perfil e nenhuma boa prática;
a web via 19 filtrados pelo sorteio do roteador e três boas práticas escolhidas por peso fixo. As
duas memórias com data — linha do tempo e estratégias já tentadas — eram gravadas e nunca lidas por
nenhuma conversa. E a web não aprendia sozinha: só o botão "Guardar no Perfil" escrevia.

Agora existe **um leitor de perfil, um seletor de boas práticas e um aplicador de escrita**,
compartilhados pelos dois canais. Os 20 domínios chegam ao prompt nos dois; eventos datados e
estratégias tentadas chegam nos dois; boas práticas chegam nos dois; e a web aprende
automaticamente, como o WhatsApp já fazia.

Em uma frase: **a Ayla passou a enxergar o que já tinha.**

---

## 2. O que mudou

| # | Antes | Agora | Benefício esperado |
|---|---|---|---|
| 1 | WhatsApp lia 14 dos 20 domínios; `aprendizado`, `escola`, `saude_geral`, `imitacao`, `tela_midia` e `gostos` invisíveis — e o bloco de lacunas dizia "já tem no perfil" sobre eles | Os 20 domínios, via `lerSecoesMembro` | A Ayla para de ignorar e de não perguntar sobre escola e aprendizado — os dois domínios do caso que abriu as auditorias |
| 2 | Web filtrava o perfil pelos `kolo_vivo_fields` das skills roteadas; `gostos` nunca lido | Perfil inteiro, sem filtro por skill | O perfil visível deixa de variar por turno |
| 3 | Duas funções de extrair texto do jsonb (`resumoCampoKV`, `extractTextoFrom`), com comportamentos diferentes | Uma (`textoDoCampo`) | Domínio novo passa a valer nos dois canais de uma vez |
| 4 | `eventos_membro` (única memória com data) lida só pelo relatório | Entra no prompt dos dois canais, com a data visível e a nota "evento datado já aconteceu" | Contenção mínima contra tratar viagem antiga como presente |
| 5 | `preferencias.experimentos` (o que já foi tentado + resultado + data) lida só pelo cron semanal | Entra no prompt dos dois canais | A Ayla para de recomendar o que já não funcionou |
| 6 | Histórico do WhatsApp filtrado só por família | Filtra pela criança em foco (mantendo linhas sem membro) | Menos vazamento de informação entre irmãos |
| 7 | WhatsApp lia **zero** boas práticas | Até 5 por turno | A metodologia curada chega ao canal principal |
| 8 | Web: 20 BPs por peso → filtro por skill → 3. O filtro descartava as ~204 presas às 7 skills em rascunho | Seleção por assunto (termos da mensagem × tags/título), respeitando faixa etária e perfil da BP; peso só como desempate | ~55% do acervo deixa de ser inalcançável **sem** ativar skill nenhuma |
| 9 | Web não aprendia sozinha: só o botão escrevia | `aprenderDaConversa` roda em `after()` a cada turno com fala ≥25 caracteres | A Ayla da web passa a evoluir como a do WhatsApp |
| 10 | Escrita no perfil duplicada (dentro da server action) | `aplicarPropostaNoPerfil` compartilhado; botão e automático usam o mesmo | Uma lógica de merge, não duas |
| 11 | Linha do tempo alimentada só pelo WhatsApp | Os dois canais alimentam | Relatório e Evolução passam a receber o que acontece na web |

Novos arquivos: `lib/kolo-vivo/leitura.ts`, `lib/kolo-vivo/aplicar.ts`,
`lib/conhecimento/boas-praticas.ts`, `lib/ia/aprender.ts`, `lib/kolo-vivo/leitura.test.ts`.
Modificados: `orchestrator.ts`, `responder.ts`, `ia/context.ts`, `ia/prompt.ts`, `ia/engine.ts`,
`conversar/actions.ts`, `api/conversar/stream/route.ts`.

---

## 3. Fluxo de funcionamento

### Memória — as quatro camadas, e o que cada uma faz agora

| Camada | Onde vive | Tem data? | Chega à conversa? |
|---|---|---|---|
| **Perfil (Kolo Vivo)** | `perfil_vivo_membro`, 20 domínios em jsonb | ❌ texto corrido, sem data | ✅ **completo**, nos dois canais |
| **Linha do tempo** | `eventos_membro` | ✅ `data` + `tipo` + `fonte` | ✅ **novo** — 120 dias, até 12 eventos |
| **Estratégias tentadas** | `categorias_extras.preferencias.experimentos` | ✅ `data` + `resultado` | ✅ **novo** — últimos 15 |
| **Diários e check-ins** | `diarios`, `ayla_daily_checkins` | ✅ | ⚠️ só a web (7 dias) — o WhatsApp continua sem ler |

### Perfil e domínios

Fonte única: `MEMBRO_CAMPOS_TODOS` em `lib/kolo-vivo/campos.ts` (20 domínios) →
`lerSecoesMembro` → `resumoRotulado`. Um domínio novo entra numa lista só e aparece nos dois canais.
Um teste itera os 20 e falha se algum sumir.

O perfil continua sendo **texto concatenado sem data, sem origem e sem status** — isso não mudou.

### Aprendizado

**WhatsApp** (inalterado): parser IA → `persistirRegistro` → check-in do dia, diário com dedup,
experimento, auto-incorporação no perfil (roteando para o sub-campo certo), detecção de contradição
entre domínios. Depois, `extrairESalvarEventos` alimenta a linha do tempo.

**Web** (novo): em `after()`, `aprenderDaConversa` → freio de tamanho (≥25 caracteres) →
`extrairAtualizacoes` (com o perfil atual junto, para a regra de novidade não duplicar) →
`aplicarPropostaNoPerfil` → diário consolidado do dia → `extrairESalvarEventos`.

Diferenças que permanecem entre os dois: o WhatsApp faz dedup semântico por campo
(`decidirDedup`) e detecta contradições; a web usa a regra de novidade textual do extrator. O
WhatsApp roteia para sub-campos; a web também (é a mesma `aplicarTextoCampo`).

### WhatsApp — sequência de um turno

```
webhook → idempotência por zaap_message_id → comando? → controle de turno (7s + claim)
→ gate de assinatura → handlers de estado → intenção por IA → criança da conversa
→ rotas de rotina visual → parser IA
→ CONTEXTO (em paralelo): perfil 20 domínios · lacunas · conversas da web
                          histórico FILTRADO POR CRIANÇA · eventos datados
                          experimentos · até 5 boas práticas · 5 magic links
→ decisor de entrega (gerar / perguntar / conversar)
→ Core + formato WhatsApp + idioma → Sonnet 4.6, 900 tokens, streaming por balão
→ ponte (plano + PDF, se "gerar") → grava → em background: registro + eventos
```

### Web (Estratégias) — sequência de um turno

```
mensagem → família da sessão → criança FIXA da conversa → gate de assinatura
→ router de skills (IA) → intenção (crise/desabafo/dúvida/desafio)
→ buildContext: perfil 20 domínios (sem filtro por skill) · elenco · perfil da família
                diários 7d · último check-in · eventos datados · experimentos
                histórico da conversa · até 5 boas práticas por assunto
→ Core + skills do banco + VOZ_E_LIMITES + blocoIntencao + formato web
→ Sonnet 4.6, 2048 tokens, streaming (thinking off)
→ grava → em after(): APRENDE (novo)
```

### Skills

Continuam vindo do banco (`specialist_prompt_templates`) e continuam sendo usadas **só na web**, como
lentes de especialista no prompt (`objective`, `tone`, `scope`, `limits`). O que mudou: **elas não
decidem mais o que é carregado** — nem os domínios do perfil, nem as boas práticas. O parâmetro
`skills` segue em `buildContext` porque quem monta o prompt usa, mas não filtra nada.

As 7 skills em rascunho **continuam desligadas** e com conteúdo placeholder. Não foram ativadas — ver
Ponto de atenção 3.

### Uso do histórico

- **WhatsApp:** 6 últimos turnos, agora da criança em foco (+ linhas sem membro atribuído).
- **Web:** 6 mensagens da conversa atual, isolada. Conversas anteriores não entram — só os títulos
  das 3 últimas chegam ao WhatsApp.

### Atualização de informações

Não mudou. Quando a mãe diz que algo mudou: o Core manda checar e atualizar (instrução de prompt), e
o `decidirDedup` do WhatsApp sabe reescrever para o estado novo — **mas só dispara se o parser marcar
uma sugestão de perfil naquela mensagem**. Encerramento ("já passou") continua não existindo.
Reatribuição de fato gravado na criança errada continua não existindo.

O que melhorou de lado: com a linha do tempo no prompt, a Ayla ao menos **vê** que o evento tem data
— o que reduz a chance de tratar o antigo como atual, sem resolver a origem.

---

## 4. O que continua igual

Não foi tocado nesta fase:

- **Onboarding** inteiro — perguntas, ordem, chips, rascunho, checkpoints, o "pode marcar vários"
- **Teste de 7 dias** — nenhum cron, nenhuma regra, nenhuma cadência
- **Check-ins / mensagem espontânea** — as 9 intenções, o sorteio, os prompts, a lista
  `DOMINIOS_CRIANCA`, o `DOMINIO_LABEL` de 10 domínios
- **Regras de proativa** (`rules.ts`) — máx 2/dia, janela de horário, "já conversamos hoje", silêncio
  após 10 dias
- **Core da Ayla** (`diretrizes.ts`) — identidade, princípios, sequência, piso, catálogo, tom
- **Decisor de entrega** — como implementado hoje mais cedo, sem alteração
- **Planos** — gerador multi-call, 9 seções, PDF, magic link
- **Rotinas visuais** — fluxo guiado, cartões, PDF
- **Histórias, leitura de desenho, avatar, meditação, timer** (Lúdico)
- **Relatórios** escola/terapeuta — estrutura, prompts, fontes de dados
- **Evolução** e snapshots mensais
- **Onboarding do app**, painel, tour do menu, seletor de criança
- **Assinatura, trial, ledger, Stripe, gates de acesso**
- **CRM, campanhas, dashboards, admin**
- **Base de conhecimento** — nenhuma BP editada, nenhuma skill ativada; mudou só **como** são
  recuperadas
- **Validadores** — continuam só na web, e só no caminho não-streaming

---

## 5. Limitações atuais

**Do perfil e da memória**
1. O perfil continua sem data, sem origem, sem confiança e sem status. Fato escrito uma vez vai ao
   prompt para sempre.
2. Não existe encerramento: "já passou / não acontece mais" não fecha nada.
3. Não existe reatribuição de fato gravado na criança errada.
4. Contradições entre domínios são detectadas e gravadas, mas a Ayla não pergunta sobre elas.
5. Não existe distinção entre "não sabemos" e "nunca perguntamos".
6. Hipótese da Ayla e fato confirmado são gravados do mesmo jeito.

**Da jornada**
7. `diaTrial` é calculado e não entra em prompt nenhum: a Ayla não sabe dizer em que dia está nem
   quantos faltam.
8. Não existe roteiro dia a dia — o dia 2 e o dia 6 rodam o mesmo sorteio.
9. `emocional_streak` exige 7 dias consecutivos de check-in respondido; `plano_seguimento` olha
   planos de 3 a 14 dias. Nenhum dos dois alcança o teste de forma confiável.
10. "Já conversamos hoje" segue silenciando a proativa de quem escreveu naquele dia — quem se
    engaja recebe menos condução.
11. Os desafios marcados no onboarding continuam sendo lidos só no índice `[0]`, uma vez, nas
    boas-vindas.
12. `DOMINIOS_CRIANCA` (7 domínios fixos) ignora o que a mãe marcou; `nutricional` não está na lista.
13. `DOMINIO_LABEL` do check-in cobre 10 dos 20 domínios — os outros 10 não entram na rotação de
    tema, mesmo agora que estão visíveis no prompt de resposta.

**Da divergência entre canais**
14. `VOZ_E_LIMITES` continua existindo só na web, duplicando e em parte contradizendo o Core.
15. `blocoIntencao("desabafo")` continua mandando "não force uma ideia prática" — o oposto da regra
    "sofrimento não anula pedido" que hoje rege o WhatsApp.
16. `blocoIntencao("desafio")` mantém um critério de entrega próprio, independente do decisor.
17. Duas taxonomias de intenção incompatíveis.
18. `tone` por skill (do banco) só existe na web.
19. Web decide plano por botão; WhatsApp por decisor.
20. WhatsApp não lê diários nem check-in emocional; a web lê.
21. Validadores de tom só na web, e nem no streaming.
22. Web não tem continuidade entre conversas (cada conversa é isolada).

**Da base de conhecimento**
23. 7 skills continuam com conteúdo placeholder e desligadas.
24. Seleção de BP é por sobreposição de termos, não semântica.
25. Buracos de conteúdo intactos: alfabetização, escrita, matemática, funções executivas, inclusão
    escolar formal, CAA, e os perfis clínicos.
26. 135 das 368 BPs seguem sem homologação da Karina, sem marcação que a recuperação possa usar.

**De infraestrutura**
27. **Migração 0070 não confirmada em produção.** Sem ela, uma Ayla por mensagem em paralelo.
28. `whatsapp_e164` continua não sendo único.
29. Criptografia em repouso continua pendente.

---

## 6. Pontos de atenção

**1. Um bug real foi encontrado e corrigido durante a implementação — vale saber que existiu.**
Eu havia usado `origem='app_auto'` para separar o diário automático do manual. `diarios.origem` tem
`CHECK in ('app','ayla')` desde a migração 0001: o insert falharia e, como o erro não era checado,
**falharia em silêncio**. Corrigido para `'app'` (consolida com o diário do botão, que é o
comportamento certo) e os erros passaram a ser logados. Não requer migração.

**2. Precisa de validação manual — custo do aprendizado automático da web.**
Cada turno da web com fala ≥25 caracteres dispara uma chamada extra ao Sonnet (800 tokens de saída),
em `after()`. Vale acompanhar `/admin/uso-api` nos primeiros dias. O freio está numa constante
isolada; rodar a cada dois turnos é ajuste de uma linha.

**3. Hipótese adotada: não ativei as 7 skills desligadas.**
O item pedia "quando apropriado". Julguei que não é: `cowork-frente-1-skills.md` as descreve como
*"esqueleto criado, sem conteúdo real… placeholders"*, e ativá-las injetaria placeholder no prompt da
web — que é alterar a personalidade, o que a Fase 1 proibia. Resolvi o problema por outro caminho
(desacoplar as BPs do estado da skill). **Se a intenção era mesmo ativar, isso não foi feito** — e
dependeria de conteúdo da Karina, não de código.

**4. Hipótese: o `is.null` no filtro de histórico por criança.**
Mantive as mensagens sem `membro_atipico_id` no histórico (linhas antigas e as que o parser não soube
atribuir). Cortá-las deixaria a Ayla amnésica. O efeito colateral: em família com dois filhos, uma
mensagem não atribuída sobre o irmão ainda pode entrar. Filtragem 100% limpa exigiria backfill.

**5. Hipótese: janelas de tempo escolhidas por mim.**
Eventos = 120 dias / até 12. Experimentos = últimos 15. Boas práticas = até 5. São palpites
razoáveis, não medições. Se o prompt ficar grande ou ruidoso, são as primeiras coisas a calibrar.

**6. Precisa de validação manual — qualidade da seleção de boas práticas.**
A pontuação por sobreposição de termos nunca rodou contra o acervo real (368 BPs, no banco de
produção). É plausível que traga BP irrelevante em conversa de tema ambíguo. Vale ler 10 conversas
reais e conferir quais BPs entraram.

**7. Não verificado em produção:** o estado real das skills e o `status` das BPs. O SQL de
conferência está no fim do laudo da base de conhecimento.

**8. Prompt maior nos dois canais.** Entram até 6 domínios a mais, 12 eventos, 15 experimentos e 5
BPs. É entrada (barata, cacheada) e não saída, mas ninguém mediu ainda.

---

## 7. Base para o Prompt 2

### Teste de 7 dias

| Pergunta | Resposta |
|---|---|
| A IA sabe em qual dia do teste está? | **Calcula, mas não usa.** `diaTrial` (1-7) existe e entra em **um** `if` do sorteio de intenção. Nunca chega a um prompt |
| Sabe quantos dias faltam? | **Não.** Nenhum lugar calcula isso para a conversa. O único texto que fala em prazo é o template estático `trial_d3` ("faltam 3 dias") |
| Evento específico no 1º dia? | **Sim, um:** `sendBoasVindas`, disparado ao concluir o onboarding, fora da janela de horário, citando o **primeiro** desafio marcado |
| Ação específica no último dia? | **Sim, uma:** `trial_d0`, texto estático de "acaba hoje". Não há retrospectiva, retrato do período nem celebração |
| Lembretes automáticos? | Sim, por **inatividade**: 2 dias e 5 dias sem a mãe escrever. Silêncio total após 10 |
| Check-ins automáticos? | Sim, um por dia, na janela de 2h escolhida no onboarding, se ela não escreveu naquele dia |
| Como funcionam? | Detalhe abaixo |

Cronologia real de um teste, com todos os gatilhos possíveis: dia 0 boas-vindas · dias 1-7 um
check-in/dia (bloqueado se ela escreveu) · dia 4 `trial_d3` · dia 7 `trial_d0` · oferta de fim de
semana **só se uma sexta cair na janela** · sugestão de repertório 1×/semana · insight se houver
padrão detectado. Teto de 2 proativas/dia.

### Primeira conversa

A mensagem de boas-vindas **não explica** a plataforma. Ela:

- chama a mãe pelo nome;
- cita o primeiro desafio que ela marcou;
- faz uma pergunta fácil sobre esse desafio;
- oferece responder por áudio.

Não diz quem é a Ayla além do nome, não diz o que é a Kolo Família, não diz como usar, não lista
recurso nenhum. É uma **abertura de conversa personalizada** — deliberadamente, para puxar resposta.

O "o que é isso e para que serve" existe em outro lugar: a intenção `ensinar_valor` do check-in, que
explica que quanto mais ela conta, mais a Ayla consegue montar panorama de evolução, personalizar e
fazer planos. Mas é **sorteada** (16-28% de chance, dependendo do estado), não garantida — e pode
nunca sair em sete dias.

Há também `menu_do_dia`, que apresenta recursos — e só entra na roleta se a mãe **não** interagiu até
o dia 2. Ou seja: quem responde à primeira mensagem tem menos chance de saber o que existe.

### Check-ins

**Quando:** cron `?tipo=rotina` roda a cada 30 min; dispara para as famílias cuja janela de horário
casa com o momento. Uma por dia (idempotência por `tipo='rotina'` no dia). Bloqueado por:
consentimento ausente, Ayla desativada, pausa, sem acesso liberado, sem criança específica definida,
fora da janela, teto de 2 proativas/dia, e **"já conversamos hoje"**.

**Como escolhe a criança:** round-robin determinístico por `familyId + data` entre os membros ativos.

**Como escolhe o tema/intenção** (`pickIntent`, sorteio determinístico por semente):

```
se NÃO interagiu e diaTrial ≥ 2 →  menu_do_dia 50% · convite_plano 28% · ensinar_valor 22%
senão:
  temTemaComInfo   e r<26  →  aprofundar_tema
  temGapExplorar   e r<48  →  explorar_temas
  sem plano ainda          →  convite_plano 70% · ensinar_valor 16% · acolhimento 14%
  já tem plano             →  feedback_plano 62% · voce_sabia 18% · acolhimento 20%
```

**Como a mensagem é construída:** um prompt por intenção, com nome da mãe, nome/idade/gênero da
criança, elenco da família, interesses, e — nas intenções de tema — o rótulo do domínio e o texto que
ela já contou. Gerado por Haiku. Falha → template estático.

**Usa histórico das conversas?** **Não.** O gerador não lê `ayla_messages`. Usa apenas: se ela já
interagiu alguma vez (booleano), se já tem plano (booleano), o dia do trial, e o perfil.

**Usa evolução da criança?** **Não.** Não lê diários, snapshots, eventos nem experimentos.

**Usa memória?** Parcialmente: o **perfil** (10 dos 20 domínios, via `DOMINIO_LABEL`) e os
interesses. Nada datado.

⚠️ **A Fase 1 não tocou nisto.** Todas as melhorias de contexto foram no caminho **reativo** (quando
a mãe escreve). O check-in proativo continua com o contexto que tinha.

### Estratégias

É o módulo de conversa **na web** (`/conversar`). Não é um gerador de artefato — é o chat.

**Quando é usado:** quando a mãe abre uma conversa no app. Cada conversa é vinculada a uma criança na
criação e não muda depois.

**Como a IA decide "gerar uma estratégia":** ela não decide — **a mãe clica**. O modelo escreve um
marcador invisível no fim da resposta quando julga que é hora de oferecer, e o marcador faz aparecer
o botão "Montar plano completo". Além disso há 7 botões de apoio (`output_types`): brincadeiras,
atividades, crenças, o que fazer diferente, histórias sociais, frases prontas, rotinas.

**Quais informações usa:** perfil completo (20 domínios), elenco da família, perfil da família,
diários de 7 dias, último check-in emocional, eventos datados, experimentos, até 5 boas práticas,
histórico da conversa, e as skills roteadas como lentes.

**Tipos:** o "plano" é um só, com 9 seções (entender, crenças, o que fazer diferente, rotina,
brincadeiras, atividades, história social, frases, o que observar) — as duas do meio são
condicionais. Mais os 7 output types como respostas pontuais.

**Como personaliza:** por nome, idade exata, gênero, diagnóstico, interesses e o conteúdo dos 20
domínios. Por **idade** o produto é forte (o prompt tem regras duras contra infantilizar
adolescente). Por **diagnóstico** é fraco: só 12 de 368 BPs têm perfil declarado.

### Artefatos existentes

| Artefato | Quando | Dados mínimos |
|---|---|---|
| **Plano estratégico** (PDF + link) | WhatsApp: decisor manda "gerar" ou pedido explícito. Web: botão | Criança identificada + tema definido. Sem tema, não gera |
| **Rotina visual** (dia ou semana, PDF + link) | WhatsApp: intenção `rotina_criar` → fluxo guiado. Web: Lúdico | Criança + as etapas do dia (a Ayla pergunta) |
| **Relatório escola** (markdown na tela, PDF) | Só na web: Evolução → Relatório | Nome/idade/perfil. Fica **muito** melhor com diários de 60d + ≥2 snapshots mensais + eventos |
| **Relatório terapeuta** | Idem | Idem |
| **Roteiro de fim de semana** (PDF + link) | Sexta, se a família aceitar a oferta | Criança + o que ela contar |
| **Histórias ilustradas** | Web (Histórias) ou magic link se pedir | Criança + situação + interesses |
| **Leitura de desenho** | Web (Lúdico) | Uma foto do desenho |
| **Avatar** | Web | Criança |
| **7 output types** | Botões na web | Perfil |
| **Snapshot mensal da Evolução** | Cron, início do mês | Diários do mês anterior |
| **Check-in / mensagem espontânea** | Cron diário | Criança + janela de horário + consentimento |
| **Celebração de sequência** | 7 dias consecutivos de check-in respondido | Praticamente inalcançável no teste |
| **Insight de padrão** | Cron semanal | Dados acumulados suficientes |

**Não existe:** plano semanal, guia para professor separado do relatório, material para terapeuta
separado do relatório, checklist.

### Recursos que provavelmente passam despercebidos nos 7 dias

Do mais invisível para o menos:

1. **Leitura de desenho** — funciona, é encantador, e nunca é oferecido.
2. **Relatório para escola / terapeuta** — o artefato mais impressionante do produto. Só na web, só
   se ela navegar até Evolução, e no dia 5 sai com poucas seções preenchidas.
3. **Avatar da criança** — magic link gerado em toda resposta, nunca mencionado.
4. **Histórias ilustradas** — só se ela pedir; o link existe pronto em toda resposta.
5. **Tela de Evolução e os snapshots** — nenhuma mensagem aponta para lá.
6. **Os 7 botões de apoio** na web — quem entra pelo WhatsApp nunca os vê.
7. **A Ayla enxergar foto** (lição de casa, rótulo de alimento) — funciona e não é anunciado.
8. **Registro Diário** — a Ayla registra nos bastidores e não diz que registrou.
9. **Rotina visual** — a Ayla nunca oferece; depende de a mãe expressar a intenção.
10. **Meditação guiada e timer lúdico** — existem no Lúdico e não aparecem em canal nenhum.

Cinco magic links (história, rotina, desenho, avatar, relatório) são **gerados em toda resposta**
para criança de até 12 anos, e ficam esperando que a mãe adivinhe que existem.

---

## 8. Documento de referência (perguntas por tema, faixa etária, orientações por idade)

**Não existe no repositório, e não é usado pela implementação atual.**

Busquei por conteúdo (`perguntas por tema`, `perguntas por faixa`, `orientações por idade`, `lógica de
investigação`, `critérios para aprofundamento`) em todos os `.md` e `.ts` do projeto: **zero
resultados**. E listei os 24 arquivos `.md` existentes — nenhum é esse documento.

O que existe e chega perto, em três pedaços separados:

| Peça | Onde | O que cobre | Usada? |
|---|---|---|---|
| **`fallback_questions`** | coluna em `specialist_prompt_templates` | 4 perguntas por skill, para quando a skill não tem certeza | ⚠️ Está no banco. **Não é lida por nenhum prompt** — nem `buildIdentityBlock` nem o Core a usam |
| **Faixa etária das BPs** | coluna no acervo de 368 BPs | Toda BP é presa a uma das 5 faixas | ✅ **Passou a ser usada na Fase 1** — o seletor filtra por `faixa_etaria_min/max` |
| **`MAPA_FUNCIONAL`** | `lib/conducao/diretrizes.ts` | "Onde olhar" por diagnóstico + freio anti-anamnese | ✅ Ativo, nos dois canais |

Há também o `05_PROMPT_SKILL_EMOCIONAL_v3.md`, citado em `cowork-frente-1-skills.md:38` como
"referência canônica" para as outras 10 skills. **Ele também não está no repositório** — vive fora
(provavelmente no Cowork da Karina).

**Por que não está sendo usado:** pelo que consigo reconstruir do histórico, esse material foi
produzido em conversa de planejamento e nunca foi transposto para o código nem para o banco. As
`fallback_questions` são o vestígio mais próximo de "perguntas por tema" que chegou ao schema — e
ficaram órfãs: existem na tabela e ninguém as lê.

Se esse documento existe fora do repositório, ele é hoje **conhecimento não conectado** — está na
mesma categoria de `eventos_membro` antes desta fase: material bom, gravado em algum lugar, que não
chega ao prompt.
